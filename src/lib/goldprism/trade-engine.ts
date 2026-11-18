/**
 * One-Click Paper Trade & Pre-Trade Clarity Engine — GoldPrism
 * ==============================================================
 * Deterministic, pure TypeScript engine for:
 *   1. Sizing single-contract hedges or paired calendar spreads
 *   2. Computing exact itemized MCX statutory costs via `calculateTransactionCosts`
 *   3. Calculating SPAN + ELM margin proxy (9.5% of gross notional)
 *   4. Evaluating pre-trade X-Ray verdict gates (TRADABLE / WATCH / NO EDGE / BLOCKED)
 *   5. Real-time Mark-to-Market P&L on open positions against live parity quotes
 */

import { calculateExposureInr, SupportedContractCode } from './contract-master';
import { contractSpecs, normalizeContractBySymbol } from './contract-specs';
import { calculateTransactionCosts, DEFAULT_COST_CONFIG } from './transaction-costs';
import { XRayVerdict } from './xray';

export const INITIAL_PAPER_CAPITAL_INR = 1_000_000; // ₹10,00,000 virtual MCX margin capital
export const MCX_MARGIN_RATE = 0.095; // ~9.5% standard MCX Gold SPAN + ELM margin proxy

export type TradeKind = 'SPREAD' | 'SINGLE';
export type TradeSide = 'BUY' | 'SELL' | 'SHORT_A_LONG_B' | 'LONG_A_SHORT_B';

export interface TradeIntentInput {
  kind: TradeKind;
  side: TradeSide;
  contractA: SupportedContractCode;
  priceA: number;
  lotsA: number;
  expiryA: string;

  // Optional Leg B (for SPREAD trades)
  contractB?: SupportedContractCode;
  priceB?: number;
  lotsB?: number;
  expiryB?: string;

  // Optional X-Ray telemetry from upstream decision surface
  verdict?: XRayVerdict;
  netEdgeBps?: number;
  netEdgeInrPerG?: number;
  rationale?: string;
  sourceLabel?: string;
  asOf?: string;
}

export interface EvaluatedTradePlan {
  kind: TradeKind;
  side: TradeSide;
  headline: string;
  plainEnglishSummary: string;
  verdict: XRayVerdict | 'DIRECT_HEDGE';
  requiresDisciplineOverride: boolean;
  warningReason: string | null;

  contractA: SupportedContractCode;
  priceA: number;
  lotsA: number;
  gramsA: number;
  notionalAInr: number;
  normalized10gA: number;
  expiryA: string;

  contractB?: SupportedContractCode;
  priceB?: number;
  lotsB?: number;
  gramsB?: number;
  notionalBInr?: number;
  normalized10gB?: number;
  expiryB?: string;

  totalExposureGrams: number;
  grossNotionalInr: number;
  marginRequiredInr: number;
  estimatedFeeInr: number;
  estimatedFeeBps: number;
  expectedNetEdgeInr: number | null;
  expectedNetEdgeBps: number | null;
  sourceLabel: string;
  asOf: string;

  stepsChecklist: Array<{
    step: string;
    title: string;
    detail: string;
  }>;
}

export interface PaperPosition {
  id: string;
  openedAt: string;
  asOfPrice: string;
  sourceLabel: string;
  kind: TradeKind;
  side: TradeSide;
  headline: string;
  verdictAtEntry: XRayVerdict | 'DIRECT_HEDGE';
  disciplineOverridden: boolean;

  contractA: SupportedContractCode;
  entryPriceA: number;
  lotsA: number;
  gramsA: number;
  expiryA: string;

  contractB?: SupportedContractCode;
  entryPriceB?: number;
  lotsB?: number;
  gramsB?: number;
  expiryB?: string;

  marginBlockedInr: number;
  entryFeeInr: number;
  rationale: string;
}

export interface ClosedPaperTrade extends PaperPosition {
  closedAt: string;
  exitPriceA: number;
  exitPriceB?: number;
  exitFeeInr: number;
  grossPnlInr: number;
  netPnlInr: number;
  returnOnMarginPct: number;
}

export interface LivePositionValuation {
  currentPriceA: number;
  currentPriceB?: number;
  grossPnlInr: number;
  estimatedExitFeeInr: number;
  netMtmPnlInr: number;
  returnOnMarginPct: number;
}

export function estimateMarginRequiredInr(grossNotionalInr: number, kind: TradeKind): number {
  if (!Number.isFinite(grossNotionalInr) || grossNotionalInr <= 0) return 0;
  // Calendar / inter-contract hedged spreads receive ~45% MCX spread margin benefit vs naked exposure
  const spreadBenefitFactor = kind === 'SPREAD' ? 0.55 : 1.0;
  return Number((grossNotionalInr * MCX_MARGIN_RATE * spreadBenefitFactor).toFixed(2));
}

