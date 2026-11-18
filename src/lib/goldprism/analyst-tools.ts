/**
 * Deterministic Quantitative Tool Suite for Gold Research Analyst
 * ================================================================
 * Every function returns strictly typed JSON with:
 *   - artifactId (unique traceable identifier)
 *   - source (exact dataset / engine module)
 *   - asOf (exact trading date timestamp)
 *   - validated numeric metrics computed by GoldPrism's deterministic engines
 *
 * The LLM NEVER computes or invents numbers — it only explains these artifacts.
 */

import { SupportedContractCode } from './contract-master';
import {
  contractSpecs,
  normalizeContractBySymbol,
} from './contract-specs';
import {
  ANNUAL_REPO_RATE,
  computeReplayAtDate,
  getMatchedLots,
  getSnapshotAsOf,
  loadDatasetProvenance,
  loadHistoricalBhavcopyRows,
  MIN_VOLUME_GATE,
  REPLAY_PAIRS,
  ReplayPairId,
} from './historical-store';
import { CostModelConfig, DEFAULT_COST_CONFIG } from './transaction-costs';
import { computeXRayWaterfall, DEFAULT_COST_HURDLE_BPS } from './xray';

export interface ToolArtifactBase {
  artifactId: string;
  toolName:
    | 'compareContracts'
    | 'liquidityRanking'
    | 'explainVerdict'
    | 'costSensitivity'
    | 'strongestSurvivingOpportunity';
  asOf: string;
  source: string;
  status: 'OK' | 'NO_DATA';
  message?: string;
}

export interface CompareContractsResult extends ToolArtifactBase {
  toolName: 'compareContracts';
  contractA: SupportedContractCode;
  contractB: SupportedContractCode;
  quotedPriceA: number | null;
  quotedPriceB: number | null;
  expiryA: string | null;
  expiryB: string | null;
  normalized10gA: number | null;
  normalized10gB: number | null;
  rawQuotedDiffPer10g: number | null;
  normalizedPremium10g: number | null;
  normalizedPremiumBps: number | null;
  decomposition: {
    purityEffectInrPerG: number;
    purityEffectBps: number;
    expiryCarryInrPerG: number;
    expiryCarryBps: number;
    residualOtherInrPerG: number;
    residualOtherBps: number;
    transactionCostsBps: number;
    netEdgeBps: number;
    verdict: string;
  } | null;
}

