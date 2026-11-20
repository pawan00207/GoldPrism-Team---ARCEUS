/**
 * Real-Time Live Gold & FX Market Parity Feed — GoldPrism
 * ========================================================
 * Aggregates verified external public market feeds in parallel:
 *   1. Spot Gold XAU/USD + USD/INR -> xaus.com/api/v1/spot
 *      (fallbacks: api.gold-api.com and Yahoo Finance / open.er-api.com)
 *   2. COMEX Gold Futures GC=F  -> query1.finance.yahoo.com/v8/finance/chart/GC=F
 *   4. NSE Gold ETF Benchmark   -> query1.finance.yahoo.com/v8/finance/chart/GOLDBEES.NS
 *
 * Computes deterministic Indian Bullion Import Parity (10g pure + contract unit quotes)
 * using explicit statutory duty (6% BCD/AIDC) + IGST (3%) = 1.0918 landed factor,
 * and derives live MCX contract unit parity prices from `contractSpecs`.
 *
 * ZERO random or mock numbers: if upstream feeds fail or time out, returns
 * `status: 'UNAVAILABLE'` with per-feed errors.
 */

import { contractSpecs, ContractSymbol, normalizeContractBySymbol } from './contract-specs';

export const TROY_OZ_TO_GRAMS = 31.1034768;
export const INDIA_CUSTOMS_DUTY_RATE = 0.06; // 6% effective BCD + AIDC on gold dore/bars
export const INDIA_GST_RATE = 0.03; // 3% IGST on gold
export const LANDED_PARITY_MULTIPLIER =
  (1 + INDIA_CUSTOMS_DUTY_RATE) * (1 + INDIA_GST_RATE); // 1.0918

export interface UpstreamQuoteStatus {
  id: 'XAU_USD' | 'COMEX_GCF' | 'USD_INR' | 'GOLDBEES_NS';
  label: string;
  available: boolean;
  price: number | null;
  previousClose: number | null;
  changePct: number | null;
  currency: string;
  source: string;
  asOf: string | null;
  error: string | null;
}

export interface LiveContractQuote {
  symbol: ContractSymbol;
  name: string;
  tradingUnitGrams: number;
  quotedPerGrams: number;
  purity: number;
  anchorBenchmark: 'SPOT_PARITY' | 'FUTURES_PARITY';
  expiryDate: string;
  quotedPrice: number;
  normalized10gPrice: number;
  normalized999PerGram: number;
  rawSpot10gEquivalent: number;
  changePct: number | null;
  source: string;
  asOf: string;
}

export interface LiveFeedResponse {
  status: 'LIVE_PARITY' | 'UNAVAILABLE';
  feedLabel: string;
  disclosure: string;
  asOf: string;
  fetchedAt: string;
  dutyBreakdown: {
    customsDutyPct: number;
    gstPct: number;
    combinedMultiplier: number;
  };
  benchmarks: {
    xauUsd: number | null;
    comexGcUsd: number | null;
    comexBasisUsdPerOz: number | null;
    comexBasisAnnualizedPct: number | null;
    usdInr: number | null;
    goldBeesInr: number | null;
    rawIntlSpot10gInr: number | null;
    landedSpotParity10gInr: number | null;
    landedFuturesParity10gInr: number | null;
  };
  upstream: UpstreamQuoteStatus[];
  contracts: Record<ContractSymbol, LiveContractQuote> | null;
  error: string | null;
  archive?: {
    status: 'saved' | 'already_saved' | 'skipped' | 'unavailable';
    bucketAt?: string;
    message?: string;
  };
}

export interface LiveFeedHistoryRecord {
  bucketAt: string;
  asOf: string;
  status: 'LIVE_PARITY';
  payload: LiveFeedResponse;
}

interface CacheEntry {
  expiresAt: number;
  payload: LiveFeedResponse;
}

let cachedLiveFeed: CacheEntry | null = null;
const CACHE_TTL_MS = 5000;

function computeForwardExpiries(now: Date): { earlyMonth: string; monthEnd: string } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed

  // Next active MCX GOLDM early-month expiry (5th of next month)
  const nearMonthDate = new Date(Date.UTC(year, month + 1, 5));
  // Next active MCX GOLDTEN/GOLDGUINEA/GOLDPETAL month-end expiry (28th of next month)
  const farMonthDate = new Date(Date.UTC(year, month + 1, 28));

  return {
    earlyMonth: nearMonthDate.toISOString().slice(0, 10),
    monthEnd: farMonthDate.toISOString().slice(0, 10),
  };
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 4500): Promise<T> {
  const res = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'User-Agent': 'GoldPrism-MarketTerminal/1.0',
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

interface GoldApiResponse {
  price?: number;
  updatedAt?: string;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        regularMarketTime?: number;
        exchangeName?: string;
      };
    }>;
  };
}

