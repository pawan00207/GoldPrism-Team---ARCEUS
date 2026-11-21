import 'server-only';

import {
  contractSpecs,
  ContractSymbol,
  normalizeContractBySymbol,
} from '@/lib/goldprism/contract-specs';
import { readTinyFishAgentStream } from '@/lib/goldprism/tinyfish-agent';

const SEARCH_URL = 'https://api.search.tinyfish.ai';
const FETCH_URL = 'https://api.fetch.tinyfish.ai';
const AGENT_URL = 'https://agent.tinyfish.ai/v1/automation/run-sse';
const WALLET_URL = 'https://agent.tinyfish.ai/v1/wallet';
const MARKET_WATCH_URL = 'https://www.mcxindia.com/market-data/market-watch';
const CACHE_TTL_MS = 60_000;
const MAX_RETRIES = 2;

type JsonRecord = Record<string, unknown>;

interface CacheEntry {
  expiresAt: number;
  value: JsonRecord;
}

interface TinyFishErrorShape extends Error {
  statusCode?: number;
}

const responseCache = new Map<string, CacheEntry>();

export interface TinyFishHealth {
  status: 'HEALTHY' | 'UNAVAILABLE';
  configured: boolean;
  healthy: boolean;
  walletAvailable: boolean;
  message: string;
}

export interface TinyFishMarketQuote {
  symbol: ContractSymbol;
  expiryDate: string;
  quotedPrice: number;
  pricePerGramFineGold: number;
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  fetchedAtIst: string;
  freshness: 'Quote time unverified' | 'Delayed' | 'Stale';
}

export interface TinyFishHeadline {
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
  snippet: string;
  fetchedAt: string;
  fetchedAtIst: string;
  freshness: 'Live <5 min' | 'Delayed' | 'Stale';
}

export interface TinyFishMarketResult {
  status: 'AVAILABLE' | 'UNAVAILABLE';
  source: string;
  fetchedAt: string | null;
  fetchedAtIst: string | null;
  freshness: 'Quote time unverified' | 'Delayed' | 'Stale' | null;
  quotes: TinyFishMarketQuote[];
  message: string | null;
}

export interface TinyFishContextResult {
  status: 'AVAILABLE' | 'UNAVAILABLE';
  source: string;
  fetchedAt: string | null;
  fetchedAtIst: string | null;
  headlines: TinyFishHeadline[];
  message: string | null;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function apiKey(): string {
  const key = process.env.TINYFISH_API_KEY?.trim();
  if (!key) throw new Error('TinyFish is not configured.');
  return key;
}

function cacheKey(operation: string, value: unknown): string {
  return `${operation}:${JSON.stringify(value)}`;
}

function readCache(key: string): JsonRecord | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache(key: string, value: JsonRecord): void {
  responseCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

async function requestJson(
  operation: string,
  url: string,
  init: RequestInit,
  options: { cacheValue?: unknown; timeoutMs?: number; retries?: number } = {}
): Promise<JsonRecord> {
  const key = apiKey();
  const { cacheValue, timeoutMs = 30_000, retries = MAX_RETRIES } = options;
  const maxRetries = Math.max(0, retries);
  const keyForCache = cacheValue === undefined ? null : cacheKey(operation, cacheValue);
  if (keyForCache) {
    const cached = readCache(keyForCache);
    if (cached) return cached;
  }

  let statusCode: number | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        cache: 'no-store',
        headers: requestHeaders(init.headers, key),
        signal: controller.signal,
      });
      statusCode = response.status;
      if (!response.ok) {
        if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
          await wait(attempt);
          continue;
        }
        console.warn('TinyFish request returned an error', {
          operation,
          statusCode: response.status,
        });
        const error = new Error(`TinyFish ${operation} request failed.`) as TinyFishErrorShape;
        error.statusCode = response.status;
        throw error;
      }

      const payload: unknown = await response.json();
      if (!isRecord(payload)) throw new Error('TinyFish returned a non-object JSON response.');
      if (keyForCache) writeCache(keyForCache, payload);
      return payload;
    } catch (error) {
      const status = isRecord(error) && typeof error.statusCode === 'number'
        ? error.statusCode
        : statusCode;
      if (status !== undefined && status !== 429 && status < 500) throw error;
      if (attempt < maxRetries) {
        await wait(attempt);
        continue;
      }
      console.warn('TinyFish request failed', {
        operation,
        statusCode: status,
        failure: error instanceof Error ? error.name : 'UnknownError',
      });
      throw new Error(`TinyFish ${operation} request is unavailable.`);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`TinyFish ${operation} request failed after retries.`);
}

function requestHeaders(initial: HeadersInit | undefined, key: string): Headers {
  const headers = new Headers(initial);
  headers.set('X-API-Key', key);
  return headers;
}

