'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, ShieldCheck, Sparkles } from 'lucide-react'
import { useLiveFeed } from '@/components/goldprism/LiveFeedProvider'
import { DataTag, Hallmark } from '@/components/goldprism/brand'
import { inr } from '@/lib/goldprism/format'
import { cn } from '@/lib/utils'

const MONTHS: Record<string, string> = {
  JAN: 'Jan', FEB: 'Feb', MAR: 'Mar', APR: 'Apr', MAY: 'May', JUN: 'Jun',
  JUL: 'Jul', AUG: 'Aug', SEP: 'Sep', OCT: 'Oct', NOV: 'Nov', DEC: 'Dec',
}

/** '04DEC2026' → '04 Dec 26' */
function fmtExpiry(v: string): string {
  const m = /^(\d{1,2})([A-Za-z]{3})(\d{4})$/.exec(v)
  if (!m) return v
  return `${m[1].padStart(2, '0')} ${MONTHS[m[2].toUpperCase()] ?? m[2]} ${m[3].slice(2)}`
}

export function VaultHero() {
  const { mcxSnapshot, pricesSource } = useLiveFeed()
  const live = mcxSnapshot?.status === 'MCX_LIVE'
  const stale = mcxSnapshot?.status === 'MCX_STALE'
  const usable = live || stale
  const spot = usable ? mcxSnapshot?.spot : null
  const goldm = usable ? mcxSnapshot?.contracts?.GOLDM?.[0] ?? null : null
  const goldten = usable ? mcxSnapshot?.contracts?.GOLDTEN?.[0] ?? null : null
  const guinea = usable ? mcxSnapshot?.contracts?.GOLDGUINEA?.[0] ?? null : null
  const petal = usable ? mcxSnapshot?.contracts?.GOLDPETAL?.[0] ?? null : null

  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* Vault glow — dark mode only: cinematic pyramid/candle backdrop + single restrained caramel radial */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden dark:block">
        <img
          src="/hero-vault.png"
          alt=""
          className="h-full w-full object-[88%_40%] opacity-90"
          style={{ filter: 'contrast(1.08) brightness(1.06)' }}
        />
        {/* Readability gradients: keep the left type lane near-solid, let the art breathe right */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#12100D] via-[#12100D]/66 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#12100D]/92 via-transparent to-[#12100D]/48" />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-48 h-[36rem] w-[36rem] rounded-full opacity-70"
        style={{
          background:
            'radial-gradient(closest-side, var(--gp-caramel) 0%, transparent 100%)',
          filter: 'blur(120px)',
          opacity: 0.16,
        }}
      />
      <div className="gp-container relative grid gap-10 py-14 lg:grid-cols-12 lg:gap-12 lg:py-20">
        {/* Left — thesis */}
        <div className="flex flex-col justify-center lg:col-span-7">
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-[var(--gp-caramel)]" aria-hidden="true" />
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              MCX Gold · Commodity Derivatives Intelligence
            </p>
          </div>

          <h1
            className="mt-5 text-balance font-serif text-[2.6rem] font-medium leading-[1.02] tracking-[-0.015em] text-foreground sm:text-6xl xl:text-[4.2rem]"
            style={{ fontVariationSettings: '"SOFT" 40, "opsz" 100' }}
          >
            Every rupee of the
            <br />
            spread, <span className="gp-foil-text font-normal italic">named.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            GoldPrism opens each MCX gold spread into purity basis, expiry carry and
            settlement artifact — then charges the full, statutory cost of trading it.
            If nothing survives, the terminal says{' '}
            <span className="font-medium text-foreground">NO&nbsp;EDGE</span> — plainly.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/xray"
              className="group inline-flex h-12 items-center gap-2 rounded-md bg-[var(--gp-slag-900)] px-6 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--gp-paper)] transition-colors hover:bg-[var(--gp-caramel)] hover:text-[#141010] dark:bg-[var(--gp-caramel)] dark:text-[#141010] dark:hover:bg-[#e8bd8a]"
            >
              Open the X-Ray
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
            </Link>
            <Link
              href="/replay"
              className="inline-flex h-12 items-center gap-2 rounded-md border border-border px-6 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground transition-colors hover:border-[var(--gp-caramel)] hover:text-[var(--gp-caramel)]"
            >
              Replay a day
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <dl className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[var(--gp-tradable-ink)]" aria-hidden="true" />Real MCX bhavcopy</span>
            <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-[var(--gp-caramel)]" aria-hidden="true" />18-month calibration</span>
            <span>config 9c8103c61b2b2137</span>
            <span>holdout sealed</span>
          </dl>
        </div>

        {/* Right — live assay ledger (real numbers when snapshot available) */}
        <div className="lg:col-span-5">
          <div className="relative mx-auto w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-[var(--gp-hard-shadow)] lg:mr-0 lg:max-w-none">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Assay ledger
                </p>
                <p className="mt-1 font-serif text-lg text-foreground">MCX · gold family</p>
              </div>
              <DataTag
                detail={
                  usable
                    ? `${stale ? 'stale · ' : ''}as of ${mcxSnapshot?.bhavcopyDate ?? ''}`
                    : 'offline'
                }
                className={cn(!usable && 'gp-hatch')}
              />
            </div>

            {/* Spot */}
            <div className="mt-4 flex items-end justify-between gap-4 rounded-md border border-border/70 bg-background/60 px-4 py-3">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  GOLD spot · Ahmedabad
                </p>
                <p className="mt-1 font-serif text-3xl leading-none text-foreground" style={{ fontVariationSettings: '"SOFT" 30, "opsz" 60' }}>
                  {spot ? `₹${Number(spot.price).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">per 10g</p>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">995/999 normalized</p>
              </div>
            </div>

            {/* Contract settles */}
            <dl className="mt-4 divide-y divide-border/70">
              <LedgerLine row={goldm} name="GOLDM" sub="100g · 995" />
              <LedgerLine row={goldten} name="GOLDTEN" sub="10g · 999" />
              <LedgerLine row={guinea} name="GOLDGUINEA" sub="8g · 999" />
              <LedgerLine row={petal} name="GOLDPETAL" sub="1g · 999" />
            </dl>

            {/* Example verdict — explicitly fixture */}
            <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-border/70 px-4 py-3">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  Verdict · 20 Mar 2026 (fixture)
                </p>
                <p className="mt-1 text-sm leading-snug text-foreground">
                  Residual <span className="font-mono">+1.8 bps</span> — costs ate every day of it.
                </p>
              </div>
              <Hallmark verdict="NO EDGE" size={44} label={false} />
            </div>

            <p className="mt-3 flex items-center justify-between font-mono text-[8.5px] uppercase tracking-[0.16em] text-muted-foreground/80">
              <span>Source · MCX bhavcopy via mcx_data</span>
              <span>pricesSource · {pricesSource === 'mcx_bhavcopy' ? 'MCX settle' : pricesSource === 'parity' ? 'parity model' : 'offline'}</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function LedgerLine({
  row,
  name,
  sub,
}: {
  row: { expiryDate: string; close: number | null; openInterestLots: number | null; volumeLots: number | null } | null
  name: string
  sub: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground">
          {name}
          <span className="ml-2 font-normal text-[9px] text-muted-foreground">{sub}</span>
        </p>
        <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
          {row ? `expiry ${fmtExpiry(row.expiryDate)} · OI ${row.openInterestLots?.toLocaleString('en-IN') ?? '—'} lots` : 'not in today’s file'}
        </p>
      </div>
      <p className="shrink-0 font-mono text-sm font-medium text-foreground">
        {row?.close != null ? inr(row.close, 0) : '—'}
      </p>
    </div>
  )
}
