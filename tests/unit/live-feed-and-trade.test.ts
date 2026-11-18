import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildParityContracts,
  LANDED_PARITY_MULTIPLIER,
  TROY_OZ_TO_GRAMS,
} from '../../src/lib/goldprism/live-feed';
import {
  estimateMarginRequiredInr,
  evaluateTradePlan,
  INITIAL_PAPER_CAPITAL_INR,
  PaperPosition,
  valuatePaperPosition,
} from '../../src/lib/goldprism/trade-engine';
import { normalizeContractBySymbol } from '../../src/lib/goldprism/contract-specs';

test('buildParityContracts computes landed INR parity and respects contractSpecs purity', () => {
  const xauUsd = 3000;
  const comexGcUsd = 3015;
  const usdInr = 85;

  const parity = buildParityContracts({
    xauUsd,
    comexGcUsd,
    usdInr,
    xauAsOf: '2026-04-01T10:00:00.000Z',
    comexAsOf: '2026-04-01T10:00:00.000Z',
    comexChangePct: 0.45,
    now: new Date('2026-04-01T10:00:00.000Z'),
  });

  const expectedRaw10g = Number((((xauUsd * usdInr) / TROY_OZ_TO_GRAMS) * 10).toFixed(2));
  const expectedLanded10g = Number((expectedRaw10g * LANDED_PARITY_MULTIPLIER).toFixed(2));

  assert.equal(parity.rawIntlSpot10gInr, expectedRaw10g);
  assert.equal(parity.landedSpotParity10gInr, expectedLanded10g);
  assert.equal(parity.comexBasisUsdPerOz, 15);

  // Check normalization round-trip for GOLDM (995 fine) vs GOLDTEN (999 fine)
  const goldmNorm = normalizeContractBySymbol('GOLDM', parity.contracts.GOLDM.quotedPrice);
  const goldtenNorm = normalizeContractBySymbol('GOLDTEN', parity.contracts.GOLDTEN.quotedPrice);
  const guineaNorm = normalizeContractBySymbol('GOLDGUINEA', parity.contracts.GOLDGUINEA.quotedPrice);
  const petalNorm = normalizeContractBySymbol('GOLDPETAL', parity.contracts.GOLDPETAL.quotedPrice);

  assert.ok(Math.abs(goldmNorm.normalized10gPrice - expectedLanded10g) < 5);
  assert.ok(Math.abs(petalNorm.normalized10gPrice - expectedLanded10g) < 15);
  assert.ok(Math.abs(goldtenNorm.normalized10gPrice - parity.landedFuturesParity10gInr) < 5);
  assert.ok(Math.abs(guineaNorm.normalized10gPrice - parity.landedFuturesParity10gInr) < 5);
});

test('evaluateTradePlan calculates accurate exposure, margin, fees, and NO EDGE discipline guard', () => {
  const { plan, canExecute } = evaluateTradePlan(
    {
      kind: 'SPREAD',
      side: 'SHORT_A_LONG_B',
      contractA: 'GOLDTEN',
      priceA: 120000,
      lotsA: 1,
      expiryA: '2026-05-28',
      contractB: 'GOLDM',
      priceB: 119000,
      lotsB: 1,
      expiryB: '2026-05-05',
      verdict: 'NO EDGE',
      netEdgeBps: -4.2,
      netEdgeInrPerG: -5.0,
    },
    INITIAL_PAPER_CAPITAL_INR
  );

  assert.equal(canExecute, true);
  assert.equal(plan.requiresDisciplineOverride, true);
  assert.equal(plan.gramsA, 10);
  assert.equal(plan.gramsB, 100);
  assert.ok(plan.estimatedFeeInr > 100);
  assert.equal(
    plan.marginRequiredInr,
    estimateMarginRequiredInr(plan.grossNotionalInr, 'SPREAD')
  );
  assert.equal(plan.stepsChecklist.length, 4);
});

test('valuatePaperPosition computes net live MTM P&L accurately for long and short positions', () => {
  const longPos: PaperPosition = {
    id: 'GP-TEST-1',
    openedAt: '2026-04-01T10:00:00.000Z',
    asOfPrice: '2026-04-01T10:00:00.000Z',
    sourceLabel: 'Test Parity',
    kind: 'SINGLE',
    side: 'BUY',
    headline: 'BUY 1 lot GOLDTEN (10g)',
    verdictAtEntry: 'DIRECT_HEDGE',
    disciplineOverridden: false,
    contractA: 'GOLDTEN',
    entryPriceA: 100000,
    lotsA: 1,
    gramsA: 10,
    expiryA: '2026-05-28',
    marginBlockedInr: 9500,
    entryFeeInr: 45,
    rationale: 'Test hedge',
  };

  // Price goes up by ₹2000 per 10g -> gross P&L +₹2000
  const valUp = valuatePaperPosition(longPos, { GOLDTEN: 102000 });
  assert.equal(valUp.grossPnlInr, 2000);
  assert.ok(valUp.netMtmPnlInr > 1800 && valUp.netMtmPnlInr < 2000);

  // Price goes down by ₹1000 per 10g -> gross P&L -₹1000
  const valDown = valuatePaperPosition(longPos, { GOLDTEN: 99000 });
  assert.equal(valDown.grossPnlInr, -1000);
  assert.ok(valDown.netMtmPnlInr < -1000);
});
