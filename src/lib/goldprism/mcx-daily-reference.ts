import {
  normalizeContractBySymbol,
  type ContractSymbol,
} from '@/lib/goldprism/contract-specs'

const CONTRACT_SYMBOLS = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'] as const
const MCX_BHAVCOPY_URL = 'https://www.mcxindia.com/market-data/bhavcopy'

export interface McxDailyCloseQuote {
  symbol: ContractSymbol
  expiryDate: string
  close: number
  pricePerGramFineGold: number
  volumeLots: number
  openInterestLots: number
}

export interface McxDailyCloseReference {
  sourceFileName: string
  sourceUrl: string
  sourceNote: string
  sha256Hash: string
  tradingDate: string
  quotes: McxDailyCloseQuote[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isContractSymbol(value: unknown): value is ContractSymbol {
  return typeof value === 'string' && CONTRACT_SYMBOLS.includes(value as ContractSymbol)
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function parseMcxDailyCloseReference(value: unknown): McxDailyCloseReference | null {
  if (
    !isRecord(value) ||
    !isIsoDate(value.tradingDate) ||
    typeof value.sourceFileName !== 'string' ||
    value.sourceUrl !== MCX_BHAVCOPY_URL ||
    typeof value.sourceNote !== 'string' ||
    typeof value.sha256Hash !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(value.sha256Hash) ||
    !Array.isArray(value.rows) ||
    value.rows.length === 0
  ) {
    return null
  }

  const quotes: McxDailyCloseQuote[] = []
  const seen = new Set<string>()

  for (const row of value.rows) {
    if (
      !isRecord(row) ||
      !isContractSymbol(row.symbol) ||
      typeof row.expiryDate !== 'string' ||
      !isIsoDate(row.expiryDate) ||
      typeof row.close !== 'number' ||
      !Number.isFinite(row.close) ||
      row.close <= 0 ||
      typeof row.volumeLots !== 'number' ||
      !Number.isFinite(row.volumeLots) ||
      row.volumeLots < 0 ||
      typeof row.openInterestLots !== 'number' ||
      !Number.isFinite(row.openInterestLots) ||
      row.openInterestLots < 0
    ) {
      return null
    }

    const key = `${row.symbol}:${row.expiryDate}`
    if (seen.has(key)) return null
    seen.add(key)

    const normalized = normalizeContractBySymbol(row.symbol, row.close)
    quotes.push({
      symbol: row.symbol,
      expiryDate: row.expiryDate,
      close: row.close,
      pricePerGramFineGold: normalized.pricePerPureGram,
      volumeLots: row.volumeLots,
      openInterestLots: row.openInterestLots,
    })
  }

  return {
    sourceFileName: value.sourceFileName,
    sourceUrl: value.sourceUrl,
    sourceNote: value.sourceNote,
    sha256Hash: value.sha256Hash,
    tradingDate: value.tradingDate,
    quotes,
  }
}
