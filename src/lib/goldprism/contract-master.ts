/**
 * MCX Gold Contract Master — GoldPrism
 * =====================================
 * Versioned contract specifications with effective dates, source references,
 * and fine-gold (999.0) purity normalization formulas.
 *
 * Team ARCEUS · Hack in Hills '26 · Track 03: Commodity Derivatives Intelligence
 */

export type VerificationStatus = 'VERIFIED' | 'UNVERIFIED' | 'DISPUTED';

export interface ContractSpec {
  contractCode: 'GOLDM' | 'GOLDTEN' | 'GOLDGUINEA' | 'GOLDPETAL';
  name: string;
  tradingUnitG: number;      // trading unit in grams
  quoteUnitG: number;        // quotation unit in grams (quoted per this many grams)
  purityFine: number;        // fineness out of 1000 e.g. 995, 999
  lotSize: number;           // number of trading units per lot (usually 1)
  tickSizeInr: number;       // min price tick in INR
  expiryWindow: string;      // typical expiry days of the contract month
  effectiveFrom: string;     // YYYY-MM-DD
  effectiveTo: string | null;// null = active
  verificationStatus: VerificationStatus;
  sourceReference: string;
  sourceDate: string;
  notes: string;
}

export interface NormalizationTrace {
  contractCode: string;
  quotedPrice: number;
  quoteUnitG: number;
  unadjustedPricePerG: number; // quotedPrice / quoteUnitG
  purityFine: number;
  purityRatio: number;        // purityFine / 999.0
  normalizedPricePerG: number; // unadjustedPricePerG * purityRatio
  formula: string;
  stepByStep: string[];
}

export const SUPPORTED_CONTRACTS = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'] as const;
export type SupportedContractCode = typeof SUPPORTED_CONTRACTS[number];

export const CONTRACT_MASTER: Record<SupportedContractCode, ContractSpec> = {
  GOLDM: {
    contractCode: 'GOLDM',
    name: 'Gold Mini (100g)',
    tradingUnitG: 100.0,
    quoteUnitG: 10.0,
    purityFine: 995.0,
    lotSize: 1,
    tickSizeInr: 1.0,
    expiryWindow: '3rd–5th of expiry month',
    effectiveFrom: '2010-01-01',
    effectiveTo: null,
    verificationStatus: 'VERIFIED',
    sourceReference: 'MCX GOLDM Contract Specification — official circular',
    sourceDate: '2024-10-01',
    notes: '100g trading unit. Quoted per 10g. Purity 995/1000 (22 carat equivalent). Early month expiry (3rd-5th).',
  },
  GOLDTEN: {
    contractCode: 'GOLDTEN',
    name: 'Gold Ten (10g)',
    tradingUnitG: 10.0,
    quoteUnitG: 10.0,
    purityFine: 999.0,
    lotSize: 1,
    tickSizeInr: 1.0,
    expiryWindow: '27th–31st of expiry month',
    effectiveFrom: '2016-01-01',
    effectiveTo: null,
    verificationStatus: 'VERIFIED',
    sourceReference: 'MCX GOLDTEN Contract Specification — official circular',
    sourceDate: '2024-10-01',
    notes: '10g trading unit. Quoted per 10g. Purity 999/1000 (24 carat, 99.9% fine). Month-end expiry.',
  },
  GOLDGUINEA: {
    contractCode: 'GOLDGUINEA',
    name: 'Gold Guinea (8g)',
    tradingUnitG: 8.0,
    quoteUnitG: 8.0,
    purityFine: 999.0,
    lotSize: 1,
    tickSizeInr: 1.0,
    expiryWindow: '27th–31st of expiry month',
    effectiveFrom: '2018-01-01',
    effectiveTo: null,
    verificationStatus: 'VERIFIED',
    sourceReference: 'MCX GOLDGUINEA Contract Specification',
    sourceDate: '2024-10-01',
    notes: '8g trading unit (guinea standard). Quoted per 8g. Purity 999/1000. DISCREPANCY NOTE: An earlier automated test script used purity=996. The official MCX specification lists 999 fine purity. We use 999 as the verified benchmark.',
  },
  GOLDPETAL: {
    contractCode: 'GOLDPETAL',
    name: 'Gold Petal (1g)',
    tradingUnitG: 1.0,
    quoteUnitG: 1.0,
    purityFine: 999.0,
    lotSize: 1,
    tickSizeInr: 1.0,
    expiryWindow: '27th–31st of expiry month',
    effectiveFrom: '2015-01-01',
    effectiveTo: null,
    verificationStatus: 'VERIFIED',
    sourceReference: 'MCX GOLDPETAL Contract Specification',
    sourceDate: '2024-10-01',
    notes: '1g trading unit. Quoted per 1g. Purity 999/1000. Month-end expiry. Micro-hedging contract for retail and jewellers.',
  },
};

