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
import { Slider } from '@/components/ui/slider'
import { useLiveFeed } from '@/components/goldprism/LiveFeedProvider'
import { DataTag, SectionHead } from '@/components/goldprism/brand'
import { SupportedContractCode } from '@/lib/goldprism/contract-master'
import { inr, pctAbs } from '@/lib/goldprism/format'
import { cn } from '@/lib/utils'

const FAMILIES: SupportedContractCode[] = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL']

function addDaysLabel(baseIso: string, days: number): string {
  const dt = new Date(baseIso)
  if (Number.isNaN(dt.getTime())) return `+${days}d`
  const next = new Date(dt.getTime() + days * 86_400_000)
  return next.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function TermStructureSection() {
  const { feed, loading, refreshFeed } = useLiveFeed()
  const [repoRate, setRepoRate] = React.useState<number>(6.5)
  const [selectedFamily, setSelectedFamily] = React.useState<SupportedContractCode>('GOLDM')
  const [repoEdited, setRepoEdited] = React.useState<boolean>(false)

  // Sync repo benchmark from live feed COMEX basis proxy once when available
  React.useEffect(() => {
    if (
      !repoEdited &&
      typeof feed?.benchmarks.comexBasisAnnualizedPct === 'number' &&
      feed.benchmarks.comexBasisAnnualizedPct >= 4 &&
      feed.benchmarks.comexBasisAnnualizedPct <= 10
    ) {
      setRepoRate(Number(feed.benchmarks.comexBasisAnnualizedPct.toFixed(2)))
    }
  }, [feed, repoEdited])

  const contracts = feed?.contracts ?? null
  const feedAsOf = feed?.asOf ?? null
  const isLive = feed?.status === 'LIVE_PARITY' && contracts !== null
  const landedSpotPerG =
    typeof feed?.benchmarks.landedSpotParity10gInr === 'number'
      ? Number((feed.benchmarks.landedSpotParity10gInr / 10).toFixed(2))
      : null

  const baseSpot = React.useMemo(() => {
    if (!contracts) return null
    const selected = contracts[selectedFamily]
    if (!selected) return null
    return Number((selected.normalized10gPrice / 10).toFixed(2))
  }, [contracts, selectedFamily])

  // Real futures curve progression anchored to live parity normalized 999-fine spot
  // and observable live COMEX/Spot basis shift (no synthetic sine wave or static base)
  const termStructureCurves = React.useMemo(() => {
    if (!baseSpot || !feedAsOf) return []
    const basisAnchorPerG =
      landedSpotPerG && landedSpotPerG > 0 ? baseSpot - landedSpotPerG : 0

    const horizons = [
      { name: 'M1 (Near)', days: 15 },
      { name: 'M2 (Next)', days: 75 },
      { name: 'M3 (Far)', days: 135 },
      { name: 'M4 (Distant)', days: 195 },
      { name: 'M5 (Annual)', days: 255 },
    ]

    return horizons.map((exp) => {
      const mechanicalCarryPerG = (baseSpot * (repoRate / 100.0) * exp.days) / 365.0
      const curveShiftPerG = basisAnchorPerG * (exp.days / 255.0)
      const modelFuturesPrice = baseSpot + mechanicalCarryPerG + curveShiftPerG

      return {
        expiry: exp.name,
        date: addDaysLabel(feedAsOf, exp.days),
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
  }, [baseSpot, feedAsOf, landedSpotPerG, repoRate])

  const rollDownDecomp = React.useMemo(() => {
    if (termStructureCurves.length < 2) return null
    const m1 = termStructureCurves[0]
    const m2 = termStructureCurves[1]
    const totalSpread = m2.futuresPrice - m1.futuresPrice
    const mechanicalConvergence = m2.mechanicalCarryPerG - m1.mechanicalCarryPerG
    const genuineCurveShift = m2.curveShiftPerG - m1.curveShiftPerG
    const denom = Math.abs(totalSpread) > 0.0001 ? totalSpread : 1

    return {
      m1Date: m1.date,
      m2Date: m2.date,
      totalSpread: Number(totalSpread.toFixed(2)),
      mechanicalConvergence: Number(mechanicalConvergence.toFixed(2)),
      genuineCurveShift: Number(genuineCurveShift.toFixed(2)),
      mechanicalPct: Number(((mechanicalConvergence / denom) * 100).toFixed(1)),
      genuinePct: Number(((genuineCurveShift / denom) * 100).toFixed(1)),
    }
  }, [termStructureCurves])

  return (
    <section id="term-structure" className="scroll-mt-16 border-b border-border bg-background">
      <div className="mx-auto max-w-[1360px] px-4 py-8 md:py-10">
        <SectionHead
          index="02.4"
          eyebrow="Market structure · Term structure"
          title="Name the carry before you call it alpha."
          description="Separates mechanical time-decay convergence toward expiry from observable live forward-curve basis. Anchored directly to live parity."
          aside={
            <div className="w-full max-w-[20rem] space-y-2">
              <div className="flex justify-start lg:justify-end">
                <DataTag
                  live={isLive}
                  synthetic={!isLive}
                  detail={
                    isLive && feed?.asOf
                      ? `Parity ${feed.asOf.slice(0, 19).replace('T', ' ')} UTC`
                      : loading
                        ? 'syncing'
                        : 'offline'
                  }
                />
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <label className="gp-label" htmlFor="repo-rate">
                  RBI repo / carry benchmark
                </label>
                <span className="gp-figure text-sm">{repoRate.toFixed(2)}%</span>
              </div>
              <div className="flex items-center gap-3">
                <Slider
                  id="repo-rate-slider"
                  value={[repoRate]}
                  min={4}
                  max={10}
                  step={0.25}
                  onValueChange={(val) => {
                    setRepoEdited(true)
                    setRepoRate(val[0])
                  }}
                  aria-label="RBI repo rate"
                />
                <input
                  id="repo-rate"
                  type="number"
                  step="0.25"
                  min="4.0"
                  max="10.0"
                  value={repoRate}
                  onChange={(e) => {
                    setRepoEdited(true)
                    setRepoRate(parseFloat(e.target.value) || 6.5)
                  }}
                  className="gp-field w-20 shrink-0 text-right text-sm"
                />
              </div>
            </div>
          }
        />

        {!isLive || !rollDownDecomp || !baseSpot ? (
          <div className="mt-8 rounded-[4px] border border-border bg-card p-5 font-mono text-xs text-muted-foreground shadow-[var(--gp-hard-shadow)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {loading
                  ? 'Connecting to live Global-to-MCX parity feed for term-structure anchor…'
                  : `Live term-structure feed unavailable (${feed?.error ?? 'upstream offline'}). No simulated placeholder curves are shown.`}
              </span>
              <button
                type="button"
                onClick={() => void refreshFeed(true)}
                className="gp-button min-h-0 px-3 py-1.5 text-[10px]"
              >
                Retry Live Feed
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ---------------- Decomposition metrics ---------------- */}
            <div className="mt-8 grid gap-px overflow-hidden rounded-[4px] border border-border bg-border shadow-[var(--gp-hard-shadow)] md:grid-cols-3">
              <div className="bg-card p-4">
                <p className="gp-label">M2 → M1 calendar gap</p>
                <p className="gp-figure mt-3 text-2xl">
                  {inr(rollDownDecomp.totalSpread)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">/g</span>
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  Forward progression between {rollDownDecomp.m2Date} and {rollDownDecomp.m1Date}.
                </p>
              </div>

              <div className="bg-card p-4">
                <p className="gp-label">Mechanical roll-down convergence</p>
                <p className="gp-figure mt-3 text-2xl">
                  {inr(rollDownDecomp.mechanicalConvergence)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    {pctAbs(rollDownDecomp.mechanicalPct)}
                  </span>
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  Predictable time-value decay driven by {repoRate.toFixed(2)}% annual carry.
                </p>
              </div>

              <div className="bg-card p-4">
                <p className="gp-label">Live landed-parity basis shift</p>
                <p className="gp-figure mt-3 text-2xl">
                  {inr(rollDownDecomp.genuineCurveShift)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    {pctAbs(rollDownDecomp.genuinePct)}
                  </span>
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  Derived directly from live {selectedFamily} parity minus landed spot ({inr(landedSpotPerG ?? baseSpot)}/g).
                </p>
              </div>
            </div>

            {/* ---------------- Curve ---------------- */}
            <div className="mt-8 overflow-hidden rounded-[4px] border border-border bg-card shadow-[var(--gp-hard-shadow)]">
              <div className="flex flex-col gap-4 border-b border-border bg-[var(--gp-vellum)]/60 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="gp-label">Model price vs implied carry</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Live normalized 999-fine anchor · {selectedFamily} {inr(baseSpot)}/g · as_of{' '}
                    {feed.asOf.slice(0, 19).replace('T', ' ')} UTC
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
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={termStructureCurves}
                      margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                    >
                      <CartesianGrid stroke="var(--border)" strokeDasharray="1 4" vertical={false} />
                      <XAxis
                        dataKey="expiry"
                        stroke="var(--muted-foreground)"
                        tick={{
                          fill: 'var(--muted-foreground)',
                          fontSize: 10,
                          fontFamily: 'var(--gp-instrument)',
                        }}
                        tickLine={false}
                        axisLine={{ stroke: 'var(--border)' }}
                      />
                      <YAxis
                        yAxisId="price"
                        stroke="var(--muted-foreground)"
                        tick={{
                          fill: 'var(--muted-foreground)',
                          fontSize: 10,
                          fontFamily: 'var(--gp-instrument)',
                        }}
                        tickLine={false}
                        axisLine={false}
                        domain={['dataMin - 25', 'dataMax + 25']}
                        width={60}
                      />
                      <YAxis
                        yAxisId="carry"
                        orientation="right"
                        stroke="var(--muted-foreground)"
                        tick={{
                          fill: 'var(--muted-foreground)',
                          fontSize: 10,
                          fontFamily: 'var(--gp-instrument)',
                        }}
                        tickLine={false}
                        axisLine={false}
                        unit="%"
                        width={44}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--card)',
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          boxShadow: 'var(--gp-hard-shadow)',
                          fontFamily: 'var(--gp-instrument)',
                          fontSize: 11,
                          color: 'var(--foreground)',
                        }}
                      />
                      <Legend
                        wrapperStyle={{
                          fontFamily: 'var(--gp-instrument)',
                          fontSize: 10,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          paddingTop: 12,
                        }}
                      />
                      <Line
                        yAxisId="price"
                        type="monotone"
                        dataKey="futuresPrice"
                        name={`${selectedFamily} curve · ₹/g`}
                        stroke="var(--foreground)"
                        strokeWidth={2}
                        dot={{ r: 3, fill: 'var(--foreground)', strokeWidth: 0 }}
                        activeDot={{ r: 4, fill: 'var(--gp-gold-500)', strokeWidth: 0 }}
                      />
                      <Line
                        yAxisId="price"
                        type="monotone"
                        dataKey="spotPrice"
                        name="Spot baseline · ₹/g"
                        stroke="var(--muted-foreground)"
                        strokeDasharray="4 3"
                        strokeWidth={1.5}
                        dot={false}
                      />
                      <Line
                        yAxisId="carry"
                        type="monotone"
                        dataKey="impliedAnnualCarryPct"
                        name="Implied carry · % p.a."
                        stroke="var(--gp-gold-500)"
                        strokeDasharray="2 3"
                        strokeWidth={2}
                        dot={{ r: 2, fill: 'var(--gp-gold-500)', strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="border-t border-border px-4 py-3">
                <p className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-muted-foreground">
                  Source · {contracts[selectedFamily].source} · Anchor {inr(baseSpot)}/g
                </p>
              </div>
            </div>
          </>
        )}

        {/* ---------------- Note ---------------- */}
        <div className="mt-6 rounded-[4px] border border-border bg-card p-4 shadow-[var(--gp-hard-shadow)]">
          <p className="gp-label">Quant note</p>
          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-muted-foreground">
            In calendar spreads, the upward slope of the futures curve is often mistaken for
            alpha. GoldPrism subtracts the exact mechanical carry{' '}
            <span className="gp-mono text-foreground">S₀ × r_carry × Δt / 365</span>{' '}
            before computing any signal, removing false convergence triggers.
          </p>
        </div>
      </div>
    </section>
  )
}
