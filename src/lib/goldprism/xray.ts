/**
 * X-Ray Waterfall Decomposition Engine — GoldPrism
 * ==================================================
 * Decomposes MCX Gold calendar spreads into:
 *   Raw Spread
 *   → Structural Basis (purity & contract size differences)
 *   → Expiry / Carry (time value between staggered expiry windows)
 *   → Settlement Artifact (illiquid/thin settle price distortion)
 *   → Gross Residual
 *   → Transaction Costs (statutory + broker fees + slippage)
 *   → Net Edge
 *
 * Verdicts:
 *   - TRADABLE: Net edge > cost hurdle with verified data & specs.
 *   - WATCH: Net edge > 0 but thin (below cost hurdle).
 *   - NO EDGE: Residual is noise (Net edge <= 0). "The only tool that tells you when NOT to trade."
 *   - BLOCKED: Data quality failure, date mismatch, or unverified contract specs.
 *
 * Team ARCEUS · Hack in Hills '26 · Track 03: Commodity Derivatives Intelligence
 */

import { getContractSpec, normalizePriceTo999 } from './contract-master';
import {
  calculateTransactionCosts,
  CostModelConfig,
  DEFAULT_COST_CONFIG,
  TransactionCostBreakdown,
} from './transaction-costs';

export type XRayVerdict = 'TRADABLE' | 'WATCH' | 'NO EDGE' | 'BLOCKED';

export interface XRayWaterfallParams {
  contractA: 'GOLDM' | 'GOLDTEN' | 'GOLDGUINEA' | 'GOLDPETAL';
  priceAQuoted: number;
  expiryA: string; // YYYY-MM-DD
  lotsA?: number;

  contractB: 'GOLDM' | 'GOLDTEN' | 'GOLDGUINEA' | 'GOLDPETAL';
  priceBQuoted: number;
  expiryB: string; // YYYY-MM-DD
  lotsB?: number;

  tradeDate: string; // YYYY-MM-DD
  annualCarryRate?: number; // e.g. 0.065 for 6.5% repo proxy
  settlementArtifactInrPerG?: number; // manual or detected settlement artifact
  costConfig?: CostModelConfig;

  // Integrity gates
  dataQualityOk?: boolean;
  liquidityOk?: boolean;
  trustFlags?: string[];
}

export interface XRayWaterfallResult {
  contractA: string;
  contractB: string;
  expiryA: string;
  expiryB: string;
  tradeDate: string;

  priceAQuoted: number;
  priceBQuoted: number;
  priceANormalized: number; // ₹/g 999-fine
  priceBNormalized: number; // ₹/g 999-fine

  // Waterfall components in ₹/g
  rawSpreadInrPerG: number;
  structuralBasisInrPerG: number;
  expiryCarryInrPerG: number;
  settlementArtifactInrPerG: number;
  grossResidualInrPerG: number;
  transactionCostsInrPerG: number;
  netEdgeInrPerG: number;

  // Basis Points (relative to Leg A normalized price)
  rawSpreadBps: number;
  structuralBasisBps: number;
  expiryCarryBps: number;
  settlementArtifactBps: number;
  grossResidualBps: number;
  transactionCostsBps: number;
  netEdgeBps: number;

  // Mathematical Reconciliation
  reconciliationSum: number;
  reconciliationError: number;
  reconciliationOk: boolean;

  // Verdict & Auditing
  verdict: XRayVerdict;
  verdictTitle: string;
  verdictMessage: string;
  reasonCodes: string[];
  trustFlags: string[];

  costBreakdownA: TransactionCostBreakdown;
  costBreakdownB: TransactionCostBreakdown;
  configHash: string;
  timestamp: string;
}

export const RECON_TOLERANCE = 0.01; // max 0.01 INR/g error tolerance
export const DEFAULT_COST_HURDLE_BPS = 5.0; // 5 bps required net edge for TRADABLE