function wait(attempt: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
}

export async function tinyFishSearch(
  query: string,
  params: Record<string, string | number>
): Promise<JsonRecord> {
  const searchParams = new URLSearchParams({ query });
  for (const [name, value] of Object.entries(params)) {
    searchParams.set(name, String(value));
  }
  const url = `${SEARCH_URL}?${searchParams.toString()}`;
  return requestJson(
    'search',
    url,
    { method: 'GET' },
    { cacheValue: { query, params }, timeoutMs: 10_000, retries: 1 }
  );
}

export async function tinyFishFetch(urls: string[], purpose: string): Promise<JsonRecord> {
  return requestJson(
    'fetch',
    FETCH_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        urls,
        format: 'markdown',
        ttl: 0,
        per_url_timeout_ms: 60_000,
        purpose,
      }),
    },
    { cacheValue: { urls, purpose }, timeoutMs: 12_000, retries: 1 }
  );
}

export async function tinyFishRunAgent(
  url: string,
  goal: string,
  outputSchema: JsonRecord
): Promise<JsonRecord> {
  const key = apiKey();
  const keyForCache = cacheKey('agent', { url, goal, outputSchema });
  const cached = readCache(keyForCache);
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  try {
    const response = await fetch(AGENT_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'X-API-Key': key,
      },
      body: JSON.stringify({
        url,
        goal,
        output_schema: outputSchema,
        agent_config: { max_duration_seconds: 45 },
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`TinyFish Agent returned HTTP ${response.status}.`);
    }
    if (!response.body) throw new Error('TinyFish Agent did not return an event stream.');

    const result = await readTinyFishAgentStream(response.body);
    writeCache(keyForCache, result);
    return result;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('TinyFish Agent request timed out.');
    }
    if (error instanceof Error) throw error;
    throw new Error('TinyFish Agent request failed.');
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkTinyFishHealth(): Promise<TinyFishHealth> {
  if (!process.env.TINYFISH_API_KEY?.trim()) {
    return {
      status: 'UNAVAILABLE',
      configured: false,
      healthy: false,
      walletAvailable: false,
      message: 'TINYFISH_API_KEY is not configured.',
    };
  }

  try {
    await requestJson(
      'health',
      WALLET_URL,
      { method: 'GET' },
      { cacheValue: { wallet: true }, timeoutMs: 4_000, retries: 0 }
    );
    return {
      status: 'HEALTHY',
      configured: true,
      healthy: true,
      walletAvailable: true,
      message: 'TinyFish API and wallet endpoint are reachable.',
    };
  } catch (error) {
    const statusCode =
      typeof error === 'object' && error !== null && 'statusCode' in error
        ? (error as TinyFishErrorShape).statusCode
        : undefined;
    if (statusCode === 404) {
      return {
        status: 'HEALTHY',
        configured: true,
        healthy: true,
        walletAvailable: false,
        message: 'TinyFish is reachable; wallet details are not available for this account.',
      };
    }
    return {
      status: 'UNAVAILABLE',
      configured: true,
      healthy: false,
      walletAvailable: false,
      message: 'TinyFish health check failed.',
    };
  }
}

const AGENT_MARKET_SCHEMA: JsonRecord = {
  type: 'object',
  properties: {
    quotes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string', enum: Object.keys(contractSpecs) },
          expiry_date: { type: 'string' },
          ltp: { type: 'number', minimum: 0 },
        },
        required: ['symbol', 'expiry_date', 'ltp'],
      },
    },
  },
  required: ['quotes'],
};

let marketCache: { expiresAt: number; value: TinyFishMarketResult } | null = null;
let contextCache: { expiresAt: number; value: TinyFishContextResult } | null = null;

