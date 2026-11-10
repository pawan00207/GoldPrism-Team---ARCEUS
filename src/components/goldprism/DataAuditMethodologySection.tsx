'use client'

import * as React from 'react'
import { SectionHead, SpectralRule } from '@/components/goldprism/brand'

const METHOD = [
  {
    title: 'Delta-neutral spread',
    body: 'The strategy isolates pure spread alpha between S_next and S_near. Macro gold directional beta is hedged to 0.0.',
  },
  {
    title: 'Strict execution lag t → t+1',
    body: 'Signals generated at the close of bar t are filled at the open or settle of bar t+1. The anti-lookahead guard prevents same-bar peeking.',
  },
  {
    title: 'Financing repo rate',
    body: 'Configured to the Reserve Bank of India policy repo rate of 6.50%, ACT/365 convention.',
  },
  {
    title: 'Sealed holdout partition',
    body: '20% of the sample is frozen and evaluated once with hash verification, preventing overfitting.',
  },
]

const FEES = [
  { label: 'Brokerage · discount or institutional', value: '₹30.0 / lot / side' },
  { label: 'Commodity transaction tax · CTT', value: '0.01% · sell side only' },
  { label: 'Exchange turnover charge · MCX', value: '0.0026% of turnover' },
  { label: 'Goods and services tax · GST', value: '18.0% on brokerage and fees' },
  { label: 'Stamp duty · Indian Stamp Act', value: '0.002% · buy side only' },
  { label: 'Settle-to-executable haircut', value: '1.5 bps · non-guaranteed fill' },
]

const LIMITS = [
  {
    title: 'Volume is not order-book depth',
    body: 'Daily traded volume indicates past activity, not real-time bid-ask liquidity or executable top-of-book depth.',
  },
  {
    title: 'GOLDTEN has truncated history',
    body: 'GOLDTEN was introduced on MCX in early 2025. Pre-2025 cross-spread backtests are restricted to GOLDM, GOLDGUINEA and GOLDPETAL.',
  },
  {
    title: 'Cloud network bot restriction',
    body: 'MCX India web servers block automated cloud-IP scraping with HTTP 403. Local deployments use verified cached bhavcopies.',
  },
]

export function DataAuditMethodologySection() {
  return (
    <section
      id="methodology-audit"
      className="scroll-mt-16 border-b border-border bg-background"
    >
      <div className="gp-container py-[var(--gp-space-5)] md:py-[var(--gp-space-6)]">
        <SectionHead
          index="03.1"
          eyebrow="Audit trail · Methodology"
          title="Show the work. Even the gaps."
          description="Statutory cost schedules, known data gaps and contract-specification resolutions are documented in the open. A method you cannot inspect is not a method."
          aside={<span className="gp-tag gp-tag--neutral">Methodology v1.0</span>}
        />

        {/* ---------------- Case study ---------------- */}
        <div className="mt-10 border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <p className="gp-label">Case study · GOLDGUINEA purity</p>
            <span className="gp-tag gp-tag--tradable">Resolved &amp; verified</span>
          </div>

          <div className="gp-split--tight p-5">
            <div>
              <h3 className="gp-serif text-2xl">996 or 999?</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Earlier test drafts and unofficial third-party tables listed GOLDGUINEA, an 8 g
                trading unit, as having 996 purity. An audit of official MCX circulars
                <span className="gp-mono text-foreground"> MCX/C&amp;S/412/2021 </span>
                and the Contract Specifications Master confirms that Gold Guinea delivers bars of
                999 purity, 0.999 fine.
              </p>

              <div className="mt-5 border-l-2 border-[var(--gp-gold-500)] pl-4">
                <p className="gp-label">Impact if left at 996</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  The purity ratio 996/999 = 0.996997 falsely penalizes GOLDGUINEA by roughly 30.0
                  bps, creating a phantom arbitrage spread that does not exist in delivery.
                </p>
              </div>
            </div>

            <dl className="grid gap-px self-start border border-border bg-border">
              <div className="bg-card p-4">
                <dt className="gp-label">Official purity</dt>
                <dd className="mt-2 font-mono text-lg text-foreground">999 fine · 24 carat</dd>
              </div>
              <div className="bg-card p-4">
                <dt className="gp-label">Trading unit</dt>
                <dd className="mt-2 font-mono text-lg text-foreground">8 g · 1 guinea lot</dd>
              </div>
              <div className="bg-card p-4">
                <dt className="gp-label">Audit resolution</dt>
                <dd className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                  The contract master hardcodes 999 fine purity with a verified timestamp and a
                  regression test in{' '}
                  <span className="gp-mono text-foreground">tests/goldprism.test.ts</span>.
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* ---------------- Method + fees ---------------- */}
        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <div className="min-w-0">
            <div className="border-b border-border pb-3">
              <p className="gp-label">Core methodology &amp; assumptions</p>
            </div>
            <ol className="mt-4 space-y-4">
              {METHOD.map((item, i) => (
                <li key={item.title} className="flex gap-4">
                  <span className="gp-figure mt-0.5 w-6 shrink-0 text-sm text-muted-foreground">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h4 className="text-sm font-medium text-foreground">{item.title}</h4>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                      {item.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="min-w-0">
            <div className="border-b border-border pb-3">
              <p className="gp-label">Statutory fee schedule &amp; cost model</p>
            </div>
            <dl className="mt-2">
              {FEES.map((fee) => (
                <div
                  key={fee.label}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border py-3"
                >
                  <dt className="text-[12px] text-muted-foreground">{fee.label}</dt>
                  <dd className="gp-figure text-[12px] text-foreground">{fee.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-muted-foreground">
              Fee schedule is applied on both legs before the residual is judged.
            </p>
          </div>
        </div>

        {/* ---------------- Limitations ---------------- */}
        <div className="mt-10 border border-border">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <p className="gp-label">Explicit limitations &amp; known gaps</p>
            <span className="gp-tag gp-tag--neutral">Honesty over polish</span>
          </div>
          <div className="grid gap-px bg-border md:grid-cols-3">
            {LIMITS.map((limit, i) => (
              <div key={limit.title} className="bg-card p-4">
                <div className="flex items-baseline gap-2">
                  <span className="gp-figure text-lg text-muted-foreground">{i + 1}</span>
                  <h4 className="text-sm font-medium leading-tight text-foreground">
                    {limit.title}
                  </h4>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  {limit.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        <SpectralRule className="mt-10" />
      </div>
    </section>
  )
}
