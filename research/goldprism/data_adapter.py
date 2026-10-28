"""
MCX Bhavcopy Data Adapter — GoldPrism
======================================

Source-adapter architecture for MCX gold futures market data.

Principles:
- NEVER treat XAUUSD, COMEX, or FX-converted data as actual MCX prices.
- Every dataset stores: source, retrieval time, date range, filename, SHA-256,
  row counts, validation status, rejected-row count/reasons, version.
- Raw inputs are preserved immutably.
- Validated outputs are stored in Parquet and queried via DuckDB.
- If automatic retrieval is not configured, file upload is required.
  This is clearly reported — never silently substituted.

MCX Bhavcopy CSV format (official):
  Source: https://www.mcxindia.com/market-data/bhavcopy
  The daily bhavcopy CSV contains settlement prices for all contracts.
"""

from __future__ import annotations

import datetime
import hashlib
import io
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data Provenance Record
# ---------------------------------------------------------------------------

@dataclass
class DataProvenance:
    """Complete provenance record for every imported dataset."""

    source_provider: str                     # e.g. "MCX_BHAVCOPY", "USER_UPLOAD", "DEMO_FIXTURE"
    source_type: str                         # "BHAVCOPY_CSV", "DEMO_FIXTURE", "UNKNOWN"
    original_filename: str                   # original file name
    sha256_hash: str                         # SHA-256 of raw file
    retrieval_timestamp: datetime.datetime   # when file was imported/retrieved
    trading_date_min: Optional[datetime.date] = None
    trading_date_max: Optional[datetime.date] = None
    row_count_raw: int = 0
    row_count_validated: int = 0
    row_count_rejected: int = 0
    rejected_reasons: dict[str, int] = field(default_factory=dict)
    validation_status: str = "PENDING"       # "PASSED", "FAILED", "PARTIAL"
    dataset_version: str = "1.0"
    processing_config: dict[str, Any] = field(default_factory=dict)
    is_genuine_mcx: bool = False             # True only if confirmed MCX Bhavcopy
    is_demo_fixture: bool = False
    notes: str = ""

    def to_dict(self) -> dict[str, Any]:
        """Serialise to plain dict for JSON/CSV export."""
        return {
            "source_provider": self.source_provider,
            "source_type": self.source_type,
            "original_filename": self.original_filename,
            "sha256_hash": self.sha256_hash,
            "retrieval_timestamp": self.retrieval_timestamp.isoformat(),
            "trading_date_min": str(self.trading_date_min) if self.trading_date_min else None,
            "trading_date_max": str(self.trading_date_max) if self.trading_date_max else None,
            "row_count_raw": self.row_count_raw,
            "row_count_validated": self.row_count_validated,
            "row_count_rejected": self.row_count_rejected,
            "rejected_reasons": self.rejected_reasons,
            "validation_status": self.validation_status,
            "dataset_version": self.dataset_version,
            "processing_config": self.processing_config,
            "is_genuine_mcx": self.is_genuine_mcx,
            "is_demo_fixture": self.is_demo_fixture,
            "notes": self.notes,
        }


# ---------------------------------------------------------------------------
# MCX Bhavcopy Column Schema
# ---------------------------------------------------------------------------

# Official MCX Bhavcopy CSV columns (may vary slightly by date):
# Instrument, Symbol, ExpiryDate, Strike, OptionType, OpenPrice, HighPrice,
# LowPrice, ClosePrice, SettlePrice, Contracts, Value(Lakh), OpenInterest,
# ChgInOI, Date
#
# We accept flexible column variations via aliases below.
BHAVCOPY_COLUMN_ALIASES: dict[str, list[str]] = {
    "symbol":       ["Symbol", "SYMBOL", "symbol", "Scrip"],
    "expiry_date":  ["ExpiryDate", "EXPIRY_DATE", "Expiry", "expiry_date"],
    "open":         ["OpenPrice", "OPEN", "Open", "open"],
    "high":         ["HighPrice", "HIGH", "High", "high"],
    "low":          ["LowPrice", "LOW", "Low", "low"],
    "close":        ["ClosePrice", "CLOSE", "Close", "close"],
    "settle":       ["SettlePrice", "SETTLE", "Settle", "settle_price"],
    "volume":       ["Contracts", "VOLUME", "Volume", "contracts"],
    "oi":           ["OpenInterest", "OI", "open_interest"],
    "trade_date":   ["Date", "DATE", "date", "TradeDate"],
}

