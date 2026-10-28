"""
GoldPrism Research Terminal — Streamlit Dashboard
===================================================

Launch with:
    streamlit run app.py

Sections:
1. Overview
2. Data Health
3. Spread Explorer
4. X-Ray Waterfall
5. Signal Intelligence
6. Best Vehicle
7. Backtest Lab
8. Methodology & Run Reports
"""

from __future__ import annotations

import datetime
import io
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

# Ensure src is importable when run from project root
sys.path.insert(0, str(Path(__file__).parent / "src"))

from goldprism.contract_master import (
    SUPPORTED_CONTRACTS,
    get_all_specs,
    get_spec,
    normalize_price_to_999_per_g,
)
from goldprism.data_adapter import (
    BhavcopyCsvAdapter,
    DemoFixtureAdapter,
    DataProvenance,
    write_validated_parquet,
)
from goldprism.xray import (
    CostModelConfig,
    Verdict,
    compute_xray,
    calculate_transaction_costs,
)
from goldprism.signal import (
    SignalConfig,
    SignalState,
    compute_signal_series,
    rank_best_vehicle,
)
from goldprism.backtest import BacktestConfig, WalkForwardBacktester

# ── Page config ──────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="GoldPrism Research Terminal",
    page_icon="🔶",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Theme colours ────────────────────────────────────────────────────────────
GOLD = "#FFB800"
DARK = "#1a1a2e"
GREEN = "#00C851"
RED = "#FF4444"
ORANGE = "#FF8800"
BLUE = "#4FC3F7"

