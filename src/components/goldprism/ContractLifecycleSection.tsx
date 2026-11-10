'use client'

import * as React from 'react'
import {
  Calendar,
  AlertTriangle,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Lock,
  Layers,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ContractLifecycle {
  symbol: string;
  tradingUnit: string;
  purity: string;
  listingCycle: string;
  deliveryWindow: string;
  expiryDay: string;
  tenderPeriod: string;
  liquidityPeak: string;
  status: 'ACTIVE' | 'EARLY_EXPIRY_WARNING' | 'NEW_LISTING';
  warningMessage?: string;
}

export function ContractLifecycleSection() {
  const contracts: ContractLifecycle[] = [
    {
      symbol: 'GOLDM',
      tradingUnit: '100g (Quote: 10g)',
      purity: '995 (0.995 fine)',
      listingCycle: 'Bi-monthly (Feb, Apr, Jun, Aug, Oct, Dec)',
      deliveryWindow: '1st to 5th of Expiry Month',
      expiryDay: '5th of Expiry Month (Early Window)',
      tenderPeriod: 'Last 5 trading days prior to expiry',
      liquidityPeak: 'T-45 to T-10 days before expiry',
      status: 'EARLY_EXPIRY_WARNING',
      warningMessage: 'Early delivery window (3rd–5th)! Inaction rule: Automated roll mandatory by T-5 to prevent physical delivery tender exposure.',
    },
    {
      symbol: 'GOLDTEN',
      tradingUnit: '10g (Quote: 10g)',
      purity: '999 (0.999 fine)',
      listingCycle: 'Monthly (Listed Jan 2025 onwards)',
      deliveryWindow: '25th to month-end',
      expiryDay: 'Month-End (27th–31st)',
      tenderPeriod: 'Last 5 trading days of the month',
      liquidityPeak: 'T-30 to T-5 days',
      status: 'NEW_LISTING',
      warningMessage: 'Recent listing (Jan 2025 onwards). Flagged in all backtests for truncated pre-2025 history.',
    },
    {
      symbol: 'GOLDGUINEA',
      tradingUnit: '8g (Quote: 8g)',
      purity: '999 (0.999 fine)',
      listingCycle: 'Monthly',
      deliveryWindow: '25th to month-end',
      expiryDay: 'Month-End (27th–31st)',
      tenderPeriod: 'Last 5 trading days of the month',
      liquidityPeak: 'T-25 to T-7 days',
      status: 'ACTIVE',
    },
    {
      symbol: 'GOLDPETAL',
      tradingUnit: '1g (Quote: 1g)',
      purity: '999 (0.999 fine)',
      listingCycle: 'Monthly',
      deliveryWindow: 'Cash settled / Compulsory Delivery per MCX circular',
      expiryDay: 'Month-End (27th–31st)',
      tenderPeriod: 'Last 5 trading days of the month',
      liquidityPeak: 'T-20 to T-3 days',
      status: 'ACTIVE',
    },
  ]

  return (
<<<<<<< Updated upstream
    <section id="contract-lifecycle" className="py-12 scroll-mt-16 border-b border-border/40">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <Badge variant="outline" className="mb-2 gap-1.5 border-amber-500/40 text-amber-300">
              <Calendar className="w-3 h-3 text-amber-400" /> Phase E: Contract Lifecycle &amp; Delivery Calendar
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Contract Lifecycle, Expiry &amp; Delivery Guard
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Automated delivery window validation: strictly blocks new spread positions inside physical tender periods.
=======
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
>>>>>>> Stashed changes
            </p>
          </div>

          <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/30 text-xs font-mono">
            <ShieldAlert className="w-3 h-3 mr-1" /> PHYSICAL TENDER LOCK ACTIVE
          </Badge>
        </div>

        {/* Contract Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          {contracts.map((c) => (
            <Card key={c.symbol} className="p-5 bg-card/60 border-border/80 relative overflow-hidden">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black font-mono tracking-tight text-foreground">{c.symbol}</span>
                    <Badge variant="outline" className="text-[11px] font-mono border-border/60">
                      {c.purity}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{c.tradingUnit}</div>
                </div>

                {c.status === 'EARLY_EXPIRY_WARNING' && (
                  <Badge className="bg-amber-500/10 text-amber-300 border-amber-500/30 text-[11px] gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-400" /> Early Expiry (3rd-5th)
                  </Badge>
                )}
                {c.status === 'NEW_LISTING' && (
                  <Badge className="bg-blue-500/10 text-blue-300 border-blue-500/30 text-[11px] gap-1">
                    <Clock className="w-3 h-3 text-blue-400" /> Listed Jan 2025
                  </Badge>
                )}
                {c.status === 'ACTIVE' && (
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[11px] gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Standard Cycle
                  </Badge>
                )}
              </div>

              {/* Lifecycle Details */}
              <div className="grid grid-cols-2 gap-2.5 text-xs mt-3 pt-3 border-t border-border/50">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Listing Cycle:</span>
                  <span className="font-medium text-foreground">{c.listingCycle}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Expiry Window:</span>
                  <span className="font-medium text-foreground">{c.expiryDay}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Tender / Delivery:</span>
                  <span className="font-medium text-foreground">{c.deliveryWindow}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Liquidity Peak:</span>
                  <span className="font-medium text-foreground">{c.liquidityPeak}</span>
                </div>
              </div>

              {c.warningMessage && (
                <div className="mt-3.5 p-2.5 rounded bg-muted/40 border border-border/60 text-[11px] text-muted-foreground flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>{c.warningMessage}</span>
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Validation Rule Demonstration */}
        <Card className="p-4 bg-muted/20 border-border/70 text-xs">
          <div className="flex items-center gap-2 mb-2 font-bold text-foreground">
            <Lock className="w-4 h-4 text-emerald-400" /> Strict Enforcement Rules for Quantitative Entries
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-muted-foreground text-[11px]">
            <div className="p-2 rounded bg-background/50 border border-border/50">
              <span className="text-foreground font-semibold block mb-1">1. Delivery Window Lockout</span>
              Zero orders are routed if current date falls within 5 business days of contract expiry. Prevents physical vault delivery penalties.
            </div>
            <div className="p-2 rounded bg-background/50 border border-border/50">
              <span className="text-foreground font-semibold block mb-1">2. Staggered Roll Logic</span>
              GOLDM (early 5th expiry) pairs against month-end contracts require an asymmetric carry formula that adjusts for the 22-26 day gap.
            </div>
            <div className="p-2 rounded bg-background/50 border border-border/50">
              <span className="text-foreground font-semibold block mb-1">3. Liquidity Cutoff</span>
              Contracts with open interest &lt; 500 lots or daily volume &lt; 100 lots are automatically marked BLOCKED regardless of net edge.
            </div>
          </div>
        </Card>
      </div>
    </section>
  )
}
