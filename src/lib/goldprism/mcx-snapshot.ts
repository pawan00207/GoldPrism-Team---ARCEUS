import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const officialPage = 'https://www.mcxindia.com/market-data/bhavcopy'
const symbols = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'] as const
const maxPageBytes = 16 * 1024 * 1024
const msPerDay = 86_400_000
type Row = Record<string, unknown>

export type McxSnapshotStatus = 'MCX_EOD' | 'MCX_STALE' | 'UNAVAILABLE'
export interface McxContractRow {
  symbol: string
  expiryDate: string
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  previousClose: number | null
  volumeLots: number | null
  volumeUnit: number | null
  valueLakhs: number | null
  openInterestLots: number | null
}
export interface McxSnapshotResponse {
  status: McxSnapshotStatus
  source: string
  sourceUrl: string
  delivery: 'EXCHANGE_PUBLICATION' | 'CACHED_PUBLICATION' | 'UNAVAILABLE'
  priceField: 'Close'
  fetchedAt: string | null
  ageMinutes: number | null
  bhavcopyDate: string | null
  spot: { commodity: string; unit: string; location: string; price: number | null; quoteTimestamp: string } | null
  contracts: Record<string, McxContractRow[]>
  notice: string
  contentHash: string | null
  hashScope: 'EXCHANGE_JSON_BLOCK' | 'LOCAL_FILE' | null
  error: string | null
}

const blankContracts = (): Record<string, McxContractRow[]> => ({ GOLDM: [], GOLDTEN: [], GOLDGUINEA: [], GOLDPETAL: [] })
function unavailable(): McxSnapshotResponse {
  return {
    status: 'UNAVAILABLE', delivery: 'UNAVAILABLE', priceField: 'Close', source: 'MCX Daily Bhavcopy',
    sourceUrl: officialPage, fetchedAt: null, ageMinutes: null, bhavcopyDate: null, spot: null,
    contracts: blankContracts(), contentHash: null, hashScope: null, notice: 'End-of-day publication.',
    error: 'No valid MCX publication within the last four calendar days.',
  }
}

function indiaDate(now: number): string {
  return new Date(now + 330 * 60_000).toISOString().slice(0, 10)
}
function validDate(day: string) {
  const time = Date.parse(day + 'T00:00:00Z')
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === day
}
function expiryKey(code: string): string | null {
  const match = /^(\d{2})([A-Z]{3})(\d{4})$/.exec(code)
  if (!match) return null
  const month = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'].indexOf(match[2]) + 1
  const iso = `${match[3]}-${String(month).padStart(2, '0')}-${match[1]}`
  return validDate(iso) ? iso : null
}
function numberField(value: unknown): number | null {
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}
function classify(snapshot: McxSnapshotResponse, now: number): McxSnapshotResponse {
  const tradeDate = snapshot.bhavcopyDate ?? ''
  if (!validDate(tradeDate)) return unavailable()
  const ageDays = (Date.parse(indiaDate(now)) - Date.parse(tradeDate)) / msPerDay
  const fetchedMs = Date.parse(snapshot.fetchedAt ?? '')
  if (ageDays < 0 || ageDays > 4 || !Number.isFinite(fetchedMs) || fetchedMs > now + 60_000) return unavailable()
  return { ...snapshot, status: ageDays <= 1 ? 'MCX_EOD' : 'MCX_STALE',
    ageMinutes: Math.max(0, Math.round((now - fetchedMs) / 6000) / 10) }
}

function buildSnapshot(rows: Row[], tradingDate: string, base: McxSnapshotResponse, now: number): McxSnapshotResponse {
  const bySymbol = blankContracts()
  const seen = new Set<string>()
  for (const row of rows) {
    const symbol = String(row.symbol).trim().toUpperCase()
    if (!symbols.some(s => s === symbol)) continue
    const expiry = String(row.expiryDate).trim().toUpperCase()
    const date = expiryKey(expiry)
    if (!date) throw new Error('Invalid expiry')
    if (date < tradingDate) continue
    const key = symbol + expiry
    if (seen.has(key)) throw new Error('Duplicate contract and expiry')
    seen.add(key)
    const close = numberField(row.close)
    if (!close) continue
    bySymbol[symbol].push({ symbol, expiryDate: expiry, close, open: numberField(row.open),
      high: numberField(row.high), low: numberField(row.low), previousClose: numberField(row.previousClose),
      volumeLots: numberField(row.volumeLots), volumeUnit: numberField(row.volumeUnit),
      valueLakhs: numberField(row.valueLakhs), openInterestLots: numberField(row.openInterestLots) })
  }
  if (!Object.values(bySymbol).some(group => group.length)) throw new Error('No usable gold futures')
  for (const group of Object.values(bySymbol)) group.sort((a, b) => expiryKey(a.expiryDate)!.localeCompare(expiryKey(b.expiryDate)!))
  return classify({ ...base, contracts: bySymbol, bhavcopyDate: tradingDate, error: null }, now)
}

