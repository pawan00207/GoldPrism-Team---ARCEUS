'use client'

import * as React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  Gauge,
  Radio,
  TrendingUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useLiveFeed } from '@/components/goldprism/LiveFeedProvider'
import { SupportedContractCode } from '@/lib/goldprism/contract-master'
import { compareNormalizedContracts, contractSpecs } from '@/lib/goldprism/contract-specs'
import { bps, inr } from '@/lib/goldprism/format'
import { valuatePaperPosition } from '@/lib/goldprism/trade-engine'
import { cn } from '@/lib/utils'

const SYMBOLS: SupportedContractCode[] = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL']

interface ReplayCurvePoint {
  date: string
  grossEquity: number
  netEquity: number
}

export function Dashboard() {
  const {
    feed,
    loading,
    tickCount,
    equityInr,
    cashInr,
    marginBlockedInr,
    unrealizedPnlInr,
    realizedPnlInr,
    positions,
    livePricesMap,
  } = useLiveFeed()

  const [curve, setCurve] = React.useState<ReplayCurvePoint[]>([])

  React.useEffect(() => {
    let active = true
    void (async () => {
      try {
        const res = await fetch('/api/goldprism/replay?pair=GOLDM_CALENDAR&include_summary=1', {
          cache: 'no-store',
        })
        if (!res.ok) return
        const data = await res.json()
        const rawCurve = data?.summary?.equityCurve
        if (active && Array.isArray(rawCurve)) {
          setCurve(
            rawCurve
              .slice(-45)
              .map(
                (pt: {
                  date: string
                  cumulativeGrossPnlInr?: number
                  cumulativeNetPnlInr?: number
                }) => ({
                  date: pt.date,
                  grossEquity: Math.round(1_000_000 + (pt.cumulativeGrossPnlInr ?? 0)),
                  netEquity: Math.round(1_000_000 + (pt.cumulativeNetPnlInr ?? 0)),
                })
              )
          )
        }
      } catch {
        // Leave empty if replay unreachable
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const contracts = feed?.contracts ?? null
  const isLive = feed?.status === 'LIVE_PARITY' && contracts !== null

  const normalizedRows = React.useMemo(() => {
    if (!contracts) return []
    return compareNormalizedContracts(
      SYMBOLS.map((sym) => ({
        symbol: sym,
        quotedPrice: contracts[sym].quotedPrice,
        expiryDate: contracts[sym].expiryDate,
        asOf: contracts[sym].asOf,
        source: contracts[sym].source,
      })),
      'GOLDM'
    )
  }, [contracts])

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
              <Gauge className="w-3 h-3" /> Live MCX Workspace · Sync #{tickCount}
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Your GoldPrism portfolio &amp; live parity desk
            </h2>
            <p className="text-muted-foreground mt-2 max-w-xl">
              Real-time MCX Gold parity pricing (GOLDM, GOLDTEN, GOLDGUINEA, GOLDPETAL),
              10g fine-gold comparison, and live paper MTM positions.
            </p>
          </div>
          <Link href="/dashboard" className="gp-button gp-button--primary whitespace-nowrap">
            Open Authenticated Command Dashboard →
          </Link>
        </motion.div>

        {/* Live Benchmarks & Contracts Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {contracts ? (
            <>
              {SYMBOLS.map((sym) => {
                const q = contracts[sym]
                return (
                  <Card key={sym} className="p-3">
                    <div className="text-xs text-muted-foreground">{sym}</div>
                    <div className="text-base font-semibold tabular-nums mt-0.5">
                      {inr(q.quotedPrice, 0)}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                      10g: {inr(q.normalized10gPrice, 0)}
                    </div>
                  </Card>
                )
              })}
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">XAU/USD Spot</div>
                <div className="text-base font-semibold tabular-nums mt-0.5">
                  {feed?.benchmarks.xauUsd ? `$${feed.benchmarks.xauUsd.toFixed(2)}` : '—'}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">LBMA / Spot proxy</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">USD/INR FX</div>
                <div className="text-base font-semibold tabular-nums mt-0.5">
                  {feed?.benchmarks.usdInr ? `₹${feed.benchmarks.usdInr.toFixed(2)}` : '—'}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {isLive ? 'Live parity' : loading ? 'Syncing…' : 'Offline'}
                </div>
              </Card>
            </>
          ) : (
            <Card className="col-span-full p-4 font-mono text-xs text-muted-foreground">
              {loading
                ? 'Connecting to live Global-to-MCX parity feed…'
                : `Live feed offline (${feed?.error ?? 'upstream unavailable'}).`}
            </Card>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Historical Replay Benchmark Curve */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Account Equity (Live Paper Account)
                </CardTitle>
                <div className="text-3xl font-bold tabular-nums mt-1">{inr(equityInr, 0)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Live MTM + Realized</div>
                <div
                  className={cn(
                    'text-lg font-semibold tabular-nums',
                    unrealizedPnlInr + realizedPnlInr >= 0 ? 'gp-pos' : 'gp-neg'
                  )}
                >
                  {unrealizedPnlInr + realizedPnlInr >= 0 ? '+' : ''}
                  {inr(unrealizedPnlInr + realizedPnlInr, 2)}
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  Margin blocked: {inr(marginBlockedInr, 0)}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {curve.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={curve} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      domain={['dataMin - 1000', 'dataMax + 1000']}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--popover)',
                        border: '1px solid var(--border)',
                        borderRadius: 2,
                        fontSize: 12,
                      }}
                      formatter={(v: number) => inr(v, 0)}
                    />
                    <Area
                      type="monotone"
                      dataKey="grossEquity"
                      stroke="var(--muted-foreground)"
                      strokeWidth={1.5}
                      fill="var(--gp-slag-300)"
                      fillOpacity={0.18}
                      name="Gross Replay Equity"
                    />
                    <Line
                      type="monotone"
                      dataKey="netEquity"
                      stroke="var(--foreground)"
                      strokeWidth={2}
                      name="Net After-Cost Equity"
                      dot={false}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[240px] items-center justify-center font-mono text-xs text-muted-foreground">
                  Loading audited 18M MCX Bhavcopy replay equity series…
                </div>
              )}
            </CardContent>
          </Card>

          {/* Live Account Telemetry */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Margin &amp; Feed Integrity
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 pt-2">
              <div className="border border-border p-3">
                <div className="text-xs text-muted-foreground">Free Cash</div>
                <div className="text-base font-semibold tabular-nums mt-0.5">{inr(cashInr, 0)}</div>
              </div>
              <div className="border border-border p-3">
                <div className="text-xs text-muted-foreground">Open Lots</div>
                <div className="text-base font-semibold tabular-nums mt-0.5">{positions.length}</div>
              </div>
              <div className="border border-border p-3">
                <div className="text-xs text-muted-foreground">MTM P&amp;L</div>
                <div
                  className={cn(
                    'text-base font-semibold tabular-nums mt-0.5',
                    unrealizedPnlInr >= 0 ? 'gp-pos' : 'gp-neg'
                  )}
                >
                  {inr(unrealizedPnlInr, 0)}
                </div>
              </div>
              <div className="border border-border p-3">
                <div className="text-xs text-muted-foreground">Landed Parity</div>
                <div className="text-base font-semibold tabular-nums mt-0.5">
                  {feed?.benchmarks.landedSpotParity10gInr
                    ? `${inr(feed.benchmarks.landedSpotParity10gInr / 10, 0)}/g`
                    : '—'}
                </div>
              </div>
              <div className="col-span-2 border border-border p-3 font-mono text-[11px] text-muted-foreground">
                as_of {feed?.asOf ? `${feed.asOf.slice(0, 19).replace('T', ' ')} UTC` : 'syncing'}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Open Positions */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="w-4 h-4 text-primary" />
                Live Open Paper Positions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-72">
                {positions.length === 0 ? (
                  <p className="font-mono text-xs text-muted-foreground">
                    No active paper positions. Place a 1-Click trade in the Paper Trading section
                    below or in the Dashboard.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground sticky top-0 bg-card">
                      <tr>
                        <th className="text-left font-medium pb-2">Contract</th>
                        <th className="text-right font-medium pb-2">Lots</th>
                        <th className="text-right font-medium pb-2">Entry</th>
                        <th className="text-right font-medium pb-2">Live</th>
                        <th className="text-right font-medium pb-2">Net MTM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((pos) => {
                        const val = valuatePaperPosition(pos, livePricesMap)
                        return (
                          <tr key={pos.id} className="border-t border-border">
                            <td className="py-2.5 font-medium">{pos.headline}</td>
                            <td className="text-right tabular-nums">{pos.lotsA}</td>
                            <td className="text-right tabular-nums text-muted-foreground">
                              {inr(pos.entryPriceA, 0)}
                            </td>
                            <td className="text-right tabular-nums">
                              {inr(val.currentPriceA, 0)}
                            </td>
                            <td
                              className={cn(
                                'text-right tabular-nums font-medium',
                                val.netMtmPnlInr >= 0 ? 'gp-pos' : 'gp-neg'
                              )}
                            >
                              {val.netMtmPnlInr >= 0 ? '+' : ''}
                              {inr(val.netMtmPnlInr, 2)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Normalized Watchlist */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="w-4 h-4 text-primary" />
                10g Pure-Gold Parity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {normalizedRows.length === 0 ? (
                  <p className="font-mono text-xs text-muted-foreground">
                    <Radio className="inline h-3 w-3 mr-1" /> Syncing live quotes…
                  </p>
                ) : (
                  normalizedRows.map((row) => (
                    <div
                      key={row.symbol}
                      className="flex items-center justify-between border-b border-border pb-2 last:border-b-0"
                    >
                      <div>
                        <div className="font-semibold text-sm">{row.symbol}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {contractSpecs[row.symbol].tradingUnitGrams}g · purity {row.spec.purity}
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-sm font-medium">{inr(row.normalized10gPrice, 2)}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {row.symbol === 'GOLDM'
                            ? 'Baseline'
                            : bps(row.spreadVsBaselineBps)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
