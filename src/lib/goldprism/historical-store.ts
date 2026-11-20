/** Exact-expiry historical research using official imports when available and a labeled synthetic demo otherwise. */

import fs from 'fs';
import path from 'path';
import { createHash } from 'node:crypto';
import { loadVerifiedHistory } from './verified-history';
import { SupportedContractCode } from './contract-master';
import {
  contractSpecs,
  normalizeContractBySymbol,
  Pure10gNormalizationResult,
} from './contract-specs';
import {
  computeXRayWaterfall,
  matchedSpreadLots,
  DEFAULT_COST_HURDLE_BPS,
  XRayWaterfallResult,
} from './xray';
import {
  calculateTransactionCosts,
  CostModelConfig,
  DEFAULT_COST_CONFIG,
} from './transaction-costs';

export interface HistoricalBhavcopyRow {
  symbol: SupportedContractCode;
  rawDate: string;
  tradeDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  expiryCode: string;
  open: number;
  high: number;
  low: number;
  close: number;
  settle: number;
  contracts: number;
  volume: number;
  openInterest: number;
  purity: number;
  tradingUnitG: number;
  quoteUnitG: number;
  shortHistoryFlag: boolean;
}

export interface DatasetProvenance {
  datasetName: string;
  priceBasis: 'CLOSE' | 'SETTLEMENT' | 'SYNTHETIC';
  sha256Hash: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  tradingDaysCount: number;
  totalRecords: number;
  networkStatus: string;
  provenanceStatus: string;
  fetchTimestamp: string;
  trainingEndDate: string; // 2025-02-20
  holdoutStartDate: string; // 2025-02-21 (from results/holdout.json)
  holdoutEndDate: string; // 2025-06-30
  holdoutBoundarySource: string;
  configHash: string;
}

export type ReplayPairId =
  | 'GOLDM_CALENDAR'
  | 'GOLDTEN_GOLDM'
  | 'GOLDGUINEA_GOLDM'
  | 'GOLDPETAL_GOLDM';

export const REPLAY_PAIRS: Record<
  ReplayPairId,
  {
    id: ReplayPairId;
    label: string;
    legA: SupportedContractCode;
    legB: SupportedContractCode;
    legAMode: 'FAR' | 'NEAR';
    legBMode: 'NEAR';
    description: string;
  }
> = {
  GOLDM_CALENDAR: {
    id: 'GOLDM_CALENDAR',
    label: 'GOLDM Far vs GOLDM Near',
    legA: 'GOLDM',
    legB: 'GOLDM',
    legAMode: 'FAR',
    legBMode: 'NEAR',
    description: 'Same-contract calendar spread (100g vs 100g, 995 fine).',
  },
  GOLDTEN_GOLDM: {
    id: 'GOLDTEN_GOLDM',
    label: 'GOLDTEN Near vs GOLDM Near',
    legA: 'GOLDTEN',
    legB: 'GOLDM',
    legAMode: 'NEAR',
    legBMode: 'NEAR',
    description: 'Cross-contract spread (10g 999 vs 100g 995, listed April 2025 onwards).',
  },
  GOLDGUINEA_GOLDM: {
    id: 'GOLDGUINEA_GOLDM',
    label: 'GOLDGUINEA Near vs GOLDM Near',
    legA: 'GOLDGUINEA',
    legB: 'GOLDM',
    legAMode: 'NEAR',
    legBMode: 'NEAR',
    description: 'Cross-contract spread (8g 999 vs 100g 995).',
  },
  GOLDPETAL_GOLDM: {
    id: 'GOLDPETAL_GOLDM',
    label: 'GOLDPETAL Near vs GOLDM Near',
    legA: 'GOLDPETAL',
    legB: 'GOLDM',
    legAMode: 'NEAR',
    legBMode: 'NEAR',
    description: 'Retail 1g 999 vs 100g 995 spread.',
  },
};

export const MIN_VOLUME_GATE = 50; // matches data-adapter.ts & backtest.py
export const ROLLING_SIGNAL_WINDOW = 20; // matches results/backtest.json
export const ENTRY_ZSCORE_THRESHOLD = 1.5; // matches results/backtest.json
export const ANNUAL_REPO_RATE = 0.065; // 6.5% RBI repo proxy
export const TRAINING_END_DATE = '2025-02-20';
export const HOLDOUT_START_DATE = '2025-02-21'; // directly from results/holdout.json

let cachedRows: HistoricalBhavcopyRow[] | null = null;
let cachedProvenance: DatasetProvenance | null = null;

const fixturePath = path.join(process.cwd(), 'research', 'data', 'mcx_bhavcopy_18m_cached.csv');
const REPLAY_VERSION = 'exact-expiry-marks-v2';

function experimentHash(costs: CostModelConfig, cutoff: string) {
  return createHash('sha256').update(JSON.stringify({
    version: REPLAY_VERSION, costs, cutoff, carryRate: ANNUAL_REPO_RATE,
    volumeGate: MIN_VOLUME_GATE, window: ROLLING_SIGNAL_WINDOW,
    entryZ: ENTRY_ZSCORE_THRESHOLD, hurdleBps: DEFAULT_COST_HURDLE_BPS,
  })).digest('hex');
}

function currentArchive() {
  if (process.env.GOLDPRISM_DEMO_FIXTURE === '1' && process.env.NODE_ENV !== 'production') return null;
  const archive = loadVerifiedHistory();
  if (!archive) throw new Error('Verified historical archive unavailable. Import the daily observations first.');
  return archive;
}

