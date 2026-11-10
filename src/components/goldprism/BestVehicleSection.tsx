'use client'

import * as React from 'react'
import {
  Award,
  CheckCircle2,
  HelpCircle,
  Percent,
  Scale,
  ShieldCheck,
  TrendingDown,
  Trophy,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  rankBestVehicleForExposure,
  VehicleRank,
} from '@/lib/goldprism/signal'

export function BestVehicleSection() {
  const [exposureG, setExposureG] = React.useState<number>(50)
  const presets = [8, 10, 50, 100, 500, 1000]

  const rankings: VehicleRank[] = React.useMemo(() => {
    return rankBestVehicleForExposure(exposureG)
  }, [exposureG])

  return (
<<<<<<< Updated upstream
    <section id="best-vehicle" className="py-12 scroll-mt-16 border-b border-border/40">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <Badge variant="outline" className="mb-2 gap-1.5 border-amber-500/40 text-amber-300">
              <Trophy className="w-3 h-3 text-amber-400" /> Phase 04: Exposure-Based Vehicle Selection
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Best-Vehicle Ranking
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Finds the optimal MCX contract for your exact physical gold hedging exposure, minimizing lumpiness mismatch and net execution friction.
            </p>
          </div>

          {/* Exposure Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">Presets:</span>
            {presets.map((g) => (
              <Button
                key={g}
                size="sm"
                variant={exposureG === g ? 'default' : 'outline'}
                onClick={() => setExposureG(g)}
                className={`font-mono text-xs ${
                  exposureG === g
                    ? 'bg-amber-500 hover:bg-amber-600 text-black font-bold'
                    : 'border-border/80'
                }`}
              >
                {g}g
              </Button>
            ))}
            <div className="flex items-center gap-1.5 ml-2">
              <Input
                type="number"
                min="1"
                max="10000"
                value={exposureG}
                onChange={(e) => setExposureG(Math.max(1, parseFloat(e.target.value) || 1))}
                className="w-20 font-mono text-xs h-9"
              />
              <span className="text-xs text-muted-foreground font-mono">grams</span>
=======
    <section id="best-vehicle" className="scroll-mt-16 border-b border-border bg-background">
      <div className="gp-container py-[var(--gp-space-5)] md:py-[var(--gp-space-6)]">
        <SectionHead
          index="02.3"
          eyebrow="Market structure · Vehicle match"
          title="Match the hedge to the lot you can actually fill."
          description="Finds the MCX contract whose trading unit fits the physical exposure with the least lumpiness and the lowest round-trip friction."
          aside={
            <div className="flex flex-wrap items-end gap-2 lg:justify-end">
              <div className="flex flex-wrap gap-1.5">
                {presets.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setExposureG(g)}
                    aria-pressed={exposureG === g}
                    className={cn(
                      'gp-button px-3',
                      exposureG === g && 'gp-button--selected'
                    )}
                  >
                    {g}g
                  </button>
                ))}
              </div>

              <div className="flex min-w-[9rem] items-end gap-2">
                <div className="flex-1">
                  <label className="gp-label" htmlFor="exposure-grams">
                    Exposure
                  </label>
                  <input
                    id="exposure-grams"
                    type="number"
                    min="1"
                    max="10000"
                    value={exposureG}
                    onChange={(e) =>
                      setExposureG(Math.max(1, parseFloat(e.target.value) || 1))
                    }
                    className="gp-field mt-1 text-sm"
                  />
                </div>
                <span className="pb-3 font-mono text-xs text-muted-foreground">g</span>
              </div>
            </div>
          }
        />

        {/* ---------------- Winner certificate ---------------- */}
        {winner ? (
          <div className="mt-10 border border-border bg-card shadow-[var(--gp-hard-shadow)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <p className="gp-label">Optimal vehicle · {exposureG} g exposure</p>
              <span className="gp-tag gp-tag--gold">Rank 01</span>
            </div>

            <div className="gp-split--tight grid p-5 lg:items-center">
              <div>
                <div className="flex flex-wrap items-baseline gap-3">
                  <h3 className="gp-serif text-3xl">{winner.contractCode}</h3>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {winner.tradingUnitG} g per lot
                  </span>
                </div>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {winner.rationale}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4 lg:grid-cols-2">
                <div className="bg-card p-3">
                  <dt className="gp-label">Lots required</dt>
                  <dd className="gp-figure mt-2 text-lg">{winner.lotsRequired}</dd>
                </div>
                <div className="bg-card p-3">
                  <dt className="gp-label">Fitted exposure</dt>
                  <dd className="gp-figure mt-2 text-lg gp-tradable-text">
                    {winner.actualExposureG} g
                  </dd>
                </div>
                <div className="bg-card p-3">
                  <dt className="gp-label">Mismatch</dt>
                  <dd className="gp-figure mt-2 text-lg">
                    {winner.exposureMismatchG} g
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      · {pctAbs(winner.exposureMismatchPct)}
                    </span>
                  </dd>
                </div>
                <div className="bg-card p-3">
                  <dt className="gp-label">Round-trip cost</dt>
                  <dd className="gp-figure mt-2 text-lg">{bps(winner.estimatedCostBps)}</dd>
                </div>
              </dl>
>>>>>>> Stashed changes
            </div>
          </div>
        </div>

        {/* Highlight Winner Card */}
        {rankings.length > 0 && rankings[0] && (
          <Card className="mb-8 p-5 bg-gradient-to-r from-amber-500/10 via-card to-card border-amber-500/40">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 font-bold shrink-0">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-bold text-foreground">
                      Optimal Vehicle for {exposureG}g Exposure:
                    </span>
                    <Badge className="bg-amber-500 text-black font-black font-mono">
                      {rankings[0].contractCode}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                    {rankings[0].rationale}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-xs font-mono shrink-0 p-3 rounded-lg bg-black/40 border border-border/40">
                <div>
                  <div className="text-muted-foreground text-[10px]">Required</div>
                  <div className="text-base font-bold text-foreground">{rankings[0].lotsRequired} lot(s)</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[10px]">Exposure Fit</div>
                  <div className="text-base font-bold text-emerald-400">{rankings[0].actualExposureG}g</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[10px]">Total Friction</div>
                  <div className="text-base font-bold text-amber-400">{rankings[0].estimatedCostBps} bps</div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* All Contracts Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {rankings.map((r) => (
            <Card
              key={r.contractCode}
              className={`p-4 transition-all ${
                r.isWinner
                  ? 'border-amber-500/60 bg-amber-500/5 shadow-md shadow-amber-500/10'
                  : 'border-border/80 bg-card/60'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono ${
                      r.isWinner
                        ? 'bg-amber-500 text-black'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    #{r.rank}
                  </span>
                  <span className="font-bold text-base text-foreground">{r.contractCode}</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono border-border">
                  {r.tradingUnitG}g Lot
                </Badge>
              </div>

              <div className="space-y-2 text-xs font-mono mb-4">
                <div className="flex justify-between py-1 border-b border-border/30">
                  <span className="text-muted-foreground">Required Lots:</span>
                  <span className="font-bold text-foreground">{r.lotsRequired} lot(s)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/30">
                  <span className="text-muted-foreground">Actual Exposure:</span>
                  <span className="font-bold text-foreground">{r.actualExposureG} g</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/30">
                  <span className="text-muted-foreground">Exposure Mismatch:</span>
                  <span
                    className={`font-bold ${
                      r.exposureMismatchPct === 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {r.exposureMismatchG}g ({r.exposureMismatchPct}%)
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/30">
                  <span className="text-muted-foreground">Cost per Gram:</span>
                  <span className="font-bold text-amber-300">₹{r.estimatedCostPerGramInr.toFixed(2)}/g</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Friction (Bps):</span>
                  <span className="font-bold text-foreground">{r.estimatedCostBps} bps</span>
                </div>
              </div>

              <div className="pt-2 border-t border-border/40">
                <div className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
                  {r.rationale}
                </div>
              </div>
            </Card>
          ))}
        </div>

      </div>
    </section>
  )
}