# ── Session state helpers ─────────────────────────────────────────────────────
def _init_session():
    defaults = {
        "demo_data": None,
        "demo_provenance": None,
        "uploaded_data": None,
        "uploaded_provenance": None,
        "active_data": None,
        "active_provenance": None,
        "is_demo_mode": True,
        "fault_injected": False,
        "xray_result": None,
        "signal_df": None,
        "backtest_result": None,
        "vehicle_rankings": None,
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v

_init_session()


# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown(f"## 🔶 GoldPrism")
    st.markdown("**MCX Gold Spread Research Terminal**")
    st.divider()

    mode = st.radio(
        "Data Mode",
        ["🎭 Demo Fixture", "📂 Upload Bhavcopy CSV"],
        help=(
            "Demo: clearly labelled simulated data for exploration and demo.\n"
            "Upload: import genuine MCX Bhavcopy CSV from mcxindia.com"
        ),
    )
    st.session_state["is_demo_mode"] = mode.startswith("🎭")

    st.divider()

    section = st.radio(
        "Navigation",
        [
            "1️⃣  Overview",
            "2️⃣  Data Health",
            "3️⃣  Spread Explorer",
            "4️⃣  X-Ray Waterfall",
            "5️⃣  Signal Intelligence",
            "6️⃣  Best Vehicle",
            "7️⃣  Backtest Lab",
            "8️⃣  Methodology & Reports",
        ],
    )

    st.divider()
    st.caption(f"Version 0.1.0 | Build: GoldPrism")
    st.caption("⚠️ NOT financial advice. Research tool only.")


# ── Data loading helpers ──────────────────────────────────────────────────────
@st.cache_data(show_spinner=False)
def load_demo_data(inject_fault: bool = False, seed: int = 42, n_days: int = 60):
    adapter = DemoFixtureAdapter()
    return adapter.generate_demo_data(n_days=n_days, inject_fault=inject_fault, seed=seed)


def get_active_data():
    """Return (dataframe, provenance) for the currently selected mode."""
    if st.session_state["is_demo_mode"]:
        inject = st.session_state.get("fault_injected", False)
        result = load_demo_data(inject_fault=inject)
        return result["dataframe"], result["provenance"]
    else:
        return st.session_state.get("uploaded_data"), st.session_state.get("uploaded_provenance")


def verdict_color(verdict: str) -> str:
    return {
        "TRADABLE": GREEN,
        "WATCH": ORANGE,
        "NO EDGE": BLUE,
        "BLOCKED": RED,
    }.get(verdict, RED)


def verdict_emoji(verdict: str) -> str:
    return {
        "TRADABLE": "✅",
        "WATCH": "👀",
        "NO EDGE": "➖",
        "BLOCKED": "🚫",
    }.get(verdict, "❓")


# ── SECTION 1: Overview ───────────────────────────────────────────────────────
if section.startswith("1"):
    st.markdown(f"# 🔶 GoldPrism Research Terminal")
    st.markdown("**Explainable MCX Gold Spread Research Platform**")

    df, prov = get_active_data()

    # Data source status banner
    if prov is None:
        st.error("⚠️ No data loaded. Select Demo Mode or upload a Bhavcopy CSV.")
        st.stop()

    if prov.is_demo_fixture:
        st.warning(
            f"⚠️ **DEMO MODE** — Simulated fixture data. NOT real MCX market data. "
            f"Do not use for trading decisions."
        )
    elif prov.is_genuine_mcx:
        st.success("✅ Genuine MCX Bhavcopy data loaded.")
    else:
        st.error("🚫 Data source unclear — treat as UNVERIFIED.")

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Source", prov.source_provider)
        st.metric("Validation", prov.validation_status)
    with col2:
        st.metric("Rows Validated", f"{prov.row_count_validated:,}")
        st.metric("Rows Rejected", f"{prov.row_count_rejected:,}")
    with col3:
        date_min = str(prov.trading_date_min or "N/A")
        date_max = str(prov.trading_date_max or "N/A")
        st.metric("Date From", date_min)
        st.metric("Date To", date_max)
    with col4:
        st.metric("SHA-256 (first 16)", prov.sha256_hash[:16] + "…")
        st.metric("Original File", prov.original_filename[:30] or "N/A")

    st.divider()

    # Quick X-Ray and Verdict for most recent date
    if df is not None and not df.empty and "symbol" in df.columns:
        symbols_available = df["symbol"].unique().tolist()
        col_a, col_b = st.columns(2)
        with col_a:
            contract_a = st.selectbox("Contract A", [c for c in SUPPORTED_CONTRACTS if c in symbols_available], key="ov_a")
        with col_b:
            contract_b = st.selectbox("Contract B", [c for c in SUPPORTED_CONTRACTS if c in symbols_available and c != contract_a], key="ov_b")

        # Get latest prices
        latest = df.groupby("symbol").last().reset_index()
        price_a_row = latest[latest["symbol"] == contract_a]
        price_b_row = latest[latest["symbol"] == contract_b]

        if not price_a_row.empty and not price_b_row.empty:
            p_a = float(price_a_row["settle"].iloc[0])
            p_b = float(price_b_row["settle"].iloc[0])
            trade_date = df["trade_date"].max() if "trade_date" in df.columns else datetime.date.today()
            if isinstance(trade_date, pd.Timestamp):
                trade_date = trade_date.date()

            result = compute_xray(
                contract_a=contract_a, price_a_quoted=p_a,
                expiry_a="2024-12-26",
                contract_b=contract_b, price_b_quoted=p_b,
                expiry_b="2024-12-26",
                trade_date=trade_date,
                data_quality_ok=(prov.validation_status in ["PASSED", "PARTIAL"]),
            )
            st.session_state["xray_result"] = result

            vc = verdict_color(result.verdict)
            ve = verdict_emoji(result.verdict)
            st.markdown(f"### Latest Verdict: <span style='color:{vc};font-size:1.5em'>{ve} {result.verdict}</span>", unsafe_allow_html=True)

            with st.expander("Verdict Reasons"):
                for r in result.verdict_reasons:
                    st.markdown(f"- {r}")

            c1, c2, c3, c4 = st.columns(4)
            c1.metric("Raw Spread (INR/g)", f"{result.raw_spread:.4f}")
            c2.metric("Gross Residual (INR/g)", f"{result.gross_residual:.4f}")
            c3.metric("Transaction Costs (INR/g)", f"{result.transaction_costs:.4f}")
            c4.metric("Net Edge (INR/g)", f"{result.net_edge:.4f}")

    st.divider()
    st.caption(f"Data retrieved: {prov.retrieval_timestamp.strftime('%Y-%m-%d %H:%M:%S UTC') if prov.retrieval_timestamp else 'N/A'}")


# ── SECTION 2: Data Health ────────────────────────────────────────────────────
elif section.startswith("2"):
    st.header("2️⃣ Data Health")

    df, prov = get_active_data()

    if st.session_state["is_demo_mode"]:
        st.info("🎭 Demo Mode: Using simulated fixture data.")

        inject_col, _ = st.columns([1, 3])
        with inject_col:
            if st.button("⚡ Inject Data Faults (Demo)", help="Inject deliberate faults for demonstration"):
                st.session_state["fault_injected"] = True
                st.cache_data.clear()
                st.rerun()

            if st.session_state.get("fault_injected"):
                if st.button("🔄 Reset Faults"):
                    st.session_state["fault_injected"] = False
                    st.cache_data.clear()
                    st.rerun()
    else:
        uploaded = st.file_uploader(
            "Upload MCX Bhavcopy CSV",
            type=["csv"],
            help="Download from https://www.mcxindia.com/market-data/bhavcopy",
        )
        if uploaded:
            file_bytes = uploaded.read()
            adapter = BhavcopyCsvAdapter()
            result = adapter.load_from_bytes(file_bytes, uploaded.name)
            st.session_state["uploaded_data"] = result["dataframe"]
            st.session_state["uploaded_provenance"] = result["provenance"]
            df = result["dataframe"]
            prov = result["provenance"]
            st.success(f"Loaded {prov.row_count_validated} validated rows from {uploaded.name}")

    if prov is None:
        st.warning("No data loaded.")
        st.stop()

    # Provenance table
    st.subheader("Dataset Provenance")
    prov_dict = prov.to_dict()
    prov_df = pd.DataFrame([{"Field": k, "Value": str(v)} for k, v in prov_dict.items()])
    st.dataframe(prov_df, use_container_width=True, hide_index=True)

    if df is None or df.empty:
        st.warning("No validated rows to analyze.")
        st.stop()

    st.subheader("Validation Summary")
    c1, c2, c3 = st.columns(3)
    c1.metric("Total Validated", prov.row_count_validated)
    c2.metric("Total Rejected", prov.row_count_rejected, delta=f"-{prov.row_count_rejected}" if prov.row_count_rejected > 0 else "0", delta_color="inverse")
    c3.metric("Status", prov.validation_status)

    if prov.rejected_reasons:
        st.subheader("Rejected Row Reasons")
        rej_df = pd.DataFrame([
            {"Reason": k, "Count": v}
            for k, v in prov.rejected_reasons.items()
        ])
        fig = px.bar(rej_df, x="Reason", y="Count", title="Rejection Reasons",
                     color="Count", color_continuous_scale="Reds")
        st.plotly_chart(fig, use_container_width=True)

    if st.session_state.get("fault_injected") and "injected_faults" in (load_demo_data(inject_fault=True) or {}):
        demo_result = load_demo_data(inject_fault=True)
        faults = demo_result.get("injected_faults", [])
        if faults:
            st.subheader("⚡ Injected Faults (Demo)")
            st.error(f"{len(faults)} deliberate faults injected and caught by validation:")
            st.dataframe(pd.DataFrame(faults), use_container_width=True)

    st.subheader("Data Snapshot")
    if "trade_date" in df.columns:
        df_display = df.copy()
        df_display["trade_date"] = df_display["trade_date"].astype(str)
        st.dataframe(df_display.head(50), use_container_width=True)

    # Missing values heatmap
    if not df.empty:
        st.subheader("Missing Values")
        missing = df.isnull().sum()
        missing_pct = (missing / len(df) * 100).round(2)
        miss_df = pd.DataFrame({"Column": missing.index, "Missing": missing.values, "Pct": missing_pct.values})
        miss_df = miss_df[miss_df["Missing"] > 0]
        if not miss_df.empty:
            st.dataframe(miss_df, use_container_width=True)
        else:
            st.success("✅ No missing values in validated dataset.")

    # Export
    st.subheader("Export Data Quality Report")
    report = json.dumps(prov.to_dict(), indent=2, default=str)
    st.download_button(
        "📥 Download Provenance JSON",
        data=report,
        file_name="goldprism_data_quality.json",
        mime="application/json",
    )


# ── SECTION 3: Spread Explorer ────────────────────────────────────────────────
elif section.startswith("3"):
    st.header("3️⃣ Spread Explorer")

    df, prov = get_active_data()
    if prov and prov.is_demo_fixture:
        st.info("🎭 Demo Mode — simulated data")

    if df is None or df.empty:
        st.warning("Load data first (Section 2 or Overview).")
        st.stop()

    symbols_in_data = sorted(df["symbol"].unique().tolist()) if "symbol" in df.columns else SUPPORTED_CONTRACTS

    col1, col2, col3 = st.columns(3)
    with col1:
        contract_a = st.selectbox("Leg A Contract", [c for c in SUPPORTED_CONTRACTS if c in symbols_in_data], key="se_a")
    with col2:
        contract_b = st.selectbox("Leg B Contract", [c for c in SUPPORTED_CONTRACTS if c in symbols_in_data and c != contract_a], key="se_b")
    with col3:
        target_exposure_g = st.number_input("Target Exposure (grams)", min_value=1.0, value=100.0, step=1.0)

    expiry_options = ["2024-12-26", "2025-01-30", "2025-02-27"]
    col4, col5 = st.columns(2)
    with col4:
        expiry_a = st.selectbox("Expiry A", expiry_options, key="se_exp_a")
    with col5:
        expiry_b = st.selectbox("Expiry B", expiry_options, key="se_exp_b")

    # Filter data for selected contracts
    df_a = df[df["symbol"] == contract_a].copy() if "symbol" in df.columns else pd.DataFrame()
    df_b = df[df["symbol"] == contract_b].copy() if "symbol" in df.columns else pd.DataFrame()

    if df_a.empty or df_b.empty:
        st.warning(f"No data for selected contracts in current dataset.")
        st.stop()

    # Merge on trade date
    if "trade_date" in df_a.columns and "trade_date" in df_b.columns:
        merged = pd.merge(
            df_a[["trade_date", "settle"]].rename(columns={"settle": f"settle_{contract_a}"}),
            df_b[["trade_date", "settle"]].rename(columns={"settle": f"settle_{contract_b}"}),
            on="trade_date", how="inner"
        ).sort_values("trade_date")

        if merged.empty:
            st.warning("No overlapping dates for selected contracts.")
            st.stop()

        # Compute raw spread (normalized)
        trade_date_ref = merged["trade_date"].max()
        if isinstance(trade_date_ref, pd.Timestamp):
            trade_date_ref = trade_date_ref.date()

        norm_a = [normalize_price_to_999_per_g(contract_a, p) for p in merged[f"settle_{contract_a}"]]
        norm_b = [normalize_price_to_999_per_g(contract_b, p) for p in merged[f"settle_{contract_b}"]]
        merged["norm_a"] = norm_a
        merged["norm_b"] = norm_b
        merged["raw_spread"] = merged["norm_a"] - merged["norm_b"]

        st.subheader(f"Spread: {contract_a} vs {contract_b} (INR/g, 999-fine normalized)")
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=merged["trade_date"].astype(str), y=merged["raw_spread"],
                                  mode="lines+markers", name="Raw Spread",
                                  line=dict(color=GOLD)))
        fig.add_hline(y=0, line_dash="dash", line_color="gray", annotation_text="Zero")
        fig.update_layout(template="plotly_dark", height=400)
        st.plotly_chart(fig, use_container_width=True)

        # Price comparison
        fig2 = go.Figure()
        fig2.add_trace(go.Scatter(x=merged["trade_date"].astype(str), y=merged["norm_a"],
                                   mode="lines", name=f"{contract_a} (999-normalized)", line=dict(color=GOLD)))
        fig2.add_trace(go.Scatter(x=merged["trade_date"].astype(str), y=merged["norm_b"],
                                   mode="lines", name=f"{contract_b} (999-normalized)", line=dict(color=BLUE)))
        fig2.update_layout(title="Normalized Prices (INR/g of 999-fine gold)",
                            template="plotly_dark", height=350)
        st.plotly_chart(fig2, use_container_width=True)

        # Compute X-Ray for selected date
        selected_date = st.date_input(
            "Select Analysis Date",
            value=trade_date_ref,
            min_value=merged["trade_date"].min() if not merged.empty else datetime.date(2024, 1, 1),
            max_value=merged["trade_date"].max() if not merged.empty else datetime.date(2024, 12, 31),
        )

        row_a = merged[merged["trade_date"] == pd.Timestamp(selected_date)]
        if not row_a.empty:
            p_a = float(row_a[f"settle_{contract_a}"].iloc[0])
            p_b = float(row_a[f"settle_{contract_b}"].iloc[0])

            xray = compute_xray(
                contract_a=contract_a, price_a_quoted=p_a,
                expiry_a=expiry_a,
                contract_b=contract_b, price_b_quoted=p_b,
                expiry_b=expiry_b,
                trade_date=selected_date,
                data_quality_ok=(prov.validation_status in ["PASSED", "PARTIAL"]) if prov else True,
            )
            st.session_state["xray_result"] = xray

            vc = verdict_color(xray.verdict)
            st.markdown(f"### Verdict: <span style='color:{vc}'>{verdict_emoji(xray.verdict)} {xray.verdict}</span>", unsafe_allow_html=True)

            c1, c2, c3, c4 = st.columns(4)
            c1.metric(f"Price A ({contract_a})", f"₹{p_a:,.2f}")
            c2.metric(f"Price B ({contract_b})", f"₹{p_b:,.2f}")
            c3.metric("Raw Spread (INR/g)", f"{xray.raw_spread:.4f}")
            c4.metric("Net Edge (INR/g)", f"{xray.net_edge:.4f}",
                      delta_color="normal" if xray.net_edge > 0 else "inverse")