export function compareContracts(
  contractA: SupportedContractCode,
  contractB: SupportedContractCode,
  asOf?: string
): CompareContractsResult {
  const provenance = loadDatasetProvenance();
  const targetDate = asOf ?? provenance.dateRangeEnd;
  const snapshot = getSnapshotAsOf(targetDate);

  if (!snapshot.resolvedTradeDate) {
    return {
      artifactId: `ART-CMP-${contractA}-${contractB}-${targetDate}`,
      toolName: 'compareContracts',
      asOf: targetDate,
      source: provenance.datasetName,
      status: 'NO_DATA',
      message: `No Bhavcopy records exist on or before ${targetDate}.`,
      contractA,
      contractB,
      quotedPriceA: null,
      quotedPriceB: null,
      expiryA: null,
      expiryB: null,
      normalized10gA: null,
      normalized10gB: null,
      rawQuotedDiffPer10g: null,
      normalizedPremium10g: null,
      normalizedPremiumBps: null,
      decomposition: null,
    };
  }

  const rowsA = snapshot.recordsOnResolvedDate
    .filter((r) => r.symbol === contractA)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  const rowsB = snapshot.recordsOnResolvedDate
    .filter((r) => r.symbol === contractB)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  if (rowsA.length === 0 || rowsB.length === 0) {
    return {
      artifactId: `ART-CMP-${contractA}-${contractB}-${snapshot.resolvedTradeDate}`,
      toolName: 'compareContracts',
      asOf: snapshot.resolvedTradeDate,
      source: provenance.datasetName,
      status: 'NO_DATA',
      message: `Contract ${rowsA.length === 0 ? contractA : contractB} has no record on ${snapshot.resolvedTradeDate}.`,
      contractA,
      contractB,
      quotedPriceA: null,
      quotedPriceB: null,
      expiryA: null,
      expiryB: null,
      normalized10gA: null,
      normalized10gB: null,
      rawQuotedDiffPer10g: null,
      normalizedPremium10g: null,
      normalizedPremiumBps: null,
      decomposition: null,
    };
  }

  const legA = rowsA[0];
  const legB = contractA === contractB && rowsB.length > 1 ? rowsB[1] : rowsB[0];

  const normA = normalizeContractBySymbol(legA.symbol, legA.settle);
  const normB = normalizeContractBySymbol(legB.symbol, legB.settle);

  const xray = computeXRayWaterfall({
    contractA: legA.symbol,
    priceAQuoted: legA.settle,
    expiryA: legA.expiryDate,
    lotsA: getMatchedLots(legA.symbol),
    contractB: legB.symbol,
    priceBQuoted: legB.settle,
    expiryB: legB.expiryDate,
    lotsB: getMatchedLots(legB.symbol),
    tradeDate: snapshot.resolvedTradeDate,
    annualCarryRate: ANNUAL_REPO_RATE,
  });

  const rawPer10gA = (legA.settle / contractSpecs[legA.symbol].quotedPerGrams) * 10;
  const rawPer10gB = (legB.settle / contractSpecs[legB.symbol].quotedPerGrams) * 10;
  const normalizedPremium10g = Number(
    (normA.normalized10gPrice - normB.normalized10gPrice).toFixed(2)
  );
  const normalizedPremiumBps = Number(
    ((normalizedPremium10g / normB.normalized10gPrice) * 10000).toFixed(2)
  );

  return {
    artifactId: `ART-CMP-${contractA}-${contractB}-${snapshot.resolvedTradeDate}`,
    toolName: 'compareContracts',
    asOf: snapshot.resolvedTradeDate,
    source: `${provenance.datasetName} (${provenance.sha256Hash.slice(0, 12)})`,
    status: 'OK',
    contractA,
    contractB,
    quotedPriceA: legA.settle,
    quotedPriceB: legB.settle,
    expiryA: legA.expiryDate,
    expiryB: legB.expiryDate,
    normalized10gA: normA.normalized10gPrice,
    normalized10gB: normB.normalized10gPrice,
    rawQuotedDiffPer10g: Number((rawPer10gA - rawPer10gB).toFixed(2)),
    normalizedPremium10g,
    normalizedPremiumBps,
    decomposition: {
      purityEffectInrPerG: xray.structuralBasisInrPerG,
      purityEffectBps: xray.structuralBasisBps,
      expiryCarryInrPerG: xray.expiryCarryInrPerG,
      expiryCarryBps: xray.expiryCarryBps,
      residualOtherInrPerG: xray.grossResidualInrPerG,
      residualOtherBps: xray.grossResidualBps,
      transactionCostsBps: xray.transactionCostsBps,
      netEdgeBps: xray.netEdgeBps,
      verdict: xray.verdict,
    },
  };
}

export interface LiquidityRankingResult extends ToolArtifactBase {
  toolName: 'liquidityRanking';
  rankings: Array<{
    rank: number;
    symbol: SupportedContractCode;
    tradingUnitG: number;
    totalVolumeContracts: number;
    totalOpenInterestContracts: number;
    gramEquivalentVolume: number;
    gramEquivalentOI: number;
    activeExpiries: number;
    nearExpiry: string;
    passesVolumeGate: boolean;
  }>;
  bestContractByLots: SupportedContractCode | null;
  bestContractByGramNotional: SupportedContractCode | null;
}

export function liquidityRanking(asOf?: string): LiquidityRankingResult {
  const provenance = loadDatasetProvenance();
  const targetDate = asOf ?? provenance.dateRangeEnd;
  const snapshot = getSnapshotAsOf(targetDate);

  if (!snapshot.resolvedTradeDate || snapshot.recordsOnResolvedDate.length === 0) {
    return {
      artifactId: `ART-LIQ-${targetDate}`,
      toolName: 'liquidityRanking',
      asOf: targetDate,
      source: provenance.datasetName,
      status: 'NO_DATA',
      message: `No Bhavcopy volume/OI data available on or before ${targetDate}.`,
      rankings: [],
      bestContractByLots: null,
      bestContractByGramNotional: null,
    };
  }

  const grouped = new Map<
    SupportedContractCode,
    { vol: number; oi: number; expiries: string[] }
  >();
  for (const r of snapshot.recordsOnResolvedDate) {
    const cur = grouped.get(r.symbol) ?? { vol: 0, oi: 0, expiries: [] };
    cur.vol += r.volume;
    cur.oi += r.openInterest;
    cur.expiries.push(r.expiryDate);
    grouped.set(r.symbol, cur);
  }

  const rows = Array.from(grouped.entries()).map(([symbol, agg]) => {
    const unitG = contractSpecs[symbol].tradingUnitGrams;
    const sortedExp = [...agg.expiries].sort();
    return {
      symbol,
      tradingUnitG: unitG,
      totalVolumeContracts: agg.vol,
      totalOpenInterestContracts: agg.oi,
      gramEquivalentVolume: agg.vol * unitG,
      gramEquivalentOI: agg.oi * unitG,
      activeExpiries: sortedExp.length,
      nearExpiry: sortedExp[0],
      passesVolumeGate: agg.vol >= MIN_VOLUME_GATE,
    };
  });

  rows.sort((a, b) => b.gramEquivalentVolume - a.gramEquivalentVolume);
  const byLots = [...rows].sort((a, b) => b.totalVolumeContracts - a.totalVolumeContracts);

  return {
    artifactId: `ART-LIQ-${snapshot.resolvedTradeDate}`,
    toolName: 'liquidityRanking',
    asOf: snapshot.resolvedTradeDate,
    source: `${provenance.datasetName} (${provenance.sha256Hash.slice(0, 12)})`,
    status: 'OK',
    rankings: rows.map((r, i) => ({ rank: i + 1, ...r })),
    bestContractByLots: byLots[0]?.symbol ?? null,
    bestContractByGramNotional: rows[0]?.symbol ?? null,
  };
}

