'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  ArrowUpRight,
  CandlestickChart,
  CircleDollarSign,
  History,
  Wallet,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { useLiveFeed } from '@/components/goldprism/LiveFeedProvider'
import { SupportedContractCode } from '@/lib/goldprism/contract-master'
import { contractSpecs } from '@/lib/goldprism/contract-specs'
import { inr } from '@/lib/goldprism/format'
import { evaluateTradePlan } from '@/lib/goldprism/trade-engine'
import { cn } from '@/lib/utils'

const SYMBOLS: SupportedContractCode[] = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL']

export function PaperTrading() {
  const {
    feed,
    loading,
    cashInr,
    equityInr,
    unrealizedPnlInr,
    realizedPnlInr,
    positions,
    closedTrades,
    executeOneClickTrade,
    closePosition,
  } = useLiveFeed()

  const [symbol, setSymbol] = React.useState<SupportedContractCode>('GOLDTEN')
  const [side, setSide] = React.useState<'BUY' | 'SELL'>('BUY')
  const [lots, setLots] = React.useState<string>('1')
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null)
  const [curve, setCurve] = React.useState<Array<{ date: string; value: number }>>([])

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
              .slice(-40)
              .map((p: { date: string; cumulativeNetPnlInr?: number }) => ({
                date: p.date,
                value: Math.round(1_000_000 + (p.cumulativeNetPnlInr ?? 0)),
              }))
          )
        }
      } catch {
        // Ignore network error
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const liveContract = feed?.contracts?.[symbol] ?? null
  const isLive = feed?.status === 'LIVE_PARITY' && liveContract !== null
  const lotsNum = Math.max(1, Math.min(100, parseInt(lots, 10) || 1))

  const previewPlan = React.useMemo(() => {
    if (!liveContract) return null
    return evaluateTradePlan(
      {
        kind: 'SINGLE',
        side,
        contractA: symbol,
        priceA: liveContract.quotedPrice,
        lotsA: lotsNum,
        expiryA: liveContract.expiryDate,
        sourceLabel: liveContract.source,
        asOf: liveContract.asOf,
      },
      cashInr
    )
  }, [liveContract, side, symbol, lotsNum, cashInr])

  function submitOrder() {
    if (!liveContract) {
      setMsg({ ok: false, text: 'Live quote unavailable. Wait for parity sync before executing.' })
      return
    }
    const res = executeOneClickTrade({
      kind: 'SINGLE',
      side,
      contractA: symbol,
      priceA: liveContract.quotedPrice,
      lotsA: lotsNum,
      expiryA: liveContract.expiryDate,
      sourceLabel: liveContract.source,
      asOf: liveContract.asOf,
      rationale: `Workspace Paper Order ${side} ${lotsNum} lot ${symbol}`,
    })
    setMsg({ ok: res.ok, text: res.message })
  }

  return (
    <section
      id="paper-trading"
      className="py-16 md:py-24 scroll-mt-16 bg-muted/20 border-y border-border"
    >
      <div className="container mx-auto px-4 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          className="mb-8"
        >
          <Badge variant="outline" className="mb-2 gap-1">
            <CandlestickChart className="w-3 h-3" /> Live-Parity Paper Trading
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Execute with ₹10,00,000 virtual margin against live parity
          </h2>
          <p className="text-muted-foreground mt-2 max-w-xl">
            1-Click MCX orders priced directly from live parity feeds with 9.5% SPAN margin and
            exact statutory fees. Synchronized with your main Dashboard.
          </p>
        </motion.div>

        {/* Account summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <Wallet className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Account Equity</span>
            </div>
            <div className="text-xl font-bold tabular-nums">{inr(equityInr, 0)}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <CircleDollarSign className="w-4 h-4 gp-pos" />
              <span className="text-xs text-muted-foreground">Free Margin</span>
            </div>
            <div className="text-xl font-bold tabular-nums">{inr(cashInr, 0)}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <ArrowUpRight className="w-4 h-4 gp-pos" />
              <span className="text-xs text-muted-foreground">Live MTM P&amp;L</span>
            </div>
            <div
              className={cn(
                'text-xl font-bold tabular-nums',
                unrealizedPnlInr >= 0 ? 'gp-pos' : 'gp-neg'
              )}
            >
              {unrealizedPnlInr >= 0 ? '+' : ''}
              {inr(unrealizedPnlInr, 2)}
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <ArrowUpRight className="w-4 h-4 gp-pos" />
              <span className="text-xs text-muted-foreground">Realized P&amp;L</span>
            </div>
            <div
              className={cn(
                'text-xl font-bold tabular-nums',
                realizedPnlInr >= 0 ? 'gp-pos' : 'gp-neg'
              )}
            >
              {realizedPnlInr >= 0 ? '+' : ''}
              {inr(realizedPnlInr, 2)}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Order ticket */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Live 1-Click Order Ticket</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">MCX Contract</Label>
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value as SupportedContractCode)}
                  className="gp-field gp-select mt-1"
                >
                  {SYMBOLS.map((sym) => (
                    <option key={sym} value={sym}>
                      {sym} — {contractSpecs[sym].tradingUnitGrams}g ({contractSpecs[sym].purity} fine)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={side === 'BUY' ? 'default' : 'outline'}
                  onClick={() => setSide('BUY')}
                >
                  BUY
                </Button>
                <Button
                  variant={side === 'SELL' ? 'default' : 'outline'}
                  onClick={() => setSide('SELL')}
                >
                  SELL
                </Button>
              </div>

              <div>
                <Label className="text-xs">Lots</Label>
                <Input
                  type="number"
                  value={lots}
                  onChange={(e) => setLots(e.target.value)}
                  className="mt-1"
                  min="1"
                  max="100"
                />
              </div>

              {liveContract && previewPlan ? (
                <div className="p-3 rounded-[2px] bg-muted/40 text-xs space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Live Quote</span>
                    <span>{inr(liveContract.quotedPrice, 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Required Margin</span>
                    <span>{inr(previewPlan.plan.marginRequiredInr, 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Statutory Est. Fee</span>
                    <span>{inr(previewPlan.plan.estimatedFeeInr, 2)}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground pt-1">
                    as_of {liveContract.asOf.slice(0, 19).replace('T', ' ')} UTC
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-[2px] bg-muted/40 text-xs text-muted-foreground">
                  {loading ? 'Syncing live parity quotes…' : 'Live parity offline.'}
                </div>
              )}

              <Button onClick={submitOrder} disabled={!isLive} className="w-full">
                Execute 1-Click {side} {lotsNum} × {symbol}
              </Button>

              {msg && (
                <div
                  className={cn(
                    'p-2.5 rounded-[2px] text-xs font-mono',
                    msg.ok ? 'gp-tint-pos gp-pos' : 'gp-tint-neg gp-neg'
                  )}
                >
                  {msg.text}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Positions + Closed Ledger & Replay Equity Curve */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="w-4 h-4 text-primary" />
                  Active Positions &amp; Closed Ledger
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  {positions.length === 0 && closedTrades.length === 0 ? (
                    <p className="font-mono text-xs text-muted-foreground">
                      No live orders placed yet. Submit your first 1-Click MCX trade on the left.
                    </p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground sticky top-0 bg-card">
                        <tr>
                          <th className="text-left font-medium pb-2">Contract</th>
                          <th className="text-right font-medium pb-2">Lots</th>
                          <th className="text-right font-medium pb-2">Entry</th>
                          <th className="text-right font-medium pb-2">Status / Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {positions.map((pos) => (
                          <tr key={pos.id} className="border-t border-border">
                            <td className="py-2 font-semibold">{pos.headline}</td>
                            <td className="py-2 text-right tabular-nums">{pos.lotsA}</td>
                            <td className="py-2 text-right tabular-nums">
                              {inr(pos.entryPriceA, 0)}
                            </td>
                            <td className="py-2 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const res = closePosition(pos.id)
                                  setMsg({ ok: res.ok, text: res.message })
                                }}
                              >
                                Square Off
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {closedTrades.slice(0, 8).map((t) => (
                          <tr key={t.id} className="border-t border-border text-muted-foreground">
                            <td className="py-2">{t.headline}</td>
                            <td className="py-2 text-right tabular-nums">{t.lotsA}</td>
                            <td className="py-2 text-right tabular-nums">{inr(t.entryPriceA, 0)}</td>
                            <td
                              className={cn(
                                'py-2 text-right tabular-nums font-medium',
                                t.netPnlInr >= 0 ? 'gp-pos' : 'gp-neg'
                              )}
                            >
                              Closed ({t.netPnlInr >= 0 ? '+' : ''}
                              {inr(t.netPnlInr, 0)})
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Historical MCX Calendar Equity Curve (Audited Replay)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {curve.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
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
                        dataKey="value"
                        stroke="var(--foreground)"
                        strokeWidth={2}
                        fill="var(--gp-slag-300)"
                        fillOpacity={0.22}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[200px] items-center justify-center font-mono text-xs text-muted-foreground">
                    Loading MCX historical replay equity curve…
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  )
}
