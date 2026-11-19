'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  Cloud,
  Database,
  Download,
  History,
  Layers3,
  LayoutDashboard,
  LogIn,
  LogOut,
  Pause,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  Scale,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react'
import { useLiveFeed } from '@/components/goldprism/LiveFeedProvider'
import { OneClickTradeBar } from '@/components/goldprism/OneClickTradeBar'
import { TradeCopilotChat } from '@/components/goldprism/TradeCopilotChat'
import { DataTag, Metric, VerdictTag } from '@/components/goldprism/brand'
import { fetchRecentCopilotLogs } from '@/lib/firebase/client'
import { SupportedContractCode } from '@/lib/goldprism/contract-master'
import { compareNormalizedContracts, contractSpecs } from '@/lib/goldprism/contract-specs'
import { bps, inr, inrPerG } from '@/lib/goldprism/format'
import { rankBestVehicleForExposure } from '@/lib/goldprism/signal'
import { TradeIntentInput, valuatePaperPosition } from '@/lib/goldprism/trade-engine'
import { computeXRayWaterfall } from '@/lib/goldprism/xray'
import { cn } from '@/lib/utils'

const SYMBOLS: SupportedContractCode[] = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL']

type WorkspaceTab =
  | 'overview'
  | 'quotes'
  | 'xray'
  | 'normalization'
  | 'hedge'
  | 'positions'
  | 'copilot'

const TABS: Array<{ id: WorkspaceTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'quotes', label: 'Quotes & 1-Click', icon: Zap },
  { id: 'xray', label: 'X-Ray Analyzer', icon: Layers3 },
  { id: 'normalization', label: '10g Normalization', icon: Scale },
  { id: 'hedge', label: 'Best-Vehicle Hedge', icon: ShieldCheck },
  { id: 'positions', label: 'Positions & Ledger', icon: Activity },
  { id: 'copilot', label: 'Copilot & Logs', icon: Bot },
]

