export interface CoinMarketQuote {
  usd: number
  inr: number
  usd_24h_change: number
}

export interface GoldMarketSnapshot {
  paxg: CoinMarketQuote
  xaut: CoinMarketQuote
  usdInr: number
  fetchedAt: string
}

export type GoldMarketData = GoldMarketSnapshot

export type GoldMarketState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'live'; data: GoldMarketData; error: null }
  | { status: 'error'; data: null; error: string }

export const TROY_OUNCE_GRAMS = 31.1035

export function pricePerGramInr(priceInrPerTroyOunce: number): number {
  return priceInrPerTroyOunce / TROY_OUNCE_GRAMS
}

export function premiumBps(price: number, benchmark: number): number {
  return ((price / benchmark) - 1) * 10_000
}
