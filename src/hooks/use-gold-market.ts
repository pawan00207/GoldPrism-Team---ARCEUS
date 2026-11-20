'use client'

import * as React from 'react'
import type {
  GoldMarketData,
  GoldMarketSnapshot,
  GoldMarketState,
} from '@/lib/goldprism/gold-market'

const REFRESH_INTERVAL_MS = 30_000
let marketRequest: Promise<GoldMarketSnapshot> | null = null

function isSnapshot(value: unknown): value is GoldMarketSnapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as Record<string, unknown>
  const validQuote = (quote: unknown) =>
    !!quote &&
    typeof quote === 'object' &&
    typeof (quote as Record<string, unknown>).usd === 'number' &&
    typeof (quote as Record<string, unknown>).inr === 'number' &&
    typeof (quote as Record<string, unknown>).usd_24h_change === 'number'

  return (
    validQuote(snapshot.paxg) &&
    validQuote(snapshot.xaut) &&
    typeof snapshot.usdInr === 'number' &&
    typeof snapshot.fetchedAt === 'string'
  )
}

function fetchLiveSnapshot(): Promise<GoldMarketSnapshot> {
  if (!marketRequest) {
    marketRequest = (async () => {
      try {
        const response = await fetch('/api/gold-market', { cache: 'no-store' })
        const payload: unknown = await response.json()
        if (!response.ok) {
          const message =
            payload &&
            typeof payload === 'object' &&
            'error' in payload &&
            typeof payload.error === 'string'
              ? payload.error
              : 'Unable to fetch live gold prices.'
          throw new Error(message)
        }
        if (!isSnapshot(payload)) {
          throw new Error('The live gold price response was invalid.')
        }
        return payload
      } finally {
        marketRequest = null
      }
    })()
  }
  return marketRequest
}

export function useGoldMarket(): GoldMarketState {
  const [state, setState] = React.useState<GoldMarketState>({
    status: 'loading',
    data: null,
    error: null,
  })

  React.useEffect(() => {
    let active = true
    let requestInFlight = false

    const refresh = async () => {
      if (requestInFlight) return
      requestInFlight = true
      try {
        const payload = await fetchLiveSnapshot()
        const data: GoldMarketData = payload
        if (active) setState({ status: 'live', data, error: null })
      } catch (error) {
        if (active) {
          setState({
            status: 'error',
            data: null,
            error: error instanceof Error ? error.message : 'Unable to fetch live gold prices.',
          })
        }
      } finally {
        requestInFlight = false
      }
    }

    void refresh()
    const timer = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  return state
}
