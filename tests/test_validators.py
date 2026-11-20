from __future__ import annotations

from datetime import date

import pandas as pd
import pytest

from src.validators import (
    CONTRACT_NORMALIZATION_CONFIG,
    DateMismatchError,
    validate_bhavcopy,
)


def _frame(rows: list[dict[str, object]]) -> pd.DataFrame:
    return pd.DataFrame(rows)


def _row(
    *,
    symbol: str = "GOLDM",
    expiry: object = "2026-12-05",
    trade_date: object = "2026-11-20",
    settle: float = 75000.0,
    volume: int = 10,
    open_interest: int = 100,
) -> dict[str, object]:
    return {
        "Symbol": symbol,
        "Date": trade_date,
        "ExpiryDate": expiry,
        "SettlePrice": settle,
        "Volume": volume,
        "OpenInterest": open_interest,
    }


def test_rejects_returned_date_mismatch_and_records_health() -> None:
    with pytest.raises(DateMismatchError) as raised:
        validate_bhavcopy(_frame([_row(trade_date="2026-11-19")]), date(2026, 11, 20))

    assert raised.value.data_health["date_mismatches_rejected"] == 1
    assert raised.value.data_health["rejected_rows"] == 1


def test_contract_key_includes_expiry_for_same_symbol() -> None:
    result = validate_bhavcopy(
        _frame([_row(expiry="2026-12-05"), _row(expiry="2027-02-05", settle=75100)]),
        date(2026, 11, 20),
    )

    assert result.frame["contract_key"].tolist() == ["GOLDM|2026-12-05", "GOLDM|2027-02-05"]
    assert result.frame[["symbol", "expiry_date"]].drop_duplicates().shape[0] == 2


def test_rejects_invalid_expiry_and_negative_prices() -> None:
    result = validate_bhavcopy(
        _frame(
            [
                _row(expiry="not-an-expiry"),
                _row(expiry="2026-12-05", settle=-1),
                _row(expiry="2026-12-05", settle=75000),
            ]
        ),
        date(2026, 11, 20),
    )

    assert len(result.frame) == 1
    assert set(result.rejected_rows["rejection_reason"]) == {
        "missing_or_invalid_expiry_date",
        "negative_price",
    }
    assert result.data_health["rejected_rows"] == 2


@pytest.mark.parametrize(
    ("symbol", "settle", "expected"),
    [
        ("GOLDM", 75000.0, 75000.0 / 10 / 0.995),
        ("GOLDTEN", 75000.0, 75000.0 / 10 / 0.999),
        ("GOLDGUINEA", 60000.0, 60000.0 / 8 / 0.999),
        ("GOLDPETAL", 7500.0, 7500.0 / 1 / 0.999),
    ],
)
def test_normalizes_fine_gold_price(symbol: str, settle: float, expected: float) -> None:
    result = validate_bhavcopy(_frame([_row(symbol=symbol, settle=settle)]), date(2026, 11, 20))

    assert result.frame.iloc[0]["price_per_gram_fine_gold"] == pytest.approx(expected)
    assert CONTRACT_NORMALIZATION_CONFIG[symbol]["purity"] in (0.995, 0.999)


@pytest.mark.parametrize(
    ("volume", "open_interest", "trusted"),
    [(0, 100, False), (10, 0, False), (10, 100, True)],
)
def test_thin_market_settlement_trust_flag(
    volume: int,
    open_interest: int,
    trusted: bool,
) -> None:
    result = validate_bhavcopy(
        _frame([_row(volume=volume, open_interest=open_interest)]),
        date(2026, 11, 20),
    )

    assert bool(result.frame.iloc[0]["settle_trusted"]) is trusted
    assert bool(result.frame.iloc[0]["signal_eligible"]) is trusted


def test_health_counts_missing_values_and_price_outliers() -> None:
    rows = [
        _row(expiry="2026-12-05", settle=75000),
        _row(expiry="2027-02-05", settle=75010),
        _row(expiry="2027-04-05", settle=74990),
        _row(expiry="2027-06-05", settle=900000),
    ]
    rows[0]["OpenInterest"] = None
    result = validate_bhavcopy(_frame(rows), date(2026, 11, 20))

    assert result.data_health["missing_values_pct"] > 0
    assert result.data_health["outlier_count"] == 1
    assert result.data_health["untrusted_rows"] == 1


def test_seed_error_injects_mismatch_before_acceptance() -> None:
    with pytest.raises(DateMismatchError) as raised:
        validate_bhavcopy(_frame([_row()]), date(2026, 11, 20), seed_error=True)

    assert raised.value.data_health["date_mismatches_rejected"] == 1


def test_cross_check_mismatch_vetoes_only_the_vetoed_row(tmp_path) -> None:
    from src.cross_check import apply_settlement_cross_check

    result = validate_bhavcopy(_frame([_row(), _row(expiry="2027-02-05")]), date(2026, 11, 20))
    mismatched = apply_settlement_cross_check(
        result.frame,
        {
            "as_of_date": "2026-11-20",
            "rows": [
                {"symbol": "GOLDM", "expiry": "2026-12-05", "settle": 80000},
                {"symbol": "GOLDM", "expiry": "2027-02-05", "settle": 75000},
            ],
        },
        date(2026, 11, 20),
        database_path=tmp_path / "goldprism.duckdb",
    )
    mismatches = mismatched[mismatched["cross_check_state"] == "MISMATCH"]
    unverified = mismatched[mismatched["cross_check_state"] == "UNVERIFIED"]
    assert len(mismatches) == 1
    assert bool(mismatches.iloc[0]["signal_eligible"]) is False
    assert bool(mismatches.iloc[0]["settle_trusted"]) is False
    assert len(unverified) == 0


def test_cross_check_unverified_keeps_primary_trust(tmp_path) -> None:
    from src.cross_check import apply_settlement_cross_check

    result = validate_bhavcopy(_frame([_row(volume=10, open_interest=100)]), date(2026, 11, 20))
    frame = apply_settlement_cross_check(
        result.frame,
        None,
        date(2026, 11, 20),
        database_path=tmp_path / "goldprism.duckdb",
    )
    assert frame.iloc[0]["cross_check_state"] == "UNVERIFIED"
    assert bool(frame.iloc[0]["settle_trusted"]) is True
    assert bool(frame.iloc[0]["signal_eligible"]) is True


def test_source_b_date_mismatch_is_unverified(tmp_path) -> None:
    from src.cross_check import parse_source_b_rows

    payload = {"as_of_date": "2026-11-19", "rows": [{"symbol": "GOLDM", "expiry": "2026-12-05", "settle": 75000}]}
    as_of, rows = parse_source_b_rows(payload)
    assert as_of.isoformat() == "2026-11-19"
    assert len(rows) == 1
