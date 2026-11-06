# GoldPrism — Prism That Explains Scattered Gold

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript_5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_4-06B6D4?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Python](https://img.shields.io/badge/Python_Research-3776AB?style=for-the-badge&logo=python&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/Postgres_Prisma-336791?style=for-the-badge&logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-gold?style=for-the-badge)

**Hack in Hills '26 — Track 03: Commodity Derivatives Intelligence**  
**Team ARCEUS**

> *"Separate real economic value from expiry carry, settlement artifacts and transaction costs — then make a disciplined decision."*  
> **Core Positioning:** **“The only tool that tells you when NOT to trade, and proves it.”**

**Architecture in One Line:** The user-facing application is Next.js 16 + React 19; the quantitative research engine is standalone Python in `/research`.

[5-Minute Judge Demo](#-5-minute-judge-demo-100-goldprism) · [The X-Ray Waterfall](#-the-x-ray-waterfall) · [MCX Contract Family](#-mcx-gold-contract-family--specification-master) · [Best Vehicle](#-best-vehicle-selection) · [Methodology & Audit](METHODOLOGY.md) · [Honest Results](#-honest-backtest-results-pipeline-derived) · [Team ARCEUS](#-team-arceus--roles) · [5-Minute Quick Start](#-5-minute-quick-start)

</div>

---

## 🌟 Executive Summary

Raw spreads between MCX Gold contracts are noisy and misleading. Retail and institutional traders frequently mistake structural contract differences, delivery carry, and thin settlement prices for actionable arbitrage, only to bleed capital through transaction costs.

**GoldPrism** is an institutional-grade commodity derivatives research terminal designed by **Team ARCEUS** for **Hack in Hills '26**. It implements an auditable 7-step pipeline that purges structural noise and evaluates only the true residual, net of all statutory fees and market impact.

---

## 👥 Team ARCEUS & Roles

| Member | Role | Core Deliverables |
|---|---|---|
| **Pawan Singh** <br>*(Lead Builder)* | **Data & Backend Engineering** <br>Full-Stack Developer & AI Builder <br>B.Tech CSE, Delhi Technical Campus (DTC), GGSIPU (2028, CGPA 9+) <br>[GitHub](https://github.com/pawan00207) · [LinkedIn](https://linkedin.com/in/pawan-singh-555423322/) | Bhavcopy ingestion & schema validators, DuckDB/Parquet store, contract calendar & delivery guards, complete Next.js transformation, test suite & anti-lookahead pipeline. |
| **Manik Khurana** | **Product Lead · Quant Analytics** | Spread decomposition, signal model, walk-forward backtesting, transaction-cost modeling (`costs.yaml`), Block Bootstrap, MDE and verdict logic. |
| **Vikas Shukla** | **Frontend UX & Demo** | Terminal wireframes, X-Ray waterfall visual hierarchy, best-vehicle ranking alerts, presentation deck & judge demo script. |

---

## 📊 Honest Backtest Results (Pipeline Derived)

In strict adherence to quant integrity, GoldPrism reports real results computed by code from the 18-month calibrated MCX Bhavcopy dataset (`research/data/mcx_bhavcopy_18m_cached.parquet`):

| Metric | Code-Derived Value | Methodology / Provenance |
|---|---|---|
| **Config Hash** | `9c8103c61b2b2137` | SHA-256 frozen configuration hash |
| **Gross Spread Alpha** | **+4.00 bps** | Mean raw residual before statutory drag |
| **Transaction Cost Drag** | **-5.20 bps** | Brokerage ₹30/side + CTT 0.01% + GST 18% + Stamp + Slippage |
| **Mean Net Edge** | **-1.20 bps** | Gold beta excluded (delta-neutral) |
| **Bootstrap 95% CI** | **[-1.77, -0.71] bps** | 10-day block bootstrap (1,000 resamples; preserves autocorrelation) |
| **Minimum Detectable Effect** | **0.75 bps** | N=292 days, power 1-β = 80%, significance α = 0.05 |
| **Sealed Holdout Partition** | **-7,278 INR P&L** | Single evaluation on 21-Feb-2025 to 04-Jun-2025 (Uncontaminated) |
| **Multiple Testing (Bonferroni)**| **12.25 bps hurdle** | 6 pairwise combinations evaluated; zero pairs pass |
| **Final Quantitative Verdict** | **`NO EDGE`** | **Capital preserved: ₹0 lost to churn.** |

*Full mathematical proof, statutory source citations, and limitation notes are documented in [`METHODOLOGY.md`](METHODOLOGY.md).*

---

## ⚡ 5-Minute Judge Demo (100% GoldPrism)

The evaluation flow stays 100% focused on the GoldPrism Commodity Derivatives Terminal:
1. **Step 1: Caught Fault** — Ingests a corrupted Bhavcopy. Immediately catches date mismatches and settlement outliers, triggering `Status: Failed: run blocked`.
2. **Step 2: X-Ray Waterfall** — Decomposes `GOLDTEN` vs `GOLDM`, reconciling basis and carry components within 0.0001 ₹/g.
3. **Step 3: Inaction Verdict** — Proves why a +4.0 bps gross residual eaten by 5.2 bps fees results in `NO EDGE`.
4. **Step 4: Best Vehicle** — Hedging 50g physical exposure: ranks `GOLDTEN` (5 lots = 50g, 0% mismatch) as #1 over `GOLDM` (100% mismatch penalty).

---

## 📐 MCX Gold Contract Family & Specification Master

| Contract | Trading Unit | Quoted Per | Purity | Expiry Window | Status | Verification Note |
|---|---|---|---|---|---|---|
| **GOLDM** | 100 g | 10 g | 995 fine | 3rd–5th | `VERIFIED` | 100g unit; quoted per 10g; early-month expiry |
| **GOLDTEN** | 10 g | 10 g | 999 fine | 27th–31st | `VERIFIED` | 10g unit; quoted per 10g; listed Jan 2025 onwards |
| **GOLDGUINEA** | 8 g | 8 g | 999 fine | 27th–31st | `VERIFIED` | **Discrepancy Resolved**: Earlier test used 996. Official MCX circular confirms 999 fine. |
| **GOLDPETAL** | 1 g | 1 g | 999 fine | 27th–31st | `VERIFIED` | 1g unit; quoted per 1g; retail micro-hedging |

### Fine-Gold Purity Normalization Formula:
$$\text{Price}_{999} = \left(\frac{\text{Quoted Price}}{\text{Quote Unit (g)}}\right) \times \left(\frac{\text{Purity}}{999.0}\right)$$

---

## 🔍 The X-Ray Waterfall

GoldPrism splits every spread into five components and evaluates the net edge:
$$\text{Raw Spread} = \text{Structural Basis} + \text{Expiry Carry} + \text{Settlement Artifact} + \text{Gross Residual}$$
$$\text{Net Edge} = \text{Gross Residual} - \text{Paired Round-Trip Transaction Costs}$$

Mathematical reconciliation is verified at runtime:
$$|\text{Reconciliation Sum} - \text{Raw Spread}| < 0.01\text{ ₹/g}$$

---

## 🛡️ Preserved Base Features

As a robust quant workspace, the terminal preserves existing foundation capabilities alongside GoldPrism:
- **Global Markets Dashboard**: Real-time ticker tape, sector heatmap, portfolio holdings, risk gauges.
- **AI Research Agent**: Server-side ReAct-style agent grounded in the GoldPrism system prompt with deterministic quant fallback.
- **Alpha Zoo**: 456 factors (Qlib158, alpha101, GTJA191, Academic) + MCX Gold spread factors (`GP_PURITY_SPREAD`, `GP_EXPIRY_CARRY`, `GP_GROSS_RESIDUAL`, `GP_NET_EDGE`).
- **Paper Trading Arena**: Virtual capital simulation with market & limit orders.
- **Shadow Account**: Trade journal CSV analyzer with behavioral bias extraction.
- **Multi-Agent Swarm**: 5 presets + preset 6: `GoldPrism Quant Research Desk`.
- **Strategy Builder & Backtester**: 15 strategy blocks + walk-forward validation.

*(Note: Telegram bot alert integration was evaluated as a stretch goal and deliberately omitted to preserve local terminal execution privacy).*

---

## 🚀 5-Minute Quick Start

### 1. Web Application (Next.js 16 + React 19)
```bash
# Clean clone
git clone https://github.com/pawan00207/GoldPrism-Team---ARCEUS.git
cd GoldPrism-Team---ARCEUS

# Install dependencies
npm install

# Run TypeScript unit & acceptance tests (15/15 passed)
npm test

# Launch development server
npm run dev
# Terminal running at http://localhost:3000
```

### 2. Python Research Pipeline (Python 3.11+)
```bash
cd research

# Install research dependencies
pip install -r requirements.txt

# Run Python quantitative test suite (55/55 passed)
python -m pytest test_goldprism.py -v

# Run full walk-forward backtest & generate JSON artifacts
python run_full_backtest.py
```

---

## 📁 Artifacts & Hashes

- `results/manifest.json`: SHA-256 hash `c3d1e859220371039ebcc15bf9e6c5722f5d5836089815f6904979fd14f60082`
- `results/backtest.json`: Walk-forward gross vs net curves and trade logs
- `results/bootstrap.json`: 1,000-sample block bootstrap and MDE thresholds
- `results/holdout.json`: Sealed holdout single evaluation log
- `research/config/costs.yaml`: Statutory rate schedules with official circular citations
- `METHODOLOGY.md`: Unabridged quantitative methodology, assumptions, and known gaps

---

## 📜 License & Attribution

- **GoldPrism Extensions & Architecture**: MIT License © 2026 Pawan Singh & Team ARCEUS (Hack in Hills '26).
- **Preserved Workspace Foundation**: MIT License © 2026.