export function parseOfficialBhavcopy(html: string, now = Date.now()): McxSnapshotResponse {
  const block = /<div\b[^>]*\bid=["']bhavcopy-data["'][^>]*>([\s\S]*?)<\/div>/i.exec(html)?.[1]?.trim()
  if (!block) throw new Error('Missing Bhavcopy publication')
  const data: unknown = JSON.parse(block)
  if (!Array.isArray(data)) throw new Error('Invalid Bhavcopy publication')
  const rows: Row[] = []
  const dates = new Set<string>()
  for (const item of data) {
    if (!item || String(item.InstrumentName).trim() !== 'FUTCOM' || !symbols.some(s => s === String(item.Symbol).trim())) continue
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(item.Date))
    if (!m) throw new Error('Missing returned trade date')
    dates.add(`${m[3]}-${m[1]}-${m[2]}`)
    rows.push({ symbol: item.Symbol, expiryDate: item.ExpiryDate, open: item.Open, high: item.High, low: item.Low,
      close: item.Close, previousClose: item.PreviousClose, volumeLots: item.Volume, valueLakhs: item.Value,
      openInterestLots: item.OpenInterest })
  }
  if (dates.size !== 1) throw new Error('Missing or mixed trade dates')
  return buildSnapshot(rows, [...dates][0], { ...unavailable(), delivery: 'EXCHANGE_PUBLICATION',
    fetchedAt: new Date(now).toISOString(), contentHash: createHash('sha256').update(block).digest('hex'),
    hashScope: 'EXCHANGE_JSON_BLOCK', notice: 'MCX published daily closes. Date is the returned exchange session.' }, now)
}

export function getMcxSnapshot(now = Date.now()): McxSnapshotResponse {
  try {
    const raw = readFileSync(path.join(process.cwd(), 'results', 'mcx-live-snapshot.json'), 'utf8')
    const data = JSON.parse(raw)
    const spot = data.spot
    return buildSnapshot(data.bhavcopy.goldFamilyRows, data.bhavcopy.date, {
      ...unavailable(), delivery: 'CACHED_PUBLICATION', fetchedAt: data.fetchedAt,
      spot: spot && numberField(spot.price) && String(spot.quoteTimestamp).startsWith(data.bhavcopy.date)
        ? { commodity: String(spot.commodity), unit: String(spot.unit), location: String(spot.location),
          price: numberField(spot.price), quoteTimestamp: String(spot.quoteTimestamp) } : null,
      hashScope: 'LOCAL_FILE', contentHash: createHash('sha256').update(raw).digest('hex'),
      notice: 'Cached MCX daily publication. Prices are closes for the displayed trading date.',
    }, now)
  } catch { return unavailable() }
}

async function download(): Promise<string> {
  const response = await fetch(officialPage, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
  if (!response.ok || !response.body) throw new Error('Exchange unavailable')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxPageBytes) { await reader.cancel(); throw new Error('Oversized exchange publication') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  return Buffer.concat(chunks).toString('utf8')
}

export function createMcxPublicationService(fetchPage = download, saved = getMcxSnapshot, now = Date.now) {
  let last: McxSnapshotResponse | undefined
  let nextCheck = 0
  let pending: Promise<McxSnapshotResponse> | undefined
  async function refresh() {
    const fallback = saved(now())
    let candidates = [last, fallback].filter((s): s is McxSnapshotResponse => !!s && s.status !== 'UNAVAILABLE')
    let received = false
    try {
      const remote = parseOfficialBhavcopy(await fetchPage(), now())
      if (remote.status !== 'UNAVAILABLE') { candidates = [remote, ...candidates]; received = true }
    } catch { /* Keep the last validated publication during an upstream outage. */ }
    nextCheck = now() + (received ? 15 * 60_000 : 60_000)
    candidates.sort((a, b) => b.bhavcopyDate!.localeCompare(a.bhavcopyDate!))
    last = candidates.length ? classify(candidates[0], now()) : unavailable()
    if (!received && last.status !== 'UNAVAILABLE') {
      last = { ...last, delivery: 'CACHED_PUBLICATION', notice: 'Exchange refresh unavailable. Showing the last validated daily close.' }
    }
    return last
  }
  return () => {
    if (last && now() < nextCheck) return Promise.resolve(classify(last, now()))
    if (!pending) pending = refresh().finally(() => { pending = undefined })
    return pending
  }
}
export const getLatestMcxPublication = createMcxPublicationService()
