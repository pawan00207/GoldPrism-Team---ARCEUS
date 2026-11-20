import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET as replayRoute } from '../../src/app/api/goldprism/replay/route';
import { strongestSurvivingOpportunity } from '../../src/lib/goldprism/analyst-tools';
import {
  computeFullReplaySummary, computeReplayAtDate, getMatchedPairLots,
  type HistoricalBhavcopyRow,
} from '../../src/lib/goldprism/historical-store';

process.env.GOLDPRISM_DEMO_FIXTURE = '1';
const dates = Array.from({length: 25}, (_, i) => `2025-05-${String(i + 1).padStart(2, '0')}`);
const rows: HistoricalBhavcopyRow[] = dates.flatMap((date, i) =>
  (['GOLDM', 'GOLDTEN'] as const).map(symbol => {
    const a = symbol === 'GOLDTEN';
    const mark = a ? (i >= 20 && i <= 21 ? 77500 : 74800 + (i % 2) * 10) : 74500;
    return {
      symbol, rawDate: date, tradeDate: date, expiryDate: '2025-07-25', expiryCode: '25JUL2025',
      open: mark, high: mark, low: mark, close: mark, settle: mark, contracts: 1000,
      openInterest: 1000, volume: 1000, purity: a ? 999 : 995,
      tradingUnitG: a ? 10 : 100, quoteUnitG: 10, shortHistoryFlag: false,
    };
  })
);

async function verify() {
  assert.deepEqual(getMatchedPairLots('GOLDGUINEA', 'GOLDM'), {lotsA:25, lotsB:2, matchedGrams:200});
  const atSignal = computeReplayAtDate(dates[20], {pairId:'GOLDTEN_GOLDM', reveal:true, sourceRows:rows});
  assert.equal(atSignal.panel5Verdict?.verdict, 'TRADABLE');
  assert.equal(atSignal.panel4ModelState.barsInWindow, 20);
  const one = atSignal.panel6ForwardOutcome!.horizons[0];
  assert.equal(one.entryFillDate, one.targetDate);
  assert.equal(one.grossPnlInrPerG, 0);
  assert(one.netPnlInr! < 0);

  const totals = computeFullReplaySummary('GOLDTEN_GOLDM', rows);
  const trade = totals.trades[0];
  assert.equal(trade.signalDate, dates[20]);
  assert.equal(trade.entryDate, dates[21]);
  assert.equal(trade.exitDate, dates[22]);
  assert.equal(trade.grossPnlInr, (trade.entryA - trade.exitA + trade.exitB - trade.entryB) * 10);
  assert.equal(trade.grossPnlInr, Math.round((trade.relativeValuePnlInr + trade.benchmarkPnlInr) * 100)/100);
  assert.equal(trade.netFineGoldGrams, -0.4);
  assert.equal(trade.netPnlInr, Math.round((trade.grossPnlInr - trade.costInr) * 100)/100);
  assert.equal(totals.equityCurve[21].cumulativeNetPnlInr, 0);
  assert.equal(totals.equityCurve[22].cumulativeNetPnlInr, trade.netPnlInr);
  const partial = computeFullReplaySummary('GOLDTEN_GOLDM', rows, dates[21]);
  assert.equal(partial.trades.length, 0);
  assert.equal(partial.holdoutStats.unresolvedPositions, 1);

  const rolled = rows.map(row => row.symbol === 'GOLDTEN' && row.tradeDate >= dates[21]
    ? {...row, expiryDate:'2025-08-25', expiryCode:'25AUG2025'} : row);
  const rolledOutcome = computeReplayAtDate(dates[20], {pairId:'GOLDTEN_GOLDM', reveal:true, sourceRows:rolled});
  assert.equal(rolledOutcome.panel6ForwardOutcome!.horizons[0].status, 'UNAVAILABLE_CONTRACT');
  assert.equal(computeFullReplaySummary('GOLDTEN_GOLDM', rolled).trades.length, 0);

  const pre = '2024-01-02';
  const response = await replayRoute(new NextRequest(`http://localhost/api/goldprism/replay?as_of=${pre}&include_summary=1`));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert(body.availableDates.length > body.summary.allDates.length);
  assert(body.summary.equityCurve.every((p: {date: string}) => p.date <= pre));
  assert.equal(body.replay.panel6ForwardOutcome, null);
  assert.equal(strongestSurvivingOpportunity(pre).survivingOpportunitiesCount, 0);
  const invalid = await replayRoute(new NextRequest('http://localhost/api/goldprism/replay?as_of=2026-02-30'));
  assert.equal(invalid.status, 400);
  console.log('Exact-expiry P&L, bounded summaries, integer lots and point-in-time signal gates passed.');
}

verify().catch(error => { console.error(error); process.exitCode = 1; });