interface OpenErResponse {
  rates?: Record<string, number>;
  time_last_update_utc?: string;
}

interface XausSpotResponse {
  xau?: {
    price?: number;
    currency?: string;
    unit?: string;
  };
  fx_rates?: Record<string, number>;
  price_as_of?: string;
  updated_at?: string;
  stale?: boolean;
  fx_stale?: boolean;
  data_state?: {
    status?: string;
    as_of?: string;
  };
}

const XAUS_MAX_AGE_MS = 5 * 60_000;

export function isQuoteTimestampFresh(value: string | undefined, nowMs: number): value is string {
  if (!value) return false;
  const timestamp = Date.parse(value);
  const ageMs = nowMs - timestamp;
  return Number.isFinite(timestamp) && ageMs >= -60_000 && ageMs <= XAUS_MAX_AGE_MS;
}

function unavailableQuote(
  id: UpstreamQuoteStatus['id'],
  label: string,
  currency: string,
  source: string,
  error: string
): UpstreamQuoteStatus {
  return {
    id,
    label,
    available: false,
    price: null,
    previousClose: null,
    changePct: null,
    currency,
    source,
    asOf: null,
    error,
  };
}

async function fetchXausMarketData(): Promise<{
  xau: UpstreamQuoteStatus;
  usdInr: UpstreamQuoteStatus;
}> {
  const nowMs = Date.now();
  try {
    const data = await fetchJsonWithTimeout<XausSpotResponse>('https://xaus.com/api/v1/spot');
    const xauAsOf = data.price_as_of ?? data.data_state?.as_of ?? data.updated_at;
    const xauPrice = data.xau?.price;
    const xauIsFresh =
      data.stale !== true &&
      data.data_state?.status !== 'stale' &&
      isQuoteTimestampFresh(xauAsOf, nowMs);
    const xau =
      typeof xauPrice === 'number' && Number.isFinite(xauPrice) && xauPrice > 0 && xauIsFresh
        ? {
            id: 'XAU_USD' as const,
            label: 'Spot Gold (XAU/USD)',
            available: true,
            price: Number(xauPrice.toFixed(2)),
            previousClose: null,
            changePct: null,
            currency: `${data.xau?.currency ?? 'USD'}/${data.xau?.unit ?? 'oz'}`,
            source: 'xaus.com',
            asOf: xauAsOf,
            error: null,
          }
        : unavailableQuote(
            'XAU_USD',
            'Spot Gold (XAU/USD)',
            'USD/oz',
            'xaus.com',
            !xauIsFresh ? 'Xaus spot quote is stale or has no valid timestamp' : 'Invalid Xaus spot price'
          );

    const fxUpdatedAt = data.updated_at ?? data.data_state?.as_of;
    const usdInrRate = data.fx_rates?.INR;
    const fxIsFresh =
      data.fx_stale !== true &&
      data.data_state?.status !== 'stale' &&
      isQuoteTimestampFresh(fxUpdatedAt, nowMs);
    const usdInr =
      typeof usdInrRate === 'number' && Number.isFinite(usdInrRate) && usdInrRate > 0 && fxIsFresh
        ? {
            id: 'USD_INR' as const,
            label: 'USD / INR FX',
            available: true,
            price: Number(usdInrRate.toFixed(4)),
            previousClose: null,
            changePct: null,
            currency: 'INR/USD',
            source: 'xaus.com',
            asOf: fxUpdatedAt,
            error: null,
          }
        : unavailableQuote(
            'USD_INR',
            'USD / INR FX',
            'INR/USD',
            'xaus.com',
            !fxIsFresh ? 'Xaus USD/INR quote is stale or has no valid timestamp' : 'Invalid Xaus USD/INR rate'
          );

    return { xau, usdInr };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Xaus market feed failed';
    return {
      xau: unavailableQuote('XAU_USD', 'Spot Gold (XAU/USD)', 'USD/oz', 'xaus.com', message),
      usdInr: unavailableQuote('USD_INR', 'USD / INR FX', 'INR/USD', 'xaus.com', message),
    };
  }
}

