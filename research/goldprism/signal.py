"""
Signal Intelligence & Best Vehicle Ranking — GoldPrism
=======================================================

Signal system:
- Rolling statistics with configurable window
- Z-score computation with NaN guard
- Cost hurdle check
- Liquidity check
- Trust status from data validation layer
- Verdict: TRADABLE | WATCH | NO EDGE | BLOCKED

Best Vehicle Ranking:
- Ranks GOLDM, GOLDTEN, GOLDGUINEA, GOLDPETAL for a target exposure
- Uses verified contract specs
- Considers: fee efficiency, lot granularity, liquidity proxy, exposure mismatch
"""

from __future__ import annotations

import datetime
import hashlib
import json
import logging
from dataclasses import dataclass, asdict
from enum import Enum
from typing import Any, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Signal Parameters
# ---------------------------------------------------------------------------

@dataclass
class SignalConfig:
    """Configuration for rolling signal calculation."""
    rolling_window: int = 20           # bars for rolling statistics
    zscore_threshold: float = 1.5      # entry z-score
    zscore_exit: float = 0.5           # exit z-score
    min_obs_fraction: float = 0.7      # minimum non-NaN fraction in window
    cost_hurdle_inr_per_g: float = 2.0 # minimum net edge to be TRADABLE
    min_volume_contracts: int = 50     # minimum daily volume for liquidity gate
    stale_data_max_days: int = 3       # max days since last update before STALE flag


class SignalState(str, Enum):
    TRADABLE = "TRADABLE"
    WATCH = "WATCH"
    NO_EDGE = "NO EDGE"
    BLOCKED = "BLOCKED"


@dataclass
class SignalResult:
    """Complete signal result for one bar/date."""
    trade_date: str = ""
    contract_a: str = ""
    contract_b: str = ""
    net_edge: float = 0.0
    rolling_mean_edge: float = 0.0
    rolling_std_edge: float = 0.0
    zscore: float = 0.0
    cost_hurdle: float = 0.0
    cost_hurdle_passed: bool = False
    liquidity_ok: bool = True
    data_fresh: bool = True
    trust_status: str = "OK"
    trust_flags: list[str] = None
    signal: SignalState = SignalState.BLOCKED
    signal_reasons: list[str] = None

    def __post_init__(self):
        if self.trust_flags is None:
            self.trust_flags = []
        if self.signal_reasons is None:
            self.signal_reasons = []

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def compute_signal_series(
    net_edges: pd.Series,
    dates: pd.Series,
    volumes_a: pd.Series | None = None,
    volumes_b: pd.Series | None = None,
    trust_flags_series: pd.Series | None = None,
    config: SignalConfig | None = None,
) -> pd.DataFrame:
    """
    Compute rolling signal statistics on a net-edge time series.

    Parameters
    ----------
    net_edges : pd.Series
        Net edge values in INR per gram, indexed by integer or datetime.
    dates : pd.Series
        Corresponding trade dates.
    volumes_a, volumes_b : pd.Series, optional
        Daily volume for liquidity gate.
    trust_flags_series : pd.Series, optional
        Per-bar trust flag strings.
    config : SignalConfig, optional

    Returns
    -------
    pd.DataFrame with signal results for each bar.
    """
    if config is None:
        config = SignalConfig()

    n = len(net_edges)
    results = []

    rolling_mean = net_edges.rolling(config.rolling_window, min_periods=1).mean()
    rolling_std = net_edges.rolling(config.rolling_window, min_periods=1).std().fillna(0)

    for i in range(n):
        edge = float(net_edges.iloc[i])
        rmean = float(rolling_mean.iloc[i])
        rstd = float(rolling_std.iloc[i])

        # Z-score (guard against zero std)
        if rstd > 1e-8:
            zscore = (edge - rmean) / rstd
        else:
            zscore = 0.0

        # Liquidity gate
        liq_ok = True
        if volumes_a is not None and i < len(volumes_a):
            liq_ok = liq_ok and (float(volumes_a.iloc[i]) >= config.min_volume_contracts)
        if volumes_b is not None and i < len(volumes_b):
            liq_ok = liq_ok and (float(volumes_b.iloc[i]) >= config.min_volume_contracts)

        # Trust flags
        trust_flags = []
        if trust_flags_series is not None and i < len(trust_flags_series):
            tf = trust_flags_series.iloc[i]
            if tf and str(tf).strip():
                trust_flags = [str(tf)]

        trust_ok = len(trust_flags) == 0

        # Cost hurdle
        cost_hurdle_passed = edge > config.cost_hurdle_inr_per_g

        # Determine signal
        signal_reasons = []
        if not trust_ok:
            signal = SignalState.BLOCKED
            signal_reasons.append(f"Trust flags: {trust_flags}")
        elif not liq_ok:
            signal = SignalState.BLOCKED
            signal_reasons.append("Liquidity gate failed")
        elif edge <= 0:
            signal = SignalState.NO_EDGE
            signal_reasons.append(f"Net edge {edge:.4f} <= 0")
        elif not cost_hurdle_passed:
            signal = SignalState.WATCH
            signal_reasons.append(
                f"Net edge {edge:.4f} > 0 but < hurdle {config.cost_hurdle_inr_per_g:.4f}"
            )
        else:
            signal = SignalState.WATCH  # Requires additional verification for TRADABLE
            signal_reasons.append(
                f"Net edge {edge:.4f} > hurdle {config.cost_hurdle_inr_per_g:.4f} — WATCH pending full verification"
            )

        results.append(SignalResult(
            trade_date=str(dates.iloc[i]),
            net_edge=round(edge, 4),
            rolling_mean_edge=round(rmean, 4),
            rolling_std_edge=round(rstd, 4),
            zscore=round(zscore, 4),
            cost_hurdle=config.cost_hurdle_inr_per_g,
            cost_hurdle_passed=cost_hurdle_passed,
            liquidity_ok=liq_ok,
            trust_status="OK" if trust_ok else "FLAGGED",
            trust_flags=trust_flags,
            signal=signal,
            signal_reasons=signal_reasons,
        ))

    return pd.DataFrame([r.to_dict() for r in results])


