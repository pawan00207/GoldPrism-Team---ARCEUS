"""Fetch daily MCX Bhavcopy data through mcxlib with a cached-file fallback."""

from __future__ import annotations

import logging
import re
import time
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any
from typing import TypeAlias

import pandas as pd

from src.integrations.tinyfish_client import TinyFishClient, TinyFishError
from src.integrations.source_logging import logged
from src.validators import COLUMN_ALIASES

logger = logging.getLogger(__name__)

DateLike: TypeAlias = date | datetime | str
PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = PROJECT_ROOT / "data" / "raw"
MCX_BHAVCOPY_PAGE = "https://www.mcxindia.com/market-data/bhavcopy"


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
    """Fetch from mcxlib, then TinyFish, and finally the immutable raw cache.

    The returned frame is deliberately not validated here: callers persist the
    untouched source frame before passing it to the integrity gates.
    """
    requested_date = _as_date(trade_date)
    if retries < 1:
        raise ValueError("retries must be at least 1")
    if backoff_seconds < 0:
        raise ValueError("backoff_seconds cannot be negative")

    last_error: Exception | None = None
    attempts = retries + 1
    try:
        from mcxlib import get_bhav_copy
    except ImportError as exc:
        get_bhav_copy = None
        last_error = exc
        logger.warning("mcxlib is unavailable; trying configured TinyFish fallback.")

    if get_bhav_copy is not None:
        for attempt in range(1, attempts + 1):
            try:
                frame = logged(
                    "MCX Bhavcopy",
                    "mcxlib",
                    "https://www.mcxindia.com/market-data/bhavcopy",
                    lambda: get_bhav_copy(requested_date.strftime("%Y%m%d")),
                    rows_from_result=lambda value: 0 if value.empty else len(value),
                    database_path=Path(data_dir) / "goldprism.duckdb",
                )
                if not isinstance(frame, pd.DataFrame):
                    raise TypeError(f"mcxlib returned {type(frame).__name__}, expected pandas.DataFrame")
                logger.info("mcxlib df.columns: %s", frame.columns.tolist())
                if frame.empty:
                    raise ValueError(f"mcxlib returned no rows for {requested_date}")
                return _stamp_source(frame, "mcxlib")
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

    client = TinyFishClient()
    if client.configured:
        try:
            frame = _fetch_tinyfish_bhavcopy(client, requested_date)
            if not frame.empty:
                logger.warning("Using TinyFish Bhavcopy fallback for %s.", requested_date)
                return _stamp_source(frame, "tinyfish")
        except (TinyFishError, TypeError, ValueError, pd.errors.ParserError) as exc:
            logger.warning(
                "TinyFish Bhavcopy fallback failed for %s: %s",
                requested_date,
                exc,
            )
            last_error = exc
    else:
        logger.info("TinyFish fallback is not configured; checking the raw Parquet cache.")

    raw_dir = Path(data_dir) / "raw"
    cached_path = raw_dir / f"{requested_date:%Y%m%d}.parquet"
    if cached_path.is_file():
        logger.warning("Using cached Bhavcopy after %d retries: %s", retries, cached_path)
        cached_frame = pd.read_parquet(cached_path)
        if "source" not in cached_frame:
            cached_frame["source"] = "cache"
        if "fetched_at" not in cached_frame:
            cached_frame["fetched_at"] = datetime.fromtimestamp(
                cached_path.stat().st_mtime,
                tz=timezone.utc,
            ).isoformat()
        cached_frame.attrs["source"] = "cache"
        return cached_frame

    raise FetchError(
        f"MCX and TinyFish fetches failed for {requested_date} after {retries} mcxlib retries; "
        f"no cached Parquet exists at {cached_path}. Last error: {last_error}"
    ) from last_error


def _stamp_source(frame: pd.DataFrame, source: str) -> pd.DataFrame:
    """Add source provenance to a copy without changing the source's logged schema."""
    stamped = frame.copy()
    if "source" not in stamped:
        stamped["source"] = source
    if "fetched_at" not in stamped:
        stamped["fetched_at"] = datetime.now(timezone.utc).isoformat()
    stamped.attrs["source"] = source
    return stamped