export interface ExplainVerdictResult extends ToolArtifactBase {
  toolName: 'explainVerdict';
  signalId: string;
  pairId: ReplayPairId;
  verdict: string | null;
  verdictTitle: string | null;
  verdictMessage: string | null;
  failingFilters: string[];
  reasonCodes: string[];
  waterfall: {
    rawSpreadBps: number;
    structuralBasisBps: number;
    expiryCarryBps: number;
    settlementArtifactBps: number;
    grossResidualBps: number;
    transactionCostsBps: number;
    netEdgeBps: number;
    costHurdleBps: number;
  } | null;
}

/**
 * Signal ID format: "<YYYY-MM-DD>:<PAIR_ID>" or "latest" / "latest:<PAIR_ID>".
 */
export function explainVerdict(signalId: string): ExplainVerdictResult {
  const provenance = loadDatasetProvenance();
  const [rawDate, rawPair] = signalId.split(':');
  const asOf = !rawDate || rawDate.toLowerCase() === 'latest' ? provenance.dateRangeEnd : rawDate;
  const pairId: ReplayPairId =
    rawPair && rawPair in REPLAY_PAIRS
      ? (rawPair as ReplayPairId)
      : 'GOLDTEN_GOLDM';

  const replay = computeReplayAtDate(asOf, { pairId, reveal: false });
  if (!replay.panel5Verdict || !replay.resolvedTradeDate) {
    return {
      artifactId: `ART-VRD-${pairId}-${asOf}`,
      toolName: 'explainVerdict',
      asOf,
      source: provenance.datasetName,
      status: 'NO_DATA',
      message: replay.panel3NormalizedSpread.unavailableReason ?? 'Signal snapshot unavailable.',
      signalId,
      pairId,
      verdict: null,
      verdictTitle: null,
      verdictMessage: null,
      failingFilters: ['DATA_UNAVAILABLE'],
      reasonCodes: [],
      waterfall: null,
    };
  }

  const v = replay.panel5Verdict;
  const failingFilters: string[] = [];
  if (v.netEdgeInrPerG <= 0) {
    failingFilters.push(
      `NET_EDGE_NON_POSITIVE (Gross residual ${v.grossResidualBps} bps − costs ${v.transactionCostsBps} bps = ${v.netEdgeBps} bps <= 0)`
    );
  } else if (v.netEdgeBps < DEFAULT_COST_HURDLE_BPS) {
    failingFilters.push(
      `BELOW_COST_HURDLE (Net edge ${v.netEdgeBps} bps < ${DEFAULT_COST_HURDLE_BPS} bps hurdle)`
    );
  }
  if (!replay.panel4ModelState.signalTriggered) {
    failingFilters.push(
      `ZSCORE_OR_HURDLE_NOT_MET (z=${replay.panel4ModelState.zScoreAtAsOf ?? 'N/A'}, threshold=${replay.panel4ModelState.entryZScoreThreshold})`
    );
  }
  if (!v.reconciliationOk) {
    failingFilters.push(`RECONCILIATION_ERROR (${v.reconciliationError} INR/g)`);
  }

  return {
    artifactId: `ART-VRD-${pairId}-${replay.resolvedTradeDate}`,
    toolName: 'explainVerdict',
    asOf: replay.resolvedTradeDate,
    source: `${provenance.datasetName} + computeXRayWaterfall (${v.configHash})`,
    status: 'OK',
    signalId: `${replay.resolvedTradeDate}:${pairId}`,
    pairId,
    verdict: v.verdict,
    verdictTitle: v.verdictTitle,
    verdictMessage: v.verdictMessage,
    failingFilters,
    reasonCodes: v.reasonCodes,
    waterfall: {
      rawSpreadBps: v.rawSpreadBps,
      structuralBasisBps: v.structuralBasisBps,
      expiryCarryBps: v.expiryCarryBps,
      settlementArtifactBps: v.settlementArtifactBps,
      grossResidualBps: v.grossResidualBps,
      transactionCostsBps: v.transactionCostsBps,
      netEdgeBps: v.netEdgeBps,
      costHurdleBps: DEFAULT_COST_HURDLE_BPS,
    },
  };
}

