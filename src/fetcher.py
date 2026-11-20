"""Fetch daily MCX Bhavcopy data through mcxlib with a cached-file fallback."""

from __future__ import annotations

import logging
import time
from datetime import date, datetime
from pathlib import Path
from typing import TypeAlias

import pandas as pd

logger = logging.getLogger(__name__)

DateLike: TypeAlias = date | datetime | str
PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = PROJECT_ROOT / "data" / "raw"


class FetchError(RuntimeError):
    """Raised when MCX retrieval fails and no cached Bhavcopy is available."""


def _as_date(value: DateLike) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        try:
            return datetime.strptime(value, "%Y%m%d").date()
        except ValueError as exc:
            raise ValueError(f"Date must be YYYY-MM-DD or YYYYMMDD, got {value!r}") from exc


def fetch_bhavcopy(
    trade_date: DateLike,
    *,
    data_dir: Path | str = PROJECT_ROOT / "data",
    retries: int = 3,
    backoff_seconds: float = 1.0,
) -> pd.DataFrame:
    """Fetch one date's frame from mcxlib, retrying before using the raw cache.

    The returned frame is deliberately not validated here: callers persist the
    untouched source frame before passing it to the integrity gates.
    """
    requested_date = _as_date(trade_date)
    if retries < 1:
        raise ValueError("retries must be at least 1")
    if backoff_seconds < 0:
        raise ValueError("backoff_seconds cannot be negative")

    try:
        from mcxlib import get_bhav_copy
    except ImportError as exc:
        raise FetchError("mcxlib is required; install dependencies with pip install -r requirements.txt") from exc

    last_error: Exception | None = None
    attempts = retries + 1
    for attempt in range(1, attempts + 1):
        try:
            frame = get_bhav_copy(requested_date.strftime("%Y%m%d"))
            if not isinstance(frame, pd.DataFrame):
                raise TypeError(f"mcxlib returned {type(frame).__name__}, expected pandas.DataFrame")
            logger.info("mcxlib df.columns: %s", frame.columns.tolist())
            if frame.empty:
                raise ValueError(f"mcxlib returned no rows for {requested_date}")
            return frame
        except Exception as exc:
            last_error = exc
            logger.warning(
                "mcxlib fetch failed for %s (attempt %d/%d): %s",
                requested_date,
                attempt,
                attempts,
                exc,
            )
            if attempt < attempts:
                time.sleep(backoff_seconds * (2 ** (attempt - 1)))

    raw_dir = Path(data_dir) / "raw"
    cached_path = raw_dir / f"{requested_date:%Y%m%d}.parquet"
    if cached_path.is_file():
        logger.warning("Using cached Bhavcopy after %d retries: %s", retries, cached_path)
        cached_frame = pd.read_parquet(cached_path)
        cached_frame.attrs["source"] = "cache"
        return cached_frame

    raise FetchError(
        f"MCX fetch failed for {requested_date} after {retries} retries; "
        f"no cached Parquet exists at {cached_path}. Last error: {last_error}"
    ) from last_error
