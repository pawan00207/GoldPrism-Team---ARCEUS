# GoldPrism API Documentation

## Live market feed and PostgreSQL archive

### `GET /api/goldprism/live-feed`

Fetches the live global-to-MCX parity feed and archives the first successful
snapshot in each UTC minute to PostgreSQL. Repeated polls in the same minute do
not create duplicate rows. If PostgreSQL is unavailable, the live feed is still
returned and the response's `archive.status` reports `unavailable`.
Snapshots are collected while the live-feed route is being requested; this
implementation does not run a background poller while no clients are active.

Pass `?refresh=1` to force a fresh upstream fetch.

The response includes:

- `archive.status`: `saved`, `already_saved`, `skipped`, or `unavailable`.
- `archive.bucketAt`: the UTC minute used for this snapshot, when applicable.
- `archive.message`: a user-safe explanation when archival is unavailable or
  skipped.

An unavailable external market feed is not stored as a market-price snapshot.

### `GET /api/goldprism/live-history?limit=60`

Returns the most recent archived market snapshots, newest first. `limit` must be
an integer from 1 to 500. A successful response has `status: "CONNECTED"`;
database configuration or connectivity problems return HTTP 503 with
`status: "UNAVAILABLE"`. Invalid limits return HTTP 400.

## Research and backtest endpoints

### `POST /api/agent`

Accepts `{ "messages": [{ "role": "user", "content": "..." }] }` and returns
a deterministic answer from the versioned historical Bhavcopy tools. The
response includes `engine` and `source`; results are historical and are not
presented as live MCX quotes.

### `POST /api/analyze-trades`

Accepts a `trades` array with `date`, `symbol`, `side`, `qty`, `price`, and
`pnl`; `holdingDays` is optional. The endpoint validates at most 1,000 rows
and calculates descriptive realized-P&L statistics. It does not infer
behavioral biases or extract trading rules from fields that do not contain
that evidence. Invalid rows return HTTP 400.

### `POST /api/backtest`

Accepts `{ "pair": "GOLDM_CALENDAR", "initialCapitalInr": 1000000 }`.
Supported pairs are `GOLDM_CALENDAR`, `GOLDTEN_GOLDM`,
`GOLDGUINEA_GOLDM`, and `GOLDPETAL_GOLDM`. Results use the audited,
point-in-time GoldPrism edge-gated historical replay; generic indicator blocks
are not applied. The response includes source provenance, training/holdout
boundaries, replay metrics, and monthly equity data. Individual fills are not
exposed by the summary engine.

### `POST /api/goldprism/swarm`

Runs the deterministic seven-stage research pipeline against the latest
bundled Bhavcopy snapshot and returns stage outputs, replay evidence, and data
provenance. It is not a generative-agent debate, live exchange feed, or broker
execution path.

### `GET /api`

Returns application health and non-secret configuration status for the
historical archive, Firestore, and PostgreSQL. `configured` indicates that
required environment variables are present; it does not prove remote database
connectivity.

## Database setup

Paper-trading workspace synchronization remains on Firebase Firestore, which
provides the existing realtime listeners. PostgreSQL stores the shared,
minute-bucketed live market archive; it is not used as a realtime push channel.
Signed-in paper-trading workspaces sync through Firestore; unsigned guest
portfolios are stored in that browser's local storage only.
The dashboard chart and report export read this PostgreSQL archive. Research
replay and backtests remain historical analyses of the versioned Bhavcopy
dataset; they do not represent live exchange ticks. Trade-copilot Gemini
responses require a server-side `GEMINI_API_KEY`; deterministic mode is
available without it.

Set a rotated PostgreSQL connection string as `DATABASE_URL` in the local,
git-ignored `.env.local` file. Never commit `.env.local` or paste credentials
into chat. Restart the Next.js server after changing environment variables.

The migration creates only the additive `market_snapshots` table and indexes.
Once `DATABASE_URL` is configured, apply the schema and generate the client:

```powershell
npm run db:generate
$entry = Get-Content .env.local | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
if (-not $entry) { throw 'DATABASE_URL is missing from .env.local' }
$env:DATABASE_URL = ($entry -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'")
npx prisma migrate deploy
```

This command reads the connection string from the local file without printing
it. URL-encode special characters in the username or password as required by a
PostgreSQL connection URI.
