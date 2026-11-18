/**
 * Gold Contract Equivalence & Normalization Engine — Single Source of Truth
 * =========================================================================
 * Authoritative typed `contractSpecs` configuration cross-checked against:
 *   1. Existing TypeScript CONTRACT_MASTER (`src/lib/goldprism/contract-master.ts`)
 *   2. Existing Python ContractSpec master (`research/goldprism/contract_master.py`)
 *   3. Official MCX Bhavcopy 18-month historical schema (`research/data/mcx_bhavcopy_18m_cached.csv`)
 *
 * Pure normalization formula:
 *   P_10g = (P_q * 10) / (q * p)
 * where:
 *   P_q = quoted price (INR)
 *   q   = quotedPerGrams
 *   p   = purity as decimal (e.g. 0.995, 0.999)
 *
 * NOTE: Unit-normalization only — converts heterogeneous quotes to a 10 g pure-gold
 * (1000-fine) equivalence basis. Not a complete carry-adjusted price.
 */

import { CONTRACT_MASTER, SupportedContractCode } from './contract-master';

export type ContractSymbol = SupportedContractCode;

export interface ContractSpecConfig {
  symbol: ContractSymbol;
  name: string;
  tradingUnitGrams: number;
  quotedPerGrams: number;
  purity: number; // decimal: e.g. 0.995, 0.999
  purityFinePerThousand: number; // e.g. 995, 999
  lotSize: number;
  tickSizeInr: number;
  expiryWindow: string;
  listedFrom: string | null; // YYYY-MM-DD if short history exists
  verificationStatus: 'VERIFIED' | 'DISCREPANCY_FLAGGED';
  discrepancyNote: string | null;
  sourceReference: string;
}

export const contractSpecs: Record<ContractSymbol, ContractSpecConfig> = {
  GOLDM: {
    symbol: 'GOLDM',
    name: 'Gold Mini (100g)',
    tradingUnitGrams: 100,
    quotedPerGrams: 10,
    purity: 0.995,
    purityFinePerThousand: 995,
    lotSize: 1,
    tickSizeInr: 1,
    expiryWindow: '3rd–5th of expiry month',
    listedFrom: null,
    verificationStatus: 'VERIFIED',
    discrepancyNote: null,
    sourceReference: CONTRACT_MASTER.GOLDM.sourceReference,
  },
  GOLDTEN: {
    symbol: 'GOLDTEN',
    name: 'Gold Ten (10g)',
    tradingUnitGrams: 10,
    quotedPerGrams: 10,
    purity: 0.999,
    purityFinePerThousand: 999,
    lotSize: 1,
    tickSizeInr: 1,
    expiryWindow: '27th–31st of expiry month',
    listedFrom: '2025-01-01',
    verificationStatus: 'VERIFIED',
    discrepancyNote:
      'Short history flag: GOLDTEN historical Bhavcopy records begin 2025-01-01 (pre-2025 dates return unavailable).',
    sourceReference: CONTRACT_MASTER.GOLDTEN.sourceReference,
  },
  GOLDGUINEA: {
    symbol: 'GOLDGUINEA',
    name: 'Gold Guinea (8g)',
    tradingUnitGrams: 8,
    quotedPerGrams: 8,
    purity: 0.999,
    purityFinePerThousand: 999,
    lotSize: 1,
    tickSizeInr: 1,
    expiryWindow: '27th–31st of expiry month',
    listedFrom: null,
    verificationStatus: 'VERIFIED',
    discrepancyNote:
      'Cross-check resolved: an earlier legacy test script assumed 0.996 purity (~30 bps phantom spread). Official MCX contract specification and Bhavcopy data confirm 0.999 fine purity.',
    sourceReference: CONTRACT_MASTER.GOLDGUINEA.sourceReference,
  },
  GOLDPETAL: {
    symbol: 'GOLDPETAL',
    name: 'Gold Petal (1g)',
    tradingUnitGrams: 1,
    quotedPerGrams: 1,
    purity: 0.999,
    purityFinePerThousand: 999,
    lotSize: 1,
    tickSizeInr: 1,
    expiryWindow: '27th–31st of expiry month',
    listedFrom: null,
    verificationStatus: 'VERIFIED',
    discrepancyNote: null,
    sourceReference: CONTRACT_MASTER.GOLDPETAL.sourceReference,
  },
};

