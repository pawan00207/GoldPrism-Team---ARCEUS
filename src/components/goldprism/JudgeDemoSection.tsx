'use client'

import * as React from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Layers,
  RotateCcw,
  ShieldAlert,
  Trophy,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SectionHead, VerdictTag } from '@/components/goldprism/brand'
import { initializeJudgeDemo, JudgeDemoState } from '@/lib/goldprism/demo-script'
import { cn } from '@/lib/utils'

export function JudgeDemoSection() {
  const [demoState, setDemoState] = React.useState<JudgeDemoState>(() => initializeJudgeDemo())

  const resetDemo = () => {
    setDemoState(initializeJudgeDemo())
  }

  const setStep = (step: 1 | 2 | 3 | 4) => {
    setDemoState((prev) => ({ ...prev, currentStep: step }))
  }

  const steps: Array<{
    step: 1 | 2 | 3 | 4
    title: string
    subtitle: string
    icon: React.ReactNode
  }> = [
    {
      step: 1,
      title: 'Caught Fault',
      subtitle: 'Integrity Gate Block',
      icon: <ShieldAlert className="h-4 w-4 text-[var(--gp-blocked-ink)]" />,
    },
    {
      step: 2,
      title: 'X-Ray Waterfall',
      subtitle: 'Component Decomposition',
      icon: <Layers className="h-4 w-4 text-[var(--gp-gold-ink)]" />,
    },
    {
      step: 3,
      title: 'Inaction Verdict',
      subtitle: 'NO EDGE Discipline',
      icon: <XCircle className="h-4 w-4 text-muted-foreground" />,
    },
    {
      step: 4,
      title: 'Best Vehicle',
      subtitle: '50g Hedge Selection',
      icon: <Trophy className="h-4 w-4 text-[var(--gp-tradable-ink)]" />,
    },
  ]

  return (
    <section id="judge-demo" className="scroll-mt-16 border-b border-border bg-background">
      <div className="mx-auto max-w-[1360px] px-4 py-8 md:py-10">
        <SectionHead
          index="01.0"
          eyebrow="5-Minute Demo · Slide 7 Spec"
          title="5 Minutes to Truth."
          description="Deterministic 4-step walkthrough: from caught data faults to disciplined inaction and optimal vehicle selection."
          aside={
            <Button variant="outline" size="sm" onClick={resetDemo} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Script
            </Button>
          }
        />

        {/* 4 Step Navigation Tabs */}
        <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border border-border bg-border shadow-[var(--gp-hard-shadow)] md:grid-cols-4">
          {steps.map((item) => {
            const active = demoState.currentStep === item.step
            return (
              <button
                key={item.step}
                type="button"
                onClick={() => setStep(item.step)}
                aria-pressed={active}
                className={cn(
                  'bg-card p-4 text-left transition-colors',
                  active
                    ? 'bg-[var(--gp-gold-50)] text-foreground dark:bg-[var(--gp-gold-900)]'
                    : 'text-muted-foreground hover:bg-background hover:text-foreground'
                )}
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.12em]">
                  Step 0{item.step}
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2 font-serif text-base font-medium text-foreground">
                  <span>{item.title}</span>
                  {item.icon}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{item.subtitle}</div>
              </button>
            )
          })}
        </div>

        {/* Dynamic Step Content Container */}
        <div className="mt-6 rounded-[4px] border border-border bg-card p-6 shadow-[var(--gp-hard-shadow)]">
          {demoState.currentStep === 1 && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <p className="gp-label text-[var(--gp-blocked-ink)]">
                    Caught error (seeded) · Integrity gate
                  </p>
                  <h3 className="gp-serif mt-1 text-xl text-foreground">
                    Integrity Gates Reject Corrupted Records
                  </h3>
                </div>
                <VerdictTag verdict="BLOCKED" />
              </div>

              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border border-border bg-border md:grid-cols-4">
                <div className="bg-background p-4">
                  <dt className="gp-label">Missing Values</dt>
                  <dd className="gp-figure mt-2 text-lg text-[var(--gp-blocked-ink)]">2.31%</dd>
                </div>
                <div className="bg-background p-4">
                  <dt className="gp-label">Outliers Detected</dt>
                  <dd className="gp-figure mt-2 text-lg text-[var(--gp-blocked-ink)]">YES</dd>
                </div>
                <div className="bg-background p-4">
                  <dt className="gp-label">Date Mismatch</dt>
                  <dd className="gp-figure mt-2 text-lg text-[var(--gp-blocked-ink)]">1 row</dd>
                </div>
                <div className="bg-background p-4">
                  <dt className="gp-label">System Reaction</dt>
                  <dd className="gp-figure mt-2 text-sm text-[var(--gp-tradable-ink)]">
                    Trading Blocked
                  </dd>
                </div>
              </dl>

              <p className="text-xs leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Why this matters:</strong> Most platforms silently
                ingest bad broker quotes or misdated rows. GoldPrism immediately locks execution
                when a single date mismatch or outlier occurs.
              </p>
            </div>
          )}

          {demoState.currentStep === 2 && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <p className="gp-label gp-gold-text">Clean waterfall · Structural decomposition</p>
                  <h3 className="gp-serif mt-1 text-xl text-foreground">
                    Decomposing GOLDTEN vs GOLDM
                  </h3>
                </div>
                <span className="font-mono text-xs text-[var(--gp-tradable-ink)]">
                  Recon error: {demoState.step2Data.reconciliationError.toFixed(6)} ₹/g
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border border-border bg-border md:grid-cols-4">
                <div className="bg-background p-4">
                  <dt className="gp-label">Raw Spread Gap</dt>
                  <dd className="gp-figure mt-2 text-lg text-foreground">
                    +{demoState.step2Data.rawSpreadBps.toFixed(1)} bps
                  </dd>
                </div>
                <div className="bg-background p-4">
                  <dt className="gp-label">Structural Basis</dt>
                  <dd className="gp-figure mt-2 text-lg text-[var(--gp-watch-ink)]">
                    {demoState.step2Data.structuralBasisBps.toFixed(1)} bps
                  </dd>
                </div>
                <div className="bg-background p-4">
                  <dt className="gp-label">Expiry Carry</dt>
                  <dd className="gp-figure mt-2 text-lg text-[var(--gp-watch-ink)]">
                    {demoState.step2Data.expiryCarryBps.toFixed(1)} bps
                  </dd>
                </div>
                <div className="bg-background p-4">
                  <dt className="gp-label">Gross Residual</dt>
                  <dd className="gp-figure mt-2 text-lg gp-gold-text">
                    +{demoState.step2Data.grossResidualBps.toFixed(1)} bps
                  </dd>
                </div>
              </dl>

              <p className="text-xs leading-relaxed text-muted-foreground">
                The large raw gap is mostly explained by GOLDM&apos;s 995 vs 999 purity and the
                staggered delivery window carry (3rd–5th vs 27th–31st).
              </p>
            </div>
          )}

          {demoState.currentStep === 3 && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <p className="gp-label">Inaction verdict · Cost hurdle check</p>
                  <h3 className="gp-serif mt-1 text-xl text-foreground">
                    Gross Residual Below Transaction Cost Hurdle
                  </h3>
                </div>
                <VerdictTag verdict="NO EDGE" />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 rounded-[4px] border border-border bg-background p-4">
                <div>
                  <p className="gp-label">Spread Residual vs Total Statutory Hurdle</p>
                  <p className="mt-1.5 font-mono text-sm text-foreground">
                    Gross Residual: +{demoState.step3Data.grossResidualBps.toFixed(1)} bps · Paired
                    Costs: −{demoState.step3Data.transactionCostsBps.toFixed(1)} bps
                  </p>
                </div>
                <div className="text-right font-mono">
                  <p className="gp-label">Net Actionable Edge</p>
                  <p className="gp-figure mt-1 text-xl text-[var(--gp-blocked-ink)]">
                    {demoState.step3Data.netEdgeBps.toFixed(1)} bps
                  </p>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Discipline over churn:</strong> Where a naive bot
                bleeds brokerage, CTT, GST, and slippage on a false gap, GoldPrism proves trading
                here locks in a loss and keeps ₹0 at risk.
              </p>
            </div>
          )}

          {demoState.currentStep === 4 && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <p className="gp-label gp-gold-text">Best vehicle selection</p>
                  <h3 className="gp-serif mt-1 text-xl text-foreground">
                    Cheapest Contract for 50g Target Physical Exposure
                  </h3>
                </div>
                <span className="font-mono text-xs font-semibold text-[var(--gp-tradable-ink)]">
                  WINNER: {demoState.step4Data[0].contractCode}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[4px] border border-border bg-border md:grid-cols-4">
                {demoState.step4Data.map((v) => (
                  <div
                    key={v.contractCode}
                    className={cn(
                      'p-4 font-mono text-xs',
                      v.isWinner
                        ? 'bg-[var(--gp-gold-50)] dark:bg-[var(--gp-gold-900)]'
                        : 'bg-background'
                    )}
                  >
                    <div className="flex justify-between font-semibold text-foreground">
                      <span>
                        #{v.rank} {v.contractCode}
                      </span>
                      <span className={v.isWinner ? 'gp-gold-text' : 'text-muted-foreground'}>
                        {v.compositeScore} pts
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Lots: {v.lotsRequired} ({v.actualExposureG}g)
                    </p>
                    <p
                      className={cn(
                        'mt-1 text-[11px] font-medium',
                        v.exposureMismatchPct === 0
                          ? 'text-[var(--gp-tradable-ink)]'
                          : 'text-[var(--gp-blocked-ink)]'
                      )}
                    >
                      Mismatch: {v.exposureMismatchPct}%
                    </p>
                  </div>
                ))}
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">
                GOLDTEN is selected because 5 lots provide an exact 50g hedge with 0.0% mismatch,
                whereas GOLDM has a 100g minimum lot causing a 100% mismatch penalty.
              </p>
            </div>
          )}

          {/* Wizard Next / Prev Buttons */}
          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={demoState.currentStep === 1}
              onClick={() => setStep((demoState.currentStep - 1) as 1 | 2 | 3 | 4)}
              className="gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Previous Step
            </Button>

            <span className="font-mono text-xs text-muted-foreground">
              Step {demoState.currentStep} of 4
            </span>

            <Button
              size="sm"
              disabled={demoState.currentStep === 4}
              onClick={() => setStep((demoState.currentStep + 1) as 1 | 2 | 3 | 4)}
              className="gap-1.5"
            >
              Next Step <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