# ── SECTION 4: X-Ray Waterfall ────────────────────────────────────────────────
elif section.startswith("4"):
    st.header("4️⃣ X-Ray Waterfall")
    st.markdown("*Complete decomposition: Raw Spread → Net Edge*")

    df, prov = get_active_data()
    if prov and prov.is_demo_fixture:
        st.info("🎭 Demo Mode — simulated data")

    # Input controls
    symbols_in_data = sorted(df["symbol"].unique().tolist()) if (df is not None and "symbol" in df.columns) else SUPPORTED_CONTRACTS

    col1, col2 = st.columns(2)
    with col1:
        contract_a = st.selectbox("Contract A", [c for c in SUPPORTED_CONTRACTS if c in symbols_in_data], key="xr_a")
        price_a = st.number_input("Price A (INR per quote unit)", value=73500.0, step=100.0, key="xr_pa")
        expiry_a = st.text_input("Expiry A (YYYY-MM-DD)", "2024-12-26")
        lots_a = st.number_input("Lots A", min_value=1, value=1, key="xr_la")

    with col2:
        avail_b = [c for c in SUPPORTED_CONTRACTS if c in symbols_in_data and c != contract_a]
        contract_b = st.selectbox("Contract B", avail_b if avail_b else SUPPORTED_CONTRACTS, key="xr_b")
        price_b = st.number_input("Price B (INR per quote unit)", value=7350.0, step=10.0, key="xr_pb")
        expiry_b = st.text_input("Expiry B (YYYY-MM-DD)", "2024-12-26")
        lots_b = st.number_input("Lots B", min_value=1, value=1, key="xr_lb")

    col3, col4 = st.columns(2)
    with col3:
        trade_date = st.date_input("Trade Date", value=datetime.date(2024, 10, 1))
        artifact = st.number_input("Settlement Artifact (INR/g)", value=0.0, step=0.1,
                                    help="Known settlement anomaly from data quality analysis")
    with col4:
        carry_rate = st.slider("Carry Rate (annual %)", 0.0, 15.0, 6.5) / 100.0
        data_quality_ok = st.checkbox("Data Quality Gate Passed", value=True)
        liquidity_ok = st.checkbox("Liquidity Gate Passed", value=True)

    if st.button("🔬 Run X-Ray Analysis", type="primary"):
        with st.spinner("Computing X-Ray waterfall…"):
            result = compute_xray(
                contract_a=contract_a, price_a_quoted=price_a, expiry_a=expiry_a,
                contract_b=contract_b, price_b_quoted=price_b, expiry_b=expiry_b,
                trade_date=trade_date, lots_a=int(lots_a), lots_b=int(lots_b),
                carry_rate_annual=carry_rate,
                settlement_artifact_inr_per_g=artifact,
                data_quality_ok=data_quality_ok,
                liquidity_ok=liquidity_ok,
            )
            st.session_state["xray_result"] = result

    result = st.session_state.get("xray_result")
    if result is None:
        st.info("Click **Run X-Ray Analysis** to compute the waterfall.")
        st.stop()

    # Verdict banner
    vc = verdict_color(result.verdict)
    st.markdown(
        f"<div style='background:{vc}22;padding:1rem;border-left:4px solid {vc};border-radius:4px'>"
        f"<h2 style='color:{vc};margin:0'>{verdict_emoji(result.verdict)} {result.verdict}</h2>"
        f"</div>", unsafe_allow_html=True
    )
    st.markdown("")

    for r in result.verdict_reasons:
        st.markdown(f"- {r}")

    # Waterfall chart
    components = {
        "Economic Basis": result.economic_basis,
        "Expiry/Carry": result.expiry_carry,
        "Settlement Artifact": result.settlement_artifact,
        "Gross Residual": result.gross_residual,
        "Transaction Costs": -result.transaction_costs,  # costs reduce edge
    }
    labels = list(components.keys())
    values = list(components.values())
    colors = [GREEN if v >= 0 else RED for v in values]

    fig = go.Figure(go.Waterfall(
        name="Spread Decomposition",
        orientation="v",
        measure=["relative"] * 4 + ["relative", "total"],
        x=labels + ["Net Edge"],
        y=values + [result.net_edge],
        connector={"line": {"color": "gray"}},
        increasing={"marker": {"color": GREEN}},
        decreasing={"marker": {"color": RED}},
        totals={"marker": {"color": GOLD}},
    ))
    fig.update_layout(
        title=f"X-Ray Waterfall: {contract_a} vs {contract_b} (INR/g, 999-fine)",
        template="plotly_dark",
        height=450,
        yaxis_title="INR per gram",
    )
    st.plotly_chart(fig, use_container_width=True)

    # Detailed table
    st.subheader("Waterfall Component Detail")
    waterfall_df = pd.DataFrame([
        {"Component": "Raw Spread", "INR/g": result.raw_spread, "Note": "price_a_norm - price_b_norm"},
        {"Component": "— Economic Basis", "INR/g": result.economic_basis, "Note": "Structural (purity/unit) — absorbed in normalization"},
        {"Component": "— Expiry/Carry", "INR/g": result.expiry_carry, "Note": f"carry_rate={carry_rate*100:.1f}% annual"},
        {"Component": "— Settlement Artifact", "INR/g": result.settlement_artifact, "Note": "Data quality: settlement anomaly (NOT in transaction costs)"},
        {"Component": "= Gross Residual", "INR/g": result.gross_residual, "Note": "Unexplained spread after structural components"},
        {"Component": "— Transaction Costs", "INR/g": result.transaction_costs, "Note": "Round-trip: brokerage+exchange+CTT+SEBI+GST+stamp+slippage"},
        {"Component": "= Net Edge", "INR/g": result.net_edge, "Note": "Tradable edge after all costs"},
    ])
    st.dataframe(waterfall_df, use_container_width=True, hide_index=True)

    # Reconciliation check
    st.subheader("Reconciliation")
    recon_color = GREEN if result.reconciliation_ok else RED
    st.markdown(
        f"Error: {result.reconciliation_error:.8f} INR/g — "
        f"<span style='color:{recon_color}'>{'✅ PASS' if result.reconciliation_ok else '❌ FAIL'}</span>",
        unsafe_allow_html=True
    )

    # Normalized prices
    st.subheader("Normalized Prices (999-fine basis)")
    c1, c2, c3 = st.columns(3)
    c1.metric(f"{contract_a} Normalized", f"₹{result.price_a_normalized:,.4f}/g")
    c2.metric(f"{contract_b} Normalized", f"₹{result.price_b_normalized:,.4f}/g")
    c3.metric("Config Hash", result.config_hash)

    # Cost breakdown
    if result.cost_breakdown_a:
        with st.expander("Transaction Cost Details — Leg A"):
            st.json(result.cost_breakdown_a)
    if result.cost_breakdown_b:
        with st.expander("Transaction Cost Details — Leg B"):
            st.json(result.cost_breakdown_b)

    # Unverified charges warning
    if not result.all_costs_verified:
        st.warning("⚠️ Some cost components are UNVERIFIED. TRADABLE verdict is blocked until verified.")
    if not result.all_specs_verified:
        st.error("🚫 Some contract specs are UNVERIFIED. Calculation blocked.")

    # Export
    st.download_button(
        "📥 Download X-Ray Trace (JSON)",
        data=json.dumps(result.to_dict(), indent=2, default=str),
        file_name="goldprism_xray_trace.json",
        mime="application/json",
    )


