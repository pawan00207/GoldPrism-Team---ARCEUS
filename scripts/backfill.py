"""Backfill weekday MCX Bhavcopies; unavailable dates are skipped and logged."""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.fetcher import FetchError
from src.store import save_data_health
from src.validators import aggregate_data_health
from scripts.fetch_today import ingest_date

logger = logging.getLogger(__name__)


def _parse_date(value: str) -> date:
    for fmt in ("%Y-%m-%d", "%Y%m%d"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    raise argparse.ArgumentTypeError(f"Invalid date {value!r}; use YYYY-MM-DD or YYYYMMDD")


def _empty_health(trade_date: date, *, missing_trading_days: int) -> dict[str, object]:
    return {
        "requested_date": trade_date.isoformat(),
        "raw_rows": 0,
        "validated_rows": 0,
        "rejected_rows": 0,
        "missing_values_count": 0,
        "missing_values_total": 0,
        "missing_values_pct": 0.0,
        "outlier_count": 0,
        "missing_trading_days": missing_trading_days,
        "date_mismatches_rejected": 0,
        "untrusted_rows": 0,
    }


def backfill(
    start_date: date,
    end_date: date,
) -> dict[str, object]:
    """Ingest weekdays in a closed date range; MCX no-data dates are skipped."""
    if end_date < start_date:
        raise ValueError("end date must be on or after start date")

    summaries: list[dict[str, object]] = []
    current = start_date
    while current <= end_date:
        if current.weekday() < 5:
            try:
                _, health = ingest_date(current)
                summaries.append(health)
            except FetchError as exc:
                logger.warning(
                    "Skipping %s (holiday or unavailable source; no cached data): %s",
                    current,
                    exc,
                )
                health = _empty_health(current, missing_trading_days=1)
                save_data_health(health)
                summaries.append(health)
        current += timedelta(days=1)

    return aggregate_data_health(summaries)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", required=True, type=_parse_date, help="Inclusive start date")
    parser.add_argument("--end", required=True, type=_parse_date, help="Inclusive end date")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    try:
        health = backfill(args.start, args.end)
    except ValueError as exc:
        parser.error(str(exc))
    print(json.dumps(health, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
