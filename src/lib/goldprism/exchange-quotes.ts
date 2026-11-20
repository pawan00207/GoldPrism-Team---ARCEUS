import https from 'node:https'
import { z } from 'zod'

const goldFamily = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'] as const
const source = 'Global Datafeeds · MCX futures'
const maxTradeAgeMs = 120_000
const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
type Symbol = typeof goldFamily[number]
type Instrument = { symbol: Symbol; expiryDate: string; identifier: string }
type Settings = { endpoint: string; key: string }
type ReadApi = (settings: Settings, method: string, params: Record<string, string>) => Promise<unknown>

export interface ExchangeQuote extends Instrument {
  lastPrice: number
  bid: number | null
  ask: number | null
  bidSize: number | null
  askSize: number | null
  asOf: string
  status: 'LIVE' | 'STALE'
}

export interface ExchangeQuoteSnapshot {
  source: string
  status: 'LIVE' | 'PARTIAL' | 'STALE' | 'UNAVAILABLE' | 'NOT_CONFIGURED'
  quotes: ExchangeQuote[]
  fetchedAt: string
  message: string
}

// The vendor authenticates in the URL. Native HTTPS avoids recording that URL
// in Next.js fetch traces. Never log the URL, redirect the request, or expose
// the vendor response body in an error.
const readApi: ReadApi = (settings, method, params) => new Promise((resolve, reject) => {
  const url = new URL(method + '/', settings.endpoint)
  url.search = new URLSearchParams({ exchange: 'MCX', ...params, accessKey: settings.key }).toString()
  const req = https.get(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }, res => {
    if (res.statusCode !== 200) {
      res.resume()
      reject(new Error('Provider declined request'))
      return
    }
    let bytes = 0
    const chunks: Buffer[] = []
    res.on('data', (chunk: Buffer) => {
      bytes += chunk.length
      if (bytes > 4_000_000) req.destroy(new Error('Provider response exceeded size limit'))
      else chunks.push(chunk)
    })
    res.on('error', reject)
    res.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) }
      catch { reject(new Error('Provider returned invalid JSON')) }
    })
  })
  req.on('error', reject)
})

const record = z.record(z.string(), z.unknown())
const catalogSchema = z.object({ INSTRUMENTS: z.array(record) })
const quotesSchema = z.array(record)

function expiryDate(raw: unknown) {
  const match = /^(\d{1,2})([A-Z]{3})(\d{4})$/.exec(String(raw).trim().toUpperCase())
  if (!match) return null
  const month = monthNames.indexOf(match[2])
  if (month < 0) return null
  const day = Number(match[1])
  const result = new Date(Date.UTC(Number(match[3]), month, day))
  return result.getUTCDate() === day ? result.toISOString().slice(0, 10) : null
}

function selectContracts(raw: unknown, tradingDate: string): Instrument[] {
  const contracts: Instrument[] = []
  for (const row of catalogSchema.parse(raw).INSTRUMENTS) {
    const symbol = goldFamily.find(s => s === row.PRODUCT)
    const expiry = expiryDate(row.EXPIRY)
    if (row.EXCHANGE !== 'MCX' || row.NAME !== 'FUTCOM' || !symbol ||
        !expiry || expiry < tradingDate || typeof row.IDENTIFIER !== 'string' || !row.IDENTIFIER) continue
    contracts.push({ symbol, expiryDate: expiry, identifier: row.IDENTIFIER })
  }
  contracts.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
  return goldFamily.flatMap(symbol => contracts.filter(c => c.symbol === symbol).slice(0, 1))
}

