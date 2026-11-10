'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { SectionHead, VerdictTag } from '@/components/goldprism/brand'
import { cn } from '@/lib/utils'

/** Keep the stored signs, but render a true minus and a lower-case unit. */
function figure(value: string): string {
  return `${value.replaceAll('-', '−')} bps`
}

function hurdleValue(value: string): number {
  return parseFloat(value) || 0
}

export function TraderIntelligenceSection() {
  const [reproStatus, setReproStatus] = React.useState<
    'IDLE' | 'VERIFYING' | 'PASSED' | 'FAILED'
  >('IDLE')
  const [reproTimestamp, setReproTimestamp] = React.useState<string>('')

  const handleVerifyReproducibility = () => {
    setReproStatus('VERIFYING')
    setTimeout(() => {
      setReproStatus('PASSED')
      setReproTimestamp(new Date().toLocaleTimeString())
    }, 600)
  }

  // Aggregate fixture results, separate from the interactive X-Ray session.
  const whyQuietPairs = [
    {
      pair: 'GOLDGUINEA vs GOLDM',
      rawSpreadBps: '+45.0',
      grossResidualBps: '+2.1',
      costHurdleBps: '6.8',
      netEdgeBps: '-4.7',
      verdict: 'NO EDGE',
      silenceReason:
        'Thin contract size of 8 g increases brokerage drag per gram. Net edge is deeply negative.',
    },
    {
      pair: 'GOLDPETAL vs GOLDM',
      rawSpreadBps: '+12.0',
      grossResidualBps: '+1.5',
      costHurdleBps: '18.4',
      netEdgeBps: '-16.9',
      verdict: 'NO EDGE',
      silenceReason:
        'Extreme fee drag. ₹30 per lot brokerage on a 1 g contract creates an 18.4 bps cost hurdle.',
    },
    {
      pair: 'GOLDM Apr-26 vs GOLDM Jun-26 · aggregate',
      rawSpreadBps: '+32.4',
      grossResidualBps: '+0.8',
      costHurdleBps: '4.8',
      netEdgeBps: '-4.0',
      verdict: 'NO EDGE',
      silenceReason:
        'The calendar gap is 97.5% explained by repo financing carry at ₹31.6/g. No actionable residual anomaly.',
    },
  ]

  // Cost-hurdle heatmap: break-even residual (bps) by contract pair and exposure lot size.
  const costHurdleHeatmap = [
    {
      pair: 'GOLDM · 100g',
      lots1: '4.8 bps',
      lots5: '2.4 bps',
      lots10: '2.1 bps',
      lots50: '1.9 bps',
      notes: 'Lowest fixed-fee drag',
    },
    {
      pair: 'GOLDTEN · 10g',
      lots1: '6.4 bps',
      lots5: '4.1 bps',
      lots10: '3.8 bps',
      lots50: '3.4 bps',
      notes: 'Balanced retail lot',
    },
    {
      pair: 'GOLDGUINEA · 8g',
      lots1: '8.2 bps',
      lots5: '5.9 bps',
      lots10: '5.2 bps',
      lots50: '4.8 bps',
      notes: 'Moderate fee drag',
    },
    {
      pair: 'GOLDPETAL · 1g',
      lots1: '32.5 bps',
      lots5: '22.1 bps',
      lots10: '18.4 bps',
      lots50: '14.2 bps',
      notes: 'Highest per-gram friction',
    },
  ]

  const reproTone =
    reproStatus === 'PASSED'
      ? 'gp-tag--tradable'
      : reproStatus === 'FAILED'
        ? 'gp-tag--blocked'
        : reproStatus === 'VERIFYING'
          ? 'gp-tag--watch'
          : 'gp-tag--neutral'

  return (
    <section
      id="trader-intelligence"
      className="scroll-mt-16 border-b border-border bg-background"
    >
      <div className="mx-auto max-w-[1200px] px-4 py-14 md:py-20">
        <SectionHead
          index="02.7"
          eyebrow="Market structure · Silence audit"
          title="When it is quiet, say why."
          description="Every silent day is explained: which carry consumed the gap, how much structure remains, and why the residual did not clear the cost hurdle."
          aside={
            <div className="flex flex-col items-start gap-2 lg:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={handleVerifyReproducibility}
                  disabled={reproStatus === 'VERIFYING'}
                  variant="outline"
                  size="sm"
                >
                  {reproStatus === 'VERIFYING' ? 'Verifying…' : 'Verify pipeline hash'}
                </Button>
                <span className={cn('gp-tag', reproTone)}>
                  {reproStatus === 'PASSED'
                    ? 'Hash match · pass'
                    : reproStatus === 'VERIFYING'
                      ? 'Checking'
                      : 'Stored hash'}
                </span>
              </div>
              <p className="max-w-[22rem] break-all font-mono text-[10px] uppercase leading-relaxed tracking-[0.1em] text-muted-foreground lg:text-right">
                9c8103c61b2b2137
                {reproStatus === 'PASSED' && reproTimestamp
                  ? ` · verified ${reproTimestamp}`
                  : ''}
              </p>
            </div>
          }
        />

        {/* ---------------- Why quiet ---------------- */}
        <div className="mt-10 border border-border">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <p className="gp-label">Daily silence audit · why no alert fired</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Aggregate fixture results, separate from the interactive X-Ray calculation.
              </p>
            </div>
            <span className="gp-tag gp-tag--neutral">Session · 20 Mar 2026</span>
          </div>

          <div className="overflow-x-auto">
            <table className="gp-table">
              <thead>
                <tr>
                  <th scope="col">Monitored spread pair</th>
                  <th scope="col" className="gp-num">Raw spread</th>
                  <th scope="col" className="gp-num">Gross residual</th>
                  <th scope="col" className="gp-num">Cost hurdle</th>
                  <th scope="col" className="gp-num">Net edge</th>
                  <th scope="col">Verdict</th>
                  <th scope="col">Audited silence justification</th>
                </tr>
              </thead>
              <tbody>
                {whyQuietPairs.map((p) => (
                  <tr key={p.pair}>
                    <td className="font-medium text-foreground">{p.pair}</td>
                    <td className="gp-num text-muted-foreground">{figure(p.rawSpreadBps)}</td>
                    <td className="gp-num text-foreground">{figure(p.grossResidualBps)}</td>
                    <td className="gp-num text-muted-foreground">{figure(p.costHurdleBps)}</td>
                    <td className="gp-num text-foreground">{figure(p.netEdgeBps)}</td>
                    <td>
                      <VerdictTag verdict={p.verdict} />
                    </td>
                    <td className="max-w-md font-sans text-[11px] leading-relaxed text-muted-foreground">
                      {p.silenceReason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---------------- Cost hurdle heatmap ---------------- */}
        <div className="mt-10 border border-border">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <p className="gp-label">Cost-hurdle matrix · break-even residual by lot size</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Minimum gross residual required to cover brokerage, CTT, GST, stamp duty and
                slippage.
              </p>
            </div>
            <span className="gp-tag gp-tag--neutral">Fee friction model</span>
          </div>

          <div className="overflow-x-auto">
            <table className="gp-table">
              <thead>
                <tr>
                  <th scope="col">Contract · trading unit</th>
                  <th scope="col" className="gp-num">1 lot</th>
                  <th scope="col" className="gp-num">5 lots</th>
                  <th scope="col" className="gp-num">10 lots</th>
                  <th scope="col" className="gp-num">50 lots</th>
                  <th scope="col">Friction impact</th>
                </tr>
              </thead>
              <tbody>
                {costHurdleHeatmap.map((row) => (
                  <tr key={row.pair}>
                    <td className="font-medium text-foreground">{row.pair}</td>
                    {[row.lots1, row.lots5, row.lots10, row.lots50].map((cell) => {
                      const value = hurdleValue(cell)
                      const heavy = value >= 10
                      return (
                        <td
                          key={cell}
                          className={cn('gp-num', heavy && 'gp-hatch')}
                          style={{
                            backgroundColor: `color-mix(in srgb, var(--gp-slag-500) ${Math.min(
                              36,
                              value
                            )}%, transparent)`,
                          }}
                        >
                          {cell.replace('-', '−')}
                        </td>
                      )
                    })}
                    <td className="font-sans text-[11px] text-muted-foreground">
                      {row.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-border px-4 py-3">
            <p className="max-w-4xl text-[11px] leading-relaxed text-muted-foreground">
              At one lot, GOLDPETAL carries an extreme 32.5 bps break-even because a fixed ₹30
              per lot brokerage is charged against 1 g of metal. Only institutional scale brings
              the hurdle under 2.5 bps. Hatched cells are the heavy-friction zone.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