# ---------------------------------------------------------------------------
# Best Vehicle Ranking
# ---------------------------------------------------------------------------

@dataclass
class VehicleRank:
    """Ranking result for one contract for a given target exposure."""
    rank: int = 0
    contract_code: str = ""
    trading_unit_g: float = 0.0
    purity_fine: float = 0.0
    quote_unit_g: float = 0.0
    target_exposure_g: float = 0.0
    lots_required: int = 0
    actual_exposure_g: float = 0.0
    exposure_mismatch_g: float = 0.0
    exposure_mismatch_pct: float = 0.0
    estimated_cost_per_lot_inr: float = 0.0
    cost_efficiency_score: float = 0.0    # lower cost per gram = better
    lot_granularity_score: float = 0.0    # finer grain = better
    liquidity_score: float = 0.0          # based on OI/volume proxy
    composite_score: float = 0.0          # weighted composite
    spec_verified: bool = False
    is_blocked: bool = False
    block_reason: str = ""
    notes: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def rank_best_vehicle(
    target_exposure_g: float,
    price_per_contract: dict[str, float],    # contract_code -> quoted price INR per quote unit
    volume_oi: dict[str, int] | None = None, # contract_code -> daily volume or OI
    cost_config: Any | None = None,
    as_of: datetime.date | None = None,
    weights: dict[str, float] | None = None,
) -> list[VehicleRank]:
    """
    Rank GOLDM, GOLDTEN, GOLDGUINEA, GOLDPETAL for a target gold exposure.

    Scoring factors:
    1. Cost efficiency: lower total round-trip cost per gram = better
    2. Lot granularity: smaller lot size = finer exposure control = better
    3. Exposure mismatch: closer to target = better
    4. Liquidity: higher volume/OI = better

    Parameters
    ----------
    target_exposure_g : float
        Target gold exposure in grams.
    price_per_contract : dict
        Current quoted prices per contract code.
    volume_oi : dict, optional
        Volume or OI per contract for liquidity scoring.
    cost_config : CostModelConfig, optional
    as_of : date, optional
    weights : dict, optional
        Scoring weights. Default: cost=0.35, granularity=0.25, mismatch=0.25, liquidity=0.15

    Returns
    -------
    List of VehicleRank sorted by rank (best first).
    """
    from goldprism.contract_master import get_spec, SUPPORTED_CONTRACTS
    from goldprism.xray import calculate_transaction_costs, CostModelConfig

    if cost_config is None:
        cost_config = CostModelConfig()
    if as_of is None:
        as_of = datetime.date.today()
    if weights is None:
        weights = {
            "cost": 0.35,
            "granularity": 0.25,
            "mismatch": 0.25,
            "liquidity": 0.15,
        }
    if volume_oi is None:
        volume_oi = {}

    contracts = SUPPORTED_CONTRACTS
    rankings: list[VehicleRank] = []

    for contract_code in contracts:
        vr = VehicleRank(contract_code=contract_code)

        # Get spec
        try:
            spec = get_spec(contract_code, as_of)
        except Exception as e:
            vr.is_blocked = True
            vr.block_reason = str(e)
            rankings.append(vr)
            continue

        vr.trading_unit_g = spec.trading_unit_g
        vr.purity_fine = spec.purity_fine
        vr.quote_unit_g = spec.quote_unit_g
        vr.spec_verified = spec.is_verified
        vr.target_exposure_g = target_exposure_g

        if not spec.is_verified:
            vr.is_blocked = True
            vr.block_reason = f"Spec UNVERIFIED: {spec.verification_status}"
            rankings.append(vr)
            continue

        # Calculate lots for target exposure
        grams_per_lot = spec.gram_per_lot
        lots = max(1, round(target_exposure_g / grams_per_lot))
        actual_exposure = lots * grams_per_lot
        mismatch = abs(actual_exposure - target_exposure_g)
        mismatch_pct = mismatch / target_exposure_g * 100.0 if target_exposure_g > 0 else 0.0

        vr.lots_required = lots
        vr.actual_exposure_g = actual_exposure
        vr.exposure_mismatch_g = mismatch
        vr.exposure_mismatch_pct = round(mismatch_pct, 2)

        # Get quoted price
        price_quoted = price_per_contract.get(contract_code, 0.0)
        if price_quoted <= 0:
            vr.is_blocked = True
            vr.block_reason = "No price available"
            rankings.append(vr)
            continue

        # Calculate costs
        try:
            costs = calculate_transaction_costs(
                price_quoted, contract_code, lots, cost_config, as_of
            )
            vr.estimated_cost_per_lot_inr = round(costs.total_per_gram_inr, 4)
        except Exception as e:
            vr.is_blocked = True
            vr.block_reason = f"Cost calculation error: {e}"
            rankings.append(vr)
            continue

        # Liquidity score (higher OI/volume = better, normalized 0-1)
        oi = volume_oi.get(contract_code, 0)
        vr.liquidity_score = min(1.0, oi / 10000.0) if oi > 0 else 0.1

        rankings.append(vr)

    # Filter out blocked entries for scoring
    scoreable = [r for r in rankings if not r.is_blocked]

    if not scoreable:
        return rankings

    # Normalize scores (0 = worst, 1 = best)
    # Cost efficiency: lower is better → invert
    costs = [r.estimated_cost_per_lot_inr for r in scoreable]
    cost_min, cost_max = min(costs), max(costs)

    # Lot granularity: smaller lot = better → invert
    grams = [r.trading_unit_g for r in scoreable]
    g_min, g_max = min(grams), max(grams)

    # Mismatch: lower = better → invert
    mismatches = [r.exposure_mismatch_pct for r in scoreable]
    m_min, m_max = min(mismatches), max(mismatches)

    def norm_inv(val, vmin, vmax):
        if vmax == vmin:
            return 1.0
        return 1.0 - (val - vmin) / (vmax - vmin)

    def norm(val, vmin, vmax):
        if vmax == vmin:
            return 1.0
        return (val - vmin) / (vmax - vmin)

    for vr in scoreable:
        vr.cost_efficiency_score = norm_inv(vr.estimated_cost_per_lot_inr, cost_min, cost_max)
        vr.lot_granularity_score = norm_inv(vr.trading_unit_g, g_min, g_max)
        mismatch_score = norm_inv(vr.exposure_mismatch_pct, m_min, m_max)
        liq_score = vr.liquidity_score

        composite = (
            weights["cost"] * vr.cost_efficiency_score
            + weights["granularity"] * vr.lot_granularity_score
            + weights["mismatch"] * mismatch_score
            + weights["liquidity"] * liq_score
        )
        vr.composite_score = round(composite, 4)

    # Sort by composite score descending
    scoreable_sorted = sorted(scoreable, key=lambda r: -r.composite_score)
    blocked = [r for r in rankings if r.is_blocked]

    final = scoreable_sorted + blocked
    for i, vr in enumerate(final):
        vr.rank = i + 1

    return final