export async function getTinyFishMarketWatch(): Promise<TinyFishMarketResult> {
  if (marketCache && marketCache.expiresAt > Date.now()) return marketCache.value;
  if (!process.env.TINYFISH_API_KEY?.trim()) {
    const value = unavailableMarket(
      'TINYFISH_API_KEY is not configured; live MCX Market Watch is disabled.'
    );
    marketCache = { expiresAt: Date.now() + CACHE_TTL_MS, value };
    return value;
  }

  try {
    let rows: ParsedQuote[] = [];
    let fetchFailure: string | null = null;
    try {
      const fetched = await tinyFishFetch(
        [MARKET_WATCH_URL],
        'Read indicative live quotes for the MCX gold contract family.'
      );
      rows = parseMarketTable(fetched);
    } catch (error) {
      fetchFailure = error instanceof Error ? error.message : 'TinyFish Fetch failed.';
    }

    if (rows.length < Object.keys(contractSpecs).length) {
      try {
        const result = await tinyFishRunAgent(
          MARKET_WATCH_URL,
          'Read the live MCX Market Watch page. If the quotes are loaded interactively, use the page controls. Return only actual current LTP values and expiry dates shown for GOLDM, GOLDTEN, GOLDGUINEA, and GOLDPETAL. Do not use previous close, settlement, estimates, or inferred prices. Omit a contract if no current LTP is available.',
          AGENT_MARKET_SCHEMA
        );
        rows = [...parseAgentQuotes(result), ...rows];
      } catch (agentError) {
        if (rows.length === 0) {
          const agentMessage =
            agentError instanceof Error ? agentError.message : 'TinyFish Agent failed.';
          throw new Error(
            fetchFailure
              ? `${fetchFailure} Agent fallback failed: ${agentMessage}`
              : agentMessage
          );
        }
      }
    }

    const fetchedAt = new Date().toISOString();
    const quotes = selectNearestQuotes(rows).map((row) => {
      const symbol = row.symbol as ContractSymbol;
      const normalized = normalizeContractBySymbol(symbol, row.quotedPrice);
      return {
        symbol,
        expiryDate: row.expiryDate,
        quotedPrice: row.quotedPrice,
        pricePerGramFineGold: normalized.pricePerPureGram,
        source: 'MCX India Market Watch via TinyFish Fetch/Agent',
        sourceUrl: MARKET_WATCH_URL,
        fetchedAt,
        fetchedAtIst: formatIst(fetchedAt),
        freshness: 'Quote time unverified' as const,
      };
    });
    const value: TinyFishMarketResult =
      quotes.length > 0
        ? {
            status: 'AVAILABLE',
            source: 'MCX India Market Watch via TinyFish',
            fetchedAt,
            fetchedAtIst: formatIst(fetchedAt),
            freshness: 'Quote time unverified',
            quotes,
            message: null,
          }
        : unavailableMarket('MCX Market Watch returned no verifiable current gold quotes.');
    marketCache = { expiresAt: Date.now() + CACHE_TTL_MS, value };
    return value;
  } catch (error) {
    return unavailableMarket(
      error instanceof Error ? error.message : 'TinyFish market data is unavailable.'
    );
  }
}

export async function getTinyFishMarketContext(): Promise<TinyFishContextResult> {
  if (contextCache && contextCache.expiresAt > Date.now()) return contextCache.value;

  try {
    const response = await tinyFishSearch(
      'gold RBI Fed USD-INR India import duty',
      {
        domain_type: 'news',
        recency_minutes: 1440,
        location: 'IN',
        language: 'en',
      }
    );
    const responseResults = Array.isArray(response.results) ? response.results : [];
    const fetchedAt = new Date().toISOString();
    const headlines = responseResults
      .filter(isRecord)
      .map((item) => {
        const url = typeof item.url === 'string' ? item.url : '';
        const title = typeof item.title === 'string' ? item.title.trim() : '';
        if (!isHttpUrl(url) || !title) return null;
        const source =
          typeof item.publisher === 'string' && item.publisher.trim()
            ? item.publisher.trim()
            : typeof item.site_name === 'string' && item.site_name.trim()
              ? item.site_name.trim()
              : new URL(url).hostname;
        const publishedAt =
          typeof item.date === 'string' && item.date.trim() ? item.date.trim() : null;
        return {
          title,
          url,
          source,
          publishedAt,
          snippet: typeof item.snippet === 'string' ? item.snippet : '',
          fetchedAt,
          fetchedAtIst: formatIst(fetchedAt),
          freshness: freshnessFrom(publishedAt),
        };
      })
      .filter((item): item is TinyFishHeadline => item !== null)
      .slice(0, 5);
    const value: TinyFishContextResult =
      headlines.length > 0
        ? {
            status: 'AVAILABLE',
            source: 'TinyFish Search · news',
            fetchedAt,
            fetchedAtIst: formatIst(fetchedAt),
            headlines,
            message: null,
          }
        : unavailableContext('No recent, source-linked headlines were returned.');
    contextCache = { expiresAt: Date.now() + CACHE_TTL_MS, value };
    return value;
  } catch {
    return unavailableContext('TinyFish Search is unavailable.');
  }
}

interface ParsedQuote {
  symbol: string;
  expiryDate: string;
  quotedPrice: number;
}

