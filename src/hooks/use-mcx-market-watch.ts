'use client'

import * as React from 'react'
import type { ContractSymbol } from '@/lib/goldprism/contract-specs'
import {
  parseMcxDailyCloseReference,
  type McxDailyCloseReference,
} from '@/lib/goldprism/mcx-daily-reference'

const REFRESH_INTERVAL_MS = 30_000

export interface McxMarketQuote {
  symbol: ContractSymbol
  expiryDate: string
  quotedPrice: number
  pricePerGramFineGold: number
  source: string
  sourceUrl: string
  fetchedAt: string
  fetchedAtIst: string
  freshness: 'Quote time unverified' | 'Delayed' | 'Stale'
}

interface McxMarketResult {
  status: 'AVAILABLE' | 'UNAVAILABLE'
  source: string
  fetchedAt: string | null
  fetchedAtIst: string | null
  freshness: 'Quote time unverified' | 'Delayed' | 'Stale' | null
  quotes: McxMarketQuote[]
  message: string | null
}

export type McxMarketState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'available'; data: McxMarketResult; error: null }
  | { status: 'unavailable'; data: McxMarketResult | null; error: string }

function isQuote(value: unknown): value is McxMarketQuote {
  if (!value || typeof value !== 'object') return false
  const quote = value as Record<string, unknown>
  return (
    typeof quote.symbol === 'string' &&
    ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'].includes(quote.symbol) &&
    typeof quote.expiryDate === 'string' &&
    typeof quote.quotedPrice === 'number' &&
    Number.isFinite(quote.quotedPrice) &&
    quote.quotedPrice > 0 &&
    typeof quote.pricePerGramFineGold === 'number' &&
    Number.isFinite(quote.pricePerGramFineGold) &&
    quote.pricePerGramFineGold > 0 &&
    typeof quote.source === 'string' &&
    typeof quote.sourceUrl === 'string' &&
    quote.sourceUrl === 'https://www.mcxindia.com/market-data/market-watch' &&
    typeof quote.fetchedAt === 'string' &&
    typeof quote.fetchedAtIst === 'string' &&
    ['Quote time unverified', 'Delayed', 'Stale'].includes(String(quote.freshness))
  )
}

function parseMarketResult(value: unknown): McxMarketResult | null {
  if (!value || typeof value !== 'object') return null
  const result = value as Record<string, unknown>
  if (
    (result.status !== 'AVAILABLE' && result.status !== 'UNAVAILABLE') ||
    typeof result.source !== 'string' ||
    !Array.isArray(result.quotes) ||
    !result.quotes.every(isQuote)
  ) {
    return null
  }
  const freshness =
    result.freshness === 'Quote time unverified' ||
    result.freshness === 'Delayed' ||
    result.freshness === 'Stale'
      ? result.freshness
      : null
  return {
    status: result.status,
    source: result.source,
    fetchedAt: typeof result.fetchedAt === 'string' ? result.fetchedAt : null,
    fetchedAtIst: typeof result.fetchedAtIst === 'string' ? result.fetchedAtIst : null,
    freshness,
    quotes: result.quotes,
    message: typeof result.message === 'string' ? result.message : null,
  }
}

async function loadDailyCloseReference(): Promise<McxDailyCloseReference> {
  const response = await fetch('/api/goldprism/bhavcopy', { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Daily MCX reference returned HTTP ${response.status}.`)
  }
  const reference = parseMcxDailyCloseReference(await response.json())
  if (!reference) throw new Error('Daily MCX reference returned invalid data.')
  return reference
}

export function useMcxMarketWatch(): McxMarketState & {
  refreshing: boolean
  refresh: () => Promise<void>
  dailyCloseReference: McxDailyCloseReference | null
} {
  const [state, setState] = React.useState<McxMarketState>({
    status: 'loading',
    data: null,
    error: null,
  })
  const [refreshing, setRefreshing] = React.useState(false)
  const [dailyCloseReference, setDailyCloseReference] =
    React.useState<McxDailyCloseReference | null>(null)
  const requestInFlight = React.useRef(false)

  const refresh = React.useCallback(async () => {
    if (requestInFlight.current) return
    requestInFlight.current = true
    setRefreshing(true)
    try {
      const response = await fetch('/api/goldprism/tinyfish/market', { cache: 'no-store' })
      const payload: unknown = await response.json()
      const data = parseMarketResult(payload)
      if (!response.ok || !data) {
        throw new Error('MCX Market Watch returned an invalid response.')
      }
      if (data.status === 'UNAVAILABLE') {
        let errorMessage = data.message ?? 'No verifiable MCX quotes are available.'
        try {
          setDailyCloseReference(await loadDailyCloseReference())
        } catch (referenceError) {
          setDailyCloseReference(null)
          const detail =
            referenceError instanceof Error
              ? referenceError.message
              : 'Daily MCX reference could not be loaded.'
          errorMessage = `${errorMessage} ${detail}`
        }
        setState({
          status: 'unavailable',
          data,
          error: errorMessage,
        })
      } else {
        setDailyCloseReference(null)
        setState({ status: 'available', data, error: null })
      }
    } catch (error) {
      let errorMessage =
        error instanceof TypeError && /fetch/i.test(error.message)
          ? 'GoldPrism market API is unreachable. Check that the app server is running and connected.'
          : error instanceof Error
            ? error.message
            : 'MCX Market Watch is unavailable.'
      try {
        setDailyCloseReference(await loadDailyCloseReference())
      } catch (referenceError) {
        setDailyCloseReference(null)
        const detail =
          referenceError instanceof Error
            ? referenceError.message
            : 'Daily MCX reference could not be loaded.'
        errorMessage = `${errorMessage} ${detail}`
      }
      setState({
        status: 'unavailable',
        data: null,
        error: errorMessage,
      })
    } finally {
      requestInFlight.current = false
      setRefreshing(false)
    }
  }, [])

  React.useEffect(() => {
    let active = true
    let timer: number | null = null
    const load = async () => {
      if (!active) return
      await refresh()
      if (active) timer = window.setTimeout(() => void load(), REFRESH_INTERVAL_MS)
    }
    void load()
    return () => {
      active = false
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [refresh])

  return { ...state, refreshing, refresh, dailyCloseReference }
}
