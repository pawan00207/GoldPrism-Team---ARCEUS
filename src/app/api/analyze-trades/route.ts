import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must use YYYY-MM-DD')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, 'date must be a valid calendar date')

const tradeSchema = z.object({
  date: dateSchema,
  symbol: z.string().trim().min(1).max(32),
  side: z.string().trim().toUpperCase().pipe(z.enum(['BUY', 'SELL'])),
  qty: z.coerce.number().finite().positive(),
  price: z.coerce.number().finite().positive(),
  pnl: z.coerce.number().finite(),
  holdingDays: z.coerce.number().finite().min(0).optional().default(0),
})

const requestSchema = z.object({
  trades: z.array(tradeSchema).min(1).max(1000),
})

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
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
      { error: 'Invalid trade journal', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const trades = parsed.data.trades
    .map((trade, index) => ({ ...trade, index }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.index - b.index)
  const closedTrades = trades.filter((trade) => trade.holdingDays > 0 || trade.pnl !== 0)
  const wins = closedTrades.filter((trade) => trade.pnl > 0)
  const losses = closedTrades.filter((trade) => trade.pnl < 0)
  const breakEven = closedTrades.length - wins.length - losses.length
  const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0)
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0))
  const realizedPnl = closedTrades.reduce((sum, trade) => sum + trade.pnl, 0)
  const averageHoldingDays =
    closedTrades.length > 0
      ? closedTrades.reduce((sum, trade) => sum + trade.holdingDays, 0) /
        closedTrades.length
      : null
  const activeDays = new Set(trades.map((trade) => trade.date)).size

  let runningPnl = 0
  let peakPnl = 0
  let maxDrawdown = 0
  for (const trade of closedTrades) {
    runningPnl += trade.pnl
    peakPnl = Math.max(peakPnl, runningPnl)
    maxDrawdown = Math.min(maxDrawdown, runningPnl - peakPnl)
  }

  const metrics = [
    {
      metric: 'Closed trades',
      value: String(closedTrades.length),
      benchmark: 'Not supplied',
      status: 'neutral',
      description: `${wins.length} wins, ${losses.length} losses, ${breakEven} break-even; rows with zero P&L and no holding period are treated as entries.`,
    },
    {
      metric: 'Win rate',
      value: closedTrades.length
        ? `${((wins.length / closedTrades.length) * 100).toFixed(1)}%`
        : 'N/A',
      benchmark: 'Not supplied',
      status: 'neutral',
      description: 'Winning closed rows divided by all closed rows, including break-even rows.',
    },
    {
      metric: 'Realized P&L',
      value: formatCurrency(realizedPnl),
      benchmark: 'Not supplied',
      status: 'neutral',
      description: 'Sum of P&L on rows classified as closed using P&L or holdingDays.',
    },
    {
      metric: 'Profit factor',
      value: grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : 'N/A',
      benchmark: 'Not supplied',
      status: 'neutral',
      description: 'Gross winning P&L divided by gross losing P&L; unavailable when no losing P&L is present.',
    },
    {
      metric: 'Average holding period',
      value: averageHoldingDays === null ? 'N/A' : `${averageHoldingDays.toFixed(1)} days`,
      benchmark: 'Not supplied',
      status: 'neutral',
      description: 'Mean holdingDays among rows classified as closed.',
    },
    {
      metric: 'Maximum realized drawdown',
      value: formatCurrency(maxDrawdown),
      benchmark: 'Not supplied',
      status: 'neutral',
      description: 'Largest peak-to-trough drawdown in the date-sorted cumulative realized P&L series.',
    },
    {
      metric: 'Orders per active day',
      value: (trades.length / activeDays).toFixed(2),
      benchmark: 'Descriptive only',
      status: 'neutral',
      description: `Based on ${trades.length} submitted rows over ${activeDays} distinct trading dates; this is not an overtrading score.`,
    },
  ]

  return NextResponse.json({
    summary: `Descriptive journal statistics from ${trades.length} submitted rows (${closedTrades.length} classified as closed). Realized P&L is ${formatCurrency(realizedPnl)}. No behavioral bias or strategy rule is inferred from these fields alone.`,
    metrics,
    biases: [],
    extractedRules: [],
    recommendation:
      'This CSV does not contain enough information to infer entry/exit rules, risk limits, or behavioral bias. Add explicit position sizing, account equity, entry rationale, and exit rationale fields before drawing those conclusions.',
  })
}