export function CommandDashboard() {
  const {
    feed,
    loading,
    refreshing,
    autoRefresh,
    setAutoRefresh,
    refreshFeed,
    tickCount,
    livePricesMap,
    user,
    authReady,
    authBusy,
    authError,
    cloudSynced,
    signInWithGoogle,
    signOutUser,
    cashInr,
    marginBlockedInr,
    unrealizedPnlInr,
    realizedPnlInr,
    equityInr,
    positions,
    closedTrades,
    executeOneClickTrade,
    closePosition,
    resetPortfolio,
  } = useLiveFeed()

  const [activeTab, setActiveTab] = React.useState<WorkspaceTab>('overview')
  const [pairA, setPairA] = React.useState<SupportedContractCode>('GOLDTEN')
  const [pairB, setPairB] = React.useState<SupportedContractCode>('GOLDM')
  const [exposureG, setExposureG] = React.useState<number>(50)
  const [notice, setNotice] = React.useState<{ ok: boolean; text: string } | null>(null)
  const [guestBypass, setGuestBypass] = React.useState<boolean>(false)
  const [copilotLogs, setCopilotLogs] = React.useState<
    Array<{ id: string; prompt: string; reply: string }>
  >([])
  const [logsLoading, setLogsLoading] = React.useState<boolean>(false)

  const contracts = feed?.contracts ?? null
  const isLive = feed?.status === 'LIVE_PARITY' && contracts !== null

  const loadCloudLogs = React.useCallback(async () => {
    if (!user) return
    setLogsLoading(true)
    try {
      const logs = await fetchRecentCopilotLogs(user.uid)
      setCopilotLogs(logs)
    } catch {
      // Ignore transient log read errors
    } finally {
      setLogsLoading(false)
    }
  }, [user])

  React.useEffect(() => {
    if (user && activeTab === 'copilot') {
      void loadCloudLogs()
    }
  }, [user, activeTab, loadCloudLogs])

  const liveXRay = React.useMemo(() => {
    if (!contracts) return null
    const qA = contracts[pairA]
    const qB = contracts[pairB]
    const carryProxy =
      typeof feed?.benchmarks.comexBasisAnnualizedPct === 'number' &&
      feed.benchmarks.comexBasisAnnualizedPct > 0 &&
      feed.benchmarks.comexBasisAnnualizedPct < 20
        ? feed.benchmarks.comexBasisAnnualizedPct / 100
        : 0.065

    return computeXRayWaterfall({
      contractA: pairA,
      priceAQuoted: qA.quotedPrice,
      expiryA: qA.expiryDate,
      contractB: pairB,
      priceBQuoted: qB.quotedPrice,
      expiryB: qB.expiryDate,
      tradeDate: (feed?.asOf ?? new Date().toISOString()).slice(0, 10),
      annualCarryRate: carryProxy,
      settlementArtifactInrPerG: 0,
    })
  }, [contracts, pairA, pairB, feed])

  const normalizedRows = React.useMemo(() => {
    if (!contracts) return []
    return compareNormalizedContracts(
      SYMBOLS.map((sym) => ({
        symbol: sym,
        quotedPrice: contracts[sym].quotedPrice,
        expiryDate: contracts[sym].expiryDate,
        asOf: contracts[sym].asOf.slice(0, 19).replace('T', ' '),
        source: contracts[sym].source,
      })),
      'GOLDM'
    )
  }, [contracts])

  const vehicleRankings = React.useMemo(() => {
    if (!contracts) return []
    return rankBestVehicleForExposure(exposureG, {
      GOLDM: contracts.GOLDM.quotedPrice,
      GOLDTEN: contracts.GOLDTEN.quotedPrice,
      GOLDGUINEA: contracts.GOLDGUINEA.quotedPrice,
      GOLDPETAL: contracts.GOLDPETAL.quotedPrice,
    })
  }, [exposureG, contracts])

  const topVehicle = vehicleRankings[0]

  const spreadIntent: TradeIntentInput | null = React.useMemo(() => {
    if (!contracts || !liveXRay) return null
    return {
      kind: 'SPREAD',
      side: liveXRay.netEdgeInrPerG >= 0 ? 'SHORT_A_LONG_B' : 'LONG_A_SHORT_B',
      contractA: pairA,
      priceA: contracts[pairA].quotedPrice,
      lotsA: 1,
      expiryA: contracts[pairA].expiryDate,
      contractB: pairB,
      priceB: contracts[pairB].quotedPrice,
      lotsB: 1,
      expiryB: contracts[pairB].expiryDate,
      verdict: liveXRay.verdict,
      netEdgeBps: liveXRay.netEdgeBps,
      netEdgeInrPerG: liveXRay.netEdgeInrPerG,
      rationale: liveXRay.verdictMessage,
      sourceLabel: 'Dashboard Live X-Ray Parity',
      asOf: feed?.asOf,
    }
  }, [contracts, liveXRay, pairA, pairB, feed?.asOf])

  const handleQuickOrder = (sym: SupportedContractCode, side: 'BUY' | 'SELL') => {
    if (!contracts) return
    const q = contracts[sym]
    const res = executeOneClickTrade({
      kind: 'SINGLE',
      side,
      contractA: sym,
      priceA: q.quotedPrice,
      lotsA: 1,
      expiryA: q.expiryDate,
      sourceLabel: q.source,
      asOf: q.asOf,
      rationale: `Dashboard 1-Click ${side} 1 lot ${sym} (${contractSpecs[sym].tradingUnitGrams}g).`,
    })
    setNotice({ ok: res.ok, text: res.message })
  }

  const handleQuickHedge = () => {
    if (!contracts || !topVehicle) return
    const q = contracts[topVehicle.contractCode]
    const res = executeOneClickTrade({
      kind: 'SINGLE',
      side: 'BUY',
      contractA: topVehicle.contractCode,
      priceA: q.quotedPrice,
      lotsA: topVehicle.lotsRequired,
      expiryA: q.expiryDate,
      sourceLabel: q.source,
      asOf: q.asOf,
      rationale: topVehicle.rationale,
    })
    setNotice({ ok: res.ok, text: res.message })
  }

  const exportLedgerCsv = () => {
    const header = [
      'ID',
      'Status',
      'Headline',
      'Side',
      'LotsA',
      'EntryPriceA',
      'ExitPriceA',
      'NetPnlInr',
      'OpenedAt',
      'ClosedAt',
    ]
    const rows = [
      ...positions.map((p) => {
        const val = valuatePaperPosition(p, livePricesMap)
        return [
          p.id,
          'OPEN',
          `"${p.headline}"`,
          p.side,
          p.lotsA,
          p.entryPriceA,
          val.currentPriceA,
          val.netMtmPnlInr,
          p.openedAt,
          '',
        ].join(',')
      }),
      ...closedTrades.map((t) =>
        [
          t.id,
          'CLOSED',
          `"${t.headline}"`,
          t.side,
          t.lotsA,
          t.entryPriceA,
          t.exitPriceA,
          t.netPnlInr,
          t.openedAt,
          t.closedAt,
        ].join(',')
      ),
    ]
    const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `goldprism-ledger-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Signed-Out Authentication Gate
  if (authReady && !user && !guestBypass) {
    return (
      <section className="relative overflow-hidden border-b border-border bg-background">
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
          <img
            src="/assets/aistudio/image_4b7aab2b.png"
            alt=""
            className="h-full w-full object-cover object-right opacity-[0.22] dark:opacity-[0.20]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#F7F4EC] via-[#F7F4EC]/92 to-[#F7F4EC]/72 dark:from-[#171613] dark:via-[#171613]/92 dark:to-[#171613]/75" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#F7F4EC] via-transparent to-[#F7F4EC]/40 dark:from-[#171613] dark:via-transparent dark:to-[#171613]/45" />
        </div>

        <div className="relative z-10 mx-auto max-w-[1360px] px-4 py-10 md:py-14">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,52%)_minmax(0,48%)] lg:items-center">
            <div>
              <p className="gp-kicker text-[var(--gp-gold-ink)]">Authenticated Workspace · Cloud Synced</p>
              <h1 className="gp-title mt-2.5 text-balance">
                Sign in to sync your paper-trading desk and Firestore workspace.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Authenticate with Google to unlock your ₹10,00,000 paper margin account, live
                live global-to-MCX parity estimates, X-Ray spread verdicts, 1-Click paper-trade ledger, and
                Trade Copilot AI—synced automatically to Cloud Firestore across sessions.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void signInWithGoogle()}
                  disabled={authBusy}
                  className="gp-button gp-button--primary whitespace-nowrap"
                >
                  <LogIn className="h-4 w-4" />
                  {authBusy ? 'Signing in…' : 'Sign in with Google'}
                </button>
                <button
                  type="button"
                  onClick={() => setGuestBypass(true)}
                  className="gp-button whitespace-nowrap"
                >
                  Continue as Local Preview
                </button>
              </div>

              {authError ? (
                <p className="mt-4 font-mono text-xs text-[var(--gp-blocked-ink)]">{authError}</p>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-[4px] border border-border bg-card/95 backdrop-blur-xs shadow-[var(--gp-hard-shadow)]">
              <div className="flex items-center justify-between border-b border-border bg-[var(--gp-vellum)]/65 px-4 py-2.5">
                <p className="gp-label text-foreground">Live Market Feed Preview</p>
                <DataTag
                  live={isLive}
                  synthetic={!isLive}
                  detail={
                    isLive && feed?.asOf
                      ? `${feed.asOf.slice(0, 19).replace('T', ' ')} UTC`
                      : loading
                        ? 'syncing'
                        : 'offline'
                  }
                />
              </div>
              <div className="overflow-x-auto">
                <table className="gp-table">
                  <thead>
                    <tr>
                      <th>Contract</th>
                      <th className="gp-num">Raw Quote</th>
                      <th className="gp-num">10g Pure Gold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contracts ? (
                      SYMBOLS.map((sym) => (
                        <tr key={sym}>
                          <td className="font-medium text-foreground">{sym}</td>
                          <td className="gp-num">{inr(contracts[sym].quotedPrice, 0)}</td>
                          <td className="gp-num font-semibold text-foreground">
                            {inr(contracts[sym].normalized10gPrice, 2)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="text-muted-foreground">
                          Connecting to live Global-to-MCX parity feed…
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {feed?.benchmarks ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
                  <span>
                    XAU/USD: {feed.benchmarks.xauUsd ? `$${feed.benchmarks.xauUsd.toFixed(2)}` : '—'}
                  </span>
                  <span>
                    USD/INR: {feed.benchmarks.usdInr ? `₹${feed.benchmarks.usdInr.toFixed(2)}` : '—'}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    )
  }

  const userInitial =
    user?.displayName?.charAt(0)?.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    'G'

  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto max-w-[1360px] px-4 py-6">
        <div className="grid gap-5 lg:grid-cols-[248px_minmax(0,1fr)]">
          {/* ---------------- 248px Institutional Workspace Sidebar ---------------- */}
          <aside className="flex flex-col justify-between rounded-[4px] border border-border bg-card p-4 shadow-[var(--gp-hard-shadow)] lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
            <div className="space-y-4">
              {/* Identity Block */}
              <div className="border-b border-border pb-3.5">
                {user ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3">
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName ?? 'Trader'}
                          referrerPolicy="no-referrer"
                          className="h-9 w-9 shrink-0 rounded-full border border-border object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] border border-[var(--gp-gold-500)] bg-background font-mono text-xs font-semibold text-foreground">
                          {userInitial}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {user.displayName || 'MCX Trader'}
                        </p>
                        <p className="truncate font-mono text-[10px] text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                      <span className="inline-flex items-center gap-1.5 text-[var(--gp-tradable-ink)]">
                        <Cloud className="h-3 w-3" />
                        {cloudSynced ? 'Cloud Synced' : 'Syncing…'}
                      </span>
                      <button
                        type="button"
                        onClick={() => void signOutUser()}
                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-[var(--gp-blocked-ink)]"
                      >
                        <LogOut className="h-3 w-3" /> Sign out
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <p className="gp-label">Local Preview Session</p>
                    <p className="text-xs text-muted-foreground">
                      Sign in with Google to save positions &amp; Copilot history to Cloud Firestore.
                    </p>
                    <button
                      type="button"
                      onClick={() => void signInWithGoogle()}
                      className="gp-button gp-button--primary w-full justify-center py-2 text-[10px]"
                    >
                      <LogIn className="h-3.5 w-3.5" /> Sign in with Google
                    </button>
                  </div>
                )}
              </div>

              {/* Navigation Tabs */}
              <nav aria-label="Workspace sections" className="space-y-1">
                {TABS.map((t) => {
                  const Icon = t.icon
                  const active = activeTab === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTab(t.id)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-[4px] border px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.06em] transition-colors',
                        active
                          ? 'border-[var(--gp-gold-500)] bg-[var(--gp-gold-50)] text-foreground font-semibold dark:bg-[var(--gp-gold-900)]'
                          : 'border-transparent text-muted-foreground hover:bg-background/80 hover:text-foreground'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{t.label}</span>
                    </button>
                  )
                })}
              </nav>
            </div>

            {/* Feed & Account Quick Controls */}
            <div className="mt-6 space-y-2 border-t border-border pt-4">
              <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                <span>Live 10s Feed</span>
                <span className="text-foreground">#{tickCount}</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setAutoRefresh((v) => !v)}
                  className="gp-button min-h-0 justify-center px-2 py-1.5 text-[10px]"
                >
                  {autoRefresh ? (
                    <>
                      <Pause className="h-3 w-3" /> Live
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3" /> Paused
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void refreshFeed(true)}
                  className="gp-button min-h-0 justify-center px-2 py-1.5 text-[10px]"
                >
                  <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} /> Sync
                </button>
              </div>
              <button
                type="button"
                onClick={resetPortfolio}
                className="gp-button gp-button--danger min-h-0 w-full justify-center py-1.5 text-[10px]"
              >
                <RotateCcw className="h-3 w-3" /> Reset ₹10L Margin
              </button>
            </div>
          </aside>

          {/* ---------------- Main Workspace Canvas ---------------- */}
          <div className="min-w-0 space-y-6">
            {/* Top Contextual Workspace Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3.5">
              <div>
                <p className="gp-kicker">
                  Workspace · {TABS.find((t) => t.id === activeTab)?.label}
                </p>
                <h1 className="gp-ledger mt-1 text-xl text-foreground md:text-2xl">
                  {user
                    ? `${user.displayName?.split(' ')[0] || 'Trader'}’s MCX Command Desk`
                    : 'GoldPrism Live Command Desk'}
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <DataTag
                  live={isLive}
                  synthetic={!isLive}
                  detail={
                    isLive && feed?.asOf
                      ? `as_of ${feed.asOf.slice(0, 19).replace('T', ' ')} UTC`
                      : loading
                        ? 'connecting'
                        : 'offline'
                  }
                />
                <Link href="/replay" className="gp-button min-h-0 px-3 py-1.5 text-[10px]">
                  <History className="h-3 w-3" /> Replay Lab
                </Link>
              </div>
            </div>

            {/* 5-Column Portfolio KPI Strip */}
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border border-border bg-border shadow-[var(--gp-hard-shadow)] md:grid-cols-5">
              <div className="bg-card p-3.5">
                <Metric label="Account equity" value={inr(equityInr, 0)} tone="gold" />
              </div>
              <div className="bg-card p-3.5">
                <Metric label="Available margin" value={inr(cashInr, 0)} />
              </div>
              <div className="bg-card p-3.5">
                <Metric label="Margin blocked" value={inr(marginBlockedInr, 0)} />
              </div>
              <div className="bg-card p-3.5">
                <Metric
                  label="Live MTM P&L"
                  value={`${unrealizedPnlInr >= 0 ? '+' : ''}${inr(unrealizedPnlInr, 2)}`}
                  tone={unrealizedPnlInr >= 0 ? 'tradable' : 'blocked'}
                />
              </div>
              <div className="col-span-2 bg-card p-3.5 md:col-span-1">
                <Metric
                  label="Realized P&L"
                  value={`${realizedPnlInr >= 0 ? '+' : ''}${inr(realizedPnlInr, 2)}`}
                  tone={realizedPnlInr >= 0 ? 'tradable' : 'blocked'}
                />
              </div>
            </div>

            {notice ? (
              <div
                className={cn(
                  'flex items-center justify-between rounded-[4px] border px-4 py-2.5 font-mono text-xs',
                  notice.ok
                    ? 'border-[var(--gp-tradable-ink)] bg-card text-[var(--gp-tradable-ink)]'
                    : 'border-[var(--gp-blocked-ink)] bg-card text-[var(--gp-blocked-ink)]'
                )}
              >
                <span>{notice.text}</span>
                <button
                  type="button"
                  onClick={() => setNotice(null)}
                  className="text-[10px] uppercase underline"
                >
                  Dismiss
                </button>
              </div>
            ) : null}

            {/* SECTION: Live Quotes & 1-Click */}
            {(activeTab === 'overview' || activeTab === 'quotes') && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="gp-label text-foreground">
                    Live Contract Quotes &amp; 1-Click Execution
                  </p>
                  {feed?.benchmarks ? (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      XAU/USD {feed.benchmarks.xauUsd ? `$${feed.benchmarks.xauUsd.toFixed(2)}` : '—'} · USD/INR{' '}
                      {feed.benchmarks.usdInr ? `₹${feed.benchmarks.usdInr.toFixed(2)}` : '—'}
                    </span>
                  ) : null}
                </div>

                {!isLive ? (
                  <div className="rounded-[4px] border border-border bg-card p-5 font-mono text-xs text-muted-foreground">
                    {loading
                      ? 'Fetching live XAU/USD, COMEX GC=F & USD/INR parity quotes…'
                      : `Live feed offline (${feed?.error ?? 'upstream unavailable'}). Click Sync to retry.`}
                  </div>
                ) : (
                  <div className="grid gap-px overflow-hidden rounded-[4px] border border-border bg-border shadow-[var(--gp-hard-shadow)] sm:grid-cols-2 xl:grid-cols-4">
                    {SYMBOLS.map((sym) => {
                      const q = contracts[sym]
                      const spec = contractSpecs[sym]
                      return (
                        <div key={sym} className="flex flex-col justify-between bg-card p-4">
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-semibold text-foreground">
                                {sym}
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {spec.tradingUnitGrams}g · {(spec.purity * 1000).toFixed(0)} fine
                              </span>
                            </div>
                            <p className="gp-figure mt-2 text-xl font-semibold text-foreground">
                              {inr(q.quotedPrice, 0)}
                            </p>
                            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                              10g pure: {inr(q.normalized10gPrice, 2)}
                            </p>
                          </div>
                          <div className="mt-3.5 grid grid-cols-2 gap-2 border-t border-border pt-3">
                            <button
                              type="button"
                              onClick={() => handleQuickOrder(sym, 'BUY')}
                              className="gp-button justify-center border-[var(--gp-tradable-ink)] px-2 py-1.5 text-[10px] text-[var(--gp-tradable-ink)] hover:bg-[var(--gp-tradable)] hover:text-white"
                            >
                              <TrendingUp className="h-3 w-3" /> Buy 1
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickOrder(sym, 'SELL')}
                              className="gp-button justify-center border-[var(--gp-blocked-ink)] px-2 py-1.5 text-[10px] text-[var(--gp-blocked-ink)] hover:bg-[var(--gp-blocked)] hover:text-white"
                            >
                              <TrendingDown className="h-3 w-3" /> Sell 1
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Main Analytical Modules */}
            <div
              className={cn(
                'grid gap-5',
                activeTab === 'overview' ? 'xl:grid-cols-[minmax(0,58%)_minmax(0,42%)]' : 'grid-cols-1'
              )}
            >
              <div className="min-w-0 space-y-5">
                {(activeTab === 'overview' || activeTab === 'xray') && (
                  <div className="rounded-[4px] border border-border bg-card p-5 shadow-[var(--gp-hard-shadow)]">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                      <h2 className="gp-ledger text-base">Live X-Ray Spread Decomposition</h2>
                      <div className="flex items-center gap-2">
                        <select
                          aria-label="Select Leg A"
                          value={pairA}
                          onChange={(e) => setPairA(e.target.value as SupportedContractCode)}
                          className="gp-field gp-select w-auto px-2 text-xs"
                        >
                          {SYMBOLS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <span className="font-mono text-xs text-muted-foreground">vs</span>
                        <select
                          aria-label="Select Leg B"
                          value={pairB}
                          onChange={(e) => setPairB(e.target.value as SupportedContractCode)}
                          className="gp-field gp-select w-auto px-2 text-xs"
                        >
                          {SYMBOLS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {liveXRay ? (
                      <div className="mt-4 space-y-4">
                        <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-3">
                          <div className="bg-background p-3">
                            <p className="gp-label">Raw gap</p>
                            <p className="gp-figure mt-1 text-base">{bps(liveXRay.rawSpreadBps)}</p>
                          </div>
                          <div className="bg-background p-3">
                            <p className="gp-label">Basis + Carry</p>
                            <p className="gp-figure mt-1 text-base">
                              {bps(-(liveXRay.structuralBasisBps + liveXRay.expiryCarryBps))}
                            </p>
                          </div>
                          <div className="bg-background p-3">
                            <p className="gp-label">Statutory fees</p>
                            <p className="gp-figure mt-1 text-base">
                              {bps(-liveXRay.transactionCostsBps)}
                            </p>
                          </div>
                          <div className="bg-background p-3">
                            <p className="gp-label">Gross residual</p>
                            <p className="gp-figure mt-1 text-base">{bps(liveXRay.grossResidualBps)}</p>
                          </div>
                          <div className="bg-background p-3">
                            <p className="gp-label">Net edge</p>
                            <p className="gp-figure mt-1 text-base gp-gold-text">
                              {bps(liveXRay.netEdgeBps)}
                            </p>
                          </div>
                          <div className="bg-background p-3">
                            <p className="gp-label">Verdict</p>
                            <div className="mt-1">
                              <VerdictTag verdict={liveXRay.verdict} />
                            </div>
                          </div>
                        </div>

                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {liveXRay.verdictMessage}
                        </p>

                        {spreadIntent ? (
                          <OneClickTradeBar
                            intent={spreadIntent}
                            compact
                            title={`1-Click Spread · ${pairA}/${pairB}`}
                          />
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-4 font-mono text-xs text-muted-foreground">
                        Waiting for live quotes to run X-Ray…
                      </p>
                    )}
                  </div>
                )}

                {(activeTab === 'overview' || activeTab === 'normalization') && (
                  <div className="rounded-[4px] border border-border bg-card p-5 shadow-[var(--gp-hard-shadow)]">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                      <h2 className="gp-ledger text-base">Live 10g Pure-Gold Normalization</h2>
                      <Link
                        href="/normalization"
                        className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground hover:text-foreground"
                      >
                        Full Lab →
                      </Link>
                    </div>

                    <div className="mt-3.5 overflow-x-auto rounded-[4px] border border-border">
                      <table className="gp-table">
                        <thead>
                          <tr>
                            <th>Contract</th>
                            <th className="gp-num">Raw Quote</th>
                            <th className="gp-num">10g Pure Gold</th>
                            <th className="gp-num">vs GOLDM</th>
                          </tr>
                        </thead>
                        <tbody>
                          {normalizedRows.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="text-muted-foreground">
                                Waiting for live parity feed…
                              </td>
                            </tr>
                          ) : (
                            normalizedRows.map((row) => (
                              <tr key={row.symbol}>
                                <td className="font-medium text-foreground">
                                  {row.symbol}{' '}
                                  <span className="text-[10px] text-muted-foreground">
                                    ({row.spec.purity})
                                  </span>
                                </td>
                                <td className="gp-num">{inr(row.quotedPrice, 0)}</td>
                                <td className="gp-num font-semibold text-foreground">
                                  {inr(row.normalized10gPrice, 2)}
                                </td>
                                <td className="gp-num">
                                  {row.symbol === 'GOLDM'
                                    ? 'Baseline'
                                    : `${bps(row.spreadVsBaselineBps)}`}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {(activeTab === 'overview' || activeTab === 'hedge') && (
                  <div className="rounded-[4px] border border-border bg-card p-5 shadow-[var(--gp-hard-shadow)]">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                      <h2 className="gp-ledger text-base">Best-Vehicle Hedge Matcher</h2>
                      <div className="flex gap-1.5">
                        {[8, 10, 50, 100, 500].map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setExposureG(g)}
                            aria-pressed={exposureG === g}
                            className={cn(
                              'gp-button min-h-0 px-2.5 py-1 text-[10px]',
                              exposureG === g && 'gp-button--selected'
                            )}
                          >
                            {g}g
                          </button>
                        ))}
                      </div>
                    </div>

                    {topVehicle ? (
                      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-mono text-xs text-muted-foreground">
                            Optimal contract for {exposureG}g exposure
                          </p>
                          <p className="gp-ledger mt-1 text-xl text-foreground">
                            {topVehicle.lotsRequired} × {topVehicle.contractCode}{' '}
                            <span className="font-mono text-xs font-normal text-muted-foreground">
                              ({topVehicle.actualExposureG}g · {topVehicle.exposureMismatchPct}% mismatch ·{' '}
                              {bps(topVehicle.estimatedCostBps)} cost)
                            </span>
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">{topVehicle.rationale}</p>
                        </div>
                        <button
                          type="button"
                          disabled={!isLive}
                          onClick={handleQuickHedge}
                          className="gp-button gp-button--primary shrink-0 whitespace-nowrap"
                        >
                          <Zap className="h-3.5 w-3.5" />
                          1-Click Hedge ({topVehicle.lotsRequired} lot)
                        </button>
                      </div>
                    ) : (
                      <p className="mt-4 font-mono text-xs text-muted-foreground">
                        Waiting for live parity feed to rank vehicles…
                      </p>
                    )}

                    {activeTab === 'hedge' && vehicleRankings.length > 0 ? (
                      <div className="mt-4 overflow-x-auto rounded-[4px] border border-border">
                        <table className="gp-table">
                          <thead>
                            <tr>
                              <th>Rank</th>
                              <th>Contract</th>
                              <th className="gp-num">Lots</th>
                              <th className="gp-num">Fitted</th>
                              <th className="gp-num">Mismatch</th>
                              <th className="gp-num">Est Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {vehicleRankings.map((r) => (
                              <tr key={r.contractCode}>
                                <td className="font-mono">#{r.rank}</td>
                                <td className="font-medium">{r.contractCode}</td>
                                <td className="gp-num">{r.lotsRequired}</td>
                                <td className="gp-num">{r.actualExposureG}g</td>
                                <td className="gp-num">{r.exposureMismatchPct}%</td>
                                <td className="gp-num">{bps(r.estimatedCostBps)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                )}

                {activeTab === 'overview' && (
                  <div className="rounded-[4px] border border-border bg-card p-5 shadow-[var(--gp-hard-shadow)]">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <h2 className="gp-ledger text-base">Live Upstream Feed Health</h2>
                      <Radio className="h-4 w-4 text-[var(--gp-gold-ink)]" />
                    </div>
                    <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                      {(feed?.upstream ?? []).map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between rounded-[4px] border border-border bg-background p-3"
                        >
                          <div>
                            <p className="font-mono text-[11px] font-medium text-foreground">
                              {u.label}
                            </p>
                            <p className="font-mono text-[9px] text-muted-foreground">{u.source}</p>
                          </div>
                          <div className="text-right">
                            <p className="gp-figure text-xs text-foreground">
                              {u.available && u.price !== null ? `${u.price}` : 'Offline'}
                            </p>
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 font-mono text-[9px]',
                                u.available
                                  ? 'text-[var(--gp-tradable-ink)]'
                                  : 'text-[var(--gp-blocked-ink)]'
                              )}
                            >
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              {u.available ? 'LIVE' : 'DOWN'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3.5">
                      <Link href="/replay" className="gp-button min-h-0 px-3 py-1.5 text-[10px]">
                        <History className="h-3.5 w-3.5" /> Point-in-Time Replay
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                      <Link href="/analyst" className="gp-button min-h-0 px-3 py-1.5 text-[10px]">
                        <Database className="h-3.5 w-3.5" /> Quant Analyst Audit
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column or Full Tab Views for Copilot & Positions */}
              {(activeTab === 'overview' || activeTab === 'copilot' || activeTab === 'positions') && (
                <div className="min-w-0 space-y-5">
                  {(activeTab === 'overview' || activeTab === 'copilot') && (
                    <TradeCopilotChat embedded />
                  )}

                  {activeTab === 'copilot' && (
                    <div className="rounded-[4px] border border-border bg-card p-5 shadow-[var(--gp-hard-shadow)]">
                      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
                        <h3 className="gp-ledger text-base">Saved Cloud Copilot History</h3>
                        {user ? (
                          <button
                            type="button"
                            onClick={() => void loadCloudLogs()}
                            className="gp-button min-h-0 px-2.5 py-1 text-[10px]"
                          >
                            {logsLoading ? 'Loading…' : 'Refresh Logs'}
                          </button>
                        ) : null}
                      </div>
                      {!user ? (
                        <p className="mt-4 font-mono text-xs text-muted-foreground">
                          Sign in with Google to persist and inspect your Copilot Q&amp;A audit trail in Cloud Firestore.
                        </p>
                      ) : copilotLogs.length === 0 ? (
                        <p className="mt-4 font-mono text-xs text-muted-foreground">
                          {logsLoading
                            ? 'Loading Firestore copilot logs…'
                            : 'No cloud copilot logs recorded yet.'}
                        </p>
                      ) : (
                        <div className="mt-3 divide-y divide-border">
                          {copilotLogs.map((log) => (
                            <div key={log.id} className="py-3 text-xs">
                              <p className="font-mono font-semibold text-foreground">
                                Q: {log.prompt}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                                A: {log.reply}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {(activeTab === 'overview' || activeTab === 'positions') && (
                    <div className="overflow-hidden rounded-[4px] border border-border bg-card shadow-[var(--gp-hard-shadow)]">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-[var(--gp-gold-ink)]" />
                          <p className="gp-label">
                            Open Positions ({positions.length}) · Closed ({closedTrades.length})
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={exportLedgerCsv}
                          className="gp-button min-h-0 px-2.5 py-1 text-[10px]"
                        >
                          <Download className="h-3 w-3" /> Export CSV
                        </button>
                      </div>

                      {positions.length === 0 ? (
                        <div className="p-5 font-mono text-xs text-muted-foreground">
                          No open positions. Ask the Trade Copilot or click any 1-Click Buy/Sell
                          button to open a live MTM position.
                        </div>
                      ) : (
                        <div className="max-h-80 divide-y divide-border overflow-y-auto">
                          {positions.map((pos) => {
                            const val = valuatePaperPosition(pos, livePricesMap)
                            const posOk = val.netMtmPnlInr >= 0
                            return (
                              <div key={pos.id} className="p-3.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="font-mono text-xs font-semibold text-foreground">
                                      {pos.headline}
                                    </p>
                                    <p className="font-mono text-[10px] text-muted-foreground">
                                      Entry ₹{pos.entryPriceA.toLocaleString('en-IN')} → Live ₹
                                      {val.currentPriceA.toLocaleString('en-IN')} · Margin{' '}
                                      {inr(pos.marginBlockedInr, 0)}
                                    </p>
                                  </div>
                                  <span
                                    className={cn(
                                      'gp-figure text-xs',
                                      posOk
                                        ? 'text-[var(--gp-tradable-ink)]'
                                        : 'text-[var(--gp-blocked-ink)]'
                                    )}
                                  >
                                    {posOk ? '+' : ''}
                                    {inr(val.netMtmPnlInr, 2)}
                                  </span>
                                </div>
                                <div className="mt-2 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const res = closePosition(pos.id)
                                      setNotice({ ok: res.ok, text: res.message })
                                    }}
                                    className="gp-button gp-button--danger min-h-0 px-2.5 py-1 text-[10px]"
                                  >
                                    <XCircle className="h-3 w-3" /> 1-Click Square Off
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {activeTab === 'positions' && closedTrades.length > 0 ? (
                        <div className="border-t border-border">
                          <div className="border-b border-border bg-background/50 px-4 py-2">
                            <p className="gp-label">Closed Trade Ledger</p>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="gp-table">
                              <thead>
                                <tr>
                                  <th>Trade</th>
                                  <th className="gp-num">Entry</th>
                                  <th className="gp-num">Exit</th>
                                  <th className="gp-num">Net P&amp;L</th>
                                </tr>
                              </thead>
                              <tbody>
                                {closedTrades.map((t) => (
                                  <tr key={t.id}>
                                    <td className="font-mono text-xs">{t.headline}</td>
                                    <td className="gp-num">{inr(t.entryPriceA, 0)}</td>
                                    <td className="gp-num">{inr(t.exitPriceA, 0)}</td>
                                    <td
                                      className={cn(
                                        'gp-num font-semibold',
                                        t.netPnlInr >= 0
                                          ? 'text-[var(--gp-tradable-ink)]'
                                          : 'text-[var(--gp-blocked-ink)]'
                                      )}
                                    >
                                      {t.netPnlInr >= 0 ? '+' : ''}
                                      {inr(t.netPnlInr, 2)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