# ── SECTION 5: Signal Intelligence ───────────────────────────────────────────
elif section.startswith("5"):
    st.header("5️⃣ Signal Intelligence")

    df, prov = get_active_data()
    if prov and prov.is_demo_fixture:
        st.info("🎭 Demo Mode — simulated data")

    if df is None or df.empty:
        st.warning("Load data first.")
        st.stop()

    symbols_in_data = sorted(df["symbol"].unique().tolist()) if "symbol" in df.columns else SUPPORTED_CONTRACTS

    col1, col2 = st.columns(2)
    with col1:
        contract_a = st.selectbox("Leg A", [c for c in SUPPORTED_CONTRACTS if c in symbols_in_data], key="si_a")
    with col2:
        avail_b = [c for c in SUPPORTED_CONTRACTS if c in symbols_in_data and c != contract_a]
        contract_b = st.selectbox("Leg B", avail_b if avail_b else SUPPORTED_CONTRACTS, key="si_b")

    rolling_window = st.slider("Rolling Window (bars)", 5, 60, 20)
    cost_hurdle = st.number_input("Cost Hurdle (INR/g)", value=2.0, step=0.1)

    if st.button("📊 Compute Signal Series", type="primary"):
        with st.spinner("Computing signals…"):
            df_a = df[df["symbol"] == contract_a].copy() if "symbol" in df.columns else pd.DataFrame()
            df_b = df[df["symbol"] == contract_b].copy() if "symbol" in df.columns else pd.DataFrame()

            if df_a.empty or df_b.empty:
                st.error("No data for selected contracts.")
                st.stop()

            if "trade_date" in df_a.columns:
                merged = pd.merge(
                    df_a[["trade_date", "settle", "volume"]].rename(
                        columns={"settle": f"settle_a", "volume": "vol_a"}),
                    df_b[["trade_date", "settle", "volume"]].rename(
                        columns={"settle": f"settle_b", "volume": "vol_b"}),
                    on="trade_date", how="inner"
                ).sort_values("trade_date").reset_index(drop=True)

                if merged.empty:
                    st.error("No overlapping dates.")
                    st.stop()

                norm_a = pd.Series([normalize_price_to_999_per_g(contract_a, p) for p in merged["settle_a"]])
                norm_b = pd.Series([normalize_price_to_999_per_g(contract_b, p) for p in merged["settle_b"]])

                # Estimate net edges (simplified: raw spread minus a fixed cost estimate)
                raw_spreads = norm_a - norm_b
                cost_est = pd.Series([2.5] * len(raw_spreads))  # simplified cost estimate
                net_edges = raw_spreads - cost_est

                config = SignalConfig(
                    rolling_window=rolling_window,
                    cost_hurdle_inr_per_g=cost_hurdle,
                )
                signal_df = compute_signal_series(
                    net_edges=net_edges,
                    dates=merged["trade_date"],
                    volumes_a=merged.get("vol_a"),
                    volumes_b=merged.get("vol_b"),
                    config=config,
                )
                signal_df["trade_date"] = merged["trade_date"].values
                st.session_state["signal_df"] = signal_df

    sig_df = st.session_state.get("signal_df")
    if sig_df is not None and not sig_df.empty:
        # Signal state distribution
        state_counts = sig_df["signal"].value_counts().reset_index()
        state_counts.columns = ["Signal", "Count"]
        col1, col2 = st.columns([1, 2])
        with col1:
            fig_pie = px.pie(state_counts, names="Signal", values="Count",
                             title="Signal Distribution",
                             color="Signal",
                             color_discrete_map={
                                 "TRADABLE": GREEN, "WATCH": ORANGE,
                                 "NO EDGE": BLUE, "BLOCKED": RED,
                             })
            fig_pie.update_layout(template="plotly_dark")
            st.plotly_chart(fig_pie, use_container_width=True)

        with col2:
            fig_ts = go.Figure()
            fig_ts.add_trace(go.Scatter(
                x=sig_df["trade_date"].astype(str), y=sig_df["net_edge"],
                mode="lines", name="Net Edge (INR/g)", line=dict(color=GOLD)
            ))
            fig_ts.add_trace(go.Scatter(
                x=sig_df["trade_date"].astype(str), y=sig_df["rolling_mean_edge"],
                mode="lines", name="Rolling Mean", line=dict(color=BLUE, dash="dash")
            ))
            fig_ts.add_hline(y=cost_hurdle, line_dash="dot", line_color=GREEN,
                              annotation_text=f"Cost Hurdle ({cost_hurdle:.1f})")
            fig_ts.add_hline(y=0, line_dash="dash", line_color="gray")
            fig_ts.update_layout(title="Net Edge & Rolling Statistics",
                                  template="plotly_dark", height=350)
            st.plotly_chart(fig_ts, use_container_width=True)

        # Z-score
        fig_z = go.Figure()
        fig_z.add_trace(go.Bar(x=sig_df["trade_date"].astype(str), y=sig_df["zscore"],
                                name="Z-Score",
                                marker_color=[GREEN if v > 0 else RED for v in sig_df["zscore"]]))
        fig_z.update_layout(title="Z-Score", template="plotly_dark", height=250)
        st.plotly_chart(fig_z, use_container_width=True)

        st.subheader("Signal Table")
        st.dataframe(sig_df[["trade_date", "net_edge", "rolling_mean_edge",
                               "rolling_std_edge", "zscore", "cost_hurdle_passed",
                               "liquidity_ok", "trust_status", "signal"]].head(50),
                     use_container_width=True)

        # Export
        csv = sig_df.to_csv(index=False)
        st.download_button("📥 Download Signal CSV", csv, "goldprism_signals.csv", "text/csv")
    else:
        st.info("Click **Compute Signal Series** to see results.")


