'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Heading } from '@astryxdesign/core'
import { useLiveFeed } from './LiveFeedProvider'
import { CONTRACT_MASTER, normalizePriceTo999, SUPPORTED_CONTRACTS } from '@/lib/goldprism/contract-master'
import type { SupportedContractCode } from '@/lib/goldprism/contract-master'
import type { ExchangeQuoteSnapshot } from '@/lib/goldprism/exchange-quotes'
import type { McxContractRow } from '@/lib/goldprism/mcx-snapshot'
import { DEFAULT_COST_CONFIG } from '@/lib/goldprism/transaction-costs'
import { computeXRayWaterfall, matchedSpreadLots } from '@/lib/goldprism/xray'

const number = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })
const fmt = (n: number | null) => n === null ? '—' : number.format(n)
const control = 'mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-foreground'
const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
function isoExpiry(value: string) {
  return value.slice(5) + '-' + String(months.indexOf(value.slice(2,5)) + 1).padStart(2,'0') + '-' + value.slice(0,2)
}
type Listed = McxContractRow & { symbol: SupportedContractCode; close: number }
const key = (r: Listed) => r.symbol + '/' + r.expiryDate

export function MarketDesk() {
  const { mcxSnapshot: publication, mcxSnapshotError } = useLiveFeed()
  const [book, setBook] = useState<ExchangeQuoteSnapshot | null>(null)
  const [bookError, setBookError] = useState(false)
  const [sellKey, setSell] = useState('')
  const [buyKey, setBuy] = useState('')
  const [rate, setRate] = useState('6.5')
  const [slip, setSlip] = useState(String(DEFAULT_COST_CONFIG.slippageBps))
  useEffect(() => {
    const abort = new AbortController()
    async function load() {
      try {
        const response = await fetch('/api/goldprism/exchange-quotes', { signal: abort.signal, cache: 'no-store' })
        if (!response.ok) throw new Error('Quote request failed')
        const data: ExchangeQuoteSnapshot = await response.json()
        if (!abort.signal.aborted) { setBook(data); setBookError(false) }
      } catch { if (!abort.signal.aborted) { setBook(null); setBookError(true) } }
    }
    void load()
    const timer = setInterval(load, 30000)
    return () => { abort.abort(); clearInterval(timer) }
  }, [])
  const rows: Listed[] = SUPPORTED_CONTRACTS.flatMap(symbol =>
    (publication?.contracts[symbol] ?? []).flatMap(row => row.close && row.close > 0 ? [{ ...row, symbol, close: row.close }] : []))
  const sell = rows.find(r => key(r) === sellKey) ?? rows.find(r => r.symbol === 'GOLDTEN') ?? rows[0]
  const choices = rows.filter(r => !sell || key(r) !== key(sell))
  const buy = choices.find(r => key(r) === buyKey) ?? choices.find(r => r.symbol === 'GOLDM') ?? choices[0]
  const tradeDate = publication?.bhavcopyDate
  const validInputs = rate.trim() !== '' && slip.trim() !== '' && +rate >= 0 && +rate <= 100 && +slip >= 0 && +slip <= 100
  const costs = { ...DEFAULT_COST_CONFIG, slippageBps: +slip }
  const lots = sell && buy && matchedSpreadLots(sell.symbol, buy.symbol)
  const result = sell && buy && tradeDate && validInputs ? computeXRayWaterfall({
    contractA: sell.symbol, priceAQuoted: sell.close, expiryA: isoExpiry(sell.expiryDate),
    contractB: buy.symbol, priceBQuoted: buy.close, expiryB: isoExpiry(buy.expiryDate),
    tradeDate, annualCarryRate: +rate / 100, costConfig: costs, dataQualityOk: publication?.status === 'MCX_EOD',
    liquidityOk: (sell.volumeLots ?? 0) >= 50 && (buy.volumeLots ?? 0) >= 50 && (sell.openInterestLots ?? 0) > 0 && (buy.openInterestLots ?? 0) > 0,
  }) : null
  const verdict = result?.verdict === 'TRADABLE' ? 'WATCH' : result?.verdict
  function download() {
    if (!publication || !result) return
    const packet = { schemaVersion: 1, tradingDate: tradeDate, priceBasis: 'EOD_CLOSE', source: publication.sourceUrl,
      exchangeDataHash: publication.contentHash, hashScope: publication.hashScope, sell, buy, lots,
      annualCarryPercent: +rate, fees: costs, assumedSettlementArtifactPerGram: 0, decision: verdict,
      calculation: result, usage: 'End-of-day research scenario. Execution requires a synchronized two-sided market.' }
    const url = URL.createObjectURL(new Blob([JSON.stringify(packet, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'goldprism-' + tradeDate + '-' + sell.symbol + '-' + buy.symbol + '.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <article className="gp-container space-y-8 py-10">
    <header className="grid gap-5 border-b border-border pb-8 md:grid-cols-2 md:items-end">
      <section><p className="gp-kicker">GoldPrism · Commodity research</p>
        <h1 className="gp-title mt-2">MCX gold spread desk</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">Compare listed expiries on a common gold basis. See how much of the closing spread survives funding and round-trip costs.</p></section>
      <aside className="md:text-right"><p className="gp-kicker">Exchange session</p>
        <p className="mt-1 font-serif text-3xl">{tradeDate ?? 'Awaiting publication'}</p>
        <p className="text-sm text-muted-foreground">{publication?.notice ?? mcxSnapshotError ?? 'Loading MCX daily closes…'}</p>
        <a className="underline" href="https://www.mcxindia.com/market-data/bhavcopy">MCX Bhavcopy archive ↗</a></aside>
    </header>
    <section aria-labelledby="spread-screen" className="grid gap-6 lg:grid-cols-2">
      <fieldset className="space-y-4 rounded-lg border border-border bg-card p-5">
        <legend id="spread-screen" className="px-2 font-serif text-2xl">Compare two contracts</legend>
        <label className="block">Sell leg<select className={control} value={sell ? key(sell) : ''} onChange={e => setSell(e.target.value)} disabled={!rows.length}>
          {rows.map(r => <option key={key(r)} value={key(r)}>{r.symbol} · {r.expiryDate}</option>)}</select></label>
        <label className="block">Buy leg<select className={control} value={buy ? key(buy) : ''} onChange={e => setBuy(e.target.value)} disabled={!choices.length}>
          {choices.map(r => <option key={key(r)} value={key(r)}>{r.symbol} · {r.expiryDate}</option>)}</select></label>
        <fieldset className="grid grid-cols-2 gap-3"><legend className="sr-only">Model assumptions</legend>
          <label>Annual carry (%)<input className={control} type="number" min="0" max="100" step="0.1" value={rate} onChange={e=>setRate(e.target.value)}/></label>
          <label>Slippage per side (bps)<input className={control} type="number" min="0" max="100" step="0.1" value={slip} onChange={e=>setSlip(e.target.value)}/></label></fieldset>
        {lots && <p className="text-sm">Sell {lots.lotsA} lots · Buy {lots.lotsB} lots · {lots.grams} nominal grams each side</p>}
      </fieldset>
      <section className="rounded-lg border border-border bg-card p-5" aria-live="polite">
        <p className="gp-kicker">Modeled residual after costs · ₹/g</p>
        <p className="my-2 font-serif text-5xl">{result ? fmt(result.netEdgeInrPerG) : '—'}</p>
        <strong>{verdict ?? 'Awaiting comparison'}</strong>
        <p className="mt-1 text-sm text-muted-foreground">{!validInputs ? 'Enter carry and slippage between 0 and 100.' : !result ? 'Two published closes are required.' : verdict === 'BLOCKED' ? result.verdictMessage : 'Closing-price screen only. A fill requires contemporaneous bids, offers and depth on both legs.'}</p>
        {result && <dl className="mt-4 grid grid-cols-2 gap-y-1 text-sm">
          <dt>Raw gap per gram</dt><dd className="text-right">{fmt(result.rawSpreadInrPerG)}</dd>
          <dt>Purity adjustment</dt><dd className="text-right">{fmt(-result.structuralBasisInrPerG)}</dd>
          <dt>Expiry carry adjustment</dt><dd className="text-right">{fmt(-result.expiryCarryInrPerG)}</dd>
          <dt>Round-trip cost</dt><dd className="text-right">{fmt(-result.transactionCostsInrPerG)}</dd></dl>}
        <button type="button" className="mt-4 rounded-md border border-border px-4 py-2 disabled:opacity-50" disabled={!result} onClick={download}>Export comparison evidence</button>
      </section>
    </section>
    <section><Heading level={2}>Listed futures</Heading>
      <p className="mb-4 text-sm text-muted-foreground">Exchange close in the contract’s quote unit. Comparable price uses one gram at 999 fineness.</p>
      <section className="overflow-x-auto"><table className="gp-table w-full text-left"><thead><tr>
        {['Contract','Expiry','Close (₹)','Quote unit','₹/g at 999','Volume (lots)','Open interest (lots)'].map(h=><th key={h} scope="col">{h}</th>)}
      </tr></thead><tbody>{rows.map(r=><tr key={key(r)}><th scope="row">{r.symbol}</th><td>{r.expiryDate}</td><td>{fmt(r.close)}</td>
        <td>{CONTRACT_MASTER[r.symbol].quoteUnitG} g</td><td>{fmt(normalizePriceTo999(r.close,r.symbol).normalizedPrice)}</td><td>{fmt(r.volumeLots)}</td><td>{fmt(r.openInterestLots)}</td></tr>)}</tbody></table></section>
      {!rows.length && <p role="status">{publication?.error ?? mcxSnapshotError ?? 'Waiting for exchange rows…'}</p>}
    </section>
    <section className="border-t border-border pt-6"><Heading level={2}>Intraday futures quotes</Heading>
      <p role="status" className="mt-2">{bookError ? 'Intraday quote request unavailable.' : book?.message ?? 'Checking feed entitlement…'}</p>
      {!!book?.quotes.length && <section className="overflow-x-auto"><table className="gp-table w-full text-left"><thead><tr>
        {['Contract','Expiry','Last (₹)','Bid × size','Ask × size','Trade time (IST)','Status'].map(h=><th key={h}>{h}</th>)}
        </tr></thead><tbody>{book.quotes.map(q=><tr key={q.identifier}><th>{q.symbol}</th><td>{q.expiryDate}</td><td>{fmt(q.lastPrice)}</td>
        <td>{fmt(q.bid)} × {fmt(q.bidSize)}</td><td>{fmt(q.ask)} × {fmt(q.askSize)}</td><td>{new Date(q.asOf).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}</td><td>{q.status}</td></tr>)}</tbody></table></section>}
    </section>
    <nav aria-label="Research tools" className="flex flex-wrap gap-6 border-t border-border pt-5">
      <Link className="underline" href="/replay">Replay a historical session →</Link><Link className="underline" href="/research#data-health">Validate a Bhavcopy file →</Link>
    </nav>
  </article>
}
