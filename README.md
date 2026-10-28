# GoldPrism — Prism That Explains Scattered Gold

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript_5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_4-06B6D4?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Python](https://img.shields.io/badge/Python_Research-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel_Ready-000000?style=for-the-badge&logo=vercel&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-gold?style=for-the-badge)

**Hack in Hills '26 — Track 03: Commodity Derivatives Intelligence**  
**Team ARCEUS**

> *"Separate real economic value from expiry carry, settlement artifacts and transaction costs — then make a disciplined decision."*  
> **Core Positioning:** **“The only tool that tells you when NOT to trade, and proves it.”**

[5-Minute Judge Demo](#-5-minute-judge-demo) · [The X-Ray Waterfall](#-the-x-ray-waterfall) · [MCX Contract Family](#-mcx-gold-contract-family) · [Best Vehicle](#-best-vehicle-selection) · [Preserved Workspace](#-preserved-workspace-capabilities) · [Team ARCEUS](#-team-arceus) · [Deployment](#-quick-start--deployment)

</div>

---

## 🌟 Executive Summary

Raw spreads between MCX Gold contracts are noisy and misleading. Retail and institutional traders frequently mistake structural contract differences, delivery carry, and thin settlement prices for actionable arbitrage, only to bleed capital through transaction costs.

**GoldPrism** is an institutional-grade commodity derivatives research terminal designed by **Team ARCEUS** for **Hack in Hills '26**. It implements an auditable 5-step pipeline that purges structural noise and judges only the true residual, net of all statutory and broker fees.

---

## 👥 Team ARCEUS & Leadership

| Member | Role | Key Responsibilities |
|---|---|---|
| **Pawan Singh** <br>*(Lead Builder)* | **Data & Backend Engineering** <br>Full-Stack Developer & AI Builder <br>B.Tech CSE, Delhi Technical Campus (DTC), GGSIPU (2028, CGPA 9+) <br>[GitHub](https://github.com/pawan00207) · [LinkedIn](https://linkedin.com/in/pawan-singh-555423322/) | Bhavcopy ingestion & schema validators, DuckDB/Parquet store, contract calendar, complete Next.js transformation, test suite & zero-lookahead pipeline. |
| **Manik Khurana** | **Product Lead · Quant Analytics** | Spread decomposition, signal model, walk-forward backtesting, transaction-cost modeling, Block Bootstrap, MDE and verdict logic. |
| **Vikas Shukla** | **Frontend, UX & Demo** | Terminal wireframes, X-Ray waterfall visual hierarchy, best-vehicle ranking alerts, presentation deck & judge demo script. |

### Other Notable Projects by Pawan Singh:
- **MediVerse.AI**: AI clinical decision support and patient triage system.
- **Swasth-Saathi**: Multilingual preventative healthcare intelligence platform.
- **TrafficGuard Pro**: Computer vision traffic density analysis and emergency routing.
- **ResQMap**: Real-time disaster relief routing and resource management.

---

## 🔬 The 5 Sources of Noise in MCX Gold Spreads

1. **Purity Differences**: `GOLDM` is 995 fine (22k equivalent); `GOLDTEN`, `GOLDGUINEA`, and `GOLDPETAL` are 999 fine (24k).
2. **Contract Size Granularity**: Lot sizes range from 1g (`GOLDPETAL`) to 100g (`GOLDM`), quoted per 1g, 8g, or 10g.
3. **Expiry Windows & Carry**: `GOLDM` expires early (3rd–5th of delivery month); the other three expire month-end (27th–31st), creating asymmetric cost-of-carry.
4. **Settlement Artifacts**: Official MCX daily settlement prices in thin contracts are not guaranteed fills.
5. **Transaction Costs**: Brokerage (₹30/lot/side), CTT (0.01% on sell side), GST (18%), exchange turnover fees (0.0026%), stamp duty (0.002% buy side), and execution slippage.

---

## 📐 MCX Gold Contract Family & Specification Master

| Contract | Trading Unit | Quoted Per | Purity | Expiry Window | Status | Verification Note |
|---|---|---|---|---|---|---|
| **GOLDM** | 100 g | 10 g | 995 fine | 3rd–5th | `VERIFIED` | 100g unit; quoted per 10g; early-month expiry |
| **GOLDTEN** | 10 g | 10 g | 999 fine | 27th–31st | `VERIFIED` | 10g unit; quoted per 10g; month-end expiry |
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

### The 4 Disciplined Verdicts:
- **`TRADABLE`**: Residual is statistically meaningful ($\text{Net Edge} > 5.0\text{ bps}$ hurdle) with verified clean data.
- **`WATCH`**: Residual is thin ($0 < \text{Net Edge} \le 5.0\text{ bps}$). Proceed with extreme caution.
- **`NO EDGE`**: Residual is noise ($\text{Net Edge} \le 0$). **No trade. Capital preserved.**
- **`BLOCKED`**: Data failed integrity gates (date mismatch, stale settle, or unverified spec).

---

## ⚡ 5-Minute Judge Demo

Follow the interactive 4-step wizard directly in the application:
1. **Step 1: Caught Fault** — Ingests a seeded corrupted Bhavcopy. Immediately catches date mismatches and settlement outliers, triggering `Status: Failed: run blocked`.
2. **Step 2: X-Ray Waterfall** — Decomposes `GOLDTEN` vs `GOLDM` cleanly, reconciling all basis and carry components within 0.0001 ₹/g.
3. **Step 3: Inaction Verdict** — Demonstrates a pair with +4.0 bps gross residual eaten by 5.2 bps transaction costs $\rightarrow$ **`NO EDGE`**. Proves when NOT to trade!
4. **Step 4: Best Vehicle** — Selects 50g physical gold exposure. Shows why `GOLDTEN` (5 lots = 50g, 0% mismatch) wins over `GOLDM` (100% mismatch penalty).

---

## 🛡️ Preserved Workspace Capabilities

In strict accordance with the non-destructive transformation rule, **all original VibeTrading features remain 100% operational**:
- **Global Markets Dashboard**: Real-time ticker tape, sector heatmap, portfolio holdings, risk gauges, news sentiment.
- **AI Research Agent**: ReAct-style chat enhanced with GoldPrism commodity intelligence.
- **Alpha Zoo**: All 456 original factors (Qlib158, alpha101, GTJA191, Academic) **plus** dedicated MCX Gold Spread factors (`GP_PURITY_SPREAD`, `GP_EXPIRY_CARRY`, `GP_GROSS_RESIDUAL`, `GP_NET_EDGE`).
- **Paper Trading Arena**: Virtual capital simulation with market & limit orders.
- **Shadow Account**: Broker trade journal CSV analyzer with behavioral bias extraction.
- **Multi-Agent Swarm**: All 5 original presets **plus** preset 6: `GoldPrism Quant Research Desk`.
- **Strategy Builder & Backtester**: All 15 strategy blocks + walk-forward validation.

---

## 🚀 Quick Start & Deployment

### Local Development
```bash
# Clone the repository
git clone https://github.com/pawan00207/GoldPrism-Team---ARCEUS.git
cd GoldPrism-Team---ARCEUS

# Install dependencies
npm install

# Run TypeScript acceptance tests
npm test

# Run Next.js live server
npm run dev
# Open http://localhost:3000
```

### Python Research Pipeline (Standalone)
```bash
cd research
pip install polars duckdb pyarrow statsmodels streamlit pytest
python -m pytest test_goldprism.py -v
```

### Vercel Deployment Instructions
1. Push to your GitHub repository: `https://github.com/pawan00207/GoldPrism-Team---ARCEUS`.
2. Import project into [Vercel](https://vercel.com).
3. **Zero Required Secrets Mode**: GoldPrism is completely self-contained. It renders all research modules, charts, backtests, and judge demos without any external API keys!
4. *(Optional)* To enable live cloud LLM reasoning with Z.ai GLM, set in **Project Settings $\rightarrow$ Environment Variables**:
   - `ZAI_API_KEY`: `your_key_here`
   - `ZAI_BASE_URL`: `https://api.z.ai/api/paas/v4`
5. Click **Deploy**.

---

## 📜 License & Attribution

- **GoldPrism Extensions & Architecture**: MIT License © 2026 Pawan Singh & Team ARCEUS (Hack in Hills '26).
- **Preserved Workspace Foundation**: MIT License © 2026 KeshavCracks / HKUDS.