export function evaluateTradePlan(
  input: TradeIntentInput,
  availableCashInr: number
): { plan: EvaluatedTradePlan; canExecute: boolean; blockerMessage: string | null } {
  const lotsA = Math.max(1, Math.round(input.lotsA));
  const specA = contractSpecs[input.contractA];
  const gramsA = specA.tradingUnitGrams * lotsA;
  const notionalAInr = calculateExposureInr(input.priceA, input.contractA, lotsA);
  const normA = input.priceA > 0 ? normalizeContractBySymbol(input.contractA, input.priceA) : null;
  const costA =
    input.priceA > 0
      ? calculateTransactionCosts(input.priceA, input.contractA, lotsA, DEFAULT_COST_CONFIG)
      : null;

  const isSpread =
    input.kind === 'SPREAD' && Boolean(input.contractB) && typeof input.priceB === 'number';

  let gramsB = 0;
  let notionalBInr = 0;
  let normalized10gB: number | undefined;
  let costBTotal = 0;
  const lotsB = Math.max(1, Math.round(input.lotsB ?? 1));

  if (isSpread && input.contractB && input.priceB && input.priceB > 0) {
    const specB = contractSpecs[input.contractB];
    gramsB = specB.tradingUnitGrams * lotsB;
    notionalBInr = calculateExposureInr(input.priceB, input.contractB, lotsB);
    normalized10gB = normalizeContractBySymbol(input.contractB, input.priceB).normalized10gPrice;
    costBTotal = calculateTransactionCosts(
      input.priceB,
      input.contractB,
      lotsB,
      DEFAULT_COST_CONFIG
    ).totalRoundTripInr;
  }

  const grossNotionalInr = isSpread ? notionalAInr + notionalBInr : notionalAInr;
  const comparableGrams = isSpread ? (gramsA + gramsB) / 2 : gramsA;
  const estimatedFeeInr = Number(((costA?.totalRoundTripInr ?? 0) + costBTotal).toFixed(2));
  const estimatedFeeBps =
    grossNotionalInr > 0
      ? Number(((estimatedFeeInr / (isSpread ? grossNotionalInr : grossNotionalInr * 2)) * 10000).toFixed(2))
      : 0;
  const marginRequiredInr = estimateMarginRequiredInr(grossNotionalInr, input.kind);

  const verdict: XRayVerdict | 'DIRECT_HEDGE' =
    input.kind === 'SPREAD' ? input.verdict ?? 'WATCH' : input.verdict ?? 'DIRECT_HEDGE';
  const requiresDisciplineOverride = verdict === 'NO EDGE' || verdict === 'BLOCKED';

  let warningReason: string | null = null;
  if (verdict === 'NO EDGE') {
    warningReason =
      'X-Ray flagged NO EDGE: carry, basis, and statutory fees consume the spread. Only execute if overriding deliberately for paper testing.';
  } else if (verdict === 'BLOCKED') {
    warningReason =
      'X-Ray flagged BLOCKED due to data or reconciliation gates. Paper override required.';
  } else if (verdict === 'WATCH') {
    warningReason =
      'Edge is positive but below the 5.0 bps safety hurdle — tight slippage tolerance.';
  }

  let headline = '';
  let plainEnglishSummary = '';

  if (isSpread && input.contractB) {
    const legASide = input.side === 'LONG_A_SHORT_B' ? 'BUY' : 'SELL';
    const legBSide = input.side === 'LONG_A_SHORT_B' ? 'SELL' : 'BUY';
    headline = `${legASide} ${lotsA} ${input.contractA} / ${legBSide} ${lotsB} ${input.contractB}`;
    plainEnglishSummary = `You simultaneously ${legASide.toLowerCase()} ${lotsA} lot (${gramsA}g) of ${input.contractA} at ₹${input.priceA.toLocaleString('en-IN')} and ${legBSide.toLowerCase()} ${lotsB} lot (${gramsB}g) of ${input.contractB} at ₹${(input.priceB ?? 0).toLocaleString('en-IN')}. Spread margin blocks ₹${marginRequiredInr.toLocaleString('en-IN')}.`;
  } else {
    const verb = input.side === 'SELL' ? 'SELL' : 'BUY';
    headline = `${verb} ${lotsA} lot ${input.contractA} (${gramsA}g)`;
    plainEnglishSummary = `You place a single-leg paper ${verb} order for ${lotsA} lot (${gramsA}g fine gold contract unit) of ${input.contractA} at ₹${input.priceA.toLocaleString('en-IN')}. Notional exposure is ₹${notionalAInr.toLocaleString('en-IN')} with ₹${marginRequiredInr.toLocaleString('en-IN')} margin blocked.`;
  }

  const expectedNetEdgeInr =
    typeof input.netEdgeInrPerG === 'number'
      ? Number((input.netEdgeInrPerG * comparableGrams).toFixed(2))
      : null;

  const sourceLabel = input.sourceLabel ?? 'Live Global-to-MCX Parity';
  const asOf = input.asOf ?? new Date().toISOString();

  const plan: EvaluatedTradePlan = {
    kind: input.kind,
    side: input.side,
    headline,
    plainEnglishSummary,
    verdict,
    requiresDisciplineOverride,
    warningReason,
    contractA: input.contractA,
    priceA: input.priceA,
    lotsA,
    gramsA,
    notionalAInr,
    normalized10gA: normA?.normalized10gPrice ?? 0,
    expiryA: input.expiryA,
    contractB: isSpread ? input.contractB : undefined,
    priceB: isSpread ? input.priceB : undefined,
    lotsB: isSpread ? lotsB : undefined,
    gramsB: isSpread ? gramsB : undefined,
    notionalBInr: isSpread ? notionalBInr : undefined,
    normalized10gB,
    expiryB: isSpread ? input.expiryB : undefined,
    totalExposureGrams: comparableGrams,
    grossNotionalInr: Number(grossNotionalInr.toFixed(2)),
    marginRequiredInr,
    estimatedFeeInr,
    estimatedFeeBps,
    expectedNetEdgeInr,
    expectedNetEdgeBps: typeof input.netEdgeBps === 'number' ? input.netEdgeBps : null,
    sourceLabel,
    asOf,
    stepsChecklist: [
      {
        step: '01',
        title: 'What you trade',
        detail: headline,
      },
      {
        step: '02',
        title: 'Exposure & margin',
        detail: `${comparableGrams}g · ₹${marginRequiredInr.toLocaleString('en-IN')} margin (9.5% proxy)`,
      },
      {
        step: '03',
        title: 'Statutory round-trip fee',
        detail: `₹${estimatedFeeInr.toLocaleString('en-IN')} (${estimatedFeeBps.toFixed(1)} bps incl. CTT, GST, Stamp, Slippage)`,
      },
      {
        step: '04',
        title: 'Engine judgment',
        detail:
          verdict === 'DIRECT_HEDGE'
            ? input.rationale ?? 'Optimal physical exposure lot fit'
            : `${verdict}${
                typeof input.netEdgeBps === 'number'
                  ? ` · ${input.netEdgeBps >= 0 ? '+' : ''}${input.netEdgeBps.toFixed(1)} bps net edge`
                  : ''
              }`,
      },
    ],
  };

  let blockerMessage: string | null = null;
  if (!Number.isFinite(input.priceA) || input.priceA <= 0) {
    blockerMessage = 'Live price unavailable for Leg A.';
  } else if (isSpread && (!input.priceB || input.priceB <= 0)) {
    blockerMessage = 'Live price unavailable for Leg B.';
  } else if (marginRequiredInr + estimatedFeeInr * 0.5 > availableCashInr) {
    blockerMessage = `Insufficient paper margin. Need ₹${marginRequiredInr.toLocaleString('en-IN')}, available ₹${availableCashInr.toLocaleString('en-IN')}.`;
  }

  return {
    plan,
    canExecute: blockerMessage === null,
    blockerMessage,
  };
}

