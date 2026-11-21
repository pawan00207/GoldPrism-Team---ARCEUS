import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

export const PROVIDED_BHAVCOPY_PATH =
  'research/data/incoming/BhavCopyDateWise_20112026.csv'
export const MCX_BHAVCOPY_REFERENCE_URL =
  'https://www.mcxindia.com/market-data/bhavcopy'

const GOLD_FUTURES = new Set(['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'])
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

export interface ProvidedBhavcopyRow {
  symbol: string
  expiryDate: string
  open: number
  high: number
  low: number
  close: number
  previousClose: number
  volumeLots: number
  openInterestLots: number
}

export interface ProvidedBhavcopySnapshot {
  sourceFileName: string
  sourceUrl: string
  sourceNote: string
  sha256Hash: string
  fetchedAt: string
  tradingDate: string
  rawRowCount: number
  goldFuturesRowCount: number
  rejectedGoldFuturesRowCount: number
  rows: ProvidedBhavcopyRow[]
}

function parseCsvRecords(content: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  const finishRow = () => {
    row.push(field)
    if (row.some((cell) => cell.trim() !== '')) rows.push(row)
    row = []
    field = ''
  }

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index]

    if (inQuotes) {
      if (character === '"' && content[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        inQuotes = false
      } else {
        field += character
      }
      continue
    }

    if (character === '"') {
      if (field.length > 0) throw new Error('Invalid CSV quoting.')
      inQuotes = true
    } else if (character === ',') {
      row.push(field)
      field = ''
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && content[index + 1] === '\n') continue
      finishRow()
    } else {
      field += character
    }
  }

  if (inQuotes) throw new Error('CSV contains an unterminated quoted field.')
  if (field.length > 0 || row.length > 0) finishRow()
  return rows
}

function parseDate(value: string): string | null {
  const match = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(value.trim())
  if (!match) return null

  const day = Number(match[1])
  const month = MONTHS.indexOf(match[2].toUpperCase())
  const year = Number(match[3])
  if (month < 0) return null

  const date = new Date(Date.UTC(year, month, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseExpiryDate(value: string): string | null {
  const match = /^(\d{1,2})[-\s]?([A-Za-z]{3})[-\s]?(\d{4})$/.exec(value.trim())
  if (!match) return null
  return parseDate(`${match[1]} ${match[2]} ${match[3]}`)
}

function parseNumber(value: string): number {
  return Number(value.trim().replace(/,/g, ''))
}

export function parseProvidedBhavcopyCsv(
  content: string,
  fetchedAt = new Date().toISOString(),
  sourceFileName = path.basename(PROVIDED_BHAVCOPY_PATH)
): ProvidedBhavcopySnapshot {
  const records = parseCsvRecords(content.replace(/^\uFEFF/, ''))
  if (records.length < 2) throw new Error('Bhavcopy CSV is empty or missing data rows.')

  const headers = records[0].map((header) => header.trim().toLowerCase())
  const requiredHeaders = [
    'date',
    'instrument name',
    'symbol',
    'expiry date',
    'option type',
    'open',
    'high',
    'low',
    'close',
    'previous close',
    'volume(lots)',
    'open interest(lots)',
  ]
  const indexes = new Map(headers.map((header, index) => [header, index]))
  const missingHeader = requiredHeaders.find((header) => !indexes.has(header))
  if (missingHeader) throw new Error(`Bhavcopy CSV is missing the "${missingHeader}" column.`)

  const cell = (record: string[], header: string) => record[indexes.get(header)!]?.trim() ?? ''
  const tradeDates = new Set<string>()
  const rows: ProvidedBhavcopyRow[] = []
  let matchedGoldFutures = 0
  let rejectedGoldFutures = 0

  for (const record of records.slice(1)) {
    if (record.length !== headers.length) {
      throw new Error('Bhavcopy CSV contains a row with an unexpected number of columns.')
    }

    const instrument = cell(record, 'instrument name').toUpperCase()
    const symbol = cell(record, 'symbol').toUpperCase()
    const optionType = cell(record, 'option type')
    if (instrument !== 'FUTCOM' || optionType !== '-' || !GOLD_FUTURES.has(symbol)) continue

    matchedGoldFutures += 1
    const tradingDate = parseDate(cell(record, 'date'))
    const expiryDate = parseExpiryDate(cell(record, 'expiry date'))
    if (tradingDate) tradeDates.add(tradingDate)

    const open = parseNumber(cell(record, 'open'))
    const high = parseNumber(cell(record, 'high'))
    const low = parseNumber(cell(record, 'low'))
    const close = parseNumber(cell(record, 'close'))
    const previousClose = parseNumber(cell(record, 'previous close'))
    const volumeLots = parseNumber(cell(record, 'volume(lots)'))
    const openInterestLots = parseNumber(cell(record, 'open interest(lots)'))

    if (
      !tradingDate ||
      !expiryDate ||
      ![open, high, low, close, previousClose].every((price) => Number.isFinite(price) && price > 0) ||
      ![volumeLots, openInterestLots].every(
        (value) => Number.isFinite(value) && value >= 0
      ) ||
      high < low ||
      open < low ||
      open > high ||
      close < low ||
      close > high
    ) {
      rejectedGoldFutures += 1
      continue
    }

    rows.push({
      symbol,
      expiryDate,
      open,
      high,
      low,
      close,
      previousClose,
      volumeLots,
      openInterestLots,
    })
  }

  if (tradeDates.size !== 1) {
    throw new Error('Bhavcopy CSV must contain gold-futures rows for exactly one trading date.')
  }
  if (rows.length === 0) throw new Error('Bhavcopy CSV has no valid gold-futures rows.')

  rows.sort(
    (left, right) =>
      left.symbol.localeCompare(right.symbol) ||
      left.expiryDate.localeCompare(right.expiryDate)
  )

  return {
    sourceFileName,
    sourceUrl: MCX_BHAVCOPY_REFERENCE_URL,
    sourceNote: 'User-supplied daily snapshot; not verified against a live MCX feed.',
    sha256Hash: createHash('sha256').update(content).digest('hex'),
    fetchedAt,
    tradingDate: Array.from(tradeDates)[0],
    rawRowCount: records.length - 1,
    goldFuturesRowCount: rows.length,
    rejectedGoldFuturesRowCount: rejectedGoldFutures,
    rows,
  }
}

export function loadProvidedBhavcopySnapshot(): ProvidedBhavcopySnapshot {
  const absolutePath = path.join(process.cwd(), PROVIDED_BHAVCOPY_PATH)
  const content = readFileSync(absolutePath, 'utf8')
  return parseProvidedBhavcopyCsv(content)
}