export function loadDatasetProvenance(): DatasetProvenance {
  const verified = currentArchive();
  if (verified) return { ...verified.provenance, configHash: experimentHash(DEFAULT_COST_CONFIG, verified.provenance.holdoutStartDate) };
  if (cachedProvenance) return cachedProvenance;
  const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'research', 'data', 'manifest.json'), 'utf8'));
  const csv = fs.readFileSync(fixturePath);
  cachedProvenance = {
    datasetName: 'Synthetic MCX-style research fixture (seed 42)',
    priceBasis: 'SYNTHETIC',
    sha256Hash: createHash('sha256').update(csv).digest('hex'),
    dateRangeStart: manifest.date_range_start,
    dateRangeEnd: manifest.date_range_end,
    tradingDaysCount: manifest.trading_days_count,
    totalRecords: manifest.total_records,
    networkStatus: 'Bundled generated data; no exchange retrieval',
    provenanceStatus: 'SYNTHETIC_FIXTURE',
    fetchTimestamp: manifest.fetch_timestamp,
    trainingEndDate: TRAINING_END_DATE,
    holdoutStartDate: HOLDOUT_START_DATE,
    holdoutEndDate: manifest.date_range_end,
    holdoutBoundarySource: 'Illustrative date split on generated observations',
    configHash: experimentHash(DEFAULT_COST_CONFIG, HOLDOUT_START_DATE),
  };
  return cachedProvenance;
}

export function loadHistoricalBhavcopyRows(): HistoricalBhavcopyRow[] {
  const verified = currentArchive();
  if (verified) return verified.rows;
  if (cachedRows) return cachedRows;
  const raw = fs.readFileSync(fixturePath, 'utf-8');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows: HistoricalBhavcopyRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    if (c.length < 17) continue;
    const symbol = c[0].trim().toUpperCase() as SupportedContractCode;
    if (!['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'].includes(symbol)) continue;

    rows.push({
      symbol,
      rawDate: c[1].trim(),
      tradeDate: c[2].trim(),
      expiryDate: c[3].trim(),
      expiryCode: c[4].trim(),
      open: Number(c[5]),
      high: Number(c[6]),
      low: Number(c[7]),
      close: Number(c[8]),
      settle: Number(c[9]),
      contracts: Number(c[10]),
      volume: Number(c[11]),
      openInterest: Number(c[12]),
      purity: Number(c[13]),
      tradingUnitG: Number(c[14]),
      quoteUnitG: Number(c[15]),
      shortHistoryFlag: c[16].trim().toLowerCase() === 'true',
    });
  }

  // Chronological sort by tradeDate then symbol then expiryDate
  rows.sort(
    (a, b) =>
      a.tradeDate.localeCompare(b.tradeDate) ||
      a.symbol.localeCompare(b.symbol) ||
      a.expiryDate.localeCompare(b.expiryDate)
  );

  cachedRows = rows;
  return cachedRows;
}