# Gold symbols to extract from bhavcopy
MCX_GOLD_SYMBOLS = {"GOLD", "GOLDM", "GOLDTEN", "GOLDGUINEA", "GOLDPETAL"}


# ---------------------------------------------------------------------------
# Validation Rules
# ---------------------------------------------------------------------------

def _compute_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _resolve_column(df: pd.DataFrame, canonical: str) -> Optional[str]:
    """Find the actual column name in df for a canonical field."""
    for alias in BHAVCOPY_COLUMN_ALIASES.get(canonical, []):
        if alias in df.columns:
            return alias
    return None


def _parse_date(val: Any) -> Optional[datetime.date]:
    """Try to parse a date value from multiple formats."""
    if pd.isna(val) or val == "":
        return None
    if isinstance(val, (datetime.date, datetime.datetime)):
        return val.date() if isinstance(val, datetime.datetime) else val
    s = str(val).strip()
    for fmt in ("%d-%b-%Y", "%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d-%b-%y"):
        try:
            return datetime.datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------------------
# Core validation function
# ---------------------------------------------------------------------------

def validate_bhavcopy_row(row: pd.Series, col_map: dict[str, str]) -> tuple[bool, str]:
    """
    Validate a single bhavcopy row. Returns (is_valid, rejection_reason).

    Rules:
    1. Symbol must be a known MCX gold symbol.
    2. Prices (open, high, low, close, settle) must be positive finite numbers.
    3. high >= low; open and close within [low, high].
    4. settle > 0.
    5. trade_date must be parseable.
    """
    # Rule 1: symbol
    sym_col = col_map.get("symbol")
    if sym_col and sym_col in row.index:
        symbol = str(row[sym_col]).strip().upper()
        if symbol not in MCX_GOLD_SYMBOLS:
            return False, f"non_gold_symbol:{symbol}"

    # Rule 2 & 3: price sanity
    price_fields = ["open", "high", "low", "close", "settle"]
    prices = {}
    for f in price_fields:
        col = col_map.get(f)
        if col and col in row.index:
            try:
                v = float(row[col])
                if not (v > 0 and pd.notna(v)):
                    return False, f"non_positive_price:{f}"
                prices[f] = v
            except (ValueError, TypeError):
                return False, f"unparseable_price:{f}"

    if "high" in prices and "low" in prices:
        if prices["high"] < prices["low"]:
            return False, "high_lt_low"
        if "open" in prices:
            if prices["open"] < prices["low"] or prices["open"] > prices["high"]:
                return False, "open_outside_hl"
        if "close" in prices:
            if prices["close"] < prices["low"] or prices["close"] > prices["high"]:
                return False, "close_outside_hl"

    # Rule 5: date
    date_col = col_map.get("trade_date")
    if date_col and date_col in row.index:
        d = _parse_date(row[date_col])
        if d is None:
            return False, "unparseable_date"

    return True, ""


# ---------------------------------------------------------------------------
# Bhavcopy Importer
# ---------------------------------------------------------------------------

