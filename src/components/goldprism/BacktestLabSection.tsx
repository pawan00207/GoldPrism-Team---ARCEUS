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
  AlertTriangle,
  Info,
  Scale,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function BacktestLabSection() {
  // Real pipeline results from results/backtest.json, results/bootstrap.json, results/holdout.json
  const pipelineEquityCurve = [
    { date: '2024-01-01', gross_equity: 1000000.0, net_equity: 1000000.0, drawdown_pct: 0.0 },
    { date: '2024-01-30', gross_equity: 999990.7, net_equity: 996252.0, drawdown_pct: 0.37 },
    { date: '2024-03-05', gross_equity: 999810.2, net_equity: 991200.5, drawdown_pct: 0.88 },
    { date: '2024-04-15', gross_equity: 999650.0, net_equity: 986420.0, drawdown_pct: 1.36 },
    { date: '2024-06-01', gross_equity: 999510.4, net_equity: 981150.2, drawdown_pct: 1.88 },
    { date: '2024-08-10', gross_equity: 999480.0, net_equity: 978900.0, drawdown_pct: 2.11 },
    { date: '2024-10-20', gross_equity: 999420.0, net_equity: 977200.0, drawdown_pct: 2.28 },
    { date: '2024-12-15', gross_equity: 999380.0, net_equity: 976100.0, drawdown_pct: 2.39 },
    { date: '2025-02-15', gross_equity: 999330.6, net_equity: 975498.3, drawdown_pct: 2.45 },
  ]

  // Honest attribution: Where does the spread alpha go?
  const attributionData = [
    { component: 'Gross Residual', bps: 4.0, color: '#3b82f6' },
    { component: 'Brokerage Drag', bps: -1.9, color: '#f43f5e' },
    { component: 'CTT (0.01% Sell)', bps: -1.1, color: '#fb7185' },
    { component: 'GST & Stamp', bps: -0.4, color: '#fda4af' },
    { component: 'Slippage & Haircut', bps: -1.8, color: '#ef4444' },
    { component: 'Net Edge (Real)', bps: -1.2, color: '#f59e0b' },
  ]

  return (
<<<<<<< Updated upstream
    <section id="backtest-lab" className="py-12 scroll-mt-16 border-b border-border/40">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <Badge variant="outline" className="mb-2 gap-1.5 border-amber-500/40 text-amber-300">
              <Database className="w-3 h-3 text-amber-400" /> Phase B &amp; C: Walk-Forward Backtest &amp; Statistical Rigor
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Auditable Walk-Forward Backtester &amp; Statistical Rigor
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Zero look-ahead bias (signal at close $t$, fill at $t+1$). Gold beta excluded. Itemized statutory costs from <code>costs.yaml</code>.
=======
    <section id="backtest-lab" className="scroll-mt-16 border-b border-border bg-background">
      <div className="gp-container py-[var(--gp-space-5)] md:py-[var(--gp-space-6)]">
        <SectionHead
          index="02.6"
          eyebrow="Market structure · Backtest lab"
          title="One run, frozen config. Show the result."
          description="Walk-forward replay with signal at close t and fill at t+1. Gold beta is excluded, and statutory costs are itemized. If the edge is negative, the gate says so."
          aside={
            <div className="flex flex-col items-start gap-2 lg:items-end">
              <div className="flex flex-wrap gap-2">
                <span className="gp-tag gp-tag--neutral">Config · 9c8103c61b2b2137</span>
                <span className="gp-tag gp-tag--watch">Holdout sealed</span>
              </div>
              <DataTag synthetic detail="pipeline results" />
            </div>
          }
        />

        {/* ---------------- Headline metrics ---------------- */}
        <div className="mt-10 grid gap-px border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
          <div className="bg-card p-4">
            <p className="gp-label">Mean net edge</p>
            <p className="gp-figure mt-3 text-2xl">{bps(-1.2)}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Gold beta excluded. Pure calendar spread.
>>>>>>> Stashed changes
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-amber-500/10 text-amber-300 border-amber-500/30 gap-1 font-mono text-xs">
              <Lock className="w-3 h-3 text-amber-400" /> CONFIG HASH: 9c8103c61b2b2137
            </Badge>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs font-mono">
              SEALED HOLDOUT: 21-Feb-2025 – 04-Jun-2025
            </Badge>
          </div>
        </div>

        {/* Real Performance Metrics Cards (Computed from 18m dataset) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4 bg-card/60 border-border/80">
            <div className="text-xs text-muted-foreground mb-1">Mean Net Edge (Code Computed)</div>
            <div className="text-3xl font-black font-mono text-amber-400 tabular-nums">
              -1.2 <span className="text-sm font-normal text-muted-foreground">bps</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Gold beta excluded · Pure calendar spread
            </div>
          </Card>

          <Card className="p-4 bg-card/60 border-border/80">
            <div className="text-xs text-muted-foreground mb-1">Bootstrap 95% CI</div>
            <div className="text-2xl font-black font-mono text-rose-400 tabular-nums">
              [-1.77, -0.71] <span className="text-xs font-normal text-muted-foreground">bps</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              10-day block bootstrap (1,000 resamples)
            </div>
          </Card>

          <Card className="p-4 bg-card/60 border-border/80">
            <div className="text-xs text-muted-foreground mb-1">Cost Drag on Spread</div>
            <div className="text-3xl font-black font-mono text-rose-500 tabular-nums">
              ₹23,832
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Brokerage ₹30/side + CTT 0.01% + GST + Slippage
            </div>
          </Card>

          <Card className="p-4 bg-card/60 border-border/80">
            <div className="text-xs text-muted-foreground mb-1">Final Pipeline Verdict</div>
            <div className="text-3xl font-black font-mono text-foreground tabular-nums flex items-center gap-1.5">
              <Badge className="bg-muted text-muted-foreground border-border/60 text-sm px-2.5 py-0.5">
                NO EDGE
              </Badge>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Disciplined inaction preserves ₹1M capital
            </div>
          </Card>
        </div>

<<<<<<< Updated upstream
        {/* Statistical Rigor Cards: CI, MDE, Multiple Testing */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-4 bg-muted/20 border-border/80">
            <div className="flex items-center gap-2 mb-2 font-bold text-xs text-foreground">
              <Scale className="w-4 h-4 text-blue-400" /> Block Bootstrap Uncertainty
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Block length = 10 days to account for autocorrelation in MCX calendar roll residuals. 
            </p>
            <div className="p-2.5 rounded bg-background/60 border border-border/50 text-[11px] font-mono">
              <div>Mean Edge: <strong>-1.20 bps</strong></div>
              <div>95% CI: <strong>[-1.77, -0.71] bps</strong></div>
              <div className="text-amber-400 mt-1">CI crosses zero / negative: Verdict blocked from TRADABLE</div>
            </div>
          </Card>

          <Card className="p-4 bg-muted/20 border-border/80">
            <div className="flex items-center gap-2 mb-2 font-bold text-xs text-foreground">
              <Percent className="w-4 h-4 text-emerald-400" /> Minimum Detectable Effect (MDE)
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              At sample size N=292 days, power 1-β = 80%, significance level α = 0.05.
            </p>
            <div className="p-2.5 rounded bg-background/60 border border-border/50 text-[11px] font-mono">
              <div>MDE Threshold: <strong>0.75 bps (₹0.52/g)</strong></div>
              <div>Observed Residual: <strong>4.00 bps</strong></div>
              <div className="text-emerald-400 mt-1">Statistical power sufficient to reject false alpha</div>
            </div>
          </Card>

          <Card className="p-4 bg-muted/20 border-border/80">
            <div className="flex items-center gap-2 mb-2 font-bold text-xs text-foreground">
              <ShieldCheck className="w-4 h-4 text-amber-400" /> Multiple-Testing Correction
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Tested across 6 contract pair combinations. Bonferroni &amp; Benjamini-Hochberg (FDR=0.05).
            </p>
            <div className="p-2.5 rounded bg-background/60 border border-border/50 text-[11px] font-mono">
              <div>Nominal Hurdle: <strong>5.00 bps</strong></div>
              <div>Bonferroni Hurdle: <strong>12.25 bps</strong></div>
              <div className="text-rose-400 mt-1">Zero pairs pass corrected threshold: Confirms NO EDGE</div>
            </div>
          </Card>
        </div>

        {/* Charts: Gross vs Net Equity & P&L Attribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Equity Curves (2 cols) */}
          <Card className="lg:col-span-2 p-5 bg-card/60 border-border/80">
            <div className="flex items-center justify-between mb-4">
=======
        {/* ---------------- Charts ---------------- */}
        <div className="gp-split mt-10">
          <div className="min-w-0 border border-border bg-card">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-3">
>>>>>>> Stashed changes
              <div>
                <h3 className="font-bold text-foreground text-sm">Gross vs Net Equity Curve (₹1,000,000 Initial Capital)</h3>
                <p className="text-xs text-muted-foreground">Replay from Jan 2024 to Feb 2025 (In-Sample Train Partition)</p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400" /> Gross
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400" /> Net (Fee Drag)
                </span>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pipelineEquityCurve}>
                  <defs>
                    <linearGradient id="grossGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
                  <XAxis dataKey="date" stroke="#888" fontSize={11} />
                  <YAxis stroke="#888" fontSize={11} domain={['dataMin - 5000', 'dataMax + 2000']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '0.5rem', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="gross_equity" name="Gross Equity" stroke="#3b82f6" fill="url(#grossGradient)" strokeWidth={2} />
                  <Area type="monotone" dataKey="net_equity" name="Net Equity" stroke="#ef4444" fill="url(#netGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="text-[11px] text-muted-foreground mt-2">
              <strong>Honest Walk-Forward Finding:</strong> While gross spread returns hover near flat (-₹669), round-trip fees (₹23,832) create persistent negative drift if traded indiscriminately. GoldPrism&apos;s cost gate correctly blocks all trades.
            </div>
          </Card>

          {/* P&L Attribution Breakdown (1 col) */}
          <Card className="p-5 bg-card/60 border-border/80">
            <h3 className="font-bold text-foreground text-sm mb-1">Cost Drag Decomposition</h3>
            <p className="text-xs text-muted-foreground mb-4">Itemized breakdown of gross alpha erosion (bps)</p>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attributionData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
                  <XAxis type="number" stroke="#888" fontSize={11} />
                  <YAxis dataKey="component" type="category" stroke="#888" fontSize={11} width={90} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '0.5rem', fontSize: '12px' }}
                  />
                  <Bar dataKey="bps" name="Basis Points (bps)">
                    {attributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Sealed Holdout Verification Card */}
        <Card className="p-4 bg-card/40 border-emerald-500/30 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-foreground">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Sealed Holdout Partition Results (Uncontaminated)
            </div>
            <Badge className="bg-emerald-500/10 text-emerald-300 font-mono text-[10px]">
              Single Evaluation Only
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Dates: <strong>21-Feb-2025 to 04-Jun-2025</strong> (73 bars). Evaluated with frozen configuration hash <code>9c8103c61b2b2137</code>.
            Includes the newly listed <strong>GOLDTEN</strong> cross-spread pair. 
            Holdout confirmed zero persistent edge after statutory friction, identical to the in-sample distribution.
          </p>
        </Card>
      </div>
    </section>
  )
}
