'use client'

import * as React from 'react'
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import {
  auth,
  db,
  ensureUserWorkspace,
  googleProvider,
  OperationType,
  persistCloseTradeToCloud,
  persistOpenTradeToCloud,
  resetCloudWorkspaceTrades,
} from '@/lib/firebase/client'
import { SupportedContractCode } from '@/lib/goldprism/contract-master'
import type { LiveFeedHistoryRecord, LiveFeedResponse } from '@/lib/goldprism/live-feed'
import type { McxSnapshotResponse } from '@/lib/goldprism/mcx-snapshot'
import {
  ClosedPaperTrade,
  evaluateTradePlan,
  INITIAL_PAPER_CAPITAL_INR,
  PaperPosition,
  TradeIntentInput,
  valuatePaperPosition,
} from '@/lib/goldprism/trade-engine'
import { calculateTransactionCosts, DEFAULT_COST_CONFIG } from '@/lib/goldprism/transaction-costs'
import {
  describeFirebaseAuthError,
  describeFirebaseSyncError,
} from '@/lib/firebase/auth-error'

const STORAGE_KEY = 'goldprism_one_click_portfolio_v1'
const POLL_INTERVAL_MS = 10_000
const HISTORY_POLL_INTERVAL_MS = 60_000

interface StoredPortfolio {
  cashInr: number
  positions: PaperPosition[]
  closedTrades: ClosedPaperTrade[]
}

const DEFAULT_PORTFOLIO: StoredPortfolio = {
  cashInr: INITIAL_PAPER_CAPITAL_INR,
  positions: [],
  closedTrades: [],
}

function isLiveFeedHistoryRecord(value: unknown): value is LiveFeedHistoryRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (
    typeof record.bucketAt !== 'string' ||
    typeof record.asOf !== 'string' ||
    record.status !== 'LIVE_PARITY' ||
    typeof record.payload !== 'object' ||
    record.payload === null
  ) {
    return false
  }

  const payload = record.payload as Record<string, unknown>
  if (
    payload.status !== 'LIVE_PARITY' ||
    typeof payload.benchmarks !== 'object' ||
    payload.benchmarks === null ||
    typeof payload.contracts !== 'object' ||
    payload.contracts === null
  ) {
    return false
  }

  const benchmarks = payload.benchmarks as Record<string, unknown>
  return (
    (typeof benchmarks.xauUsd === 'number' || benchmarks.xauUsd === null) &&
    (typeof benchmarks.comexGcUsd === 'number' || benchmarks.comexGcUsd === null)
  )
}

export interface LiveFeedContextValue {
  feed: LiveFeedResponse | null
  feedRequestError: string | null
  marketHistory: LiveFeedHistoryRecord[]
  marketHistoryLoading: boolean
  marketHistoryError: string | null
  refreshMarketHistory: () => Promise<void>
  loading: boolean
  refreshing: boolean
  autoRefresh: boolean
  setAutoRefresh: React.Dispatch<React.SetStateAction<boolean>>
  refreshFeed: (force?: boolean) => Promise<void>
  tickCount: number
  lastUpdatedAtMs: number | null
  livePricesMap: Partial<Record<SupportedContractCode, number>>
  /** Real MCX bhavcopy snapshot (results/mcx-live-snapshot.json via scripts/fetch_mcx_snapshot.py). */
  mcxSnapshot: McxSnapshotResponse | null
  mcxSnapshotError: string | null
  /** Paper mark prices come from the indicative parity model, never bhavcopy closes. */
  pricesSource: 'parity' | 'none'

  // Firebase Auth & Cloud Sync State
  user: User | null
  authReady: boolean
  authBusy: boolean
  authError: string | null
  cloudSynced: boolean
  signInWithGoogle: () => Promise<void>
  signOutUser: () => Promise<void>

  // Synchronized One-Click Paper Portfolio
  cashInr: number
  marginBlockedInr: number
  unrealizedPnlInr: number
  realizedPnlInr: number
  equityInr: number
  positions: PaperPosition[]
  closedTrades: ClosedPaperTrade[]
  executeOneClickTrade: (
    intent: TradeIntentInput,
    options?: { allowDisciplineOverride?: boolean }
  ) => { ok: boolean; message: string; position?: PaperPosition }
  closePosition: (positionId: string) => { ok: boolean; message: string; trade?: ClosedPaperTrade }
  resetPortfolio: () => void
}

