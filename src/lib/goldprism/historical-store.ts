/**
 * Historical MCX Data Store & Point-in-Time Replay Engine — GoldPrism
 * ====================================================================
 * Server-side data access layer reading the authoritative 18-month MCX Bhavcopy
 * snapshot (`research/data/mcx_bhavcopy_18m_cached.csv`) and manifest/holdout
 * boundaries (`results/manifest.json`, `results/holdout.json`).
 *
 * STRICT ANTI-LOOKAHEAD GUARANTEE:
 *   `getSnapshotAsOf(asOfTimestamp)` filters EVERY row by `row.tradeDate <= asOfDate`.
 *   No function in the replay path may read rows with `tradeDate > asOfDate` unless
 *   `revealForwardOutcome()` is explicitly requested after the user clicks "Reveal outcome".
 */

import fs from 'fs';
import path from 'path';
import { SupportedContractCode } from './contract-master';
import {
  contractSpecs,
  normalizeContractBySymbol,
  Pure10gNormalizationResult,
} from './contract-specs';
import {
  computeXRayWaterfall,
  DEFAULT_COST_HURDLE_BPS,
  XRayWaterfallResult,
} from './xray';
import {
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
    description: 'Cross-contract spread (10g 999 vs 100g 995, listed Jan 2025 onwards).',
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

function resolveRepoPath(rel: string): string {
  return path.join(process.cwd(), rel);
}

export function loadDatasetProvenance(): DatasetProvenance {
  if (cachedProvenance) return cachedProvenance;

  const manifestPath = resolveRepoPath('results/manifest.json');
  const holdoutPath = resolveRepoPath('results/holdout.json');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const holdout = JSON.parse(fs.readFileSync(holdoutPath, 'utf-8'));

  cachedProvenance = {
    datasetName: manifest.dataset_name,
    sha256Hash: manifest.sha256_hash,
    dateRangeStart: manifest.date_range_start,
    dateRangeEnd: manifest.date_range_end,
    tradingDaysCount: manifest.trading_days_count,
    totalRecords: manifest.total_records,
    networkStatus: manifest.network_status,
    provenanceStatus: manifest.provenance_status,
    fetchTimestamp: manifest.fetch_timestamp,
    trainingEndDate: TRAINING_END_DATE,
    holdoutStartDate: holdout.holdout_start_date || HOLDOUT_START_DATE,
    holdoutEndDate: manifest.date_range_end,
    holdoutBoundarySource: 'results/holdout.json (sealed before tuning)',
    configHash: holdout.config_hash || '9c8103c61b2b2137',
  };
  return cachedProvenance;
}

export function loadHistoricalBhavcopyRows(): HistoricalBhavcopyRow[] {
  if (cachedRows) return cachedRows;

  const csvPath = resolveRepoPath('research/data/mcx_bhavcopy_18m_cached.csv');
  const raw = fs.readFileSync(csvPath, 'utf-8');
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
  sourceRows?: HistoricalBhavcopyRow[]
): PointInTimeSnapshot {
  const asOfDate = normalizeAsOfDate(asOfTimestamp);
  const allRows = sourceRows ?? loadHistoricalBhavcopyRows();

  // CORE NO-LOOKAHEAD FILTER: strictly <= asOfDate
  const historyUpToAsOf = allRows.filter((row) => row.tradeDate <= asOfDate);

  const partition: 'TRAINING' | 'SEALED_HOLDOUT' =
    asOfDate >= HOLDOUT_START_DATE ? 'SEALED_HOLDOUT' : 'TRAINING';
  const partitionLabel =
    partition === 'SEALED_HOLDOUT'
      ? `Sealed Holdout (${HOLDOUT_START_DATE} onwards)`
      : `Training Partition (2024-01-01 to ${TRAINING_END_DATE})`;

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

function selectPairLegs(
  records: HistoricalBhavcopyRow[],
  pairId: ReplayPairId
): { legA: HistoricalBhavcopyRow; legB: HistoricalBhavcopyRow } | null {
  const cfg = REPLAY_PAIRS[pairId];
  const legARows = records
    .filter((r) => r.symbol === cfg.legA)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  const legBRows = records
    .filter((r) => r.symbol === cfg.legB)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  if (pairId === 'GOLDM_CALENDAR') {
    if (legARows.length < 2) return null;
    return { legA: legARows[1], legB: legARows[0] };
  }

  if (legARows.length === 0 || legBRows.length === 0) return null;
  return { legA: legARows[0], legB: legBRows[0] };
}

/**
 * Matches exposure in lots to GOLDM (100g) so cross-contract pairs remain delta-neutral.
 */
export function getMatchedLots(symbol: SupportedContractCode): number {
  const unitG = contractSpecs[symbol].tradingUnitGrams;
  return Math.max(1, Math.round(100 / unitG));
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
      status: 'AVAILABLE' | 'UNAVAILABLE_BEYOND_HISTORY';
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
  const snapshot = getSnapshotAsOf(asOfTimestamp, allRows);
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
        configHash: provenance.configHash,
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
      pairId === 'GOLDTEN_GOLDM' && snapshot.resolvedTradeDate < '2025-01-01'
        ? `GOLDTEN was listed on 2025-01-01; no quotation exists as of ${snapshot.resolvedTradeDate}.`
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
        configHash: provenance.configHash,
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
  const lotsA = getMatchedLots(legA.symbol);
  const lotsB = getMatchedLots(legB.symbol);

  const normA10g = normalizeContractBySymbol(legA.symbol, legA.settle);
  const normB10g = normalizeContractBySymbol(legB.symbol, legB.settle);

  const spread10gPureInr = Number((normA10g.normalized10gPrice - normB10g.normalized10gPrice).toFixed(2));
  const spread1g999Inr = Number((normA10g.normalized999PerGram - normB10g.normalized999PerGram).toFixed(4));
  const spreadBps =
    normA10g.normalized10gPrice > 0
      ? Number(((spread10gPureInr / normA10g.normalized10gPrice) * 10000).toFixed(2))
      : 0;

  // Check eligibility of both legs from Panel 2
  const eligA = snapshot.eligibility.find(
    (e) => e.symbol === legA.symbol && e.expiryDate === legA.expiryDate
  );
  const eligB = snapshot.eligibility.find(
    (e) => e.symbol === legB.symbol && e.expiryDate === legB.expiryDate
  );
  const liquidityOk = Boolean(
    legA.volume >= MIN_VOLUME_GATE && legB.volume >= MIN_VOLUME_GATE
  );
  const dataQualityOk = Boolean(
    snapshot.staleDays <= 3 &&
      eligA &&
      eligB &&
      !eligA.reasons.includes('ERR_CONTRACT_EXPIRED') &&
      !eligB.reasons.includes('ERR_CONTRACT_EXPIRED')
  );

  // Run EXISTING verdict engine on as_of snapshot
  const xrayResult = computeXRayWaterfall({
    contractA: legA.symbol,
    priceAQuoted: legA.settle,
    expiryA: legA.expiryDate,
    lotsA,
    contractB: legB.symbol,
    priceBQuoted: legB.settle,
    expiryB: legB.expiryDate,
    lotsB,
    tradeDate: snapshot.resolvedTradeDate,
    annualCarryRate: ANNUAL_REPO_RATE,
    settlementArtifactInrPerG: 0,
    costConfig,
    dataQualityOk,
    liquidityOk,
    trustFlags: [
      ...(eligA?.reasons ?? []),
      ...(eligB?.reasons ?? []),
      ...(legA.shortHistoryFlag || legB.shortHistoryFlag ? ['SHORT_HISTORY_GOLDTEN_JAN2025'] : []),
    ],
  });

  // Panel 4: Rolling window computed STRICTLY on snapshot.historyUpToAsOf (<= as_of)
  const datesUpToAsOf = Array.from(
    new Set(snapshot.historyUpToAsOf.map((r) => r.tradeDate))
  ).sort();
  const windowDates = datesUpToAsOf.slice(-ROLLING_SIGNAL_WINDOW);
  const residuals: number[] = [];

  for (const d of windowDates) {
    const dayRows = snapshot.historyUpToAsOf.filter((r) => r.tradeDate === d);
    const legs = selectPairLegs(dayRows, pairId);
    if (!legs) continue;
    const x = computeXRayWaterfall({
      contractA: legs.legA.symbol,
      priceAQuoted: legs.legA.settle,
      expiryA: legs.legA.expiryDate,
      lotsA: getMatchedLots(legs.legA.symbol),
      contractB: legs.legB.symbol,
      priceBQuoted: legs.legB.settle,
      expiryB: legs.legB.expiryDate,
      lotsB: getMatchedLots(legs.legB.symbol),
      tradeDate: d,
      annualCarryRate: ANNUAL_REPO_RATE,
      settlementArtifactInrPerG: 0,
      costConfig,
    });
    residuals.push(x.grossResidualInrPerG);
  }

  let rollingMean: number | null = null;
  let rollingStd: number | null = null;
  let zScore: number | null = null;
  if (residuals.length >= 2) {
    const mean = residuals.reduce((s, v) => s + v, 0) / residuals.length;
    const variance =
      residuals.reduce((s, v) => s + (v - mean) ** 2, 0) / (residuals.length - 1);
    const std = Math.sqrt(variance);
    rollingMean = Number(mean.toFixed(4));
    rollingStd = Number(std.toFixed(4));
    zScore = std > 1e-6 ? Number(((xrayResult.grossResidualInrPerG - mean) / std).toFixed(3)) : 0;
  }

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
    const allDates = Array.from(new Set(allRows.map((r) => r.tradeDate))).sort();
    const resolvedIdx = allDates.indexOf(snapshot.resolvedTradeDate);
    const horizonsToCheck = [1, 5, 10, 20];

    const entryIdx = resolvedIdx + 1; // signal at t, fill at t+1 (no look-ahead)
    const entryDate = entryIdx < allDates.length ? allDates[entryIdx] : null;
    const entryLegs = entryDate
      ? selectPairLegs(
          allRows.filter((r) => r.tradeDate === entryDate),
          pairId
        )
      : null;
    const entryXRay =
      entryDate && entryLegs
        ? computeXRayWaterfall({
            contractA: entryLegs.legA.symbol,
            priceAQuoted: entryLegs.legA.settle,
            expiryA: entryLegs.legA.expiryDate,
            lotsA: getMatchedLots(entryLegs.legA.symbol),
            contractB: entryLegs.legB.symbol,
            priceBQuoted: entryLegs.legB.settle,
            expiryB: entryLegs.legB.expiryDate,
            lotsB: getMatchedLots(entryLegs.legB.symbol),
            tradeDate: entryDate,
            annualCarryRate: ANNUAL_REPO_RATE,
            settlementArtifactInrPerG: 0,
            costConfig,
          })
        : null;

    const horizons = horizonsToCheck.map((h) => {
      const targetIdx = resolvedIdx + h;
      if (!entryDate || !entryXRay || targetIdx >= allDates.length) {
        return {
          horizonDays: h,
          targetDate: null,
          status: 'UNAVAILABLE_BEYOND_HISTORY' as const,
          entryFillDate: entryDate,
          spreadAtEntryInrPerG: entryXRay ? entryXRay.rawSpreadInrPerG : null,
          spreadAtHorizonInrPerG: null,
          grossPnlInrPerG: null,
          netPnlInrPerG: null,
          netPnlMatched100gInr: null,
        };
      }
      const targetDate = allDates[targetIdx];
      const targetLegs = selectPairLegs(
        allRows.filter((r) => r.tradeDate === targetDate),
        pairId
      );
      if (!targetLegs) {
        return {
          horizonDays: h,
          targetDate,
          status: 'UNAVAILABLE_BEYOND_HISTORY' as const,
          entryFillDate: entryDate,
          spreadAtEntryInrPerG: entryXRay.rawSpreadInrPerG,
          spreadAtHorizonInrPerG: null,
          grossPnlInrPerG: null,
          netPnlInrPerG: null,
          netPnlMatched100gInr: null,
        };
      }
      const targetNormA = normalizeContractBySymbol(
        targetLegs.legA.symbol,
        targetLegs.legA.settle
      );
      const targetNormB = normalizeContractBySymbol(
        targetLegs.legB.symbol,
        targetLegs.legB.settle
      );
      const spreadAtHorizon = Number(
        (targetNormA.normalized999PerGram - targetNormB.normalized999PerGram).toFixed(4)
      );
      // Mean-reversion convergence captured vs entry spread minus paired round-trip costs
      const grossPnlPerG = Number(
        (entryXRay.grossResidualInrPerG - (spreadAtHorizon - entryXRay.rawSpreadInrPerG)).toFixed(4)
      );
      const netPnlPerG = Number((grossPnlPerG - entryXRay.transactionCostsInrPerG).toFixed(4));
      return {
        horizonDays: h,
        targetDate,
        status: 'AVAILABLE' as const,
        entryFillDate: entryDate,
        spreadAtEntryInrPerG: entryXRay.rawSpreadInrPerG,
        spreadAtHorizonInrPerG: spreadAtHorizon,
        grossPnlInrPerG: grossPnlPerG,
        netPnlInrPerG: netPnlPerG,
        netPnlMatched100gInr: Number((netPnlPerG * 100).toFixed(2)),
      };
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
      barsInWindow: residuals.length,
      rollingMeanResidualInrPerG: rollingMean,
      rollingStdResidualInrPerG: rollingStd,
      currentResidualInrPerG: xrayResult.grossResidualInrPerG,
      zScoreAtAsOf: zScore,
      entryZScoreThreshold: ENTRY_ZSCORE_THRESHOLD,
      signalTriggered: zScore !== null && zScore > ENTRY_ZSCORE_THRESHOLD && xrayResult.verdict === 'TRADABLE',
      annualCarryRate: ANNUAL_REPO_RATE,
      expiryDaysDiff,
      trainingCutoffDate: provenance.trainingEndDate,
      configHash: provenance.configHash,
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
  winRatePct: number;
  profitFactor: number | null;
  cumulativeNetPnlInr: number;
  cumulativeGrossPnlInr: number;
  totalCostDragInr: number;
}

export interface FullPeriodReplaySummary {
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

const fullSummaryCache = new Map<ReplayPairId, FullPeriodReplaySummary>();

export function computeFullReplaySummary(
  pairId: ReplayPairId = 'GOLDM_CALENDAR',
  sourceRows?: HistoricalBhavcopyRow[]
): FullPeriodReplaySummary {
  if (!sourceRows && fullSummaryCache.has(pairId)) {
    return fullSummaryCache.get(pairId)!;
  }

  const allRows = sourceRows ?? loadHistoricalBhavcopyRows();
  const allDates = Array.from(new Set(allRows.map((r) => r.tradeDate))).sort();

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
    wins: 0,
    grossProfit: 0,
    grossLoss: 0,
    cumulativeNetPnlInr: 0,
    cumulativeGrossPnlInr: 0,
    totalCostDragInr: 0,
  });

  const trainAcc = initStats('TRAINING', allDates[0] ?? '2024-01-01', TRAINING_END_DATE);
  const holdAcc = initStats(
    'SEALED_HOLDOUT',
    HOLDOUT_START_DATE,
    allDates[allDates.length - 1] ?? '2025-06-30'
  );

  // Strict chronological bar-by-bar replay: signal at bar t filled at bar t+1 (100g matched notional)
  for (let i = 0; i < allDates.length; i++) {
    const date = allDates[i];
    const dayRows = allRows.filter((r) => r.tradeDate === date);
    const legs = selectPairLegs(dayRows, pairId);
    const isHoldout = date >= HOLDOUT_START_DATE;
    const acc = isHoldout ? holdAcc : trainAcc;
    acc.totalBars++;

    if (!legs) {
      acc.blockedBars++;
      equityCurve.push({
        date,
        partition: isHoldout ? 'SEALED_HOLDOUT' : 'TRAINING',
        verdict: 'UNAVAILABLE',
        grossResidualBps: 0,
        netEdgeBps: 0,
        cumulativeNetPnlInr: Number(cumNet.toFixed(2)),
        cumulativeGrossPnlInr: Number(cumGross.toFixed(2)),
      });
      continue;
    }

    const xray = computeXRayWaterfall({
      contractA: legs.legA.symbol,
      priceAQuoted: legs.legA.settle,
      expiryA: legs.legA.expiryDate,
      lotsA: getMatchedLots(legs.legA.symbol),
      contractB: legs.legB.symbol,
      priceBQuoted: legs.legB.settle,
      expiryB: legs.legB.expiryDate,
      lotsB: getMatchedLots(legs.legB.symbol),
      tradeDate: date,
      annualCarryRate: ANNUAL_REPO_RATE,
      settlementArtifactInrPerG: 0,
      costConfig: DEFAULT_COST_CONFIG,
      liquidityOk: legs.legA.volume >= MIN_VOLUME_GATE && legs.legB.volume >= MIN_VOLUME_GATE,
    });

    if (xray.verdict === 'TRADABLE') acc.tradableSignals++;
    else if (xray.verdict === 'WATCH') acc.watchSignals++;
    else if (xray.verdict === 'NO EDGE') acc.noEdgeBars++;
    else acc.blockedBars++;

    // Only execute when verdict is TRADABLE, filled at next bar (i + 1) to prevent look-ahead
    if (xray.verdict === 'TRADABLE' && i + 1 < allDates.length) {
      const nextDate = allDates[i + 1];
      const nextLegs = selectPairLegs(
        allRows.filter((r) => r.tradeDate === nextDate),
        pairId
      );
      if (nextLegs) {
        const nextXRay = computeXRayWaterfall({
          contractA: nextLegs.legA.symbol,
          priceAQuoted: nextLegs.legA.settle,
          expiryA: nextLegs.legA.expiryDate,
          lotsA: getMatchedLots(nextLegs.legA.symbol),
          contractB: nextLegs.legB.symbol,
          priceBQuoted: nextLegs.legB.settle,
          expiryB: nextLegs.legB.expiryDate,
          lotsB: getMatchedLots(nextLegs.legB.symbol),
          tradeDate: nextDate,
          annualCarryRate: ANNUAL_REPO_RATE,
          settlementArtifactInrPerG: 0,
          costConfig: DEFAULT_COST_CONFIG,
        });
        const tradeGross = nextXRay.grossResidualInrPerG * 100;
        const tradeCost = nextXRay.transactionCostsInrPerG * 100;
        const tradeNet = tradeGross - tradeCost;

        acc.executedTrades++;
        if (tradeNet > 0) {
          acc.wins++;
          acc.grossProfit += tradeNet;
        } else {
          acc.grossLoss += Math.abs(tradeNet);
        }
        acc.cumulativeGrossPnlInr += tradeGross;
        acc.cumulativeNetPnlInr += tradeNet;
        acc.totalCostDragInr += tradeCost;

        cumGross += tradeGross;
        cumNet += tradeNet;
      }
    }

    equityCurve.push({
      date,
      partition: isHoldout ? 'SEALED_HOLDOUT' : 'TRAINING',
      verdict: xray.verdict,
      grossResidualBps: xray.grossResidualBps,
      netEdgeBps: xray.netEdgeBps,
      cumulativeNetPnlInr: Number(cumNet.toFixed(2)),
      cumulativeGrossPnlInr: Number(cumGross.toFixed(2)),
    });
  }

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
    winRatePct:
      acc.executedTrades > 0 ? Number(((acc.wins / acc.executedTrades) * 100).toFixed(1)) : 0,
    profitFactor:
      acc.grossLoss > 0
        ? Number((acc.grossProfit / acc.grossLoss).toFixed(2))
        : acc.grossProfit > 0
          ? Number(acc.grossProfit.toFixed(2))
          : null,
    cumulativeNetPnlInr: Number(acc.cumulativeNetPnlInr.toFixed(2)),
    cumulativeGrossPnlInr: Number(acc.cumulativeGrossPnlInr.toFixed(2)),
    totalCostDragInr: Number(acc.totalCostDragInr.toFixed(2)),
  });

  const summary: FullPeriodReplaySummary = {
    pairId,
    pairLabel: REPLAY_PAIRS[pairId].label,
    allDates,
    trainingBoundaryDate: TRAINING_END_DATE,
    holdoutStartDate: HOLDOUT_START_DATE,
    trainingStats: finalizeStats(trainAcc),
    holdoutStats: finalizeStats(holdAcc),
    equityCurve,
  };

  if (!sourceRows) {
    fullSummaryCache.set(pairId, summary);
  }
  return summary;
}
