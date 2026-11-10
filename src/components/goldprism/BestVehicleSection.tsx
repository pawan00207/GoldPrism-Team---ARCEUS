'use client'

import * as React from 'react'
import { rankBestVehicleForExposure, VehicleRank } from '@/lib/goldprism/signal'
import { SectionHead } from '@/components/goldprism/brand'
import { bps, inrPerG, pctAbs } from '@/lib/goldprism/format'
import { cn } from '@/lib/utils'

export function BestVehicleSection() {
  const [exposureG, setExposureG] = React.useState<number>(50)
  const presets = [8, 10, 50, 100, 500, 1000]

  const rankings: VehicleRank[] = React.useMemo(() => {
    return rankBestVehicleForExposure(exposureG)
  }, [exposureG])

  const winner = rankings[0]

  return (
    <section id="best-vehicle" className="scroll-mt-16 border-b border-border bg-background">
      <div className="mx-auto max-w-[1200px] px-4 py-14 md:py-20">
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

            <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,61.8%)_minmax(0,38.2%)] lg:items-center">
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
            </div>
          </div>
        ) : null}

        {/* ---------------- Full comparison ---------------- */}
        <div className="mt-10 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
          <h3 className="gp-serif text-xl">Every vehicle, every mismatch</h3>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Ranked by exposure fit, then friction
          </p>
        </div>

        <div className="mt-5 grid gap-px border border-border bg-border md:grid-cols-2 xl:grid-cols-4">
          {rankings.map((r) => (
            <article
              key={r.contractCode}
              className={cn(
                'relative flex flex-col bg-card p-4',
                r.isWinner && 'shadow-[inset_4px_0_0_var(--gp-gold-500)]'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    #{String(r.rank).padStart(2, '0')}
                  </span>
                  <h4 className="gp-serif text-xl">{r.contractCode}</h4>
                </div>
                {r.isWinner ? (
                  <span className="gp-tag gp-tag--gold">Best fit</span>
                ) : (
                  <span className="gp-tag gp-tag--neutral">{r.tradingUnitG} g</span>
                )}
              </div>

              <dl className="mt-4 space-y-2 border-t border-border pt-3 font-mono text-[11px]">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Lots</dt>
                  <dd className="text-foreground">{r.lotsRequired}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Fitted</dt>
                  <dd className="text-foreground">{r.actualExposureG} g</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Mismatch</dt>
                  <dd
                    className={cn(
                      r.exposureMismatchG === 0 ? 'gp-tradable-text' : 'text-foreground'
                    )}
                  >
                    {r.exposureMismatchG} g · {pctAbs(r.exposureMismatchPct)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Cost / g</dt>
                  <dd className="text-foreground">{inrPerG(r.estimatedCostPerGramInr)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Friction</dt>
                  <dd className="text-foreground">{bps(r.estimatedCostBps)}</dd>
                </div>
              </dl>

              <p className="mt-4 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
                {r.rationale}
              </p>
            </article>
          ))}
        </div>

        <p className="mt-5 max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
          Exposure mismatch is a physical constraint, not a verdict. A zero mismatch is a clean
          fit; a non-zero mismatch is still usable if the residual exposure is hedged elsewhere.
        </p>
      </div>
    </section>
  )
}