def _fetch_tinyfish_bhavcopy(client: TinyFishClient, requested_date: date) -> pd.DataFrame:
    """Fetch MCX's public Bhavcopy page, using an agent only when static extraction is insufficient."""
    response = logged(
        "TinyFish Bhavcopy fallback",
        "tinyfish_fetch",
        MCX_BHAVCOPY_PAGE,
        lambda: client.fetch(
            [MCX_BHAVCOPY_PAGE],
            purpose=f"Obtain the official MCX gold-family Bhavcopy for {requested_date.isoformat()}.",
        ),
        rows_from_result=lambda value: sum(
            1
            for item in value.get("results", [])
            if isinstance(item, dict) and isinstance(item.get("text"), str)
        ),
    )
    results = response.get("results")
    if isinstance(results, list):
        for result in results:
            if isinstance(result, dict) and isinstance(result.get("text"), str):
                frame = _parse_markdown_table(result["text"])
                if not frame.empty and _has_required_columns(frame.columns):
                    return frame

    logger.info("TinyFish Fetch did not expose a parseable Bhavcopy table; trying Agent interaction.")
    schema: dict[str, Any] = {
        "type": "object",
        "properties": {
            "rows": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "symbol": {"type": "string"},
                        "trade_date": {"type": "string", "format": "date"},
                        "expiry_date": {"type": "string", "format": "date"},
                        "settle_price": {"type": "number"},
                        "volume": {"type": "number"},
                        "open_interest": {"type": "number"},
                    },
                    "required": [
                        "symbol",
                        "trade_date",
                        "expiry_date",
                        "settle_price",
                        "volume",
                        "open_interest",
                    ],
                },
            },
        },
        "required": ["rows"],
    }
    extracted = logged(
        "TinyFish Bhavcopy fallback",
        "tinyfish_agent",
        MCX_BHAVCOPY_PAGE,
        lambda: client.run_agent(
            MCX_BHAVCOPY_PAGE,
            (
                f"On the official MCX website, use the Bhavcopy date selector or download flow to retrieve "
                f"the actual Bhavcopy for {requested_date.isoformat()}. Do not infer or fabricate values. "
                "Return every GOLDM, GOLDTEN, GOLDGUINEA, and GOLDPETAL row exactly as shown, with the "
                "actual trading date, expiry date, settlement price, volume, and open interest. "
                "Return an empty rows array if that date's official data is not available."
            ),
            schema,
        ),
        rows_from_result=lambda value: len(value.get("rows", []))
        if isinstance(value.get("rows"), list)
        else 0,
    )
    rows = extracted.get("rows")
    if not isinstance(rows, list) or not rows:
        raise TinyFishError("TinyFish Agent found no Bhavcopy rows.")
    return pd.DataFrame(rows)


def _parse_markdown_table(text: str) -> pd.DataFrame:
    """Parse the first pipe-delimited Markdown table from TinyFetch output."""
    lines = text.splitlines()
    for index in range(len(lines) - 1):
        if "|" not in lines[index] or not re.search(r"\|?\s*:?-{3,}", lines[index + 1]):
            continue
        header = _split_table_row(lines[index])
        rows: list[list[str]] = []
        for line in lines[index + 2 :]:
            if "|" not in line:
                break
            row = _split_table_row(line)
            if len(row) == len(header):
                rows.append(row)
        if rows:
            return pd.DataFrame(rows, columns=header)
    return pd.DataFrame()


def _split_table_row(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def _has_required_columns(columns: pd.Index[Any]) -> bool:
    tokens = {re.sub(r"[^a-z0-9]", "", str(column).strip().lower()) for column in columns}
    for required in ("symbol", "trade_date", "expiry_date", "settle_price"):
        aliases = COLUMN_ALIASES[required]
        if not any(alias in tokens for alias in aliases):
            return False
    return True