async function fetchFallbackXauSpot(): Promise<UpstreamQuoteStatus> {
  try {
    const data = await fetchJsonWithTimeout<GoldApiResponse>('https://api.gold-api.com/price/XAU');
    if (typeof data.price !== 'number' || !Number.isFinite(data.price) || data.price <= 0) {
      throw new Error('Invalid spot price payload');
    }
    if (!isQuoteTimestampFresh(data.updatedAt, Date.now())) throw new Error('Spot provider timestamp is missing or stale');
    return {
      id: 'XAU_USD',
      label: 'Spot Gold (XAU/USD)',
      available: true,
      price: Number(data.price.toFixed(2)),
      previousClose: null,
      changePct: null,
      currency: 'USD/oz',
      source: 'gold-api.com',
      asOf: data.updatedAt,
      error: null,
    };
  } catch (err) {
    return {
      id: 'XAU_USD',
      label: 'Spot Gold (XAU/USD)',
      available: false,
      price: null,
      previousClose: null,
      changePct: null,
      currency: 'USD/oz',
      source: 'gold-api.com',
      asOf: null,
      error: err instanceof Error ? err.message : 'Spot feed failed',
    };
  }
}

async function fetchYahooQuote(
  id: 'COMEX_GCF' | 'USD_INR' | 'GOLDBEES_NS',
  ticker: string,
  label: string,
  currency: string
): Promise<UpstreamQuoteStatus> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      ticker
    )}?interval=1m&range=1d`;
    const data = await fetchJsonWithTimeout<YahooChartResponse>(url);
    const meta = data.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    const prev = meta?.previousClose ?? meta?.chartPreviousClose ?? null;

    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
      throw new Error(`No regularMarketPrice for ${ticker}`);
    }

    const changePct =
      typeof prev === 'number' && prev > 0
        ? Number((((price - prev) / prev) * 100).toFixed(2))
        : null;
    const asOf =
      typeof meta?.regularMarketTime === 'number'
        ? new Date(meta.regularMarketTime * 1000).toISOString()
        : undefined;
    if (!isQuoteTimestampFresh(asOf, Date.now())) throw new Error('Quote timestamp is missing or stale');

    return {
      id,
      label,
      available: true,
      price: Number(price.toFixed(id === 'USD_INR' ? 4 : 2)),
      previousClose: typeof prev === 'number' ? Number(prev.toFixed(2)) : null,
      changePct,
      currency,
      source: `Yahoo Finance (${meta?.exchangeName ?? ticker})`,
      asOf,
      error: null,
    };
  } catch (err) {
    return {
      id,
      label,
      available: false,
      price: null,
      previousClose: null,
      changePct: null,
      currency,
      source: `Yahoo Finance (${ticker})`,
      asOf: null,
      error: err instanceof Error ? err.message : 'Feed unavailable',
    };
  }
}

async function fetchUsdInrWithFallback(): Promise<UpstreamQuoteStatus> {
  const yahoo = await fetchYahooQuote('USD_INR', 'USDINR=X', 'USD / INR FX', 'INR/USD');
  if (yahoo.available && yahoo.price !== null) {
    return yahoo;
  }
  try {
    const er = await fetchJsonWithTimeout<OpenErResponse>('https://open.er-api.com/v6/latest/USD');
    const inrRate = er.rates?.INR;
    if (typeof inrRate !== 'number' || !Number.isFinite(inrRate) || inrRate <= 0) {
      throw new Error('Missing INR rate');
    }
    if (!isQuoteTimestampFresh(er.time_last_update_utc, Date.now())) throw new Error('FX timestamp is missing or stale');
    return {
      id: 'USD_INR',
      label: 'USD / INR FX',
      available: true,
      price: Number(inrRate.toFixed(4)),
      previousClose: null,
      changePct: null,
      currency: 'INR/USD',
      source: 'open.er-api.com',
      asOf: new Date(er.time_last_update_utc).toISOString(),
      error: null,
    };
  } catch (err) {
    return {
      ...yahoo,
      error: `${yahoo.error ?? 'Yahoo failed'}; fallback failed: ${
        err instanceof Error ? err.message : 'unknown'
      }`,
    };
  }
}

export function buildParityContracts(params: {
  xauUsd: number;
  comexGcUsd: number | null;
  usdInr: number;
  xauAsOf: string;
  comexAsOf: string | null;
  comexChangePct: number | null;
  now?: Date;
}): {
  rawIntlSpot10gInr: number;
  landedSpotParity10gInr: number;
  landedFuturesParity10gInr: number;
  comexBasisUsdPerOz: number | null;
  comexBasisAnnualizedPct: number | null;
  contracts: Record<ContractSymbol, LiveContractQuote>;
} {
  const {
    xauUsd,
    comexGcUsd,
    usdInr,
    xauAsOf,
    comexAsOf,
    comexChangePct,
    now = new Date(),
  } = params;

  const rawIntlSpot10gInr = Number(((xauUsd * usdInr) / TROY_OZ_TO_GRAMS * 10).toFixed(2));
  const landedSpotParity10gInr = Number(
    (rawIntlSpot10gInr * LANDED_PARITY_MULTIPLIER).toFixed(2)
  );

  const effectiveFuturesUsd = comexGcUsd ?? xauUsd;
  const rawFutures10gInr = ((effectiveFuturesUsd * usdInr) / TROY_OZ_TO_GRAMS) * 10;
  const landedFuturesParity10gInr = Number(
    (rawFutures10gInr * LANDED_PARITY_MULTIPLIER).toFixed(2)
  );

  const comexBasisUsdPerOz =
    comexGcUsd !== null ? Number((comexGcUsd - xauUsd).toFixed(2)) : null;
  // Approximate active front-month COMEX carry annualized assuming ~30d active roll
  const comexBasisAnnualizedPct =
    comexBasisUsdPerOz !== null && xauUsd > 0
      ? Number(((comexBasisUsdPerOz / xauUsd) * (365 / 30) * 100).toFixed(2))
      : null;

  const expiries = computeForwardExpiries(now);

  const buildOne = (
    symbol: ContractSymbol,
    anchor: 'SPOT_PARITY' | 'FUTURES_PARITY',
    expiryDate: string,
    asOf: string,
    changePct: number | null
  ): LiveContractQuote => {
    const spec = contractSpecs[symbol];
    const base10gPure =
      anchor === 'FUTURES_PARITY' ? landedFuturesParity10gInr : landedSpotParity10gInr;

    // Invert P_10g = (P_q * 10) / (q * p) => P_q = P_10g * (q * p) / 10
    const rawQuoted = (base10gPure * spec.quotedPerGrams * spec.purity) / 10;
    const quotedPrice = Math.round(rawQuoted / spec.tickSizeInr) * spec.tickSizeInr;
    const norm = normalizeContractBySymbol(symbol, quotedPrice);

    return {
      symbol,
      name: spec.name,
      tradingUnitGrams: spec.tradingUnitGrams,
      quotedPerGrams: spec.quotedPerGrams,
      purity: spec.purity,
      anchorBenchmark: anchor,
      expiryDate,
      quotedPrice,
      normalized10gPrice: norm.normalized10gPrice,
      normalized999PerGram: norm.normalized999PerGram,
      rawSpot10gEquivalent: rawIntlSpot10gInr,
      changePct,
      source:
        anchor === 'FUTURES_PARITY'
          ? 'COMEX GC=F + USD/INR Landed Parity'
          : 'XAU/USD Spot + USD/INR Landed Parity',
      asOf,
    };
  };

  const contracts: Record<ContractSymbol, LiveContractQuote> = {
    GOLDM: buildOne('GOLDM', 'SPOT_PARITY', expiries.earlyMonth, xauAsOf, comexChangePct),
    GOLDTEN: buildOne(
      'GOLDTEN',
      'FUTURES_PARITY',
      expiries.monthEnd,
      comexAsOf ?? xauAsOf,
      comexChangePct
    ),
    GOLDGUINEA: buildOne(
      'GOLDGUINEA',
      'FUTURES_PARITY',
      expiries.monthEnd,
      comexAsOf ?? xauAsOf,
      comexChangePct
    ),
    GOLDPETAL: buildOne(
      'GOLDPETAL',
      'SPOT_PARITY',
      expiries.monthEnd,
      xauAsOf,
      comexChangePct
    ),
  };

  return {
    rawIntlSpot10gInr,
    landedSpotParity10gInr,
    landedFuturesParity10gInr,
    comexBasisUsdPerOz,
    comexBasisAnnualizedPct,
    contracts,
  };
}

export async function getLiveGoldFeed(forceRefresh = false): Promise<LiveFeedResponse> {
  const nowMs = Date.now();
  if (!forceRefresh && cachedLiveFeed && cachedLiveFeed.expiresAt > nowMs) {
    return cachedLiveFeed.payload;
  }

  const [xaus, comex, goldbees] = await Promise.all([
    fetchXausMarketData(),
    fetchYahooQuote('COMEX_GCF', 'GC=F', 'COMEX Gold Futures (GC=F)', 'USD/oz'),
    fetchYahooQuote('GOLDBEES_NS', 'GOLDBEES.NS', 'NSE Gold ETF (GOLDBEES.NS)', 'INR/unit'),
  ]);
  const [xau, usdinr] = await Promise.all([
    xaus.xau.available ? xaus.xau : fetchFallbackXauSpot(),
    xaus.usdInr.available ? xaus.usdInr : fetchUsdInrWithFallback(),
  ]);

  const upstream = [xau, comex, usdinr, goldbees];
  const fetchedAt = new Date().toISOString();

  // Need at least XAU or COMEX AND USD/INR to derive real INR bullion parity
  const baseUsdGold = xau.price ?? comex.price;
  if (baseUsdGold === null || usdinr.price === null) {
    const failurePayload: LiveFeedResponse = {
      status: 'UNAVAILABLE',
      feedLabel: 'Live market feeds unreachable',
      disclosure:
        'Upstream real-time spot gold or USD/INR FX feeds failed to respond. GoldPrism refuses to fabricate fallback prices.',
      asOf: fetchedAt,
      fetchedAt,
      dutyBreakdown: {
        customsDutyPct: INDIA_CUSTOMS_DUTY_RATE * 100,
        gstPct: INDIA_GST_RATE * 100,
        combinedMultiplier: Number(LANDED_PARITY_MULTIPLIER.toFixed(4)),
      },
      benchmarks: {
        xauUsd: xau.price,
        comexGcUsd: comex.price,
        comexBasisUsdPerOz: null,
        comexBasisAnnualizedPct: null,
        usdInr: usdinr.price,
        goldBeesInr: goldbees.price,
        rawIntlSpot10gInr: null,
        landedSpotParity10gInr: null,
        landedFuturesParity10gInr: null,
      },
      upstream,
      contracts: null,
      error: upstream
        .filter((u) => !u.available)
        .map((u) => `${u.id}: ${u.error}`)
        .join(' | '),
    };
    return failurePayload;
  }

  const parity = buildParityContracts({
    xauUsd: baseUsdGold,
    comexGcUsd: comex.price,
    usdInr: usdinr.price,
    xauAsOf: xau.asOf ?? comex.asOf ?? fetchedAt,
    comexAsOf: comex.asOf,
    comexChangePct: comex.changePct,
  });

  const latestAsOf = [xau.asOf, comex.asOf, usdinr.asOf]
    .filter((d): d is string => Boolean(d))
    .sort()
    .pop() ?? fetchedAt;

  const payload: LiveFeedResponse = {
    status: 'LIVE_PARITY',
    feedLabel: 'Live Global-to-MCX Parity Feed',
    disclosure:
      'Live XAU/USD Spot, COMEX GC=F Futures & USD/INR FX converted to MCX landed INR parity (6% Customs + 3% GST = 1.0918×). Direct MCX exchange orderbook scraping is blocked externally; paper executions fill at live parity quotes.',
    asOf: latestAsOf,
    fetchedAt,
    dutyBreakdown: {
      customsDutyPct: INDIA_CUSTOMS_DUTY_RATE * 100,
      gstPct: INDIA_GST_RATE * 100,
      combinedMultiplier: Number(LANDED_PARITY_MULTIPLIER.toFixed(4)),
    },
    benchmarks: {
      xauUsd: xau.price,
      comexGcUsd: comex.price,
      comexBasisUsdPerOz: parity.comexBasisUsdPerOz,
      comexBasisAnnualizedPct: parity.comexBasisAnnualizedPct,
      usdInr: usdinr.price,
      goldBeesInr: goldbees.price,
      rawIntlSpot10gInr: parity.rawIntlSpot10gInr,
      landedSpotParity10gInr: parity.landedSpotParity10gInr,
      landedFuturesParity10gInr: parity.landedFuturesParity10gInr,
    },
    upstream,
    contracts: parity.contracts,
    error: null,
  };

  cachedLiveFeed = {
    expiresAt: nowMs + CACHE_TTL_MS,
    payload,
  };

  return payload;
}