# ── SECTION 6: Best Vehicle ───────────────────────────────────────────────────
elif section.startswith("6"):
    st.header("6️⃣ Best Vehicle Ranking")
    st.markdown("Rank GOLDM, GOLDTEN, GOLDGUINEA, GOLDPETAL for a given gold exposure.")

    df, prov = get_active_data()
    if prov and prov.is_demo_fixture:
        st.info("🎭 Demo Mode — simulated data")

    col1, col2 = st.columns(2)
    with col1:
        target_g = st.number_input("Target Exposure (grams)", min_value=1.0, value=100.0, step=1.0)
        analysis_date = st.date_input("Analysis Date", datetime.date(2024, 10, 1))

    with col2:
        st.markdown("**Current Prices (INR per quote unit)**")
        price_goldm = st.number_input("GOLDM (per 10g)", value=72000.0, step=100.0)
        price_goldten = st.number_input("GOLDTEN (per 10g)", value=73500.0, step=100.0)
        price_goldguinea = st.number_input("GOLDGUINEA (per 8g)", value=58800.0, step=100.0)
        price_goldpetal = st.number_input("GOLDPETAL (per 1g)", value=7350.0, step=10.0)

    col3, col4 = st.columns(2)
    with col3:
        st.markdown("**Volume/OI (liquidity proxy)**")
        vol_goldm = st.number_input("GOLDM OI", value=8000, step=100)
        vol_goldten = st.number_input("GOLDTEN OI", value=10000, step=100)
        vol_goldguinea = st.number_input("GOLDGUINEA OI", value=3000, step=100)
        vol_goldpetal = st.number_input("GOLDPETAL OI", value=5000, step=100)

    with col4:
        st.markdown("**Scoring Weights**")
        w_cost = st.slider("Cost Efficiency", 0.0, 1.0, 0.35)
        w_gran = st.slider("Lot Granularity", 0.0, 1.0, 0.25)
        w_miss = st.slider("Exposure Match", 0.0, 1.0, 0.25)
        w_liq = st.slider("Liquidity", 0.0, 1.0, 0.15)

    if st.button("🏆 Rank Best Vehicle", type="primary"):
        prices = {
            "GOLDM": price_goldm,
            "GOLDTEN": price_goldten,
            "GOLDGUINEA": price_goldguinea,
            "GOLDPETAL": price_goldpetal,
        }
        volumes = {
            "GOLDM": vol_goldm,
            "GOLDTEN": vol_goldten,
            "GOLDGUINEA": vol_goldguinea,
            "GOLDPETAL": vol_goldpetal,
        }
        total_w = w_cost + w_gran + w_miss + w_liq
        weights = {
            "cost": w_cost / total_w if total_w > 0 else 0.25,
            "granularity": w_gran / total_w if total_w > 0 else 0.25,
            "mismatch": w_miss / total_w if total_w > 0 else 0.25,
            "liquidity": w_liq / total_w if total_w > 0 else 0.25,
        }

        rankings = rank_best_vehicle(
            target_exposure_g=target_g,
            price_per_contract=prices,
            volume_oi=volumes,
            as_of=analysis_date,
            weights=weights,
        )
        st.session_state["vehicle_rankings"] = rankings

    rankings = st.session_state.get("vehicle_rankings")
    if rankings:
        st.subheader("Rankings")
        rank_df = pd.DataFrame([r.to_dict() for r in rankings])

        # Highlight top rank
        def highlight_rank(row):
            if row["rank"] == 1 and not row["is_blocked"]:
                return [f"background-color: {GOLD}22"] * len(row)
            if row["is_blocked"]:
                return [f"background-color: {RED}22"] * len(row)
            return [""] * len(row)

        display_cols = ["rank", "contract_code", "trading_unit_g", "purity_fine",
                        "lots_required", "actual_exposure_g", "exposure_mismatch_pct",
                        "estimated_cost_per_lot_inr", "composite_score",
                        "spec_verified", "is_blocked", "block_reason"]
        available_cols = [c for c in display_cols if c in rank_df.columns]
        st.dataframe(
            rank_df[available_cols].style.apply(highlight_rank, axis=1),
            use_container_width=True, hide_index=True
        )

        # Bar chart of composite scores
        scoreable = rank_df[~rank_df["is_blocked"]].copy()
        if not scoreable.empty:
            fig = px.bar(scoreable.sort_values("composite_score", ascending=False),
                         x="contract_code", y="composite_score",
                         title="Composite Score (higher = better)",
                         color="composite_score", color_continuous_scale="Viridis")
            fig.update_layout(template="plotly_dark")
            st.plotly_chart(fig, use_container_width=True)

        # Contract specs for reference
        with st.expander("Contract Specifications"):
            specs = get_all_specs(analysis_date)
            specs_rows = []
            for code, spec in specs.items():
                specs_rows.append({
                    "Contract": spec.contract_code,
                    "Trading Unit (g)": spec.trading_unit_g,
                    "Quote Unit (g)": spec.quote_unit_g,
                    "Purity (fine)": spec.purity_fine,
                    "Lot Size": spec.lot_size,
                    "Status": spec.verification_status.value,
                    "Source Date": spec.source_date,
                })
            st.dataframe(pd.DataFrame(specs_rows), use_container_width=True, hide_index=True)

        # Export
        csv = rank_df.to_csv(index=False)
        st.download_button("📥 Download Rankings CSV", csv, "goldprism_vehicle_rankings.csv", "text/csv")


