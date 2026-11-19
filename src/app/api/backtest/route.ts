import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  computeFullReplaySummary,
  loadDatasetProvenance,
  REPLAY_PAIRS,
} from '@/lib/goldprism/historical-store'

export const runtime = 'nodejs'
export const maxDuration = 60

const requestSchema = z.object({
  pair: z
    .enum(['GOLDM_CALENDAR', 'GOLDTEN_GOLDM', 'GOLDGUINEA_GOLDM', 'GOLDPETAL_GOLDM'])
    .default('GOLDM_CALENDAR'),
  initialCapitalInr: z.number().finite().min(1).max(1_000_000_000).default(1_000_000),
})

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0
  const mean = average(values)
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)))
}

export async function POST(req: NextRequest) {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Malformed JSON body' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid replay request', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const { pair, initialCapitalInr } = parsed.data
    const provenance = loadDatasetProvenance()
    const replay = computeFullReplaySummary(pair)
    if (replay.equityCurve.length === 0) {
      return NextResponse.json(
        { error: `No historical observations are available for ${pair}.` },
        { status: 503 }
      )
    }

    const monthlyPoints = new Map<string, (typeof replay.equityCurve)[number]>()
    for (const point of replay.equityCurve) {
      monthlyPoints.set(point.date.slice(0, 7), point)
    }
    const equityCurve = Array.from(monthlyPoints, ([month, point]) => ({
      month,
      value: Number((initialCapitalInr + point.cumulativeNetPnlInr).toFixed(2)),
    }))
    const monthlyReturns = equityCurve.slice(1).map((point, index) => {
      const previous = equityCurve[index].value
      return {
        month: point.month,
        return: Number((((point.value - previous) / previous) * 100).toFixed(4)),
      }
    })

    const dailyPnl = replay.equityCurve.map((point, index) => {
      const previous = replay.equityCurve[index - 1]?.cumulativeNetPnlInr ?? 0
      return point.cumulativeNetPnlInr - previous
    })
    const dailyReturns = dailyPnl.map((pnl) => pnl / initialCapitalInr)
    const dailyVolatility = standardDeviation(dailyReturns)
    const downsideDeviation = Math.sqrt(
      average(dailyReturns.filter((value) => value < 0).map((value) => value ** 2))
    )
    const years = Math.max(
      1 / 365,
      (new Date(replay.allDates.at(-1) ?? provenance.dateRangeEnd).getTime() -
        new Date(replay.allDates[0] ?? provenance.dateRangeStart).getTime()) /
        (365 * 24 * 60 * 60 * 1000)
    )
    const netPnl =
      replay.equityCurve.at(-1)?.cumulativeNetPnlInr ?? 0
    const finalEquity = initialCapitalInr + netPnl
    let peakEquity = initialCapitalInr
    let maxDrawdownPct = 0
    for (const point of replay.equityCurve) {
      const equity = initialCapitalInr + point.cumulativeNetPnlInr
      peakEquity = Math.max(peakEquity, equity)
      maxDrawdownPct = Math.min(maxDrawdownPct, ((equity - peakEquity) / peakEquity) * 100)
    }

    const totalTrades =
      replay.trainingStats.executedTrades + replay.holdoutStats.executedTrades
    const wins = replay.trainingStats.wins + replay.holdoutStats.wins
    const winningPnl =
      replay.trainingStats.positiveNetTradePnlInr +
      replay.holdoutStats.positiveNetTradePnlInr
    const losingPnl =
      replay.trainingStats.negativeNetTradePnlInr +
      replay.holdoutStats.negativeNetTradePnlInr
    const observations = [
      `Source: ${provenance.datasetName}; SHA-256 ${provenance.sha256Hash}.`,
      `Dataset range: ${provenance.dateRangeStart} to ${provenance.dateRangeEnd}.`,
      `Training boundary: ${replay.trainingBoundaryDate}; sealed holdout begins ${replay.holdoutStartDate}.`,
      `Executed fills: ${totalTrades}; training ${replay.trainingStats.executedTrades}, holdout ${replay.holdoutStats.executedTrades}.`,
      `Modeled total cost drag: ₹${(replay.trainingStats.totalCostDragInr + replay.holdoutStats.totalCostDragInr).toLocaleString('en-IN')}.`,
    ]

    return NextResponse.json({
      summary: `${REPLAY_PAIRS[pair].label} point-in-time replay over ${replay.allDates.length} MCX Bhavcopy sessions. This is the fixed GoldPrism edge-gated spread strategy; custom visual-indicator blocks are not applied.`,
      strategyApplied: 'GoldPrism edge-gated replay',
      strategyNote:
        'The legacy visual indicator blocks are not supported by this MCX spread dataset and do not affect these results.',
      metrics: {
        totalReturn: Number((((finalEquity - initialCapitalInr) / initialCapitalInr) * 100).toFixed(4)),
        annualReturn:
          finalEquity > 0
            ? Number((((finalEquity / initialCapitalInr) ** (1 / years) - 1) * 100).toFixed(4))
            : -100,
        sharpe:
          dailyVolatility > 0
            ? Number(((average(dailyReturns) / dailyVolatility) * Math.sqrt(252)).toFixed(3))
            : 0,
        sortino:
          downsideDeviation > 0
            ? Number(((average(dailyReturns) / downsideDeviation) * Math.sqrt(252)).toFixed(3))
            : 0,
        maxDrawdown: Number(maxDrawdownPct.toFixed(3)),
        winRate: totalTrades > 0 ? Number(((wins / totalTrades) * 100).toFixed(2)) : 0,
        profitFactor: losingPnl > 0 ? Number((winningPnl / losingPnl).toFixed(3)) : null,
        volatility: Number((dailyVolatility * Math.sqrt(252) * 100).toFixed(3)),
        executedTrades: totalTrades,
      },
      monthlyReturns,
      equityCurve,
      observations,
      recommendation:
        'Research output only—not investment advice or an execution instruction. Review training and sealed-holdout results separately before drawing conclusions.',
    })
  } catch (error) {
    console.error('Backtest API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to compute the historical GoldPrism replay.',
        details: error instanceof Error ? error.message : 'Unknown server error',
      },
      { status: 500 }
    )
  }
}
