'use client'

import * as React from 'react'
import { SectionHead } from '@/components/goldprism/brand'
import { cn } from '@/lib/utils'

interface ContractLifecycle {
  symbol: string
  tradingUnit: string
  purity: string
  listingCycle: string
  deliveryWindow: string
  expiryDay: string
  tenderPeriod: string
  liquidityPeak: string
  status: 'ACTIVE' | 'EARLY_EXPIRY_WARNING' | 'NEW_LISTING'
  warningMessage?: string
}

const CONTRACTS: ContractLifecycle[] = [
  {
    symbol: 'GOLDM',
    tradingUnit: '100g · quote 10g',
    purity: '995 · 0.995 fine',
    listingCycle: 'Bi-monthly · Feb, Apr, Jun, Aug, Oct, Dec',
    deliveryWindow: '1st to 5th of expiry month',
    expiryDay: '5th of expiry month · early window',
    tenderPeriod: 'Last 5 trading days prior to expiry',
    liquidityPeak: 'T−45 to T−10 days before expiry',
    status: 'EARLY_EXPIRY_WARNING',
    warningMessage:
      'Early delivery window, 3rd to 5th. Automated roll is mandatory by T−5 to prevent physical delivery tender exposure.',
  },
  {
    symbol: 'GOLDTEN',
    tradingUnit: '10g · quote 10g',
    purity: '999 · 0.999 fine',
    listingCycle: 'Monthly · listed Jan 2025 onwards',
    deliveryWindow: '25th to month-end',
    expiryDay: 'Month-end · 27th to 31st',
    tenderPeriod: 'Last 5 trading days of the month',
    liquidityPeak: 'T−30 to T−5 days',
    status: 'NEW_LISTING',
    warningMessage:
      'Recent listing, Jan 2025 onwards. Flagged in all backtests for truncated pre-2025 history.',
  },
  {
    symbol: 'GOLDGUINEA',
    tradingUnit: '8g · quote 8g',
    purity: '999 · 0.999 fine',
    listingCycle: 'Monthly',
    deliveryWindow: '25th to month-end',
    expiryDay: 'Month-end · 27th to 31st',
    tenderPeriod: 'Last 5 trading days of the month',
    liquidityPeak: 'T−25 to T−7 days',
    status: 'ACTIVE',
  },
  {
    symbol: 'GOLDPETAL',
    tradingUnit: '1g · quote 1g',
    purity: '999 · 0.999 fine',
    listingCycle: 'Monthly',
    deliveryWindow: 'Cash settled · compulsory delivery per MCX circular',
    expiryDay: 'Month-end · 27th to 31st',
    tenderPeriod: 'Last 5 trading days of the month',
    liquidityPeak: 'T−20 to T−3 days',
    status: 'ACTIVE',
  },
]

const STATUS: Record<
  ContractLifecycle['status'],
  { label: string; tone: string }
> = {
  EARLY_EXPIRY_WARNING: { label: 'Early expiry · 3rd–5th', tone: 'gp-tag--watch' },
  NEW_LISTING: { label: 'Listed Jan 2025', tone: 'gp-tag--neutral' },
  ACTIVE: { label: 'Standard cycle', tone: 'gp-tag--neutral' },
}

const RULES = [
  {
    title: 'Delivery window lockout',
    body: 'Zero orders are routed if the current date falls within five business days of contract expiry. This prevents physical vault delivery penalties.',
  },
  {
    title: 'Staggered roll logic',
    body: 'GOLDM, with its early 5th expiry, pairs against month-end contracts through an asymmetric carry formula that adjusts for the 22–26 day gap.',
  },
  {
    title: 'Liquidity cutoff',
    body: 'Contracts with open interest below 500 lots or daily volume below 100 lots are marked blocked regardless of net edge.',
  },
]

export function ContractLifecycleSection() {
  return (
    <section
      id="contract-lifecycle"
      className="scroll-mt-16 border-b border-border bg-background"
    >
      <div className="gp-container py-[var(--gp-space-5)] md:py-[var(--gp-space-6)]">
        <SectionHead
          index="02.5"
          eyebrow="Market structure · Lifecycle"
          title="Know when you must be out."
          description="Every contract carries a delivery window, a tender period and a liquidity peak. The guard blocks new spread positions inside physical tender periods."
          aside={
            <div className="flex flex-col items-start gap-2 lg:items-end">
              <span className="gp-tag gp-tag--watch">Physical tender lock active</span>
              <p className="max-w-[18rem] text-right font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-muted-foreground">
                One missed roll is a delivery, not a trade.
              </p>
            </div>
          }
        />

        {/* ---------------- Contract cards ---------------- */}
        <div className="mt-10 grid gap-px border border-border bg-border md:grid-cols-2">
          {CONTRACTS.map((contract) => {
            const status = STATUS[contract.status]
            return (
              <article key={contract.symbol} className="flex flex-col bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="gp-serif text-2xl">{contract.symbol}</h3>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {contract.tradingUnit} · {contract.purity}
                    </p>
                  </div>
                  <span className={cn('gp-tag', status.tone)}>{status.label}</span>
                </div>

                <dl className="mt-5 grid gap-x-6 gap-y-4 border-t border-border pt-4 sm:grid-cols-2">
                  <div>
                    <dt className="gp-label">Listing cycle</dt>
                    <dd className="mt-1.5 text-[12px] leading-relaxed text-foreground">
                      {contract.listingCycle}
                    </dd>
                  </div>
                  <div>
                    <dt className="gp-label">Expiry window</dt>
                    <dd className="mt-1.5 text-[12px] leading-relaxed text-foreground">
                      {contract.expiryDay}
                    </dd>
                  </div>
                  <div>
                    <dt className="gp-label">Tender / delivery</dt>
                    <dd className="mt-1.5 text-[12px] leading-relaxed text-foreground">
                      {contract.deliveryWindow}
                    </dd>
                  </div>
                  <div>
                    <dt className="gp-label">Liquidity peak</dt>
                    <dd className="mt-1.5 text-[12px] leading-relaxed text-foreground">
                      {contract.liquidityPeak}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="gp-label">Tender period</dt>
                    <dd className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                      {contract.tenderPeriod}
                    </dd>
                  </div>
                </dl>

                {contract.warningMessage ? (
                  <div
                    className={cn(
                      'mt-5 border-l-2 pl-3',
                      contract.status === 'EARLY_EXPIRY_WARNING'
                        ? 'border-[var(--gp-watch-ink)]'
                        : 'border-border'
                    )}
                  >
                    <p className="gp-label">
                      {contract.status === 'EARLY_EXPIRY_WARNING'
                        ? 'Roll warning'
                        : 'History note'}
                    </p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                      {contract.warningMessage}
                    </p>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>

        {/* ---------------- Enforcement ---------------- */}
        <div className="mt-10 border border-border">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <p className="gp-label">Strict enforcement rules for quantitative entries</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Applied before signal evaluation
            </p>
          </div>
          <ol className="grid gap-px bg-border md:grid-cols-3">
            {RULES.map((rule, i) => (
              <li key={rule.title} className="bg-card p-4">
                <div className="flex items-baseline gap-2">
                  <span className="gp-figure text-lg text-muted-foreground">{i + 1}</span>
                  <h4 className="text-sm font-medium text-foreground">{rule.title}</h4>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  {rule.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
