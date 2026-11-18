'use client'

import * as React from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Lock,
  Pause,
  Play,
  SkipForward,
} from 'lucide-react'
import {
  DataTag,
  Hallmark,
  SectionHead,
  SpectralRule,
  VerdictTag,
  normalizeVerdict,
} from '@/components/goldprism/brand'
import { bps, inr, inrPerG } from '@/lib/goldprism/format'
import type {
  FullPeriodReplaySummary,
  ReplayPairId,
  ReplayPanelResult,
} from '@/lib/goldprism/historical-store'
import { cn } from '@/lib/utils'

interface PairOption {
  id: ReplayPairId
  label: string
  description: string
}

export function BacktestReplayLab() {
  const [pairId, setPairId] = React.useState<ReplayPairId>('GOLDM_CALENDAR')
  const [summary, setSummary] = React.useState<FullPeriodReplaySummary | null>(null)
  const [pairs, setPairs] = React.useState<PairOption[]>([
    { id: 'GOLDM_CALENDAR', label: 'GOLDM Far vs GOLDM Near', description: '' },
    { id: 'GOLDTEN_GOLDM', label: 'GOLDTEN Near vs GOLDM Near', description: '' },
    { id: 'GOLDGUINEA_GOLDM', label: 'GOLDGUINEA Near vs GOLDM Near', description: '' },
    { id: 'GOLDPETAL_GOLDM', label: 'GOLDPETAL Near vs GOLDM Near', description: '' },
  ])
  const [replay, setReplay] = React.useState<ReplayPanelResult | null>(null)
  const [dateIndex, setDateIndex] = React.useState<number>(290)
  const [revealOutcome, setRevealOutcome] = React.useState<boolean>(false)
  const [isPlaying, setIsPlaying] = React.useState<boolean>(false)
  const [loading, setLoading] = React.useState<boolean>(true)
  const [error, setError] = React.useState<string | null>(null)

  const allDates = summary?.allDates ?? []
  const currentAsOf = allDates[dateIndex] ?? '2025-02-21'

  // Fetch summary + initial replay when pair changes
  React.useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    setRevealOutcome(false)
    setIsPlaying(false)

    fetch(
      `/api/goldprism/replay?pair=${encodeURIComponent(pairId)}&as_of=${encodeURIComponent(currentAsOf)}&reveal=0&include_summary=1`
    )
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
        return data
      })
      .then((data) => {
        if (!active) return
        if (data.summary) {
          setSummary(data.summary)
          const holdoutIdx = data.summary.allDates.findIndex(
            (d: string) => d >= data.summary.holdoutStartDate
          )
          if (holdoutIdx >= 0 && !allDates.length) {
            setDateIndex(holdoutIdx)
          }
        }
        if (data.pairs) setPairs(data.pairs)
        setReplay(data.replay)
      })
      .catch((e) => {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Failed to load replay')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [pairId])

  // Fetch point-in-time snapshot whenever dateIndex or revealOutcome changes
  React.useEffect(() => {
    if (allDates.length === 0) return
    const targetDate = allDates[dateIndex]
    if (!targetDate) return

    let active = true
    fetch(
      `/api/goldprism/replay?pair=${encodeURIComponent(pairId)}&as_of=${encodeURIComponent(targetDate)}&reveal=${revealOutcome ? '1' : '0'}`
    )
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
        return data
      })
      .then((data) => {
        if (!active) return
        setReplay(data.replay)
      })
      .catch((e) => {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Failed to update replay snapshot')
      })

    return () => {
      active = false
    }
  }, [dateIndex, revealOutcome, pairId, allDates])

  // Reset reveal gate whenever user steps to a new date
  const selectDateIndex = (nextIdx: number) => {
    const clamped = Math.max(0, Math.min(Math.max(0, allDates.length - 1), nextIdx))
    setRevealOutcome(false)
    setDateIndex(clamped)
  }

  // Playback interval
  React.useEffect(() => {
    if (!isPlaying || allDates.length === 0) return
    const timer = setInterval(() => {
      setRevealOutcome(false)
      setDateIndex((prev) => {
        if (prev >= allDates.length - 1) {
          setIsPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, 900)
    return () => clearInterval(timer)
  }, [isPlaying, allDates.length])

  const holdoutStartIdx = React.useMemo(() => {
    if (!summary) return 0
    const idx = summary.allDates.findIndex((d) => d >= summary.holdoutStartDate)
    return idx >= 0 ? idx : summary.allDates.length
  }, [summary])

  const trainPct =
    allDates.length > 1 ? (holdoutStartIdx / (allDates.length - 1)) * 100 : 80

  const verdict = replay?.panel5Verdict ? normalizeVerdict(replay.panel5Verdict.verdict) : null

  return (
    <section id="backtest-replay" className="border-b border-border bg-background">
      <div className="mx-auto max-w-[1360px] px-4 py-8 md:py-10">
        <SectionHead
          index="02.7"
          eyebrow="Feature 02 · Point-in-time backtest replay"
          title="Replay any date without peeking ahead."
          description="Every panel below queries strictly rows with trade_date ≤ as_of. Forward outcomes stay locked behind an explicit reveal gate, and the unseen sealed holdout partition is visually separated from training."
          aside={
            <div className="flex flex-col items-start gap-2 lg:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <DataTag detail={`as_of ${replay?.resolvedTradeDate ?? currentAsOf}`} />
                {replay ? (
                  <span
                    className={cn(
                      'gp-tag',
                      replay.partition === 'SEALED_HOLDOUT'
                        ? 'gp-tag--gold'
                        : 'gp-tag--neutral'
                    )}
                  >
                    {replay.partition === 'SEALED_HOLDOUT'
                      ? 'Unseen Holdout'
                      : 'Training Period'}
                  </span>
                ) : null}
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
                Source · {replay?.provenance.datasetName ?? 'mcx_gold_18m_bhavcopy_snapshot'}
              </span>
            </div>
          }
        />

        {/* Timeline & Pair Controls */}
        <div className="mt-6 rounded-[4px] border border-border bg-card p-4 shadow-[var(--gp-hard-shadow)]">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div>
              <label className="gp-label" htmlFor="replay-pair-select">
                Spread pair
              </label>
              <select
                id="replay-pair-select"
                value={pairId}
                onChange={(e) => setPairId(e.target.value as ReplayPairId)}
                className="gp-field gp-select mt-1 max-w-md text-sm"
              >
                {pairs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => selectDateIndex(dateIndex - 1)}
                disabled={dateIndex <= 0}
                className="gp-button px-3"
                aria-label="Previous trading day"
              >
                <ChevronLeft className="h-4 w-4" /> Step -1
              </button>
              <button
                type="button"
                onClick={() => setIsPlaying((p) => !p)}
                className={cn('gp-button px-3', isPlaying && 'gp-button--primary')}
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-3.5 w-3.5" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" /> Play
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => selectDateIndex(dateIndex + 1)}
                disabled={dateIndex >= allDates.length - 1}
                className="gp-button px-3"
                aria-label="Next trading day"
              >
                Step +1 <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => selectDateIndex(holdoutStartIdx)}
                className="gp-button px-3"
              >
                <SkipForward className="h-3.5 w-3.5" /> Jump to Holdout ({summary?.holdoutStartDate ?? '2025-02-21'})
              </button>
            </div>
          </div>

          {/* Slider + Train / Holdout Colored Partition Band */}
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
              <span className="text-foreground">
                Selected as_of: <strong>{currentAsOf}</strong> ({dateIndex + 1} /{' '}
                {allDates.length || 391} trading days)
              </span>
              <span className="text-muted-foreground">
                Training cutoff: {summary?.trainingBoundaryDate ?? '2025-02-20'} · Holdout starts:{' '}
                {summary?.holdoutStartDate ?? '2025-02-21'}
              </span>
            </div>

            <input
              type="range"
              aria-label="Replay date slider"
              min={0}
              max={Math.max(0, allDates.length - 1)}
              value={dateIndex}
              onChange={(e) => selectDateIndex(Number(e.target.value))}
              className="mt-3 w-full cursor-pointer accent-[var(--gp-gold-500)]"
            />

            {/* Colored Train vs Sealed Holdout Bar */}
            <div className="mt-2 flex h-3 w-full overflow-hidden border border-border">
              <div
                style={{ width: `${trainPct}%` }}
                className="bg-[var(--gp-slag-300)] dark:bg-[var(--gp-slag-700)]"
                title="Training Partition (2024-01-01 to 2025-02-20)"
              />
              <div
                style={{ width: `${100 - trainPct}%` }}
                className="bg-[var(--gp-gold-400)]"
                title="Unseen Sealed Holdout Partition (2025-02-21 to 2025-06-30)"
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              <span>Training ({allDates[0] ?? '2024-01-01'} – 2025-02-20)</span>
              <span className="gp-gold-text">
                Unseen Holdout (2025-02-21 – {allDates[allDates.length - 1] ?? '2025-06-30'})
              </span>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-6 border border-[var(--gp-blocked-ink)] bg-card p-4 font-mono text-xs text-[var(--gp-blocked-ink)]">
            {error}
          </div>
        ) : null}

        {loading && !replay ? (
          <div className="mt-8 border border-border bg-card p-8 font-mono text-xs text-muted-foreground">
            Loading point-in-time snapshot…
          </div>
        ) : replay ? (
          <>
            {/* 7-PANEL POINT-IN-TIME SNAPSHOT */}
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              {/* Panel 1: Data available on date */}
              <div className="rounded-[4px] border border-border bg-card p-4 shadow-[var(--gp-hard-shadow)]">
                <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
                  <p className="gp-label text-foreground">01 · Data availability as of {replay.asOf}</p>
                  <span
                    className={cn(
                      'gp-tag',
                      replay.panel1DataAvailability.marketStatus === 'DATA_UNAVAILABLE'
                        ? 'gp-tag--blocked'
                        : 'gp-tag--tradable'
                    )}
                  >
                    {replay.panel1DataAvailability.marketStatus}
                  </span>
                </div>
                <dl className="mt-3.5 space-y-2 font-mono text-xs">
                  <Row label="Last official bar" value={replay.panel1DataAvailability.resolvedTradeDate ?? 'Unavailable'} />
                  <Row label="Stale days" value={`${replay.panel1DataAvailability.staleDays} d`} />
                  <Row
                    label="Rows visible (≤ as_of)"
                    value={`${replay.panel1DataAvailability.rowsUpToAsOf} rows (${replay.panel1DataAvailability.tradingDaysUpToAsOf} days)`}
                  />
                  <Row
                    label="Contract coverage"
                    value={`${replay.panel1DataAvailability.completenessPct}% (${replay.panel1DataAvailability.availableContracts.join(', ') || 'None'})`}
                  />
                  {replay.panel1DataAvailability.missingContracts.length > 0 ? (
                    <Row
                      label="Missing / unlisted"
                      value={replay.panel1DataAvailability.missingContracts.join(', ')}
                    />
                  ) : null}
                  <Row
                    label="Dataset SHA-256"
                    value={replay.panel1DataAvailability.sha256Hash.slice(0, 20) + '…'}
                  />
                </dl>
              </div>

              {/* Panel 4: What the model knew at that point */}
              <div className="rounded-[4px] border border-border bg-card p-4 shadow-[var(--gp-hard-shadow)]">
                <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
                  <p className="gp-label text-foreground">04 · Model state at {replay.asOf}</p>
                  <span className="gp-tag gp-tag--neutral">
                    Cutoff {replay.panel4ModelState.trainingCutoffDate}
                  </span>
                </div>
                <dl className="mt-3.5 space-y-2 font-mono text-xs">
                  <Row
                    label="Rolling window"
                    value={`${replay.panel4ModelState.barsInWindow} / ${replay.panel4ModelState.signalWindowBars} bars (≤ as_of)`}
                  />
                  <Row
                    label="Rolling residual mean"
                    value={
                      replay.panel4ModelState.rollingMeanResidualInrPerG !== null
                        ? inrPerG(replay.panel4ModelState.rollingMeanResidualInrPerG, 2)
                        : 'Insufficient bars'
                    }
                  />
                  <Row
                    label="Rolling residual std"
                    value={
                      replay.panel4ModelState.rollingStdResidualInrPerG !== null
                        ? inrPerG(replay.panel4ModelState.rollingStdResidualInrPerG, 2)
                        : 'Insufficient bars'
                    }
                  />
                  <Row
                    label="Current z-score"
                    value={
                      replay.panel4ModelState.zScoreAtAsOf !== null
                        ? `${replay.panel4ModelState.zScoreAtAsOf} (entry > ${replay.panel4ModelState.entryZScoreThreshold})`
                        : 'N/A'
                    }
                  />
                  <Row
                    label="Carry & expiry gap"
                    value={`${(replay.panel4ModelState.annualCarryRate * 100).toFixed(1)}% ACT/365 · ${replay.panel4ModelState.expiryDaysDiff ?? '—'} days`}
                  />
                  <Row label="Frozen config hash" value={replay.panel4ModelState.configHash} />
                </dl>
              </div>
            </div>

            {/* Panel 2: Contract eligibility */}
            <div className="mt-5 overflow-hidden rounded-[4px] border border-border bg-card shadow-[var(--gp-hard-shadow)]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-[var(--gp-vellum)]/60 px-4 py-2.5">
                <p className="gp-label text-foreground">02 · Contract eligibility gates as of {replay.resolvedTradeDate ?? replay.asOf}</p>
                <span className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
                  Volume ≥ 50 · Active expiry ≥ trade date
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="gp-table">
                  <thead>
                    <tr>
                      <th scope="col">Contract</th>
                      <th scope="col">Expiry</th>
                      <th scope="col" className="gp-num">DTE</th>
                      <th scope="col" className="gp-num">Settle</th>
                      <th scope="col" className="gp-num">Volume</th>
                      <th scope="col" className="gp-num">OI</th>
                      <th scope="col">Gate status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {replay.panel2Eligibility.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-muted-foreground">
                          No contract records available on this date.
                        </td>
                      </tr>
                    ) : (
                      replay.panel2Eligibility.map((row) => (
                        <tr key={`${row.symbol}-${row.expiryDate}`}>
                          <td className="font-medium text-foreground">{row.symbol}</td>
                          <td className="text-muted-foreground">{row.expiryDate}</td>
                          <td className="gp-num">{row.daysToExpiry}d</td>
                          <td className="gp-num">{inr(row.settle, 2)}</td>
                          <td className="gp-num">{row.volume.toLocaleString('en-IN')}</td>
                          <td className="gp-num">{row.openInterest.toLocaleString('en-IN')}</td>
                          <td>
                            <span
                              className={cn(
                                'gp-tag',
                                row.eligible ? 'gp-tag--tradable' : 'gp-tag--blocked'
                              )}
                            >
                              {row.eligible ? 'Eligible' : row.reasons.join(', ')}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Panels 3 & 5: Normalized Spread + Existing Verdict Engine */}
            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,55%)_minmax(0,45%)]">
              <div className="border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
                  <p className="gp-label">03 · Normalized spread (Feature 1)</p>
                  <span className="gp-tag gp-tag--neutral">{replay.pairLabel}</span>
                </div>

                {!replay.panel3NormalizedSpread.available ? (
                  <p className="mt-4 font-mono text-xs text-[var(--gp-blocked-ink)]">
                    {replay.panel3NormalizedSpread.unavailableReason}
                  </p>
                ) : (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="border border-border bg-background p-3">
                        <p className="gp-label">
                          Leg A · {replay.panel3NormalizedSpread.legA?.symbol} ({replay.panel3NormalizedSpread.legA?.lotsMatched} lots)
                        </p>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          Exp {replay.panel3NormalizedSpread.legA?.expiryDate} · Quoted{' '}
                          {inr(replay.panel3NormalizedSpread.legA?.quotedPrice ?? 0, 2)}
                        </p>
                        <p className="gp-figure mt-2 text-lg">
                          {inr(
                            replay.panel3NormalizedSpread.legA?.normalization.normalized10gPrice ?? 0,
                            2
                          )}{' '}
                          <span className="text-[10px] text-muted-foreground">/10g pure</span>
                        </p>
                      </div>

                      <div className="border border-border bg-background p-3">
                        <p className="gp-label">
                          Leg B · {replay.panel3NormalizedSpread.legB?.symbol} ({replay.panel3NormalizedSpread.legB?.lotsMatched} lots)
                        </p>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          Exp {replay.panel3NormalizedSpread.legB?.expiryDate} · Quoted{' '}
                          {inr(replay.panel3NormalizedSpread.legB?.quotedPrice ?? 0, 2)}
                        </p>
                        <p className="gp-figure mt-2 text-lg">
                          {inr(
                            replay.panel3NormalizedSpread.legB?.normalization.normalized10gPrice ?? 0,
                            2
                          )}{' '}
                          <span className="text-[10px] text-muted-foreground">/10g pure</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-border pt-3 font-mono text-xs">
                      <span className="text-muted-foreground">Normalized spread (A − B)</span>
                      <span className="gp-figure text-base text-foreground">
                        {inr(replay.panel3NormalizedSpread.spread10gPureInr, 2)}/10g ·{' '}
                        {bps(replay.panel3NormalizedSpread.spreadBps)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
                  <p className="gp-label">05 · Existing verdict engine output</p>
                  {verdict ? <VerdictTag verdict={verdict} /> : null}
                </div>

                {replay.panel5Verdict && verdict ? (
                  <div className="mt-4">
                    <div className="flex items-start gap-4">
                      <Hallmark verdict={verdict} size={52} />
                      <div>
                        <p className="gp-ledger text-xl">{replay.panel5Verdict.verdictTitle}</p>
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                          {replay.panel5Verdict.verdictMessage}
                        </p>
                      </div>
                    </div>
                    <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 font-mono text-xs">
                      <div>
                        <dt className="gp-label">Raw</dt>
                        <dd className="mt-1">{bps(replay.panel5Verdict.rawSpreadBps)}</dd>
                      </div>
                      <div>
                        <dt className="gp-label">Residual</dt>
                        <dd className="mt-1">{bps(replay.panel5Verdict.grossResidualBps)}</dd>
                      </div>
                      <div>
                        <dt className="gp-label">Net edge</dt>
                        <dd className="mt-1 font-medium">{bps(replay.panel5Verdict.netEdgeBps)}</dd>
                      </div>
                    </dl>
                  </div>
                ) : (
                  <p className="mt-4 font-mono text-xs text-muted-foreground">
                    Verdict unavailable because pair legs are missing on this date.
                  </p>
                )}
              </div>
            </div>

            {/* Panels 6 & 7: Forward Outcome (Gated) + Cost Elimination */}
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              {/* Panel 7: Transaction costs elimination */}
              <div className="border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <p className="gp-label">07 · Transaction cost elimination</p>
                  <span
                    className={cn(
                      'gp-tag',
                      replay.panel7CostAnalysis.survivalStatus === 'SURVIVED_COSTS'
                        ? 'gp-tag--tradable'
                        : replay.panel7CostAnalysis.survivalStatus === 'ELIMINATED_BY_COSTS'
                          ? 'gp-tag--blocked'
                          : 'gp-tag--neutral'
                    )}
                  >
                    {replay.panel7CostAnalysis.survivalStatus === 'SURVIVED_COSTS'
                      ? 'Survived costs'
                      : replay.panel7CostAnalysis.survivalStatus === 'ELIMINATED_BY_COSTS'
                        ? 'Eliminated by costs'
                        : replay.panel7CostAnalysis.survivalStatus}
                  </span>
                </div>

                {replay.panel7CostAnalysis.available && replay.panel7CostAnalysis.itemizedCostsInr ? (
                  <dl className="mt-4 space-y-2 font-mono text-xs">
                    <Row
                      label="Gross residual"
                      value={`${bps(replay.panel7CostAnalysis.grossResidualBps)} (${inrPerG(replay.panel7CostAnalysis.grossResidualInrPerG, 2)})`}
                    />
                    <Row
                      label="Total round-trip costs"
                      value={`${bps(-replay.panel7CostAnalysis.totalCostsBps)} (${inr(replay.panel7CostAnalysis.itemizedCostsInr.totalRoundTrip, 2)})`}
                    />
                    <Row
                      label="  Brokerage / Exchange / SEBI"
                      value={`${inr(replay.panel7CostAnalysis.itemizedCostsInr.brokerage, 2)} / ${inr(replay.panel7CostAnalysis.itemizedCostsInr.exchangeCharges, 2)} / ${inr(replay.panel7CostAnalysis.itemizedCostsInr.sebi, 2)}`}
                    />
                    <Row
                      label="  CTT / GST / Stamp / Slippage"
                      value={`${inr(replay.panel7CostAnalysis.itemizedCostsInr.ctt, 2)} / ${inr(replay.panel7CostAnalysis.itemizedCostsInr.gst, 2)} / ${inr(replay.panel7CostAnalysis.itemizedCostsInr.stampDuty, 2)} / ${inr(replay.panel7CostAnalysis.itemizedCostsInr.slippage, 2)}`}
                    />
                    <div className="border-t border-border pt-2">
                      <Row
                        label="Net edge after costs"
                        value={`${bps(replay.panel7CostAnalysis.netEdgeBps)} (hurdle ${replay.panel7CostAnalysis.costHurdleBps} bps)`}
                      />
                    </div>
                  </dl>
                ) : (
                  <p className="mt-4 font-mono text-xs text-muted-foreground">
                    Cost analysis unavailable on this date.
                  </p>
                )}
              </div>

              {/* Panel 6: Gated Forward Outcome */}
              <div className="border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <p className="gp-label">06 · Forward outcome (post-signal)</p>
                  {!revealOutcome ? (
                    <span className="gp-tag gp-tag--watch">
                      <Lock className="mr-1 h-3 w-3" /> Sealed
                    </span>
                  ) : (
                    <span className="gp-tag gp-tag--tradable">Revealed</span>
                  )}
                </div>

                {!revealOutcome ? (
                  <div className="mt-5 flex flex-col items-start gap-3">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Future prices after {replay.resolvedTradeDate ?? replay.asOf} are excluded from
                      the point-in-time API response until you explicitly reveal them.
                    </p>
                    <button
                      type="button"
                      onClick={() => setRevealOutcome(true)}
                      className="gp-button gp-button--primary"
                    >
                      <Eye className="h-4 w-4" /> Reveal outcome
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="gp-table">
                      <thead>
                        <tr>
                          <th scope="col">Horizon</th>
                          <th scope="col">Target bar</th>
                          <th scope="col" className="gp-num">Gross ₹/g</th>
                          <th scope="col" className="gp-num">Net ₹/g</th>
                          <th scope="col" className="gp-num">Net (100g)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(replay.panel6ForwardOutcome?.horizons ?? []).map((h) => (
                          <tr key={h.horizonDays}>
                            <td className="font-mono">+{h.horizonDays}d</td>
                            <td className="font-mono text-muted-foreground">
                              {h.status === 'AVAILABLE'
                                ? h.targetDate
                                : 'Beyond dataset'}
                            </td>
                            <td className="gp-num">
                              {h.grossPnlInrPerG !== null ? inrPerG(h.grossPnlInrPerG, 2) : '—'}
                            </td>
                            <td className="gp-num">
                              {h.netPnlInrPerG !== null ? inrPerG(h.netPnlInrPerG, 2) : '—'}
                            </td>
                            <td className="gp-num">
                              {h.netPnlMatched100gInr !== null
                                ? inr(h.netPnlMatched100gInr, 2)
                                : 'Unavailable'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}

        <SpectralRule className="my-7" />

        {/* Aggregate Training vs Holdout Stats + Equity Curve */}
        {summary ? (
          <div>
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-3">
              <div>
                <p className="gp-label">Aggregate replay performance · Train vs Holdout</p>
                <h3 className="gp-ledger mt-1 text-xl">
                  Separate accounting for Training and Sealed Holdout.
                </h3>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
                100 g matched notional · signal at t filled at t+1
              </p>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <PartitionCard title="Training partition" stats={summary.trainingStats} />
              <PartitionCard title="Sealed holdout partition" stats={summary.holdoutStats} highlight />
            </div>

            <div className="mt-5 rounded-[4px] border border-border bg-card p-4 shadow-[var(--gp-hard-shadow)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                <p className="gp-label text-foreground">Cumulative net P&amp;L curve (₹ · after statutory costs)</p>
                <span className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
                  Dashed rule marks holdout boundary ({summary.holdoutStartDate})
                </span>
              </div>
              <div className="mt-4 h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={summary.equityCurve} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="1 4" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="var(--gp-slag-500)"
                      tick={{ fontSize: 10, fontFamily: 'var(--gp-instrument)' }}
                      minTickGap={36}
                    />
                    <YAxis
                      stroke="var(--gp-slag-500)"
                      tick={{ fontSize: 10, fontFamily: 'var(--gp-instrument)' }}
                      tickFormatter={(v: number) => `₹${v.toLocaleString('en-IN')}`}
                      width={72}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        boxShadow: 'var(--gp-hard-shadow)',
                        fontFamily: 'var(--gp-instrument)',
                        fontSize: 11,
                      }}
                    />
                    <ReferenceLine
                      x={summary.holdoutStartDate}
                      stroke="var(--gp-gold-500)"
                      strokeDasharray="4 4"
                    />
                    <Line
                      type="monotone"
                      dataKey="cumulativeGrossPnlInr"
                      name="Cumulative Gross P&L"
                      stroke="var(--gp-slag-500)"
                      strokeDasharray="4 3"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="cumulativeNetPnlInr"
                      name="Cumulative Net P&L"
                      stroke="var(--gp-gold-500)"
                      strokeWidth={2.2}
                      dot={false}
                      activeDot={{ r: 4, fill: 'var(--gp-gold-500)', strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  )
}

function PartitionCard({
  title,
  stats,
  highlight = false,
}: {
  title: string
  stats: FullPeriodReplaySummary['trainingStats']
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'border border-border bg-card p-4',
        highlight && 'border-[var(--gp-gold-500)]'
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
        <div>
          <p className="gp-label">{title}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {stats.startDate} to {stats.endDate} ({stats.totalBars} bars)
          </p>
        </div>
        <span className={cn('gp-tag', highlight ? 'gp-tag--gold' : 'gp-tag--neutral')}>
          {stats.partition}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 font-mono text-xs sm:grid-cols-3">
        <div>
          <dt className="gp-label">Signals (Tradable)</dt>
          <dd className="gp-figure mt-1 text-lg">{stats.tradableSignals}</dd>
        </div>
        <div>
          <dt className="gp-label">Win rate</dt>
          <dd className="gp-figure mt-1 text-lg">{stats.winRatePct.toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="gp-label">Profit factor</dt>
          <dd className="gp-figure mt-1 text-lg">
            {stats.profitFactor !== null ? stats.profitFactor.toFixed(2) : '—'}
          </dd>
        </div>
        <div>
          <dt className="gp-label">Cum. Net P&amp;L</dt>
          <dd className="gp-figure mt-1 text-lg">{inr(stats.cumulativeNetPnlInr, 2)}</dd>
        </div>
        <div>
          <dt className="gp-label">Cum. Gross P&amp;L</dt>
          <dd className="gp-figure mt-1 text-sm text-muted-foreground">
            {inr(stats.cumulativeGrossPnlInr, 2)}
          </dd>
        </div>
        <div>
          <dt className="gp-label">Cost drag</dt>
          <dd className="gp-figure mt-1 text-sm text-[var(--gp-blocked-ink)]">
            {inr(-stats.totalCostDragInr, 2)}
          </dd>
        </div>
      </dl>
    </div>
  )
}
