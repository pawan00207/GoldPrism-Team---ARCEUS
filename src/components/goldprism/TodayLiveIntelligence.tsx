'use client'

import * as React from 'react'
import { ArrowUpRight, Radio } from 'lucide-react'
import { SectionHead } from '@/components/goldprism/brand'
import { cn } from '@/lib/utils'

interface MarketQuote {
  symbol: string
  expiryDate: string
  quotedPrice: number
  pricePerGramFineGold: number
  source: string
  sourceUrl: string
  fetchedAtIst: string
  freshness: string
}

interface Headline {
  title: string
  url: string
  source: string
  publishedAt: string | null
  snippet: string
  fetchedAtIst: string
  freshness: string
}

interface TodayData {
  market?: {
    status: 'AVAILABLE' | 'UNAVAILABLE'
    source: string
    fetchedAtIst: string | null
    freshness: string | null
    quotes: MarketQuote[]
    message: string | null
  }
  context?: {
    status: 'AVAILABLE' | 'UNAVAILABLE'
    source: string
    fetchedAtIst: string | null
    headlines: Headline[]
    message: string | null
  }
}

function inr(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value)
}

function freshnessTone(value: string): string {
  return value === 'Live <5 min' ? 'gp-tag--tradable' : 'gp-tag--watch'
}

export function TodayLiveIntelligence() {
  const [data, setData] = React.useState<TodayData | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let active = true
    let pending = false
    const refresh = async () => {
      if (pending) return
      pending = true
      try {
        const response = await fetch('/api/goldprism/tinyfish/today', { cache: 'no-store' })
        if (!response.ok) throw new Error('TinyFish display data is unavailable.')
        const payload = (await response.json()) as TodayData
        if (active) setData(payload)
      } catch {
        if (active) setData(null)
      } finally {
        pending = false
        if (active) setLoading(false)
      }
    }

    void refresh()
    const timer = window.setInterval(() => void refresh(), 60_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  const market = data?.market
  const context = data?.context

  return (
    <section
      aria-label="Indicative market watch and context"
      className="border-b border-border bg-[var(--gp-vellum)]/30 dark:bg-[#1a1512]"
    >
      <div className="mx-auto max-w-[1360px] px-4 py-8 md:py-10">
        <SectionHead
          index="01.1"
          eyebrow="Today · Display-only context"
          title="Market watch, with provenance."
          description="MCX page retrieval is timestamped; quote update time is unverified. Verdict uses official settlement only."
          aside={
            <span className="gp-tag gp-tag--neutral inline-flex items-center gap-1.5">
              <Radio className="h-3 w-3" aria-hidden="true" />
              TinyFish display feed
            </span>
          }
        />

        <div className="mt-6 grid items-stretch gap-5 lg:grid-cols-2">
          <div className="min-w-0 overflow-hidden rounded-[4px] border border-border bg-card shadow-[var(--gp-hard-shadow)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-[var(--gp-vellum)]/60 px-4 py-3">
              <div>
                <p className="gp-label">MCX Market Watch · gold family</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Source: {market?.source ?? 'MCX India Market Watch via TinyFish'}
                </p>
              </div>
              {market?.freshness ? (
                <span className={cn('gp-tag', freshnessTone(market.freshness))}>
                  {market.freshness}
                </span>
              ) : (
                <span className="gp-tag gp-tag--neutral">Unavailable</span>
              )}
            </div>

            {loading ? (
              <div className="min-h-[260px] space-y-3 p-4" aria-label="Loading market quotes">
                {['a', 'b', 'c', 'd'].map((key) => (
                  <div key={key} className="h-12 animate-pulse rounded-sm bg-muted" />
                ))}
              </div>
            ) : market?.status === 'AVAILABLE' && market.quotes.length > 0 ? (
              <div className="min-h-[260px] divide-y divide-border">
                {market.quotes.map((quote) => (
                  <div
                    key={`${quote.symbol}-${quote.expiryDate}`}
                    className="grid gap-1 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-foreground">
                        {quote.symbol}
                        <span className="ml-2 font-normal text-muted-foreground">
                          expiry {quote.expiryDate}
                        </span>
                      </p>
                      <p className="mt-1 truncate font-mono text-[9px] text-muted-foreground">
                        {quote.source} · fetched {quote.fetchedAtIst} · {quote.freshness}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-mono text-sm text-foreground">{inr(quote.quotedPrice)}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {inr(quote.pricePerGramFineGold)} / g fine gold
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p role="status" className="min-h-[260px] px-4 py-8 text-sm text-muted-foreground">
                {market?.message ?? 'Unavailable — no TinyFish market data is configured.'}
              </p>
            )}
            <p className="border-t border-border px-4 py-2.5 font-mono text-[9px] text-muted-foreground">
              {market?.fetchedAtIst
                ? `Page fetched ${market.fetchedAtIst} · quote timestamp unavailable · refreshes every 60 seconds`
                : 'No page fetch timestamp is available.'}
            </p>
          </div>

          <div className="min-w-0 overflow-hidden rounded-[4px] border border-border bg-card shadow-[var(--gp-hard-shadow)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-[var(--gp-vellum)]/60 px-4 py-3">
              <div>
                <p className="gp-label">Why moved / Why quiet · Last 24 hours</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Context only. Not used in signals.
                </p>
              </div>
              <span className="gp-tag gp-tag--neutral">{context?.source ?? 'TinyFish Search'}</span>
            </div>

            {loading ? (
              <div className="min-h-[260px] space-y-4 p-4" aria-label="Loading market context">
                {['a', 'b', 'c'].map((key) => (
                  <div key={key} className="h-14 animate-pulse rounded-sm bg-muted" />
                ))}
              </div>
            ) : context?.status === 'AVAILABLE' && context.headlines.length > 0 ? (
              <ol className="min-h-[260px] divide-y divide-border">
                {context.headlines.map((headline) => (
                  <li key={headline.url} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('gp-tag', freshnessTone(headline.freshness))}>
                        {headline.freshness}
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                        {headline.source}
                        {headline.publishedAt ? ` · published ${headline.publishedAt}` : ''}
                      </span>
                    </div>
                    <a
                      href={headline.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block text-sm leading-snug text-foreground underline-offset-4 hover:underline"
                    >
                      {headline.title}
                      <ArrowUpRight className="ml-1 inline h-3 w-3" aria-hidden="true" />
                    </a>
                    {headline.snippet ? (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                        {headline.snippet}
                      </p>
                    ) : null}
                    <p className="mt-1 font-mono text-[9px] text-muted-foreground">
                      {context.source} · fetched {headline.fetchedAtIst}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p role="status" className="min-h-[260px] px-4 py-8 text-sm text-muted-foreground">
                {context?.message ?? 'Unavailable — no recent sourced headlines were returned.'}
              </p>
            )}
            <p className="border-t border-border px-4 py-2.5 font-mono text-[9px] text-muted-foreground">
              {context?.fetchedAtIst
                ? `Search fetched ${context.fetchedAtIst} · refreshes every 60 seconds`
                : 'No market-context fetch timestamp is available.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
