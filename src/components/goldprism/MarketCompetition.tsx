'use client'

import { useGoldMarket } from '@/hooks/use-gold-market'
import { useMcxMarketWatch } from '@/hooks/use-mcx-market-watch'
import { premiumBps, pricePerGramInr } from '@/lib/goldprism/gold-market'

function inr(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value)
}

export function MarketCompetition() {
  const market = useGoldMarket()
  const mcxMarket = useMcxMarketWatch()
  const live = market.status === 'live' ? market.data : null
  const paxgPerGram = live ? pricePerGramInr(live.paxg.inr) : null
  const mcxGoldm =
    mcxMarket.status === 'available'
      ? mcxMarket.data.quotes.find((quote) => quote.symbol === 'GOLDM')
      : undefined
  const dailyGoldm = mcxMarket.dailyCloseReference?.quotes.find(
    (quote) => quote.symbol === 'GOLDM'
  )
  const dailySource = mcxMarket.dailyCloseReference
  const rows = [
    {
      name: 'MCX GOLDM',
      source: mcxGoldm?.source ??
        (dailyGoldm && dailySource
          ? `Supplied Bhavcopy close · ${dailySource.tradingDate} · not intraday`
          : 'No verified quote available'),
      price: mcxGoldm?.pricePerGramFineGold ?? dailyGoldm?.pricePerGramFineGold ?? null,
      sourceUrl: mcxGoldm?.sourceUrl ?? dailySource?.sourceUrl ?? null,
      comparable: Boolean(mcxGoldm && paxgPerGram !== null),
    },
    {
      name: 'PAXG',
      source: 'CoinGecko · Paxos Gold',
      price: paxgPerGram,
      sourceUrl: null,
      comparable: false,
    },
    {
      name: 'XAUT',
      source: 'CoinGecko · Tether Gold',
      price: live ? pricePerGramInr(live.xaut.inr) : null,
      sourceUrl: null,
      comparable: paxgPerGram !== null,
    },
  ]
  const change = live?.paxg.usd_24h_change ?? null
  const barWidth = change === null ? 0 : Math.min(Math.abs(change) / 5, 1) * 50

  return (
    <section className="gp-container py-8 sm:py-10">
      <div className="overflow-hidden rounded-md border border-border bg-card">
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Competition · indicative INR per gram</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead className="bg-muted/40 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 text-right font-medium">Price / g</th>
                <th className="px-4 py-3 text-right font-medium">Premium vs PAXG</th>
                <th className="px-4 py-3 text-right font-medium">Spread bps</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const premium =
                  !row.comparable || row.price === null || paxgPerGram === null
                    ? null
                    : row.price - paxgPerGram
                const spread =
                  !row.comparable || row.price === null || paxgPerGram === null
                    ? null
                    : premiumBps(row.price, paxgPerGram)
                return (
                  <tr key={row.name}>
                    <td className="px-4 py-4">
                      <p className="font-mono text-xs font-medium text-foreground">{row.name}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {row.sourceUrl ? (
                          <a href={row.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                            {row.source}
                          </a>
                        ) : row.source}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-xs text-foreground">
                      {row.price === null ? 'Unavailable' : inr(row.price)}
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-xs text-foreground">
                      {row.name === 'PAXG' ? '—' : premium === null ? '—' : `${premium >= 0 ? '+' : ''}${inr(premium)}`}
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-xs text-foreground">
                      {row.name === 'PAXG' ? '—' : spread === null ? '—' : `${spread >= 0 ? '+' : ''}${spread.toFixed(1)}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {market.status !== 'live' ? (
          <p role="status" className="px-4 py-8 text-sm text-muted-foreground">
            {market.status === 'error'
              ? `CoinGecko live prices unavailable; retrying every 30 seconds. ${market.error}`
              : 'Fetching live PAXG and XAUT prices…'}
          </p>
        ) : null}
        <p className="border-t border-border px-4 py-2 font-mono text-[9px] text-muted-foreground">
          {live
            ? `CoinGecko fetched ${new Date(live.fetchedAt).toLocaleString()} · MCX ${mcxGoldm ? `page retrieved ${new Date(mcxGoldm.fetchedAt).toLocaleString()}` : dailySource ? `daily close for ${dailySource.tradingDate} (reference only)` : 'quote unavailable'}`
            : `No cached PAXG/XAUT prices are shown.${dailySource ? ` MCX daily close is dated ${dailySource.tradingDate}.` : ''}`}
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-border bg-card p-5">
          <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">PAXG · 24h change</p>
          {change !== null ? (
            <>
              <p className={`mt-2 font-serif text-3xl ${change >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}`}>
                {change >= 0 ? '+' : ''}{change.toFixed(2)}%
              </p>
              <div className="relative mt-5 h-2 rounded-full bg-muted" role="img" aria-label={`PAXG 24 hour change ${change.toFixed(2)} percent`}>
                <span className="absolute left-1/2 top-0 h-2 w-px bg-muted-foreground/50" />
                <span
                  className={`absolute top-0 h-2 rounded-full ${change >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                  style={{ left: change >= 0 ? '50%' : `${50 - barWidth}%`, width: `${barWidth}%` }}
                />
              </div>
              <p className="mt-2 font-mono text-[9px] text-muted-foreground">One live 24h change metric · bar scale capped at ±5%</p>
            </>
          ) : (
            <p role="status" className="mt-3 text-sm text-muted-foreground">
              {market.status === 'error'
                ? `PAXG 24h change unavailable; retrying. ${market.error}`
                : 'Fetching live PAXG 24h change…'}
            </p>
          )}
        </div>
        <div className="rounded-md border border-border bg-card p-5">
          <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Data provenance</p>
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">PAXG / XAUT</dt><dd className="text-right text-foreground">CoinGecko public API</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">USD/INR</dt><dd className="text-right text-foreground">Implied from PAXG INR ÷ USD</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">MCX GOLDM</dt><dd className="text-right text-foreground">{mcxGoldm ? 'Live Market Watch via TinyFish' : dailySource ? `Supplied daily close · ${dailySource.tradingDate} · not LTP` : 'Unavailable; not simulated'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Refresh</dt><dd className="text-right text-foreground">{live ? 'Every 30 seconds' : 'Retrying every 30 seconds'}</dd></div>
          </dl>
        </div>
      </div>
    </section>
  )
}
