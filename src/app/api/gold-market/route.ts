import type { CoinMarketQuote, GoldMarketSnapshot } from '@/lib/goldprism/gold-market'

export const dynamic = 'force-dynamic'

const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=pax-gold,tether-gold&vs_currencies=usd,inr&include_24hr_change=true'
const SERVER_CACHE_TTL_MS = 20_000

let cachedSnapshot: GoldMarketSnapshot | null = null
let cachedAt = 0
let pendingSnapshot: Promise<GoldMarketSnapshot> | null = null

function isQuote(value: unknown): value is CoinMarketQuote {
  if (!value || typeof value !== 'object') return false
  const quote = value as Record<string, unknown>
  return (
    typeof quote.usd === 'number' &&
    quote.usd > 0 &&
    typeof quote.inr === 'number' &&
    quote.inr > 0 &&
    typeof quote.usd_24h_change === 'number'
  )
}

async function fetchSnapshot(): Promise<GoldMarketSnapshot> {
  const response = await fetch(COINGECKO_URL, {
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) {
    throw new Error(`CoinGecko returned ${response.status}; retrying live prices.`)
  }

  const payload: unknown = await response.json()
  if (!payload || typeof payload !== 'object') {
    throw new Error('CoinGecko returned an invalid price response.')
  }
  const prices = payload as Record<string, unknown>
  const paxg = prices['pax-gold']
  const xaut = prices['tether-gold']
  if (!isQuote(paxg) || !isQuote(xaut)) {
    throw new Error('CoinGecko did not return valid PAXG and XAUT prices.')
  }

  return {
    paxg,
    xaut,
    usdInr: paxg.inr / paxg.usd,
    fetchedAt: new Date().toISOString(),
  }
}

function getSnapshot(): Promise<GoldMarketSnapshot> {
  if (cachedSnapshot && Date.now() - cachedAt < SERVER_CACHE_TTL_MS) {
    return Promise.resolve(cachedSnapshot)
  }
  if (!pendingSnapshot) {
    pendingSnapshot = fetchSnapshot()
      .then((snapshot) => {
        cachedSnapshot = snapshot
        cachedAt = Date.now()
        return snapshot
      })
      .finally(() => {
        pendingSnapshot = null
      })
  }
  return pendingSnapshot
}

export async function GET() {
  try {
    const snapshot = await getSnapshot()
    return Response.json(snapshot, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to fetch live gold prices.'
    return Response.json(
      { error: message },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