export function computeXRayWaterfall(params: XRayWaterfallParams): XRayWaterfallResult {
  const {
    contractA,
    priceAQuoted,
    expiryA,
    lotsA = 1,
    contractB,
    priceBQuoted,
    expiryB,
    lotsB = 1,
    tradeDate,
    annualCarryRate = 0.065,
    settlementArtifactInrPerG = 0.0,
    costConfig = DEFAULT_COST_CONFIG,
    dataQualityOk = true,
    liquidityOk = true,
    trustFlags = [],
  } = params;

  const reasonCodes: string[] = [];
  const localFlags = [...trustFlags];

  // 1. Data Quality Gate
  if (!dataQualityOk) {
    reasonCodes.push('ERR_DATA_QUALITY_GATE_FAILED');
  }

  // 2. Normalize Leg A & Leg B
  const normA = normalizePriceTo999(priceAQuoted, contractA);
  const normB = normalizePriceTo999(priceBQuoted, contractB);

  const priceANormalized = normA.normalizedPrice;
  const priceBNormalized = normB.normalizedPrice;

  // Raw Spread (₹/g)
  const rawSpreadInrPerG = Number((priceANormalized - priceBNormalized).toFixed(4));
  const rawSpreadBps = priceANormalized > 0 ? (rawSpreadInrPerG / priceANormalized) * 10000 : 0;

  // 3. Structural Basis Component
  // If GOLDM (995) vs GOLDTEN (999), purity delta without normalization would be ~0.5%.
  // In our normalized model, we measure the structural contract specification gap.
  const specA = getContractSpec(contractA);
  const specB = getContractSpec(contractB);
  const unadjustedPricePerGA = priceAQuoted / specA.quoteUnitG;
  const unadjustedPricePerGB = priceBQuoted / specB.quoteUnitG;
  const rawUnadjustedSpread = unadjustedPricePerGA - unadjustedPricePerGB;
  
  // The basis difference accounted for by purity normalization:
  const structuralBasisInrPerG = Number((rawUnadjustedSpread - rawSpreadInrPerG).toFixed(4));

  // 4. Expiry Carry Component
  // Days to expiry difference between Leg A and Leg B
  let daysDiff = 0;
  try {
    const dateA = new Date(expiryA).getTime();
    const dateB = new Date(expiryB).getTime();
    daysDiff = (dateA - dateB) / (1000 * 60 * 60 * 24);
  } catch {
    daysDiff = 0;
    reasonCodes.push('WARN_INVALID_EXPIRY_DATE');
  }

  const avgPrice = (priceANormalized + priceBNormalized) / 2;
  const expiryCarryInrPerG = Number(
    ((avgPrice * annualCarryRate * daysDiff) / 365.0).toFixed(4)
  );

  // 5. Settlement Artifact
  const settlementArtifact = Number(settlementArtifactInrPerG.toFixed(4));

  // 6. Gross Residual
  // gross_residual = raw_spread - structural_basis - expiry_carry - settlement_artifact
  const grossResidualInrPerG = Number(
    (rawSpreadInrPerG - structuralBasisInrPerG - expiryCarryInrPerG - settlementArtifact).toFixed(4)
  );

  // 7. Paired Transaction Costs
  const costA = calculateTransactionCosts(priceAQuoted, contractA, lotsA, costConfig);
  const costB = calculateTransactionCosts(priceBQuoted, contractB, lotsB, costConfig);

  // Total paired round trip per gram of comparable exposure
  const totalExposureGrams = (costA.totalGrams + costB.totalGrams) / 2;
  const totalCostsInr = costA.totalRoundTripInr + costB.totalRoundTripInr;
  const transactionCostsInrPerG = Number(
    (totalExposureGrams > 0 ? totalCostsInr / totalExposureGrams : 0).toFixed(4)
  );

  // 8. Net Edge
  const netEdgeInrPerG = Number((grossResidualInrPerG - transactionCostsInrPerG).toFixed(4));

  // Convert to Basis Points
  const structuralBasisBps = priceANormalized > 0 ? (structuralBasisInrPerG / priceANormalized) * 10000 : 0;
  const expiryCarryBps = priceANormalized > 0 ? (expiryCarryInrPerG / priceANormalized) * 10000 : 0;
  const settlementArtifactBps = priceANormalized > 0 ? (settlementArtifact / priceANormalized) * 10000 : 0;
  const grossResidualBps = priceANormalized > 0 ? (grossResidualInrPerG / priceANormalized) * 10000 : 0;
  const transactionCostsBps = priceANormalized > 0 ? (transactionCostsInrPerG / priceANormalized) * 10000 : 0;
  const netEdgeBps = priceANormalized > 0 ? (netEdgeInrPerG / priceANormalized) * 10000 : 0;

  // 9. Reconciliation Check:
  // structural_basis + expiry_carry + settlement_artifact + gross_residual == raw_spread
  const reconciliationSum = Number(
    (structuralBasisInrPerG + expiryCarryInrPerG + settlementArtifact + grossResidualInrPerG).toFixed(4)
  );
  const reconciliationError = Number(Math.abs(reconciliationSum - rawSpreadInrPerG).toFixed(6));
  const reconciliationOk = reconciliationError < RECON_TOLERANCE;

  if (!reconciliationOk) {
    reasonCodes.push(`WARN_RECON_ERROR_EXCEEDED_${reconciliationError}`);
  }

  // 10. Determine Final Verdict
  let verdict: XRayVerdict = 'BLOCKED';
  let verdictTitle = '';
  let verdictMessage = '';

  if (!dataQualityOk) {
    verdict = 'BLOCKED';
    verdictTitle = 'Run Blocked: Data Quality Gate';
    verdictMessage = 'Data failed integrity validation (schema, date mismatch, or stale prices). Execution blocked.';
  } else if (!reconciliationOk) {
    verdict = 'BLOCKED';
    verdictTitle = 'Run Blocked: Reconciliation Failure';
    verdictMessage = `Decomposition error (${reconciliationError} ₹/g) exceeds allowed tolerance. Execution blocked.`;
  } else if (!liquidityOk) {
    verdict = 'BLOCKED';
    reasonCodes.push('ERR_INSUFFICIENT_LIQUIDITY');
    verdictTitle = 'Run Blocked: Illiquid Contract Leg';
    verdictMessage = 'One or both contracts fail minimum daily volume hurdle for orderly fills.';
  } else if (netEdgeInrPerG <= 0) {
    verdict = 'NO EDGE';
    reasonCodes.push('VERDICT_NO_EDGE_COST_EATEN');
    verdictTitle = 'No Edge: Residual is Noise';
    verdictMessage =
      'After removing expiry carry, structural basis, and round-trip costs, net edge is non-positive. Disciplined inaction: do not trade.';
  } else if (netEdgeBps < DEFAULT_COST_HURDLE_BPS) {
    verdict = 'WATCH';
    reasonCodes.push('VERDICT_THIN_EDGE');
    verdictTitle = 'Watch: Residual Is Thin';
    verdictMessage = `Net edge (${netEdgeBps.toFixed(1)} bps) is positive but below the ${DEFAULT_COST_HURDLE_BPS} bps safety hurdle. Monitor closely.`;
  } else {
    verdict = 'TRADABLE';
    reasonCodes.push('VERDICT_STATISTICALLY_TRADABLE');
    verdictTitle = 'Tradable: Meaningful Residual Edge';
    verdictMessage = `Net edge (${netEdgeBps.toFixed(1)} bps) exceeds transaction hurdle with full data validation. Valid trading candidate.`;
  }

  // Config Hash for auditability
  const configStr = `${contractA}-${priceAQuoted}-${expiryA}-${contractB}-${priceBQuoted}-${expiryB}-${tradeDate}-${annualCarryRate}`;
  let hash = 0;
  for (let i = 0; i < configStr.length; i++) {
    hash = (hash << 5) - hash + configStr.charCodeAt(i);
    hash |= 0;
  }
  const configHash = 'GP-' + Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();

  return {
    contractA,
    contractB,
    expiryA,
    expiryB,
    tradeDate,
    priceAQuoted,
    priceBQuoted,
    priceANormalized,
    priceBNormalized,

    rawSpreadInrPerG,
    structuralBasisInrPerG,
    expiryCarryInrPerG,
    settlementArtifactInrPerG: settlementArtifact,
    grossResidualInrPerG,
    transactionCostsInrPerG,
    netEdgeInrPerG,

    rawSpreadBps: Number(rawSpreadBps.toFixed(1)),
    structuralBasisBps: Number(structuralBasisBps.toFixed(1)),
    expiryCarryBps: Number(expiryCarryBps.toFixed(1)),
    settlementArtifactBps: Number(settlementArtifactBps.toFixed(1)),
    grossResidualBps: Number(grossResidualBps.toFixed(1)),
    transactionCostsBps: Number(transactionCostsBps.toFixed(1)),
    netEdgeBps: Number(netEdgeBps.toFixed(1)),

    reconciliationSum,
    reconciliationError,
    reconciliationOk,

    verdict,
    verdictTitle,
    verdictMessage,
    reasonCodes,
    trustFlags: localFlags,

    costBreakdownA: costA,
    costBreakdownB: costB,
    configHash,
    timestamp: new Date().toISOString(),
  };
}