# ── SECTION 7: Backtest Lab ───────────────────────────────────────────────────
elif section.startswith("7"):
    st.header("7️⃣ Backtest Lab")

    df, prov = get_active_data()
    is_demo = prov.is_demo_fixture if prov else True

    if is_demo:
        st.warning(
            "⚠️ **DEMO DATA** — Backtest results are from SIMULATED data. "
            "The PPT's illustrative values (Sharpe 1.18, hit rate 56.3%, etc.) "
            "are MOCK-UP values and are NOT reproduced here. "
            "Only actual computed results from the loaded dataset are shown."
        )

    if df is None or df.empty:
        st.warning("Load data first.")
        st.stop()

    symbols_in_data = sorted(df["symbol"].unique().tolist()) if "symbol" in df.columns else SUPPORTED_CONTRACTS

    col1, col2 = st.columns(2)
    with col1:
        contract_a = st.selectbox("Leg A", [c for c in SUPPORTED_CONTRACTS if c in symbols_in_data], key="bt_a")
    with col2:
        avail_b = [c for c in SUPPORTED_CONTRACTS if c in symbols_in_data and c != contract_a]
        contract_b = st.selectbox("Leg B", avail_b if avail_b else SUPPORTED_CONTRACTS, key="bt_b")

    col3, col4, col5 = st.columns(3)
    with col3:
        signal_window = st.slider("Signal Window", 5, 60, 20, key="bt_sw")
        zscore_entry = st.slider("Z-Score Entry", 0.5, 3.0, 1.5, step=0.1, key="bt_ze")
    with col4:
        cost_hurdle = st.number_input("Cost Hurdle (INR/g)", value=2.0, step=0.1, key="bt_ch")
        holdout_frac = st.slider("Holdout Fraction", 0.1, 0.4, 0.2, step=0.05, key="bt_hf")
    with col5:
        cost_per_trade = st.number_input("Round-Trip Cost (INR)", value=100.0, step=10.0, key="bt_cp")
        n_bootstrap = st.slider("Bootstrap Samples", 100, 2000, 500, step=100, key="bt_bs")

    if st.button("🚀 Run Backtest", type="primary"):
        with st.spinner("Running walk-forward backtest…"):
            df_a = df[df["symbol"] == contract_a].copy() if "symbol" in df.columns else pd.DataFrame()
            df_b = df[df["symbol"] == contract_b].copy() if "symbol" in df.columns else pd.DataFrame()

            if df_a.empty or df_b.empty:
                st.error("No data for selected contracts.")
                st.stop()

            if "trade_date" in df_a.columns:
                merged = pd.merge(
                    df_a[["trade_date", "settle"]].rename(columns={"settle": "settle_a"}),
                    df_b[["trade_date", "settle"]].rename(columns={"settle": "settle_b"}),
                    on="trade_date", how="inner"
                ).sort_values("trade_date").reset_index(drop=True)

                if len(merged) < 30:
                    st.error("Insufficient data for backtest (need at least 30 dates).")
                    st.stop()

                norm_a = pd.Series([normalize_price_to_999_per_g(contract_a, p) for p in merged["settle_a"]])
                norm_b = pd.Series([normalize_price_to_999_per_g(contract_b, p) for p in merged["settle_b"]])
                net_edges = norm_a - norm_b - 2.5  # subtract simplified cost estimate

                config = BacktestConfig(
                    signal_window=signal_window,
                    zscore_entry=zscore_entry,
                    cost_hurdle_inr_per_g=cost_hurdle,
                    holdout_fraction=holdout_frac,
                    bootstrap_n_samples=n_bootstrap,
                )

                bt = WalkForwardBacktester(config)
                result = bt.run(
                    net_edges=net_edges,
                    prices=merged["settle_a"],
                    dates=merged["trade_date"],
                    dataset_description=f"{contract_a} vs {contract_b} ({prov.source_provider if prov else 'Demo'})",
                    is_genuine_mcx=prov.is_genuine_mcx if prov else False,
                    is_demo=is_demo,
                    cost_per_trade_inr=cost_per_trade,
                )
                st.session_state["backtest_result"] = result

    bt_result = st.session_state.get("backtest_result")
    if bt_result:
        if bt_result.warnings:
            for w in bt_result.warnings:
                st.warning(w)

        # Metrics
        c1, c2, c3, c4, c5 = st.columns(5)
        c1.metric("Trades", bt_result.n_trades)
        c2.metric("Hit Rate", f"{bt_result.hit_rate*100:.1f}%")
        c3.metric("Gross P&L (INR)", f"₹{bt_result.gross_pnl_total_inr:,.2f}")
        c4.metric("Net P&L (INR)", f"₹{bt_result.net_pnl_total_inr:,.2f}")
        c5.metric("Total Fees (INR)", f"₹{bt_result.total_fees_inr:,.2f}")

        c6, c7, c8, c9 = st.columns(4)
        c6.metric("Gross Sharpe", f"{bt_result.gross_sharpe:.4f}")
        c7.metric("Net Sharpe", f"{bt_result.net_sharpe:.4f}")
        c8.metric("Max Drawdown", f"{bt_result.max_drawdown_pct:.2f}%")
        c9.metric("Drawdown Duration", f"{bt_result.max_drawdown_duration_bars} bars")

        # Equity curves
        if bt_result.equity_curve_gross and bt_result.equity_curve_net:
            fig = go.Figure()
            x = list(range(len(bt_result.equity_curve_gross)))
            fig.add_trace(go.Scatter(x=x, y=bt_result.equity_curve_gross, mode="lines",
                                      name="Gross Equity", line=dict(color=GOLD)))
            fig.add_trace(go.Scatter(x=x, y=bt_result.equity_curve_net, mode="lines",
                                      name="Net Equity", line=dict(color=GREEN)))
            fig.add_hline(y=0, line_dash="dash", line_color="gray")
            fig.update_layout(title="Equity Curves (Gross vs Net)", template="plotly_dark", height=350)
            st.plotly_chart(fig, use_container_width=True)

        # Bootstrap confidence intervals
        st.subheader("Bootstrap Confidence Intervals")
        bci_col1, bci_col2 = st.columns(2)
        bci_col1.metric("Net P&L CI (95%)", f"₹{bt_result.net_pnl_ci_low:,.2f} — ₹{bt_result.net_pnl_ci_high:,.2f}")
        bci_col2.metric("Sharpe CI (95%)", f"{bt_result.sharpe_ci_low:.4f} — {bt_result.sharpe_ci_high:.4f}")

        # MDE
        st.subheader("Minimum Detectable Effect (MDE)")
        st.metric("MDE (INR/g)", f"{bt_result.mde_inr_per_g:.4f}")
        st.caption(bt_result.mde_assumptions)

        # Holdout
        st.subheader("Sealed Holdout Results")
        st.info(f"Holdout starts: {bt_result.holdout_start_date} (sealed before signal computation)")
        ho_col1, ho_col2 = st.columns(2)
        ho_col1.metric("Holdout Net P&L", f"₹{bt_result.holdout_net_pnl:,.2f}")
        ho_col2.metric("Holdout Sharpe", f"{bt_result.holdout_sharpe:.4f}")
        if bt_result.holdout_contaminated:
            st.error("🚨 Holdout contamination detected!")
        else:
            st.success("✅ Holdout sealed — not used in tuning")

        # Walk-forward
        if bt_result.walk_forward_results:
            st.subheader("Walk-Forward Splits")
            wf_df = pd.DataFrame(bt_result.walk_forward_results)
            st.dataframe(wf_df, use_container_width=True, hide_index=True)

        # Config hash
        st.caption(f"Config hash: `{bt_result.config_hash}` | Run: {bt_result.run_timestamp}")

        # Export
        st.download_button(
            "📥 Download Backtest Results (JSON)",
            data=json.dumps(bt_result.to_dict(), indent=2, default=str),
            file_name="goldprism_backtest.json",
            mime="application/json",
        )