export interface CostSensitivityResult extends ToolArtifactBase {
  toolName: 'costSensitivity';
  multiplier: number;
  pairId: ReplayPairId;
  baselineCostsInrPerG: number | null;
  baselineCostsBps: number | null;
  baselineNetEdgeBps: number | null;
  baselineVerdict: string | null;
  scaledCostsInrPerG: number | null;
  scaledCostsBps: number | null;
  scaledNetEdgeBps: number | null;
  scaledVerdict: string | null;
  deltaCostsBps: number | null;
  deltaNetEdgeBps: number | null;
}

export function costSensitivity(
  multiplier: number,
  asOf?: string,
  pairId: ReplayPairId = 'GOLDTEN_GOLDM'
): CostSensitivityResult {
  const provenance = loadDatasetProvenance();
  const targetDate = asOf ?? provenance.dateRangeEnd;

  const baseReplay = computeReplayAtDate(targetDate, {
    pairId,
    costConfig: DEFAULT_COST_CONFIG,
  });

  if (!baseReplay.panel5Verdict || !baseReplay.resolvedTradeDate) {
    return {
      artifactId: `ART-COST-${multiplier}x-${pairId}-${targetDate}`,
      toolName: 'costSensitivity',
      asOf: targetDate,
      source: provenance.datasetName,
      status: 'NO_DATA',
      message: 'Baseline spread snapshot unavailable for cost sensitivity.',
      multiplier,
      pairId,
      baselineCostsInrPerG: null,
      baselineCostsBps: null,
      baselineNetEdgeBps: null,
      baselineVerdict: null,
      scaledCostsInrPerG: null,
      scaledCostsBps: null,
      scaledNetEdgeBps: null,
      scaledVerdict: null,
      deltaCostsBps: null,
      deltaNetEdgeBps: null,
    };
  }

  const scaledConfig: CostModelConfig = {
    ...DEFAULT_COST_CONFIG,
    brokeragePerLotInr: DEFAULT_COST_CONFIG.brokeragePerLotInr * multiplier,
    exchangeChargeRate: DEFAULT_COST_CONFIG.exchangeChargeRate * multiplier,
    cttRate: DEFAULT_COST_CONFIG.cttRate * multiplier,
    sebiChargeRate: DEFAULT_COST_CONFIG.sebiChargeRate * multiplier,
    stampDutyRate: DEFAULT_COST_CONFIG.stampDutyRate * multiplier,
    slippageBps: DEFAULT_COST_CONFIG.slippageBps * multiplier,
  };

  const scaledReplay = computeReplayAtDate(baseReplay.resolvedTradeDate, {
    pairId,
    costConfig: scaledConfig,
  });

  const baseV = baseReplay.panel5Verdict;
  const scaledV = scaledReplay.panel5Verdict!;

  return {
    artifactId: `ART-COST-${multiplier.toFixed(2)}x-${pairId}-${baseReplay.resolvedTradeDate}`,
    toolName: 'costSensitivity',
    asOf: baseReplay.resolvedTradeDate,
    source: `${provenance.datasetName} + calculateTransactionCosts`,
    status: 'OK',
    multiplier,
    pairId,
    baselineCostsInrPerG: baseV.transactionCostsInrPerG,
    baselineCostsBps: baseV.transactionCostsBps,
    baselineNetEdgeBps: baseV.netEdgeBps,
    baselineVerdict: baseV.verdict,
    scaledCostsInrPerG: scaledV.transactionCostsInrPerG,
    scaledCostsBps: scaledV.transactionCostsBps,
    scaledNetEdgeBps: scaledV.netEdgeBps,
    scaledVerdict: scaledV.verdict,
    deltaCostsBps: Number((scaledV.transactionCostsBps - baseV.transactionCostsBps).toFixed(2)),
    deltaNetEdgeBps: Number((scaledV.netEdgeBps - baseV.netEdgeBps).toFixed(2)),
  };
}

