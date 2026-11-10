'use client'

import * as React from 'react'
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  BookOpen,
  Scale,
  Hash,
  Database,
  ExternalLink,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function DataAuditMethodologySection() {
  return (
<<<<<<< Updated upstream
    <section id="methodology-audit" className="py-12 scroll-mt-16 border-b border-border/40">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <Badge variant="outline" className="mb-2 gap-1.5 border-amber-500/40 text-amber-300">
              <Scale className="w-3 h-3 text-amber-400" /> Phase G: Data Audit &amp; Methodology
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Data Audit, Discrepancy Resolution &amp; Quant Methodology
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Transparent, unvarnished documentation of statutory cost schedules, known data gaps, and contract specification resolutions.
=======
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

          <div className="gp-split--tight grid p-5">
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
>>>>>>> Stashed changes
            </p>
          </div>

          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs font-mono">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> AUDIT VERIFIED: METHODOLOGY v1.0
          </Badge>
        </div>

        {/* 1. The GOLDGUINEA Purity Resolution Highlight */}
        <Card className="p-5 bg-card/60 border-amber-500/30 mb-8 relative overflow-hidden">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0 mt-0.5">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-foreground text-sm">
                  Case Study: GOLDGUINEA Purity Discrepancy Resolution (996 vs 999)
                </h3>
                <Badge className="bg-amber-500/10 text-amber-300 border-amber-500/30 text-[10px]">
                  Resolved &amp; Verified
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Earlier test drafts and unofficial third-party data tables listed <code>GOLDGUINEA</code> (8g trading unit) as having <strong>996 purity</strong>.
                During Team ARCEUS&apos;s data audit of official MCX circulars (Circular <em>MCX/C&amp;S/412/2021</em> and Contract Specifications Master), it was definitively confirmed that MCX Gold Guinea contracts deliver bars of <strong>999 purity (0.999 fine purity)</strong>.
              </p>
              <div className="mt-3 p-3 rounded bg-muted/30 border border-border/50 text-[11px] grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground font-semibold">Impact on Normalization:</span>
                  <span className="text-foreground ml-1">
                    If treated as 996, the purity ratio (996/999 = 0.996997) falsely penalizes GOLDGUINEA by ~30.0 bps, creating a phantom arbitrage spread that does not exist in delivery!
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground font-semibold">Audit Resolution:</span>
                  <span className="text-emerald-400 ml-1">
                    GoldPrism Contract Master hardcodes 999 fine purity with a verified timestamp and regression test in <code>tests/goldprism.test.ts</code>.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* 2. Methodology & Cost Schedules */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="p-5 bg-card/60 border-border/80">
            <h3 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-400" /> Core Methodology &amp; Assumptions
            </h3>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span>
                  <strong>Delta-Neutral Spread:</strong> Strategy isolates pure spread alpha (S_next - S_near); macro gold directional beta is hedged to 0.0.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span>
                  <strong>Strict Execution Lag ($t \rightarrow t+1$):</strong> Signals generated at market close bar $t$ are filled at open/settle of bar $t+1$. Anti-lookahead guard prevents same-bar peeking.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span>
                  <strong>Financing Repo Rate:</strong> Configured to Reserve Bank of India (RBI) policy repo rate of <strong>6.50%</strong> (ACT/365 convention).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span>
                  <strong>Sealed Holdout Partition:</strong> 20% of sample is frozen and evaluated only once with hash verification, preventing overfitting.
                </span>
              </li>
            </ul>
          </Card>

          <Card className="p-5 bg-card/60 border-border/80">
            <h3 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
              <Scale className="w-4 h-4 text-rose-400" /> Statutory Fee Schedule &amp; Cost Model
            </h3>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between border-b border-border/40 pb-1.5">
                <span>Brokerage (Discount/Institutional):</span>
                <span className="font-mono text-foreground font-semibold">₹30.0 / lot / side</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-1.5">
                <span>Commodity Transaction Tax (CTT):</span>
                <span className="font-mono text-foreground font-semibold">0.01% (Sell-side only)</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-1.5">
                <span>Exchange Turnover Charges (MCX):</span>
                <span className="font-mono text-foreground font-semibold">0.0026% (Turnover)</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-1.5">
                <span>Goods &amp; Services Tax (GST):</span>
                <span className="font-mono text-foreground font-semibold">18.0% on Brokerage &amp; Fees</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-1.5">
                <span>Stamp Duty (Indian Stamp Act):</span>
                <span className="font-mono text-foreground font-semibold">0.002% (Buy-side only)</span>
              </div>
              <div className="flex justify-between pt-0.5">
                <span>Settle-to-Executable Haircut:</span>
                <span className="font-mono text-foreground font-semibold">1.5 bps (Non-guaranteed fill)</span>
              </div>
            </div>
          </Card>
        </div>

        {/* 3. Known Limitations & Gaps (Honesty Over Polish) */}
        <Card className="p-5 bg-card/60 border-border/80">
          <h3 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400" /> Explicit Limitations &amp; Known Gaps
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-muted-foreground">
            <div className="p-3 rounded bg-muted/20 border border-border/50">
              <strong className="text-foreground block mb-1">1. Volume $\neq$ Orderbook Depth</strong>
              Daily traded volume indicates past activity, but not real-time bid-ask liquidity or executable top-of-book depth.
            </div>
            <div className="p-3 rounded bg-muted/20 border border-border/50">
              <strong className="text-foreground block mb-1">2. GOLDTEN Truncated History</strong>
              GOLDTEN was introduced on MCX in early 2025. Pre-2025 cross-spread historical backtests are mathematically restricted to GOLDM, GOLDGUINEA, and GOLDPETAL.
            </div>
            <div className="p-3 rounded bg-muted/20 border border-border/50">
              <strong className="text-foreground block mb-1">3. Cloud Network Bot Restriction</strong>
              MCX India web servers block automated cloud IP scraping with HTTP 403 (Akamai). Local deployments utilize verified cached Bhavcopies.
            </div>
          </div>
        </Card>
      </div>
    </section>
  )
}
