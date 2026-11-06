# GoldPrism Methodology & Quantitative Framework

> **Team ARCEUS · Hack in Hills '26 · Track 03: Commodity Derivatives Intelligence**  
> **Authors**: Pawan Singh (Data & Backend Engineering), Manik Khurana (Product Lead · Quant Analytics), Vikas Shukla (Frontend UX & Demo)

---

## 1. System Architecture & Dual Stack

GoldPrism is structured into two auditable, complementary layers:
- **Production Web Terminal**: Next.js 16 (Turbopack, App Router, React 19, Tailwind CSS) deployed on Vercel with zero runtime Python dependencies in serverless production.
- **Quantitative Research Engine**: Standalone Python pipeline in `/research` (Pandas, PyArrow, PyYAML, Pytest) that ingests raw Bhavcopies, runs walk-forward simulations, and outputs cryptographically audited JSON artifacts to `/results`.

---

## 2. MCX Contract Master & Purity Normalization

MCX Gold contracts differ in trading lot size, quotation units, purity, and expiry windows:

| Contract | Trading Unit | Quote Unit | Purity (Fine) | Expiry Window | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GOLDM** | 100g | 10g | 995 (0.995) | Early Window (3rd–5th) | VERIFIED |
| **GOLDTEN** | 10g | 10g | 999 (0.999) | Month-End (27th–31st) | VERIFIED (Listed Jan 2025) |
| **GOLDGUINEA** | 8g | 8g | 999 (0.999) | Month-End (27th–31st) | VERIFIED (Resolved 996 vs 999) |
| **GOLDPETAL** | 1g | 1g | 999 (0.999) | Month-End (27th–31st) | VERIFIED |

### Purity Normalization Formula
To compare spreads without false purity bias, every quoted price is converted to the INR per gram value of 999-fine gold:

$$\text{Price}_{999} = \left(\frac{\text{Quoted Price}}{\text{Quote Unit (g)}}\right) \times \left(\frac{\text{Purity}}{999.0}\right)$$

### Case Study: GOLDGUINEA Purity Discrepancy Resolution
- **Issue**: Historical sample sheets and unverified third-party tables frequently listed `GOLDGUINEA` (8g contract) as having **996 purity**.
- **Audit Findings**: Official MCX circulars (Circular *MCX/C&S/412/2021* and Contract Specifications Master) mandate delivery of **999 fine purity** bars.
- **Quant Impact**: Treating `GOLDGUINEA` as 996 purity would falsely introduce a phantom basis difference of $\sim 30.0\text{ bps}$ ($1 - 996/999$), generating false arbitrage signals that bleed money upon delivery.
- **Resolution**: GoldPrism's contract master explicitly hardcodes 999 purity, backed by automated unit tests in `tests/goldprism.test.ts`.

---

## 3. X-Ray Waterfall Decomposition

Raw calendar gaps between contracts are broken down into four structural components:

$$\text{Raw Spread} = \text{Structural Basis} + \text{Expiry Carry} + \text{Settlement Artifact} + \text{Gross Residual}$$

1. **Structural Basis**: Accounts for purity differences (e.g. 995 for GOLDM vs 999 for GOLDTEN) and contract quotation multipliers.
2. **Expiry Carry**: Accounts for time-value financing between staggered delivery windows (e.g. GOLDM expiring on the 5th vs GOLDTEN expiring on the 28th), benchmarked against the RBI Repo Rate ($6.50\%$ ACT/365).
3. **Settlement Artifact**: Accounts for thin-volume daily settlement price distortions where the exchange closing algorithm averages non-executable prints.
4. **Gross Residual**: The remaining price differential after removing basis, carry, and settlement artifacts.

### Net Edge & Verdict Engine
$$\text{Net Edge} = \text{Gross Residual} - \text{Paired Round-Trip Transaction Costs}$$

- **`TRADABLE`**: Net Edge $> 5.0\text{ bps}$, 95% bootstrap CI strictly positive, all data integrity gates passed.
- **`WATCH`**: $0 < \text{Net Edge} \le 5.0\text{ bps}$ (edge exists but is below safety threshold).
- **`NO EDGE`**: $\text{Net Edge} \le 0\text{ bps}$ or CI crosses zero. *"The only tool that tells you when NOT to trade, and proves it."*
- **`BLOCKED`**: Data quality gate failure, date mismatch, or contract in tender lockout window.

---

## 4. Statutory Cost Model & Source Documentation

All cost parameters are loaded from `/research/config/costs.yaml`:

| Cost Component | Rate / Schedule | Statutory Source | Verification Date |
| :--- | :--- | :--- | :--- |
| **Brokerage** | ₹30.0 / lot / side | Institutional / Discount Broker Schedule | 2024-10-01 |
| **Commodity Transaction Tax (CTT)** | 0.01% (Sell-side only) | Finance Act 2013 / Section 116 | 2024-10-15 |
| **Exchange Turnover Fee** | 0.0026% (Turnover) | MCX Circular MCX/TRD/312/2024 | 2024-09-01 |
| **Goods & Services Tax (GST)** | 18.0% | CBIC Notification No. 11/2017 - Central Tax | 2024-10-15 |
| **Stamp Duty** | 0.002% (Buy-side only) | Indian Stamp Act (amended w.e.f. July 1, 2020) | 2024-07-01 |
| **SEBI Turnover Fee** | 0.0001% (Turnover) | SEBI (Payment of Fees) Regulations | 2024-08-01 |
| **Execution Slippage** | 2.0 bps base + volume/OI penalty | Empirical MCX orderbook half-spread analysis | 2024-11-01 |
| **Settle Haircut** | 1.5 bps | Non-guaranteed fill haircut against settlement price | 2024-11-01 |

---

## 5. Statistical Rigor Protocol

### 1. Anti-Lookahead Guarantee
- Signal at bar $t$ uses exclusively information available up to market close of bar $t$.
- Eligible fills execute strictly at bar $t+1$.
- Automated unit test `test_lookahead_guard_fails_on_future_peeking` fails if any feature attempts to peek into bar $t+1$.

### 2. Delta-Neutral Spread
- P&L is computed strictly on the held spread legs; macro gold directional drift (gold beta) is hedged out and reported as $0.0$.

### 3. Block Bootstrap Confidence Intervals
- Because daily calendar spread residuals exhibit positive serial autocorrelation (first-order autoregressive decay), standard IID bootstrapping would underestimate uncertainty.
- We use a **Stationary Block Bootstrap with a 10-day block length** over 1,000 resamples.
- **Rule**: If the 95% bootstrap confidence interval crosses zero or is negative, the strategy is strictly forbidden from triggering a `TRADABLE` verdict.

### 4. Minimum Detectable Effect (MDE)
- With sample size $N=292$ trading days, significance level $\alpha=0.05$, and power $1-\beta=0.80$:
  $$\text{MDE} = \frac{(z_{1-\alpha/2} + z_{1-\beta}) \cdot \sigma}{\sqrt{N}} = \frac{2.8016 \cdot \sigma}{\sqrt{N}} = 0.75\text{ bps}$$

### 5. Multiple-Testing Correction
- 6 pairwise spread combinations evaluated across the family.
- **Bonferroni corrected hurdle**: $\text{Hurdle} \times \sqrt{6} = 5.0 \times 2.45 = 12.25\text{ bps}$.
- No pair exceeds the corrected hurdle, confirming that individual positive days are statistical noise.

### 6. Sealed Holdout Partition
- The final 20% of the sample (February 2025 to June 2025) is sealed prior to parameter tuning.
- Configuration is hashed with SHA-256 (`9c8103c61b2b2137`).
- Single evaluation conducted on holdout partition; verified uncontaminated.

---

## 6. Honest Backtest Results & Real-World Findings

*Replacing presentation illustrative mockups with actual pipeline outputs:*

- **Gross Spread Alpha**: $+4.0\text{ bps}$ mean residual.
- **Total Cost Drag**: $-5.2\text{ bps}$ per round trip.
- **Net Actionable Edge**: **$-1.2\text{ bps}$** (95% CI: $[-1.77, -0.71]\text{ bps}$).
- **Final Verdict**: **`NO EDGE`**.
- **Quant Takeaway**: In standard fee regimes, MCX gold calendar spreads do not offer persistent positive net edge after accounting for CTT, brokerage, GST, and top-of-book slippage. The true economic value of GoldPrism is preventing retail capital destruction by proving when **not** to trade.

---

## 7. Known Limitations & Gaps

1. **Volume vs Orderbook Depth**: Bhavcopy records daily trading volume, but not real-time multi-level orderbook depth. A contract with 500 lots of daily volume may still experience significant market impact if a 50-lot market order is executed in off-peak hours.
2. **GOLDTEN History Truncation**: MCX launched the GOLDTEN 10g contract in January 2025. Backtests prior to 2025 cannot include GOLDTEN and are limited to GOLDM, GOLDGUINEA, and GOLDPETAL.
3. **Exchange Web Scraping Restrictions**: Official MCX India web endpoints deploy Akamai bot management (`HTTP 403 Forbidden` on automated curl/requests from cloud IPs). Offline production deployments utilize cryptographic verification of cached daily Bhavcopies.
4. **Lot Granularity Asymmetry**: Small target exposures (e.g. 50g) cannot cleanly split across 100g GOLDM lots, forcing a 100% mismatch penalty unless using GOLDTEN (5 lots) or GOLDPETAL (50 lots).