export function getContractSpec(contractCode: string): ContractSpec {
  const spec = CONTRACT_MASTER[contractCode as SupportedContractCode];
  if (!spec) {
    throw new Error(`Unknown MCX contract code: ${contractCode}. Supported: ${SUPPORTED_CONTRACTS.join(', ')}`);
  }
  return spec;
}

export function getAllContractSpecs(): ContractSpec[] {
  return Object.values(CONTRACT_MASTER);
}

/**
 * Normalizes quoted price to INR per gram of 999-fine gold.
 *
 * Formula:
 *   price_999_per_g = (price_quoted / quote_unit_g) * (purity_fine / 999.0)
 */
export function normalizePriceTo999(
  quotedPrice: number,
  contractCode: string
): { normalizedPrice: number; trace: NormalizationTrace } {
  const spec = getContractSpec(contractCode);
  if (quotedPrice <= 0) {
    throw new Error(`Invalid non-positive price for ${contractCode}: ${quotedPrice}`);
  }

  const unadjustedPricePerG = quotedPrice / spec.quoteUnitG;
  const purityRatio = spec.purityFine / 999.0;
  const normalizedPricePerG = unadjustedPricePerG * purityRatio;

  const trace: NormalizationTrace = {
    contractCode,
    quotedPrice,
    quoteUnitG: spec.quoteUnitG,
    unadjustedPricePerG: Number(unadjustedPricePerG.toFixed(4)),
    purityFine: spec.purityFine,
    purityRatio: Number(purityRatio.toFixed(6)),
    normalizedPricePerG: Number(normalizedPricePerG.toFixed(4)),
    formula: `(${quotedPrice} / ${spec.quoteUnitG}) × (${spec.purityFine} / 999.0) = ${normalizedPricePerG.toFixed(4)} ₹/g`,
    stepByStep: [
      `1. Base Quoted Price: ₹${quotedPrice.toFixed(2)} per ${spec.quoteUnitG}g`,
      `2. Divide by Quote Unit: ₹${quotedPrice.toFixed(2)} / ${spec.quoteUnitG}g = ₹${unadjustedPricePerG.toFixed(4)}/g (${spec.purityFine} purity)`,
      `3. Purity Adjustment Factor: ${spec.purityFine} / 999.0 = ${purityRatio.toFixed(6)}`,
      `4. Final 999-Fine Equivalent: ₹${normalizedPricePerG.toFixed(4)} / gram`,
    ],
  };

  return {
    normalizedPrice: Number(normalizedPricePerG.toFixed(4)),
    trace,
  };
}

/**
 * Total INR Exposure calculation.
 * exposure = (price_quoted / quote_unit_g) * trading_unit_g * lots
 */
export function calculateExposureInr(
  quotedPrice: number,
  contractCode: string,
  lots: number = 1
): number {
  const spec = getContractSpec(contractCode);
  const pricePerG = quotedPrice / spec.quoteUnitG;
  const totalGrams = spec.tradingUnitG * spec.lotSize * lots;
  return Number((pricePerG * totalGrams).toFixed(2));
}
