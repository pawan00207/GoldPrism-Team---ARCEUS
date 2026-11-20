/**
 * Unit Tests — Transaction Cost Sensitivity Tool
 * Run with: npx tsx tests/unit/cost-sensitivity.test.ts
 */

import assert from 'node:assert';
import { costSensitivity } from '../../src/lib/goldprism/analyst-tools';

// Keep these regression scenarios deterministic across official archive refreshes.
process.env.GOLDPRISM_DEMO_FIXTURE = '1';

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

console.log('\n[Unit Tests] Feature 3 — Deterministic Cost Sensitivity Tool');

test('0.0x cost multiplier drops scaled transaction costs to zero and increases net edge', () => {
  const zero = costSensitivity(0.0, '2025-06-30', 'GOLDTEN_GOLDM');
  assert.strictEqual(zero.status, 'OK');
  assert.strictEqual(zero.scaledCostsInrPerG, 0);
  assert.strictEqual(zero.scaledCostsBps, 0);
  assert(zero.baselineCostsBps !== null && zero.baselineCostsBps > 0);
  assert(zero.scaledNetEdgeBps !== null && zero.baselineNetEdgeBps !== null);
  assert(zero.scaledNetEdgeBps > zero.baselineNetEdgeBps);
});

test('1.2x cost multiplier scales costs by 1.2x and reduces net edge monotonically', () => {
  const base = costSensitivity(1.0, '2025-06-30', 'GOLDTEN_GOLDM');
  const stressed = costSensitivity(1.2, '2025-06-30', 'GOLDTEN_GOLDM');

  assert.strictEqual(base.status, 'OK');
  assert.strictEqual(stressed.status, 'OK');
  assert(base.baselineCostsInrPerG !== null && stressed.scaledCostsInrPerG !== null);
  assert(base.baselineCostsBps !== null && stressed.scaledCostsBps !== null);
  assert(base.baselineNetEdgeBps !== null && stressed.scaledNetEdgeBps !== null);

  assert.strictEqual(base.scaledCostsInrPerG, base.baselineCostsInrPerG);
  assert(
    Math.abs(stressed.scaledCostsInrPerG - base.baselineCostsInrPerG * 1.2) < 0.05,
    `Expected ~${(base.baselineCostsInrPerG * 1.2).toFixed(4)}, got ${stressed.scaledCostsInrPerG}`
  );
  assert(stressed.scaledCostsBps > base.baselineCostsBps);
  assert(stressed.scaledNetEdgeBps < base.baselineNetEdgeBps);
  assert(stressed.artifactId.startsWith('ART-COST-'));

  const cal = costSensitivity(1.2, '2025-05-15', 'GOLDM_CALENDAR');
  assert.strictEqual(cal.status, 'OK');
  assert(cal.scaledCostsInrPerG !== null && cal.baselineCostsInrPerG !== null);
  assert(cal.scaledCostsInrPerG > cal.baselineCostsInrPerG);
});

console.log(`  Result: ${passed}/${total} passed\n`);
