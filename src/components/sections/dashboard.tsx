'use client'

import * as React from 'react'
import { motion } from 'motion/react'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Gauge,
  Newspaper,
  TrendingUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  INDEXES,
  NEWS_FEED,
  PORTFOLIO,
  PORTFOLIO_HISTORY,
  PORTFOLIO_STATS,
  BENCHMARK_HISTORY,
  SECTORS,
  WATCHLIST,
  genCandles,
} from '@/lib/mock-data'
import { Area, AreaChart } from '@/components/charts/area-chart'
import { Grid } from '@/components/charts/grid'
import { Line } from '@/components/charts/line-chart'
import { XAxis } from '@/components/charts/x-axis'
import { YAxis } from '@/components/charts/y-axis'
import { ChartTooltip } from '@/components/charts/tooltip'
import {
  Legend,
  LegendItem,
  LegendLabel,
  LegendMarker,
} from '@/components/charts/legend'
import { LineSparkline } from '@/components/charts/sparkline'

const SENTIMENT_COLORS = {
  bullish: 'gp-pos gp-tint-pos',
  bearish: 'gp-neg gp-tint-neg',
  neutral: 'text-muted-foreground bg-muted',
}

function MiniStat({
  label,
  value,
  change,
  changePct,
}: {
  label: string
  value: string
  change: number
  changePct: number
}) {
  const up = change >= 0
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums mt-0.5">{value}</div>
      <div
        className={cn(
          'flex items-center gap-1 text-xs mt-0.5 tabular-nums',
          up ? 'gp-pos' : 'gp-neg'
        )}
      >
        {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {Math.abs(change).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        ({up ? '+' : ''}{changePct.toFixed(2)}%)
      </div>
    </Card>
  )
}

export function Dashboard() {
  const merged = PORTFOLIO_HISTORY.map((p, i) => ({
    date: p.date,
    portfolio: p.value,
    benchmark: BENCHMARK_HISTORY[i].value,
  }))

  const candleData = React.useMemo(() => genCandles(42, 40, 100), [])

  return (
    <section id="dashboard" className="py-16 md:py-24 scroll-mt-20">
      <div className="container mx-auto px-4 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8"
        >
          <div>
            <Badge variant="outline" className="mb-2 gap-1">
              <Gauge className="w-3 h-3" /> Live Market Dashboard
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Your portfolio at a glance
            </h2>
            <p className="text-muted-foreground mt-2 max-w-xl">
              Real-time indexes, sector heatmap, news sentiment, and your
              paper-trading P&L — all on one screen.
            </p>
          </div>
        </motion.div>

        {/* Index Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {INDEXES.map((idx) => {
            const up = idx.change >= 0
            return (
              <Card key={idx.name} className="p-3">
                <div className="text-xs text-muted-foreground">{idx.name}</div>
                <div className="text-base font-semibold tabular-nums mt-0.5">
                  {idx.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div
                  className={cn(
                    'flex items-center gap-0.5 text-xs mt-0.5 tabular-nums',
                    up ? 'gp-pos' : 'gp-neg'
                  )}
                >
                  {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {up ? '+' : ''}{idx.changePct.toFixed(2)}%
                </div>
              </Card>
            )
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Portfolio value */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Portfolio Value
                </CardTitle>
                <div className="text-3xl font-bold tabular-nums mt-1">
                  ${PORTFOLIO_STATS.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Day Change</div>
                <div
                  className={cn(
                    'text-lg font-semibold tabular-nums',
                    PORTFOLIO_STATS.dayChange >= 0 ? 'gp-pos' : 'gp-neg'
                  )}
                >
                  {PORTFOLIO_STATS.dayChange >= 0 ? '+' : ''}${Math.abs(PORTFOLIO_STATS.dayChange).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div
                  className={cn(
                    'text-xs tabular-nums',
                    PORTFOLIO_STATS.dayChange >= 0 ? 'gp-pos' : 'gp-neg'
                  )}
                >
                  {PORTFOLIO_STATS.dayChangePct >= 0 ? '+' : ''}{PORTFOLIO_STATS.dayChangePct.toFixed(2)}%
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <AreaChart
                data={merged.map((m) => ({
                  date: new Date(`${m.date}-01T00:00:00`),
                  portfolio: m.portfolio,
                  benchmark: m.benchmark,
                }))}
                margin={{ top: 8, right: 12, bottom: 24, left: 48 }}
                aspectRatio=""
                className="h-[240px] w-full"
              >
                <Grid horizontal stroke="var(--border)" strokeDasharray="3 3" fadeHorizontal={false} />
                <XAxis numTicks={6} />
                <YAxis formatValue={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <ChartTooltip
                  indicatorColor="var(--gp-slag-500)"
                  indicatorFadeEdges="none"
                  rows={(point) => [
                    {
                      color: 'var(--foreground)',
                      label: 'Portfolio',
                      value: `$${Number(point.portfolio).toLocaleString('en-US', { minimumFractionDigits: 0 })}`,
                    },
                    {
                      color: 'var(--muted-foreground)',
                      label: 'SPY Benchmark',
                      value: `$${Number(point.benchmark).toLocaleString('en-US', { minimumFractionDigits: 0 })}`,
                    },
                  ]}
                />
                <Area
                  dataKey="portfolio"
                  stroke="var(--foreground)"
                  strokeWidth={2}
                  fill="var(--gp-slag-300)"
                  fillOpacity={0.22}
                  gradientToOpacity={0.22}
                  fadeEdges={false}
                />
                <Line
                  dataKey="benchmark"
                  stroke="var(--muted-foreground)"
                  strokeWidth={1.5}
                  dashFromIndex={0}
                  dashArray="4,4"
                  showHighlight={false}
                  fadeEdges={false}
                />
              </AreaChart>
              <Legend
                className="mt-2 flex-row justify-center gap-4"
                items={[
                  { label: 'Portfolio', value: 0, color: 'var(--foreground)' },
                  { label: 'SPY Benchmark', value: 0, color: 'var(--muted-foreground)' },
                ]}
              >
                <LegendItem className="rounded-[2px] px-1 py-0.5">
                  <LegendMarker className="h-2 w-2 rounded-[2px]" />
                  <LegendLabel className="text-xs font-normal" />
                </LegendItem>
              </Legend>
            </CardContent>
          </Card>

          {/* Performance gauges */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Risk Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 pt-2">
              <MiniStat label="Sharpe" value={PORTFOLIO_STATS.sharpe.toFixed(2)} change={0} changePct={0} />
              <MiniStat label="Sortino" value={PORTFOLIO_STATS.sortino.toFixed(2)} change={0} changePct={0} />
              <MiniStat label="Max DD" value={`${PORTFOLIO_STATS.maxDrawdown.toFixed(1)}%`} change={0} changePct={0} />
              <MiniStat label="Volatility" value={`${PORTFOLIO_STATS.volatility.toFixed(1)}%`} change={0} changePct={0} />
              <MiniStat label="Beta" value={PORTFOLIO_STATS.beta.toFixed(2)} change={0} changePct={0} />
              <MiniStat label="Alpha" value={`${PORTFOLIO_STATS.alpha.toFixed(1)}%`} change={0} changePct={0} />
              <MiniStat label="Win Rate" value={`${PORTFOLIO_STATS.winRate.toFixed(1)}%`} change={0} changePct={0} />
              <MiniStat label="Profit Factor" value={PORTFOLIO_STATS.profitFactor.toFixed(2)} change={0} changePct={0} />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Holdings */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="w-4 h-4 text-primary" />
                Holdings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground sticky top-0 bg-card">
                    <tr>
                      <th className="text-left font-medium pb-2">Symbol</th>
                      <th className="text-right font-medium pb-2">Qty</th>
                      <th className="text-right font-medium pb-2">Avg</th>
                      <th className="text-right font-medium pb-2">Last</th>
                      <th className="text-right font-medium pb-2">P&L</th>
                      <th className="text-right font-medium pb-2">Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PORTFOLIO.map((p) => (
                      <tr key={p.symbol} className="border-t border-border hover:bg-muted/30 transition-colors">
                        <td className="py-2.5">
                          <div className="font-semibold">{p.symbol}</div>
                          <div className="text-xs text-muted-foreground">{p.name}</div>
                        </td>
                        <td className="text-right tabular-nums">{p.qty}</td>
                        <td className="text-right tabular-nums text-muted-foreground">${p.avgPrice.toFixed(2)}</td>
                        <td className="text-right tabular-nums">${p.currentPrice.toFixed(2)}</td>
                        <td className={cn('text-right tabular-nums font-medium', p.pnl >= 0 ? 'gp-pos' : 'gp-neg')}>
                          {p.pnl >= 0 ? '+' : ''}${p.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <div className="text-xs font-normal">
                            ({p.pnlPct >= 0 ? '+' : ''}{p.pnlPct.toFixed(2)}%)
                          </div>
                        </td>
                        <td className="text-right tabular-nums text-muted-foreground">{(p.weight * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Sector heatmap */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Sector Heatmap</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {SECTORS.map((s) => {
                  const intensity = Math.min(1, Math.abs(s.change) / 3)
                  const bg = s.change >= 0
                    ? `color-mix(in srgb, var(--gp-tradable-ink) ${Math.round((0.15 + intensity * 0.5) * 100)}%, transparent)`
                    : `color-mix(in srgb, var(--gp-blocked-ink) ${Math.round((0.15 + intensity * 0.5) * 100)}%, transparent)`
                  return (
                    <div key={s.name} className="flex items-center gap-2">
                      <div className="w-28 text-xs truncate">{s.name}</div>
                      <div className="flex-1 h-6 rounded-[2px] relative overflow-hidden" style={{ background: 'var(--muted)' }}>
                        <div
                          className="absolute inset-y-0 left-0 rounded-[2px] flex items-center justify-end px-2 text-xs font-medium"
                          style={{
                            width: `${Math.max(8, Math.abs(s.change) * 25)}%`,
                            background: bg,
                          }}
                        >
                          {s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Watchlist + News */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="w-4 h-4 text-primary" />
                Watchlist
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80">
                <div className="space-y-1">
                  {WATCHLIST.map((w) => (
                    <div key={w.symbol} className="flex items-center justify-between py-1.5 px-2 rounded-[2px] hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm">{w.symbol}</div>
                          <div className="text-xs text-muted-foreground truncate">{w.name}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <LineSparkline
                          data={w.sparkline}
                          dataKey={(d) => d}
                          width={48}
                          height={20}
                          curve="linear"
                          strokeWidth={1.5}
                          color={
                            w.sparkline[w.sparkline.length - 1] >= w.sparkline[0]
                              ? 'var(--gp-tradable-ink)'
                              : 'var(--gp-blocked-ink)'
                          }
                          endDot={false}
                          interactive={false}
                        />
                        <div className="text-right min-w-[80px]">
                          <div className="text-sm font-medium tabular-nums">${w.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          <div className={cn('text-xs tabular-nums', w.changePct >= 0 ? 'gp-pos' : 'gp-neg')}>
                            {w.changePct >= 0 ? '+' : ''}{w.changePct.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Newspaper className="w-4 h-4 text-primary" />
                Market News &amp; Sentiment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80">
                <div className="space-y-3">
                  {NEWS_FEED.map((n) => (
                    <div key={n.id} className="pb-3 border-b border-border last:border-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm leading-snug">{n.title}</div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>{n.source}</span>
                            <span>·</span>
                            <span>{n.time}</span>
                            {n.tickers.map((t) => (
                              <Badge key={t} variant="outline" className="text-[10px] px-1 py-0 h-4">
                                {t}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Badge variant="secondary" className={cn('text-[10px] capitalize shrink-0', SENTIMENT_COLORS[n.sentiment])}>
                          {n.sentiment}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{n.summary}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
