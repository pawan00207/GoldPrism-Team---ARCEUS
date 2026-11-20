'use client'

import * as React from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  History,
  Radio,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react'
import { useLiveFeed } from '@/components/goldprism/LiveFeedProvider'
import { OneClickTradeBar } from '@/components/goldprism/OneClickTradeBar'
import {
  auditContractSpecsConsistency,
  compareNormalizedContracts,
  contractSpecs,
  ContractSymbol,
  normalizeContractBySymbol,
  SpecAuditCrossCheck,
} from '@/lib/goldprism/contract-specs'
import { DataTag, SectionHead, SpectralRule } from '@/components/goldprism/brand'
import { bps, inr, inrPerG } from '@/lib/goldprism/format'
import { TradeIntentInput } from '@/lib/goldprism/trade-engine'
import { cn } from '@/lib/utils'

interface SnapshotContractItem {
  symbol: ContractSymbol
  available: boolean
  unavailableReason: string | null
  record: {
    symbol: ContractSymbol
    tradeDate: string
    expiryDate: string
    expiryCode: string
    settle: number
    close: number
    volume: number
    openInterest: number
  } | null
}

interface MarketSnapshotPayload {
  status: 'OFFLINE_SNAPSHOT' | 'DATA_UNAVAILABLE'
  priceBasis?: string
  marketBanner?: string
  message?: string
  requestedDate: string
  resolvedTradeDate: string | null
  staleDays?: number
  asOf: string
  source: string
  sha256Hash: string
  dateRange?: { start: string; end: string }
  specAudit: SpecAuditCrossCheck[]
  contracts: SnapshotContractItem[]
}

const SYMBOLS: ContractSymbol[] = ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL']

