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
    "fetched_at",
    "source",
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
    "fetched_at",
    "source",
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
    rows["fetched_at"] = pd.to_datetime(rows["fetched_at"], errors="coerce", utc=True)

    with duckdb.connect(str(db_path)) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS bhavcopy (
                trade_date DATE NOT NULL,
                fetched_at TIMESTAMPTZ,
                source VARCHAR NOT NULL DEFAULT 'mcxlib',
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
        existing_columns = {
            row[1] for row in connection.execute("PRAGMA table_info('bhavcopy')").fetchall()
        }
        if "fetched_at" not in existing_columns:
            connection.execute("ALTER TABLE bhavcopy ADD COLUMN fetched_at TIMESTAMPTZ")
        if "source" not in existing_columns:
            connection.execute(
                "ALTER TABLE bhavcopy ADD COLUMN source VARCHAR NOT NULL DEFAULT 'mcxlib'"
            )
        connection.register("validated_rows", rows)
        try:
            connection.execute("BEGIN TRANSACTION")
            connection.execute("DELETE FROM bhavcopy WHERE trade_date = ?", [rows.iloc[0]["trade_date"]])
            connection.execute(
                f"INSERT INTO bhavcopy ({', '.join(_BHAVCOPY_COLUMNS)}) "
                f"SELECT {', '.join(_BHAVCOPY_COLUMNS)} FROM validated_rows"
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
                fetched_at TIMESTAMPTZ,
                source VARCHAR NOT NULL DEFAULT 'mcxlib',
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
        existing_columns = {
            row[1] for row in connection.execute("PRAGMA table_info('data_health')").fetchall()
        }
        if "fetched_at" not in existing_columns:
            connection.execute("ALTER TABLE data_health ADD COLUMN fetched_at TIMESTAMPTZ")
        if "source" not in existing_columns:
            connection.execute(
                "ALTER TABLE data_health ADD COLUMN source VARCHAR NOT NULL DEFAULT 'mcxlib'"
            )
        connection.execute(
            """
            INSERT INTO data_health (
                requested_date, fetched_at, source, raw_rows, validated_rows,
                rejected_rows, missing_values_count, missing_values_total,
                missing_values_pct, outlier_count, missing_trading_days,
                date_mismatches_rejected, untrusted_rows
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (requested_date) DO UPDATE SET
                fetched_at = excluded.fetched_at,
                source = excluded.source,
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
            [
                values[0],
                pd.to_datetime(values[1], errors="coerce", utc=True),
                values[2],
                *values[3:],
            ],
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
            "source_counts": {},
            "last_successful_fetch_at": None,
        }
    with duckdb.connect(str(db_path), read_only=True) as connection:
        table_exists = connection.execute(
            "SELECT count(*) FROM information_schema.tables WHERE table_name = 'data_health'"
        ).fetchone()[0]
        if not table_exists:
            return get_data_health_empty()
        table_columns = {
            row[1] for row in connection.execute("PRAGMA table_info('data_health')").fetchall()
        }
        fetched_at_expression = (
            "max(fetched_at) FILTER (WHERE validated_rows > 0)"
            if "fetched_at" in table_columns
            else "NULL"
        )
        source_expression = "source" if "source" in table_columns else "'mcxlib'"
        row = connection.execute(
            f"""
            SELECT
                {fetched_at_expression},
                count(*) AS days_processed,
                string_agg(DISTINCT {source_expression}, ','),
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
        if "source" in table_columns:
            source_counts = dict(
                connection.execute(
                    "SELECT source, count(*) FROM data_health GROUP BY source"
                ).fetchall()
            )
        else:
            source_counts = {"mcxlib": row[1]} if row[1] else {}
    missing_pct = round(100.0 * row[6] / row[7], 4) if row[7] else 0.0
    return {
        "last_successful_fetch_at": row[0],
        "days_processed": row[1],
        "sources": row[2],
        "source_counts": source_counts,
        "raw_rows": row[3],
        "validated_rows": row[4],
        "rejected_rows": row[5],
        "missing_values_count": row[6],
        "missing_values_total": row[7],
        "missing_values_pct": missing_pct,
        "outlier_count": row[8],
        "missing_trading_days": row[9],
        "date_mismatches_rejected": row[10],
        "untrusted_rows": row[11],
    }


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
        "source_counts": {},
        "last_successful_fetch_at": None,
    }
