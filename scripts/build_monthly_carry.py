#!/usr/bin/env python3
"""
Compute monthly GOLDM near/next spread statistics from the frozen 18-month
bhavcopy cache (research/data/mcx_bhavcopy_18m_cached.parquet, READ-ONLY).

Method mirrors research/run_full_backtest.py exactly:
  normalized_999(q)  = (settle / quote_unit_g) * (purity / 999)
  raw_spread         = norm(next) - norm(near)
  carry              = avg(norm) * repo * (days_diff / 365)
  gross_residual     = raw_spread - carry
  paired_cost_inr_g  = cost model from research/config/costs.yaml
  net_edge           = gross_residual - paired_cost_inr_g

Output: results/monthly-carry.json
Never overwrites pipeline artifacts; never touches the Python pipeline.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "research" / "data" / "mcx_bhavcopy_18m_cached.parquet"
COSTS_YAML = ROOT / "research" / "config" / "costs.yaml"
OUT = ROOT / "results" / "monthly-carry.json"

try:
    import pandas as pd
    import yaml
    import numpy as np
except ImportError as ex:
    print(f"[monthly-carry] missing dep: {ex}", file=sys.stderr)
    sys.exit(2)

df = pd.read_parquet(DATA)
df["trade_date"] = pd.to_datetime(df["trade_date"]).dt.date
df["expiry_date"] = pd.to_datetime(df["expiry_date"]).dt.date

with open(COSTS_YAML) as f:
    cfg = yaml.safe_load(f)
stat = cfg["statutory_charges"]
brk = float(cfg["brokerage"]["flat_fee_per_lot_inr"])
slip_cfg = cfg["slippage_and_market_impact"]
repo = float(cfg["financing_repo_baseline"]["annual_repo_rate"])
base_slip = float(slip_cfg["base_liquid_slippage_bps"])
haircut = float(slip_cfg["settle_to_executable_haircut_bps"])
thin_vol = float(slip_cfg["thin_volume_threshold_contracts"])
thin_oi = float(slip_cfg["thin_oi_threshold_contracts"])
mult = float(slip_cfg["thin_volume_multiplier"])


def norm(settle, quote_unit, purity):
    return (settle / quote_unit) * (purity / 999.0)


goldm = df[df["symbol"] == "GOLDM"].sort_values(["trade_date", "expiry_date"])

rows = []
for t in sorted(df["trade_date"].unique()):
    day = goldm[goldm["trade_date"] == t].sort_values("expiry_date")
    if len(day) < 2:
        continue
    near, nxt = day.iloc[0], day.iloc[1]
    nn = norm(float(near["settle"]), float(near["quote_unit_g"]), float(near["purity"]))
    nf = norm(float(nxt["settle"]), float(nxt["quote_unit_g"]), float(nxt["purity"]))
    dd = (nxt["expiry_date"] - near["expiry_date"]).days
    avg = (nn + nf) / 2.0
    carry_inr = avg * repo * dd / 365.0
    raw = nf - nn
    gross = raw - carry_inr

    def leg_cost(settle, quote_unit, purity, volume, oi):
        tu, qq = float(near["trading_unit_g"]), float(near["quote_unit_g"])
        val = (settle / quote_unit) * tu  # per-side turnover INR (GOLDM tsp unit both legs)
        broker = brk * 2
        exch = val * 2 * float(stat["exchange_turnover_fee_rate"])
        ctt = val * float(stat["ctt_rate"])
        stamp = val * float(stat["stamp_duty_rate"])
        sebi = val * 2 * float(stat["sebi_turnover_fee_rate"])
        gst = (broker + exch + sebi) * float(stat["gst_rate"])
        min_vol = min(float(volume), 1e9)
        min_oi = float(oi)
        mult_local = mult if (min_vol < thin_vol or min_oi < thin_oi) else 1.0
        eff_slip = base_slip * mult_local + haircut
        slip = val * 2 * eff_slip / 10000.0
        return broker + exch + ctt + stamp + sebi + gst + slip

    c_near = leg_cost(float(near["settle"]), float(near["quote_unit_g"]), near["purity"], near["volume"], near["open_interest"])
    c_next = leg_cost(float(nxt["settle"]), float(nxt["quote_unit_g"]), nxt["purity"], nxt["volume"], nxt["open_interest"])
    # cost_inr_g = total / avg grams (each lot grams; avg of the two legs)
    grams = (float(near["trading_unit_g"]) + float(nxt["trading_unit_g"])) / 2.0
    cost_per_g = (c_near + c_next) / grams
    net = gross - cost_per_g

    rows.append({
        "date": t.isoformat(),
        "raw_spread_bps": (raw / nn) * 10000.0,
        "carry_bps": (carry_inr / nn) * 10000.0,
        "gross_residual_bps": (gross / nn) * 10000.0,
        "cost_bps": (cost_per_g / nn) * 10000.0,
        "net_edge_bps": (net / nn) * 10000.0,
    })

m = df  # noqa
by_month: dict[str, list[dict]] = {}
for r in rows:
    by_month.setdefault(r["date"][:7], []).append(r)

months = []
for k in sorted(by_month):
    rs = by_month[k]
    months.append({
        "month": k,
        "days": len(rs),
        "raw_spread_bps": round(float(np.mean([r["raw_spread_bps"] for r in rs])), 2),
        "carry_bps": round(float(np.mean([r["carry_bps"] for r in rs])), 2),
        "gross_residual_bps": round(float(np.mean([r["gross_residual_bps"] for r in rs])), 2),
        "cost_bps": round(float(np.mean([r["cost_bps"] for r in rs])), 2),
        "net_edge_bps": round(float(np.mean([r["net_edge_bps"] for r in rs])), 2),
    })

out = {
    "method": "GOLDM near/next calendar pair, normalized 999-fine, far-leg minus near-leg, ACT/365 carry at repo, itemized costs.yaml model; monthly means across matched-contract trading days in 2024-01..2025-02.",
    "source": "research/data/mcx_bhavcopy_18m_cached.parquet (sha256 c3d1e859220371039ebcc15bf9e6c5722f5d5836089815f6904979fd14f60082)",
    "costs_source": "research/config/costs.yaml",
    "units": "bps of near-leg normalized price",
    "months": months,
}
OUT.write_text(json.dumps(out, indent=2), encoding="utf-8")
print(f"[monthly-carry] wrote {OUT} ({len(months)} months, {len(rows)} days)")
for mth in months:
    print(f"  {mth['month']}  gross {mth['gross_residual_bps']:+.2f} bps  net {mth['net_edge_bps']:+.2f} bps  ({mth['days']}d)")