export function valuatePaperPosition(
  pos: PaperPosition,
  livePrices: Partial<Record<SupportedContractCode, number>>
): LivePositionValuation {
  const currentPriceA = livePrices[pos.contractA] ?? pos.entryPriceA;
  const currentNotionalA = calculateExposureInr(currentPriceA, pos.contractA, pos.lotsA);
  const entryNotionalA = calculateExposureInr(pos.entryPriceA, pos.contractA, pos.lotsA);

  let grossPnlInr = 0;
  let currentPriceB: number | undefined;
  let exitFeeTotal =
    calculateTransactionCosts(currentPriceA, pos.contractA, pos.lotsA, DEFAULT_COST_CONFIG)
      .totalRoundTripInr * 0.5;

  if (pos.kind === 'SPREAD' && pos.contractB && pos.entryPriceB && pos.lotsB) {
    currentPriceB = livePrices[pos.contractB] ?? pos.entryPriceB;
    const currentNotionalB = calculateExposureInr(currentPriceB, pos.contractB, pos.lotsB);
    const entryNotionalB = calculateExposureInr(pos.entryPriceB, pos.contractB, pos.lotsB);
    exitFeeTotal +=
      calculateTransactionCosts(currentPriceB, pos.contractB, pos.lotsB, DEFAULT_COST_CONFIG)
        .totalRoundTripInr * 0.5;

    const pnlA =
      pos.side === 'LONG_A_SHORT_B'
        ? currentNotionalA - entryNotionalA
        : entryNotionalA - currentNotionalA;
    const pnlB =
      pos.side === 'LONG_A_SHORT_B'
        ? entryNotionalB - currentNotionalB
        : currentNotionalB - entryNotionalB;
    grossPnlInr = pnlA + pnlB;
  } else {
    grossPnlInr =
      pos.side === 'SELL' ? entryNotionalA - currentNotionalA : currentNotionalA - entryNotionalA;
  }

  const estimatedExitFeeInr = Number(exitFeeTotal.toFixed(2));
  const netMtmPnlInr = Number((grossPnlInr - pos.entryFeeInr - estimatedExitFeeInr).toFixed(2));
  const returnOnMarginPct =
    pos.marginBlockedInr > 0
      ? Number(((netMtmPnlInr / pos.marginBlockedInr) * 100).toFixed(2))
      : 0;

  return {
    currentPriceA,
    currentPriceB,
    grossPnlInr: Number(grossPnlInr.toFixed(2)),
    estimatedExitFeeInr,
    netMtmPnlInr,
    returnOnMarginPct,
  };
}
