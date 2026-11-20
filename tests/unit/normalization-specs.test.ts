/**
 * Unit Tests — Gold Contract Equivalence & Normalization Engine
 * Run with: npx tsx tests/unit/normalization-specs.test.ts
 */

import assert from 'node:assert';
import {
  auditContractSpecsConsistency,
  compareNormalizedContracts,
  contractSpecs,
  normalizeContractBySymbol,
  normalizeTo10gPureGold,
} from '../../src/lib/goldprism/contract-specs';

let passed = 0;
let total = 0;

function test(name: string, fn: () => void) {
  total++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log('\n[Unit Tests] Feature 1 — Contract Specs & 10g Pure-Gold Normalization');

test('contractSpecs defines all 4 MCX gold contracts with expected units & purity', () => {
  assert.deepStrictEqual(Object.keys(contractSpecs).sort(), [
    'GOLDGUINEA',
    'GOLDM',
    'GOLDPETAL',
    'GOLDTEN',
  ]);
  assert.strictEqual(contractSpecs.GOLDM.tradingUnitGrams, 100);
  assert.strictEqual(contractSpecs.GOLDM.quotedPerGrams, 10);
  assert.strictEqual(contractSpecs.GOLDM.purity, 0.995);

  assert.strictEqual(contractSpecs.GOLDTEN.tradingUnitGrams, 10);
  assert.strictEqual(contractSpecs.GOLDTEN.quotedPerGrams, 10);
  assert.strictEqual(contractSpecs.GOLDTEN.purity, 0.999);

  assert.strictEqual(contractSpecs.GOLDGUINEA.tradingUnitGrams, 8);
  assert.strictEqual(contractSpecs.GOLDGUINEA.quotedPerGrams, 8);
  assert.strictEqual(contractSpecs.GOLDGUINEA.purity, 0.999);

  assert.strictEqual(contractSpecs.GOLDPETAL.tradingUnitGrams, 1);
  assert.strictEqual(contractSpecs.GOLDPETAL.quotedPerGrams, 1);
  assert.strictEqual(contractSpecs.GOLDPETAL.purity, 0.999);
});

test('auditContractSpecsConsistency confirms 100% alignment with CONTRACT_MASTER & flags audit notes', () => {
  const audit = auditContractSpecsConsistency();
  assert.strictEqual(audit.length, 4);
  for (const row of audit) {
    assert.strictEqual(row.matchesContractMaster, true, `${row.symbol} mismatch: ${row.mismatches.join(', ')}`);
    assert.strictEqual(row.mismatches.length, 0);
  }
  const guinea = audit.find((a) => a.symbol === 'GOLDGUINEA');
  assert(guinea && guinea.notes.some((n) => n.includes('0.996') && n.includes('0.999')));
  const ten = audit.find((a) => a.symbol === 'GOLDTEN');
  assert(ten && ten.notes.some((n) => n.includes('2025-04-01')));
});

test('Sanity check fixture: P_q=120000, q=8, p=0.999 => 150150.15', () => {
  const res = normalizeTo10gPureGold({
    quotedPrice: 120000,
    quotedPerGrams: 8,
    purity: 0.999,
    symbol: 'GOLDGUINEA',
  });
  assert.strictEqual(res.normalized10gPrice, 150150.15);
  assert.strictEqual(res.steps.length, 4);
  assert.strictEqual(res.disclaimer, 'Unit-normalization only, not a complete carry-adjusted price.');
});

test('Purity adjustment: equal pure-gold content across 995 GOLDM and 999 GOLDTEN normalizes identically', () => {
  // 10g pure gold at ₹100,000 -> GOLDTEN (10g @ 999) quotes 99,900; GOLDM (10g @ 995) quotes 99,500
  const ten = normalizeContractBySymbol('GOLDTEN', 99900);
  const m = normalizeContractBySymbol('GOLDM', 99500);
  assert.strictEqual(ten.normalized10gPrice, 100000);
  assert.strictEqual(m.normalized10gPrice, 100000);
});

test('Invalid inputs (non-positive price/grams or out-of-range purity) throw explicit errors', () => {
  assert.throws(() => normalizeTo10gPureGold({ quotedPrice: 0, quotedPerGrams: 10, purity: 0.999 }));
  assert.throws(() => normalizeTo10gPureGold({ quotedPrice: 100000, quotedPerGrams: -1, purity: 0.999 }));
  assert.throws(() => normalizeTo10gPureGold({ quotedPrice: 100000, quotedPerGrams: 10, purity: 1.05 }));
  assert.throws(() => normalizeTo10gPureGold({ quotedPrice: 100000, quotedPerGrams: 10, purity: 0 }));
});

test('compareNormalizedContracts normalizes heterogeneous quotes and computes spreads vs GOLDM', () => {
  const rows = compareNormalizedContracts([
    { symbol: 'GOLDM', quotedPrice: 99500 },
    { symbol: 'GOLDTEN', quotedPrice: 99900 },
    { symbol: 'GOLDGUINEA', quotedPrice: 79920 },
    { symbol: 'GOLDPETAL', quotedPrice: 9990 },
  ]);
  assert.strictEqual(rows.length, 4);
  for (const r of rows) {
    assert.strictEqual(r.normalized10gPrice, 100000);
    assert.strictEqual(r.spreadVsBaseline10g, 0);
    assert.strictEqual(r.spreadVsBaselineBps, 0);
  }
});

console.log(`  Result: ${passed}/${total} passed\n`);
