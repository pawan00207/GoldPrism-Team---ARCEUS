'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Bot,
  History,
  Layers3,
  LogIn,
  Radio,
  Scale,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { useLiveFeed } from '@/components/goldprism/LiveFeedProvider'
import { DataTag, SpectralRule, VerdictTag } from '@/components/goldprism/brand'
import { SupportedContractCode } from '@/lib/goldprism/contract-master'
import { compareNormalizedContracts, contractSpecs } from '@/lib/goldprism/contract-specs'
import { bps, inr } from '@/lib/goldprism/format'
import { rankBestVehicleForExposure } from '@/lib/goldprism/signal'
import { computeXRayWaterfall } from '@/lib/goldprism/xray'
import { cn } from '@/lib/utils'

const SYMBOLS: SupportedContractCode[] = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL']

export function HomeFeaturesShowcase() {
  const {
    feed,
    loading,
    refreshing,
    refreshFeed,
    tickCount,
    user,
    equityInr,
    unrealizedPnlInr,
    positions,
    executeOneClickTrade,
    signInWithGoogle,
  } = useLiveFeed()

  const [exposureG, setExposureG] = React.useState<number>(50)
  const [quickNotice, setQuickNotice] = React.useState<string | null>(null)

  const contracts = feed?.contracts ?? null
  const isLive = feed?.status === 'LIVE_PARITY' && contracts !== null

  const liveXRay = React.useMemo(() => {
    if (!contracts) return null
    const carryProxy =
      typeof feed?.benchmarks.comexBasisAnnualizedPct === 'number' &&
      feed.benchmarks.comexBasisAnnualizedPct > 0 &&
      feed.benchmarks.comexBasisAnnualizedPct < 20
        ? feed.benchmarks.comexBasisAnnualizedPct / 100
        : 0.065

    return computeXRayWaterfall({
      contractA: 'GOLDTEN',
      priceAQuoted: contracts.GOLDTEN.quotedPrice,
      expiryA: contracts.GOLDTEN.expiryDate,
      contractB: 'GOLDM',
      priceBQuoted: contracts.GOLDM.quotedPrice,
      expiryB: contracts.GOLDM.expiryDate,
      tradeDate: (feed?.asOf ?? new Date().toISOString()).slice(0, 10),
      annualCarryRate: carryProxy,
      settlementArtifactInrPerG: 0,
    })
  }, [contracts, feed])

  const normalizedRows = React.useMemo(() => {
    if (!contracts) return []
    return compareNormalizedContracts(
      SYMBOLS.map((sym) => ({
        symbol: sym,
        quotedPrice: contracts[sym].quotedPrice,
        expiryDate: contracts[sym].expiryDate,
      })),
      'GOLDM'
    )
  }, [contracts])

  const bestVehicle = React.useMemo(() => {
    if (!contracts) return null
    return rankBestVehicleForExposure(exposureG, {
      GOLDM: contracts.GOLDM.quotedPrice,
      GOLDTEN: contracts.GOLDTEN.quotedPrice,
      GOLDGUINEA: contracts.GOLDGUINEA.quotedPrice,
      GOLDPETAL: contracts.GOLDPETAL.quotedPrice,
    })[0]
  }, [exposureG, contracts])

  const quickTrade = (sym: SupportedContractCode, side: 'BUY' | 'SELL') => {
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
      rationale: `Home quick 1-Click ${side} 1 lot ${sym}.`,
    })
    setQuickNotice(res.message)
  }

  return (
    <section id="features-live" className="border-b border-border bg-background">
      <div className="mx-auto max-w-[1360px] px-4 py-8 md:py-10">
        <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-3">
              <p className="gp-kicker">Terminal Modules · Live Connected</p>
              <DataTag
                live={isLive}
                synthetic={!isLive}
                detail={
                  isLive && feed?.asOf
                    ? `10s sync #${tickCount} · ${feed.asOf.slice(0, 19).replace('T', ' ')} UTC`
                    : loading
                      ? 'syncing'
                      : 'offline'
                }
              />
            </div>
            <h2 className="gp-title mt-2 text-balance">
              Live quantitative engines across all four MCX contracts.
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshFeed(true)}
              className="gp-button whitespace-nowrap"
            >
              {refreshing ? 'Syncing…' : 'Sync Feed'}
            </button>
            {user ? (
              <Link href="/dashboard" className="gp-button gp-button--primary whitespace-nowrap">
                Open My Dashboard ({user.displayName?.split(' ')[0] || 'Account'})
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="gp-button gp-button--primary whitespace-nowrap"
              >
                <LogIn className="h-3.5 w-3.5" /> Login to Dashboard
              </button>
            )}
            <Link href="/trade" className="gp-button whitespace-nowrap">
              <Zap className="h-3.5 w-3.5" /> 1-Click Trade Desk
            </Link>
          </div>
        </div>

        {quickNotice ? (
          <div className="mt-4 flex items-center justify-between rounded-[4px] border border-[var(--gp-gold-500)] bg-card px-4 py-2.5 font-mono text-xs text-foreground">
            <span>{quickNotice}</span>
            <Link href="/dashboard" className="font-medium underline">
              Manage on Dashboard →
            </Link>
          </div>
        ) : null}

        {/* 6 Live Feature Modules — Crisp Terminal Grid */}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {/* FEATURE 01: Live X-Ray Spread Decomposition */}
          <div className="flex flex-col justify-between rounded-[4px] border border-border bg-card p-5 shadow-[var(--gp-hard-shadow)]">
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Layers3 className="h-4 w-4 text-[var(--gp-gold-ink)]" />
                  <span className="gp-kicker">01 · X-Ray Spread Engine</span>
                </div>
                {liveXRay ? <VerdictTag verdict={liveXRay.verdict} /> : null}
              </div>
              <h3 className="gp-ledger mt-2.5 text-lg">
                Live GOLDTEN vs GOLDM Decomposition
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Strips structural purity basis, staggered expiry carry, and statutory round-trip
                fees in real time before judging edge.
              </p>

              {liveXRay ? (
                <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border border-border bg-border font-mono text-xs sm:grid-cols-4">
                  <div className="bg-background px-3 py-2">
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Raw gap</dt>
                    <dd className="gp-figure mt-0.5 text-sm font-medium">{bps(liveXRay.rawSpreadBps)}</dd>
                  </div>
                  <div className="bg-background px-3 py-2">
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Basis+Carry</dt>
                    <dd className="gp-figure mt-0.5 text-sm font-medium">
                      {bps(-(liveXRay.structuralBasisBps + liveXRay.expiryCarryBps))}
                    </dd>
                  </div>
                  <div className="bg-background px-3 py-2">
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Costs</dt>
                    <dd className="gp-figure mt-0.5 text-sm text-[var(--gp-blocked-ink)]">
                      {bps(-liveXRay.transactionCostsBps)}
                    </dd>
                  </div>
                  <div className="bg-background px-3 py-2">
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Net edge</dt>
                    <dd className="gp-figure mt-0.5 text-sm font-semibold gp-gold-text">
                      {bps(liveXRay.netEdgeBps)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-4 font-mono text-xs text-muted-foreground">
                  Syncing live quotes…
                </p>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
                Recon tolerance &lt; 0.01 ₹/g
              </span>
              <Link href="/xray" className="gp-button min-h-0 px-3 py-1.5 text-[10px]">
                Open X-Ray Waterfall <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* FEATURE 02: Live 10g Pure-Gold Normalization */}
          <div className="flex flex-col justify-between rounded-[4px] border border-border bg-card p-5 shadow-[var(--gp-hard-shadow)]">
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-[var(--gp-gold-ink)]" />
                  <span className="gp-kicker">02 · Contract Normalization</span>
                </div>
                <span className="gp-tag gp-tag--neutral">P_10g = (P_q × 10)/(q × p)</span>
              </div>
              <h3 className="gp-ledger mt-2.5 text-lg">
                All 4 MCX Lots on One 10g Pure Scale
              </h3>

              <div className="mt-3 overflow-x-auto rounded-[4px] border border-border">
                <table className="gp-table">
                  <thead>
                    <tr>
                      <th>Contract</th>
                      <th className="gp-num">Raw Quote</th>
                      <th className="gp-num">10g Pure Gold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {normalizedRows.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-muted-foreground">
                          Loading live contract parity…
                        </td>
                      </tr>
                    ) : (
                      normalizedRows.map((row) => (
                        <tr key={row.symbol}>
                          <td className="font-medium text-foreground">
                            {row.symbol}{' '}
                            <span className="text-[10px] text-muted-foreground">
                              ({contractSpecs[row.symbol].tradingUnitGrams}g · {row.spec.purity})
                            </span>
                          </td>
                          <td className="gp-num text-muted-foreground">
                            {inr(row.quotedPrice, 0)}
                          </td>
                          <td className="gp-num font-semibold text-foreground">
                            {inr(row.normalized10gPrice, 2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
                Live parity + 18M Bhavcopy
              </span>
              <Link href="/normalization" className="gp-button min-h-0 px-3 py-1.5 text-[10px]">
                Open Normalization Lab <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* FEATURE 03: One-Click Trade Execution & Live Portfolio */}
          <div className="flex flex-col justify-between rounded-[4px] border border-border bg-card p-5 shadow-[var(--gp-hard-shadow)]">
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[var(--gp-gold-ink)]" />
                  <span className="gp-kicker">03 · One-Click Execution</span>
                </div>
                <span className="gp-tag gp-tag--tradable">
                  Equity {inr(equityInr, 0)}
                </span>
              </div>
              <h3 className="gp-ledger mt-2.5 text-lg">
                Understand Every Rupee, Execute in 1 Click
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Test live fills with 9.5% SPAN margin proxy, exact statutory fees, and live MTM P&amp;L.
                Currently {positions.length} open position(s) · MTM{' '}
                {unrealizedPnlInr >= 0 ? '+' : ''}
                {inr(unrealizedPnlInr, 2)}.
              </p>

              {contracts ? (
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3.5">
                  <button
                    type="button"
                    onClick={() => quickTrade('GOLDTEN', 'BUY')}
                    className="gp-button justify-center border-[var(--gp-tradable-ink)] px-2 py-2 text-[10px] text-[var(--gp-tradable-ink)] hover:bg-[var(--gp-tradable)] hover:text-white"
                  >
                    <TrendingUp className="h-3.5 w-3.5" /> 1-Click Buy GOLDTEN ({inr(contracts.GOLDTEN.quotedPrice, 0)})
                  </button>
                  <button
                    type="button"
                    onClick={() => quickTrade('GOLDM', 'SELL')}
                    className="gp-button justify-center border-[var(--gp-blocked-ink)] px-2 py-2 text-[10px] text-[var(--gp-blocked-ink)] hover:bg-[var(--gp-blocked)] hover:text-white"
                  >
                    <TrendingDown className="h-3.5 w-3.5" /> 1-Click Sell GOLDM ({inr(contracts.GOLDM.quotedPrice, 0)})
                  </button>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
                Pre-trade clarity + discipline gate
              </span>
              <Link href="/trade" className="gp-button min-h-0 px-3 py-1.5 text-[10px]">
                Open Trade Desk <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* FEATURE 04: Best Vehicle & Exposure Matcher */}
          <div className="flex flex-col justify-between rounded-[4px] border border-border bg-card p-5 shadow-[var(--gp-hard-shadow)]">
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-[var(--gp-gold-ink)]" />
                  <span className="gp-kicker">04 · Best-Vehicle Matcher</span>
                </div>
                <div className="flex gap-1">
                  {[8, 10, 50, 100].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setExposureG(g)}
                      className={cn(
                        'gp-button min-h-0 px-2 py-1 text-[10px]',
                        exposureG === g && 'gp-button--selected'
                      )}
                    >
                      {g}g
                    </button>
                  ))}
                </div>
              </div>
              <h3 className="gp-ledger mt-2.5 text-lg">
                {bestVehicle
                  ? `${bestVehicle.lotsRequired} × ${bestVehicle.contractCode} fits ${exposureG}g`
                  : 'Match Physical Exposure'}
              </h3>
              {bestVehicle ? (
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {bestVehicle.rationale} Estimated round-trip friction:{' '}
                  <strong className="font-mono text-foreground">
                    {bps(bestVehicle.estimatedCostBps)}
                  </strong>
                  .
                </p>
              ) : null}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
                Zero-lumpiness optimization
              </span>
              <Link
                href="/research#best-vehicle"
                className="gp-button min-h-0 px-3 py-1.5 text-[10px]"
              >
                Compare All Vehicles <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* FEATURE 05: Point-in-Time Replay & Live Upstream Health */}
          <div className="flex flex-col justify-between rounded-[4px] border border-border bg-card p-5 shadow-[var(--gp-hard-shadow)]">
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-[var(--gp-gold-ink)]" />
                  <span className="gp-kicker">05 · Point-in-Time Replay</span>
                </div>
                <span className="gp-tag gp-tag--neutral">Zero look-ahead</span>
              </div>
              <h3 className="gp-ledger mt-2.5 text-lg">
                Audit Historical Signals &amp; Live Feeds
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Strictly filters queries by <code className="font-mono text-[11px]">timestamp &lt;= as_of</code>{' '}
                across 18 months of MCX Bhavcopy data, paired with live global feed monitoring.
              </p>
              <div className="mt-3.5 flex flex-wrap gap-1.5 font-mono text-[10px]">
                {(feed?.upstream ?? []).map((u) => (
                  <span
                    key={u.id}
                    className={cn(
                      'gp-tag',
                      u.available ? 'gp-tag--tradable' : 'gp-tag--blocked'
                    )}
                  >
                    {u.id}: {u.available ? `${u.price}` : 'OFFLINE'}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
                2024-01-01 to 2025-06-30 archive
              </span>
              <Link href="/replay" className="gp-button min-h-0 px-3 py-1.5 text-[10px]">
                Open Replay Lab <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* FEATURE 06: Gemini Trade Copilot & Quant Research Analyst */}
          <div className="flex flex-col justify-between rounded-[4px] border border-border bg-card p-5 shadow-[var(--gp-hard-shadow)]">
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-[var(--gp-gold-ink)]" />
                  <span className="gp-kicker">06 · Trade Copilot &amp; Analyst</span>
                </div>
                <span className="gp-tag gp-tag--gold">Grounded AI</span>
              </div>
              <h3 className="gp-ledger mt-2.5 text-lg">
                Ask Before You Trade, Never Guess
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Use the floating <strong>Trade Copilot AI</strong> button (bottom-right) or open
                the authenticated Dashboard to ask in English or Hinglish about spreads, costs,
                hedges, and 1-click trade plans.
              </p>
              <SpectralRule className="mt-4" />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <Link href="/analyst" className="gp-button min-h-0 px-3 py-1.5 text-[10px]">
                Deterministic Analyst <ArrowRight className="h-3 w-3" />
              </Link>
              <Link
                href="/dashboard"
                className="gp-button gp-button--primary min-h-0 px-3 py-1.5 text-[10px]"
              >
                Open Full Dashboard <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
