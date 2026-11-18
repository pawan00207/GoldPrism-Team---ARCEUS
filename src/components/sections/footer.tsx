'use client'

import * as React from 'react'
import Link from 'next/link'
import { Github } from 'lucide-react'
import { BrandMark } from '@/components/goldprism/brand'
import { useLiveFeed } from '@/components/goldprism/LiveFeedProvider'
import { cn } from '@/lib/utils'

const COLUMNS: Array<{ kicker: string; links: Array<{ href: string; label: string }> }> = [
  {
    kicker: 'Terminal',
    links: [
      { href: '/dashboard', label: 'Command dashboard' },
      { href: '/xray', label: 'X-Ray waterfall' },
      { href: '/normalization', label: 'Normalization lab' },
      { href: '/replay', label: 'Point-in-time replay' },
      { href: '/analyst', label: 'Research analyst' },
      { href: '/trade', label: '1-Click trade desk' },
    ],
  },
  {
    kicker: 'Evidence',
    links: [
      { href: '/research#data-health', label: 'Data health & ingestion' },
      { href: '/research#contract-master', label: 'MCX contract master' },
      { href: '/research#best-vehicle', label: 'Best-vehicle ranking' },
      { href: '/research#term-structure', label: 'Term structure & carry' },
      { href: '/research#backtest-lab', label: 'Backtest lab' },
      { href: '/methodology#reports', label: 'Audit reports' },
    ],
  },
  {
    kicker: 'Fine print',
    links: [
      { href: '/methodology', label: 'Methodology' },
      { href: '/workspace', label: 'Alpha zoo & workspace' },
      { href: '/xray', label: 'Reading the verdict' },
      { href: 'https://github.com/pawan00207/GoldPrism-Team---ARCEUS', label: 'Source · MIT' },
    ],
  },
]

export function Footer() {
  const { mcxSnapshot, feed } = useLiveFeed()
  const mcxDate = mcxSnapshot?.status !== 'UNAVAILABLE' ? mcxSnapshot?.bhavcopyDate : null
  const snapshotLine = mcxDate
    ? `Real MCX bhavcopy · ${mcxDate}`
    : feed?.status === 'LIVE_PARITY'
      ? `Live parity model · ${feed.asOf.slice(0, 10)}`
      : 'MCX 18-month archive active'

  return (
    <footer className="mt-auto border-t border-border bg-background">
      {/* Vault band */}
      <div className="border-b border-border/70 bg-[var(--gp-vellum)]/50 dark:bg-[#1a1512]">
        <div className="mx-auto grid max-w-[1360px] grid-cols-2 gap-px sm:grid-cols-4">
          <VaultFact num="391" label="calibrated days" note="2024-01-01 → 2025-06-30" />
          <VaultFact num="2,843" label="rows audited" note="hash c3d1…f60082" />
          <VaultFact num="4" label="contracts, one scale" note="GOLDM · GOLDTEN · GOLDGUINEA · GOLDPETAL" />
          <VaultFact num="0" label="TRADABLE days" note="the gate refuses — honestly" emphasis />
        </div>
      </div>

      <div className="mx-auto max-w-[1360px] px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <Link href="/" className="flex items-center gap-3" aria-label="GoldPrism home">
              <BrandMark className="h-9 w-9" />
              <span
                className="font-serif text-2xl font-medium tracking-[-0.01em] text-foreground"
                style={{ fontVariationSettings: '"SOFT" 50, "opsz" 40' }}
              >
                Gold<span className="gp-foil-text font-normal italic">Prism</span>
              </span>
            </Link>
            <p className="mt-4 max-w-sm font-serif text-lg leading-snug text-foreground">
              The terminal that refuses to lie about gold.
            </p>
            <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              Every spread is decomposed into structural basis, expiry carry and settlement
              artifact — then charged the full cost of trading it. If nothing survives, the
              screen says <span className="font-medium text-foreground">NO EDGE</span>.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    mcxDate ? 'bg-[var(--gp-tradable-ink)]' : 'bg-[var(--gp-meta-ink)]'
                  )}
                  aria-hidden="true"
                />
                {snapshotLine}
              </span>
              <a
                href="https://github.com/pawan00207/GoldPrism-Team---ARCEUS"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-[var(--gp-caramel)] hover:text-foreground"
                aria-label="GitHub source"
              >
                <Github className="h-4 w-4" />
              </a>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.kicker} className="md:col-span-2 last:md:col-span-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {col.kicker}
              </p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-[13px] text-muted-foreground transition-colors hover:text-[var(--gp-caramel)]"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border pt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:flex-row sm:items-center">
          <div>GoldPrism · Team ARCEUS · Hack in Hills &apos;26</div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>Not investment advice</span>
            <span aria-hidden="true" className="text-border">/</span>
            <span>Fixture costs &amp; prices where labelled</span>
            <span aria-hidden="true" className="text-border">/</span>
            <span>MIT License</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

function VaultFact({
  num,
  label,
  note,
  emphasis = false,
}: {
  num: string
  label: string
  note: string
  emphasis?: boolean
}) {
  return (
    <div className="border-r border-border/70 px-4 py-4 last:border-0 sm:px-5">
      <p
        className={cn(
          'font-serif text-2xl leading-none sm:text-3xl',
          emphasis ? 'text-[var(--gp-caramel)]' : 'text-foreground'
        )}
        style={{ fontVariationSettings: '"SOFT" 100, "opsz" 80' }}
      >
        {num}
      </p>
      <p className="mt-2 font-mono text-[9.5px] uppercase leading-snug tracking-[0.11em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.11em] text-muted-foreground/70">
        {note}
      </p>
    </div>
  )
}
