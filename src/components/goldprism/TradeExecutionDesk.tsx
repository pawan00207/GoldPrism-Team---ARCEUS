'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Activity,
  ArrowDownUp,
  Download,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react'
import { useLiveFeed } from '@/components/goldprism/LiveFeedProvider'
import { OneClickTradeBar } from '@/components/goldprism/OneClickTradeBar'
import { DataTag, Metric, SectionHead, VerdictTag } from '@/components/goldprism/brand'
import { SupportedContractCode } from '@/lib/goldprism/contract-master'
import { contractSpecs } from '@/lib/goldprism/contract-specs'
import { bps, inr, inrPerG } from '@/lib/goldprism/format'
import { rankBestVehicleForExposure } from '@/lib/goldprism/signal'
import { TradeIntentInput, valuatePaperPosition } from '@/lib/goldprism/trade-engine'
import { computeXRayWaterfall } from '@/lib/goldprism/xray'
import { cn } from '@/lib/utils'

const SYMBOLS: SupportedContractCode[] = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL']

export function TradeExecutionDesk() {
  const searchParams = useSearchParams()
  const requestedSymbol = searchParams.get('symbol')?.toUpperCase() as
    | SupportedContractCode
    | undefined

  const {
    feed,
    loading,
    refreshing,
    autoRefresh,
    setAutoRefresh,
    refreshFeed,
    livePricesMap,
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

  const [mode, setMode] = React.useState<'SINGLE' | 'SPREAD'>(
    requestedSymbol && SYMBOLS.includes(requestedSymbol) ? 'SINGLE' : 'SPREAD'
  )

  // Single-leg ticket state
  const [singleSymbol, setSingleSymbol] = React.useState<SupportedContractCode>(
    requestedSymbol && SYMBOLS.includes(requestedSymbol) ? requestedSymbol : 'GOLDTEN'
  )
  const [singleSide, setSingleSide] = React.useState<'BUY' | 'SELL'>('BUY')
  const [singleLots, setSingleLots] = React.useState<number>(1)

  // Spread ticket state
  const [spreadLegA, setSpreadLegA] = React.useState<SupportedContractCode>('GOLDTEN')
  const [spreadLegB, setSpreadLegB] = React.useState<SupportedContractCode>('GOLDM')
  const [spreadSide, setSpreadSide] = React.useState<'SHORT_A_LONG_B' | 'LONG_A_SHORT_B'>(
    'SHORT_A_LONG_B'
  )
  const [spreadLots, setSpreadLots] = React.useState<number>(1)

  // Exposure quick-sizer
  const [targetGrams, setTargetGrams] = React.useState<number>(50)

  // Feedback message for quick actions
  const [deskNotice, setDeskNotice] = React.useState<{ ok: boolean; text: string } | null>(null)

  React.useEffect(() => {
    if (requestedSymbol && SYMBOLS.includes(requestedSymbol)) {
      setSingleSymbol(requestedSymbol)
      setMode('SINGLE')
    }
  }, [requestedSymbol])

  const contracts = feed?.contracts ?? null
  const isLive = feed?.status === 'LIVE_PARITY' && contracts !== null

  const vehicleSuggestions = React.useMemo(() => {
    if (!contracts) return []
    return rankBestVehicleForExposure(targetGrams, {
      GOLDM: contracts.GOLDM.quotedPrice,
      GOLDTEN: contracts.GOLDTEN.quotedPrice,
      GOLDGUINEA: contracts.GOLDGUINEA.quotedPrice,
      GOLDPETAL: contracts.GOLDPETAL.quotedPrice,
    })
  }, [targetGrams, contracts])

  // Live X-Ray calculation for selected spread legs
  const spreadXRay = React.useMemo(() => {
    if (!contracts) return null
    const qA = contracts[spreadLegA]
    const qB = contracts[spreadLegB]
    if (!qA || !qB) return null

    const carryProxy =
      typeof feed?.benchmarks.comexBasisAnnualizedPct === 'number' &&
      feed.benchmarks.comexBasisAnnualizedPct > 0 &&
      feed.benchmarks.comexBasisAnnualizedPct < 20
        ? feed.benchmarks.comexBasisAnnualizedPct / 100
        : 0.065

    return computeXRayWaterfall({
      contractA: spreadLegA,
      priceAQuoted: qA.quotedPrice,
      expiryA: qA.expiryDate,
      lotsA: spreadLots,
      contractB: spreadLegB,
      priceBQuoted: qB.quotedPrice,
      expiryB: qB.expiryDate,
      lotsB: spreadLots,
      tradeDate: (feed?.asOf ?? new Date().toISOString()).slice(0, 10),
      annualCarryRate: carryProxy,
      settlementArtifactInrPerG: 0,
    })
  }, [contracts, spreadLegA, spreadLegB, spreadLots, feed])

  const activeIntent: TradeIntentInput | null = React.useMemo(() => {
    if (!contracts) return null
    if (mode === 'SINGLE') {
      const q = contracts[singleSymbol]
      return {
        kind: 'SINGLE',
        side: singleSide,
        contractA: singleSymbol,
        priceA: q.quotedPrice,
        lotsA: singleLots,
        expiryA: q.expiryDate,
        sourceLabel: q.source,
        asOf: q.asOf,
        rationale: `Single-contract ${singleSide} hedge (${contractSpecs[singleSymbol].tradingUnitGrams * singleLots}g) at live parity.`,
      }
    }

    const qA = contracts[spreadLegA]
    const qB = contracts[spreadLegB]
    return {
      kind: 'SPREAD',
      side: spreadSide,
      contractA: spreadLegA,
      priceA: qA.quotedPrice,
      lotsA: spreadLots,
      expiryA: qA.expiryDate,
      contractB: spreadLegB,
      priceB: qB.quotedPrice,
      lotsB: spreadLots,
      expiryB: qB.expiryDate,
      verdict: spreadXRay?.verdict,
      netEdgeBps: spreadXRay?.netEdgeBps,
      netEdgeInrPerG: spreadXRay?.netEdgeInrPerG,
      sourceLabel: 'Live Global-to-MCX Parity',
      asOf: feed?.asOf,
      rationale: spreadXRay?.verdictMessage,
    }
  }, [
    contracts,
    mode,
    singleSymbol,
    singleSide,
    singleLots,
    spreadLegA,
    spreadLegB,
    spreadSide,
    spreadLots,
    spreadXRay,
    feed?.asOf,
  ])

  const handleQuickBuySell = (sym: SupportedContractCode, side: 'BUY' | 'SELL') => {
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
      rationale: `Instant 1-Click ${side} 1 lot ${sym} from live quote board.`,
    })
    setDeskNotice({ ok: res.ok, text: res.message })
  }

  const handleExportLedgerCsv = () => {
    const header = [
      'id',
      'status',
      'kind',
      'side',
      'headline',
      'entryPriceA',
      'exitPriceA',
      'marginBlockedInr',
      'netPnlInr',
      'openedAt',
      'closedAt',
    ]
    const rows = [
      ...positions.map((p) => {
        const val = valuatePaperPosition(p, livePricesMap)
        return [
          p.id,
          'OPEN',
          p.kind,
          p.side,
          `"${p.headline}"`,
          p.entryPriceA,
          val.currentPriceA,
          p.marginBlockedInr,
          val.netMtmPnlInr,
          p.openedAt,
          '',
        ].join(',')
      }),
      ...closedTrades.map((t) =>
        [
          t.id,
          'CLOSED',
          t.kind,
          t.side,
          `"${t.headline}"`,
          t.entryPriceA,
          t.exitPriceA,
          t.marginBlockedInr,
          t.netPnlInr,
          t.openedAt,
          t.closedAt,
        ].join(',')
      ),
    ]
    const csv = [header.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `goldprism-trades-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto max-w-[1360px] px-4 py-8 md:py-10">
        <SectionHead
          index="01 / LIVE EXECUTION"
          eyebrow="Understand first · then execute in one click"
          title="One-Click Trade Desk"
          description="Inspect live international-to-MCX bullion parity quotes, check 10g pure-gold normalization, review exact statutory fees and X-Ray edge, and execute or hedge in one click."
          aside={
            <div className="flex flex-wrap items-center gap-2">
              <DataTag
                live={isLive}
                synthetic={!isLive}
                detail={
                  feed?.asOf
                    ? `as_of ${feed.asOf.slice(0, 19).replace('T', ' ')}`
                    : loading
                      ? 'connecting…'
                      : 'unavailable'
                }
              />
              <button
                type="button"
                onClick={() => setAutoRefresh((v) => !v)}
                className="gp-button px-3 py-1.5 text-[10px] whitespace-nowrap shrink-0"
              >
                {autoRefresh ? (
                  <>
                    <Pause className="h-3.5 w-3.5" /> Auto 15s: ON
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" /> Auto 15s: PAUSED
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => refreshFeed(true)}
                className="gp-button px-3 py-1.5 text-[10px] whitespace-nowrap shrink-0"
                aria-label="Refresh live quotes"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
                Refresh
              </button>
            </div>
          }
        />

        {/* Portfolio Summary Strip */}
        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border border-border bg-border shadow-[var(--gp-hard-shadow)] md:grid-cols-5">
          <div className="bg-card p-3.5">
            <Metric label="Account equity" value={inr(equityInr, 0)} tone="gold" />
          </div>
          <div className="bg-card p-3.5">
            <Metric label="Available margin" value={inr(cashInr, 0)} />
          </div>
          <div className="bg-card p-3.5">
            <Metric label="Blocked margin" value={inr(marginBlockedInr, 0)} />
          </div>
          <div className="bg-card p-3.5">
            <Metric
              label="Open MTM P&L"
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

        {/* Live Global Benchmark Provenance Bar */}
        <div className="mt-5 rounded-[4px] border border-border bg-card p-4 shadow-[var(--gp-hard-shadow)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-5 font-mono text-xs">
              <div>
                <span className="text-muted-foreground">XAU/USD Spot: </span>
                <strong className="text-foreground">
                  {feed?.benchmarks.xauUsd !== null && feed?.benchmarks.xauUsd !== undefined
                    ? `$${feed.benchmarks.xauUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                    : 'Unavailable'}
                </strong>
              </div>
              <div>
                <span className="text-muted-foreground">COMEX GC=F: </span>
                <strong className="text-foreground">
                  {feed?.benchmarks.comexGcUsd !== null && feed?.benchmarks.comexGcUsd !== undefined
                    ? `$${feed.benchmarks.comexGcUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                    : 'Unavailable'}
                </strong>
              </div>
              <div>
                <span className="text-muted-foreground">USD/INR: </span>
                <strong className="text-foreground">
                  {feed?.benchmarks.usdInr !== null && feed?.benchmarks.usdInr !== undefined
                    ? `₹${feed.benchmarks.usdInr.toFixed(4)}`
                    : 'Unavailable'}
                </strong>
              </div>
              <div>
                <span className="text-muted-foreground">GOLDBEES.NS: </span>
                <strong className="text-foreground">
                  {feed?.benchmarks.goldBeesInr !== null && feed?.benchmarks.goldBeesInr !== undefined
                    ? `₹${feed.benchmarks.goldBeesInr.toFixed(2)}`
                    : 'Unavailable'}
                </strong>
              </div>
              <div>
                <span className="text-muted-foreground">Landed 10g Parity: </span>
                <strong className="gp-gold-text">
                  {feed?.benchmarks.landedSpotParity10gInr
                    ? inr(feed.benchmarks.landedSpotParity10gInr, 2)
                    : 'Unavailable'}
                </strong>
              </div>
            </div>

            <span className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
              Duty factor {feed?.dutyBreakdown.combinedMultiplier ?? 1.0918}× (6% BCD + 3% GST)
            </span>
          </div>
          {feed?.disclosure ? (
            <p className="mt-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
              {feed.disclosure}
            </p>
          ) : null}
        </div>

        {/* Live 4-Contract Instant 1-Click Quote Board */}
        <div className="mt-6">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <p className="gp-label text-foreground">Live MCX Contract Board · instant 1-lot execution</p>
            {deskNotice ? (
              <span
                className={cn(
                  'font-mono text-xs',
                  deskNotice.ok ? 'text-[var(--gp-tradable-ink)]' : 'text-[var(--gp-blocked-ink)]'
                )}
              >
                {deskNotice.text}
              </span>
            ) : null}
          </div>

          {!isLive ? (
            <div className="rounded-[4px] border border-border bg-card p-5 font-mono text-xs text-muted-foreground">
              {loading
                ? 'Connecting to live spot gold, COMEX GC=F, and USD/INR feeds…'
                : `Live parity data unavailable (${feed?.error ?? 'upstream timeout'}). Click Refresh to retry.`}
            </div>
          ) : (
            <div className="grid gap-px overflow-hidden rounded-[4px] border border-border bg-border shadow-[var(--gp-hard-shadow)] sm:grid-cols-2 lg:grid-cols-4">
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
                        <span className="gp-tag gp-tag--neutral">
                          {spec.tradingUnitGrams}g · {(spec.purity * 1000).toFixed(0)} fine
                        </span>
                      </div>

                      <p className="gp-figure mt-2.5 text-xl font-semibold text-foreground">
                        {inr(q.quotedPrice, 0)}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        10g pure: {inr(q.normalized10gPrice, 2)} · {inrPerG(q.normalized999PerGram, 2)}
                      </p>
                      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                        Exp {q.expiryDate} · {q.source}
                      </p>
                    </div>

                    <div className="mt-3.5 grid grid-cols-2 gap-2 border-t border-border pt-3">
                      <button
                        type="button"
                        onClick={() => handleQuickBuySell(sym, 'BUY')}
                        className="gp-button justify-center border-[var(--gp-tradable-ink)] px-2 py-1.5 text-[10px] text-[var(--gp-tradable-ink)] hover:bg-[var(--gp-tradable)] hover:text-white"
                      >
                        <TrendingUp className="h-3 w-3" /> 1-Click Buy
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickBuySell(sym, 'SELL')}
                        className="gp-button justify-center border-[var(--gp-blocked-ink)] px-2 py-1.5 text-[10px] text-[var(--gp-blocked-ink)] hover:bg-[var(--gp-blocked)] hover:text-white"
                      >
                        <TrendingDown className="h-3 w-3" /> 1-Click Sell
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Guided Trade Ticket + Live Positions */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,60%)_minmax(0,40%)]">
          {/* LEFT: Understand -> Execute Builder */}
          <div className="min-w-0 space-y-5">
            <div className="overflow-hidden rounded-[4px] border border-border bg-card shadow-[var(--gp-hard-shadow)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-[var(--gp-vellum)]/60 px-4 py-2.5">
                <p className="gp-label text-foreground">Guided execution builder</p>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMode('SPREAD')}
                    aria-pressed={mode === 'SPREAD'}
                    className={cn(
                      'gp-button px-3 py-1 text-[10px] whitespace-nowrap shrink-0',
                      mode === 'SPREAD' && 'gp-button--selected'
                    )}
                  >
                    <ArrowDownUp className="h-3.5 w-3.5" /> X-Ray Spread Pair
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('SINGLE')}
                    aria-pressed={mode === 'SINGLE'}
                    className={cn(
                      'gp-button px-3 py-1 text-[10px] whitespace-nowrap shrink-0',
                      mode === 'SINGLE' && 'gp-button--selected'
                    )}
                  >
                    <Zap className="h-3.5 w-3.5" /> Single Contract / Hedge
                  </button>
                </div>
              </div>

              {mode === 'SPREAD' ? (
                <div className="space-y-4 p-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="gp-label" htmlFor="trade-leg-a">
                        Leg A (far / futures)
                      </label>
                      <select
                        id="trade-leg-a"
                        value={spreadLegA}
                        onChange={(e) => setSpreadLegA(e.target.value as SupportedContractCode)}
                        className="gp-field gp-select mt-1 text-sm"
                      >
                        {SYMBOLS.map((s) => (
                          <option key={s} value={s}>
                            {s} ({contractSpecs[s].tradingUnitGrams}g)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="gp-label" htmlFor="trade-leg-b">
                        Leg B (near / spot)
                      </label>
                      <select
                        id="trade-leg-b"
                        value={spreadLegB}
                        onChange={(e) => setSpreadLegB(e.target.value as SupportedContractCode)}
                        className="gp-field gp-select mt-1 text-sm"
                      >
                        {SYMBOLS.map((s) => (
                          <option key={s} value={s}>
                            {s} ({contractSpecs[s].tradingUnitGrams}g)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="gp-label" htmlFor="trade-spread-lots">
                        Lots per leg
                      </label>
                      <input
                        id="trade-spread-lots"
                        type="number"
                        min={1}
                        max={25}
                        value={spreadLots}
                        onChange={(e) =>
                          setSpreadLots(Math.max(1, parseInt(e.target.value, 10) || 1))
                        }
                        className="gp-field mt-1 text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSpreadSide('SHORT_A_LONG_B')}
                        aria-pressed={spreadSide === 'SHORT_A_LONG_B'}
                        className={cn(
                          'gp-button px-3 py-1.5 text-[10px]',
                          spreadSide === 'SHORT_A_LONG_B' && 'gp-button--selected'
                        )}
                      >
                        Sell {spreadLegA} / Buy {spreadLegB}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSpreadSide('LONG_A_SHORT_B')}
                        aria-pressed={spreadSide === 'LONG_A_SHORT_B'}
                        className={cn(
                          'gp-button px-3 py-1.5 text-[10px]',
                          spreadSide === 'LONG_A_SHORT_B' && 'gp-button--selected'
                        )}
                      >
                        Buy {spreadLegA} / Sell {spreadLegB}
                      </button>
                    </div>

                    {spreadXRay ? (
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="text-muted-foreground">Live X-Ray Net Edge:</span>
                        <strong className="text-foreground">{bps(spreadXRay.netEdgeBps)}</strong>
                        <VerdictTag verdict={spreadXRay.verdict} />
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 p-4">
                  {/* Exposure Auto-Matcher */}
                  <div className="border border-border bg-background p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        Smart hedge sizer · pick physical grams to auto-match best contract
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[8, 10, 50, 100].map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => {
                              setTargetGrams(g)
                              const best = vehicleSuggestions.find((v) => v.targetExposureG === g) ??
                                rankBestVehicleForExposure(g)[0]
                              if (best) {
                                setSingleSymbol(best.contractCode)
                                setSingleLots(best.lotsRequired)
                              }
                            }}
                            className={cn(
                              'gp-button px-2.5 py-1 text-[10px]',
                              targetGrams === g && 'gp-button--selected'
                            )}
                          >
                            {g}g
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="gp-label" htmlFor="single-contract">
                        Contract
                      </label>
                      <select
                        id="single-contract"
                        value={singleSymbol}
                        onChange={(e) => setSingleSymbol(e.target.value as SupportedContractCode)}
                        className="gp-field gp-select mt-1 text-sm"
                      >
                        {SYMBOLS.map((s) => (
                          <option key={s} value={s}>
                            {s} · {contractSpecs[s].tradingUnitGrams}g/lot
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="gp-label" htmlFor="single-side">
                        Direction
                      </label>
                      <select
                        id="single-side"
                        value={singleSide}
                        onChange={(e) => setSingleSide(e.target.value as 'BUY' | 'SELL')}
                        className="gp-field gp-select mt-1 text-sm"
                      >
                        <option value="BUY">BUY (Long Gold)</option>
                        <option value="SELL">SELL (Short / Hedge)</option>
                      </select>
                    </div>
                    <div>
                      <label className="gp-label" htmlFor="single-lots">
                        Lots ({contractSpecs[singleSymbol].tradingUnitGrams * singleLots}g total)
                      </label>
                      <input
                        id="single-lots"
                        type="number"
                        min={1}
                        max={50}
                        value={singleLots}
                        onChange={(e) =>
                          setSingleLots(Math.max(1, parseInt(e.target.value, 10) || 1))
                        }
                        className="gp-field mt-1 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {activeIntent ? (
              <OneClickTradeBar
                intent={activeIntent}
                title="Pre-Trade Clarity Check · 1-Click Execute"
              />
            ) : null}
          </div>

          {/* RIGHT: Live Open Positions + Closed Audit Ledger */}
          <div className="min-w-0 space-y-5">
            <div className="overflow-hidden rounded-[4px] border border-border bg-card shadow-[var(--gp-hard-shadow)]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-[var(--gp-vellum)]/60 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[var(--gp-gold-ink)]" />
                  <p className="gp-label text-foreground">Open paper positions ({positions.length})</p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={handleExportLedgerCsv}
                    className="gp-button min-h-0 px-2.5 py-1 text-[10px]"
                    disabled={positions.length === 0 && closedTrades.length === 0}
                  >
                    <Download className="h-3 w-3" /> CSV
                  </button>
                  <button
                    type="button"
                    onClick={resetPortfolio}
                    className="gp-button gp-button--danger min-h-0 px-2.5 py-1 text-[10px]"
                    title="Reset virtual account to ₹10,00,000"
                  >
                    <RotateCcw className="h-3 w-3" /> Reset ₹10L
                  </button>
                </div>
              </div>

              {positions.length === 0 ? (
                <div className="p-5 text-center font-mono text-xs text-muted-foreground">
                  No open positions yet. Review the 4-step clarity breakdown on the left or click{' '}
                  <strong className="text-foreground">1-Click Buy / Sell</strong> above.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {positions.map((pos) => {
                    const val = valuatePaperPosition(pos, livePricesMap)
                    const positive = val.netMtmPnlInr >= 0
                    return (
                      <div key={pos.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-mono text-xs font-semibold text-foreground">
                              {pos.headline}
                            </p>
                            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                              {pos.id} · Entry ₹{pos.entryPriceA.toLocaleString('en-IN')} → Live ₹
                              {val.currentPriceA.toLocaleString('en-IN')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p
                              className={cn(
                                'gp-figure text-sm',
                                positive
                                  ? 'text-[var(--gp-tradable-ink)]'
                                  : 'text-[var(--gp-blocked-ink)]'
                              )}
                            >
                              {positive ? '+' : ''}
                              {inr(val.netMtmPnlInr, 2)}
                            </p>
                            <p className="font-mono text-[10px] text-muted-foreground">
                              {val.returnOnMarginPct >= 0 ? '+' : ''}
                              {val.returnOnMarginPct.toFixed(2)}% on margin
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
                          <span className="font-mono text-[10px] text-muted-foreground">
                            Margin ₹{pos.marginBlockedInr.toLocaleString('en-IN')} · Entry fee ₹
                            {pos.entryFeeInr.toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const res = closePosition(pos.id)
                              setDeskNotice({ ok: res.ok, text: res.message })
                            }}
                            className="gp-button gp-button--danger min-h-0 px-3 py-1 text-[10px]"
                          >
                            <XCircle className="h-3.5 w-3.5" /> 1-Click Square Off
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Closed Trades Ledger */}
            <div className="overflow-hidden rounded-[4px] border border-border bg-card shadow-[var(--gp-hard-shadow)]">
              <div className="border-b border-border bg-[var(--gp-vellum)]/60 px-4 py-2.5">
                <p className="gp-label text-foreground">Closed execution ledger ({closedTrades.length})</p>
              </div>
              {closedTrades.length === 0 ? (
                <div className="p-4 font-mono text-xs text-muted-foreground">
                  Closed executions and realized P&amp;L appear here after squaring off.
                </div>
              ) : (
                <div className="max-h-72 divide-y divide-border overflow-y-auto">
                  {closedTrades.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-3 p-3.5">
                      <div>
                        <p className="font-mono text-xs text-foreground">{t.headline}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {t.closedAt.slice(0, 19).replace('T', ' ')} · Fees ₹
                          {(t.entryFeeInr + t.exitFeeInr).toFixed(2)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'gp-figure text-xs',
                          t.netPnlInr >= 0
                            ? 'text-[var(--gp-tradable-ink)]'
                            : 'text-[var(--gp-blocked-ink)]'
                        )}
                      >
                        {t.netPnlInr >= 0 ? '+' : ''}
                        {inr(t.netPnlInr, 2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