class BhavcopyCsvAdapter:
    """
    Adapter for importing MCX Bhavcopy CSV files.

    Usage:
        adapter = BhavcopyCsvAdapter()
        result = adapter.load_from_bytes(file_bytes, filename="bhav_20241001.csv")
        df = result["dataframe"]
        prov = result["provenance"]

    If file_bytes is None:
        result["provenance"].notes will explain that auto-retrieval is not configured.
        result["dataframe"] will be empty.

    NEVER silently substitute sample data.
    """

    def __init__(self, gold_symbols: set[str] | None = None):
        self.gold_symbols = gold_symbols or MCX_GOLD_SYMBOLS

    def load_from_bytes(
        self,
        file_bytes: bytes,
        filename: str,
        processing_config: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Parse and validate a Bhavcopy CSV from raw bytes.

        Returns dict with keys:
          - "dataframe": pd.DataFrame of validated gold rows
          - "provenance": DataProvenance
          - "rejected_rows": pd.DataFrame of rejected rows with reasons
        """
        if processing_config is None:
            processing_config = {}

        sha256 = _compute_sha256(file_bytes)
        retrieval_ts = datetime.datetime.now(datetime.timezone.utc)

        prov = DataProvenance(
            source_provider="MCX_BHAVCOPY",
            source_type="BHAVCOPY_CSV",
            original_filename=filename,
            sha256_hash=sha256,
            retrieval_timestamp=retrieval_ts,
            is_genuine_mcx=True,
            processing_config=processing_config or {},
        )

        # Parse CSV
        try:
            raw_df = pd.read_csv(io.BytesIO(file_bytes))
        except Exception as e:
            prov.validation_status = "FAILED"
            prov.notes = f"CSV parse error: {e}"
            return {
                "dataframe": pd.DataFrame(),
                "provenance": prov,
                "rejected_rows": pd.DataFrame(),
            }

        prov.row_count_raw = len(raw_df)

        # Build column map
        col_map: dict[str, str] = {}
        for canonical, aliases in BHAVCOPY_COLUMN_ALIASES.items():
            actual = _resolve_column(raw_df, canonical)
            if actual:
                col_map[canonical] = actual

        # Filter to gold symbols
        sym_col = col_map.get("symbol")
        if sym_col:
            gold_mask = raw_df[sym_col].astype(str).str.strip().str.upper().isin(self.gold_symbols)
            gold_df = raw_df[gold_mask].copy()
        else:
            gold_df = raw_df.copy()

        # Validate each row
        valid_rows = []
        rejected_rows = []
        rejected_reasons: dict[str, int] = {}

        for _, row in gold_df.iterrows():
            is_valid, reason = validate_bhavcopy_row(row, col_map)
            if is_valid:
                valid_rows.append(row)
            else:
                row_copy = row.copy()
                row_copy["_rejection_reason"] = reason
                rejected_rows.append(row_copy)
                rejected_reasons[reason] = rejected_reasons.get(reason, 0) + 1

        validated_df = pd.DataFrame(valid_rows) if valid_rows else pd.DataFrame()
        rejected_df = pd.DataFrame(rejected_rows) if rejected_rows else pd.DataFrame()

        # Normalise validated df
        if not validated_df.empty:
            validated_df = self._normalise(validated_df, col_map)
            date_col = "trade_date"
            if date_col in validated_df.columns and not validated_df.empty:
                prov.trading_date_min = validated_df[date_col].min()
                prov.trading_date_max = validated_df[date_col].max()

        prov.row_count_validated = len(validated_df)
        prov.row_count_rejected = len(rejected_df)
        prov.rejected_reasons = rejected_reasons
        prov.validation_status = (
            "PASSED" if len(rejected_rows) == 0
            else ("PARTIAL" if valid_rows else "FAILED")
        )

        return {
            "dataframe": validated_df,
            "provenance": prov,
            "rejected_rows": rejected_df,
        }

    def _normalise(self, df: pd.DataFrame, col_map: dict[str, str]) -> pd.DataFrame:
        """Rename columns to canonical names and parse dates."""
        rename = {}
        for canonical, actual in col_map.items():
            if actual in df.columns:
                rename[actual] = canonical
        df = df.rename(columns=rename)

        if "trade_date" in df.columns:
            df["trade_date"] = df["trade_date"].apply(_parse_date)

        if "expiry_date" in df.columns:
            df["expiry_date"] = df["expiry_date"].apply(_parse_date)

        if "symbol" in df.columns:
            df["symbol"] = df["symbol"].astype(str).str.strip().str.upper()

        for price_col in ["open", "high", "low", "close", "settle"]:
            if price_col in df.columns:
                df[price_col] = pd.to_numeric(df[price_col], errors="coerce")

        if "volume" in df.columns:
            df["volume"] = pd.to_numeric(df["volume"], errors="coerce").fillna(0).astype("int64")

        return df.reset_index(drop=True)

    def auto_retrieve_not_configured(self) -> dict[str, Any]:
        """
        Return a result indicating automatic retrieval is not configured.

        This is called when no file is provided. We NEVER silently substitute data.
        """
        prov = DataProvenance(
            source_provider="NOT_CONFIGURED",
            source_type="NONE",
            original_filename="",
            sha256_hash="",
            retrieval_timestamp=datetime.datetime.now(datetime.timezone.utc),
            validation_status="FAILED",
            notes=(
                "Automatic MCX Bhavcopy retrieval is NOT configured. "
                "MCX does not provide a public machine-readable API. "
                "Please upload a Bhavcopy CSV file manually from: "
                "https://www.mcxindia.com/market-data/bhavcopy"
            ),
        )
        return {
            "dataframe": pd.DataFrame(),
            "provenance": prov,
            "rejected_rows": pd.DataFrame(),
        }


# ---------------------------------------------------------------------------
# Demo Fixture Adapter
# ---------------------------------------------------------------------------

class DemoFixtureAdapter:
    """
    Adapter for clearly-labelled simulated demo data.

    Used only for:
    - Test fixtures with explicit DEMO_FIXTURE label
    - Hackathon demo mode with deliberate fault injection
    - Never presented as genuine MCX data
    """

    DEMO_DISCLAIMER = (
        "⚠️ DEMO FIXTURE — SIMULATED DATA ONLY. "
        "This is NOT genuine MCX market data. "
        "Do not use for actual trading decisions."
    )

    def generate_demo_data(
        self,
        contracts: list[str] | None = None,
        n_days: int = 30,
        base_prices: dict[str, float] | None = None,
        seed: int = 42,
        inject_fault: bool = False,
    ) -> dict[str, Any]:
        """
        Generate reproducible demo fixture data for GoldPrism terminal.

        Parameters
        ----------
        contracts : list of str, optional
            Contract codes to generate. Defaults to all 4 contracts.
        n_days : int
            Number of trading days.
        base_prices : dict, optional
            Base settle price per contract.
        seed : int
            Random seed for reproducibility.
        inject_fault : bool
            If True, inject deliberate data quality faults for demo.

        Returns
        -------
        dict with "dataframe", "provenance", "rejected_rows", "injected_faults"
        """
        import numpy as np
        rng = np.random.default_rng(seed)

        if contracts is None:
            contracts = ["GOLDM", "GOLDTEN", "GOLDGUINEA", "GOLDPETAL"]

        if base_prices is None:
            # Approximate MCX prices per quote unit (INR) as of 2024
            base_prices = {
                "GOLDM": 72000.0,     # per 10g, 995 purity
                "GOLDTEN": 73500.0,   # per 10g, 999 purity
                "GOLDGUINEA": 58800.0, # per 8g, 999 purity
                "GOLDPETAL": 7350.0,   # per 1g, 999 purity
            }

        # Generate trading dates (weekdays only)
        start_date = datetime.date(2024, 9, 1)
        trading_dates = []
        d = start_date
        while len(trading_dates) < n_days:
            if d.weekday() < 5:  # Mon-Fri
                trading_dates.append(d)
            d += datetime.timedelta(days=1)

        rows = []
        injected_faults = []

        for contract in contracts:
            base = base_prices.get(contract, 72000.0)
            # Generate a price series with realistic volatility
            daily_returns = rng.normal(0, 0.008, n_days)  # ~0.8% daily vol
            prices = base * (1 + daily_returns).cumprod()

            # Expiry: last Thursday of current month + 2 months
            expiry = datetime.date(2024, 12, 26)

            for i, (date, price) in enumerate(zip(trading_dates, prices)):
                spread = price * rng.uniform(0.001, 0.003)  # bid-ask
                row = {
                    "symbol": contract,
                    "trade_date": date,
                    "expiry_date": expiry,
                    "open": round(price * (1 + rng.uniform(-0.002, 0.002)), 2),
                    "high": round(price + abs(rng.normal(0, spread)), 2),
                    "low": round(price - abs(rng.normal(0, spread)), 2),
                    "close": round(price, 2),
                    "settle": round(price, 2),
                    "volume": int(rng.integers(100, 5000)),
                    "oi": int(rng.integers(1000, 50000)),
                    "_is_demo": True,
                }
                # Ensure OHLC consistency
                row["high"] = max(row["open"], row["high"], row["close"])
                row["low"] = min(row["open"], row["low"], row["close"])
                rows.append(row)

        df = pd.DataFrame(rows)

        rejected_df = pd.DataFrame()
        if inject_fault:
            # Inject deliberate faults for demo
            fault_indices = rng.integers(0, len(df), size=5)
            fault_df_rows = []
            for fi in fault_indices:
                fault_type = rng.choice(["high_lt_low", "negative_price", "zero_settle"])
                fault_row = df.iloc[fi].copy()
                if fault_type == "high_lt_low":
                    fault_row["high"] = fault_row["low"] - 100
                    fault_row["_rejection_reason"] = "high_lt_low [INJECTED FAULT]"
                elif fault_type == "negative_price":
                    fault_row["settle"] = -abs(fault_row["settle"])
                    fault_row["_rejection_reason"] = "non_positive_price:settle [INJECTED FAULT]"
                else:
                    fault_row["settle"] = 0.0
                    fault_row["_rejection_reason"] = "non_positive_price:settle [INJECTED FAULT]"
                fault_df_rows.append(fault_row)
                injected_faults.append({
                    "row_index": int(fi),
                    "fault_type": fault_type,
                    "symbol": df.iloc[fi]["symbol"],
                    "trade_date": str(df.iloc[fi]["trade_date"]),
                })
            rejected_df = pd.DataFrame(fault_df_rows)

        sha_content = f"DEMO_FIXTURE_seed={seed}_n_days={n_days}".encode()
        sha256 = _compute_sha256(sha_content)

        prov = DataProvenance(
            source_provider="DEMO_FIXTURE",
            source_type="DEMO_FIXTURE",
            original_filename=f"goldprism_demo_fixture_seed{seed}.csv",
            sha256_hash=sha256,
            retrieval_timestamp=datetime.datetime.now(datetime.timezone.utc),
            trading_date_min=min(trading_dates) if trading_dates else None,
            trading_date_max=max(trading_dates) if trading_dates else None,
            row_count_raw=len(df),
            row_count_validated=len(df),
            row_count_rejected=len(rejected_df),
            rejected_reasons=(
                {"injected_fault": len(rejected_df)} if inject_fault else {}
            ),
            validation_status="PASSED",
            is_genuine_mcx=False,
            is_demo_fixture=True,
            notes=(
                f"{self.DEMO_DISCLAIMER} | seed={seed} | n_days={n_days} | "
                f"fault_injection={'ON' if inject_fault else 'OFF'}"
            ),
        )

        return {
            "dataframe": df,
            "provenance": prov,
            "rejected_rows": rejected_df,
            "injected_faults": injected_faults,
        }


# ---------------------------------------------------------------------------
# Parquet persistence with provenance
# ---------------------------------------------------------------------------

def write_validated_parquet(
    df: pd.DataFrame,
    provenance: DataProvenance,
    output_dir: Path,
    filename: str | None = None,
) -> Path:
    """
    Write validated bhavcopy data to Parquet, preserving provenance metadata.

    The raw input is preserved immutably; this writes only validated output.
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if filename is None:
        ts_str = provenance.retrieval_timestamp.strftime("%Y%m%d_%H%M%S")
        filename = f"goldprism_validated_{ts_str}.parquet"

    out_path = output_dir / filename

    # Attach provenance as Arrow schema metadata
    if df.empty:
        table = pa.table({})
    else:
        table = pa.Table.from_pandas(df, preserve_index=False)

    import json
    meta = {b"goldprism_provenance": json.dumps(provenance.to_dict()).encode()}
    table = table.replace_schema_metadata(meta)

    pq.write_table(table, str(out_path), compression="zstd", compression_level=3)
    logger.info("Written validated Parquet: %s (%d rows)", out_path, len(df))
    return out_path
