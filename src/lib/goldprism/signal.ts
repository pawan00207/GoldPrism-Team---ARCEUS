/**
 * Signal Intelligence & Best Vehicle Ranking — GoldPrism
 * =======================================================
 * 1. Rolling statistics, z-score, and cost hurdle gates.
 * 2. Best-Vehicle ranking for target exposure in grams.
 *
 * Team ARCEUS · Hack in Hills '26 · Track 03: Commodity Derivatives Intelligence
 */

import { CONTRACT_MASTER, getContractSpec, SupportedContractCode } from './contract-master';
import { calculateTransactionCosts, CostModelConfig, DEFAULT_COST_CONFIG } from './transaction-costs';

export interface VehicleRank {
  rank: number;
  contractCode: SupportedContractCode;
  name: string;
  tradingUnitG: number;
  purityFine: number;
  quoteUnitG: number;
  targetExposureG: number;
  lotsRequired: number;
  actualExposureG: number;
  exposureMismatchG: number;
  exposureMismatchPct: number;
  estimatedCostPerGramInr: number;
  estimatedCostBps: number;
  totalRoundTripInr: number;
  compositeScore: number; // 0 to 100 (higher is better)
  isWinner: boolean;
  rationale: string;
}

export function rankBestVehicleForExposure(
  targetExposureG: number,
  quotedPrices: Record<SupportedContractCode, number> = {
    GOLDM: 73510.0,
    GOLDTEN: 74080.0,
    GOLDGUINEA: 59250.0,
    GOLDPETAL: 7410.0,
  },
  costConfig: CostModelConfig = DEFAULT_COST_CONFIG
): VehicleRank[] {
  const contracts: SupportedContractCode[] = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'];
  const candidates: Array<Omit<VehicleRank, 'rank' | 'compositeScore' | 'isWinner' | 'rationale'> & { rawCostScore: number; rawMismatchScore: number }> = [];

  for (const code of contracts) {
    const spec = getContractSpec(code);
    const lotGrams = spec.tradingUnitG * spec.lotSize;
    const price = quotedPrices[code] || 74000;

    // Required lots
    const lots = Math.max(1, Math.round(targetExposureG / lotGrams));
    const actualExposureG = lots * lotGrams;
    const mismatchG = Math.abs(actualExposureG - targetExposureG);
    const mismatchPct = targetExposureG > 0 ? (mismatchG / targetExposureG) * 100 : 0;

    const costs = calculateTransactionCosts(price, code, lots, costConfig);

    candidates.push({
      contractCode: code,
      name: spec.name,
      tradingUnitG: spec.tradingUnitG,
      purityFine: spec.purityFine,
      quoteUnitG: spec.quoteUnitG,
      targetExposureG,
      lotsRequired: lots,
      actualExposureG,
      exposureMismatchG: Number(mismatchG.toFixed(1)),
      exposureMismatchPct: Number(mismatchPct.toFixed(1)),
      estimatedCostPerGramInr: costs.totalCostPerGramInr,
      estimatedCostBps: costs.totalCostBps,
      totalRoundTripInr: costs.totalRoundTripInr,
      rawCostScore: costs.totalCostPerGramInr,
      rawMismatchScore: mismatchPct,
    });
  }

  // Scoring weights: 40% cost efficiency, 45% exposure match, 15% granularity
  const maxMismatch = Math.max(...candidates.map((c) => c.rawMismatchScore), 1);
  const maxCost = Math.max(...candidates.map((c) => c.rawCostScore), 1);
  const minCost = Math.min(...candidates.map((c) => c.rawCostScore));

  const scored = candidates.map((c) => {
    // normalized 0-1 (higher is better)
    const mismatchScore = 1 - c.rawMismatchScore / maxMismatch;
    const costScore = maxCost > minCost ? 1 - (c.rawCostScore - minCost) / (maxCost - minCost) : 1;
    const granularityScore = c.tradingUnitG <= 10 ? 1 : c.tradingUnitG <= 50 ? 0.7 : 0.4;

    const composite = mismatchScore * 45 + costScore * 40 + granularityScore * 15;

    return {
      ...c,
      compositeScore: Number(composite.toFixed(1)),
    };
  });

  // Sort descending by score
  scored.sort((a, b) => b.compositeScore - a.compositeScore);

  return scored.map((s, idx) => {
    const rank = idx + 1;
    let rationale = '';

    if (s.exposureMismatchPct === 0) {
      rationale = `Exact zero exposure mismatch (${s.actualExposureG}g target matched with ${s.lotsRequired} lot(s)). Excellent hedge precision.`;
    } else if (s.exposureMismatchPct < 15) {
      rationale = `Tight exposure fit (only ${s.exposureMismatchPct}% delta). Competitive ${s.estimatedCostBps} bps transaction friction.`;
    } else {
      rationale = `Significant lumpiness penalty (${s.exposureMismatchPct}% exposure mismatch due to ${s.tradingUnitG}g lot size).`;
    }

    return {
      rank,
      contractCode: s.contractCode,
      name: s.name,
      tradingUnitG: s.tradingUnitG,
      purityFine: s.purityFine,
      quoteUnitG: s.quoteUnitG,
      targetExposureG: s.targetExposureG,
      lotsRequired: s.lotsRequired,
      actualExposureG: s.actualExposureG,
      exposureMismatchG: s.exposureMismatchG,
      exposureMismatchPct: s.exposureMismatchPct,
      estimatedCostPerGramInr: s.estimatedCostPerGramInr,
      estimatedCostBps: s.estimatedCostBps,
      totalRoundTripInr: s.totalRoundTripInr,
      compositeScore: s.compositeScore,
      isWinner: rank === 1,
      rationale,
    };
  });
}
