'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, Database, Layers, Scale, Zap } from 'lucide-react'
import {
  BrandMark,
  DataTag,
  Hallmark,
  SpectralRule,
  normalizeVerdict,
} from '@/components/goldprism/brand'
import { useLiveFeed } from '@/components/goldprism/LiveFeedProvider'
import { SupportedContractCode } from '@/lib/goldprism/contract-master'
import { contractSpecs } from '@/lib/goldprism/contract-specs'
import { bps, inr, inrPerG } from '@/lib/goldprism/format'
import { computeXRayWaterfall, DEFAULT_COST_HURDLE_BPS } from '@/lib/goldprism/xray'

const SYMBOLS: SupportedContractCode[] = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL']

export function GoldPrismHeader() {
  const { feed, loading } = useLiveFeed()
  const isLive = feed?.status === 'LIVE_PARITY' && feed.contracts !== null
  const contracts = feed?.contracts ?? null

  // Compute live Assay Certificate from real-time GOLDTEN (COMEX-anchored) vs GOLDM (Spot-anchored)
  const liveAssay = React.useMemo(() => {
    if (!contracts) return null
    const legA = contracts.GOLDTEN
    const legB = contracts.GOLDM
    const carryProxy =
      typeof feed?.benchmarks.comexBasisAnnualizedPct === 'number' &&
      feed.benchmarks.comexBasisAnnualizedPct > 0 &&
      feed.benchmarks.comexBasisAnnualizedPct < 20
        ? feed.benchmarks.comexBasisAnnualizedPct / 100
        : 0.065

    return computeXRayWaterfall({
      contractA: 'GOLDTEN',
      priceAQuoted: legA.quotedPrice,
      expiryA: legA.expiryDate,
      contractB: 'GOLDM',
      priceBQuoted: legB.quotedPrice,
      expiryB: legB.expiryDate,
      tradeDate: (feed?.asOf ?? new Date().toISOString()).slice(0, 10),
      annualCarryRate: carryProxy,
      settlementArtifactInrPerG: 0,
    })
  }, [contracts, feed])

  const verdict = liveAssay ? normalizeVerdict(liveAssay.verdict) : 'NO EDGE'

  return (
    <section className="relative overflow-hidden border-b border-border bg-background">
      {/* Subtle atmospheric bullion backdrop with institutional gradient scrim */}
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
        <img
          src="/assets/aistudio/image_4b7aab2b.png"
          alt=""
          className="h-full w-full object-cover object-right opacity-[0.26] dark:opacity-[0.24]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#F7F4EC] via-[#F7F4EC]/92 to-[#F7F4EC]/68 dark:from-[#171613] dark:via-[#171613]/92 dark:to-[#171613]/72" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#F7F4EC] via-transparent to-[#F7F4EC]/40 dark:from-[#171613] dark:via-transparent dark:to-[#171613]/45" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1360px] px-4 py-8 md:py-10">
        <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,60%)_minmax(0,40%)]">
          {/* Left: Institutional Command Overview */}
          <div className="flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2.5">
                  <BrandMark className="h-7 w-7 shrink-0" />
                  <span className="gp-kicker text-[var(--gp-gold-ink)]">
                    MCX Bullion Research &amp; Execution Terminal
                  </span>
                </div>
                <DataTag
                  live={isLive}
                  synthetic={!isLive}
                  detail={
                    isLive && feed?.asOf
                      ? `${feed.asOf.slice(0, 19).replace('T', ' ')} UTC`
                      : loading
                        ? 'connecting…'
                        : 'feed offline'
                  }
                />
              </div>

              <h1 className="gp-display mt-3 max-w-2xl text-foreground">
                Normalize every gold lot. Price every basis point before execution.
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Real-time global-to-MCX parity pricing across GOLDM, GOLDTEN, GOLDGUINEA, and
                GOLDPETAL. Strips purity basis, expiry carry, and statutory round-trip friction
                before 1-click execution.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  className="gp-button gp-button--primary whitespace-nowrap"
                  href="/trade"
                >
                  <Zap className="h-3.5 w-3.5" aria-hidden="true" /> 1-Click Trade Desk
                </Link>
                <Link className="gp-button whitespace-nowrap" href="/xray">
                  <Layers className="h-3.5 w-3.5" aria-hidden="true" /> Open X-Ray
                </Link>
                <Link className="gp-button whitespace-nowrap" href="/normalization">
                  <Scale className="h-3.5 w-3.5" aria-hidden="true" /> Normalize 10g
                </Link>
                <Link className="gp-button whitespace-nowrap" href="/research#data-health">
                  <Database className="h-3.5 w-3.5" aria-hidden="true" /> Inspect Data
                </Link>
              </div>
            </div>

            {/* Compact Live Benchmark Telemetry Strip */}
            <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border border-border bg-border sm:grid-cols-4">
              <div className="bg-card/95 px-3 py-2.5 backdrop-blur-sm">
                <p className="gp-label">XAU/USD Spot</p>
                <p className="gp-figure mt-1 text-sm text-foreground">
                  {isLive && feed?.benchmarks.xauUsd
                    ? `$${feed.benchmarks.xauUsd.toFixed(2)}`
                    : loading
                      ? 'Syncing…'
                      : 'Unavailable'}
                </p>
              </div>
              <div className="bg-card/95 px-3 py-2.5 backdrop-blur-sm">
                <p className="gp-label">COMEX GC=F</p>
                <p className="gp-figure mt-1 text-sm text-foreground">
                  {isLive && feed?.benchmarks.comexGcUsd
                    ? `$${feed.benchmarks.comexGcUsd.toFixed(2)}`
                    : loading
                      ? 'Syncing…'
                      : 'Unavailable'}
                </p>
              </div>
              <div className="bg-card/95 px-3 py-2.5 backdrop-blur-sm">
                <p className="gp-label">USD/INR FX</p>
                <p className="gp-figure mt-1 text-sm text-foreground">
                  {isLive && feed?.benchmarks.usdInr
                    ? `₹${feed.benchmarks.usdInr.toFixed(2)}`
                    : loading
                      ? 'Syncing…'
                      : 'Unavailable'}
                </p>
              </div>
              <div className="bg-card/95 px-3 py-2.5 backdrop-blur-sm">
                <p className="gp-label">10g Landed Parity</p>
                <p className="gp-figure mt-1 text-sm gp-gold-text">
                  {isLive && feed?.benchmarks.landedSpotParity10gInr
                    ? inr(feed.benchmarks.landedSpotParity10gInr, 0)
                    : loading
                      ? 'Syncing…'
                      : 'Unavailable'}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Live Assay Certificate */}
          <div className="gp-certificate bg-card/95 backdrop-blur-md">
            <div className="mb-3.5 flex items-start justify-between gap-4 border-b border-border pb-3">
              <div>
                <p className="gp-label">Live assay certificate</p>
                <p className="mt-1 font-mono text-xs font-medium text-foreground">
                  {liveAssay
                    ? `${liveAssay.contractA} / ${liveAssay.contractB} · ${liveAssay.configHash}`
                    : loading
                      ? 'Computing live assay…'
                      : 'Live assay unavailable'}
                </p>
              </div>
              <Hallmark verdict={verdict} size={38} />
            </div>

            {liveAssay ? (
              <>
                <dl className="space-y-2 font-mono text-xs">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">Raw normalized gap</dt>
                    <dd className="gp-figure text-foreground">{bps(liveAssay.rawSpreadBps)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">Structural purity basis</dt>
                    <dd className="gp-figure text-muted-foreground">
                      {bps(-liveAssay.structuralBasisBps)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">Expiry carry adjustment</dt>
                    <dd className="gp-figure text-muted-foreground">
                      {bps(-liveAssay.expiryCarryBps)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-b border-border pb-2">
                    <dt className="text-muted-foreground">Settlement artifact</dt>
                    <dd className="gp-figure text-muted-foreground">
                      {bps(-liveAssay.settlementArtifactBps)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 pt-0.5">
                    <dt className="font-medium text-foreground">= Gross residual</dt>
                    <dd className="gp-figure text-sm text-foreground">
                      {bps(liveAssay.grossResidualBps)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-b border-border pb-2">
                    <dt className="text-muted-foreground">Round-trip statutory costs</dt>
                    <dd className="gp-figure text-[var(--gp-blocked-ink)]">
                      {bps(-liveAssay.transactionCostsBps)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 pt-0.5">
                    <dt className="font-semibold text-foreground">= Net tradable edge</dt>
                    <dd
                      className={`gp-figure text-base font-semibold ${
                        liveAssay.netEdgeBps > DEFAULT_COST_HURDLE_BPS
                          ? 'gp-tradable-text'
                          : 'gp-gold-text'
                      }`}
                    >
                      {bps(liveAssay.netEdgeBps)}
                    </dd>
                  </div>
                </dl>

                <SpectralRule className="my-3.5" />

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="gp-label">Verdict · {verdict}</p>
                    <p className="gp-ledger mt-0.5 text-base text-foreground">
                      {liveAssay.verdictTitle}
                    </p>
                  </div>
                  <Link href="/xray" className="gp-button shrink-0 px-3 py-1.5 text-[10px]">
                    Inspect X-Ray
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </>
            ) : (
              <div className="py-8 font-mono text-xs text-muted-foreground">
                {loading
                  ? 'Fetching live XAU/USD, COMEX GC=F & USD/INR quotes to run live X-Ray decomposition…'
                  : 'Upstream feeds unreachable. Open Replay to inspect the 18-month MCX Bhavcopy audit archive.'}
              </div>
            )}
          </div>
        </div>

        {/* Bottom 4-Contract Institutional Quote Strip */}
        <div className="mt-6 rounded-[4px] border border-border bg-card/95 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2">
            <p className="gp-kicker">
              MCX Gold Contract Family · Live Parity &amp; 1-Click Order Routing
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
              {isLive
                ? `6% BCD + 3% GST landed parity · as_of ${feed.asOf.slice(11, 19)} UTC`
                : 'Awaiting live feed'}
            </p>
          </div>
          <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            {SYMBOLS.map((sym) => {
              const spec = contractSpecs[sym]
              const quote = contracts?.[sym] ?? null
              return (
                <Link
                  key={sym}
                  href={`/trade?symbol=${sym}`}
                  className="group relative flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[var(--gp-gold-50)] dark:hover:bg-[var(--gp-gold-900)]/40"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold tracking-wide text-foreground">
                        {sym}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {spec.tradingUnitGrams}g · {(spec.purity * 1000).toFixed(0)}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {quote ? `${inrPerG(quote.normalized999PerGram, 2)} (999)` : '—'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="gp-figure text-base font-semibold text-foreground">
                      {quote ? inr(quote.quotedPrice, 0) : loading ? 'Loading…' : 'Offline'}
                    </p>
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--gp-gold-ink)] group-hover:underline">
                      Trade <ArrowRight className="h-2.5 w-2.5" />
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
