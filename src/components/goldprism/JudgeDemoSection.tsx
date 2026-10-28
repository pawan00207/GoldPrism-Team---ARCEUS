'use client'

import * as React from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Layers,
  RotateCcw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trophy,
  XCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  initializeJudgeDemo,
  JudgeDemoState,
} from '@/lib/goldprism/demo-script'

export function JudgeDemoSection() {
  const [demoState, setDemoState] = React.useState<JudgeDemoState>(() => initializeJudgeDemo())

  const resetDemo = () => {
    setDemoState(initializeJudgeDemo())
  }

  const setStep = (step: 1 | 2 | 3 | 4) => {
    setDemoState((prev) => ({ ...prev, currentStep: step }))
  }

  return (
    <section id="judge-demo" className="py-12 scroll-mt-16 border-b border-border/40 bg-gradient-to-b from-card/30 to-background">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-amber-500 text-black font-bold gap-1 text-xs">
                <Sparkles className="w-3.5 h-3.5" /> 5-Minute Judge Demo
              </Badge>
              <Badge variant="outline" className="border-amber-500/40 text-amber-300 text-xs">
                DEMO SCRIPT · SLIDE 7 SPECIFICATION
              </Badge>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              5 Minutes to Truth
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Deterministic 4-step live walkthrough: from caught data faults to disciplined inaction and optimal vehicle selection.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={resetDemo}
            className="gap-1.5 border-border/80 self-start md:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Demo Script
          </Button>
        </div>

        {/* 4 Step Navigation Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
          <button
            onClick={() => setStep(1)}
            className={`p-3 rounded-xl border text-left transition-all ${
              demoState.currentStep === 1
                ? 'bg-amber-500/10 border-amber-500 text-amber-300 font-bold shadow-md shadow-amber-500/10'
                : 'bg-card/40 border-border/60 text-muted-foreground hover:bg-muted/40'
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider font-mono">Step 1</div>
            <div className="text-sm font-semibold flex items-center justify-between mt-1">
              <span>Caught Fault</span>
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Integrity Gate Block</div>
          </button>

          <button
            onClick={() => setStep(2)}
            className={`p-3 rounded-xl border text-left transition-all ${
              demoState.currentStep === 2
                ? 'bg-amber-500/10 border-amber-500 text-amber-300 font-bold shadow-md shadow-amber-500/10'
                : 'bg-card/40 border-border/60 text-muted-foreground hover:bg-muted/40'
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider font-mono">Step 2</div>
            <div className="text-sm font-semibold flex items-center justify-between mt-1">
              <span>X-Ray Waterfall</span>
              <Layers className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Component Decomposition</div>
          </button>

          <button
            onClick={() => setStep(3)}
            className={`p-3 rounded-xl border text-left transition-all ${
              demoState.currentStep === 3
                ? 'bg-amber-500/10 border-amber-500 text-amber-300 font-bold shadow-md shadow-amber-500/10'
                : 'bg-card/40 border-border/60 text-muted-foreground hover:bg-muted/40'
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider font-mono">Step 3</div>
            <div className="text-sm font-semibold flex items-center justify-between mt-1">
              <span>Inaction Verdict</span>
              <XCircle className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">NO EDGE Discipline</div>
          </button>

          <button
            onClick={() => setStep(4)}
            className={`p-3 rounded-xl border text-left transition-all ${
              demoState.currentStep === 4
                ? 'bg-amber-500/10 border-amber-500 text-amber-300 font-bold shadow-md shadow-amber-500/10'
                : 'bg-card/40 border-border/60 text-muted-foreground hover:bg-muted/40'
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider font-mono">Step 4</div>
            <div className="text-sm font-semibold flex items-center justify-between mt-1">
              <span>Best Vehicle</span>
              <Trophy className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">50g Hedge Selection</div>
          </button>
        </div>

        {/* Dynamic Step Content Container */}
        <Card className="p-6 border-border/80 bg-card/60">
          {demoState.currentStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/40 text-xs font-mono">
                    CAUGHT ERROR (SEEDED)
                  </Badge>
                  <span className="text-sm font-bold text-foreground">
                    Integrity Gates Reject Corrupted Records
                  </span>
                </div>
                <Badge variant="outline" className="text-rose-400 border-rose-500/30 text-xs font-mono">
                  Status: Failed: run blocked
                </Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 rounded-lg bg-black/40 border border-border/40">
                  <div className="text-muted-foreground">Missing Values</div>
                  <div className="text-lg font-bold text-rose-400 mt-1">2.31%</div>
                </div>
                <div className="p-3 rounded-lg bg-black/40 border border-border/40">
                  <div className="text-muted-foreground">Outliers Detected</div>
                  <div className="text-lg font-bold text-rose-400 mt-1">YES</div>
                </div>
                <div className="p-3 rounded-lg bg-black/40 border border-border/40">
                  <div className="text-muted-foreground">Date Mismatch Rejected</div>
                  <div className="text-lg font-bold text-rose-400 mt-1">1 row</div>
                </div>
                <div className="p-3 rounded-lg bg-black/40 border border-border/40">
                  <div className="text-muted-foreground">System Reaction</div>
                  <div className="text-xs font-bold text-emerald-400 mt-1">Trading Blocked</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs leading-relaxed text-foreground">
                <strong>Why this matters to judges:</strong> Most trading platforms silently ingest bad broker quotes or calculate signals on bad dates. GoldPrism immediately locks execution when a single date mismatch or outlier occurs, ensuring institutional auditability.
              </div>
            </div>
          )}

          {demoState.currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/40 text-xs font-mono">
                    CLEAN WATERFALL
                  </Badge>
                  <span className="text-sm font-bold text-foreground">
                    Decomposing GOLDTEN (Apr '26) vs GOLDM (Apr '26)
                  </span>
                </div>
                <span className="text-xs font-mono text-emerald-400">
                  Reconciliation Error: {demoState.step2Data.reconciliationError.toFixed(6)} ₹/g
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 rounded-lg bg-black/40 border border-border/40">
                  <div className="text-muted-foreground">Raw Spread Gap</div>
                  <div className="text-lg font-bold text-blue-400 mt-1">
                    +{demoState.step2Data.rawSpreadBps.toFixed(1)} bps
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-black/40 border border-border/40">
                  <div className="text-muted-foreground">Structural Basis</div>
                  <div className="text-lg font-bold text-amber-400 mt-1">
                    {demoState.step2Data.structuralBasisBps.toFixed(1)} bps
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-black/40 border border-border/40">
                  <div className="text-muted-foreground">Expiry Carry</div>
                  <div className="text-lg font-bold text-amber-500 mt-1">
                    {demoState.step2Data.expiryCarryBps.toFixed(1)} bps
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-black/40 border border-border/40">
                  <div className="text-muted-foreground">Gross Residual</div>
                  <div className="text-lg font-bold text-cyan-400 mt-1">
                    +{demoState.step2Data.grossResidualBps.toFixed(1)} bps
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Notice how the massive raw spread is almost entirely explained by the 995 vs 999 purity difference and the 3rd-5th vs 27th-31st delivery window carry.
              </p>
            </div>
          )}

          {demoState.currentStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <Badge className="bg-zinc-500/20 text-zinc-300 border-zinc-500/40 text-xs font-mono">
                    INACTION VERDICT
                  </Badge>
                  <span className="text-sm font-bold text-foreground">
                    Gross Residual Below Transaction Cost Hurdle
                  </span>
                </div>
                <Badge className="bg-zinc-600 text-white font-mono text-xs">
                  VERDICT: NO EDGE
                </Badge>
              </div>

              <div className="p-4 rounded-xl bg-black/50 border border-border/60 flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Spread Residual vs Total Transaction Hurdle</div>
                  <div className="text-sm font-semibold text-foreground">
                    Gross Residual: <span className="text-cyan-400">+{demoState.step3Data.grossResidualBps.toFixed(1)} bps</span> · Paired Costs: <span className="text-rose-400">-{demoState.step3Data.transactionCostsBps.toFixed(1)} bps</span>
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-xs text-muted-foreground">Net Actionable Edge</div>
                  <div className="text-xl font-bold text-rose-400">
                    {demoState.step3Data.netEdgeBps.toFixed(1)} bps
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs leading-relaxed text-foreground">
                <strong>Core Pitch to Judges:</strong> A generic bot would trade this spread and bleed capital through brokerage, CTT, and slippage. GoldPrism proves that trading here would produce a guaranteed loss. <strong>Capital preserved: ₹0 lost to churn.</strong>
              </div>
            </div>
          )}

          {demoState.currentStep === 4 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-mono">
                    BEST VEHICLE SELECTION
                  </Badge>
                  <span className="text-sm font-bold text-foreground">
                    Cheapest Contract for 50g Target Physical Exposure
                  </span>
                </div>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  WINNER: {demoState.step4Data[0].contractCode}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono">
                {demoState.step4Data.map((v) => (
                  <div
                    key={v.contractCode}
                    className={`p-3 rounded-lg border ${
                      v.isWinner
                        ? 'border-amber-500/60 bg-amber-500/10'
                        : 'border-border/40 bg-black/40'
                    }`}
                  >
                    <div className="flex justify-between font-bold mb-1">
                      <span>#{v.rank} {v.contractCode}</span>
                      <span className={v.isWinner ? 'text-amber-400' : 'text-muted-foreground'}>
                        {v.compositeScore} pts
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Lots: {v.lotsRequired} ({v.actualExposureG}g)
                    </div>
                    <div className={`text-[11px] mt-1 ${v.exposureMismatchPct === 0 ? 'text-emerald-400 font-bold' : 'text-rose-400'}`}>
                      Mismatch: {v.exposureMismatchPct}%
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                GOLDTEN is selected because 5 lots provide an exact 50g hedge with 0.0% mismatch, whereas GOLDM has a 100g minimum lot causing a 100% mismatch penalty.
              </p>
            </div>
          )}

          {/* Wizard Next / Prev Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-border/40 mt-6">
            <Button
              variant="outline"
              size="sm"
              disabled={demoState.currentStep === 1}
              onClick={() => setStep((demoState.currentStep - 1) as any)}
              className="gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Previous Step
            </Button>

            <span className="text-xs text-muted-foreground font-mono">
              Step {demoState.currentStep} of 4
            </span>

            <Button
              size="sm"
              disabled={demoState.currentStep === 4}
              onClick={() => setStep((demoState.currentStep + 1) as any)}
              className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              Next Step <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </Card>
      </div>
    </section>
  )
}
