from __future__ import annotations

from datetime import date

import duckdb
import mcxlib
import pandas as pd
import pytest

from src.fetcher import fetch_bhavcopy
from src.integrations.tinyfish_client import TinyFishError
from src.store import (
    get_data_health,
    load_into_duckdb,
    save_data_health,
    save_raw_parquet,
)
from src.validators import DateMismatchError, validate_bhavcopy
from scripts.fetch_today import ingest_date
from src.cross_check import apply_settlement_cross_check


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
    assert frame.iloc[0]["source"] == "cache"


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
            "SELECT symbol, expiry_date, source FROM bhavcopy"
        ).fetchone() == ("GOLDM", date(2026, 12, 5), "mcxlib")
    assert get_data_health(database_path=database_path)["validated_rows"] == 1


def test_tinyfish_fallback_is_tagged_and_uses_same_date_gate(monkeypatch, tmp_path, caplog) -> None:
    monkeypatch.setattr(
        mcxlib,
        "get_bhav_copy",
        lambda trade_date: (_ for _ in ()).throw(RuntimeError("offline")),
    )

    class _TinyFish:
        configured = True

        def fetch(self, urls, *, purpose=None):
            return {"results": [], "errors": []}

        def run_agent(self, url, goal, output_schema):
            return {
                "rows": [
                    {
                        "symbol": "GOLDM",
                        "trade_date": "2026-11-19",
                        "expiry_date": "2026-12-05",
                        "settle_price": 75000.0,
                        "volume": 10,
                        "open_interest": 100,
                    }
                ]
            }

    monkeypatch.setattr("src.fetcher.TinyFishClient", _TinyFish)
    frame = fetch_bhavcopy(
        date(2026, 11, 20),
        data_dir=tmp_path,
        retries=1,
        backoff_seconds=0,
    )

    assert frame.iloc[0]["source"] == "tinyfish"
    with pytest.raises(DateMismatchError) as raised:
        validate_bhavcopy(frame, date(2026, 11, 20))
    assert raised.value.data_health["source"] == "tinyfish"
    assert raised.value.data_health["date_mismatches_rejected"] == 1
    assert "Rejected Bhavcopy date mismatch" in caplog.text


def test_tinyfish_failure_falls_back_to_cached_parquet(monkeypatch, tmp_path, caplog) -> None:
    raw_dir = tmp_path / "raw"
    raw_dir.mkdir()
    _raw_frame().to_parquet(raw_dir / "20261120.parquet", index=False)
    monkeypatch.setattr(
        mcxlib,
        "get_bhav_copy",
        lambda trade_date: (_ for _ in ()).throw(RuntimeError("offline")),
    )

    class _TinyFish:
        configured = True

        def fetch(self, urls, *, purpose=None):
            raise TinyFishError("TinyFish unavailable.")

    monkeypatch.setattr("src.fetcher.TinyFishClient", _TinyFish)
    frame = fetch_bhavcopy(
        date(2026, 11, 20),
        data_dir=tmp_path,
        backoff_seconds=0,
    )

    assert frame.iloc[0]["source"] == "cache"
    assert "TinyFish Bhavcopy fallback failed" in caplog.text


def test_ingestion_records_schema_rejection_without_attempting_storage(monkeypatch) -> None:
    health_rows = []
    malformed = pd.DataFrame({"unexpected": [1]})
    monkeypatch.setattr("scripts.fetch_today.fetch_bhavcopy", lambda trade_date: malformed)
    monkeypatch.setattr("scripts.fetch_today.save_raw_parquet", lambda *args, **kwargs: None)
    monkeypatch.setattr("scripts.fetch_today.save_data_health", health_rows.append)

    accepted, health = ingest_date(date(2026, 11, 20))

    assert not accepted
    assert health["rejected_rows"] == 1
    assert "schema_error" in health
    assert health_rows == [health]


def test_ingestion_records_all_rows_rejected_without_loading_empty_frame(monkeypatch) -> None:
    health_rows = []
    monkeypatch.setattr(
        "scripts.fetch_today.fetch_bhavcopy",
        lambda trade_date: _raw_frame().assign(SettlePrice=-1),
    )
    monkeypatch.setattr("scripts.fetch_today.save_raw_parquet", lambda *args, **kwargs: None)
    monkeypatch.setattr("scripts.fetch_today.save_data_health", health_rows.append)
    monkeypatch.setattr(
        "scripts.fetch_today.load_into_duckdb",
        lambda *args, **kwargs: pytest.fail("empty validation result must not be loaded"),
    )

    accepted, health = ingest_date(date(2026, 11, 20))

    assert not accepted
    assert health["validated_rows"] == 0
    assert health["rejected_rows"] == 1
    assert health_rows == [health]
