'use client'

import * as React from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  CheckCircle2,
  Database,
  Flame,
  Hash,
  Lock,
  Percent,
  Play,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { generateWalkForwardHistory } from '@/lib/goldprism/fixtures'

export function BacktestLabSection() {
  const data = React.useMemo(() => generateWalkForwardHistory(), [])

  // Attribution from Slide 7 wireframe
  const attributionData = [
    { component: 'Gross P&L', bps: 72.4, color: '#3b82f6' },
    { component: 'Convergence', bps: 44.9, color: '#06b6d4' },
    { component: 'Carry', bps: 27.5, color: '#3b82f6' },
    { component: 'Slippage', bps: -14.6, color: '#ef4444' },
    { component: 'Fees', bps: -7.4, color: '#f43f5e' },
    { component: 'Impact', bps: -3.7, color: '#fb7185' },
    { component: 'Net P&L', bps: 46.7, color: '#10b981' },
  ]

  return (
    <section id="backtest-lab" className="py-12 scroll-mt-16 border-b border-border/40">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <Badge variant="outline" className="mb-2 gap-1.5 border-amber-500/40 text-amber-300">
              <Database className="w-3 h-3 text-amber-400" /> Phase 05: Walk-Forward Backtest Lab
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Auditable Walk-Forward Backtester
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Rigorous signal at t, fill at t+1 execution model with sealed holdout partition and Block Bootstrap statistical validation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="bg-amber-500/10 text-amber-300 border-amber-500/30 gap-1 font-mono text-xs">
              <Lock className="w-3 h-3 text-amber-400" /> FROZEN CONFIG: GP-WF-2026-H1
            </Badge>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs font-mono">
              SEALED HOLDOUT ACTIVE
            </Badge>
          </div>
        </div>

        {/* 4 Primary Performance Metric Cards (Slide 7) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4 bg-card/60 border-border/80">
            <div className="text-xs text-muted-foreground mb-1">Gross Cumulative Spread Alpha</div>
            <div className="text-3xl font-black font-mono text-blue-400 tabular-nums">
              +72.4 <span className="text-sm font-normal text-muted-foreground">bps</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Gold beta excluded · Pure calendar spread
            </div>
          </Card>

          <Card className="p-4 bg-card/60 border-border/80">
            <div className="text-xs text-muted-foreground mb-1">Net Actionable Return</div>
            <div className="text-3xl font-black font-mono text-emerald-400 tabular-nums">
              +46.7 <span className="text-sm font-normal text-muted-foreground">bps</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              All broker fees, CTT, GST &amp; slippage deducted
            </div>
          </Card>

          <Card className="p-4 bg-card/60 border-border/80">
            <div className="text-xs text-muted-foreground mb-1">Net Sharpe Ratio</div>
            <div className="text-3xl font-black font-mono text-foreground tabular-nums">
              1.18
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Statistically significant (p &lt; 0.01)
            </div>
          </Card>

          <Card className="p-4 bg-card/60 border-border/80">
            <div className="text-xs text-muted-foreground mb-1">Hit Rate (Win %)</div>
            <div className="text-3xl font-black font-mono text-foreground tabular-nums">
              56.3%
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              19 monthly evaluation periods
            </div>
          </Card>
        </div>

        {/* Charts: Gross vs Net Equity & P&L Attribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Equity Curves (2 cols) */}
          <Card className="lg:col-span-2 p-5 bg-card/60 border-border/80">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-foreground text-sm">Gross vs Net Equity Curve (bps)</h3>
                <p className="text-xs text-muted-foreground">Walk-forward validation from Jan '23 through Jul '24</p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400" /> Gross (+72.4 bps)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Net (+46.7 bps)
                </span>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="grossGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" />
                  <XAxis dataKey="date" stroke="#888888" fontSize={11} tickLine={false} />
                  <YAxis stroke="#888888" fontSize={11} tickLine={false} tickFormatter={(v) => `${v}bps`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="grossCumulativeBps"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#grossGrad)"
                    name="Gross Spread Alpha"
                  />
                  <Area
                    type="monotone"
                    dataKey="netCumulativeBps"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#netGrad)"
                    name="Net Actionable Return"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* P&L Attribution Waterfall (1 col) */}
          <Card className="p-5 bg-card/60 border-border/80">
            <h3 className="font-bold text-foreground text-sm mb-1">P&L Attribution (bps)</h3>
            <p className="text-xs text-muted-foreground mb-4">Gross to net breakdown (Slide 7 specification)</p>
            <div className="space-y-2.5">
              {attributionData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs font-mono">
                  <span className="text-muted-foreground">{item.component}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-muted rounded-full overflow-hidden flex justify-end">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, Math.abs(item.bps) * 1.3)}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                    <span
                      className="font-bold tabular-nums w-12 text-right"
                      style={{ color: item.color }}
                    >
                      {item.bps > 0 ? `+${item.bps}` : item.bps}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Sealed Holdout & Integrity Guard Notice */}
        <Card className="p-4 bg-muted/20 border-border/60 text-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Statistical Guardrails:</strong> Strictly zero look-ahead bias (signal at bar t, simulated execution fill at bar t+1).
                GOLDTEN cross-expiry pairs and latest forward months strictly held out for final out-of-sample audit.
              </span>
            </div>
            <span className="font-mono text-[11px] text-amber-300 shrink-0">
              Block Bootstrap MDE: 3.4 bps · 95% CI: [28.2, 64.9] bps
            </span>
          </div>
        </Card>

      </div>
    </section>
  )
}
