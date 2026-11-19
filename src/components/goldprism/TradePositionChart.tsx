'use client'

import * as React from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { inr } from '@/lib/goldprism/format'

interface PricePoint {
  price: number
  timestamp: number
}

export function TradePositionChart({
  symbol,
  currentPrice,
  entryPrice,
  observedAt,
  sourceAsOf,
}: {
  symbol: string
  currentPrice: number
  entryPrice: number
  observedAt: string | null
  sourceAsOf: string | null
}) {
  const [points, setPoints] = React.useState<PricePoint[]>([])
  const [clockMs, setClockMs] = React.useState(() => Date.now())

  React.useEffect(() => {
    if (!observedAt || !Number.isFinite(currentPrice) || currentPrice <= 0) return
    const timestamp = Date.parse(observedAt)
    if (!Number.isFinite(timestamp)) return

    const point: PricePoint = {
      price: currentPrice,
      timestamp,
    }

    setPoints((previous) => {
      const last = previous[previous.length - 1]
      if (last && timestamp < last.timestamp) return previous
      if (last?.timestamp === timestamp && last.price === currentPrice) return previous
      if (last?.timestamp === timestamp) return [...previous.slice(0, -1), point]
      return [...previous, point].slice(-60)
    })
  }, [currentPrice, observedAt])

  React.useEffect(() => {
    const timer = window.setInterval(() => setClockMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const chartPoints = React.useMemo(() => {
    if (points.length === 0) return []
    const start = Math.max(clockMs - 60_000, points[0].timestamp)
    const lastBeforeStart = [...points].reverse().find((point) => point.timestamp <= start)
    const visible = points.filter((point) => point.timestamp > start && point.timestamp <= clockMs)
    const lastObserved = visible[visible.length - 1] ?? lastBeforeStart ?? points[0]
    const result: PricePoint[] = []

    if (lastBeforeStart) {
      result.push({ timestamp: start, price: lastBeforeStart.price })
    }
    result.push(...visible)

    if (result.length === 0) result.push(lastObserved)
    if (result[result.length - 1].timestamp < clockMs) {
      result.push({ timestamp: clockMs, price: lastObserved.price })
    }
    return result
  }, [clockMs, points])

  const sourceTimestamp = sourceAsOf ? Date.parse(sourceAsOf) : Number.NaN
  const sourceAgeSeconds = Number.isFinite(sourceTimestamp)
    ? Math.max(0, Math.floor((clockMs - sourceTimestamp) / 1000))
    : null

  return (
    <div
      className="mt-3 h-32 w-full"
      aria-label={`${symbol} paper position rolling live price chart`}
      data-chart-now={clockMs}
    >
      {chartPoints.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartPoints} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid
              stroke="var(--border)"
              strokeDasharray="3 5"
              vertical={false}
            />
            <XAxis
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={[Math.max(clockMs - 60_000, points[0].timestamp), clockMs]}
              allowDataOverflow
              tickCount={5}
              interval={0}
              tickFormatter={(value: number) => new Date(value).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              domain={['auto', 'auto']}
              tickFormatter={(value: number) => `₹${Number(value).toLocaleString('en-IN')}`}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              width={74}
            />
            <Tooltip
              labelFormatter={(value) => `Observed ${new Date(Number(value)).toLocaleTimeString('en-IN')}`}
              formatter={(value) => [inr(Number(value), 2), 'Indicative parity']}
              contentStyle={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                fontSize: 11,
              }}
            />
            <ReferenceLine
              y={entryPrice}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              label={{
                value: 'ENTRY',
                position: 'insideTopRight',
                fill: 'var(--muted-foreground)',
                fontSize: 9,
              }}
            />
            <Line
              type="monotone"
              dataKey="price"
              name="Indicative parity"
              stroke="var(--gp-caramel)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center font-mono text-[10px] text-muted-foreground">
          Waiting for the next timestamped live quote…
        </div>
      )}
      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
        Live indicative parity · rolling 60s · flat until next verified quote
        {sourceAgeSeconds !== null ? ` · source ${sourceAgeSeconds}s ago` : ''}
      </p>
    </div>
  )
}
