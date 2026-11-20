'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, ShieldCheck, Sparkles } from 'lucide-react'
import { useLiveFeed } from '@/components/goldprism/LiveFeedProvider'
import { DataTag, Hallmark } from '@/components/goldprism/brand'
import { useMcxMarketWatch } from '@/hooks/use-mcx-market-watch'
import { SupportedContractCode } from '@/lib/goldprism/contract-master'
import { inr } from '@/lib/goldprism/format'
import { cn } from '@/lib/utils'

interface LedgerQuote {
  expiryDate: string
  price: number | null
  detail: string
}

const MONTHS: Record<string, string> = {
  JAN: 'Jan', FEB: 'Feb', MAR: 'Mar', APR: 'Apr', MAY: 'May', JUN: 'Jun',
  JUL: 'Jul', AUG: 'Aug', SEP: 'Sep', OCT: 'Oct', NOV: 'Nov', DEC: 'Dec',
}

/** '04DEC2026' → '04 Dec 26' */
function fmtExpiry(v: string): string {
  const m = /^(\d{1,2})([A-Za-z]{3})(\d{4})$/.exec(v)
  if (m) {
    return `${m[1].padStart(2, '0')} ${MONTHS[m[2].toUpperCase()] ?? m[2]} ${m[3].slice(2)}`
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!iso) return v
  const month = Object.values(MONTHS)[Number(iso[2]) - 1]
  return month ? `${iso[3]} ${month} ${iso[1].slice(2)}` : v
}

