/**
 * Unit Tests — LLM Number-Grounding Validator
 * Run with: npx tsx tests/unit/grounding-validator.test.ts
 */

import assert from 'node:assert';
import { compareContracts, liquidityRanking } from '../../src/lib/goldprism/analyst-tools';
import { validateResponseGrounding } from '../../src/lib/goldprism/number-grounding';

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

console.log('\n[Unit Tests] Feature 3 — LLM Number-Grounding Validator');

const cmp = compareContracts('GOLDTEN', 'GOLDM', '2025-06-30');
const liq = liquidityRanking('2025-06-30');

test('Passes when every number and artifact ID comes strictly from deterministic tool outputs', () => {
  const validProse = `
As of ${cmp.asOf} [${cmp.artifactId}], GOLDTEN settled at ₹${cmp.quotedPriceA} per 10g (normalized 10g pure gold: ₹${cmp.normalized10gA}) while GOLDM settled at ₹${cmp.quotedPriceB} per 10g (normalized 10g pure gold: ₹${cmp.normalized10gB}).
The normalized 10g spread is ₹${cmp.normalizedPremium10g} (${cmp.normalizedPremiumBps} bps), and after ${cmp.decomposition?.transactionCostsBps} bps transaction costs the net edge is ${cmp.decomposition?.netEdgeBps} bps (${cmp.decomposition?.verdict}).
`;

  const result = validateResponseGrounding(validProse, [cmp], [cmp.artifactId]);
  assert.strictEqual(result.ok, true, `Unexpected ungrounded numbers: ${result.ungroundedNumbers.join(', ')}`);
  assert.strictEqual(result.ungroundedNumbers.length, 0);
  assert.strictEqual(result.missingArtifactCitation, false);
});

test('Rejects/flags response when an invented number not present in tool JSON appears', () => {
  const hallucinatedProse = `
As of ${cmp.asOf} [${cmp.artifactId}], GOLDTEN settled at ₹${cmp.quotedPriceA} and generates an expected alpha of 42.75 bps with a synthetic bonus of ₹88888.42.
`;

  const result = validateResponseGrounding(hallucinatedProse, [cmp], [cmp.artifactId]);
  assert.strictEqual(result.ok, false);
  assert(result.ungroundedNumbers.includes(42.75), 'Expected 42.75 to be flagged as ungrounded');
  assert(result.ungroundedNumbers.includes(88888.42), 'Expected 88888.42 to be flagged as ungrounded');
});

test('Rejects/flags response when expected artifact citation ID is omitted', () => {
  const proseMissingCitation = `As of ${liq.asOf}, ${liq.bestContractByGramNotional} leads liquidity ranking.`;
  const result = validateResponseGrounding(proseMissingCitation, [liq], [liq.artifactId]);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.missingArtifactCitation, true);
});

console.log(`  Result: ${passed}/${total} passed\n`);
