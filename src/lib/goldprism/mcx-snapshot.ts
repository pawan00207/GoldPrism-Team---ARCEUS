/**
 * MCX Live Snapshot — server-side reader
 * ========================================
 * Serves the machine-generated snapshot at results/mcx-live-snapshot.json
 * (written by scripts/fetch_mcx_snapshot.py via the `mcxdata` package).
 *
 * Honesty contract:
 * - Never fabricates prices. If the snapshot is missing/unreadable, status is
 *   UNAVAILABLE and all market values are null.
 * - Freshness is derived from `fetchedAt`: age <= 30 min is MCX_LIVE, otherwise
 *   MCX_STALE is returned with the snapshot age in minutes. We never claim
 *   data is "live" beyond that window; callers must label accordingly.
 */

import fs from 'node:fs';
import path from 'node:path';

export const MCX_LIVE_MAX_AGE_MINUTES = 30; // fresher than this -> "live"
export const MCX_STALE_MAX_AGE_MINUTES = 60 * 24 * 4; // older than ~4 days -> UNAVAILABLE

export type McxSnapshotStatus = 'MCX_LIVE' | 'MCX_STALE' | 'UNAVAILABLE';

export interface McxContractRow {
  symbol: string;
  expiryDate: string; // e.g. 04DEC2026
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  previousClose: number | null;
  volumeLots: number | null;
  volumeUnit: number | null;
  valueLakhs: number | null;
  openInterestLots: number | null;
}

export interface McxSnapshotResponse {
  status: McxSnapshotStatus;
  source: string;
  fetchedAt: string | null;
  ageMinutes: number | null;
  bhavcopyDate: string | null;
  spot: {
    commodity: string;
    unit: string;
    location: string;
    price: number | null;
    quoteTimestamp: string;
  } | null;
  contracts: Record<string, McxContractRow[]>;
  notice: string | null;
  contentHash: string | null;
  error: string | null;
}

const GOLD_FAMILY = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'] as const;
const EMPTY_CONTRACTS: Record<string, McxContractRow[]> = {
  GOLDM: [],
  GOLDTEN: [],
  GOLDGUINEA: [],
  GOLDPETAL: [],
};

let cached: { expiresAt: number; payload: McxSnapshotResponse } | null = null;
const CACHE_TTL_MS = 4000;

function unavailable(error: string): McxSnapshotResponse {
  return {
    status: 'UNAVAILABLE',
    source: 'mcx_data (MCX India public bhavcopy & spot feeds)',
    fetchedAt: null,
    ageMinutes: null,
    bhavcopyDate: null,
    spot: null,
    contracts: { ...EMPTY_CONTRACTS },
    notice: null,
    contentHash: null,
    error,
  };
}

export function getMcxSnapshot(): McxSnapshotResponse {
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const snapshotPath = path.join(process.cwd(), 'results', 'mcx-live-snapshot.json');

  let raw: string;
  try {
    raw = fs.readFileSync(snapshotPath, 'utf-8');
  } catch {
    return unavailable('Snapshot file results/mcx-live-snapshot.json is missing. Run scripts/fetch_mcx_snapshot.py to generate it.');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return unavailable('Snapshot file is corrupt (not valid JSON).');
  }

  const fetchedAt = typeof parsed.fetchedAt === 'string' ? parsed.fetchedAt : null;
  let ageMinutes: number | null = null;
  if (fetchedAt) {
    const t = Date.parse(fetchedAt);
    if (!Number.isNaN(t)) {
      ageMinutes = Math.max(0, (Date.now() - t) / 60_000);
    }
  }

  // Index gold-family rows per symbol, nearest expiries first
  const contracts: Record<string, McxContractRow[]> = { ...EMPTY_CONTRACTS };
  for (const sym of GOLD_FAMILY) contracts[sym] = [];
  const rows: McxContractRow[] = Array.isArray(parsed?.bhavcopy?.goldFamilyRows)
    ? parsed.bhavcopy.goldFamilyRows
    : [];
  for (const row of rows) {
    const sym = String(row?.symbol ?? '').toUpperCase();
    if (!GOLD_FAMILY.includes(sym as (typeof GOLD_FAMILY)[number])) continue;
    (contracts[sym] as Array<McxContractRow & { expirySortKey: number }>).push({
      symbol: sym,
      expiryDate: String(row?.expiryDate ?? ''),
      expirySortKey: parseExpirySortKey(String(row?.expiryDate ?? '')),
      open: num(row?.open),
      high: num(row?.high),
      low: num(row?.low),
      close: num(row?.close),
      previousClose: num(row?.previousClose),
      volumeLots: int(row?.volumeLots),
      volumeUnit: int(row?.volumeUnit),
      valueLakhs: num(row?.valueLakhs),
      openInterestLots: int(row?.openInterestLots),
    });
  }
  for (const sym of GOLD_FAMILY) {
    const withKey = contracts[sym] as Array<McxContractRow & { expirySortKey: number }>;
    withKey.sort((a, b) => a.expirySortKey - b.expirySortKey);
    contracts[sym] = withKey.map(({ expirySortKey: _k, ...rest }) => rest);
  }

  const status: McxSnapshotStatus =
    ageMinutes === null || ageMinutes > MCX_STALE_MAX_AGE_MINUTES
      ? 'UNAVAILABLE'
      : ageMinutes <= MCX_LIVE_MAX_AGE_MINUTES
        ? 'MCX_LIVE'
        : 'MCX_STALE';

  const payload: McxSnapshotResponse = {
    status,
    source: typeof parsed.source === 'string' ? parsed.source : 'mcx_data',
    fetchedAt,
    ageMinutes: ageMinutes === null ? null : Math.round(ageMinutes * 10) / 10,
    bhavcopyDate: parsed?.bhavcopy?.date ?? null,
    spot: parsed?.spot
      ? {
          commodity: String(parsed.spot.commodity ?? 'GOLD'),
          unit: String(parsed.spot.unit ?? ''),
          location: String(parsed.spot.location ?? ''),
          price: num(parsed.spot.price),
          quoteTimestamp: String(parsed.spot.quoteTimestamp ?? ''),
        }
      : null,
    contracts: status === 'UNAVAILABLE' ? { ...EMPTY_CONTRACTS } : contracts,
    notice: typeof parsed.notice === 'string' ? parsed.notice : null,
    contentHash: typeof parsed.contentHash === 'string' ? parsed.contentHash : null,
    error: status === 'UNAVAILABLE' ? 'Snapshot older than the staleness budget. Re-run scripts/fetch_mcx_snapshot.py.' : null,
  };

  cached = { expiresAt: Date.now() + CACHE_TTL_MS, payload };
  return payload;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const EXPIRY_MONTH_INDEX: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

/** '04DEC2026' -> ms since epoch (UTC). Unknown/unparseable -> +Infinity (sorts last). */
function parseExpirySortKey(value: string): number {
  const m = /^(\d{1,2})([A-Za-z]{3})(\d{4})$/.exec(value.trim());
  if (!m) return Number.POSITIVE_INFINITY;
  const month = EXPIRY_MONTH_INDEX[m[2].toUpperCase()];
  if (month === undefined) return Number.POSITIVE_INFINITY;
  return Date.UTC(Number(m[3]), month, Number(m[1]));
}

function int(v: unknown): number | null {
  const n = num(v);
  return n === null ? null : Math.trunc(n);
}
