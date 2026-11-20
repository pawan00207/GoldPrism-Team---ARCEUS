"""Immutable raw Parquet storage and validated DuckDB persistence."""

from __future__ import annotations

import logging
import os
import tempfile
from datetime import date, datetime
from pathlib import Path
from typing import Any

import duckdb
import pandas as pd

logger = logging.getLogger(__name__)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"

_BHAVCOPY_COLUMNS = (
    "trade_date",
    "symbol",
    "expiry_date",
    "contract_key",
    "open_price",
    "high_price",
    "low_price",
    "close_price",
    "settle_price",
    "volume",
    "open_interest",
    "price_per_gram_fine_gold",
    "settle_trusted",
    "signal_eligible",
    "is_outlier",
)

_HEALTH_COLUMNS = (
    "requested_date",
    "raw_rows",
    "validated_rows",
    "rejected_rows",
    "missing_values_count",
    "missing_values_total",
    "missing_values_pct",
    "outlier_count",
    "missing_trading_days",
    "date_mismatches_rejected",
    "untrusted_rows",
)


def _as_date(value: date | datetime | str) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    for fmt in ("%Y-%m-%d", "%Y%m%d"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Date must be YYYY-MM-DD or YYYYMMDD, got {value!r}")


def save_raw_parquet(
    frame: pd.DataFrame,
    trade_date: date | datetime | str,
    *,
    data_dir: Path | str = DATA_DIR,
) -> Path:
    """Write source rows once; an existing raw date partition is never replaced."""
    day = _as_date(trade_date)
    target_dir = Path(data_dir) / "raw"
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"{day:%Y%m%d}.parquet"
    if target.exists():
        logger.warning("Raw Parquet is immutable; leaving existing file unchanged: %s", target)
        return target

    fd, temporary_name = tempfile.mkstemp(prefix=f".{day:%Y%m%d}-", suffix=".parquet", dir=target_dir)
    os.close(fd)
    temporary = Path(temporary_name)
    try:
        frame.to_parquet(temporary, index=False)
        try:
            # Hard-link creation fails rather than replacing a concurrently-created raw file.
            os.link(temporary, target)
        except FileExistsError:
            logger.warning("Raw Parquet was concurrently created; preserving existing file: %s", target)
    finally:
        temporary.unlink(missing_ok=True)
    return target


def save_validated_parquet(
    frame: pd.DataFrame,
    trade_date: date | datetime | str,
    *,
    data_dir: Path | str = DATA_DIR,
) -> Path:
    """Persist the validated, normalized daily partition."""
    day = _as_date(trade_date)
    target_dir = Path(data_dir) / "validated"
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"{day:%Y%m%d}.parquet"
    frame.to_parquet(target, index=False)
    return target


def load_into_duckdb(
    frame: pd.DataFrame,
    *,
    database_path: Path | str = DATA_DIR / "goldprism.duckdb",
) -> None:
    """Upsert one validated day into DuckDB with a date/symbol/expiry key."""
    if frame.empty:
        raise ValueError("Cannot load an empty validated Bhavcopy into DuckDB")
    absent = [column for column in _BHAVCOPY_COLUMNS if column not in frame]
    if absent:
        raise ValueError(f"Validated frame is missing DuckDB columns: {absent}")

    db_path = Path(database_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    rows = frame.loc[:, _BHAVCOPY_COLUMNS].copy()
    for column in ("trade_date", "expiry_date"):
        rows[column] = pd.to_datetime(rows[column], errors="raise").dt.date

    with duckdb.connect(str(db_path)) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS bhavcopy (
                trade_date DATE NOT NULL,
                symbol VARCHAR NOT NULL,
                expiry_date DATE NOT NULL,
                contract_key VARCHAR NOT NULL,
                open_price DOUBLE,
                high_price DOUBLE,
                low_price DOUBLE,
                close_price DOUBLE,
                settle_price DOUBLE,
                volume DOUBLE,
                open_interest DOUBLE,
                price_per_gram_fine_gold DOUBLE,
                settle_trusted BOOLEAN NOT NULL,
                signal_eligible BOOLEAN NOT NULL,
                is_outlier BOOLEAN NOT NULL,
                PRIMARY KEY (trade_date, symbol, expiry_date)
            )
            """
        )
        connection.register("validated_rows", rows)
        try:
            connection.execute("BEGIN TRANSACTION")
            connection.execute("DELETE FROM bhavcopy WHERE trade_date = ?", [rows.iloc[0]["trade_date"]])
            connection.execute(
                "INSERT INTO bhavcopy SELECT * FROM validated_rows"
            )
            connection.execute("COMMIT")
        except Exception:
            connection.execute("ROLLBACK")
            raise
        finally:
            connection.unregister("validated_rows")


def save_data_health(
    health: dict[str, Any],
    *,
    database_path: Path | str = DATA_DIR / "goldprism.duckdb",
) -> None:
    """Store the latest per-date integrity summary in DuckDB."""
    absent = [column for column in _HEALTH_COLUMNS if column not in health]
    if absent:
        raise ValueError(f"data_health is missing fields: {absent}")

    db_path = Path(database_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    values = [health[column] for column in _HEALTH_COLUMNS]
    with duckdb.connect(str(db_path)) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS data_health (
                requested_date DATE PRIMARY KEY,
                raw_rows BIGINT NOT NULL,
                validated_rows BIGINT NOT NULL,
                rejected_rows BIGINT NOT NULL,
                missing_values_count BIGINT NOT NULL,
                missing_values_total BIGINT NOT NULL,
                missing_values_pct DOUBLE NOT NULL,
                outlier_count BIGINT NOT NULL,
                missing_trading_days BIGINT NOT NULL,
                date_mismatches_rejected BIGINT NOT NULL,
                untrusted_rows BIGINT NOT NULL
            )
            """
        )
        connection.execute(
            """
            INSERT INTO data_health VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (requested_date) DO UPDATE SET
                raw_rows = excluded.raw_rows,
                validated_rows = excluded.validated_rows,
                rejected_rows = excluded.rejected_rows,
                missing_values_count = excluded.missing_values_count,
                missing_values_total = excluded.missing_values_total,
                missing_values_pct = excluded.missing_values_pct,
                outlier_count = excluded.outlier_count,
                missing_trading_days = excluded.missing_trading_days,
                date_mismatches_rejected = excluded.date_mismatches_rejected,
                untrusted_rows = excluded.untrusted_rows
            """,
            values,
        )


def get_data_health(
    *,
    database_path: Path | str = DATA_DIR / "goldprism.duckdb",
) -> dict[str, Any]:
    """Return a dashboard-friendly aggregate of all persisted daily health rows."""
    db_path = Path(database_path)
    if not db_path.exists():
        return {
            "days_processed": 0,
            "raw_rows": 0,
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
    with duckdb.connect(str(db_path), read_only=True) as connection:
        table_exists = connection.execute(
            "SELECT count(*) FROM information_schema.tables WHERE table_name = 'data_health'"
        ).fetchone()[0]
        if not table_exists:
            return get_data_health_empty()
        row = connection.execute(
            """
            SELECT
                count(*) AS days_processed,
                coalesce(sum(raw_rows), 0),
                coalesce(sum(validated_rows), 0),
                coalesce(sum(rejected_rows), 0),
                coalesce(sum(missing_values_count), 0),
                coalesce(sum(missing_values_total), 0),
                coalesce(sum(outlier_count), 0),
                coalesce(sum(missing_trading_days), 0),
                coalesce(sum(date_mismatches_rejected), 0),
                coalesce(sum(untrusted_rows), 0)
            FROM data_health
            """
        ).fetchone()
    missing_pct = round(100.0 * row[4] / row[5], 4) if row[5] else 0.0
    return dict(
        zip(
            (
                "days_processed",
                "raw_rows",
                "validated_rows",
                "rejected_rows",
                "missing_values_count",
                "missing_values_total",
                "outlier_count",
                "missing_trading_days",
                "date_mismatches_rejected",
                "untrusted_rows",
            ),
            row[:6] + (missing_pct,) + row[6:],
        )
    )


def get_data_health_empty() -> dict[str, Any]:
    """Return an empty health shape when a database has no health table yet."""
    return {
        "days_processed": 0,
        "raw_rows": 0,
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
