import { NextResponse } from 'next/server'
import {
  compareContracts,
  explainVerdict,
  liquidityRanking,
} from '@/lib/goldprism/analyst-tools'
import {
  computeFullReplaySummary,
  getSnapshotAsOf,
  loadDatasetProvenance,
} from '@/lib/goldprism/historical-store'

export const runtime = 'nodejs'
export const maxDuration = 60

const workerDefinitions = [
  { id: 'gp1', name: 'Data Quality Analyst', role: 'Bhavcopy ingestion & integrity gates', dependencies: [] },
  { id: 'gp2', name: 'Contract Normalization Analyst', role: 'Normalizes contract prices to 10g pure gold', dependencies: ['gp1'] },
  { id: 'gp3', name: 'Spread Decomposition Analyst', role: 'Measures the historical spread waterfall', dependencies: ['gp2'] },
  { id: 'gp4', name: 'Transaction-Cost Analyst', role: 'Checks net edge after modeled transaction costs', dependencies: ['gp2'] },
  { id: 'gp5', name: 'Backtest & Validation Analyst', role: 'Reads the audited replay summary', dependencies: ['gp3', 'gp4'] },
  { id: 'gp6', name: 'Independent Risk Reviewer', role: 'Reviews drawdown and evidence boundaries', dependencies: ['gp5'] },
  { id: 'gp7', name: 'Final Verdict Authority', role: 'Reports the evidence-based verdict', dependencies: ['gp6'] },
] as const

export async function POST() {
  try {
    const provenance = loadDatasetProvenance()
    const asOf = provenance.dateRangeEnd
    const snapshot = getSnapshotAsOf(asOf)
    if (!snapshot.resolvedTradeDate) {
      return NextResponse.json(
        { error: `No historical MCX data is available on or before ${asOf}.` },
        { status: 503 }
      )
    }

    const comparison = compareContracts('GOLDTEN', 'GOLDM', snapshot.resolvedTradeDate)
    const comparisonData = comparison.status === 'OK' ? comparison : null
    const decomposition = comparisonData?.decomposition ?? null
    const liquidity = liquidityRanking(snapshot.resolvedTradeDate)
    const replay = computeFullReplaySummary('GOLDTEN_GOLDM', undefined, asOf)
    const verdict = explainVerdict(`${snapshot.resolvedTradeDate}:GOLDTEN_GOLDM`)
    const periodPnl = replay.equityCurve.at(-1)?.cumulativeNetPnlInr ?? 0
    const peak = replay.equityCurve.reduce(
      (state, point) => {
        const equity = point.cumulativeNetPnlInr
        const nextPeak = Math.max(state.peak, equity)
        return {
          peak: nextPeak,
          maxDrawdown: Math.min(state.maxDrawdown, equity - nextPeak),
        }
      },
      { peak: 0, maxDrawdown: 0 }
    )
    const source = `${provenance.datasetName} (${provenance.sha256Hash.slice(0, 12)})`
    const workers = workerDefinitions.map((worker) => {
      let output: string
      switch (worker.id) {
        case 'gp1':
          output = `Snapshot ${snapshot.resolvedTradeDate}: ${snapshot.rowsAvailableUpToAsOf} rows across ${snapshot.tradingDaysAvailableUpToAsOf} trading dates. Available: ${snapshot.availableContractsOnDate.join(', ') || 'none'}. Missing: ${snapshot.missingContractsOnDate.join(', ') || 'none'}. Dataset SHA-256: ${provenance.sha256Hash}.`
          break
        case 'gp2':
          output = comparisonData && decomposition
            ? `On ${comparisonData.asOf}, GOLDTEN normalized to ₹${comparisonData.normalized10gA}/10g and GOLDM to ₹${comparisonData.normalized10gB}/10g.`
            : `Normalization comparison unavailable: ${comparison.message ?? 'required contracts missing'}.`
          break
        case 'gp3':
          output =
            decomposition
              ? `Historical normalized premium ${comparisonData?.normalizedPremiumBps} bps. Basis ${decomposition.purityEffectBps} bps; expiry carry ${decomposition.expiryCarryBps} bps; other residual ${decomposition.residualOtherBps} bps.`
              : 'Spread decomposition unavailable because the required historical contracts are not present.'
          break
        case 'gp4':
          output =
            decomposition
              ? `Modeled round-trip cost ${decomposition.transactionCostsBps} bps; net edge ${decomposition.netEdgeBps} bps; waterfall verdict ${decomposition.verdict}.`
              : 'Cost-adjusted edge unavailable because the required historical contracts are not present.'
          break
        case 'gp5':
          output = `Audited GOLDTEN/GOLDM replay: ${replay.allDates.length} sessions, ${replay.trainingStats.executedTrades + replay.holdoutStats.executedTrades} executed fills, training net P&L ₹${replay.trainingStats.cumulativeNetPnlInr.toLocaleString('en-IN')}, holdout net P&L ₹${replay.holdoutStats.cumulativeNetPnlInr.toLocaleString('en-IN')}. Source: ${source}.`
          break
        case 'gp6':
          output = `Replay cumulative net P&L: ₹${periodPnl.toLocaleString('en-IN')}; maximum peak-to-trough drawdown in the cumulative series: ₹${peak.maxDrawdown.toLocaleString('en-IN')}. Archive scope: ${provenance.dateRangeStart} to ${snapshot.resolvedTradeDate}. The supplied archive has no account-level margin or broker execution data.`
          break
        default:
          output =
            verdict.status === 'OK'
              ? `Latest audited verdict: ${verdict.verdict ?? 'unavailable'} — ${verdict.verdictTitle ?? verdict.verdictMessage ?? 'No verdict detail available.'} Failing gates: ${verdict.failingFilters.join('; ') || 'none reported'}.`
              : `No final verdict: ${verdict.message ?? 'the evidence is unavailable'}.`
      }

      return {
        ...worker,
        status: 'done' as const,
        output,
      }
    })

    return NextResponse.json({
      preset: 'goldprism-quant-desk',
      asOf: snapshot.resolvedTradeDate,
      source,
      workers,
      summary: {
        liquidityStatus: liquidity.status,
        replayNetPnlInr: periodPnl,
        verdict: decomposition ? decomposition.verdict : 'UNAVAILABLE',
      },
      disclaimer:
        'This is a deterministic research pipeline over the bundled historical archive, not a debate between generative agents and not a live MCX quote.',
    })
  } catch (error) {
    console.error('GoldPrism swarm error:', error)
    return NextResponse.json(
      {
        error: 'Unable to run the historical GoldPrism research pipeline.',
        details: error instanceof Error ? error.message : 'Unknown server error',
      },
      { status: 500 }
    )
  }
}
