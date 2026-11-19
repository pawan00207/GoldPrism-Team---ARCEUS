'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Calculator, Loader2, Play } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type ReplayPair =
  | 'GOLDM_CALENDAR'
  | 'GOLDTEN_GOLDM'
  | 'GOLDGUINEA_GOLDM'
  | 'GOLDPETAL_GOLDM'

interface BacktestResult {
  summary: string
  strategyNote: string
  metrics: {
    totalReturn: number
    annualReturn: number
    sharpe: number
    sortino: number
    maxDrawdown: number
    winRate: number
    profitFactor: number | null
    volatility: number
    executedTrades: number
  }
  monthlyReturns: Array<{ month: string; return: number }>
  equityCurve: Array<{ month: string; value: number }>
  observations: string[]
  recommendation: string
}

const REPLAY_PAIRS: Array<{ value: ReplayPair; label: string }> = [
  { value: 'GOLDM_CALENDAR', label: 'GOLDM near vs far calendar' },
  { value: 'GOLDTEN_GOLDM', label: 'GOLDTEN vs GOLDM' },
  { value: 'GOLDGUINEA_GOLDM', label: 'GOLDGUINEA vs GOLDM' },
  { value: 'GOLDPETAL_GOLDM', label: 'GOLDPETAL vs GOLDM' },
]

export function StrategyBuilder() {
  const [pair, setPair] = React.useState<ReplayPair>('GOLDM_CALENDAR')
  const [capital, setCapital] = React.useState('1000000')
  const [result, setResult] = React.useState<BacktestResult | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function runBacktest() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const response = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pair, initialCapitalInr: Number(capital) }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Historical replay failed')
      setResult(data as BacktestResult)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Historical replay failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="builder" className="py-16 md:py-24 scroll-mt-16">
      <div className="container mx-auto px-4 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          className="mb-8"
        >
          <Badge variant="outline" className="mb-2 gap-1">
            <Calculator className="w-3 h-3" /> Historical Replay
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Replay the verified GoldPrism spread strategy
          </h2>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Run the fixed, point-in-time GoldPrism edge-gated strategy against
            the bundled MCX Bhavcopy. Generic indicator blocks and broker
            execution are not modeled.
          </p>
        </motion.div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Replay Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="replay-pair" className="text-xs">Historical spread pair</Label>
                <select
                  id="replay-pair"
                  value={pair}
                  onChange={(event) => setPair(event.target.value as ReplayPair)}
                  className="mt-1 h-10 w-full rounded-[2px] border border-input bg-background px-3 text-sm"
                >
                  {REPLAY_PAIRS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="replay-capital" className="text-xs">Initial Capital (INR)</Label>
                <Input
                  id="replay-capital"
                  type="number"
                  value={capital}
                  onChange={(event) => setCapital(event.target.value)}
                  className="mt-1 text-sm"
                  min="1"
                  max="1000000000"
                />
              </div>
            </div>

            <div className="rounded-[2px] border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
              The selected pair affects the replay. Initial capital is used
              only to scale the reported equity and returns; contract sizing
              remains fixed by the historical engine. No synthetic sample
              trades or benchmark-relative alpha/beta are generated.
            </div>

            <Button
              onClick={runBacktest}
              disabled={loading || !Number.isFinite(Number(capital)) || Number(capital) <= 0 || Number(capital) > 1_000_000_000}
              className="w-full gap-2"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running historical replay…
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Historical Replay
                </>
              )}
            </Button>

            {error && (
              <div className="p-2.5 rounded-[2px] gp-tint-neg gp-neg text-xs">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4"
          >
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Monthly Equity Curve</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={result.equityCurve} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="grad-bt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--foreground)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--foreground)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 2, fontSize: 12 }}
                      formatter={(value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                    />
                    <Area type="monotone" dataKey="value" stroke="var(--foreground)" strokeWidth={2} fill="url(#grad-bt)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Replay Metrics</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <MetricBox label="Total Return" value={`${result.metrics.totalReturn.toFixed(2)}%`} positive={result.metrics.totalReturn >= 0} />
                <MetricBox label="Annualized Return" value={`${result.metrics.annualReturn.toFixed(2)}%`} positive={result.metrics.annualReturn >= 0} />
                <MetricBox label="Sharpe" value={result.metrics.sharpe.toFixed(2)} />
                <MetricBox label="Sortino" value={result.metrics.sortino.toFixed(2)} />
                <MetricBox label="Max Drawdown" value={`${result.metrics.maxDrawdown.toFixed(2)}%`} positive={result.metrics.maxDrawdown >= 0} />
                <MetricBox label="Volatility" value={`${result.metrics.volatility.toFixed(2)}%`} />
                <MetricBox label="Win Rate" value={`${result.metrics.winRate.toFixed(1)}%`} />
                <MetricBox label="Profit Factor" value={result.metrics.profitFactor?.toFixed(2) ?? 'N/A'} />
                <MetricBox label="Executed Fills" value={String(result.metrics.executedTrades)} />
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Summary &amp; Observations</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed mb-3">{result.summary}</p>
                <p className="mb-4 rounded-[2px] gp-tint-warn gp-warn p-2.5 text-xs">
                  {result.strategyNote}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-2">Observations</div>
                    <ul className="space-y-1.5">
                      {result.observations.map((observation, index) => (
                        <li key={index} className="text-xs flex items-start gap-2">
                          <span className="w-1 h-1 rounded-[1px] bg-primary mt-1.5 shrink-0" />
                          {observation}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-3 rounded-[2px] bg-primary/5 border border-primary/20">
                    <div className="text-xs font-semibold text-primary mb-1">Research Limitation</div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{result.recommendation}</p>
                  </div>
                </div>
                <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                  {result.metrics.executedTrades} fills are included in the replay
                  statistics. Individual trade records are not exposed by the
                  verified summary engine, so no synthetic trade rows are shown.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </section>
  )
}

function MetricBox({
  label,
  value,
  positive,
}: {
  label: string
  value: string
  positive?: boolean
}) {
  return (
    <div className={cn('p-2 rounded-[2px] border', positive ? 'border-[color-mix(in_srgb,var(--gp-tradable-ink)_20%,transparent)] bg-[color-mix(in_srgb,var(--gp-tradable-ink)_5%,transparent)]' : 'border-border bg-muted/30')}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('text-sm font-mono font-semibold tabular-nums', positive ? 'gp-pos' : '')}>
        {value}
      </div>
    </div>
  )
}
