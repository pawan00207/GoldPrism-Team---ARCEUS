/**
 * Unit Tests — Point-in-Time Backtest Replay & Anti-Lookahead Guarantee
 * Run with: npx tsx tests/unit/no-lookahead.test.ts
 */

import assert from 'node:assert';
import {
  computeReplayAtDate,
  getSnapshotAsOf,
  loadHistoricalBhavcopyRows,
} from '../../src/lib/goldprism/historical-store';

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

console.log('\n[Unit Tests] Feature 2 — Point-in-Time Replay & Zero Look-Ahead Proof');

const realRows = loadHistoricalBhavcopyRows();

test('getSnapshotAsOf strictly excludes all rows after as_of', () => {
  const asOf = '2024-09-15';
  const snap = getSnapshotAsOf(asOf, realRows);
  assert(snap.historyUpToAsOf.length > 0);
  for (const row of snap.historyUpToAsOf) {
    assert(row.tradeDate <= asOf, `Found future row ${row.tradeDate} > ${asOf}`);
  }
  assert(snap.resolvedTradeDate && snap.resolvedTradeDate <= asOf);
});

test('Zero look-ahead proof: mutating future rows (> as_of) does NOT alter snapshot, model state, or verdict', () => {
  const asOf = '2024-09-15';
  const corruptedFutureRows = realRows.map((row) =>
    row.tradeDate > asOf
      ? {
          ...row,
          open: 999999,
          high: 999999,
          low: 1,
          close: 999999,
          settle: 999999,
          volume: 9999999,
          openInterest: 9999999,
        }
      : { ...row }
  );

  const snapClean = getSnapshotAsOf(asOf, realRows);
  const snapMutated = getSnapshotAsOf(asOf, corruptedFutureRows);
  assert.deepStrictEqual(snapMutated, snapClean);

  const replayClean = computeReplayAtDate(asOf, {
    pairId: 'GOLDM_CALENDAR',
    reveal: false,
    sourceRows: realRows,
  });
  const replayMutated = computeReplayAtDate(asOf, {
    pairId: 'GOLDM_CALENDAR',
    reveal: false,
    sourceRows: corruptedFutureRows,
  });

  const stripExecTimestamp = (r: typeof replayClean) => ({
    ...r,
    panel5Verdict: r.panel5Verdict
      ? { ...r.panel5Verdict, timestamp: 'NORMALIZED' }
      : null,
  });

  assert.deepStrictEqual(stripExecTimestamp(replayMutated), stripExecTimestamp(replayClean));
  assert.strictEqual(replayClean.panel6ForwardOutcome, null);
});

test('Forward outcome Panel 6 remains sealed (null) unless reveal=true is explicitly passed', () => {
  const sealed = computeReplayAtDate('2025-05-15', {
    pairId: 'GOLDTEN_GOLDM',
    reveal: false,
    sourceRows: realRows,
  });
  assert.strictEqual(sealed.panel6ForwardOutcome, null);
  assert.strictEqual(sealed.partition, 'SEALED_HOLDOUT');

  const revealed = computeReplayAtDate('2025-05-15', {
    pairId: 'GOLDTEN_GOLDM',
    reveal: true,
    sourceRows: realRows,
  });
  assert(revealed.panel6ForwardOutcome !== null);
  assert.strictEqual(revealed.panel6ForwardOutcome.revealed, true);
  assert(revealed.panel6ForwardOutcome.horizons.length === 4);
});

test('Unavailable historical dates return explicit DATA_UNAVAILABLE without mock fallbacks', () => {
  const beforeStart = computeReplayAtDate('2023-06-01', {
    pairId: 'GOLDM_CALENDAR',
    reveal: false,
    sourceRows: realRows,
  });
  assert.strictEqual(beforeStart.panel1DataAvailability.marketStatus, 'DATA_UNAVAILABLE');
  assert.strictEqual(beforeStart.panel3NormalizedSpread.available, false);
  assert.strictEqual(beforeStart.panel5Verdict, null);

  // GOLDTEN was listed Jan 2025 onwards; pre-2025 date must explicitly mark GOLDTEN_GOLDM unavailable
  const preGoldten = computeReplayAtDate('2024-09-15', {
    pairId: 'GOLDTEN_GOLDM',
    reveal: false,
    sourceRows: realRows,
  });
  assert.strictEqual(preGoldten.panel3NormalizedSpread.available, false);
  assert(preGoldten.panel3NormalizedSpread.unavailableReason?.includes('2025-04-01'));
});

console.log(`  Result: ${passed}/${total} passed\n`);
