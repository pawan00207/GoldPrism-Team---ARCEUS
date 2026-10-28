/**
 * Acceptance Test Suite — GoldPrism TypeScript Engine
 * ====================================================
 * Covers:
 * 1. Contract Master & Purity Normalization
 * 2. Transaction Cost Calculations
 * 3. X-Ray Waterfall & Mathematical Reconciliation
 * 4. Verdict Gates (TRADABLE, WATCH, NO EDGE, BLOCKED)
 * 5. Data Ingestion, Integrity Gates & Seeded Error Detection
 * 6. Best Vehicle Ranking
 *
 * Run with: node --experimental-strip-types tests/goldprism.test.ts
 */

import assert from 'node:assert';
import {
  CONTRACT_MASTER,
  getContractSpec,
  normalizePriceTo999,
  SUPPORTED_CONTRACTS,
} from '../src/lib/goldprism/contract-master';
import {
  calculateTransactionCosts,
  DEFAULT_COST_CONFIG,
} from '../src/lib/goldprism/transaction-costs';
import {
  computeXRayWaterfall,
  RECON_TOLERANCE,
} from '../src/lib/goldprism/xray';
import {
  parseAndValidateBhavcopyCsv,
} from '../src/lib/goldprism/data-adapter';
import {
  rankBestVehicleForExposure,
} from '../src/lib/goldprism/signal';
import {
  CLEAN_MCX_BHAVCOPY_CSV,
  SEEDED_ERROR_BHAVCOPY_CSV,
} from '../src/lib/goldprism/fixtures';

let passed = 0;
let total = 0;

