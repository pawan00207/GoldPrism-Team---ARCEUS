# GoldPrism: Problem, What Exists, and What Could Come Next

## Problem statement

MCX gold contracts can have different lot sizes, quotation units, purities, and
expiry dates. A raw price gap between two contracts can therefore look like an
opportunity even when it is mostly explained by structural basis, expiry carry,
settlement-price noise, or trading costs.

GoldPrism is a research and decision-support project that makes those
components visible, checks data quality, estimates costs, and helps explain
when the evidence does **not** justify a trade. It is not a live trading or
profit-guarantee system.

## What is built

### GoldPrism web experience

- A Next.js single-page terminal with a judge-demo walkthrough and dedicated
  sections for the X-Ray waterfall, data health, contract specifications,
  vehicle selection, backtesting, term structure, expiry lifecycle, trader
  intelligence, methodology, reports, and the team.
- An interactive X-Ray calculator that normalizes contract quotes, decomposes
  spread components, estimates round-trip costs, and presents a verdict.
- CSV ingestion and integrity checks, including visible rejected-row reasons
  and a seeded fault demonstration.
- Contract purity normalization and exposure-based vehicle ranking.
- Research/backtest visualizations and report/export UI.
- A deterministic historical research pipeline and fixed GoldPrism replay
  endpoint for supported MCX spread pairs.
- A trade-journal endpoint that validates CSV-derived rows and reports only
  measurable P&L and holding-period statistics.
- Reference-only factor formula catalog; displayed performance statistics are
  not locally validated or presented as live results.
- Paper-trading persistence uses Firestore for authenticated users when
  configured; unauthenticated guest portfolios remain browser-local.

### Research and calculation code

- A TypeScript quantitative engine under `src/lib/goldprism/` for contract
  specifications, normalization, costs, waterfall reconciliation, data gates,
  signals, and vehicle selection.
- A separate Python research pipeline under `research/` for MCX-style data
  processing, integrity validation, quantitative analysis, and walk-forward
  backtesting. It writes reproducible research artifacts under `results/`.
- Versioned example cost assumptions, manifests, sample data, and documented
  methodology.

### API and current operating limits

- The `/api/goldprism/live-feed` route archives at most one successful global
  market-parity snapshot per UTC minute in PostgreSQL. The
  `/api/goldprism/live-history` route reads that archive. These routes require
  the additive Prisma migration and a server-side `DATABASE_URL`; an unavailable
  database is reported in the archive status and does not fabricate prices.
- Authenticated paper-trading workspaces continue to use Firebase Firestore
  listeners for realtime trade and portfolio synchronization.
- The main dashboard charts persisted XAU/USD and COMEX benchmark snapshots
  from PostgreSQL; its contract-sized values are indicative parity estimates,
  not direct MCX exchange quotes.
- `POST /api/agent`: quantitative assistant, with deterministic responses when
  no Z.AI key is configured.
- `POST /api/backtest`: strategy report endpoint, with a deterministic demo
  response when no Z.AI key is configured.
- `POST /api/analyze-trades`: trade-journal analysis endpoint, with a
  deterministic demo response when no Z.AI key is configured.
- The standalone Python pipeline is not currently called by these web routes.
  The web experience includes demo/sample values; it is not connected to a
  live MCX feed, broker, or order-routing system.
- PostgreSQL stores shared live market snapshot history, not user accounts,
  uploads, reports, or broker order routing.

## Additional work already present

These are capabilities beyond the core MCX spread-analysis problem:

- General market and portfolio-style dashboard views.
- A factor zoo and broader quantitative strategy-building tools.
- Paper-trading workflows and trade-journal behavior summaries.
- A multi-agent research UI and configurable Z.AI-backed responses.
- Reproducible backtest outputs, manifests, and methodology documentation.

## Useful next additions

These are proposals, not claims about existing functionality. A sensible
implementation order is:

1. **Production data ingestion** — connect a permitted MCX data source; retain
   source, retrieval time, trading date, and file hash for every dataset.
2. **Research-to-web integration** — expose the Python pipeline through a
   controlled background job or service, or publish versioned outputs consumed
   by the web app. Keep the current deterministic demo mode explicit.
3. **Persistent data and access control** — add database migrations, user
   authentication, upload ownership, and retention rules before storing user
   data.
4. **Stronger verification** — add browser-level tests for uploads, calculator
   interactions, API error states, keyboard accessibility, and narrow-screen
   layouts; run them in CI.
5. **Research audit improvements** — make assumptions and data provenance
   visible beside each result; add independent datasets, sensitivity checks,
   and versioned backtest configurations before drawing stronger conclusions.
6. **Operations and reporting** — add structured logs, health checks, report
   downloads, and deployment monitoring.

## Verification snapshot

At commit `9ac8d5a`, the production build completed successfully, the
TypeScript acceptance suite reported 15 passing tests, and the Python suite
reported 55 passing tests. See [CHANGE_METRICS.md](./CHANGE_METRICS.md) for the
repository and commit-count snapshot.
