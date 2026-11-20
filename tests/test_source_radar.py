from __future__ import annotations

from datetime import datetime, timedelta, timezone

import duckdb
import pytest

from src.integrations.source_logging import (
    freshness_badge,
    latest_source_rows,
    log_source_row,
    logged,
)


def test_logged_writes_success_row(tmp_path) -> None:
    database = tmp_path / "goldprism.duckdb"
    value = logged(
        "MCX Bhavcopy",
        "mcxlib",
        "https://www.mcxindia.com/market-data/bhavcopy",
        lambda: [1, 2],
        rows_from_result=len,
        database_path=database,
    )
    assert value == [1, 2]
    rows = latest_source_rows(database)
    assert len(rows) == 1
    assert rows[0]["status"] == "ok"
    assert rows[0]["rows_returned"] == 2


def test_logged_writes_failure_row(tmp_path) -> None:
    database = tmp_path / "goldprism.duckdb"
    with pytest.raises(RuntimeError, match="offline"):
        logged(
            "Settlement source B",
            "tinyfish_fetch",
            "https://example.test/settlements",
            lambda: (_ for _ in ()).throw(RuntimeError("offline")),
            database_path=database,
        )
    rows = latest_source_rows(database)
    assert rows[0]["status"] == "failed"
    assert rows[0]["rows_returned"] == 0


def test_latest_source_row_per_source_and_method(tmp_path) -> None:
    database = tmp_path / "goldprism.duckdb"
    log_source_row(
        source_name="MCX",
        method="mcxlib",
        url="https://example.test",
        status="failed",
        latency_ms=100,
        database_path=database,
    )
    log_source_row(
        source_name="MCX",
        method="mcxlib",
        url="https://example.test",
        status="ok",
        latency_ms=80,
        rows_returned=4,
        database_path=database,
    )
    log_source_row(
        source_name="TinyFish",
        method="tinyfish_fetch",
        url="https://example.test",
        status="empty",
        latency_ms=40,
        database_path=database,
    )
    rows = latest_source_rows(database)
    assert len(rows) == 2
    mcx = next(row for row in rows if row["method"] == "mcxlib")
    assert mcx["status"] == "ok"
    assert mcx["rows_returned"] == 4


@pytest.mark.parametrize(
    ("minutes", "badge"),
    [
        (4, "Live < 5 min"),
        (5, "Delayed"),
        (59, "Delayed"),
        (61, "Stale"),
    ],
)
def test_freshness_badges(minutes: float, badge: str) -> None:
    assert freshness_badge(minutes) == badge


def test_api_key_never_written_to_source_log(tmp_path) -> None:
    database = tmp_path / "goldprism.duckdb"
    logged(
        "TinyFish",
        "tinyfish_search",
        "https://api.search.tinyfish.ai",
        lambda: {"secret": "sk-tinyfish-private"},
        rows_from_result=lambda _: 1,
        database_path=database,
    )
    with duckdb.connect(str(database), read_only=True) as connection:
        values = connection.execute(
            "SELECT coalesce(string_agg(coalesce(note, ''), ''), '') FROM source_log"
        ).fetchone()[0]
    assert "sk-tinyfish-private" not in values


def test_source_b_date_mismatch_returns_unverified(monkeypatch, tmp_path) -> None:
    from datetime import date
    import src.cross_check as cross_check_module

    monkeypatch.setattr(
        cross_check_module,
        "load_cross_check_config",
        lambda: {
            "source_b_url": "https://example.test/settlements",
            "cross_check_enabled": True,
            "tol_bps": 5.0,
            "active_since": "2026-11-20",
        },
    )

    class _FakeClient:
        configured = True

        def fetch(self, urls, *, purpose=None):
            return {
                "as_of_date": "2026-11-19",
                "rows": [
                    {"symbol": "GOLDM", "expiry": "2026-12-05", "settle": 75000}
                ],
            }

    state, payload = cross_check_module.fetch_source_b_settlements(
        date(2026, 11, 20),
        client=_FakeClient(),
        database_path=tmp_path / "goldprism.duckdb",
    )
    assert state == "UNVERIFIED"
    assert payload is None
