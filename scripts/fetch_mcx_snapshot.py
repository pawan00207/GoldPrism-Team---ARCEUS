#!/usr/bin/env python3
"""
Archive the latest MCX daily gold-family publication for offline fallback
===================================================================
Uses the `mcxdata` package (https://pypi.org/project/mcx-data) to pull:

  1. Spot gold (INR/10g, Ahmedabad)   - mcx.get_spot_recent('GOLD')
  2. Futures & options bhavcopy       - mcx.get_bhavcopy('FUTCOM')
  3. GOLD-family rows only            - GOLDM / GOLDTEN / GOLDGUINEA / GOLDPETAL

Writes a JSON snapshot that the Next.js app serves via
`/api/goldprism/mcx-snapshot`. The snapshot is machine-generated; never
edit it by hand. If the fetch fails, the previous snapshot is left
untouched (the API then reports it as stale or unavailable).

Usage:
  python scripts/fetch_mcx_snapshot.py            # writes results/mcx-live-snapshot.json
  python scripts/fetch_mcx_snapshot.py --print    # also print summary

Requires: pip install mcx_data pandas

Schedule suggestion (Windows Task Scheduler / cron during MCX hours,
roughly 09:00-23:30 IST on trading days):
  */5 * * * * cd /path/to/repo && python scripts/fetch_mcx_snapshot.py
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "results" / "mcx-live-snapshot.json"

GOLD_FAMILY = ("GOLDM", "GOLDTEN", "GOLDGUINEA", "GOLDPETAL")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--print", action="store_true", help="print summary to stdout")
    parser.add_argument("--expect-date", type=date.fromisoformat, help="require this returned trading date (YYYY-MM-DD)")
    parser.add_argument("--output", type=Path, default=OUT_PATH, help="path for the validated daily snapshot")
    args = parser.parse_args()

    try:
        from mcxdata import mcx  # type: ignore
    except ImportError as exc:
        print(f"[mcx-snapshot] mcxdata not importable: {exc}", file=sys.stderr)
        print("[mcx-snapshot] install with: pip install mcx_data", file=sys.stderr)
        return 2

    try:
        bhav = mcx.get_bhavcopy("FUTCOM")
    except Exception as exc:  # network/Akamai/upstream failure: keep old snapshot
        print(f"[mcx-snapshot] upstream fetch failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        print("[mcx-snapshot] leaving existing snapshot in place", file=sys.stderr)
        return 3

    if bhav.empty or not {"Symbol", "Date", "ExpiryDate", "Close"}.issubset(bhav.columns):
        print("[mcx-snapshot] missing required futures fields", file=sys.stderr)
        return 3
    gold = bhav[bhav["Symbol"].str.strip().str.upper().isin(GOLD_FAMILY)].copy()
    day_values = gold["Date"].unique()
    try:
        if len(day_values) != 1:
            raise ValueError("missing or mixed source dates")
        trading_date = date.fromisoformat(str(day_values[0]))
        india_today = datetime.now(timezone(timedelta(hours=5, minutes=30))).date()
        if trading_date > india_today or (args.expect_date and trading_date != args.expect_date):
            raise ValueError("unexpected returned trading date")
        if gold.duplicated(["Symbol", "ExpiryDate"]).any():
            raise ValueError("duplicate gold contracts")
        if set(gold["Symbol"].str.strip().str.upper()) != set(GOLD_FAMILY):
            raise ValueError("incomplete gold contract family")
        for _, row in gold.iterrows():
            if not _num(row["Close"]) or _num(row["Close"]) < 0:
                raise ValueError("missing or invalid contract close")
            datetime.strptime(str(row["ExpiryDate"]).strip(), "%d%b%Y")
    except (TypeError, ValueError) as exc:
        print(f"[mcx-snapshot] validation failed: {exc}", file=sys.stderr)
        return 3

    try:
        spot = mcx.get_spot_recent(commodity="GOLD", location="AHMEDABAD")
        spot_row = spot.iloc[0].to_dict() if len(spot) else None
    except Exception:
        spot_row = None
    spot_out = None
    if spot_row:
        spot_out = {
            "commodity": str(spot_row.get("Commodity")),
            "unit": str(spot_row.get("Unit")),
            "location": str(spot_row.get("Location")),
            "price": _num(spot_row.get("Spot Price (Rs.)")),
            "change": _num(spot_row.get("Up/Down")),
            "quoteTimestamp": str(spot_row.get("Date")),
        }

    bhav_date = trading_date.isoformat()
    gold = gold.sort_values(["Symbol", "ExpiryDate"]).reset_index(drop=True)

    rows = []
    for _, r in gold.iterrows():
        rows.append(
            {
                "symbol": str(r["Symbol"]).strip().upper(),
                "expiryDate": str(r["ExpiryDate"]).strip().upper(),
                "open": _num(r.get("Open")),
                "high": _num(r.get("High")),
                "low": _num(r.get("Low")),
                "close": _num(r.get("Close")),
                "previousClose": _num(r.get("PreviousClose")),
                "volumeLots": _int(r.get("Volume_Lots")),
                "volumeUnit": _int(r.get("Volume_Unit")),
                "valueLakhs": _num(r.get("Value_Lakhs")),
                "openInterestLots": _int(r.get("OI_Lots")),
            }
        )

    payload = {
        "fetchedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sourceUrl": "https://www.mcxindia.com/market-data/bhavcopy",
        "source": "mcx_data (MCX India public bhavcopy & spot feeds)",
        "spot": spot_out,
        "bhavcopy": {
            "date": bhav_date,
            "goldFamilyRows": rows,
        },
        "notice": "Generated by scripts/fetch_mcx_snapshot.py. Not financial advice. Verify against the official MCX bhavcopy before trading decisions.",
    }

    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    payload["contentHash"] = hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    out = args.output
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", delete=False, dir=out.parent, encoding="utf-8") as handle:
        tmp = Path(handle.name)
    try:
        if out.exists():
            previous = json.loads(out.read_text(encoding="utf-8")).get("bhavcopy", {}).get("date", "")
            if previous and previous > bhav_date:
                print("[mcx-snapshot] preserving more recent publication", file=sys.stderr)
                return 3
        tmp.write_text(json.dumps(payload, indent=2, allow_nan=False), encoding="utf-8")
        tmp.replace(out)
    finally:
        tmp.unlink(missing_ok=True)

    if args.print:
        print(f"[mcx-snapshot] wrote {out}")
        print(f"[mcx-snapshot] fetchedAt={payload['fetchedAt']} bhavcopy_date={bhav_date} gold_rows={len(rows)}")
        if spot_out:
            print(f"[mcx-snapshot] GOLD spot={spot_out['price']} ({spot_out['location']}, {spot_out['quoteTimestamp']})")
    return 0


def _num(v):
    try:
        f = float(v)
        return f if math.isfinite(f) else None
    except (TypeError, ValueError):
        return None


def _int(v):
    try:
        f = float(v)
        return int(f) if math.isfinite(f) else None
    except (TypeError, ValueError):
        return None


if __name__ == "__main__":
    sys.exit(main())
