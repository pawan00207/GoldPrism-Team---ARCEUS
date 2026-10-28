'use client'

import * as React from 'react'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Layers,
  Scale,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  XCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
  computeXRayWaterfall,
  XRayWaterfallResult,
  XRayVerdict,
} from '@/lib/goldprism/xray'
import { SupportedContractCode } from '@/lib/goldprism/contract-master'

export function XRayWaterfallSection() {
  const [contractA, setContractA] = React.useState<SupportedContractCode>('GOLDTEN')
  const [priceA, setPriceA] = React.useState<number>(74080.0)
  const [expiryA, setExpiryA] = React.useState<string>('2026-04-28')

  const [contractB, setContractB] = React.useState<SupportedContractCode>('GOLDM')
  const [priceB, setPriceB] = React.useState<number>(73510.0)
  const [expiryB, setExpiryB] = React.useState<string>('2026-04-05')

  const [carryRate, setCarryRate] = React.useState<number>(0.065)
  const [settlementArtifact, setSettlementArtifact] = React.useState<number>(14.8)

  const result: XRayWaterfallResult = React.useMemo(() => {
    return computeXRayWaterfall({
      contractA,
      priceAQuoted: priceA,
      expiryA,
      contractB,
      priceBQuoted: priceB,
      expiryB,
      tradeDate: '2026-03-20',
      annualCarryRate: carryRate,
      settlementArtifactInrPerG: settlementArtifact,
    })
  }, [contractA, priceA, expiryA, contractB, priceB, expiryB, carryRate, settlementArtifact])

  const waterfallBars = [
    { label: 'Raw Gap', valueBps: result.rawSpreadBps, valueInr: result.rawSpreadInrPerG, type: 'raw', color: 'bg-blue-500' },
    { label: 'Structural Basis', valueBps: -Math.abs(result.structuralBasisBps), valueInr: -Math.abs(result.structuralBasisInrPerG), type: 'deduction', color: 'bg-amber-500' },
    { label: 'Expiry Carry', valueBps: -Math.abs(result.expiryCarryBps), valueInr: -Math.abs(result.expiryCarryInrPerG), type: 'deduction', color: 'bg-amber-600' },
    { label: 'Settlement Artifact', valueBps: -Math.abs(result.settlementArtifactBps), valueInr: -Math.abs(result.settlementArtifactInrPerG), type: 'deduction', color: 'bg-amber-700' },
    { label: 'Gross Residual', valueBps: result.grossResidualBps, valueInr: result.grossResidualInrPerG, type: 'residual', color: result.grossResidualBps >= 0 ? 'bg-cyan-500' : 'bg-rose-500' },
    { label: 'Transaction Costs', valueBps: -Math.abs(result.transactionCostsBps), valueInr: -Math.abs(result.transactionCostsInrPerG), type: 'cost', color: 'bg-rose-600' },
    { label: 'Net Edge', valueBps: result.netEdgeBps, valueInr: result.netEdgeInrPerG, type: 'net', color: result.netEdgeBps > 0 ? 'bg-emerald-500' : 'bg-zinc-600' },
  ]

  return (
    <section id="xray-waterfall" className="py-12 scroll-mt-16 border-b border-border/40">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <Badge variant="outline" className="mb-2 gap-1.5 border-amber-500/40 text-amber-300">
              <Layers className="w-3 h-3 text-amber-400" /> Phase 03: Signature Spread Decomposition
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              The X-Ray Waterfall
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Splits every MCX gold gap into basis, carry, artifact and residual, and judges only the residual net of costs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground px-2.5 py-1 rounded bg-muted border border-border/80">
              CONFIG: <span className="text-amber-400 font-semibold">{result.configHash}</span>
            </span>
          </div>
        </div>

        {/* Pair Control Bar */}
        <Card className="mb-8 p-4 bg-card/60 border-border/80">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            {/* Leg A */}
            <div className="p-3 rounded-lg bg-muted/30 border border-border/60">
              <div className="text-xs font-bold text-foreground mb-1">Leg A (Near/Target)</div>
              <div className="flex items-center gap-2">
                <select
                  value={contractA}
                  onChange={(e) => setContractA(e.target.value as SupportedContractCode)}
                  className="px-2 py-1 text-xs rounded bg-muted border border-border text-foreground font-mono"
                >
                  <option value="GOLDTEN">GOLDTEN (10g)</option>
                  <option value="GOLDM">GOLDM (100g)</option>
                  <option value="GOLDGUINEA">GOLDGUINEA (8g)</option>
                  <option value="GOLDPETAL">GOLDPETAL (1g)</option>
                </select>
                <input
                  type="number"
                  value={priceA}
                  onChange={(e) => setPriceA(parseFloat(e.target.value) || 0)}
                  className="w-24 px-2 py-1 text-xs rounded bg-muted border border-border text-foreground font-mono"
                />
              </div>
              <div className="text-[11px] text-muted-foreground font-mono mt-1">
                Exp: {expiryA} · ₹{result.priceANormalized.toFixed(2)}/g (999)
              </div>
            </div>

            {/* Leg B */}
            <div className="p-3 rounded-lg bg-muted/30 border border-border/60">
              <div className="text-xs font-bold text-foreground mb-1">Leg B (Benchmark/Far)</div>
              <div className="flex items-center gap-2">
                <select
                  value={contractB}
                  onChange={(e) => setContractB(e.target.value as SupportedContractCode)}
                  className="px-2 py-1 text-xs rounded bg-muted border border-border text-foreground font-mono"
                >
                  <option value="GOLDM">GOLDM (100g)</option>
                  <option value="GOLDTEN">GOLDTEN (10g)</option>
                  <option value="GOLDGUINEA">GOLDGUINEA (8g)</option>
                  <option value="GOLDPETAL">GOLDPETAL (1g)</option>
                </select>
                <input
                  type="number"
                  value={priceB}
                  onChange={(e) => setPriceB(parseFloat(e.target.value) || 0)}
                  className="w-24 px-2 py-1 text-xs rounded bg-muted border border-border text-foreground font-mono"
                />
              </div>
              <div className="text-[11px] text-muted-foreground font-mono mt-1">
                Exp: {expiryB} · ₹{result.priceBNormalized.toFixed(2)}/g (999)
              </div>
            </div>

            {/* Carry & Artifact Controls */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Carry Rate (Repo Proxy):</span>
                <span className="font-mono font-bold text-foreground">{(carryRate * 100).toFixed(1)}%</span>
              </div>
              <Slider
                value={[carryRate * 100]}
                min={4}
                max={10}
                step={0.5}
                onValueChange={(val) => setCarryRate(val[0] / 100)}
                className="py-1"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Settlement Artifact:</span>
                <span className="font-mono font-bold text-foreground">₹{settlementArtifact.toFixed(1)}/g</span>
              </div>
              <Slider
                value={[settlementArtifact]}
                min={0}
                max={30}
                step={1}
                onValueChange={(val) => setSettlementArtifact(val[0])}
                className="py-1"
              />
            </div>
          </div>
        </Card>

        {/* Visual Waterfall Diagram (Slide 3 Mockup) */}
        <Card className="mb-8 p-6 bg-card/60 border-border/80">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              Waterfall Breakdown (Basis Points of Raw Gap)
            </h3>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-muted-foreground">Reconciliation Error:</span>
              <span className="text-emerald-400 font-bold">
                {result.reconciliationError.toFixed(6)} ₹/g (OK &lt; 0.01)
              </span>
            </div>
          </div>

          {/* Bar Diagram */}
          <div className="grid grid-cols-2 md:grid-cols-7 gap-3 mb-6">
            {waterfallBars.map((bar, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-muted/40 border border-border/60 flex flex-col justify-between"
              >
                <div>
                  <div className="text-[11px] text-muted-foreground font-medium mb-1 truncate" title={bar.label}>
                    {bar.label}
                  </div>
                  <div className="text-lg font-black font-mono tabular-nums">
                    {bar.valueBps > 0 ? `+${bar.valueBps.toFixed(1)}` : bar.valueBps.toFixed(1)}{' '}
                    <span className="text-[10px] font-normal text-muted-foreground">bps</span>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-[10px] font-mono text-muted-foreground mb-1">
                    {bar.valueInr > 0 ? `+₹${bar.valueInr.toFixed(2)}` : `₹${bar.valueInr.toFixed(2)}`}/g
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full ${bar.color}`}
                      style={{ width: `${Math.min(100, Math.max(10, Math.abs(bar.valueBps)))}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* The Verdict Banner */}
          <div
            className={`p-5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              result.verdict === 'TRADABLE'
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                : result.verdict === 'WATCH'
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                : result.verdict === 'NO EDGE'
                ? 'bg-zinc-500/10 border-zinc-500/40 text-zinc-300'
                : 'bg-rose-500/10 border-rose-500/40 text-rose-400'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-black/40 shrink-0 mt-0.5">
                {result.verdict === 'TRADABLE' ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                ) : result.verdict === 'WATCH' ? (
                  <AlertCircle className="w-6 h-6 text-amber-400" />
                ) : result.verdict === 'NO EDGE' ? (
                  <XCircle className="w-6 h-6 text-zinc-400" />
                ) : (
                  <ShieldAlert className="w-6 h-6 text-rose-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl font-black tracking-wide font-mono uppercase">
                    {result.verdict}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    [{result.reasonCodes.join(', ')}]
                  </span>
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed font-medium">
                  {result.verdictMessage}
                </p>
              </div>
            </div>

            <div className="shrink-0 text-right font-mono">
              <div className="text-xs text-muted-foreground">Net Actionable Edge</div>
              <div className="text-2xl font-black tabular-nums">
                {result.netEdgeBps > 0 ? `+${result.netEdgeBps.toFixed(1)}` : result.netEdgeBps.toFixed(1)} bps
              </div>
              <div className="text-xs text-muted-foreground">
                ({result.netEdgeInrPerG > 0 ? `+₹${result.netEdgeInrPerG.toFixed(2)}` : `₹${result.netEdgeInrPerG.toFixed(2)}`} / g)
              </div>
            </div>
          </div>
        </Card>

        {/* Itemized Transaction Costs Detail Table */}
        <Card className="p-5 bg-card/60 border-border/80">
          <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Scale className="w-4 h-4 text-amber-400" />
            Paired Round-Trip Transaction Cost Breakdown (Leg A & Leg B)
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded bg-muted/30 border border-border/40">
              <div className="text-muted-foreground text-[10px]">Brokerage (Both)</div>
              <div className="text-sm font-bold text-foreground mt-0.5">
                ₹{(result.costBreakdownA.brokerageInr + result.costBreakdownB.brokerageInr).toFixed(2)}
              </div>
              <div className="text-[10px] text-muted-foreground">₹30/lot/side × 2</div>
            </div>

            <div className="p-2.5 rounded bg-muted/30 border border-border/40">
              <div className="text-muted-foreground text-[10px]">Exchange Fee</div>
              <div className="text-sm font-bold text-foreground mt-0.5">
                ₹{(result.costBreakdownA.exchangeChargeInr + result.costBreakdownB.exchangeChargeInr).toFixed(2)}
              </div>
              <div className="text-[10px] text-muted-foreground">0.0026% of turnover</div>
            </div>

            <div className="p-2.5 rounded bg-muted/30 border border-border/40">
              <div className="text-muted-foreground text-[10px]">CTT (Sell Leg)</div>
              <div className="text-sm font-bold text-foreground mt-0.5">
                ₹{(result.costBreakdownA.cttInr + result.costBreakdownB.cttInr).toFixed(2)}
              </div>
              <div className="text-[10px] text-emerald-400 font-semibold">0.01% on sell only</div>
            </div>

            <div className="p-2.5 rounded bg-muted/30 border border-border/40">
              <div className="text-muted-foreground text-[10px]">GST (18%)</div>
              <div className="text-sm font-bold text-foreground mt-0.5">
                ₹{(result.costBreakdownA.gstInr + result.costBreakdownB.gstInr).toFixed(2)}
              </div>
              <div className="text-[10px] text-muted-foreground">18% on fees</div>
            </div>

            <div className="p-2.5 rounded bg-muted/30 border border-border/40">
              <div className="text-muted-foreground text-[10px]">Stamp Duty</div>
              <div className="text-sm font-bold text-foreground mt-0.5">
                ₹{(result.costBreakdownA.stampDutyInr + result.costBreakdownB.stampDutyInr).toFixed(2)}
              </div>
              <div className="text-[10px] text-muted-foreground">0.002% on buy side</div>
            </div>

            <div className="p-2.5 rounded bg-muted/30 border border-border/40">
              <div className="text-muted-foreground text-[10px]">Slippage (2 bps/leg)</div>
              <div className="text-sm font-bold text-rose-400 mt-0.5">
                ₹{(result.costBreakdownA.slippageInr + result.costBreakdownB.slippageInr).toFixed(2)}
              </div>
              <div className="text-[10px] text-muted-foreground">4 bps round-trip</div>
            </div>
          </div>
        </Card>

      </div>
    </section>
  )
}
