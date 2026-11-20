"""Live-only settlement cross-check; a veto-only trust overlay."""

from __future__ import annotations

import json
import os
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any

import pandas as pd

from src.integrations.source_logging import logged
from src.integrations.tinyfish_client import TinyFishClient, TinyFishError

PROJECT_ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = PROJECT_ROOT / "src" / "cross_check_config.json"
DATA_DIR = PROJECT_ROOT / "data"


def load_cross_check_config() -> dict[str, Any]:
    with CONFIG_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def parse_source_b_rows(payload: dict[str, Any]) -> tuple[date | None, list[dict[str, Any]]]:
    """Parse Fetch/Agent text or structured rows without fabricating values."""
    as_of: date | None = None
    rows: list[dict[str, Any]] = []

    if isinstance(payload.get("as_of_date"), str):
        as_of = _parse_date(payload["as_of_date"])
    if isinstance(payload.get("rows"), list):
        for item in payload["rows"]:
            if isinstance(item, dict):
                rows.append(item)

    if isinstance(payload.get("results"), list):
        for result in payload["results"]:
            if not isinstance(result, dict) or not isinstance(result.get("text"), str):
                continue
            text = result["text"]
            date_match = re.search(r"(20\d{2}-\d{2}-\d{2}|20\d{6})", text)
            if date_match:
                as_of = as_of or _parse_date(date_match.group(1))
            for line in text.splitlines():
                if "|" not in line:
                    continue
                cells = [cell.strip() for cell in line.strip("|").split("|")]
                if len(cells) < 3:
                    continue
                symbol = cells[0].upper()
                if symbol not in {"GOLDM", "GOLDTEN", "GOLDGUINEA", "GOLDPETAL"}:
                    continue
                expiry = _parse_date(cells[1])
                settle = _parse_price(cells[2])
                if expiry and settle is not None:
                    rows.append({"symbol": symbol, "expiry": expiry.isoformat(), "settle": settle})
    return as_of, rows


def fetch_source_b_settlements(
    requested_date: date,
    *,
    client: TinyFishClient | None = None,
    database_path: Path | str = DATA_DIR / "goldprism.duckdb",
) -> tuple[str, dict[str, Any] | None]:
    """Fetch source B through TinyFish Fetch, then Agent only if layout fails."""
    config = load_cross_check_config()
    url = os.environ.get("SOURCE_B_URL", "").strip() or str(config.get("source_b_url", "")).strip()
    if not bool(config.get("cross_check_enabled", False)):
        return "UNVERIFIED", None
    if not url:
        return "UNVERIFIED", None

    tinyfish = client or TinyFishClient()
    if not tinyfish.configured:
        return "UNVERIFIED", None

    schema: dict[str, Any] = {
        "type": "object",
        "properties": {
            "as_of_date": {"type": "string", "format": "date"},
            "rows": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "symbol": {"type": "string"},
                        "expiry": {"type": "string", "format": "date"},
                        "settle": {"type": "number"},
                    },
                    "required": ["symbol", "expiry", "settle"],
                },
            },
        },
        "required": ["as_of_date", "rows"],
    }

    try:
        payload = logged(
            "Settlement source B",
            "tinyfish_fetch",
            url,
            lambda: tinyfish.fetch(
                [url],
                purpose=f"Read settlement prices for {requested_date.isoformat()}.",
            ),
            rows_from_result=lambda value: sum(
                1 for item in value.get("results", []) if isinstance(item, dict)
            ),
            database_path=database_path,
        )
        as_of, rows = parse_source_b_rows(payload)
        if not rows:
            payload = logged(
                "Settlement source B",
                "tinyfish_agent",
                url,
                lambda: tinyfish.run_agent(
                    url,
                    (
                        f"Extract the actual settlement table for {requested_date.isoformat()}. "
                        "Return as_of_date and rows with symbol, expiry, and settle only. "
                        "Do not infer or fabricate values."
                    ),
                    schema,
                ),
                rows_from_result=lambda value: len(value.get("rows", []))
                if isinstance(value.get("rows"), list)
                else 0,
                database_path=database_path,
            )
            as_of, rows = parse_source_b_rows(payload)
    except (TinyFishError, TimeoutError, ValueError):
        return "UNVERIFIED", None

    if as_of != requested_date:
        try:
            logged(
                "Settlement source B",
                "tinyfish_fetch",
                url,
                lambda: (_ for _ in ()).throw(
                    ValueError(
                        f"source B as_of_date mismatch: requested {requested_date.isoformat()}, "
                        f"returned {as_of.isoformat() if as_of else 'missing'}"
                    )
                ),
                database_path=database_path,
            )
        except ValueError:
            pass
        return "UNVERIFIED", None
    return "AVAILABLE", {"as_of_date": as_of.isoformat(), "rows": rows}