# ── SECTION 8: Methodology & Reports ─────────────────────────────────────────
elif section.startswith("8"):
    st.header("8️⃣ Methodology & Run Reports")

    tab1, tab2, tab3, tab4 = st.tabs([
        "📐 Methodology",
        "📋 Run Manifest",
        "⚠️ Verification Status",
        "📥 Download Reports",
    ])

    with tab1:
        st.markdown("""
## GoldPrism Methodology

### Data Pipeline
1. **Raw MCX Bhavcopy CSV** — preserved immutably with SHA-256 hash
2. **Validation** — OHLC sanity, price positivity, date parsing, symbol filter
3. **Contract-aware normalization** — price to INR/g of 999-fine gold per spec
4. **Parquet storage** — validated data; DuckDB for analytical queries

### X-Ray Waterfall
```
Raw Spread = price_a_normalized − price_b_normalized
         where price_normalized = (quoted_price / quote_unit_g) × (purity / 999)

Raw Spread = Economic Basis + Expiry/Carry + Settlement Artifact + Gross Residual
Net Edge   = Gross Residual − Transaction Costs

Reconciliation tolerance: |sum_of_components − raw_spread| < 0.01 INR/g
```

**Sign convention:** Positive spread = Leg A priced above Leg B on normalized basis.
**Settlement artifact** is a data quality component — NOT double-counted in transaction costs.

### Transaction Costs (Round-Trip)
| Component | Basis | Source |
|-----------|-------|--------|
| Brokerage | Flat per lot × 2 | Broker schedule |
| Exchange charge | % of trade value × 2 | MCX circular (UNVERIFIED — check current) |
| CTT | 0.01% × sell-side value | Finance Act 2013 |
| SEBI charges | 0.0001% × turnover × 2 | SEBI circular |
| GST | 18% × (brokerage + exchange) × 2 | GST Act |
| Stamp duty | 0.002% × buy-side value | State-specific (UNVERIFIED) |
| Slippage | 2 bps × trade value × 2 | Conservative estimate |

### Verdict Gates
| Gate | Condition |
|------|-----------|
| Data Quality | validation_status ∈ {PASSED, PARTIAL} |
| Spec Verified | All contract specs = VERIFIED |
| Costs Verified | All charge components = VERIFIED |
| Liquidity | Volume ≥ min_volume_contracts |
| Net Edge > 0 | net_edge > 0 (else NO EDGE) |
| Cost Hurdle | net_edge > cost_hurdle_inr_per_g |

**NO EDGE is a valid and legitimate result — never suppressed or decorated.**

### Backtest Anti-Bias Measures
- Signal at bar **t** uses only data from bars ≤ t
- Fill at bar **t+1** (shift-1 structural guarantee)
- Holdout **sealed before** any signal computation
- Stale-data gate blocks trading on stale prices
- Liquidity gate blocks trading on illiquid bars
- Gross vs. net P&L always separated

### Sharpe Ratio Formula
```
Sharpe = (mean_daily_pnl − rf_daily) / std_daily_pnl × √252
rf_daily = annual_rf_rate / 252
```
Risk-free rate: configurable (default 6.5% — verify against current RBI rate).

### Block-Bootstrap CI
Preserves autocorrelation via block-resampling. Block size = 20 bars. 1000 samples. 95% CI.

### MDE
```
MDE = (z_α + z_β) × σ / √n_trades
α=0.05, power=0.80
```
""")

    with tab2:
        st.markdown("### Run Manifest")
        manifest = {
            "terminal": "GoldPrism Research Terminal v0.1.0",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "contract_specs": {},
            "unverified_specs": [],
            "unverified_costs": [],
            "warnings": [],
        }
        specs = get_all_specs()
        for code, spec in specs.items():
            manifest["contract_specs"][code] = {
                "trading_unit_g": spec.trading_unit_g,
                "quote_unit_g": spec.quote_unit_g,
                "purity_fine": spec.purity_fine,
                "verification_status": spec.verification_status.value,
                "effective_from": str(spec.effective_from),
                "source_date": spec.source_date,
            }
            if not spec.is_verified:
                manifest["unverified_specs"].append(code)

        cost_config = CostModelConfig()
        manifest["unverified_costs"] = cost_config.unverified_components()
        manifest["warnings"].append(
            "Exchange charge and stamp duty rates are UNVERIFIED — check current MCX circular and state rules."
        )

        st.json(manifest)
        st.download_button(
            "📥 Download Run Manifest",
            json.dumps(manifest, indent=2),
            "goldprism_run_manifest.json",
            "application/json",
        )

    with tab3:
        st.markdown("### Verification Status")
        st.markdown("#### Contract Specifications")
        specs = get_all_specs()
        for code, spec in specs.items():
            color = GREEN if spec.is_verified else RED
            status = spec.verification_status.value
            st.markdown(
                f"- **{code}**: <span style='color:{color}'>{status}</span> "
                f"| Purity: {spec.purity_fine} | Source: {spec.source_reference} ({spec.source_date})",
                unsafe_allow_html=True
            )

        st.markdown("#### GOLDGUINEA Purity Discrepancy Resolution")
        st.info(
            "An earlier automated test used purity=996 for GOLDGUINEA. "
            "Official MCX contract specification lists 999 fine (24 carat). "
            "This codebase uses 999 as the verified value. "
            "Source: MCX GOLDGUINEA contract specification (verified 2024-10-01). "
            "If you have evidence the spec differs, add a new ContractSpec entry with the correct effective_from date."
        )

        st.markdown("#### Transaction Cost Verification")
        cost_config = CostModelConfig()
        for component in ["brokerage", "exchange_charge", "ctt", "sebi", "gst", "stamp_duty", "slippage"]:
            verified = getattr(cost_config, f"{component}_verified", True)
            color = GREEN if verified else ORANGE
            source = getattr(cost_config, f"{component}_source", "N/A")
            st.markdown(
                f"- **{component}**: <span style='color:{color}'>{'VERIFIED' if verified else 'UNVERIFIED'}</span> — {source}",
                unsafe_allow_html=True
            )

        st.markdown("#### Remaining Items Requiring Verification")
        st.warning(
            "1. Exchange transaction charge rate — check current MCX fee schedule circular\n"
            "2. Stamp duty rate — state-specific, verify for your state\n"
            "3. Carry rate — use actual RBI repo rate, not hardcoded 6.5%\n"
            "4. Expiry dates — use actual MCX contract expiry calendar, not approximate rules\n"
            "5. Lot sizes — verify against current MCX circular (may change)"
        )

    with tab4:
        st.markdown("### Export All Reports")
        df, prov = get_active_data()

        if prov:
            st.download_button(
                "📥 Data Quality Report (JSON)",
                json.dumps(prov.to_dict(), indent=2, default=str),
                "goldprism_data_quality.json",
                "application/json",
            )

        if st.session_state.get("xray_result"):
            st.download_button(
                "📥 X-Ray Calculation Trace (JSON)",
                json.dumps(st.session_state["xray_result"].to_dict(), indent=2, default=str),
                "goldprism_xray_trace.json",
                "application/json",
            )

        if st.session_state.get("signal_df") is not None:
            sig_df = st.session_state["signal_df"]
            st.download_button(
                "📥 Signal Verdicts (CSV)",
                sig_df.to_csv(index=False),
                "goldprism_signal_verdicts.csv",
                "text/csv",
            )

        if st.session_state.get("vehicle_rankings"):
            vr_df = pd.DataFrame([r.to_dict() for r in st.session_state["vehicle_rankings"]])
            st.download_button(
                "📥 Best Vehicle Rankings (CSV)",
                vr_df.to_csv(index=False),
                "goldprism_vehicle_rankings.csv",
                "text/csv",
            )

        if st.session_state.get("backtest_result"):
            st.download_button(
                "📥 Backtest Results (JSON)",
                json.dumps(st.session_state["backtest_result"].to_dict(), indent=2, default=str),
                "goldprism_backtest.json",
                "application/json",
            )

        st.divider()
        st.markdown("**Launch Command:**")
        st.code("streamlit run app.py", language="bash")
        st.markdown("**Setup:**")
        st.code(
            "cd time-series-data-preparation-main\n"
            "pip install -r requirements.txt\n"
            "streamlit run app.py",
            language="bash"
        )