const LiveFeedContext = React.createContext<LiveFeedContextValue | null>(null)

export function LiveFeedProvider({ children }: { children: React.ReactNode }) {
  const [feed, setFeed] = React.useState<LiveFeedResponse | null>(null)
  const [feedRequestError, setFeedRequestError] = React.useState<string | null>(null)
  const [marketHistory, setMarketHistory] = React.useState<LiveFeedHistoryRecord[]>([])
  const [marketHistoryLoading, setMarketHistoryLoading] = React.useState<boolean>(true)
  const [marketHistoryError, setMarketHistoryError] = React.useState<string | null>(null)
  const [marketHistoryUnavailable, setMarketHistoryUnavailable] = React.useState<boolean>(false)
  const [mcxSnapshot, setMcxSnapshot] = React.useState<McxSnapshotResponse | null>(null)
  const [mcxSnapshotError, setMcxSnapshotError] = React.useState<string | null>(null)
  const [pricesSource, setPricesSource] = React.useState<'parity' | 'none'>('none')
  const [loading, setLoading] = React.useState<boolean>(true)
  const [refreshing, setRefreshing] = React.useState<boolean>(false)
  const [autoRefresh, setAutoRefresh] = React.useState<boolean>(true)
  const [tickCount, setTickCount] = React.useState<number>(0)
  const [lastUpdatedAtMs, setLastUpdatedAtMs] = React.useState<number | null>(null)

  const [portfolio, setPortfolio] = React.useState<StoredPortfolio>(DEFAULT_PORTFOLIO)
  const [hydrated, setHydrated] = React.useState<boolean>(false)

  // Firebase Auth state
  const [user, setUser] = React.useState<User | null>(null)
  const [authReady, setAuthReady] = React.useState<boolean>(false)
  const [authBusy, setAuthBusy] = React.useState<boolean>(false)
  const [authError, setAuthError] = React.useState<string | null>(null)
  const [cloudSynced, setCloudSynced] = React.useState<boolean>(false)

  // Track Firebase auth
  React.useEffect(() => {
    const unsub = onAuthStateChanged(
      auth,
      (nextUser) => {
        setUser(nextUser)
        setAuthReady(true)
        setAuthError(null)
        if (!nextUser) setCloudSynced(false)
      },
      (error) => {
        setUser(null)
        setAuthReady(true)
        setCloudSynced(false)
        setAuthError(describeFirebaseAuthError(error))
      }
    )
    return () => unsub()
  }, [])

  // Sync authenticated trader's workspace + trades from Firestore
  React.useEffect(() => {
    if (!authReady || !user) return
    let unsubWorkspace: (() => void) | undefined
    let unsubTrades: (() => void) | undefined
    let active = true
    let workspaceReady = false
    let tradesReady = false

    const uid = user.uid
    setCloudSynced(false)
    setAuthError(null)
    const updateCloudSyncStatus = () => {
      if (active) setCloudSynced(workspaceReady && tradesReady)
    }

    void (async () => {
      try {
        await ensureUserWorkspace({
          uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          initialCashInr: INITIAL_PAPER_CAPITAL_INR,
        })
        if (!active) return

        unsubWorkspace = onSnapshot(
          doc(db, 'users', uid),
          { includeMetadataChanges: true },
          (snap) => {
            if (snap.exists()) {
              const data = snap.data()
              if (typeof data.cashInr === 'number') {
                setPortfolio((prev) => ({
                  ...prev,
                  cashInr: data.cashInr,
                }))
              }
            }
            workspaceReady = !snap.metadata.fromCache
            updateCloudSyncStatus()
          },
          (error) => {
            if (!active) return
            workspaceReady = false
            updateCloudSyncStatus()
            setAuthError(describeFirebaseSyncError(error))
            console.error('Firestore workspace listener failed', { operation: OperationType.GET })
          }
        )

        const tradesQuery = query(
          collection(db, 'users', uid, 'trades'),
          where('ownerId', '==', uid)
        )
        unsubTrades = onSnapshot(
          tradesQuery,
          { includeMetadataChanges: true },
          (snap) => {
            const openList: PaperPosition[] = []
            const closedList: ClosedPaperTrade[] = []
            for (const d of snap.docs) {
              const raw = d.data()
              const base: PaperPosition = {
                id: String(raw.id ?? d.id),
                openedAt: String(raw.openedAt ?? ''),
                asOfPrice: String(raw.asOfPrice ?? ''),
                sourceLabel: String(raw.sourceLabel ?? ''),
                kind: raw.kind === 'SPREAD' ? 'SPREAD' : 'SINGLE',
                side: raw.side,
                headline: String(raw.headline ?? ''),
                verdictAtEntry: raw.verdictAtEntry,
                disciplineOverridden: Boolean(raw.disciplineOverridden),
                contractA: raw.contractA,
                entryPriceA: Number(raw.entryPriceA ?? 0),
                lotsA: Number(raw.lotsA ?? 1),
                gramsA: Number(raw.gramsA ?? 10),
                expiryA: String(raw.expiryA ?? ''),
                contractB: raw.contractB,
                entryPriceB: typeof raw.entryPriceB === 'number' ? raw.entryPriceB : undefined,
                lotsB: typeof raw.lotsB === 'number' ? raw.lotsB : undefined,
                gramsB: typeof raw.gramsB === 'number' ? raw.gramsB : undefined,
                expiryB: typeof raw.expiryB === 'string' ? raw.expiryB : undefined,
                marginBlockedInr: Number(raw.marginBlockedInr ?? 0),
                entryFeeInr: Number(raw.entryFeeInr ?? 0),
                rationale: String(raw.rationale ?? ''),
              }

              if (raw.status === 'CLOSED') {
                closedList.push({
                  ...base,
                  closedAt: String(raw.closedAt ?? ''),
                  exitPriceA: Number(raw.exitPriceA ?? base.entryPriceA),
                  exitPriceB: typeof raw.exitPriceB === 'number' ? raw.exitPriceB : undefined,
                  exitFeeInr: Number(raw.exitFeeInr ?? 0),
                  grossPnlInr: Number(raw.grossPnlInr ?? 0),
                  netPnlInr: Number(raw.netPnlInr ?? 0),
                  returnOnMarginPct: Number(raw.returnOnMarginPct ?? 0),
                })
              } else {
                openList.push(base)
              }
            }
            openList.sort((a, b) => b.openedAt.localeCompare(a.openedAt))
            closedList.sort((a, b) => b.closedAt.localeCompare(a.closedAt))
            setPortfolio((prev) => ({
              ...prev,
              positions: openList,
              closedTrades: closedList,
            }))
            tradesReady = !snap.metadata.fromCache
            updateCloudSyncStatus()
          },
          (error) => {
            if (!active) return
            tradesReady = false
            updateCloudSyncStatus()
            setAuthError(describeFirebaseSyncError(error))
            console.error('Firestore trade listener failed', { operation: OperationType.LIST })
          }
        )
      } catch (err) {
        if (!active) return
        setCloudSynced(false)
        setAuthError(describeFirebaseSyncError(err))
      }
    })()

    return () => {
      active = false
      if (unsubWorkspace) unsubWorkspace()
      if (unsubTrades) unsubTrades()
    }
  }, [authReady, user])

  // Hydrate localStorage portfolio safely for signed-out sessions
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredPortfolio>
        if (
          typeof parsed.cashInr === 'number' &&
          Array.isArray(parsed.positions) &&
          Array.isArray(parsed.closedTrades)
        ) {
          setPortfolio({
            cashInr: parsed.cashInr,
            positions: parsed.positions,
            closedTrades: parsed.closedTrades,
          })
        }
      }
    } catch {
      // Ignore corrupt storage
    } finally {
      setHydrated(true)
    }
  }, [])

  React.useEffect(() => {
    if (!hydrated || user) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio))
    } catch {
      // Ignore storage quota errors
    }
  }, [portfolio, hydrated, user])

  const signInWithGoogle = React.useCallback(async () => {
    setAuthBusy(true)
    setAuthError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      setAuthError(describeFirebaseAuthError(err))
    } finally {
      setAuthBusy(false)
    }
  }, [])

  const signOutUser = React.useCallback(async () => {
    setAuthBusy(true)
    setAuthError(null)
    try {
      await signOut(auth)
      setPortfolio(DEFAULT_PORTFOLIO)
    } catch (err) {
      setAuthError(describeFirebaseAuthError(err))
    } finally {
      setAuthBusy(false)
    }
  }, [])

  const refreshFeed = React.useCallback(async (force = false) => {
    setRefreshing(true)
    try {
      const url = force ? '/api/goldprism/live-feed?refresh=1' : '/api/goldprism/live-feed'
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as LiveFeedResponse
      setFeed(data)
      setFeedRequestError(null)
      setTickCount((c) => c + 1)
      setLastUpdatedAtMs(Date.now())
    } catch (error) {
      setFeedRequestError(
        error instanceof Error ? error.message : 'Live market feed request failed'
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const refreshMarketHistory = React.useCallback(async () => {
    try {
      const res = await fetch('/api/goldprism/live-history?limit=120', { cache: 'no-store' })
      const data = (await res.json()) as {
        records?: unknown
        error?: string
        status?: string
      }
      if (!res.ok) {
        if (res.status === 503 && data.status === 'UNAVAILABLE') {
          setMarketHistoryUnavailable(true)
        }
        throw new Error(data.error || `Market history request failed (HTTP ${res.status})`)
      }
      if (!Array.isArray(data.records)) {
        throw new Error('Market history API returned an invalid response')
      }
      const records = data.records.filter(isLiveFeedHistoryRecord)
      if (records.length !== data.records.length) {
        throw new Error('Market history API returned an invalid snapshot')
      }
      setMarketHistory(records)
      setMarketHistoryError(null)
    } catch (error) {
      setMarketHistoryError(
        error instanceof Error ? error.message : 'Failed to load PostgreSQL market history'
      )
    } finally {
      setMarketHistoryLoading(false)
    }
  }, [])

  const refreshMcxSnapshot = React.useCallback(async () => {
    try {
      const res = await fetch('/api/goldprism/mcx-snapshot', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as McxSnapshotResponse
      setMcxSnapshot(data)
      setMcxSnapshotError(data.status === 'UNAVAILABLE' ? data.error : null)
    } catch (error) {
      setMcxSnapshot(null)
      setMcxSnapshotError(
        error instanceof TypeError
          ? 'Unable to reach the MCX snapshot service. Retrying automatically.'
          : `Unable to load the MCX snapshot${error instanceof Error ? ` (${error.message})` : ''}. Retrying automatically.`
      )
    }
  }, [])

  React.useEffect(() => {
    refreshFeed(false)
    refreshMcxSnapshot()
  }, [refreshFeed, refreshMcxSnapshot])

  React.useEffect(() => {
    if (
      feed?.status === 'LIVE_PARITY' &&
      feed.archive?.status === 'unavailable'
    ) {
      setMarketHistoryUnavailable(true)
      setMarketHistoryError(
        feed.archive.message ?? 'Configure DATABASE_URL to enable PostgreSQL market history.'
      )
      setMarketHistoryLoading(false)
      return
    }
    if (marketHistoryUnavailable || !feed) return

    void refreshMarketHistory()
    const timer = window.setInterval(() => {
      void refreshMarketHistory()
    }, HISTORY_POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [
    feed?.status,
    feed?.archive?.status,
    feed?.archive?.message,
    marketHistoryUnavailable,
    refreshMarketHistory,
  ])

  React.useEffect(() => {
    if (!autoRefresh) return
    const timer = window.setInterval(() => {
      refreshFeed(true)
      refreshMcxSnapshot()
    }, POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [autoRefresh, refreshFeed, refreshMcxSnapshot])

  const livePricesMap = React.useMemo<Partial<Record<SupportedContractCode, number>>>(() => {
    // Bhavcopy closes are settlement references, not streaming quotes.
    // Mark paper positions against the refreshed parity feed instead.
    if (!feed?.contracts) return {}
    return {
      GOLDM: feed.contracts.GOLDM.quotedPrice,
      GOLDTEN: feed.contracts.GOLDTEN.quotedPrice,
      GOLDGUINEA: feed.contracts.GOLDGUINEA.quotedPrice,
      GOLDPETAL: feed.contracts.GOLDPETAL.quotedPrice,
    }
  }, [feed])

  React.useEffect(() => {
    setPricesSource(feed?.contracts ? 'parity' : 'none')
  }, [feed])

  const executeOneClickTrade = React.useCallback(
    (
      intent: TradeIntentInput,
      options?: { allowDisciplineOverride?: boolean }
    ): { ok: boolean; message: string; position?: PaperPosition } => {
      const { plan, canExecute, blockerMessage } = evaluateTradePlan(intent, portfolio.cashInr)
      if (!canExecute) {
        return { ok: false, message: blockerMessage ?? 'Order rejected by pre-trade gate.' }
      }
      if (plan.requiresDisciplineOverride && !options?.allowDisciplineOverride) {
        return {
          ok: false,
          message:
            plan.warningReason ??
            'Discipline gate requires explicit acknowledgment before paper-testing a negative-edge trade.',
        }
      }

      const entryFeeInr = Number((plan.estimatedFeeInr * 0.5).toFixed(2))
      const uniqueSuffix =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID().slice(0, 6).toUpperCase()
          : String(portfolio.positions.length + portfolio.closedTrades.length + 1).padStart(4, '0')
      const pos: PaperPosition = {
        id: `GP-${Date.now().toString(36).toUpperCase()}-${uniqueSuffix}`,
        openedAt: new Date().toISOString(),
        asOfPrice: plan.asOf,
        sourceLabel: plan.sourceLabel,
        kind: plan.kind,
        side: plan.side,
        headline: plan.headline,
        verdictAtEntry: plan.verdict,
        disciplineOverridden: Boolean(plan.requiresDisciplineOverride && options?.allowDisciplineOverride),
        contractA: plan.contractA,
        entryPriceA: plan.priceA,
        lotsA: plan.lotsA,
        gramsA: plan.gramsA,
        expiryA: plan.expiryA,
        contractB: plan.contractB,
        entryPriceB: plan.priceB,
        lotsB: plan.lotsB,
        gramsB: plan.gramsB,
        expiryB: plan.expiryB,
        marginBlockedInr: plan.marginRequiredInr,
        entryFeeInr,
        rationale: intent.rationale ?? plan.plainEnglishSummary,
      }

      const nextCash = Number((portfolio.cashInr - pos.marginBlockedInr - pos.entryFeeInr).toFixed(2))

      setPortfolio((prev) => ({
        ...prev,
        cashInr: nextCash,
        positions: [pos, ...prev.positions],
      }))

      if (user) {
        void persistOpenTradeToCloud(user.uid, pos, nextCash).catch((e) =>
          setAuthError(describeFirebaseSyncError(e))
        )
      }

      return {
        ok: true,
        message: `Executed ${pos.headline} · Margin blocked ₹${pos.marginBlockedInr.toLocaleString('en-IN')}`,
        position: pos,
      }
    },
    [portfolio.cashInr, portfolio.positions.length, portfolio.closedTrades.length, user]
  )

  const closePosition = React.useCallback(
    (positionId: string): { ok: boolean; message: string; trade?: ClosedPaperTrade } => {
      const target = portfolio.positions.find((p) => p.id === positionId)
      if (!target) {
        return { ok: false, message: 'Position not found.' }
      }

      const valuation = valuatePaperPosition(target, livePricesMap)
      const exitFeeA =
        calculateTransactionCosts(
          valuation.currentPriceA,
          target.contractA,
          target.lotsA,
          DEFAULT_COST_CONFIG
        ).totalRoundTripInr * 0.5
      const exitFeeB =
        target.kind === 'SPREAD' && target.contractB && valuation.currentPriceB && target.lotsB
          ? calculateTransactionCosts(
              valuation.currentPriceB,
              target.contractB,
              target.lotsB,
              DEFAULT_COST_CONFIG
            ).totalRoundTripInr * 0.5
          : 0
      const exitFeeInr = Number((exitFeeA + exitFeeB).toFixed(2))
      const netPnlInr = Number((valuation.grossPnlInr - target.entryFeeInr - exitFeeInr).toFixed(2))

      const closed: ClosedPaperTrade = {
        ...target,
        closedAt: new Date().toISOString(),
        exitPriceA: valuation.currentPriceA,
        exitPriceB: valuation.currentPriceB,
        exitFeeInr,
        grossPnlInr: valuation.grossPnlInr,
        netPnlInr,
        returnOnMarginPct:
          target.marginBlockedInr > 0
            ? Number(((netPnlInr / target.marginBlockedInr) * 100).toFixed(2))
            : 0,
      }

      const nextCash = Number(
        (portfolio.cashInr + target.marginBlockedInr + valuation.grossPnlInr - exitFeeInr).toFixed(2)
      )

      setPortfolio((prev) => ({
        cashInr: nextCash,
        positions: prev.positions.filter((p) => p.id !== positionId),
        closedTrades: [closed, ...prev.closedTrades],
      }))

      if (user) {
        void persistCloseTradeToCloud(user.uid, closed, nextCash).catch((e) =>
          setAuthError(describeFirebaseSyncError(e))
        )
      }

      return {
        ok: true,
        message: `Closed ${closed.headline} · Net P&L ₹${closed.netPnlInr.toLocaleString('en-IN')}`,
        trade: closed,
      }
    },
    [portfolio.positions, portfolio.cashInr, livePricesMap, user]
  )

  const resetPortfolio = React.useCallback(() => {
    setPortfolio(DEFAULT_PORTFOLIO)
    if (user) {
      void resetCloudWorkspaceTrades(user.uid).catch((e) =>
        setAuthError(describeFirebaseSyncError(e))
      )
    }
  }, [user])

  const marginBlockedInr = React.useMemo(
    () =>
      Number(
        portfolio.positions.reduce((acc, p) => acc + p.marginBlockedInr, 0).toFixed(2)
      ),
    [portfolio.positions]
  )

  const unrealizedPnlInr = React.useMemo(
    () =>
      Number(
        portfolio.positions
          .reduce((acc, p) => acc + valuatePaperPosition(p, livePricesMap).netMtmPnlInr, 0)
          .toFixed(2)
      ),
    [portfolio.positions, livePricesMap]
  )

  const realizedPnlInr = React.useMemo(
    () =>
      Number(
        portfolio.closedTrades.reduce((acc, t) => acc + t.netPnlInr, 0).toFixed(2)
      ),
    [portfolio.closedTrades]
  )

  const equityInr = Number(
    (portfolio.cashInr + marginBlockedInr + unrealizedPnlInr).toFixed(2)
  )

  const value: LiveFeedContextValue = {
    feed,
    feedRequestError,
    marketHistory,
    marketHistoryLoading,
    marketHistoryError,
    refreshMarketHistory,
    loading,
    refreshing,
    autoRefresh,
    setAutoRefresh,
    refreshFeed,
    tickCount,
    lastUpdatedAtMs,
    livePricesMap,
    mcxSnapshot,
    mcxSnapshotError,
    pricesSource,
    user,
    authReady,
    authBusy,
    authError,
    cloudSynced,
    signInWithGoogle,
    signOutUser,
    cashInr: portfolio.cashInr,
    marginBlockedInr,
    unrealizedPnlInr,
    realizedPnlInr,
    equityInr,
    positions: portfolio.positions,
    closedTrades: portfolio.closedTrades,
    executeOneClickTrade,
    closePosition,
    resetPortfolio,
  }

  return <LiveFeedContext.Provider value={value}>{children}</LiveFeedContext.Provider>
}

export function useLiveFeed(): LiveFeedContextValue {
  const ctx = React.useContext(LiveFeedContext)
  if (!ctx) {
    throw new Error('useLiveFeed must be used within LiveFeedProvider')
  }
  return ctx
}
