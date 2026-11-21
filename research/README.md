# GoldPrism Python Research Pipeline — Team ARCEUS

> **Hack in Hills '26 · Track 03: Commodity Derivatives Intelligence**  
> **Authors**: Pawan Singh (Data & Backend Engineering), Manik Khurana (Product Lead · Quant Analytics), Vikas Shukla (Frontend UX & Demo)

## Overview

This directory contains the Python research engine referenced in the GoldPrism architecture (Slide 4 of *Arceus GoldPrism Hack in Hills 26.pdf*).
It handles:
1. **Bhavcopy Ingestion & Integrity Gates**: Ingestion of official MCX daily Bhavcopies with schema checks, date-match gates, and duplicate detection.
2. **Contract Master**: Versioned specifications for `GOLDM`, `GOLDTEN`, `GOLDGUINEA`, and `GOLDPETAL` with verified purity, trading units, and quotation units.
3. **X-Ray Waterfall**: Mathematical spread decomposition into structural basis, expiry carry, settlement artifact, gross residual, transaction costs, and net edge.
4. **Signal & Best Vehicle**: Rolling z-scores, cost hurdle gates, and exposure-matched contract ranking.
5. **Walk-Forward Backtesting**: Signal at $t$, fill at $t+1$, Block Bootstrap confidence intervals, and Minimum Detectable Effect (MDE).
6. **Streamlit Research Dashboard**: Prototyping UI (`app.py`).

## Dependencies

```bash
pip install polars duckdb pyarrow statsmodels streamlit pytest
```

## Running Tests

```bash
python -m pytest test_goldprism.py -v
```

## Running the Streamlit Research Dashboard (Optional Standalone)

```bash
streamlit run app.py
```

The Next.js web application in `../` includes an auditable TypeScript port of this exact engine, enabling zero-configuration deployment to Vercel with no Python runtime requirement in serverless production.

## Supplied daily Bhavcopy snapshot

`data/incoming/BhavCopyDateWise_20112026.csv` is the supplied 20 November 2026
daily snapshot. It is preserved separately from the calibrated historical dataset
and sealed holdout. The Next.js `/research` page reads it through
`/api/goldprism/bhavcopy`, validates the CSV structure and gold-futures OHLC rows,
and shows its trading date, row counts, source-file hash, and contract table.

This file is a daily snapshot, not a streaming or intraday real-time feed. Its
format matches the MCX Bhavcopy layout, but the supplied file is not independently
verified against MCX. Refreshing the page endpoint re-reads the bundled CSV; a newer
market day requires adding a new dated file and explicitly updating the snapshot
path rather than overwriting the historical research data.
