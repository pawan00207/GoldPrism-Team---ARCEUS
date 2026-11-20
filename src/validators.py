"""Schema normalization and integrity gates for MCX gold Bhavcopy frames."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any, Iterable

import pandas as pd

logger = logging.getLogger(__name__)

# Quote units and fineness are centralized so specification updates are local.
CONTRACT_NORMALIZATION_CONFIG: dict[str, dict[str, float]] = {
    "GOLDM": {"quoted_grams": 10.0, "purity": 0.995},
    "GOLDTEN": {"quoted_grams": 10.0, "purity": 0.999},
    "GOLDGUINEA": {"quoted_grams": 8.0, "purity": 0.999},
    "GOLDPETAL": {"quoted_grams": 1.0, "purity": 0.999},
}

COLUMN_ALIASES: dict[str, tuple[str, ...]] = {
    "symbol": ("symbol", "scrip", "tradingsymbol", "product", "commodity"),
    "trade_date": ("tradedate", "tradingdate", "date", "bhavcopydate"),
    "expiry_date": ("expirydate", "expiry", "contractexpiry"),
    "open_price": ("open", "openprice", "openingprice"),
    "high_price": ("high", "highprice"),
    "low_price": ("low", "lowprice"),
    "close_price": ("close", "closeprice"),
    "settle_price": ("settle", "settleprice", "settlement", "settlementprice"),
    "volume": ("volume", "totalvolume", "noofcontracts", "noofcontractstraded", "contracts"),
    "open_interest": ("openinterest", "oi", "openint", "openinterestcontracts"),
}
PRICE_COLUMNS = ("open_price", "high_price", "low_price", "close_price", "settle_price")


class SchemaValidationError(ValueError):
    """Raised when a source frame does not contain enough columns to validate."""


class DateMismatchError(ValueError):
    """Raised when the frame's trading date differs from the requested date."""

    def __init__(self, message: str, data_health: dict[str, Any]) -> None:
        super().__init__(message)
        self.data_health = data_health


@dataclass(frozen=True)
class ValidationResult:
    """Validated gold rows, rejected source rows, and dashboard health metrics."""

    frame: pd.DataFrame
    rejected_rows: pd.DataFrame
    data_health: dict[str, Any]


def _column_token(value: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value).strip().lower())