export interface SpecAuditCrossCheck {
  symbol: ContractSymbol;
  matchesContractMaster: boolean;
  mismatches: string[];
  notes: string[];
}

/**
 * Cross-checks `contractSpecs` against existing `CONTRACT_MASTER` at runtime
 * so any drift between modules is immediately surfaced rather than silently ignored.
 */
export function auditContractSpecsConsistency(): SpecAuditCrossCheck[] {
  return (Object.keys(contractSpecs) as ContractSymbol[]).map((symbol) => {
    const spec = contractSpecs[symbol];
    const master = CONTRACT_MASTER[symbol];
    const mismatches: string[] = [];
    const notes: string[] = [];

    if (spec.tradingUnitGrams !== master.tradingUnitG) {
      mismatches.push(
        `tradingUnitGrams (${spec.tradingUnitGrams}) !== CONTRACT_MASTER.tradingUnitG (${master.tradingUnitG})`
      );
    }
    if (spec.quotedPerGrams !== master.quoteUnitG) {
      mismatches.push(
        `quotedPerGrams (${spec.quotedPerGrams}) !== CONTRACT_MASTER.quoteUnitG (${master.quoteUnitG})`
      );
    }
    if (Math.abs(spec.purity * 1000 - master.purityFine) > 1e-6) {
      mismatches.push(
        `purity (${spec.purity}) !== CONTRACT_MASTER.purityFine / 1000 (${master.purityFine / 1000})`
      );
    }
    if (spec.tickSizeInr !== master.tickSizeInr) {
      mismatches.push(`tickSizeInr (${spec.tickSizeInr}) !== master.tickSizeInr (${master.tickSizeInr})`);
    }
    if (spec.discrepancyNote) {
      notes.push(spec.discrepancyNote);
    }

    return {
      symbol,
      matchesContractMaster: mismatches.length === 0,
      mismatches,
      notes,
    };
  });
}

export interface Pure10gNormalizationResult {
  symbol: ContractSymbol | 'CUSTOM';
  quotedPrice: number;
  quotedPerGrams: number;
  purity: number;
  pricePerQuotedGram: number; // P_q / q
  pricePerPureGram: number; // (P_q / q) / p
  normalized10gPrice: number; // P_10g = (P_q * 10) / (q * p)
  normalized999PerGram: number; // Existing X-Ray 999-fine basis: (P_q / q) * ((p * 1000) / 999)
  formulaSymbolic: string;
  formulaSubstituted: string;
  steps: Array<{
    step: number;
    label: string;
    expression: string;
    value: number;
    unit: string;
  }>;
  disclaimer: string;
}

/**
 * Pure, unit-tested 10 g pure-gold equivalence formula:
 *   P_10g = (P_q × 10) / (q × p)
 */
