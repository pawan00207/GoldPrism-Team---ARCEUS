'use client'

import Link from 'next/link'
import { ArrowRight, Radio } from 'lucide-react'
import { useGoldMarket } from '@/hooks/use-gold-market'
import { useMcxMarketWatch } from '@/hooks/use-mcx-market-watch'
import { premiumBps, pricePerGramInr } from '@/lib/goldprism/gold-market'

function money(value: number, currency: 'INR' | 'USD' = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'INR' ? 2 : 2,
  }).format(value)
}

export function TokenizedGoldHome() {
  const market = useGoldMarket()
  const mcxMarket = useMcxMarketWatch()
  const live = market.status === 'live' ? market.data : null
  const paxgPerGram = live ? pricePerGramInr(live.paxg.inr) : null
  const mcxGoldm =
    mcxMarket.status === 'available'
      ? mcxMarket.data.quotes.find((quote) => quote.symbol === 'GOLDM')
      : undefined
  const crossSourceSpreadBps =
    mcxGoldm && paxgPerGram !== null
      ? premiumBps(mcxGoldm.pricePerGramFineGold, paxgPerGram)
      : null

  return (
    <section className="border-b border-border bg-card/40">
      <div className="gp-container py-6 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <Radio className="h-3.5 w-3.5 text-[var(--gp-tradable-ink)]" />
              Live tokenized gold reference prices
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              MCX gold noise filter + tokenized-gold payment demo · The only tool that tells you when NOT to trade.
            </p>
          </div>
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
            {live
              ? `CoinGecko · refreshed ${new Date(live.fetchedAt).toLocaleTimeString()}`
              : 'Fetching live prices · retries every 30 seconds'}
          </span>
        </div>

        <div className="mt-4 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
          <TickerPrice
            name="PAXG"
            price={live ? money(live.paxg.inr) : null}
            sub={paxgPerGram !== null ? `${money(paxgPerGram)} / g · ${live?.paxg.usd_24h_change.toFixed(2)}% 24h` : 'Fetching live…'}
          />
          <TickerPrice
            name="XAUT"
            price={live ? money(live.xaut.inr) : null}
            sub={live ? `${money(pricePerGramInr(live.xaut.inr))} / g · ${live.xaut.usd_24h_change.toFixed(2)}% 24h` : 'Fetching live…'}
          />
          <TickerPrice
            name="USD / INR"
            price={live ? `₹${live.usdInr.toFixed(2)}` : null}
            sub="Implied from CoinGecko PAXG USD / INR quotes"
          />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
          <div className="rounded-md border border-border bg-background/70 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">MCX GOLDM vs PAXG · cross-source check</p>
                <p className="mt-1 text-sm text-muted-foreground">Quotes from separate sources; update timestamps are not synchronized.</p>
              </div>
              <span className="rounded-sm border border-border px-2 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-muted-foreground">
                No X-Ray verdict
              </span>
            </div>

            <div className="mt-4 grid gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-3">
              <TickerPrice
                name="MCX GOLDM · 999 normalized"
                price={mcxGoldm ? money(mcxGoldm.pricePerGramFineGold) : null}
                sub={mcxGoldm ? `Page retrieved ${mcxGoldm.fetchedAtIst}; quote time unverified` : 'No verified MCX quote'}
              />
              <TickerPrice
                name="PAXG"
                price={paxgPerGram === null ? null : money(paxgPerGram)}
                sub={live ? `CoinGecko fetched ${new Date(live.fetchedAt).toLocaleTimeString()}` : 'Fetching live…'}
              />
              <TickerPrice
                name="Difference vs PAXG"
                price={crossSourceSpreadBps === null ? null : `${crossSourceSpreadBps >= 0 ? '+' : ''}${crossSourceSpreadBps.toFixed(1)} bps`}
                sub="Descriptive comparison only; not a synchronized tradable spread"
              />
            </div>
            {!mcxGoldm ? (
              <p role="status" className="mt-3 rounded-sm border border-border px-3 py-3 font-mono text-xs text-muted-foreground">
                {mcxMarket.status === 'unavailable'
                  ? `MCX quote unavailable: ${mcxMarket.error}`
                  : 'Fetching a verified MCX Market Watch quote…'}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col justify-between rounded-md border border-[var(--gp-blocked-ink)]/40 bg-background/70 p-4 text-foreground sm:p-5">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Verdict · data-quality gate</p>
              <p className="mt-2 font-serif text-3xl">BLOCKED</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                The MCX page does not provide verified quote time, volume, open interest, or a settlement-artifact cross-check. No trade verdict is calculated from this comparison.
              </p>
              <Link href="/xray" className="mt-3 inline-flex text-xs text-foreground underline underline-offset-4">
                Open X-Ray data checks <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </div>
            <Link href="/wallet" className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-sm bg-foreground px-4 font-mono text-[10px] uppercase tracking-[0.12em] text-background transition-opacity hover:opacity-80">
              Go to Wallet <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function TickerPrice({ name, price, sub }: { name: string; price: string | null; sub: string }) {
  return (
    <div className="min-w-0 bg-card px-4 py-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{name}</p>
      <p className="mt-1 font-mono text-lg font-medium text-foreground">{price ?? 'Fetching live…'}</p>
      <p className="mt-1 truncate font-mono text-[9px] text-muted-foreground">{sub}</p>
    </div>
  )
}