function parseMarketTable(response: JsonRecord): ParsedQuote[] {
  if (!Array.isArray(response.results)) return [];
  for (const result of response.results) {
    if (!isRecord(result) || typeof result.text !== 'string') continue;
    const lines = result.text.split(/\r?\n/);
    for (let index = 0; index < lines.length - 1; index += 1) {
      if (!lines[index].includes('|') || !/\|?\s*:?-{3,}/.test(lines[index + 1])) continue;
      const headers = splitTableRow(lines[index]).map(normalizeHeader);
      const symbolIndex = findHeader(headers, ['symbol', 'contract', 'commodity']);
      const expiryIndex = findHeader(headers, ['expiry', 'expirydate']);
      const priceIndex = findHeader(headers, ['ltp', 'lastprice', 'lasttradedprice', 'lasttraded']);
      if (symbolIndex < 0 || expiryIndex < 0 || priceIndex < 0) continue;

      const rows: ParsedQuote[] = [];
      for (const line of lines.slice(index + 2)) {
        if (!line.includes('|')) break;
        const cells = splitTableRow(line);
        const symbol = cells[symbolIndex]?.trim().toUpperCase();
        const expiryDate = normalizeExpiry(cells[expiryIndex] ?? '');
        const quotedPrice = parsePrice(cells[priceIndex] ?? '');
        if (
          isContractSymbol(symbol) &&
          expiryDate &&
          quotedPrice !== null
        ) {
          rows.push({ symbol, expiryDate, quotedPrice });
        }
      }
      if (rows.length > 0) return rows;
    }
  }
  return [];
}

function parseAgentQuotes(result: JsonRecord): ParsedQuote[] {
  if (!Array.isArray(result.quotes)) return [];
  const quotes: ParsedQuote[] = [];
  for (const value of result.quotes) {
    if (!isRecord(value)) continue;
    const symbol = typeof value.symbol === 'string' ? value.symbol.toUpperCase() : '';
    const expiryDate = normalizeExpiry(
      typeof value.expiry_date === 'string' ? value.expiry_date : ''
    );
    const quotedPrice =
      typeof value.ltp === 'number' && Number.isFinite(value.ltp) ? value.ltp : null;
    if (isContractSymbol(symbol) && expiryDate && quotedPrice !== null && quotedPrice > 0) {
      quotes.push({ symbol, expiryDate, quotedPrice });
    }
  }
  return quotes;
}

function selectNearestQuotes(rows: ParsedQuote[]): ParsedQuote[] {
  const nearest = new Map<string, ParsedQuote>();
  for (const row of rows) {
    if (!isContractSymbol(row.symbol) || row.quotedPrice <= 0) continue;
    const previous = nearest.get(row.symbol);
    if (!previous || expiryDateKey(row.expiryDate) < expiryDateKey(previous.expiryDate)) {
      nearest.set(row.symbol, row);
    }
  }
  return Array.from(nearest.values());
}

function expiryDateKey(value: string): number {
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

function normalizeExpiry(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return isValidIsoDate(trimmed) ? trimmed : null;
  }
  const match = /^(\d{1,2})([A-Za-z]{3})(\d{4})$/.exec(trimmed);
  if (!match) return null;
  const month = new Map([
    ['JAN', '01'], ['FEB', '02'], ['MAR', '03'], ['APR', '04'],
    ['MAY', '05'], ['JUN', '06'], ['JUL', '07'], ['AUG', '08'],
    ['SEP', '09'], ['OCT', '10'], ['NOV', '11'], ['DEC', '12'],
  ]).get(match[2].toUpperCase());
  if (!month) return null;
  const result = `${match[3]}-${month}-${match[1].padStart(2, '0')}`;
  return isValidIsoDate(result) ? result : null;
}

function isValidIsoDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parsePrice(value: string): number | null {
  const parsed = Number(value.replace(/[,₹\s]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function splitTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findHeader(headers: string[], aliases: string[]): number {
  return headers.findIndex((header) => aliases.includes(header));
}

function isContractSymbol(value: string): value is ContractSymbol {
  return Object.prototype.hasOwnProperty.call(contractSpecs, value);
}

function isHttpUrl(value: string): boolean {
  return value.startsWith('https://') || value.startsWith('http://');
}

function freshnessFrom(value: string | null): TinyFishHeadline['freshness'] {
  if (!value) return 'Delayed';
  const date = Date.parse(value);
  if (Number.isNaN(date)) return 'Delayed';
  const ageMinutes = Math.max(0, (Date.now() - date) / 60_000);
  return ageMinutes < 5 ? 'Live <5 min' : ageMinutes < 30 ? 'Delayed' : 'Stale';
}

function formatIst(value: string): string {
  return `${new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value))} IST`;
}

function unavailableMarket(message: string): TinyFishMarketResult {
  return {
    status: 'UNAVAILABLE',
    source: 'MCX India Market Watch via TinyFish',
    fetchedAt: null,
    fetchedAtIst: null,
    freshness: null,
    quotes: [],
    message,
  };
}

function unavailableContext(message: string): TinyFishContextResult {
  return {
    status: 'UNAVAILABLE',
    source: 'TinyFish Search · news',
    fetchedAt: null,
    fetchedAtIst: null,
    headlines: [],
    message,
  };
}
