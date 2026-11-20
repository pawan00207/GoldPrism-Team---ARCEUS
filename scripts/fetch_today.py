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
from src.validators import DateMismatchError, ValidationResult, validate_bhavcopy

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

    save_validated_parquet(result.frame, trade_date)
    load_into_duckdb(result.frame)
    save_data_health(result.data_health)
    logger.info("Stored validated Bhavcopy; data_health=%s", result.data_health)
    return True, result.data_health


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date", help="Override the Asia/Kolkata date (YYYY-MM-DD or YYYYMMDD)")
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
    print(json.dumps(health, indent=2, default=str))
    return 0 if accepted else 2


if __name__ == "__main__":
    raise SystemExit(main())
