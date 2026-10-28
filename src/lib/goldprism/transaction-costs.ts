/**
 * Transaction Cost Model — GoldPrism
 * =====================================
 * Itemized statutory and broker fee calculator for MCX Gold futures.
 *
 * Components modeled:
 * 1. Brokerage: flat ₹ per lot (both buy and sell legs)
 * 2. Exchange Charges: MCX fee schedule on turnover (both legs)
 * 3. CTT (Commodity Transaction Tax): 0.01% on SELL side only (Finance Act 2013)
 * 4. SEBI Turnover Charges: 0.0001% on turnover (both legs)
 * 5. GST: 18% on (Brokerage + Exchange fees)
 * 6. Stamp Duty: 0.002% on BUY side only (State stamp duty rule)
 * 7. Slippage: Basis-point execution friction per leg
 *
 * Team ARCEUS · Hack in Hills '26 · Track 03: Commodity Derivatives Intelligence
 */

import { getContractSpec } from './contract-master';

export interface CostModelConfig {
  brokeragePerLotInr: number;    // e.g. 30 INR per lot
  brokerageVerified: boolean;
  brokerageSource: string;

  exchangeChargeRate: number;    // e.g. 0.000026 (0.0026%)
  exchangeChargeVerified: boolean;
  exchangeChargeSource: string;

  cttRate: number;               // 0.0001 (0.01% on sell side)
  cttVerified: boolean;
  cttSource: string;

  sebiChargeRate: number;        // 0.000001 (0.0001%)
  sebiVerified: boolean;
  sebiSource: string;

  gstRate: number;               // 0.18 (18%)
  gstVerified: boolean;
  gstSource: string;

  stampDutyRate: number;         // 0.00002 (0.002% buy side)
  stampDutyVerified: boolean;
  stampDutySource: string;

  slippageBps: number;           // 2.0 bps per leg
  slippageVerified: boolean;
  slippageSource: string;
}

export const DEFAULT_COST_CONFIG: CostModelConfig = {
  brokeragePerLotInr: 30.0,
  brokerageVerified: true,
  brokerageSource: 'Typical discount broker flat fee per order/lot (e.g. Zerodha/Groww/Fyers)',

  exchangeChargeRate: 0.000026,
  exchangeChargeVerified: true,
  exchangeChargeSource: 'MCX official commodity futures transaction charge schedule (₹260 per Cr)',

  cttRate: 0.0001,
  cttVerified: true,
  cttSource: 'Finance Act 2013, Section 116 — CTT on non-agri commodity futures (sell-side only)',

  sebiChargeRate: 0.000001,
  sebiVerified: true,
  sebiSource: 'SEBI circular on regulatory turnover fee (₹10 per Cr)',

  gstRate: 0.18,
  gstVerified: true,
  gstSource: 'GST Act — 18% on financial brokerage and exchange service fees',

  stampDutyRate: 0.00002,
  stampDutyVerified: true,
  stampDutySource: 'Indian Stamp Act (Maharashtra schedule) — 0.002% on commodity futures buy-side',

  slippageBps: 2.0,
  slippageVerified: true,
  slippageSource: 'Empirical estimate of top-of-book half-spread impact during liquid MCX hours',
};

export interface TransactionCostBreakdown {
  contractCode: string;
  lots: number;
  totalGrams: number;
  tradeValueOneSide: number;
  
  // Itemized Round-Trip Costs in INR
  brokerageInr: number;
  exchangeChargeInr: number;
  cttInr: number;               // sell-side only
  sebiChargeInr: number;
  gstInr: number;
  stampDutyInr: number;         // buy-side only
  slippageInr: number;          // both legs

  totalRoundTripInr: number;
  totalCostPerGramInr: number;
  totalCostBps: number;
  notes: string[];
}

export function calculateTransactionCosts(
  quotedPrice: number,
  contractCode: string,
  lots: number = 1,
  config: CostModelConfig = DEFAULT_COST_CONFIG
): TransactionCostBreakdown {
  const spec = getContractSpec(contractCode);
  const totalGrams = spec.tradingUnitG * spec.lotSize * lots;
  const pricePerG = quotedPrice / spec.quoteUnitG;
  const tradeValueOneSide = pricePerG * totalGrams;

  const notes: string[] = [];

  // Brokerage: flat fee per lot (buy side + sell side = 2x)
  const brokeragePerSide = config.brokeragePerLotInr * lots;
  const brokerageInr = brokeragePerSide * 2;

  // Exchange charge: % of turnover on both sides
  const exchangeChargePerSide = tradeValueOneSide * config.exchangeChargeRate;
  const exchangeChargeInr = exchangeChargePerSide * 2;

  // CTT: applied on SELL side only (0.01%)
  const cttInr = tradeValueOneSide * config.cttRate;

  // SEBI turnover charge: both sides
  const sebiChargeInr = tradeValueOneSide * config.sebiChargeRate * 2;

  // GST: 18% on (Brokerage + Exchange fees)
  const gstBase = brokerageInr + exchangeChargeInr;
  const gstInr = gstBase * config.gstRate;

  // Stamp duty: buy side only (0.002%)
  const stampDutyInr = tradeValueOneSide * config.stampDutyRate;

  // Slippage: 2.0 bps per leg (round-trip = 4.0 bps total)
  const slippageInr = tradeValueOneSide * (config.slippageBps / 10000.0) * 2;

  // Total Round-Trip Costs
  const totalRoundTripInr =
    brokerageInr +
    exchangeChargeInr +
    cttInr +
    sebiChargeInr +
    gstInr +
    stampDutyInr +
    slippageInr;

  const totalCostPerGramInr = totalGrams > 0 ? totalRoundTripInr / totalGrams : 0;
  const totalCostBps = tradeValueOneSide > 0 ? (totalRoundTripInr / (tradeValueOneSide * 2)) * 10000 : 0;

  return {
    contractCode,
    lots,
    totalGrams,
    tradeValueOneSide: Number(tradeValueOneSide.toFixed(2)),
    brokerageInr: Number(brokerageInr.toFixed(2)),
    exchangeChargeInr: Number(exchangeChargeInr.toFixed(2)),
    cttInr: Number(cttInr.toFixed(2)),
    sebiChargeInr: Number(sebiChargeInr.toFixed(2)),
    gstInr: Number(gstInr.toFixed(2)),
    stampDutyInr: Number(stampDutyInr.toFixed(2)),
    slippageInr: Number(slippageInr.toFixed(2)),
    totalRoundTripInr: Number(totalRoundTripInr.toFixed(2)),
    totalCostPerGramInr: Number(totalCostPerGramInr.toFixed(4)),
    totalCostBps: Number(totalCostBps.toFixed(2)),
    notes,
  };
}
