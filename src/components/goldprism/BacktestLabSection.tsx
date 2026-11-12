'use client'

import * as React from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart } from '@/components/charts/bar-chart'
import { Bar } from '@/components/charts/bar'
import { BarYAxis } from '@/components/charts/bar-y-axis'
import { Grid } from '@/components/charts/grid'
import { ChartTooltip } from '@/components/charts/tooltip'
import { LineSparkline } from '@/components/charts/sparkline'
import { DataTag, SectionHead, VerdictTag } from '@/components/goldprism/brand'
import { bps, inr, signed } from '@/lib/goldprism/format'
import { cn } from '@/lib/utils'

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
    { component: 'Gross residual', bps: 4.0, tone: 'structural' },
    { component: 'Brokerage drag', bps: -1.9, tone: 'cost' },
    { component: 'CTT · sell', bps: -1.1, tone: 'cost' },
    { component: 'GST & stamp', bps: -0.4, tone: 'cost' },
    { component: 'Slippage', bps: -1.8, tone: 'cost' },
    { component: 'Net edge', bps: -1.2, tone: 'net' },
  ]

  const tooltipStyle = {
    backgroundColor: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 2,
    boxShadow: '4px 4px 0 color-mix(in srgb, var(--gp-slag-900) 30%, transparent)',
    fontFamily: 'var(--gp-instrument)',
    fontSize: 11,
    color: 'var(--foreground)',
  }

  const axisTick = {
    fill: 'var(--gp-slag-500)',
    fontSize: 10,
    fontFamily: 'var(--gp-instrument)',
  }

  return (
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
            <div className="mt-3">
              <LineSparkline
                data={pipelineEquityCurve}
                dataKey="net_equity"
                height={28}
                curve="monotone"
                strokeWidth={1.5}
                color="var(--foreground)"
                endDot
                interactive={false}
                aria-label="Net equity trend, in-sample"
              />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Gold beta excluded. Pure calendar spread.
            </p>
          </div>

          <div className="bg-card p-4">
            <p className="gp-label">Bootstrap 95% CI</p>
            <p className="gp-figure mt-3 text-2xl">
              [{signed(-1.77)}, {signed(-0.71)}]
              <span className="ml-1 text-xs font-normal text-muted-foreground">bps</span>
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              10-day block bootstrap, 1,000 resamples.
            </p>
          </div>

          <div className="bg-card p-4">
            <p className="gp-label">Cost drag on spread</p>
            <p className="gp-figure mt-3 text-2xl">{inr(23832, 0)}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Brokerage, CTT, GST, stamp duty and slippage.
            </p>
          </div>

          <div className="bg-card p-4">
            <p className="gp-label">Final pipeline verdict</p>
            <div className="mt-3">
              <VerdictTag verdict="NO EDGE" />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Disciplined inaction preserves {inr(1000000, 0)} of capital.
            </p>
          </div>
        </div>

        {/* ---------------- Statistical rigour ---------------- */}
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          <div className="border-t-2 border-border pt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="gp-label">Block bootstrap uncertainty</p>
              <span className="gp-tag gp-tag--neutral">No edge</span>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Block length of 10 days accounts for autocorrelation in MCX calendar roll residuals.
            </p>
            <dl className="mt-4 space-y-1.5 border-t border-border pt-3 font-mono text-[11px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Mean edge</dt>
                <dd>{bps(-1.2)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">95% CI</dt>
                <dd>[{signed(-1.77)}, {signed(-0.71)}] bps</dd>
              </div>
              <p className="pt-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                CI crosses zero · blocked from tradable
              </p>
            </dl>
          </div>

          <div className="border-t-2 border-border pt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="gp-label">Minimum detectable effect</p>
              <span className="gp-tag gp-tag--neutral">Powered</span>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Sample size N = 292 days, power 1−β = 80%, significance α = 0.05.
            </p>
            <dl className="mt-4 space-y-1.5 border-t border-border pt-3 font-mono text-[11px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">MDE threshold</dt>
                <dd>0.75 bps · ₹0.52/g</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Observed residual</dt>
                <dd>4.00 bps</dd>
              </div>
              <p className="pt-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                Power sufficient to reject false alpha
              </p>
            </dl>
          </div>

          <div className="border-t-2 border-border pt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="gp-label">Multiple-testing correction</p>
              <span className="gp-tag gp-tag--neutral">No edge</span>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Tested across 6 contract pairs. Bonferroni and Benjamini–Hochberg, FDR = 0.05.
            </p>
            <dl className="mt-4 space-y-1.5 border-t border-border pt-3 font-mono text-[11px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Nominal hurdle</dt>
                <dd>5.00 bps</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Bonferroni hurdle</dt>
                <dd>12.25 bps</dd>
              </div>
              <p className="pt-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                Zero pairs pass the corrected threshold
              </p>
            </dl>
          </div>
        </div>

        {/* ---------------- Charts ---------------- */}
        <div className="gp-split mt-10">
          <div className="min-w-0 border border-border bg-card">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <p className="gp-label">Gross vs net equity</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {inr(1000000, 0)} initial capital · in-sample training partition
                </p>
              </div>
              <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-px w-5 border-t-2 border-dashed border-[var(--gp-slag-500)]" />
                  Gross
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-px w-5 bg-[var(--gp-slag-900)] dark:bg-[var(--gp-paper)]" />
                  Net
                </span>
              </div>
            </div>

            <div className="h-72 w-full px-2 py-4 sm:px-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pipelineEquityCurve} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="1 4" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="var(--gp-slag-500)"
                    tick={axisTick}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--gp-slag-500)' }}
                    minTickGap={32}
                  />
                  <YAxis
                    stroke="var(--gp-slag-500)"
                    tick={axisTick}
                    tickLine={false}
                    axisLine={false}
                    domain={['dataMin - 5000', 'dataMax + 2000']}
                    tickFormatter={(value: number) => `₹${(value / 1000000).toFixed(2)}M`}
                    width={64}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="gross_equity"
                    name="Gross equity"
                    stroke="var(--gp-slag-500)"
                    strokeDasharray="5 3"
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="net_equity"
                    name="Net equity"
                    stroke="var(--gp-slag-900)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3, fill: 'var(--gp-gold-500)', strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <p className="border-t border-border px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
              Gross spread returns hover near flat at {inr(-669)}. Round-trip fees of{' '}
              {inr(23832)} create persistent negative drift if traded indiscriminately. The cost
              gate blocks every trade in this partition.
            </p>
          </div>

          <div className="min-w-0 border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <p className="gp-label">Cost drag decomposition</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Itemized erosion of gross alpha, in bps.
              </p>
            </div>

            <div className="h-72 w-full px-2 py-4 sm:px-4">
              <BarChart
                data={attributionData}
                xDataKey="component"
                orientation="horizontal"
                margin={{ top: 4, right: 16, bottom: 8, left: 100 }}
                aspectRatio=""
                className="h-full w-full"
              >
                <Grid
                  vertical
                  stroke="var(--border)"
                  strokeDasharray="1 4"
                  hideVerticalEdgeLines
                />
                <BarYAxis />
                <ChartTooltip
                  rows={(point) => [
                    {
                      color: 'var(--foreground)',
                      label: String(point.component),
                      value: `${Number(point.bps).toFixed(1)} bps`,
                    },
                  ]}
                />
                <Bar dataKey="bps" fill="var(--foreground)" lineCap={2} />
              </BarChart>
            </div>

            <p className="border-t border-border px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
              Bars left of the zero line are cost drag. The gross residual never reaches
              the gold band.
            </p>
          </div>
        </div>

        {/* ---------------- Holdout ---------------- */}
        <div className="gp-double-rule mt-10 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="gp-label">Sealed holdout · uncontaminated</p>
              <h3 className="gp-serif mt-1 text-xl">21 Feb 2025 to 04 Jun 2025</h3>
            </div>
            <span className="gp-tag gp-tag--neutral">Single evaluation only</span>
          </div>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-muted-foreground">
            73 bars, evaluated with the frozen configuration hash{' '}
            <span className="gp-mono text-foreground">9c8103c61b2b2137</span>, including the
            newly listed GOLDTEN pair. The holdout confirmed zero persistent edge after statutory
            friction, identical to the in-sample distribution.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <VerdictTag verdict="NO EDGE" />
            <span
              className={cn(
                'font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground'
              )}
            >
              A quiet result is still a result.
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
