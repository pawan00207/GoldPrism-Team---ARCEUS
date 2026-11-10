'use client'

import * as React from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  TrendingUp,
  Percent,
  Sliders,
  Calendar,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function TermStructureSection() {
  const [repoRate, setRepoRate] = React.useState<number>(6.5)
  const [selectedFamily, setSelectedFamily] = React.useState<'GOLDM' | 'GOLDTEN' | 'GOLDGUINEA' | 'GOLDPETAL'>('GOLDM')

  // Futures curve points across calendar expiries for each family (normalized ₹/g 999-fine)
  const termStructureCurves = React.useMemo(() => {
    const baseSpot = 7350.0 // ₹/g 999-fine
    const expiries = [
      { name: 'M1 (Near)', days: 15, date: '05 Apr 2026' },
      { name: 'M2 (Next)', days: 75, date: '05 Jun 2026' },
      { name: 'M3 (Far)', days: 135, date: '05 Aug 2026' },
      { name: 'M4 (Distant)', days: 195, date: '05 Oct 2026' },
      { name: 'M5 (Annual)', days: 255, date: '05 Dec 2026' },
    ]

    return expiries.map((exp) => {
      // Annualized carry formula = Spot * RepoRate * (days/365)
      const mechanicalCarryPerG = (baseSpot * (repoRate / 100.0) * exp.days) / 365.0
      // Curve shift component (supply-demand / import premium shift)
      const curveShiftPerG = Math.sin(exp.days / 50.0) * 4.5
      const modelFuturesPrice = baseSpot + mechanicalCarryPerG + curveShiftPerG

      return {
        expiry: exp.name,
        date: exp.date,
        days: exp.days,
        spotPrice: baseSpot,
        mechanicalCarryPerG: Number(mechanicalCarryPerG.toFixed(2)),
        curveShiftPerG: Number(curveShiftPerG.toFixed(2)),
        futuresPrice: Number(modelFuturesPrice.toFixed(2)),
        impliedAnnualCarryPct: Number((((modelFuturesPrice - baseSpot) / baseSpot) * (365.0 / exp.days) * 100).toFixed(2)),
      }
    })
  }, [repoRate])

  // Roll-down decomposition calculation (M2 to M1 roll)
  const rollDownDecomp = React.useMemo(() => {
    const m1 = termStructureCurves[0]
    const m2 = termStructureCurves[1]
    const totalSpread = m2.futuresPrice - m1.futuresPrice
    const mechanicalConvergence = m2.mechanicalCarryPerG - m1.mechanicalCarryPerG
    const genuineCurveShift = m2.curveShiftPerG - m1.curveShiftPerG

    return {
      totalSpread: Number(totalSpread.toFixed(2)),
      mechanicalConvergence: Number(mechanicalConvergence.toFixed(2)),
      genuineCurveShift: Number(genuineCurveShift.toFixed(2)),
      mechanicalPct: Number(((mechanicalConvergence / totalSpread) * 100).toFixed(1)),
      genuinePct: Number(((genuineCurveShift / totalSpread) * 100).toFixed(1)),
    }
  }, [termStructureCurves])

  return (
    <section id="term-structure" className="py-12 scroll-mt-16 border-b border-border/40">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <Badge variant="outline" className="mb-2 gap-1.5 border-amber-500/40 text-amber-300">
              <TrendingUp className="w-3 h-3 text-amber-400" /> Phase D: Term Structure &amp; Carry Analytics
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Futures Curve &amp; Roll-Down Decomposition
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Separates mechanical time-decay convergence toward expiry from genuine forward curve shifts.
            </p>
          </div>

          {/* Repo Rate Control */}
          <div className="flex items-center gap-3 bg-card/60 p-2.5 rounded-lg border border-border/80">
            <Sliders className="w-4 h-4 text-amber-400" />
            <div className="text-xs">
              <span className="text-muted-foreground">Financing Benchmark: </span>
              <span className="font-bold font-mono text-foreground">RBI Repo {repoRate.toFixed(2)}%</span>
            </div>
            <Input
              type="number"
              step="0.25"
              min="4.0"
              max="10.0"
              value={repoRate}
              onChange={(e) => setRepoRate(parseFloat(e.target.value) || 6.5)}
              className="w-20 h-7 text-xs font-mono"
            />
          </div>
        </div>

        {/* 3 Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="p-4 bg-card/60 border-border/80">
            <div className="text-xs text-muted-foreground mb-1">M2 → M1 Calendar Gap</div>
            <div className="text-3xl font-black font-mono text-amber-400 tabular-nums">
              ₹{rollDownDecomp.totalSpread} <span className="text-sm font-normal text-muted-foreground">/g</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Total observable forward premium between 05-Jun &amp; 05-Apr
            </div>
          </Card>

          <Card className="p-4 bg-card/60 border-border/80">
            <div className="text-xs text-muted-foreground mb-1">Mechanical Roll-Down Convergence</div>
            <div className="text-3xl font-black font-mono text-blue-400 tabular-nums">
              ₹{rollDownDecomp.mechanicalConvergence} <span className="text-sm font-normal text-muted-foreground">({rollDownDecomp.mechanicalPct}%)</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Predictable time-value decay driven by {repoRate}% repo carry
            </div>
          </Card>

          <Card className="p-4 bg-card/60 border-border/80">
            <div className="text-xs text-muted-foreground mb-1">Genuine Forward Curve Shift</div>
            <div className="text-3xl font-black font-mono text-emerald-400 tabular-nums">
              ₹{rollDownDecomp.genuineCurveShift} <span className="text-sm font-normal text-muted-foreground">({rollDownDecomp.genuinePct}%)</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Pure economic curve distortion after removing carry decay
            </div>
          </Card>
        </div>

        {/* Interactive Futures Curve Chart */}
        <Card className="p-5 bg-card/60 border-border/80 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="font-bold text-sm text-foreground">MCX Term Structure: Model Price vs Implied Carry</h3>
              <p className="text-xs text-muted-foreground">
                Normalized 999-fine price progression across sequential expiry contracts (Base Spot ₹7,350/g)
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'] as const).map((fam) => (
                <button
                  key={fam}
                  onClick={() => setSelectedFamily(fam)}
                  className={`text-xs px-2.5 py-1 rounded transition-colors font-mono ${
                    selectedFamily === fam
                      ? 'bg-amber-500 text-black font-bold'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {fam}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={termStructureCurves}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
                <XAxis dataKey="expiry" stroke="#888" fontSize={11} />
                <YAxis yAxisId="price" stroke="#888" fontSize={11} domain={['dataMin - 10', 'dataMax + 10']} />
                <YAxis yAxisId="carry" orientation="right" stroke="#10b981" fontSize={11} unit="%" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '0.5rem', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Line yAxisId="price" type="monotone" dataKey="futuresPrice" name="Futures Price (₹/g)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                <Line yAxisId="price" type="monotone" dataKey="spotPrice" name="Spot Baseline (₹7,350)" stroke="#6b7280" strokeDasharray="4 4" dot={false} />
                <Line yAxisId="carry" type="monotone" dataKey="impliedAnnualCarryPct" name="Implied Carry (% p.a.)" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Informational Callout */}
        <div className="p-3.5 rounded-lg bg-blue-500/5 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <strong>Quant Insight:</strong> In calendar spreads, retail traders often mistake the upward slope of the futures curve (contango) for alpha. GoldPrism subtracts the exact mechanical carry (S₀ × r_repo × Δt / 365) before computing any trading signal, eliminating false convergence triggers.
          </div>
        </div>
      </div>
    </section>
  )
}
