"""Append-only source call logging and timing utilities."""

from __future__ import annotations

import time
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, TypeVar
from zoneinfo import ZoneInfo

import duckdb

T = TypeVar("T")
IST = ZoneInfo("Asia/Kolkata")
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data"


def ensure_source_log(database_path: Path | str = DATA_DIR / "goldprism.duckdb") -> None:
    db_path = Path(database_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with duckdb.connect(str(db_path)) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS source_log (
                ts_ist TIMESTAMPTZ NOT NULL,
                source_name VARCHAR NOT NULL,
                method VARCHAR NOT NULL,
                url VARCHAR NOT NULL,
                status VARCHAR NOT NULL,
                latency_ms BIGINT NOT NULL,
                rows_returned BIGINT NOT NULL DEFAULT 0,
                note VARCHAR
            )
            """
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_source_log_source_ts ON source_log(source_name, ts_ist)"
        )


def log_source_row(
    *,
    source_name: str,
    method: str,
    url: str,
    status: str,
    latency_ms: int,
    rows_returned: int = 0,
    note: str | None = None,
    database_path: Path | str = DATA_DIR / "goldprism.duckdb",
) -> None:
    """Append one source-log row; never include credentials or page bodies."""
    if status not in {"ok", "failed", "timeout", "empty"}:
        raise ValueError("status must be ok, failed, timeout, or empty")
    if method not in {
        "mcxlib",
        "tinyfish_fetch",
        "tinyfish_agent",
        "tinyfish_search",
    }:
        raise ValueError("unsupported source method")
    ensure_source_log(database_path)
    safe_note = (note or "")[:500].replace("\n", " ").replace("\r", " ")
    with duckdb.connect(str(database_path)) as connection:
        connection.execute(
            """
            INSERT INTO source_log
                (ts_ist, source_name, method, url, status, latency_ms, rows_returned, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                datetime.now(IST),
                source_name,
                method,
                url[:2048],
                status,
                max(0, latency_ms),
                max(0, rows_returned),
                safe_note or None,
            ],
        )


def logged(
    source_name: str,
    method: str,
    url: str,
    operation: Callable[[], T],
    *,
    rows_from_result: Callable[[T], int] | None = None,
    database_path: Path | str = DATA_DIR / "goldprism.duckdb",
) -> T:
    """Time and log every call, including success, empty, timeout, and failure."""
    started = time.perf_counter()
    try:
        result = operation()
        rows = rows_from_result(result) if rows_from_result else 0
        status = "empty" if rows_from_result is not None and rows == 0 else "ok"
        try:
            log_source_row(
                source_name=source_name,
                method=method,
                url=url,
                status=status,
                latency_ms=int((time.perf_counter() - started) * 1000),
                rows_returned=rows,
                database_path=database_path,
            )
        except Exception:
            # Source logging must never break the primary data or dashboard path.
            pass
        return result
    except TimeoutError as exc:
        _log_failed(
            source_name, method, url, "timeout", started, exc, database_path
        )
        raise
    except Exception as exc:
        _log_failed(
            source_name, method, url, "failed", started, exc, database_path
        )
        raise


def _log_failed(
    source_name: str,
    method: str,
    url: str,
    status: str,
    started: float,
    exc: Exception,
    database_path: Path | str,
) -> None:
    note = type(exc).__name__
    try:
        log_source_row(
            source_name=source_name,
            method=method,
            url=url,
            status=status,
            latency_ms=int((time.perf_counter() - started) * 1000),
            rows_returned=0,
            note=note,
            database_path=database_path,
        )
    except Exception:
        pass


def latest_source_rows(database_path: Path | str = DATA_DIR / "goldprism.duckdb") -> list[dict[str, Any]]:
    """Return the latest source_log row per source_name and method."""
    db_path = Path(database_path)
    if not db_path.exists():
        return []
    ensure_source_log(db_path)
    with duckdb.connect(str(db_path), read_only=True) as connection:
        rows = connection.execute(
            """
            SELECT ts_ist, source_name, method, url, status, latency_ms,
                   rows_returned, note
            FROM (
                SELECT *, row_number() OVER (
                    PARTITION BY source_name, method
                    ORDER BY ts_ist DESC
                ) AS row_rank
                FROM source_log
            )
            WHERE row_rank = 1
            ORDER BY ts_ist DESC
            """
        ).fetchall()
    return [
        {
            "ts_ist": row[0].isoformat() if hasattr(row[0], "isoformat") else str(row[0]),
            "source_name": row[1],
            "method": row[2],
            "url": row[3],
            "status": row[4],
            "latency_ms": int(row[5]),
            "rows_returned": int(row[6]),
            "note": row[7],
        }
        for row in rows
    ]


def freshness_badge(age_minutes: float) -> str:
    """Classify source freshness using the dashboard boundaries."""
    if age_minutes < 5:
        return "Live < 5 min"
    if age_minutes < 60:
        return "Delayed"
    return "Stale"