function it(name: string, fn: () => void) {
  total++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log('\n=============================================');
console.log(' RUNNING GOLDPRISM ACCEPTANCE TESTS');
console.log('=============================================\n');

console.log('1. Contract Master & Normalization:');
it('All 4 supported contracts are registered and verified', () => {
  for (const code of SUPPORTED_CONTRACTS) {
    const spec = getContractSpec(code);
    assert.strictEqual(spec.contractCode, code);
    assert.strictEqual(spec.verificationStatus, 'VERIFIED');
  }
});

it('GOLDM specification matches: 100g unit, 10g quote, 995 purity', () => {
  const spec = getContractSpec('GOLDM');
  assert.strictEqual(spec.tradingUnitG, 100);
  assert.strictEqual(spec.quoteUnitG, 10);
  assert.strictEqual(spec.purityFine, 995);
});

it('GOLDTEN specification matches: 10g unit, 10g quote, 999 purity', () => {
  const spec = getContractSpec('GOLDTEN');
  assert.strictEqual(spec.tradingUnitG, 10);
  assert.strictEqual(spec.quoteUnitG, 10);
  assert.strictEqual(spec.purityFine, 999);
});

it('GOLDGUINEA specification matches: 8g unit, 8g quote, 999 purity (discrepancy verified)', () => {
  const spec = getContractSpec('GOLDGUINEA');
  assert.strictEqual(spec.tradingUnitG, 8);
  assert.strictEqual(spec.quoteUnitG, 8);
  assert.strictEqual(spec.purityFine, 999);
});

it('GOLDPETAL specification matches: 1g unit, 1g quote, 999 purity', () => {
  const spec = getContractSpec('GOLDPETAL');
  assert.strictEqual(spec.tradingUnitG, 1);
  assert.strictEqual(spec.quoteUnitG, 1);
  assert.strictEqual(spec.purityFine, 999);
});

it('Normalizes GOLDM price correctly to 999-fine equivalent', () => {
  // Quoted: 73,500 INR per 10g of 995 purity
  // Base price/g = 7350
  // 999 equivalent = 7350 * (995 / 999) = 7320.5705...
  const { normalizedPrice, trace } = normalizePriceTo999(73500, 'GOLDM');
  assert(Math.abs(normalizedPrice - 7320.5706) < 0.01);
  assert.strictEqual(trace.quotedPrice, 73500);
  assert.strictEqual(trace.quoteUnitG, 10);
});

console.log('\n2. Transaction Costs Model:');
it('Calculates itemized round-trip costs with CTT on sell side only', () => {
  const costs = calculateTransactionCosts(74000, 'GOLDTEN', 1);
  assert(costs.totalRoundTripInr > 0);
  assert.strictEqual(costs.contractCode, 'GOLDTEN');
  assert.strictEqual(costs.lots, 1);
  // Trade value for 1 lot (10g) at 74000/10g = 74,000 INR
  assert.strictEqual(costs.tradeValueOneSide, 74000);
  // CTT is 0.01% of sell side = 7.40 INR
  assert.strictEqual(costs.cttInr, 7.4);
  // Brokerage is ₹30 * 2 = ₹60
  assert.strictEqual(costs.brokerageInr, 60);
});

console.log('\n3. X-Ray Waterfall & Mathematical Reconciliation:');
it('X-Ray waterfall decomposes spread and reconciles < 0.01 INR/g tolerance', () => {
  const result = computeXRayWaterfall({
    contractA: 'GOLDTEN',
    priceAQuoted: 74080.0,
    expiryA: '2026-04-28',
    contractB: 'GOLDM',
    priceBQuoted: 73510.0,
    expiryB: '2026-04-05',
    tradeDate: '2026-03-20',
    annualCarryRate: 0.065,
    settlementArtifactInrPerG: 10.0,
  });

  assert.strictEqual(result.reconciliationOk, true);
  assert(result.reconciliationError < RECON_TOLERANCE);
  assert(result.configHash.startsWith('GP-'));
});

it('Produces NO EDGE verdict when net residual is non-positive', () => {
  // Same price, no edge after costs
  const result = computeXRayWaterfall({
    contractA: 'GOLDTEN',
    priceAQuoted: 74080.0,
    expiryA: '2026-04-28',
    contractB: 'GOLDPETAL',
    priceBQuoted: 7408.0,
    expiryB: '2026-04-28',
    tradeDate: '2026-03-20',
  });

  assert.strictEqual(result.verdict, 'NO EDGE');
  assert(result.netEdgeInrPerG <= 0);
});

it('Blocks run when data quality gate fails', () => {
  const result = computeXRayWaterfall({
    contractA: 'GOLDTEN',
    priceAQuoted: 74080.0,
    expiryA: '2026-04-28',
    contractB: 'GOLDM',
    priceBQuoted: 73510.0,
    expiryB: '2026-04-05',
    tradeDate: '2026-03-20',
    dataQualityOk: false,
  });

  assert.strictEqual(result.verdict, 'BLOCKED');
  assert(result.reasonCodes.includes('ERR_DATA_QUALITY_GATE_FAILED'));
});

console.log('\n4. Data Ingestion & Bhavcopy Integrity:');
it('Validates clean MCX Bhavcopy successfully', () => {
  const res = parseAndValidateBhavcopyCsv(CLEAN_MCX_BHAVCOPY_CSV, {
    requestedDate: '2026-03-20',
  });

  assert.strictEqual(res.status, 'PASSED');
  assert.strictEqual(res.totalRowsValidated, 6);
  assert.strictEqual(res.totalRowsRejected, 0);
  assert(res.sha256Hash.startsWith('sha256_'));
});

it('Catches seeded faults (date mismatch, outlier, missing value)', () => {
  const res = parseAndValidateBhavcopyCsv(SEEDED_ERROR_BHAVCOPY_CSV, {
    requestedDate: '2026-03-20',
  });

  assert(res.totalRowsRejected >= 3);
  const reasonCodes = res.rejectedRows.map((r) => r.reasonCode);
  assert(reasonCodes.includes('ERR_DATE_MISMATCH'));
  assert(reasonCodes.includes('ERR_INVALID_SETTLE_PRICE'));
  assert(reasonCodes.includes('ERR_OUTLIER_SETTLE_PRICE') || reasonCodes.includes('ERR_INVALID_OHLC_RANGE'));
});

console.log('\n5. Best Vehicle Ranking:');
it('Ranks GOLDTEN as #1 for 50g exposure with 0% mismatch', () => {
  const rankings = rankBestVehicleForExposure(50);
  assert.strictEqual(rankings.length, 4);
  const winner = rankings[0];
  assert.strictEqual(winner.contractCode, 'GOLDTEN');
  assert.strictEqual(winner.lotsRequired, 5);
  assert.strictEqual(winner.exposureMismatchPct, 0);
  assert.strictEqual(winner.isWinner, true);
});

console.log(`\n=============================================`);
console.log(` SUMMARY: ${passed} / ${total} TESTS PASSED`);
console.log(`=============================================\n`);