def apply_settlement_cross_check(
    validated_frame: pd.DataFrame,
    source_b_payload: dict[str, Any] | None,
    requested_date: date,
    *,
    checked_at_ist: datetime | None = None,
    source_b_url: str = "",
    database_path: Path | str = DATA_DIR / "goldprism.duckdb",
) -> pd.DataFrame:
    """Veto mismatches or preserve primary trust for MATCH/UNVERIFIED."""
    frame = validated_frame.copy()
    config = load_cross_check_config()
    tol_bps = float(config["tol_bps"])
    frame["cross_check_state"] = "UNVERIFIED"
    frame["cross_check_diff_bps"] = pd.Series(index=frame.index, dtype="float64")
    frame["settle_source_b"] = pd.Series(index=frame.index, dtype="float64")
    if checked_at_ist is None:
        checked_at_ist = datetime.now()

    source_rows: dict[tuple[str, date], float] = {}
    if source_b_payload:
        for row in source_b_payload.get("rows", []):
            if not isinstance(row, dict):
                continue
            symbol = str(row.get("symbol", "")).strip().upper()
            expiry = _parse_date(row.get("expiry"))
            settle = _parse_price(row.get("settle"))
            if symbol and expiry and settle is not None:
                source_rows[(symbol, expiry)] = settle

    for index, row in frame.iterrows():
        key = (str(row["symbol"]).upper(), row["expiry_date"])
        source_b_settle = source_rows.get(key)
        if source_b_settle is None:
            continue
        settle_a = float(row["settle_price"])
        diff_bps = abs(source_b_settle - settle_a) / settle_a * 10_000 if settle_a else 0.0
        state = "MATCH" if diff_bps <= tol_bps else "MISMATCH"
        frame.at[index, "cross_check_diff_bps"] = diff_bps
        frame.at[index, "settle_source_b"] = source_b_settle
        frame.at[index, "cross_check_state"] = state
        if state == "MISMATCH":
            frame.at[index, "settle_trusted"] = False
            frame.at[index, "signal_eligible"] = False

    save_cross_check_rows(
        frame,
        requested_date,
        checked_at_ist,
        source_b_url,
        database_path,
    )
    return frame


def save_cross_check_rows(
    frame: pd.DataFrame,
    requested_date: date,
    checked_at_ist: datetime,
    source_b_url: str,
    database_path: Path | str,
) -> None:
    db_path = Path(database_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with __import__("duckdb").connect(str(db_path)) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS cross_check (
                date DATE NOT NULL,
                symbol VARCHAR NOT NULL,
                expiry DATE NOT NULL,
                settle_a DOUBLE,
                settle_b DOUBLE,
                diff_bps DOUBLE,
                state VARCHAR NOT NULL,
                source_b_url VARCHAR,
                checked_at_ist TIMESTAMPTZ NOT NULL,
                PRIMARY KEY (date, symbol, expiry)
            )
            """,
        )
        connection.execute(
            "DELETE FROM cross_check WHERE date = ?",
            [requested_date],
        )
        for _, row in frame.iterrows():
            connection.execute(
                """
                INSERT INTO cross_check
                    (date, symbol, expiry, settle_a, settle_b, diff_bps, state,
                     source_b_url, checked_at_ist)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    requested_date,
                    str(row["symbol"]),
                    row["expiry_date"],
                    float(row["settle_price"]),
                    None if pd.isna(row["settle_source_b"]) else float(row["settle_source_b"]),
                    None if pd.isna(row["cross_check_diff_bps"]) else float(row["cross_check_diff_bps"]),
                    str(row["cross_check_state"]),
                    source_b_url or None,
                    checked_at_ist,
                ],
            )


def get_cross_check_rows(
    trade_date: date,
    *,
    database_path: Path | str = DATA_DIR / "goldprism.duckdb",
) -> list[dict[str, Any]]:
    db_path = Path(database_path)
    if not db_path.exists():
        return []
    with __import__("duckdb").connect(str(db_path), read_only=True) as connection:
        table_exists = connection.execute(
            "SELECT count(*) FROM information_schema.tables WHERE table_name = 'cross_check'"
        ).fetchone()[0]
        if not table_exists:
            return []
        rows = connection.execute(
            """
            SELECT date, symbol, expiry, settle_a, settle_b, diff_bps, state,
                   source_b_url, checked_at_ist
            FROM cross_check
            WHERE date = ?
            ORDER BY symbol, expiry
            """,
            [trade_date],
        ).fetchall()
    return [
        {
            "trade_date": row[0].isoformat(),
            "symbol": row[1],
            "expiry": row[2].isoformat(),
            "settle_a": row[3],
            "settle_b": row[4],
            "diff_bps": row[5],
            "state": row[6],
            "source_b_url": row[7],
            "checked_at_ist": row[8].isoformat(),
        }
        for row in rows
    ]


def _parse_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%Y%m%d", "%d%b%Y", "%d-%b-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def _parse_price(value: Any) -> float | None:
    if value is None:
        return None
    try:
        parsed = float(str(value).replace(",", "").replace("₹", "").strip())
    except (TypeError, ValueError):
        return None
    return parsed if parsed >= 0 else None
