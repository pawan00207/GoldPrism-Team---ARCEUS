"""Fetch, validate, and store the current MCX trading date."""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.fetcher import FetchError, fetch_bhavcopy
from src.store import load_into_duckdb, save_data_health, save_raw_parquet, save_validated_parquet
from src.cross_check import (
    apply_settlement_cross_check,
    fetch_source_b_settlements,
    get_cross_check_rows,
    load_cross_check_config,
)
from src.integrations.source_logging import latest_source_rows
from src.validators import (
    DateMismatchError,
    SchemaValidationError,
    ValidationResult,
    validate_bhavcopy,
)

logger = logging.getLogger(__name__)


def ingest_date(trade_date: date, *, seed_error: bool = False) -> tuple[bool, dict[str, object]]:
    """Run one fetch/validate/store pass; a date mismatch is recorded and rejected."""
    if seed_error:
        logger.warning("Seed-error demo uses a synthetic row; it will not be stored as raw market data")
        raw_frame = pd.DataFrame(
            [
                {
                    "Symbol": "GOLDM",
                    "Date": trade_date.isoformat(),
                    "ExpiryDate": (trade_date + timedelta(days=30)).isoformat(),
                    "SettlePrice": 75000.0,
                    "Volume": 10,
                    "OpenInterest": 100,
                }
            ]
        )
    else:
        raw_frame = fetch_bhavcopy(trade_date)
        raw_path = save_raw_parquet(raw_frame, trade_date)
        logger.info("Raw source frame saved/retained at %s", raw_path)

    try:
        result: ValidationResult = validate_bhavcopy(raw_frame, trade_date, seed_error=seed_error)
    except DateMismatchError as exc:
        save_data_health(exc.data_health)
        logger.error("Ingestion rejected: %s", exc)
        return False, exc.data_health
    except SchemaValidationError as exc:
        missing_values = int(raw_frame.isna().sum().sum())
        total_values = int(raw_frame.shape[0] * raw_frame.shape[1])
        source = (
            str(raw_frame["source"].dropna().iloc[0])
            if "source" in raw_frame and raw_frame["source"].notna().any()
            else str(raw_frame.attrs.get("source", "mcxlib"))
        )
        fetched_at = (
            raw_frame["fetched_at"].dropna().iloc[0]
            if "fetched_at" in raw_frame and raw_frame["fetched_at"].notna().any()
            else raw_frame.attrs.get("fetched_at")
        )
        health: dict[str, object] = {
            "requested_date": trade_date.isoformat(),
            "fetched_at": fetched_at,
            "source": source,
            "raw_rows": len(raw_frame),
            "validated_rows": 0,
            "rejected_rows": len(raw_frame),
            "missing_values_count": missing_values,
            "missing_values_total": total_values,
            "missing_values_pct": (
                round(100.0 * missing_values / total_values, 4)
                if total_values
                else 0.0
            ),
            "outlier_count": 0,
            "missing_trading_days": 0,
            "date_mismatches_rejected": 0,
            "untrusted_rows": 0,
            "schema_error": str(exc),
        }
        save_data_health(health)
        logger.error("Ingestion rejected by schema gate: %s", exc)
        return False, health

    if result.frame.empty:
        save_data_health(result.data_health)
        logger.error("Ingestion rejected: all %d rows failed integrity gates.", result.data_health["rejected_rows"])
        return False, result.data_health

    config = load_cross_check_config()
    active_since = datetime.strptime(str(config["active_since"]), "%Y-%m-%d").date()
    if bool(config.get("cross_check_enabled", False)) and trade_date >= active_since:
        _, source_b_payload = fetch_source_b_settlements(trade_date)
        source_b_url = (
            __import__("os").environ.get("SOURCE_B_URL", "").strip()
            or str(config.get("source_b_url", "")).strip()
        )
        result_frame = apply_settlement_cross_check(
            result.frame,
            source_b_payload,
            trade_date,
            source_b_url=source_b_url,
        )
        result = ValidationResult(
            frame=result_frame,
            rejected_rows=result.rejected_rows,
            data_health={
                **result.data_health,
                "cross_check_unverified": int(
                    result_frame["cross_check_state"].eq("UNVERIFIED").sum()
                ),
                "cross_check_mismatches": int(
                    result_frame["cross_check_state"].eq("MISMATCH").sum()
                ),
                "cross_check_matches": int(
                    result_frame["cross_check_state"].eq("MATCH").sum()
                ),
            },
        )

    save_validated_parquet(result.frame, trade_date)
    load_into_duckdb(result.frame)
    save_data_health(result.data_health)
    logger.info("Stored validated Bhavcopy; data_health=%s", result.data_health)
    return True, result.data_health


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date", help="Override the Asia/Kolkata date (YYYY-MM-DD or YYYYMMDD)")
    parser.add_argument(
        "--health-output",
        help="Optional JSON file for publishing this run's integrity summary to the web app",
    )
    parser.add_argument(
        "--seed-error",
        action="store_true",
        help="Inject a one-day trade-date mismatch to demo the rejected-data gate",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    if args.date:
        try:
            trade_date = datetime.strptime(args.date, "%Y-%m-%d").date()
        except ValueError:
            try:
                trade_date = datetime.strptime(args.date, "%Y%m%d").date()
            except ValueError:
                parser.error("--date must be YYYY-MM-DD or YYYYMMDD")
    else:
        trade_date = datetime.now(ZoneInfo("Asia/Kolkata")).date()

    try:
        accepted, health = ingest_date(trade_date, seed_error=args.seed_error)
    except FetchError as exc:
        logger.error("%s", exc)
        return 1
    health["ingestion_status"] = "ACCEPTED" if accepted else "REJECTED"
    health["source_log"] = latest_source_rows()
    health["cross_check"] = get_cross_check_rows(trade_date)
    if args.health_output:
        output_path = Path(args.health_output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(health, indent=2, default=str), encoding="utf-8")
    print(json.dumps(health, indent=2, default=str))
    return 0 if accepted else 2


if __name__ == "__main__":
    raise SystemExit(main())