export function ContractNormalizationLab() {
  const { feed, loading: liveLoading, refreshing: liveRefreshing, refreshFeed } = useLiveFeed()
  const [feedMode, setFeedMode] = React.useState<'LIVE' | 'BHAVCOPY'>('BHAVCOPY')
  const [selectedDate, setSelectedDate] = React.useState<string>('')
  const [selectedSymbol, setSelectedSymbol] = React.useState<ContractSymbol>('GOLDGUINEA')
  const [whatIfEnabled, setWhatIfEnabled] = React.useState<boolean>(false)
  const [whatIfPriceInput, setWhatIfPriceInput] = React.useState<string>('')
  const [snapshot, setSnapshot] = React.useState<MarketSnapshotPayload | null>(null)
  const [loading, setLoading] = React.useState<boolean>(true)
  const [error, setError] = React.useState<string | null>(null)

  const fetchSnapshot = React.useCallback(async (date: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(date ? `/api/goldprism/market-snapshot?date=${encodeURIComponent(date)}` : '/api/goldprism/market-snapshot')
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      setSnapshot(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load market snapshot')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchSnapshot(selectedDate)
  }, [fetchSnapshot, selectedDate])

  const liveAvailable = feed?.status === 'LIVE_PARITY' && feed.contracts !== null
  const usingLive = feedMode === 'LIVE'

  const activeContractItem = snapshot?.contracts.find((c) => c.symbol === selectedSymbol) ?? null
  const activeLiveQuote = liveAvailable ? feed!.contracts![selectedSymbol] : null

  const officialPrice = usingLive
    ? activeLiveQuote?.quotedPrice ?? null
    : activeContractItem?.record?.settle ?? null

  // Sync default what-if input whenever official price changes and what-if is off
  React.useEffect(() => {
    if (!whatIfEnabled && officialPrice !== null) {
      setWhatIfPriceInput(String(officialPrice))
    }
  }, [whatIfEnabled, officialPrice])

  const effectivePrice = React.useMemo(() => {
    if (whatIfEnabled) {
      const parsed = parseFloat(whatIfPriceInput)
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null
    }
    return officialPrice
  }, [whatIfEnabled, whatIfPriceInput, officialPrice])

  const normalization = React.useMemo(() => {
    if (effectivePrice === null || effectivePrice <= 0) return null
    return normalizeContractBySymbol(selectedSymbol, effectivePrice)
  }, [selectedSymbol, effectivePrice])

  const sideBySideComparison = React.useMemo(() => {
    if (usingLive) {
      if (!liveAvailable || !feed?.contracts) return []
      const inputs = SYMBOLS.map((sym) => {
        const q = feed.contracts![sym]
        const useWhatIf = whatIfEnabled && sym === selectedSymbol && effectivePrice !== null
        return {
          symbol: sym,
          quotedPrice: useWhatIf ? effectivePrice! : q.quotedPrice,
          expiryDate: q.expiryDate,
          asOf: q.asOf.slice(0, 19).replace('T', ' '),
          source: useWhatIf ? 'USER WHAT-IF OVERRIDE' : q.source,
        }
      })
      return compareNormalizedContracts(inputs, 'GOLDM')
    }

    if (!snapshot || snapshot.status === 'DATA_UNAVAILABLE') return []
    const inputs = snapshot.contracts
      .filter((c) => c.available && c.record)
      .map((c) => {
        const useWhatIf = whatIfEnabled && c.symbol === selectedSymbol && effectivePrice !== null
        return {
          symbol: c.symbol,
          quotedPrice: useWhatIf ? effectivePrice! : c.record!.settle,
          expiryDate: c.record!.expiryDate,
          asOf: c.record!.tradeDate,
          source: useWhatIf ? 'USER WHAT-IF OVERRIDE' : snapshot.source,
        }
      })
    if (inputs.length === 0) return []
    return compareNormalizedContracts(inputs, 'GOLDM')
  }, [
    usingLive,
    liveAvailable,
    feed,
    snapshot,
    whatIfEnabled,
    selectedSymbol,
    effectivePrice,
  ])

  const activeSpec = contractSpecs[selectedSymbol]
  const specAuditList = React.useMemo(
    () => snapshot?.specAudit ?? auditContractSpecsConsistency(),
    [snapshot]
  )

  const tradeIntent: TradeIntentInput | null = React.useMemo(() => {
    if (effectivePrice === null || effectivePrice <= 0) return null
    const expiry = usingLive
      ? activeLiveQuote?.expiryDate
      : activeContractItem?.record?.expiryDate
    if (!expiry) return null
    return {
      kind: 'SINGLE',
      side: 'BUY',
      contractA: selectedSymbol,
      priceA: effectivePrice,
      lotsA: 1,
      expiryA: expiry,
      sourceLabel: whatIfEnabled
        ? 'User What-If Price'
        : usingLive
          ? activeLiveQuote?.source ?? 'Live Global-to-MCX Parity'
          : 'MCX Bhavcopy Reference',
      asOf: usingLive ? feed?.asOf : snapshot?.resolvedTradeDate ?? selectedDate,
      rationale: `1-lot ${selectedSymbol} (${activeSpec.tradingUnitGrams}g) normalized at ₹${normalization?.normalized10gPrice.toLocaleString('en-IN') ?? '—'}/10g pure gold.`,
    }
  }, [
    effectivePrice,
    usingLive,
    activeLiveQuote,
    activeContractItem,
    selectedSymbol,
    whatIfEnabled,
    feed?.asOf,
    snapshot?.resolvedTradeDate,
    selectedDate,
    activeSpec.tradingUnitGrams,
    normalization?.normalized10gPrice,
  ])

  const isDataBusy = usingLive ? liveLoading || liveRefreshing : loading

  return (
    <section id="normalization-lab" className="border-b border-border bg-background">
      <div className="mx-auto max-w-[1360px] px-4 py-8 md:py-10">
        <SectionHead
          index="01.5"
          eyebrow="Feature 01 · Contract equivalence engine"
          title="Normalize every lot to 10 g pure gold."
          description="MCX gold contracts trade in 1 g, 8 g, 10 g, and 100 g lots with 995 or 999 purity. GoldPrism converts every quote via P_10g = (P_q × 10) / (q × p) before any cross-contract spread is judged."
          aside={
            <div className="flex flex-col items-start gap-2 lg:items-end">
              <DataTag
                live={usingLive && liveAvailable && !whatIfEnabled}
                synthetic={whatIfEnabled || (usingLive && !liveAvailable)}
                detail={
                  usingLive
                    ? feed?.asOf
                      ? `${feed.asOf.slice(0, 16).replace('T', ' ')} UTC`
                      : 'connecting'
                    : snapshot?.resolvedTradeDate
                      ? `as_of ${snapshot.resolvedTradeDate}`
                      : 'snapshot check'
                }
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
                Source · {usingLive ? 'Live Global-to-MCX Parity' : snapshot?.source ?? 'MCX Bhavcopy'}
              </span>
            </div>
          }
        />

        {/* Market / Feed Provenance Banner */}
        <div className="mt-6 rounded-[4px] border border-border bg-card p-4 shadow-[var(--gp-hard-shadow)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gp-watch-ink)]" />
              <div>
                <p className="gp-label">Feed mode &amp; provenance</p>
                <p className="mt-1 font-mono text-xs text-foreground">
                  {usingLive
                    ? liveLoading
                      ? 'Connecting to live XAU/USD, COMEX GC=F & USD/INR parity feeds…'
                      : liveAvailable
                        ? feed!.disclosure
                        : `Live feed unavailable (${feed?.error ?? 'upstream timeout'}). Switch to Bhavcopy Archive.`
                    : loading
                      ? 'Loading MCX Bhavcopy snapshot…'
                      : error
                        ? `Feed error: ${error}`
                        : snapshot?.status === 'DATA_UNAVAILABLE'
                          ? snapshot.message
                          : snapshot?.marketBanner}
                </p>
                {!usingLive && snapshot?.sha256Hash ? (
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    Dataset SHA-256: {snapshot.sha256Hash} · Coverage: {snapshot.dateRange?.start} to{' '}
                    {snapshot.dateRange?.end}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setFeedMode('LIVE')}
                  aria-pressed={usingLive}
                  className={cn(
                    'gp-button px-3 py-1.5 text-[10px] whitespace-nowrap shrink-0',
                    usingLive && 'gp-button--selected'
                  )}
                >
                  <Radio className="h-3.5 w-3.5" />
                  Live Parity
                </button>
                <button
                  type="button"
                  onClick={() => setFeedMode('BHAVCOPY')}
                  aria-pressed={!usingLive}
                  className={cn(
                    'gp-button px-3 py-1.5 text-[10px] whitespace-nowrap shrink-0',
                    !usingLive && 'gp-button--selected'
                  )}
                >
                  <History className="h-3.5 w-3.5" />
                  Bhavcopy
                </button>
              </div>

              {!usingLive ? (
                <div>
                  <label className="gp-label" htmlFor="norm-snapshot-date">
                    Snapshot date (as_of)
                  </label>
                  <input
                    id="norm-snapshot-date"
                    type="date"
                    value={selectedDate || snapshot?.resolvedTradeDate || ''}
                    min={snapshot?.dateRange?.start}
                    max={snapshot?.dateRange?.end}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="gp-field mt-1 text-xs"
                  />
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => (usingLive ? refreshFeed(true) : fetchSnapshot(selectedDate))}
                className="gp-button px-3"
                aria-label="Reload market data"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isDataBusy && 'animate-spin')} />
              </button>
            </div>
          </div>
        </div>

        {/* Interactive Lab: Left Controls + Formula Trace, Right Spec Audit */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,61.8%)_minmax(0,38.2%)]">
          <div className="min-w-0 overflow-hidden rounded-[4px] border border-border bg-card shadow-[var(--gp-hard-shadow)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-[var(--gp-vellum)]/60 px-4 py-2.5">
              <p className="gp-label text-foreground">Contract normalization calculator</p>
              <button
                type="button"
                role="switch"
                aria-checked={whatIfEnabled}
                onClick={() => {
                  setWhatIfEnabled((prev) => !prev)
                  if (!whatIfEnabled && officialPrice !== null) {
                    setWhatIfPriceInput(String(officialPrice))
                  }
                }}
                className={cn(
                  'gp-button px-3 py-1.5 text-[10px]',
                  whatIfEnabled && 'gp-button--selected'
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {whatIfEnabled ? 'Manual what-if: ON' : 'Manual what-if: OFF'}
              </button>
            </div>

            <div className="p-4">
              {whatIfEnabled ? (
                <div className="mb-4 border border-[var(--gp-watch-ink)] bg-[var(--gp-gold-50)] px-3 py-2 font-mono text-[11px] text-foreground dark:bg-[var(--gp-gold-900)]">
                  USER WHAT-IF ACTIVE — Overriding market reference price for exploratory simulation. Not live or historical market data.
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="gp-label" htmlFor="lab-contract-select">
                    MCX Gold contract
                  </label>
                  <select
                    id="lab-contract-select"
                    value={selectedSymbol}
                    onChange={(e) => setSelectedSymbol(e.target.value as ContractSymbol)}
                    className="gp-field gp-select mt-1 text-sm"
                  >
                    {SYMBOLS.map((sym) => (
                      <option key={sym} value={sym}>
                        {sym} · {contractSpecs[sym].tradingUnitGrams}g · purity{' '}
                        {contractSpecs[sym].purity}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <label className="gp-label" htmlFor="lab-price-input">
                      {whatIfEnabled
                        ? 'What-if quoted price (₹)'
                        : usingLive
                          ? 'Live parity quote (₹)'
                          : `Archived ${snapshot?.priceBasis?.toLowerCase() ?? 'mark'} (₹)`}
                    </label>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      per {activeSpec.quotedPerGrams}g
                    </span>
                  </div>
                  {whatIfEnabled ? (
                    <input
                      id="lab-price-input"
                      type="number"
                      step="0.1"
                      min="1"
                      value={whatIfPriceInput}
                      onChange={(e) => setWhatIfPriceInput(e.target.value)}
                      className="gp-field mt-1 text-sm"
                    />
                  ) : (
                    <input
                      id="lab-price-input"
                      type="text"
                      readOnly
                      value={
                        officialPrice !== null
                          ? `₹${officialPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                          : 'Data unavailable'
                      }
                      className="gp-field mt-1 bg-background/60 text-sm text-foreground"
                    />
                  )}
                  <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
                    {whatIfEnabled
                      ? `Reference quote: ${officialPrice !== null ? inr(officialPrice, 2) : 'Unavailable'}`
                      : usingLive
                        ? activeLiveQuote
                          ? `Source: ${activeLiveQuote.source} · Exp ${activeLiveQuote.expiryDate} · as_of ${activeLiveQuote.asOf.slice(0, 19).replace('T', ' ')}`
                          : 'Live feed unavailable'
                        : activeContractItem?.record
                          ? `Source: MCX Bhavcopy · Expiry ${activeContractItem.record.expiryDate} · as_of ${activeContractItem.record.tradeDate}`
                          : activeContractItem?.unavailableReason ?? 'Data unavailable'}
                  </p>
                </div>
              </div>

              {/* Contract Specification Strip */}
              <dl className="mt-5 grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
                <div className="bg-background p-3">
                  <dt className="gp-label">Trading unit</dt>
                  <dd className="gp-figure mt-1.5 text-sm">{activeSpec.tradingUnitGrams} g</dd>
                </div>
                <div className="bg-background p-3">
                  <dt className="gp-label">Quotation basis</dt>
                  <dd className="gp-figure mt-1.5 text-sm">Per {activeSpec.quotedPerGrams} g</dd>
                </div>
                <div className="bg-background p-3">
                  <dt className="gp-label">Purity (decimal)</dt>
                  <dd className="gp-figure mt-1.5 text-sm">{activeSpec.purity}</dd>
                </div>
                <div className="bg-background p-3">
                  <dt className="gp-label">Tick / lot</dt>
                  <dd className="gp-figure mt-1.5 text-sm">
                    ₹{activeSpec.tickSizeInr} / {activeSpec.lotSize} lot
                  </dd>
                </div>
              </dl>

              {/* Step-by-step Formula Substitution */}
              {normalization ? (
                <div className="mt-6 border-t border-border pt-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-4">
                    <div>
                      <p className="gp-label">Normalized 10 g pure-gold equivalence (1000 fine)</p>
                      <p className="gp-figure mt-2 text-3xl gp-gold-text">
                        {inr(normalization.normalized10gPrice, 2)}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          / 10 g pure gold
                        </span>
                      </p>
                    </div>
                    <div className="text-right font-mono text-xs text-muted-foreground">
                      <div>1 g pure: {inrPerG(normalization.pricePerPureGram, 2)}</div>
                      <div>1 g (999 X-Ray): {inrPerG(normalization.normalized999PerGram, 2)}</div>
                    </div>
                  </div>

                  <div className="mt-4 border border-border bg-background p-3 font-mono text-xs">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Substituted formula · {normalization.formulaSymbolic}
                    </div>
                    <div className="mt-1 text-foreground">{normalization.formulaSubstituted}</div>
                  </div>

                  <ol className="mt-4 space-y-2">
                    {normalization.steps.map((st) => (
                      <li
                        key={st.step}
                        className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 font-mono text-xs last:border-b-0"
                      >
                        <span className="text-muted-foreground">
                          {st.step}. {st.label}
                        </span>
                        <span className="text-foreground">{st.expression}</span>
                      </li>
                    ))}
                  </ol>

                  <p className="mt-4 border border-[var(--gp-gold-500)]/50 bg-background/60 p-3 font-mono text-[11px] text-muted-foreground">
                    Note: {normalization.disclaimer}
                  </p>
                </div>
              ) : (
                <div className="mt-6 border-t border-border pt-4 font-mono text-xs text-[var(--gp-blocked-ink)]">
                  Data unavailable for {selectedSymbol}. Enable Manual what-if or switch feed mode.
                </div>
              )}
            </div>
          </div>

          {/* Right Column: ContractSpec Cross-Check Audit */}
          <aside className="min-w-0 rounded-[4px] border border-border bg-card p-4 shadow-[var(--gp-hard-shadow)]">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
              <p className="gp-label text-foreground">Spec master cross-check</p>
              <span className="gp-tag gp-tag--tradable">Audited</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Cross-checked against MCX India contract circulars, existing{' '}
              <code className="font-mono text-[11px]">CONTRACT_MASTER</code>, Python{' '}
              <code className="font-mono text-[11px]">contract_master.py</code>, and the
              archived contract observations.
            </p>

            <div className="mt-3.5 space-y-2.5">
              {specAuditList.map((item) => (
                <div key={item.symbol} className="rounded-[4px] border border-border bg-background p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-medium text-foreground">
                      {item.symbol}
                    </span>
                    {item.matchesContractMaster ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--gp-tradable-ink)]">
                        <CheckCircle2 className="h-3 w-3" /> Consistent
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--gp-blocked-ink)]">
                        Mismatch
                      </span>
                    )}
                  </div>
                  {item.mismatches.map((m, i) => (
                    <p key={i} className="mt-1.5 font-mono text-[10px] text-[var(--gp-blocked-ink)]">
                      {m}
                    </p>
                  ))}
                  {item.notes.map((n, i) => (
                    <p key={i} className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      {n}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </aside>
        </div>

        <SpectralRule className="my-7" />

        {/* Side-by-side 4-Contract Normalized Comparison */}
        <div>
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-3">
            <div>
              <p className="gp-label">Side-by-side normalization · 10 g pure gold</p>
              <h3 className="gp-ledger mt-1 text-xl">
                Four heterogeneous quotes brought to one comparable scale.
              </h3>
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
              Baseline · GOLDM · as_of{' '}
              {usingLive
                ? feed?.asOf.slice(0, 19).replace('T', ' ') ?? 'connecting'
                : snapshot?.resolvedTradeDate ?? selectedDate}
            </p>
          </div>

          {sideBySideComparison.length === 0 ? (
            <div className="mt-4 rounded-[4px] border border-border bg-card p-5 font-mono text-xs text-muted-foreground">
              {usingLive
                ? 'Waiting for live parity feed…'
                : `Data unavailable for ${selectedDate}. Select a date within the archive.`}
            </div>
          ) : (
            <div className="mt-5 grid gap-px overflow-hidden rounded-[4px] border border-border bg-border shadow-[var(--gp-hard-shadow)] sm:grid-cols-2 lg:grid-cols-4">
              {SYMBOLS.map((sym) => {
                const row = sideBySideComparison.find((r) => r.symbol === sym)
                const item = snapshot?.contracts.find((c) => c.symbol === sym)
                const isWhatIf = whatIfEnabled && sym === selectedSymbol

                if (!row) {
                  return (
                    <div key={sym} className="bg-card p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-medium">{sym}</span>
                        <span className="gp-tag gp-tag--blocked">Unavailable</span>
                      </div>
                      <p className="mt-4 font-mono text-xs text-muted-foreground">
                        {item?.unavailableReason ?? 'No quote on selected date.'}
                      </p>
                    </div>
                  )
                }

                return (
                  <div
                    key={sym}
                    onClick={() => setSelectedSymbol(sym)}
                    className={cn(
                      'flex cursor-pointer flex-col justify-between bg-card p-4 transition-colors hover:bg-[var(--gp-gold-50)]/60 dark:hover:bg-[var(--gp-gold-900)]/40',
                      sym === selectedSymbol && 'bg-[var(--gp-gold-50)] dark:bg-[var(--gp-gold-900)]'
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-medium text-foreground">
                          {sym}
                        </span>
                        <span
                          className={cn(
                            'gp-tag',
                            isWhatIf ? 'gp-tag--watch' : 'gp-tag--neutral'
                          )}
                        >
                          {isWhatIf ? 'What-if' : `Exp ${row.expiryDate}`}
                        </span>
                      </div>

                      <div className="mt-4 border-t border-border pt-3">
                        <p className="gp-label">Raw quote (per {row.spec.quotedPerGrams}g)</p>
                        <p className="gp-figure mt-1 text-base text-muted-foreground">
                          {inr(row.quotedPrice, 2)}
                        </p>
                      </div>

                      <div className="mt-3 border-t border-border pt-3">
                        <p className="gp-label">Normalized 10 g pure gold</p>
                        <p className="gp-figure mt-1 text-2xl text-foreground">
                          {inr(row.normalized10gPrice, 2)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-border pt-3 font-mono text-[11px]">
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Spread vs GOLDM</span>
                        <span className="text-foreground">
                          {row.symbol === 'GOLDM'
                            ? 'Baseline (0.0 bps)'
                            : `${inr(row.spreadVsBaseline10g, 2)} (${bps(row.spreadVsBaselineBps)})`}
                        </span>
                      </div>
                      <p className="mt-1 text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                        {row.source} · {row.asOf}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <p className="mt-4 font-mono text-[11px] text-muted-foreground">
            Unit-normalization only, not a complete carry-adjusted price. Click any contract card above to inspect its step-by-step substitution or execute below.
          </p>
        </div>

        {tradeIntent ? (
          <div className="mt-8">
            <OneClickTradeBar
              intent={tradeIntent}
              compact
              title={`1-Click Execute Selected Contract · ${selectedSymbol}`}
            />
          </div>
        ) : null}
      </div>
    </section>
  )
}