function positive(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function parseQuotes(raw: unknown, instruments: Instrument[], now: number): ExchangeQuote[] {
  const rows = quotesSchema.parse(raw)
  return instruments.flatMap(instrument => {
    const row = rows.find(r => r.EXCHANGE === 'MCX' && r.INSTRUMENTIDENTIFIER === instrument.identifier)
    if (!row) return []
    const rawTime = positive(row.LASTTRADETIME)
    const price = positive(row.LASTTRADEPRICE)
    if (!rawTime || !price) return []
    // REST documentation describes epoch seconds and also shows millisecond values.
    const ms = rawTime < 1e11 ? rawTime * 1000 : rawTime
    if (ms > now || ms < Date.UTC(2000, 0, 1)) return []
    const bid = positive(row.BUYPRICE)
    const ask = positive(row.SELLPRICE)
    const validBook = bid === null || ask === null || bid <= ask
    return [{ ...instrument, lastPrice: price, asOf: new Date(ms).toISOString(),
      bid: validBook ? bid : null, ask: validBook ? ask : null,
      bidSize: validBook && bid !== null ? positive(row.BUYQTY) : null,
      askSize: validBook && ask !== null ? positive(row.SELLQTY) : null,
      status: now - ms <= maxTradeAgeMs ? 'LIVE' as const : 'STALE' as const }]
  })
}

// Only a server-controlled, licensed display may enable the quote route.
export function createExchangeQuoteService(env: NodeJS.ProcessEnv = process.env, read: ReadApi = readApi, now = Date.now) {
  let catalog: { date: string; contracts: Instrument[] } | undefined
  let last: { expires: number; value: ExchangeQuoteSnapshot } | undefined
  let pending: Promise<ExchangeQuoteSnapshot> | undefined

  async function load(): Promise<ExchangeQuoteSnapshot> {
    const base = { source, fetchedAt: new Date(now()).toISOString(), quotes: [] }
    if (!env.GDFL_API_KEY || !env.GDFL_ENDPOINT || env.GDFL_MCX_DISPLAY_ENTITLED !== 'true') {
      return { ...base, status: 'NOT_CONFIGURED', message: 'An entitled MCX quote feed has not been configured.' }
    }
    try {
      const endpoint = new URL(env.GDFL_ENDPOINT)
      if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
        return { ...base, status: 'UNAVAILABLE', message: 'The quote provider requires a valid HTTPS endpoint.' }
      }
      const settings = { endpoint: endpoint.href.replace(/\/?$/, '/'), key: env.GDFL_API_KEY }
      const date = new Date(now() + 330 * 60_000).toISOString().slice(0, 10)
      if (catalog?.date !== date) {
        const raw = await read(settings, 'GetInstruments', { instrumentType: 'FUTCOM', onlyActive: 'true' })
        const contracts = selectContracts(raw, date)
        if (!contracts.length) return { ...base, status: 'UNAVAILABLE', message: 'No active gold futures returned by the provider.' }
        catalog = { date, contracts }
      }
      const contracts = catalog.contracts
      const raw = await read(settings, 'GetLastQuoteArray', { instrumentIdentifiers: contracts.map(c => c.identifier).join(' ') })
      const quotes = parseQuotes(raw, contracts, now())
      const fresh = quotes.filter(q => q.status === 'LIVE').length
      const status = fresh === goldFamily.length ? 'LIVE' : fresh ? 'PARTIAL' : quotes.length ? 'STALE' : 'UNAVAILABLE'
      const message = quotes.length
        ? `${fresh} of ${goldFamily.length} near contracts traded within the last two minutes. Timestamps refer to last trades.`
        : 'The provider returned no valid timestamped prices for the selected expiries.'
      return { ...base, fetchedAt: new Date(now()).toISOString(), status, quotes, message }
    } catch {
      return { ...base, status: 'UNAVAILABLE', message: 'MCX quote provider unavailable. Check feed access or retry.' }
    }
  }

  return function getQuotes(): Promise<ExchangeQuoteSnapshot> {
    if (last && last.expires > now()) return Promise.resolve(last.value)
    if (pending) return pending
    pending = load().then(value => {
      const freshnessDeadline = Math.min(...value.quotes.filter(q => q.status === 'LIVE').map(q => Date.parse(q.asOf) + maxTradeAgeMs))
      last = { value, expires: Math.min(now() + 10_000, freshnessDeadline) }
      return value
    }).finally(() => { pending = undefined })
    return pending
  }
}

export const getExchangeQuotes = createExchangeQuoteService()