export function VaultHero() {
  const { feed, mcxSnapshot, mcxSnapshotError, pricesSource } = useLiveFeed()
  const mcxMarket = useMcxMarketWatch()
  const mcxLive = mcxSnapshot?.status === 'MCX_LIVE'
  const stale = mcxSnapshot?.status === 'MCX_STALE'
  const hasMcxSnapshot = mcxLive || stale
  const parityQuotes =
    feed?.status === 'LIVE_PARITY' && feed.contracts ? feed.contracts : null
  const useParity = !mcxLive && parityQuotes !== null

  const getLedgerQuote = (symbol: SupportedContractCode): LedgerQuote | null => {
    const parityQuote = useParity ? parityQuotes?.[symbol] : null
    if (parityQuote) {
      return {
        expiryDate: parityQuote.expiryDate,
        price: parityQuote.quotedPrice,
        detail: 'indicative parity',
      }
    }

    const row = hasMcxSnapshot ? mcxSnapshot?.contracts?.[symbol]?.[0] : null
    if (!row) return null
    return {
      expiryDate: row.expiryDate,
      price: row.close,
      detail: `${stale ? 'stale · ' : ''}OI ${row.openInterestLots?.toLocaleString('en-IN') ?? '—'} lots`,
    }
  }

  const spotPrice = mcxLive
    ? mcxSnapshot?.spot?.price ?? null
    : useParity
      ? feed?.benchmarks.landedSpotParity10gInr ?? null
      : hasMcxSnapshot
        ? mcxSnapshot?.spot?.price ?? null
        : null
  const spotLabel = useParity ? 'LANDED PARITY · INDIA' : 'GOLD SPOT · Ahmedabad'
  const ledgerSource = mcxLive
    ? 'MCX bhavcopy'
    : useParity
      ? 'XAU/USD + COMEX + USD/INR parity'
      : stale
        ? 'stale MCX bhavcopy reference'
        : 'MCX bhavcopy unavailable'
  const statusDetail = useParity
    ? `indicative · ${feed?.asOf.slice(0, 19).replace('T', ' ')} UTC`
    : hasMcxSnapshot
      ? `${stale ? 'stale · ' : ''}as of ${mcxSnapshot?.bhavcopyDate ?? ''}`
      : 'offline'

  return (
    <section id="home-hero" className="relative overflow-hidden border-b border-border">
      {/* Gold-market backdrop; gradients preserve contrast behind the hero copy. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <img
          src="/gold-market-hero.png"
          alt=""
          className="h-full w-full object-cover object-[72%_50%] opacity-35 dark:opacity-70"
          style={{ filter: 'contrast(1.08) brightness(0.82)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/35 dark:from-[#12100D] dark:via-[#12100D]/66 dark:to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/35 to-background/50 dark:from-[#12100D]/92 dark:via-transparent dark:to-[#12100D]/48" />
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
      <div className="gp-container relative grid items-start gap-8 py-8 sm:py-10 lg:grid-cols-12 lg:gap-12 lg:py-12">
        {/* Left — thesis */}
        <div className="flex flex-col lg:col-span-7 lg:pt-8">
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
          <div className="relative mx-auto w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-[var(--gp-hard-shadow)] sm:p-5 lg:mr-0 lg:max-w-none">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Assay ledger
                </p>
                <p className="mt-1 font-serif text-lg text-foreground">MCX · gold family</p>
              </div>
              <DataTag
                live={useParity}
                detail={statusDetail}
                className={cn(!hasMcxSnapshot && !useParity && 'gp-hatch')}
              />
            </div>
            {mcxSnapshotError ? (
              <p role="status" className="mt-3 text-xs leading-relaxed text-[var(--gp-meta-ink)]">
                MCX snapshot unavailable: {mcxSnapshotError}
              </p>
            ) : null}
            {useParity && stale ? (
              <p role="status" className="mt-3 text-xs leading-relaxed text-[var(--gp-meta-ink)]">
                The MCX snapshot is stale; current contract estimates below use indicative global parity.
              </p>
            ) : null}

            {/* Spot */}
            <div className="mt-3 flex items-end justify-between gap-3 rounded-md border border-border/70 bg-background/60 px-3 py-2.5 sm:px-4">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  {spotLabel}
                </p>
                <p className="mt-1 font-serif text-3xl leading-none text-foreground" style={{ fontVariationSettings: '"SOFT" 30, "opsz" 60' }}>
                  {spotPrice !== null
                    ? inr(spotPrice, 0)
                    : '—'}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">per 10g</p>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">995/999 normalized</p>
              </div>
            </div>

            {/* Contract settles */}
            <dl className="mt-3 divide-y divide-border/70">
              <LedgerLine row={getLedgerQuote('GOLDM')} name="GOLDM" sub="100g · 995" />
              <LedgerLine row={getLedgerQuote('GOLDTEN')} name="GOLDTEN" sub="10g · 999" />
              <LedgerLine row={getLedgerQuote('GOLDGUINEA')} name="GOLDGUINEA" sub="8g · 999" />
              <LedgerLine row={getLedgerQuote('GOLDPETAL')} name="GOLDPETAL" sub="1g · 999" />
            </dl>

            <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2.5">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  Live X-Ray eligibility
                </p>
                <p className="mt-1 text-sm leading-snug text-foreground">
                  {mcxMarket.status === 'available'
                    ? 'BLOCKED · quote time, volume, and open interest are unverified.'
                    : mcxMarket.status === 'loading'
                      ? 'Checking current MCX quote availability…'
                      : 'UNAVAILABLE · no verified live MCX quote.'}
                </p>
              </div>
              {mcxMarket.status === 'available' ? (
                <Hallmark verdict="BLOCKED" size={44} label={false} />
              ) : null}
            </div>

            <p className="mt-3 flex items-center justify-between font-mono text-[8.5px] uppercase tracking-[0.16em] text-muted-foreground/80">
              <span>Source · {ledgerSource}</span>
              <span>paper mark · {pricesSource === 'parity' ? 'indicative parity' : 'offline'}</span>
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
  row: LedgerQuote | null
  name: string
  sub: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground">
          {name}
          <span className="ml-2 font-normal text-[9px] text-muted-foreground">{sub}</span>
        </p>
        <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
          {row ? `expiry ${fmtExpiry(row.expiryDate)} · ${row.detail}` : 'not in the current feed'}
        </p>
      </div>
      <p className="shrink-0 font-mono text-sm font-medium text-foreground">
        {row?.price != null ? inr(row.price, 0) : '—'}
      </p>
    </div>
  )
}
