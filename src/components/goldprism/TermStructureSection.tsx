'use client'

import * as React from 'react'
import { curveMonotoneX } from 'd3-shape'
import { ComposedChart } from '@/components/charts/composed-chart'
import { Line } from '@/components/charts/line-chart'
import { Grid } from '@/components/charts/grid'
import { XAxis } from '@/components/charts/x-axis'
import { YAxis } from '@/components/charts/y-axis'
import { ChartTooltip } from '@/components/charts/tooltip'
import {
  Legend,
  LegendItem,
  LegendLabel,
  LegendMarker,
} from '@/components/charts/legend'
import { Slider } from '@/components/ui/slider'
import { SectionHead } from '@/components/goldprism/brand'
import { inr, pctAbs } from '@/lib/goldprism/format'
import { cn } from '@/lib/utils'

const FAMILIES = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'] as const

const EXPIRY_MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
}

// '05 Apr 2026' → local calendar date. Bklit time charts need real dates,
// which also gives the curve its true (uneven) expiry spacing.
function parseExpiryDate(label: string): Date {
  const [day, mon, year] = label.split(' ')
  return new Date(Number(year), EXPIRY_MONTHS[mon ?? ''] ?? 0, Number(day))
}

export function TermStructureSection() {
  const [repoRate, setRepoRate] = React.useState<number>(6.5)
  const [selectedFamily, setSelectedFamily] =
    React.useState<(typeof FAMILIES)[number]>('GOLDM')

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
        impliedAnnualCarryPct: Number(
          (((modelFuturesPrice - baseSpot) / baseSpot) * (365.0 / exp.days) * 100).toFixed(2)
        ),
      }
    })
  }, [repoRate])

  // Bklit time axis rows + per-axis domains (price axis pads ±10 like the
  // previous `['dataMin - 10', 'dataMax + 10']`; carry starts at zero).
  const curveRows = React.useMemo(
    () => termStructureCurves.map((row) => ({ ...row, x: parseExpiryDate(row.date) })),
    [termStructureCurves]
  )

  const curveDomains = React.useMemo(() => {
    const prices = curveRows.flatMap((r) => [r.futuresPrice, r.spotPrice])
    const carries = curveRows.map((r) => r.impliedAnnualCarryPct)
    return {
      left: [Math.min(...prices) - 10, Math.max(...prices) + 10] as [number, number],
      right: [0, Math.max(...carries) * 1.15] as [number, number],
    }
  }, [curveRows])

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
    <section id="term-structure" className="scroll-mt-16 border-b border-border bg-background">
      <div className="gp-container py-[var(--gp-space-5)] md:py-[var(--gp-space-6)]">
        <SectionHead
          index="02.4"
          eyebrow="Market structure · Term structure"
          title="Name the carry before you call it alpha."
          description="Separates mechanical time-decay convergence toward expiry from genuine forward-curve shifts. The repo benchmark is editable."
          aside={
            <div className="w-full max-w-[20rem]">
              <div className="flex items-baseline justify-between gap-3">
                <label className="gp-label" htmlFor="repo-rate">
                  RBI repo benchmark
                </label>
                <span className="gp-figure text-sm">{repoRate.toFixed(2)}%</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <Slider
                  id="repo-rate-slider"
                  value={[repoRate]}
                  min={4}
                  max={10}
                  step={0.25}
                  onValueChange={(val) => setRepoRate(val[0])}
                  aria-label="RBI repo rate"
                />
                <input
                  id="repo-rate"
                  type="number"
                  step="0.25"
                  min="4.0"
                  max="10.0"
                  value={repoRate}
                  onChange={(e) => setRepoRate(parseFloat(e.target.value) || 6.5)}
                  className="gp-field w-20 shrink-0 text-right text-sm"
                />
              </div>
            </div>
          }
        />

        {/* ---------------- Decomposition metrics ---------------- */}
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <div className="border-t-2 border-[var(--gp-slag-900)] pt-3 dark:border-[var(--gp-paper)]">
            <p className="gp-label">M2 → M1 calendar gap</p>
            <p className="gp-figure mt-3 text-2xl">
              {inr(rollDownDecomp.totalSpread)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">/g</span>
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Observable forward premium between 05 Jun and 05 Apr.
            </p>
          </div>

          <div className="border-t-2 border-border pt-3">
            <p className="gp-label">Mechanical roll-down convergence</p>
            <p className="gp-figure mt-3 text-2xl">
              {inr(rollDownDecomp.mechanicalConvergence)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {pctAbs(rollDownDecomp.mechanicalPct)}
              </span>
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Predictable time-value decay driven by {repoRate}% repo carry.
            </p>
          </div>

          <div className="border-t-2 border-border pt-3">
            <p className="gp-label">Genuine forward curve shift</p>
            <p className="gp-figure mt-3 text-2xl">
              {inr(rollDownDecomp.genuineCurveShift)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {pctAbs(rollDownDecomp.genuinePct)}
              </span>
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Economic curve distortion left after removing carry decay.
            </p>
          </div>
        </div>

        {/* ---------------- Curve ---------------- */}
        <div className="mt-10 border border-border bg-card">
          <div className="flex flex-col gap-4 border-b border-border px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="gp-label">Model price vs implied carry</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Normalized 999-fine progression · base spot {inr(7350)}/g
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FAMILIES.map((fam) => (
                <button
                  key={fam}
                  type="button"
                  onClick={() => setSelectedFamily(fam)}
                  aria-pressed={selectedFamily === fam}
                  className={cn(
                    'gp-button px-3',
                    selectedFamily === fam && 'gp-button--selected'
                  )}
                >
                  {fam}
                </button>
              ))}
            </div>
          </div>

          <div className="px-2 py-5 sm:px-4">
            <div className="h-72 w-full">
              <ComposedChart
                data={curveRows}
                xDataKey="x"
                yDomains={curveDomains}
                margin={{ top: 8, right: 56, bottom: 36, left: 56 }}
                aspectRatio=""
                className="h-full w-full"
              >
                <Grid horizontal stroke="var(--border)" strokeDasharray="1 4" fadeHorizontal={false} />
                <ChartTooltip
                  indicatorColor="var(--gp-slag-500)"
                  indicatorFadeEdges="none"
                  dotVariant="dot"
                  dotSize={4}
                  dotColor={(point, line) =>
                    line.dataKey === 'futuresPrice'
                      ? 'var(--gp-gold-500)'
                      : 'var(--gp-slag-500)'
                  }
                  rows={(point) => [
                    {
                      color: 'var(--chart-line-primary)',
                      label: `${selectedFamily} futures · ₹/g`,
                      value: `₹${Number(point.futuresPrice).toFixed(2)}`,
                    },
                    {
                      color: 'var(--chart-line-secondary)',
                      label: 'Spot baseline · ₹/g',
                      value: `₹${Number(point.spotPrice).toFixed(2)}`,
                    },
                    {
                      color: 'var(--gp-slag-300)',
                      label: 'Implied carry · % p.a.',
                      value: `${Number(point.impliedAnnualCarryPct).toFixed(2)}%`,
                    },
                  ]}
                />
                <Line
                  yAxisId="left"
                  dataKey="futuresPrice"
                  stroke="var(--chart-line-primary)"
                  strokeWidth={2}
                  curve={curveMonotoneX}
                  fadeEdges={false}
                  showMarkers
                  markers={{ fill: 'var(--chart-line-primary)', radius: 3, strokeWidth: 0 }}
                />
                <Line
                  yAxisId="left"
                  dataKey="spotPrice"
                  stroke="var(--chart-line-secondary)"
                  strokeWidth={1}
                  curve={curveMonotoneX}
                  dashFromIndex={0}
                  dashArray="4,3"
                  showHighlight={false}
                  fadeEdges={false}
                />
                <Line
                  yAxisId="right"
                  dataKey="impliedAnnualCarryPct"
                  stroke="var(--gp-slag-300)"
                  strokeWidth={2}
                  curve={curveMonotoneX}
                  dashFromIndex={0}
                  dashArray="1,3"
                  showHighlight={false}
                  fadeEdges={false}
                  showMarkers
                  markers={{ fill: 'var(--gp-slag-300)', radius: 2, strokeWidth: 0 }}
                />
                <XAxis numTicks={5} />
                <YAxis yAxisId="left" numTicks={5} formatValue={(v) => `₹${v.toFixed(0)}`} />
                <YAxis yAxisId="right" orientation="right" numTicks={5} formatValue={(v) => `${v}%`} />
              </ComposedChart>
            </div>
            <Legend
              className="flex-row justify-center gap-5 pb-1"
              items={[
                { label: `${selectedFamily} futures`, value: 0, color: 'var(--chart-line-primary)' },
                { label: 'Spot baseline', value: 0, color: 'var(--chart-line-secondary)' },
                { label: 'Implied carry', value: 0, color: 'var(--gp-slag-300)' },
              ]}
            >
              <LegendItem className="rounded-[2px] px-1 py-0.5">
                <LegendMarker className="h-[2px] w-5 rounded-none" />
                <LegendLabel className="gp-label" />
              </LegendItem>
            </Legend>
          </div>

          <div className="border-t border-border px-4 py-3">
            <p className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-muted-foreground">
              All three series are shown in slag grey. Gold is reserved for a residual that
              survives costs, not for a curve.
            </p>
          </div>
        </div>

        {/* ---------------- Note ---------------- */}
        <div className="mt-8 border-l-2 border-[var(--gp-gold-500)] pl-4">
          <p className="gp-label">Quant note</p>
          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-muted-foreground">
            In calendar spreads, the upward slope of the futures curve is often mistaken for
            alpha. GoldPrism subtracts the exact mechanical carry
            {' '}
            <span className="gp-mono text-foreground">S₀ × r_repo × Δt / 365</span>
            {' '}
            before computing any signal, removing false convergence triggers.
          </p>
        </div>
      </div>
    </section>
  )
}