export interface StrongestSurvivingOpportunityResult extends ToolArtifactBase {
  toolName: 'strongestSurvivingOpportunity';
  totalSnapshotsEvaluated: number;
  survivingOpportunitiesCount: number;
  bestOpportunity: {
    tradeDate: string;
    pairId: ReplayPairId;
    pairLabel: string;
    partition: 'TRAINING' | 'SEALED_HOLDOUT';
    legA: string;
    legB: string;
    expiryA: string;
    expiryB: string;
    rawSpreadBps: number;
    structuralBasisBps: number;
    expiryCarryBps: number;
    grossResidualBps: number;
    transactionCostsBps: number;
    netEdgeBps: number;
    netEdgeInrPerG: number;
    verdict: string;
    configHash: string;
  } | null;
}

export function strongestSurvivingOpportunity(): StrongestSurvivingOpportunityResult {
  const provenance = loadDatasetProvenance();
  const rows = loadHistoricalBhavcopyRows();
  const dates = Array.from(new Set(rows.map((r) => r.tradeDate))).sort();
  const pairs: ReplayPairId[] = [
    'GOLDM_CALENDAR',
    'GOLDTEN_GOLDM',
    'GOLDGUINEA_GOLDM',
    'GOLDPETAL_GOLDM',
  ];

  let evaluated = 0;
  let survivingCount = 0;
  let best: StrongestSurvivingOpportunityResult['bestOpportunity'] = null;

  for (const d of dates) {
    const dayRows = rows.filter((r) => r.tradeDate === d);
    for (const pid of pairs) {
      const cfg = REPLAY_PAIRS[pid];
      const rowsA = dayRows
        .filter((r) => r.symbol === cfg.legA)
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
      const rowsB = dayRows
        .filter((r) => r.symbol === cfg.legB)
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

      const legA = pid === 'GOLDM_CALENDAR' ? rowsA[1] : rowsA[0];
      const legB = rowsB[0];
      if (!legA || !legB) continue;

      evaluated++;
      const xray = computeXRayWaterfall({
        contractA: legA.symbol,
        priceAQuoted: legA.settle,
        expiryA: legA.expiryDate,
        lotsA: getMatchedLots(legA.symbol),
        contractB: legB.symbol,
        priceBQuoted: legB.settle,
        expiryB: legB.expiryDate,
        lotsB: getMatchedLots(legB.symbol),
        tradeDate: d,
        annualCarryRate: ANNUAL_REPO_RATE,
        liquidityOk: legA.volume >= MIN_VOLUME_GATE && legB.volume >= MIN_VOLUME_GATE,
      });

      if (xray.verdict === 'TRADABLE' && xray.netEdgeBps > DEFAULT_COST_HURDLE_BPS) {
        survivingCount++;
        if (!best || xray.netEdgeBps > best.netEdgeBps) {
          best = {
            tradeDate: d,
            pairId: pid,
            pairLabel: cfg.label,
            partition: d >= provenance.holdoutStartDate ? 'SEALED_HOLDOUT' : 'TRAINING',
            legA: legA.symbol,
            legB: legB.symbol,
            expiryA: legA.expiryDate,
            expiryB: legB.expiryDate,
            rawSpreadBps: xray.rawSpreadBps,
            structuralBasisBps: xray.structuralBasisBps,
            expiryCarryBps: xray.expiryCarryBps,
            grossResidualBps: xray.grossResidualBps,
            transactionCostsBps: xray.transactionCostsBps,
            netEdgeBps: xray.netEdgeBps,
            netEdgeInrPerG: xray.netEdgeInrPerG,
            verdict: xray.verdict,
            configHash: xray.configHash,
          };
        }
      }
    }
  }

  if (!best) {
    return {
      artifactId: `ART-BEST-NONE-${provenance.dateRangeEnd}`,
      toolName: 'strongestSurvivingOpportunity',
      asOf: provenance.dateRangeEnd,
      source: `${provenance.datasetName} (${provenance.sha256Hash.slice(0, 12)})`,
      status: 'NO_DATA',
      message: 'Zero opportunities survived all cost and liquidity filters across the dataset.',
      totalSnapshotsEvaluated: evaluated,
      survivingOpportunitiesCount: 0,
      bestOpportunity: null,
    };
  }

  return {
    artifactId: `ART-BEST-${best.pairId}-${best.tradeDate}`,
    toolName: 'strongestSurvivingOpportunity',
    asOf: best.tradeDate,
    source: `${provenance.datasetName} (${provenance.sha256Hash.slice(0, 12)})`,
    status: 'OK',
    totalSnapshotsEvaluated: evaluated,
    survivingOpportunitiesCount: survivingCount,
    bestOpportunity: best,
  };
}