export function normalizeAsOfDate(asOfTimestamp: string): string {
  const trimmed = asOfTimestamp.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    if (!Number.isFinite(Date.parse(trimmed)) || new Date(trimmed).toISOString().slice(0, 10) !== trimmed) throw new Error('Invalid calendar date');
    return trimmed;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid as_of timestamp: ${asOfTimestamp}`);
  }
  return parsed.toISOString().slice(0, 10);
}

export interface SnapshotContractEligibility {
  symbol: SupportedContractCode;
  expiryDate: string;
  expiryCode: string;
  settle: number;
  close: number;
  volume: number;
  openInterest: number;
  daysToExpiry: number;
  eligible: boolean;
  reasons: string[];
  normalized10g: Pure10gNormalizationResult;
}

export interface PointInTimeSnapshot {
  requestedAsOf: string;
  resolvedTradeDate: string | null;
  staleDays: number;
  marketStatus: 'TRADING_DAY_MATCH' | 'MARKET_CLOSED_PRIOR_CLOSE' | 'DATA_UNAVAILABLE';
  partition: 'TRAINING' | 'SEALED_HOLDOUT';
  partitionLabel: string;
  rowsAvailableUpToAsOf: number;
  tradingDaysAvailableUpToAsOf: number;
  availableContractsOnDate: SupportedContractCode[];
  missingContractsOnDate: SupportedContractCode[];
  recordsOnResolvedDate: HistoricalBhavcopyRow[];
  eligibility: SnapshotContractEligibility[];
  /** Strictly filtered historical rows <= asOfDate (never contains future rows) */
  historyUpToAsOf: HistoricalBhavcopyRow[];
}

/**
 * STRICT POINT-IN-TIME DATA ACCESS LAYER.
 * Filters ALL rows by `row.tradeDate <= asOfDate`.
 * Accepts optional `sourceRows` for deterministic unit testing of the no-look-ahead invariant.
 */
export function getSnapshotAsOf(
  asOfTimestamp: string,
  sourceRows?: HistoricalBhavcopyRow[],
  holdoutStart = loadDatasetProvenance().holdoutStartDate,
): PointInTimeSnapshot {
  const asOfDate = normalizeAsOfDate(asOfTimestamp);
  const allRows = sourceRows ?? loadHistoricalBhavcopyRows();

  // CORE NO-LOOKAHEAD FILTER: strictly <= asOfDate
  const historyUpToAsOf = allRows.filter((row) => row.tradeDate <= asOfDate && listedOnDate(row));

  const partition: 'TRAINING' | 'SEALED_HOLDOUT' =
    asOfDate >= holdoutStart ? 'SEALED_HOLDOUT' : 'TRAINING';
  const partitionLabel =
    partition === 'SEALED_HOLDOUT'
      ? `Evaluation partition (from ${holdoutStart})`
      : `Training partition (before ${holdoutStart})`;

  if (historyUpToAsOf.length === 0) {
    return {
      requestedAsOf: asOfDate,
      resolvedTradeDate: null,
      staleDays: 0,
      marketStatus: 'DATA_UNAVAILABLE',
      partition,
      partitionLabel,
      rowsAvailableUpToAsOf: 0,
      tradingDaysAvailableUpToAsOf: 0,
      availableContractsOnDate: [],
      missingContractsOnDate: ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'],
      recordsOnResolvedDate: [],
      eligibility: [],
      historyUpToAsOf: [],
    };
  }

  const uniqueDates = Array.from(new Set(historyUpToAsOf.map((r) => r.tradeDate))).sort();
  const resolvedTradeDate = uniqueDates[uniqueDates.length - 1];
  const staleDays = Math.round(
    (new Date(asOfDate).getTime() - new Date(resolvedTradeDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  const marketStatus =
    resolvedTradeDate === asOfDate ? 'TRADING_DAY_MATCH' : 'MARKET_CLOSED_PRIOR_CLOSE';

  const recordsOnResolvedDate = historyUpToAsOf.filter(
    (r) => r.tradeDate === resolvedTradeDate
  );

  const availableContractsOnDate = Array.from(
    new Set(recordsOnResolvedDate.map((r) => r.symbol))
  ) as SupportedContractCode[];

  const allSymbols: SupportedContractCode[] = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'];
  const missingContractsOnDate = allSymbols.filter(
    (s) => !availableContractsOnDate.includes(s)
  );

  const eligibility: SnapshotContractEligibility[] = recordsOnResolvedDate.map((r) => {
    const daysToExpiry = Math.round(
      (new Date(r.expiryDate).getTime() - new Date(resolvedTradeDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const reasons: string[] = [];
    if (daysToExpiry < 0) reasons.push('ERR_CONTRACT_EXPIRED');
    if (daysToExpiry === 0) reasons.push('WARN_EXPIRY_DAY_TENDER_LOCKOUT');
    if (r.openInterest <= 0) reasons.push('ERR_NO_OPEN_INTEREST');
    if (r.volume < MIN_VOLUME_GATE) reasons.push('ERR_THIN_VOLUME');
    if (r.settle <= 0) reasons.push('ERR_INVALID_SETTLE');
    if (staleDays > 3) reasons.push('ERR_STALE_DATA_GAP');

    const normalized10g = normalizeContractBySymbol(r.symbol, r.settle);

    return {
      symbol: r.symbol,
      expiryDate: r.expiryDate,
      expiryCode: r.expiryCode,
      settle: r.settle,
      close: r.close,
      volume: r.volume,
      openInterest: r.openInterest,
      daysToExpiry,
      eligible: reasons.length === 0,
      reasons,
      normalized10g,
    };
  });

  return {
    requestedAsOf: asOfDate,
    resolvedTradeDate,
    staleDays,
    marketStatus,
    partition,
    partitionLabel,
    rowsAvailableUpToAsOf: historyUpToAsOf.length,
    tradingDaysAvailableUpToAsOf: uniqueDates.length,
    availableContractsOnDate,
    missingContractsOnDate,
    recordsOnResolvedDate,
    eligibility,
    historyUpToAsOf,
  };
}

function listedOnDate(row: HistoricalBhavcopyRow) {
  return !contractSpecs[row.symbol].listedFrom || row.tradeDate >= contractSpecs[row.symbol].listedFrom!;
}

function selectPairLegs(
  records: HistoricalBhavcopyRow[],
  pairId: ReplayPairId
): { legA: HistoricalBhavcopyRow; legB: HistoricalBhavcopyRow } | null {
  const cfg = REPLAY_PAIRS[pairId];
  const legARows = records
    .filter((r) => r.symbol === cfg.legA && r.expiryDate >= r.tradeDate && listedOnDate(r))
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  const legBRows = records
    .filter((r) => r.symbol === cfg.legB && r.expiryDate >= r.tradeDate && listedOnDate(r))
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  if (pairId === 'GOLDM_CALENDAR') {
    if (legARows.length < 2) return null;
    return { legA: legARows[1], legB: legARows[0] };
  }

  if (legARows.length === 0 || legBRows.length === 0) return null;
  return { legA: legARows[0], legB: legBRows[0] };
}

/** Smallest feasible whole-lot hedge with equal nominal grams, e.g. 25 Guinea vs 2 Mini. */
export function getMatchedPairLots(a: SupportedContractCode, b: SupportedContractCode) {
  const { lotsA, lotsB, grams } = matchedSpreadLots(a, b);
  return { lotsA, lotsB, matchedGrams: grams };
}

type Legs = { legA: HistoricalBhavcopyRow; legB: HistoricalBhavcopyRow };

function indexDays(rows: HistoricalBhavcopyRow[]) {
  const days = new Map<string, HistoricalBhavcopyRow[]>();
  for (const row of rows) {
    const bucket = days.get(row.tradeDate);
    if (bucket) bucket.push(row);
    else days.set(row.tradeDate, [row]);
  }
  return days;
}

function isLiquid(row: HistoricalBhavcopyRow, lots: number) {
  return row.volume >= Math.max(MIN_VOLUME_GATE, lots) && row.openInterest >= lots;
}

function analyzePair({ legA, legB }: Legs, costs: CostModelConfig, staleDays = 0) {
  const { lotsA, lotsB } = getMatchedPairLots(legA.symbol, legB.symbol);
  return computeXRayWaterfall({
    contractA: legA.symbol, priceAQuoted: legA.settle, expiryA: legA.expiryDate, lotsA,
    contractB: legB.symbol, priceBQuoted: legB.settle, expiryB: legB.expiryDate, lotsB,
    tradeDate: legA.tradeDate, annualCarryRate: ANNUAL_REPO_RATE, costConfig: costs,
    dataQualityOk: staleDays <= 3 && [legA, legB].every(row =>
      Number.isFinite(row.settle) && row.settle > 0 && row.tradeDate < row.expiryDate),
    liquidityOk: isLiquid(legA, lotsA) && isLiquid(legB, lotsB),
  });
}

function exactLegs(rows: HistoricalBhavcopyRow[] | undefined, signal: Legs): Legs | null {
  if (!rows) return null;
  const find = (key: HistoricalBhavcopyRow) => rows.find(row =>
    listedOnDate(row) && row.symbol === key.symbol && row.expiryDate === key.expiryDate && row.tradeDate < row.expiryDate &&
    Number.isFinite(row.settle) && row.settle > 0);
  const legA = find(signal.legA);
  const legB = find(signal.legB);
  return legA && legB ? { legA, legB } : null;
}

function signalAtDate(legs: Legs, priorDates: string[], days: Map<string, HistoricalBhavcopyRow[]>, costs: CostModelConfig, staleDays = 0) {
  const xray = analyzePair(legs, costs, staleDays);
  const residuals: number[] = [];
  for (const date of priorDates.slice(-ROLLING_SIGNAL_WINDOW)) {
    const historicalLegs = exactLegs(days.get(date), legs);
    if (!historicalLegs) continue;
    const observed = analyzePair(historicalLegs, costs);
    if (observed.verdict !== 'BLOCKED') residuals.push(observed.grossResidualInrPerG);
  }
  const mean = residuals.length ? residuals.reduce((sum, val) => sum + val, 0) / residuals.length : null;
  const std = residuals.length > 1 && mean !== null
    ? Math.sqrt(residuals.reduce((sum, val) => sum + (val - mean) ** 2, 0) / (residuals.length - 1))
    : null;
  const zScore = residuals.length === ROLLING_SIGNAL_WINDOW && std !== null && std > 1e-6 && mean !== null
    ? (xray.grossResidualInrPerG - mean) / std : null;
  if (xray.verdict === 'TRADABLE' && (zScore === null || zScore <= ENTRY_ZSCORE_THRESHOLD)) {
    xray.verdict = 'WATCH';
    xray.verdictTitle = 'Watch: historical signal gate';
    xray.verdictMessage = zScore === null
      ? 'The exact-expiry pair needs a full rolling window with measurable dispersion.'
      : 'The residual is within the historical entry threshold.';
    xray.reasonCodes = ['HISTORICAL_SIGNAL_GATE'];
  }
  return { xray, count: residuals.length, mean, std, zScore };
}

function quotedSpread({ legA, legB }: Legs) {
  return legA.settle / contractSpecs[legA.symbol].quotedPerGrams -
    legB.settle / contractSpecs[legB.symbol].quotedPerGrams;
}

// Each side uses half of its symmetric charges, sell-side CTT and buy-side stamp duty.
function fillCost(row: HistoricalBhavcopyRow, lots: number, side: 'BUY' | 'SELL', costs: CostModelConfig) {
  const c = calculateTransactionCosts(row.settle, row.symbol, lots, costs);
  return (c.brokerageInr + c.exchangeChargeInr + c.sebiChargeInr + c.gstInr + c.slippageInr) / 2 +
    (side === 'SELL' ? c.cttInr : c.stampDutyInr);
}

function markPair(entry: Legs, exit: Legs, costs: CostModelConfig) {
  const { lotsA, lotsB, matchedGrams } = getMatchedPairLots(entry.legA.symbol, entry.legB.symbol);
  const legAPnlInr = (entry.legA.settle - exit.legA.settle) * matchedGrams / contractSpecs[entry.legA.symbol].quotedPerGrams;
  const legBPnlInr = (exit.legB.settle - entry.legB.settle) * matchedGrams / contractSpecs[entry.legB.symbol].quotedPerGrams;
  const grossPnlInr = Number((legAPnlInr + legBPnlInr).toFixed(2));
  const costInr = Number((fillCost(entry.legA, lotsA, 'SELL', costs) + fillCost(entry.legB, lotsB, 'BUY', costs) +
    fillCost(exit.legA, lotsA, 'BUY', costs) + fillCost(exit.legB, lotsB, 'SELL', costs)).toFixed(2));
  // Attribute the remaining fine-gold exposure using the observed long leg as a benchmark.
  const purityA = contractSpecs[entry.legA.symbol].purity;
  const purityB = contractSpecs[entry.legB.symbol].purity;
  const netFineGoldGrams = matchedGrams * (purityB - purityA);
  const benchmarkMovePerPureGram = legBPnlInr / (matchedGrams * purityB);
  const benchmarkPnlInr = Number((netFineGoldGrams * benchmarkMovePerPureGram).toFixed(2));
  return {
    matchedGrams, lotsA, lotsB,
    legAPnlInr: Number(legAPnlInr.toFixed(2)),
    legBPnlInr: Number(legBPnlInr.toFixed(2)),
    netFineGoldGrams: Number(netFineGoldGrams.toFixed(4)),
    benchmarkPnlInr, relativeValuePnlInr: Number((grossPnlInr - benchmarkPnlInr).toFixed(2)),
    grossPnlInr, costInr, netPnlInr: Number((grossPnlInr - costInr).toFixed(2)),
  };
}

function fillable(legs: Legs) {
  const { lotsA, lotsB } = getMatchedPairLots(legs.legA.symbol, legs.legB.symbol);
  return isLiquid(legs.legA, lotsA) && isLiquid(legs.legB, lotsB);
}

export interface ReplayPanelResult {
  asOf: string;
  resolvedTradeDate: string | null;
  pairId: ReplayPairId;
  pairLabel: string;
  partition: 'TRAINING' | 'SEALED_HOLDOUT';
  partitionLabel: string;
  provenance: DatasetProvenance;

  // Panel 1: Data available on date
  panel1DataAvailability: {
    marketStatus: PointInTimeSnapshot['marketStatus'];
    requestedAsOf: string;
    resolvedTradeDate: string | null;
    staleDays: number;
    source: string;
    sha256Hash: string;
    rowsUpToAsOf: number;
    tradingDaysUpToAsOf: number;
    availableContracts: SupportedContractCode[];
    missingContracts: SupportedContractCode[];
    completenessPct: number;
  };

  // Panel 2: Eligible contracts
  panel2Eligibility: SnapshotContractEligibility[];

  // Panel 3: Normalized spread at that moment (Feature 1)
  panel3NormalizedSpread: {
    available: boolean;
    unavailableReason?: string;
    legA?: {
      symbol: SupportedContractCode;
      expiryDate: string;
      expiryCode: string;
      quotedPrice: number;
      volume: number;
      openInterest: number;
      lotsMatched: number;
      normalization: Pure10gNormalizationResult;
    };
    legB?: {
      symbol: SupportedContractCode;
      expiryDate: string;
      expiryCode: string;
      quotedPrice: number;
      volume: number;
      openInterest: number;
      lotsMatched: number;
      normalization: Pure10gNormalizationResult;
    };
    spread10gPureInr: number;
    spread1g999Inr: number;
    spreadBps: number;
  };

  // Panel 4: What the model knew at that point
  panel4ModelState: {
    signalWindowBars: number;
    barsInWindow: number;
    rollingMeanResidualInrPerG: number | null;
    rollingStdResidualInrPerG: number | null;
    currentResidualInrPerG: number | null;
    zScoreAtAsOf: number | null;
    entryZScoreThreshold: number;
    signalTriggered: boolean;
    annualCarryRate: number;
    expiryDaysDiff: number | null;
    trainingCutoffDate: string;
    configHash: string;
    modelParametersSummary: string;
  };

  // Panel 5: Verdict produced by EXISTING verdict engine
  panel5Verdict: XRayWaterfallResult | null;

  // Panel 6: Forward outcome (null unless reveal=true!)
  panel6ForwardOutcome: {
    revealed: boolean;
    horizons: Array<{
      horizonDays: number;
      targetDate: string | null;
      status: 'AVAILABLE' | 'UNAVAILABLE_BEYOND_HISTORY' | 'UNAVAILABLE_CONTRACT' | 'BLOCKED';
      matchedGrams: number;
      netPnlInr: number | null;
      entryFillDate: string | null;
      spreadAtEntryInrPerG: number | null;
      spreadAtHorizonInrPerG: number | null;
      grossPnlInrPerG: number | null;
      netPnlInrPerG: number | null;
      netPnlMatched100gInr: number | null;
    }>;
  } | null;

  // Panel 7: Transaction costs elimination analysis
  panel7CostAnalysis: {
    available: boolean;
    grossResidualInrPerG: number;
    grossResidualBps: number;
    totalCostsInrPerG: number;
    totalCostsBps: number;
    netEdgeInrPerG: number;
    netEdgeBps: number;
    costHurdleBps: number;
    survivalStatus: 'SURVIVED_COSTS' | 'ELIMINATED_BY_COSTS' | 'BLOCKED' | 'UNAVAILABLE';
    itemizedCostsInr: {
      brokerage: number;
      exchangeCharges: number;
      ctt: number;
      sebi: number;
      gst: number;
      stampDuty: number;
      slippage: number;
      totalRoundTrip: number;
    } | null;
  };
}

export function computeReplayAtDate(
  asOfTimestamp: string,
  options: {
    pairId?: ReplayPairId;
    reveal?: boolean;
    costConfig?: CostModelConfig;
    sourceRows?: HistoricalBhavcopyRow[];
  } = {}
): ReplayPanelResult {
  const pairId = options.pairId ?? 'GOLDM_CALENDAR';
  const reveal = options.reveal ?? false;
  const costConfig = options.costConfig ?? DEFAULT_COST_CONFIG;
  const allRows = options.sourceRows ?? loadHistoricalBhavcopyRows();
  const provenance = loadDatasetProvenance();

  // Strictly filtered snapshot <= as_of
  const snapshot = getSnapshotAsOf(asOfTimestamp, allRows, provenance.holdoutStartDate);
  const pairCfg = REPLAY_PAIRS[pairId];

  const panel1 = {
    marketStatus: snapshot.marketStatus,
    requestedAsOf: snapshot.requestedAsOf,
    resolvedTradeDate: snapshot.resolvedTradeDate,
    staleDays: snapshot.staleDays,
    source: provenance.datasetName,
    sha256Hash: provenance.sha256Hash,
    rowsUpToAsOf: snapshot.rowsAvailableUpToAsOf,
    tradingDaysUpToAsOf: snapshot.tradingDaysAvailableUpToAsOf,
    availableContracts: snapshot.availableContractsOnDate,
    missingContracts: snapshot.missingContractsOnDate,
    completenessPct: Number(((snapshot.availableContractsOnDate.length / 4) * 100).toFixed(1)),
  };

  if (!snapshot.resolvedTradeDate || snapshot.recordsOnResolvedDate.length === 0) {
    return {
      asOf: snapshot.requestedAsOf,
      resolvedTradeDate: null,
      pairId,
      pairLabel: pairCfg.label,
      partition: snapshot.partition,
      partitionLabel: snapshot.partitionLabel,
      provenance,
      panel1DataAvailability: panel1,
      panel2Eligibility: [],
      panel3NormalizedSpread: {
        available: false,
        unavailableReason: `No MCX Bhavcopy data available on or before ${snapshot.requestedAsOf}.`,
        spread10gPureInr: 0,
        spread1g999Inr: 0,
        spreadBps: 0,
      },
      panel4ModelState: {
        signalWindowBars: ROLLING_SIGNAL_WINDOW,
        barsInWindow: 0,
        rollingMeanResidualInrPerG: null,
        rollingStdResidualInrPerG: null,
        currentResidualInrPerG: null,
        zScoreAtAsOf: null,
        entryZScoreThreshold: ENTRY_ZSCORE_THRESHOLD,
        signalTriggered: false,
        annualCarryRate: ANNUAL_REPO_RATE,
        expiryDaysDiff: null,
        trainingCutoffDate: provenance.trainingEndDate,
        configHash: experimentHash(costConfig, provenance.holdoutStartDate),
        modelParametersSummary: 'No historical bars available on or before requested date.',
      },
      panel5Verdict: null,
      panel6ForwardOutcome: reveal ? { revealed: true, horizons: [] } : null,
      panel7CostAnalysis: {
        available: false,
        grossResidualInrPerG: 0,
        grossResidualBps: 0,
        totalCostsInrPerG: 0,
        totalCostsBps: 0,
        netEdgeInrPerG: 0,
        netEdgeBps: 0,
        costHurdleBps: DEFAULT_COST_HURDLE_BPS,
        survivalStatus: 'UNAVAILABLE',
        itemizedCostsInr: null,
      },
    };
  }

  const pairLegs = selectPairLegs(snapshot.recordsOnResolvedDate, pairId);

  if (!pairLegs) {
    const missingReason =
      pairId === 'GOLDTEN_GOLDM' && snapshot.resolvedTradeDate < '2025-04-01'
        ? `GOLDTEN was listed on 2025-04-01; no quotation exists as of ${snapshot.resolvedTradeDate}.`
        : `Required contract legs for ${pairCfg.label} are unavailable on ${snapshot.resolvedTradeDate}.`;

    return {
      asOf: snapshot.requestedAsOf,
      resolvedTradeDate: snapshot.resolvedTradeDate,
      pairId,
      pairLabel: pairCfg.label,
      partition: snapshot.partition,
      partitionLabel: snapshot.partitionLabel,
      provenance,
      panel1DataAvailability: panel1,
      panel2Eligibility: snapshot.eligibility,
      panel3NormalizedSpread: {
        available: false,
        unavailableReason: missingReason,
        spread10gPureInr: 0,
        spread1g999Inr: 0,
        spreadBps: 0,
      },
      panel4ModelState: {
        signalWindowBars: ROLLING_SIGNAL_WINDOW,
        barsInWindow: 0,
        rollingMeanResidualInrPerG: null,
        rollingStdResidualInrPerG: null,
        currentResidualInrPerG: null,
        zScoreAtAsOf: null,
        entryZScoreThreshold: ENTRY_ZSCORE_THRESHOLD,
        signalTriggered: false,
        annualCarryRate: ANNUAL_REPO_RATE,
        expiryDaysDiff: null,
        trainingCutoffDate: provenance.trainingEndDate,
        configHash: experimentHash(costConfig, provenance.holdoutStartDate),
        modelParametersSummary: missingReason,
      },
      panel5Verdict: null,
      panel6ForwardOutcome: reveal ? { revealed: true, horizons: [] } : null,
      panel7CostAnalysis: {
        available: false,
        grossResidualInrPerG: 0,
        grossResidualBps: 0,
        totalCostsInrPerG: 0,
        totalCostsBps: 0,
        netEdgeInrPerG: 0,
        netEdgeBps: 0,
        costHurdleBps: DEFAULT_COST_HURDLE_BPS,
        survivalStatus: 'UNAVAILABLE',
        itemizedCostsInr: null,
      },
    };
  }

  const { legA, legB } = pairLegs;
  const { lotsA, lotsB, matchedGrams } = getMatchedPairLots(legA.symbol, legB.symbol);

  const normA10g = normalizeContractBySymbol(legA.symbol, legA.settle);
  const normB10g = normalizeContractBySymbol(legB.symbol, legB.settle);

  const spread10gPureInr = Number((normA10g.normalized10gPrice - normB10g.normalized10gPrice).toFixed(2));
  const spread1g999Inr = Number((normA10g.normalized999PerGram - normB10g.normalized999PerGram).toFixed(4));
  const spreadBps =
    normA10g.normalized10gPrice > 0
      ? Number(((spread10gPureInr / normA10g.normalized10gPrice) * 10000).toFixed(2))
      : 0;

  const historicalDays = indexDays(snapshot.historyUpToAsOf);
  const priorDates = [...historicalDays.keys()].filter(date => date < snapshot.resolvedTradeDate!).sort();
  const { xray: xrayResult, count, mean, std, zScore } =
    signalAtDate(pairLegs, priorDates, historicalDays, costConfig, snapshot.staleDays);

  const expiryDaysDiff = Math.round(
    (new Date(legA.expiryDate).getTime() - new Date(legB.expiryDate).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  // Panel 7: Cost elimination
  const costA = xrayResult.costBreakdownA;
  const costB = xrayResult.costBreakdownB;
  const survivalStatus: ReplayPanelResult['panel7CostAnalysis']['survivalStatus'] =
    xrayResult.verdict === 'BLOCKED'
      ? 'BLOCKED'
      : xrayResult.netEdgeInrPerG > 0
        ? 'SURVIVED_COSTS'
        : 'ELIMINATED_BY_COSTS';

  // Panel 6: Forward outcome (ONLY computed when reveal === true!)
  let panel6: ReplayPanelResult['panel6ForwardOutcome'] = null;
  if (reveal) {
    const days = indexDays(allRows);
    const dates = [...days.keys()].sort();
    const signalIndex = dates.indexOf(snapshot.resolvedTradeDate);
    const entryDate = dates[signalIndex + 1] ?? null;
    const entry = exactLegs(entryDate ? days.get(entryDate) : undefined, pairLegs);
    const horizons = [1, 5, 10, 20].map((horizonDays) => {
      const targetDate = dates[signalIndex + horizonDays] ?? null;
      const exit = exactLegs(targetDate ? days.get(targetDate) : undefined, pairLegs);
      const status = !targetDate || !entryDate ? 'UNAVAILABLE_BEYOND_HISTORY' :
        !entry || !exit ? 'UNAVAILABLE_CONTRACT' :
        xrayResult.verdict === 'BLOCKED' || !fillable(entry) || !fillable(exit) ? 'BLOCKED' : 'AVAILABLE';
      const pnl = status === 'AVAILABLE' && entry && exit ? markPair(entry, exit, costConfig) : null;
      return {
        horizonDays, targetDate, status, entryFillDate: xrayResult.verdict !== 'BLOCKED' && entry && fillable(entry) ? entryDate : null,
        spreadAtEntryInrPerG: entry ? Number(quotedSpread(entry).toFixed(4)) : null,
        spreadAtHorizonInrPerG: exit ? Number(quotedSpread(exit).toFixed(4)) : null,
        matchedGrams, netPnlInr: pnl?.netPnlInr ?? null,
        grossPnlInrPerG: pnl ? Number((pnl.grossPnlInr / matchedGrams).toFixed(4)) : null,
        netPnlInrPerG: pnl ? Number((pnl.netPnlInr / matchedGrams).toFixed(4)) : null,
        netPnlMatched100gInr: pnl ? Number((pnl.netPnlInr * 100 / matchedGrams).toFixed(2)) : null,
      } satisfies NonNullable<ReplayPanelResult['panel6ForwardOutcome']>['horizons'][number];
    });

    panel6 = {
      revealed: true,
      horizons,
    };
  }

  return {
    asOf: snapshot.requestedAsOf,
    resolvedTradeDate: snapshot.resolvedTradeDate,
    pairId,
    pairLabel: pairCfg.label,
    partition: snapshot.partition,
    partitionLabel: snapshot.partitionLabel,
    provenance,
    panel1DataAvailability: panel1,
    panel2Eligibility: snapshot.eligibility,
    panel3NormalizedSpread: {
      available: true,
      legA: {
        symbol: legA.symbol,
        expiryDate: legA.expiryDate,
        expiryCode: legA.expiryCode,
        quotedPrice: legA.settle,
        volume: legA.volume,
        openInterest: legA.openInterest,
        lotsMatched: lotsA,
        normalization: normA10g,
      },
      legB: {
        symbol: legB.symbol,
        expiryDate: legB.expiryDate,
        expiryCode: legB.expiryCode,
        quotedPrice: legB.settle,
        volume: legB.volume,
        openInterest: legB.openInterest,
        lotsMatched: lotsB,
        normalization: normB10g,
      },
      spread10gPureInr,
      spread1g999Inr,
      spreadBps,
    },
    panel4ModelState: {
      signalWindowBars: ROLLING_SIGNAL_WINDOW,
      barsInWindow: count,
      rollingMeanResidualInrPerG: mean,
      rollingStdResidualInrPerG: std,
      currentResidualInrPerG: xrayResult.grossResidualInrPerG,
      zScoreAtAsOf: zScore,
      entryZScoreThreshold: ENTRY_ZSCORE_THRESHOLD,
      signalTriggered: zScore !== null && zScore > ENTRY_ZSCORE_THRESHOLD && xrayResult.verdict === 'TRADABLE',
      annualCarryRate: ANNUAL_REPO_RATE,
      expiryDaysDiff,
      trainingCutoffDate: provenance.trainingEndDate,
      configHash: experimentHash(costConfig, provenance.holdoutStartDate),
      modelParametersSummary: `Window=${ROLLING_SIGNAL_WINDOW} bars, EntryZ=${ENTRY_ZSCORE_THRESHOLD}, Carry=${(ANNUAL_REPO_RATE * 100).toFixed(1)}% ACT/365, Hurdle=${DEFAULT_COST_HURDLE_BPS} bps`,
    },
    panel5Verdict: xrayResult,
    panel6ForwardOutcome: panel6,
    panel7CostAnalysis: {
      available: true,
      grossResidualInrPerG: xrayResult.grossResidualInrPerG,
      grossResidualBps: xrayResult.grossResidualBps,
      totalCostsInrPerG: xrayResult.transactionCostsInrPerG,
      totalCostsBps: xrayResult.transactionCostsBps,
      netEdgeInrPerG: xrayResult.netEdgeInrPerG,
      netEdgeBps: xrayResult.netEdgeBps,
      costHurdleBps: DEFAULT_COST_HURDLE_BPS,
      survivalStatus,
      itemizedCostsInr: {
        brokerage: Number((costA.brokerageInr + costB.brokerageInr).toFixed(2)),
        exchangeCharges: Number((costA.exchangeChargeInr + costB.exchangeChargeInr).toFixed(2)),
        ctt: Number((costA.cttInr + costB.cttInr).toFixed(2)),
        sebi: Number((costA.sebiChargeInr + costB.sebiChargeInr).toFixed(2)),
        gst: Number((costA.gstInr + costB.gstInr).toFixed(2)),
        stampDuty: Number((costA.stampDutyInr + costB.stampDutyInr).toFixed(2)),
        slippage: Number((costA.slippageInr + costB.slippageInr).toFixed(2)),
        totalRoundTrip: Number((costA.totalRoundTripInr + costB.totalRoundTripInr).toFixed(2)),
      },
    },
  };
}

export interface PartitionReplayStats {
  partition: 'TRAINING' | 'SEALED_HOLDOUT';
  startDate: string;
  endDate: string;
  totalBars: number;
  tradableSignals: number;
  watchSignals: number;
  noEdgeBars: number;
  blockedBars: number;
  executedTrades: number;
  skippedEntries: number;
  unresolvedPositions: number;
  wins: number;
  winRatePct: number;
  profitFactor: number | null;
  positiveNetTradePnlInr: number;
  negativeNetTradePnlInr: number;
  cumulativeNetPnlInr: number;
  cumulativeGrossPnlInr: number;
  totalCostDragInr: number;
}

export interface ReplayTrade extends ReturnType<typeof markPair> {
  signalDate: string;
  entryDate: string;
  exitDate: string;
  symbolA: SupportedContractCode;
  symbolB: SupportedContractCode;
  expiryA: string;
  expiryB: string;
  entryA: number;
  entryB: number;
  exitA: number;
  exitB: number;
}

export interface FullPeriodReplaySummary {
  trades: ReplayTrade[];
  methodology: string;
  provenance: DatasetProvenance;
  pairId: ReplayPairId;
  pairLabel: string;
  allDates: string[];
  trainingBoundaryDate: string;
  holdoutStartDate: string;
  trainingStats: PartitionReplayStats;
  holdoutStats: PartitionReplayStats;
  equityCurve: Array<{
    date: string;
    partition: 'TRAINING' | 'SEALED_HOLDOUT';
    verdict: string;
    grossResidualBps: number;
    netEdgeBps: number;
    cumulativeNetPnlInr: number;
    cumulativeGrossPnlInr: number;
  }>;
}

const fullSummaryCache = new Map<string, FullPeriodReplaySummary>();

export function computeFullReplaySummary(
  pairId: ReplayPairId = 'GOLDM_CALENDAR',
  sourceRows?: HistoricalBhavcopyRow[],
  asOf?: string,
): FullPeriodReplaySummary {
  const provenance = loadDatasetProvenance();
  const cacheKey = [pairId, provenance.sha256Hash, provenance.configHash].join(':');
  const cacheable = !sourceRows && !asOf;
  if (cacheable && fullSummaryCache.has(cacheKey)) return fullSummaryCache.get(cacheKey)!;

  const source = sourceRows ?? loadHistoricalBhavcopyRows();
  const visibleRows = asOf ? source.filter(r => r.tradeDate <= asOf) : source;
  const days = indexDays(visibleRows);
  const allDates = [...days.keys()].sort();
  const trades: ReplayTrade[] = [];

  const equityCurve: FullPeriodReplaySummary['equityCurve'] = [];
  let cumGross = 0;
  let cumNet = 0;

  const initStats = (partition: 'TRAINING' | 'SEALED_HOLDOUT', start: string, end: string) => ({
    partition,
    startDate: start,
    endDate: end,
    totalBars: 0,
    tradableSignals: 0,
    watchSignals: 0,
    noEdgeBars: 0,
    blockedBars: 0,
    executedTrades: 0,
    skippedEntries: 0,
    unresolvedPositions: 0,
    wins: 0,
    grossProfit: 0,
    grossLoss: 0,
    cumulativeNetPnlInr: 0,
    cumulativeGrossPnlInr: 0,
    totalCostDragInr: 0,
  });

  const trainDates = allDates.filter(d => d < provenance.holdoutStartDate);
  const evalDates = allDates.filter(d => d >= provenance.holdoutStartDate);
  const trainAcc = initStats('TRAINING', trainDates[0] ?? '', trainDates.at(-1) ?? '');
  const holdAcc = initStats('SEALED_HOLDOUT', evalDates[0] ?? '', evalDates.at(-1) ?? '');
  let pending: Legs | null = null;
  let position: { entry: Legs; signalDate: string } | null = null;
  let priorHoldout = false;

  for (let i = 0; i < allDates.length; i++) {
    const date = allDates[i];
    const rows = days.get(date)!;
    const holdout = date >= provenance.holdoutStartDate;
    const acc = holdout ? holdAcc : trainAcc;
    acc.totalBars++;
    if (holdout !== priorHoldout) {
      // Each experiment starts flat. Flag any position still unpriced at the training cutoff.
      if (position) trainAcc.unresolvedPositions++;
      if (pending) trainAcc.skippedEntries++;
      position = null;
      pending = null;
    }
    priorHoldout = holdout;
    if (position) {
      const exit = exactLegs(rows, position.entry);
      if (exit && fillable(exit)) {
        const { entry, signalDate } = position;
        const pnl = markPair(entry, exit, DEFAULT_COST_CONFIG);
        trades.push({
          ...pnl, signalDate, entryDate: entry.legA.tradeDate, exitDate: date,
          symbolA: entry.legA.symbol, symbolB: entry.legB.symbol, expiryA: entry.legA.expiryDate, expiryB: entry.legB.expiryDate,
          entryA: entry.legA.settle, entryB: entry.legB.settle, exitA: exit.legA.settle, exitB: exit.legB.settle,
        });
        acc.executedTrades++;
        if (pnl.netPnlInr > 0) { acc.wins++; acc.grossProfit += pnl.netPnlInr; }
        else acc.grossLoss += Math.abs(pnl.netPnlInr);
        acc.cumulativeGrossPnlInr += pnl.grossPnlInr;
        acc.cumulativeNetPnlInr += pnl.netPnlInr;
        acc.totalCostDragInr += pnl.costInr;
        cumGross += pnl.grossPnlInr;
        cumNet += pnl.netPnlInr;
        position = null;
      }
    }
    if (pending) {
      const entry = exactLegs(rows, pending);
      if (entry && fillable(entry)) position = { entry, signalDate: pending.legA.tradeDate };
      else acc.skippedEntries++;
      pending = null;
    }

    const legs = selectPairLegs(rows, pairId);
    const signal = legs ? signalAtDate(legs, allDates.slice(Math.max(0, i - ROLLING_SIGNAL_WINDOW), i), days, DEFAULT_COST_CONFIG) : null;
    const verdict = signal?.xray.verdict ?? 'UNAVAILABLE';
    if (verdict === 'TRADABLE' && legs) {
      acc.tradableSignals++;
      if (!position) pending = legs;
      else acc.skippedEntries++;
    } else if (verdict === 'WATCH') acc.watchSignals++;
    else if (verdict === 'NO EDGE') acc.noEdgeBars++;
    else acc.blockedBars++;
    equityCurve.push({
      date, partition: acc.partition, verdict, grossResidualBps: signal?.xray.grossResidualBps ?? 0,
      netEdgeBps: signal?.xray.netEdgeBps ?? 0, cumulativeNetPnlInr: Number(cumNet.toFixed(2)),
      cumulativeGrossPnlInr: Number(cumGross.toFixed(2)),
    });
  }
  const lastAcc = priorHoldout ? holdAcc : trainAcc;
  if (position) lastAcc.unresolvedPositions++;
  if (pending) lastAcc.skippedEntries++;

  const finalizeStats = (acc: ReturnType<typeof initStats>): PartitionReplayStats => ({
    partition: acc.partition,
    startDate: acc.startDate,
    endDate: acc.endDate,
    totalBars: acc.totalBars,
    tradableSignals: acc.tradableSignals,
    watchSignals: acc.watchSignals,
    noEdgeBars: acc.noEdgeBars,
    blockedBars: acc.blockedBars,
    executedTrades: acc.executedTrades,
    skippedEntries: acc.skippedEntries,
    unresolvedPositions: acc.unresolvedPositions,
    wins: acc.wins,
    winRatePct:
      acc.executedTrades > 0 ? Number(((acc.wins / acc.executedTrades) * 100).toFixed(1)) : 0,
    profitFactor: acc.grossLoss > 0 ? Number((acc.grossProfit / acc.grossLoss).toFixed(2)) : null,
    positiveNetTradePnlInr: Number(acc.grossProfit.toFixed(2)),
    negativeNetTradePnlInr: Number(acc.grossLoss.toFixed(2)),
    cumulativeNetPnlInr: Number(acc.cumulativeNetPnlInr.toFixed(2)),
    cumulativeGrossPnlInr: Number(acc.cumulativeGrossPnlInr.toFixed(2)),
    totalCostDragInr: Number(acc.totalCostDragInr.toFixed(2)),
  });

  const summary: FullPeriodReplaySummary = {
    pairId,
    pairLabel: REPLAY_PAIRS[pairId].label,
    allDates,
    trainingBoundaryDate: provenance.trainingEndDate,
    holdoutStartDate: provenance.holdoutStartDate,
    provenance, trades,
    methodology: 'Short leg A and long leg B in equal nominal grams. After 20 prior observations on the same expiries, enter at the next eligible session mark (skip if unavailable), exit at the next available liquid mark. Prices are daily marks with modeled friction. Equity reports closed trades only; unresolved positions are counted separately. Benchmark P&L values the residual fine-gold exposure at the change in leg B’s fine-gram price.',
    trainingStats: finalizeStats(trainAcc),
    holdoutStats: finalizeStats(holdAcc),
    equityCurve,
  };

  if (cacheable) {
    if (fullSummaryCache.size >= 8) fullSummaryCache.clear();
    fullSummaryCache.set(cacheKey, summary);
  }
  return summary;
}