def _parse_date(value: Any) -> date | None:
    if value is None or pd.isna(value):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    for fmt in ("%Y%m%d", "%d%b%Y", "%d-%b-%Y", "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def _canonicalize_columns(frame: pd.DataFrame) -> pd.DataFrame:
    token_to_column = {_column_token(column): column for column in frame.columns}
    rename: dict[Any, str] = {}
    for canonical, aliases in COLUMN_ALIASES.items():
        if canonical in frame.columns:
            continue
        source = next((token_to_column[alias] for alias in aliases if alias in token_to_column), None)
        if source is not None:
            rename[source] = canonical

    normalized = frame.rename(columns=rename).copy()
    missing = [column for column in ("symbol", "trade_date", "expiry_date", "settle_price") if column not in normalized]
    if missing:
        raise SchemaValidationError(
            f"mcxlib schema is missing required columns {missing}; received columns: {frame.columns.tolist()}"
        )
    return normalized


def _health_template(requested_date: date, raw_rows: int) -> dict[str, Any]:
    return {
        "requested_date": requested_date.isoformat(),
        "source": "mcxlib",
        "fetched_at": None,
        "raw_rows": raw_rows,
        "validated_rows": 0,
        "rejected_rows": 0,
        "missing_values_count": 0,
        "missing_values_total": 0,
        "missing_values_pct": 0.0,
        "outlier_count": 0,
        "missing_trading_days": 0,
        "date_mismatches_rejected": 0,
        "untrusted_rows": 0,
    }


def validate_bhavcopy(
    source_frame: pd.DataFrame,
    requested_date: date | datetime | str,
    *,
    seed_error: bool = False,
) -> ValidationResult:
    """Normalize columns, enforce date/row gates, and calculate health metrics.

    ``seed_error`` deliberately changes the normalized trade date before the
    date gate, allowing the demo to exercise the rejected-mismatch path.
    """
    expected_date = _parse_date(requested_date)
    if expected_date is None:
        raise ValueError(f"Invalid requested date: {requested_date!r}")

    normalized = _canonicalize_columns(source_frame)
    if "source" not in normalized:
        normalized["source"] = source_frame.attrs.get("source", "mcxlib")
    if "fetched_at" not in normalized:
        normalized["fetched_at"] = source_frame.attrs.get("fetched_at")
    normalized["symbol"] = normalized["symbol"].astype("string").str.strip().str.upper()
    gold_rows = normalized[normalized["symbol"].isin(CONTRACT_NORMALIZATION_CONFIG)].copy()

    if gold_rows.empty:
        health = _health_template(expected_date, 0)
        raise SchemaValidationError("mcxlib returned no rows for the supported MCX gold contracts")

    missing_count = int(gold_rows.isna().sum().sum())
    value_count = int(gold_rows.shape[0] * gold_rows.shape[1])
    health = _health_template(expected_date, len(gold_rows))
    sources = gold_rows["source"].dropna().astype(str).unique().tolist()
    health["source"] = sources[0] if len(sources) == 1 else ",".join(sorted(sources))
    fetched_at = gold_rows["fetched_at"].dropna().astype(str)
    health["fetched_at"] = fetched_at.iloc[0] if not fetched_at.empty else None
    health["missing_values_count"] = missing_count
    health["missing_values_total"] = value_count
    health["missing_values_pct"] = round(100.0 * missing_count / value_count, 4) if value_count else 0.0

    gold_rows["trade_date"] = gold_rows["trade_date"].map(_parse_date)
    if seed_error:
        gold_rows["trade_date"] = expected_date + timedelta(days=1)
    actual_dates = set(gold_rows["trade_date"].dropna())
    if actual_dates != {expected_date} or gold_rows["trade_date"].isna().any():
        health["date_mismatches_rejected"] = 1
        health["rejected_rows"] = len(gold_rows)
        returned = sorted(value.isoformat() for value in actual_dates)
        message = (
            f"Rejected Bhavcopy date mismatch: requested {expected_date.isoformat()}, "
            f"returned {returned or 'no parseable trading date'}"
        )
        logger.error("%s; data_health=%s", message, health)
        raise DateMismatchError(message, health)

    gold_rows["expiry_date"] = gold_rows["expiry_date"].map(_parse_date)
    for column in PRICE_COLUMNS + ("volume", "open_interest"):
        if column not in gold_rows:
            gold_rows[column] = float("nan")
        numeric_values = gold_rows[column]
        if numeric_values.dtype == object or pd.api.types.is_string_dtype(numeric_values.dtype):
            numeric_values = numeric_values.astype("string").str.replace(",", "", regex=False)
        gold_rows[column] = pd.to_numeric(numeric_values, errors="coerce")

    rejected: list[pd.DataFrame] = []
    invalid_expiry = gold_rows["expiry_date"].isna()
    if invalid_expiry.any():
        rejected_frame = gold_rows.loc[invalid_expiry].copy()
        rejected_frame["rejection_reason"] = "missing_or_invalid_expiry_date"
        rejected.append(rejected_frame)

    negative_price = gold_rows.loc[:, PRICE_COLUMNS].lt(0).any(axis=1)
    invalid_rows = invalid_expiry | negative_price
    if negative_price.any():
        rejected_frame = gold_rows.loc[negative_price & ~invalid_expiry].copy()
        rejected_frame["rejection_reason"] = "negative_price"
        rejected.append(rejected_frame)

    valid = gold_rows.loc[~invalid_rows].copy()
    if not valid.empty:
        valid["contract_key"] = valid["symbol"] + "|" + valid["expiry_date"].map(date.isoformat)
        duplicate = valid.duplicated(subset=["symbol", "expiry_date"], keep="first")
        if duplicate.any():
            rejected_frame = valid.loc[duplicate].copy()
            rejected_frame["rejection_reason"] = "duplicate_symbol_expiry_key"
            rejected.append(rejected_frame)
            valid = valid.loc[~duplicate].copy()

        valid["price_per_gram_fine_gold"] = valid.apply(
            lambda row: row["settle_price"]
            / CONTRACT_NORMALIZATION_CONFIG[row["symbol"]]["quoted_grams"]
            / CONTRACT_NORMALIZATION_CONFIG[row["symbol"]]["purity"],
            axis=1,
        )
        values = valid["price_per_gram_fine_gold"].dropna()
        valid["is_outlier"] = False
        if len(values) >= 4:
            q1, q3 = values.quantile([0.25, 0.75])
            spread = q3 - q1
            if spread > 0:
                outlier_mask = (valid["price_per_gram_fine_gold"] < q1 - 1.5 * spread) | (
                    valid["price_per_gram_fine_gold"] > q3 + 1.5 * spread
                )
                valid["is_outlier"] = outlier_mask.fillna(False)
        valid["settle_trusted"] = (
            valid["volume"].notna()
            & valid["open_interest"].notna()
            & valid["volume"].gt(0)
            & valid["open_interest"].gt(0)
        )
        valid["signal_eligible"] = (
            valid["settle_trusted"]
            & valid["settle_price"].notna()
            & ~valid["is_outlier"]
        )
    else:
        valid["contract_key"] = pd.Series(dtype="string")

    rejected_rows = pd.concat(rejected, ignore_index=True) if rejected else pd.DataFrame()
    health["validated_rows"] = len(valid)
    health["rejected_rows"] = len(rejected_rows)
    health["outlier_count"] = int(valid["is_outlier"].sum()) if "is_outlier" in valid else 0
    health["untrusted_rows"] = int((~valid["settle_trusted"]).sum()) if "settle_trusted" in valid else 0
    logger.info("Bhavcopy validation data_health=%s", health)
    return ValidationResult(frame=valid.reset_index(drop=True), rejected_rows=rejected_rows, data_health=health)


def aggregate_data_health(
    daily_summaries: Iterable[dict[str, Any]],
    *,
    missing_trading_days: int = 0,
) -> dict[str, Any]:
    """Aggregate per-day health records for the dashboard/backfill summary."""
    summaries = list(daily_summaries)
    missing_count = sum(int(item.get("missing_values_count", 0)) for item in summaries)
    missing_total = sum(int(item.get("missing_values_total", 0)) for item in summaries)
    return {
        "days_processed": len(summaries),
        "raw_rows": sum(int(item.get("raw_rows", 0)) for item in summaries),
        "validated_rows": sum(int(item.get("validated_rows", 0)) for item in summaries),
        "rejected_rows": sum(int(item.get("rejected_rows", 0)) for item in summaries),
        "missing_values_count": missing_count,
        "missing_values_total": missing_total,
        "missing_values_pct": round(100.0 * missing_count / missing_total, 4) if missing_total else 0.0,
        "outlier_count": sum(int(item.get("outlier_count", 0)) for item in summaries),
        "missing_trading_days": missing_trading_days
        + sum(int(item.get("missing_trading_days", 0)) for item in summaries),
        "date_mismatches_rejected": sum(int(item.get("date_mismatches_rejected", 0)) for item in summaries),
        "untrusted_rows": sum(int(item.get("untrusted_rows", 0)) for item in summaries),
        "source_counts": {
            source: sum(1 for item in summaries if item.get("source") == source)
            for source in sorted({str(item.get("source", "unknown")) for item in summaries})
        },
        "last_successful_fetch_at": max(
            (
                str(item["fetched_at"])
                for item in summaries
                if item.get("fetched_at") and int(item.get("validated_rows", 0)) > 0
            ),
            default=None,
        ),
    }
