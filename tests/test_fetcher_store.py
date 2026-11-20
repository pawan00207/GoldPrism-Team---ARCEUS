from __future__ import annotations

from datetime import date

import duckdb
import mcxlib
import pandas as pd

from src.fetcher import fetch_bhavcopy
from src.store import (
    get_data_health,
    load_into_duckdb,
    save_data_health,
    save_raw_parquet,
)
from src.validators import validate_bhavcopy


def _raw_frame() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "Symbol": "GOLDM",
                "Date": "2026-11-20",
                "ExpiryDate": "2026-12-05",
                "SettlePrice": 75000.0,
                "Volume": 10,
                "OpenInterest": 100,
            }
        ]
    )


def test_fetch_retries_three_times_before_succeeding(monkeypatch, tmp_path) -> None:
    attempts = 0

    def flaky_fetch(trade_date: str) -> pd.DataFrame:
        nonlocal attempts
        attempts += 1
        if attempts < 4:
            raise RuntimeError("temporary network failure")
        return _raw_frame()

    monkeypatch.setattr(mcxlib, "get_bhav_copy", flaky_fetch)
    frame = fetch_bhavcopy(date(2026, 11, 20), data_dir=tmp_path, backoff_seconds=0)

    assert attempts == 4
    assert frame.iloc[0]["Symbol"] == "GOLDM"


def test_fetch_uses_cached_parquet_after_retries(monkeypatch, tmp_path) -> None:
    raw_dir = tmp_path / "raw"
    raw_dir.mkdir()
    _raw_frame().to_parquet(raw_dir / "20261120.parquet", index=False)
    monkeypatch.setattr(
        mcxlib,
        "get_bhav_copy",
        lambda trade_date: (_ for _ in ()).throw(RuntimeError("offline")),
    )

    frame = fetch_bhavcopy(date(2026, 11, 20), data_dir=tmp_path, backoff_seconds=0)

    assert frame.attrs["source"] == "cache"
    assert frame.iloc[0]["Symbol"] == "GOLDM"


def test_raw_parquet_is_not_overwritten(tmp_path) -> None:
    first = _raw_frame()
    target = save_raw_parquet(first, date(2026, 11, 20), data_dir=tmp_path)
    save_raw_parquet(_raw_frame().assign(SettlePrice=1), date(2026, 11, 20), data_dir=tmp_path)

    assert pd.read_parquet(target).iloc[0]["SettlePrice"] == 75000.0


def test_duckdb_and_health_round_trip(tmp_path) -> None:
    result = validate_bhavcopy(_raw_frame(), date(2026, 11, 20))
    database_path = tmp_path / "goldprism.duckdb"
    load_into_duckdb(result.frame, database_path=database_path)
    save_data_health(result.data_health, database_path=database_path)

    with duckdb.connect(str(database_path), read_only=True) as connection:
        assert connection.execute(
            "SELECT symbol, expiry_date FROM bhavcopy"
        ).fetchone() == ("GOLDM", date(2026, 12, 5))
    assert get_data_health(database_path=database_path)["validated_rows"] == 1