export function normalizeTo10gPureGold(params: {
  quotedPrice: number;
  quotedPerGrams: number;
  purity: number;
  symbol?: ContractSymbol;
}): Pure10gNormalizationResult {
  const { quotedPrice, quotedPerGrams, purity, symbol } = params;

  if (!Number.isFinite(quotedPrice) || quotedPrice <= 0) {
    throw new Error(`Quoted price P_q must be a positive finite number. Received: ${quotedPrice}`);
  }
  if (!Number.isFinite(quotedPerGrams) || quotedPerGrams <= 0) {
    throw new Error(`Quoted grams q must be a positive finite number. Received: ${quotedPerGrams}`);
  }
  if (!Number.isFinite(purity) || purity <= 0 || purity > 1) {
    throw new Error(`Purity p must be in (0, 1]. Received: ${purity}`);
  }

  const pricePerQuotedGram = quotedPrice / quotedPerGrams;
  const pricePerPureGram = pricePerQuotedGram / purity;
  const raw10g = (quotedPrice * 10) / (quotedPerGrams * purity);
  const normalized10gPrice = Number(raw10g.toFixed(2));
  const normalized999PerGram = Number((pricePerQuotedGram * ((purity * 1000) / 999.0)).toFixed(4));

  return {
    symbol: symbol ?? 'CUSTOM',
    quotedPrice,
    quotedPerGrams,
    purity,
    pricePerQuotedGram: Number(pricePerQuotedGram.toFixed(4)),
    pricePerPureGram: Number(pricePerPureGram.toFixed(4)),
    normalized10gPrice,
    normalized999PerGram,
    formulaSymbolic: 'P_10g = (P_q × 10) / (q × p)',
    formulaSubstituted: `(${quotedPrice.toFixed(2)} × 10) / (${quotedPerGrams} × ${purity}) = ${normalized10gPrice.toFixed(2)}`,
    steps: [
      {
        step: 1,
        label: 'Raw quoted price (P_q)',
        expression: `₹${quotedPrice.toFixed(2)} per ${quotedPerGrams} g`,
        value: Number(quotedPrice.toFixed(2)),
        unit: `₹ / ${quotedPerGrams}g`,
      },
      {
        step: 2,
        label: 'Divide by quoted grams (÷ q)',
        expression: `${quotedPrice.toFixed(2)} ÷ ${quotedPerGrams} = ₹${pricePerQuotedGram.toFixed(4)}/g`,
        value: Number(pricePerQuotedGram.toFixed(4)),
        unit: `₹/g (${(purity * 1000).toFixed(0)} fine)`,
      },
      {
        step: 3,
        label: 'Divide by purity (÷ p)',
        expression: `${pricePerQuotedGram.toFixed(4)} ÷ ${purity} = ₹${pricePerPureGram.toFixed(4)}/g`,
        value: Number(pricePerPureGram.toFixed(4)),
        unit: '₹/g (1000 fine)',
      },
      {
        step: 4,
        label: 'Scale to 10 g basis (× 10)',
        expression: `${pricePerPureGram.toFixed(4)} × 10 = ₹${normalized10gPrice.toFixed(2)}`,
        value: normalized10gPrice,
        unit: '₹ / 10g (pure gold)',
      },
    ],
    disclaimer: 'Unit-normalization only, not a complete carry-adjusted price.',
  };
}

export function normalizeContractBySymbol(
  symbol: ContractSymbol,
  quotedPrice: number
): Pure10gNormalizationResult {
  const spec = contractSpecs[symbol];
  if (!spec) {
    throw new Error(`Unsupported contract symbol: ${symbol}`);
  }
  return normalizeTo10gPureGold({
    symbol,
    quotedPrice,
    quotedPerGrams: spec.quotedPerGrams,
    purity: spec.purity,
  });
}

export interface NormalizedContractQuoteInput {
  symbol: ContractSymbol;
  quotedPrice: number;
  expiryDate?: string;
  asOf?: string;
  source?: string;
}

export interface NormalizedContractComparisonRow {
  symbol: ContractSymbol;
  spec: ContractSpecConfig;
  quotedPrice: number;
  normalized10gPrice: number;
  normalized1gPrice: number;
  spreadVsBaseline10g: number; // vs GOLDM (or first available)
  spreadVsBaselineBps: number;
  expiryDate?: string;
  asOf?: string;
  source?: string;
  trace: Pure10gNormalizationResult;
}

export function compareNormalizedContracts(
  quotes: NormalizedContractQuoteInput[],
  baselineSymbol: ContractSymbol = 'GOLDM'
): NormalizedContractComparisonRow[] {
  const normalized = quotes.map((q) => {
    const spec = contractSpecs[q.symbol];
    const trace = normalizeContractBySymbol(q.symbol, q.quotedPrice);
    return {
      symbol: q.symbol,
      spec,
      quotedPrice: q.quotedPrice,
      normalized10gPrice: trace.normalized10gPrice,
      normalized1gPrice: trace.pricePerPureGram,
      expiryDate: q.expiryDate,
      asOf: q.asOf,
      source: q.source,
      trace,
    };
  });

  const baseline =
    normalized.find((n) => n.symbol === baselineSymbol) ?? normalized[0];
  const basePrice = baseline?.normalized10gPrice ?? 0;

  return normalized.map((row) => {
    const diff = basePrice > 0 ? Number((row.normalized10gPrice - basePrice).toFixed(2)) : 0;
    const bps = basePrice > 0 ? Number(((diff / basePrice) * 10000).toFixed(2)) : 0;
    return {
      ...row,
      spreadVsBaseline10g: diff,
      spreadVsBaselineBps: bps,
    };
  });
}
