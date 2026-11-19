'use client'

import * as React from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTag, SectionHead } from '@/components/goldprism/brand'
import { useLiveFeed } from '@/components/goldprism/LiveFeedProvider'
import { CLEAN_MCX_BHAVCOPY_CSV, generateWalkForwardHistory } from '@/lib/goldprism/fixtures'
import { rankBestVehicleForExposure } from '@/lib/goldprism/signal'

const EXPORTS = [
  {
    id: 'bhavcopy',
    type: 'CSV',
    title: 'Normalized bhavcopy',
    description:
      'Cleaned MCX settlement prices converted to a 999-fine ₹/g basis, with volume and open-interest flags.',
    filename: 'goldprism_bhavcopy_normalized.csv',
  },
  {
    id: 'backtest',
    type: 'CSV',
    title: 'Walk-forward backtest',
    description:
      'Monthly gross alpha, net returns and drawdown metrics for the calendar-spread strategy.',
    filename: 'goldprism_walkforward_backtest.csv',
  },
  {
    id: 'vehicles',
    type: 'CSV',
    title: 'Best-vehicle rankings',
    description:
      'Ranked lot sizes, exposure mismatch percentages and total friction for a 50 g target exposure.',
    filename: 'goldprism_best_vehicle_ranking_50g.csv',
  },
  {
    id: 'manifest',
    type: 'JSON',
    title: 'Audit run manifest',
    description:
      'Machine-readable config hashes, parameters and reproducibility seeds for the frozen run.',
    filename: 'goldprism_audit_manifest.json',
  },
] as const

export function ReportsExportSection() {
  const { feed, marketHistory, marketHistoryError } = useLiveFeed()
  const [exportError, setExportError] = React.useState<string | null>(null)

  const triggerDownload = (filename: string, content: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const exportBhavcopy = () => {
    triggerDownload('goldprism_bhavcopy_normalized.csv', CLEAN_MCX_BHAVCOPY_CSV, 'text/csv')
  }

  const exportBacktest = () => {
    const history = generateWalkForwardHistory()
    const header = 'Date,GrossReturnBps,NetReturnBps,GrossCumBps,NetCumBps,DrawdownBps,Verdict\n'
    const rows = history
      .map(
        (h) =>
          `${h.date},${h.grossReturnBps},${h.netReturnBps},${h.grossCumulativeBps},${h.netCumulativeBps},${h.drawdownBps},${h.verdict}`
      )
      .join('\n')
    triggerDownload('goldprism_walkforward_backtest.csv', header + rows, 'text/csv')
  }

  const exportBestVehicle = () => {
    const vehicles = rankBestVehicleForExposure(50)
    const header = 'Rank,Contract,RequiredLots,ActualExposureG,MismatchPct,CostPerGramInr,CostBps\n'
    const rows = vehicles
      .map(
        (v) =>
          `${v.rank},${v.contractCode},${v.lotsRequired},${v.actualExposureG},${v.exposureMismatchPct},${v.estimatedCostPerGramInr},${v.estimatedCostBps}`
      )
      .join('\n')
    triggerDownload('goldprism_best_vehicle_ranking_50g.csv', header + rows, 'text/csv')
  }

  const exportManifest = () => {
    const manifest = {
      project: 'GoldPrism — Prism That Explains Scattered Gold',
      dataMode: 'Synthetic fixture · 20 Mar 2026',
      runId: 'GP-A84F2B01',
      engineVersion: '1.0.0-auditable',
      timestamp: new Date().toISOString(),
      contractsVerified: ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'],
      normalizationStandard: '₹/g 999-fine gold equivalence',
      reconciliationToleranceInr: 0.01,
      costHurdleBps: 5.0,
      provenanceHash: 'sha256_bhavcopy_clean_20260320_verified',
      auditStatus: 'PASS',
    }
    triggerDownload(
      'goldprism_audit_manifest.json',
      JSON.stringify(manifest, null, 2),
      'application/json'
    )
  }

  const exportLiveFeed = () => {
    setExportError(null)
    if (feed?.status !== 'LIVE_PARITY' || !feed.contracts) {
      setExportError('Live global-parity data is currently unavailable.')
      return
    }

    triggerDownload(
      `goldprism_global-parity_${new Date(feed.asOf).toISOString().slice(0, 10)}.json`,
      JSON.stringify(feed, null, 2),
      'application/json'
    )
  }

  const exportMarketHistory = () => {
    setExportError(null)
    if (marketHistoryError) {
      setExportError(`PostgreSQL market history is unavailable: ${marketHistoryError}`)
      return
    }
    if (marketHistory.length === 0) {
      setExportError('No PostgreSQL market snapshots are available to export yet.')
      return
    }

    triggerDownload(
      `goldprism_postgres-market-history_${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(marketHistory, null, 2),
      'application/json'
    )
  }

  const actions: Record<string, () => void> = {
    bhavcopy: exportBhavcopy,
    backtest: exportBacktest,
    vehicles: exportBestVehicle,
    manifest: exportManifest,
  }

  return (
    <section id="reports" className="scroll-mt-16 border-b border-border bg-background">
      <div className="mx-auto max-w-[1360px] px-4 py-8 md:py-10">
        <SectionHead
          index="03.2"
          eyebrow="Audit trail · Reports"
          title="Take the record with you."
          description="Download the raw audit artifacts: validated bhavcopy, backtest time series, vehicle rankings and the frozen configuration manifest."
          aside={<DataTag synthetic detail="fixture run" />}
        />

        <div className="mt-8 grid gap-px overflow-hidden rounded-[4px] border border-border bg-border shadow-[var(--gp-hard-shadow)] sm:grid-cols-2 xl:grid-cols-4">
          {EXPORTS.map((item) => (
            <article key={item.id} className="flex flex-col justify-between bg-card p-4">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="gp-tag gp-tag--neutral shrink-0">{item.type}</span>
                  <span
                    title={item.filename}
                    className="min-w-0 truncate font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground"
                  >
                    {item.filename}
                  </span>
                </div>

                <h3 className="gp-serif mt-4 text-xl leading-tight">{item.title}</h3>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={actions[item.id]}
                className="mt-6 w-full"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Download {item.type}
              </Button>
            </article>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            The four research downloads above are frozen demonstration fixtures
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Live quotes below come from public global feeds, not the MCX order book
          </p>
        </div>

        <div className="mt-8">
          <h3 className="gp-label text-foreground">Connected market data exports</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            These downloads use the current server feed and PostgreSQL minute archive.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <article className="flex items-center justify-between gap-4 rounded-[4px] border border-border bg-card p-4">
              <div>
                <h4 className="font-medium">Latest global parity snapshot</h4>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  XAU/USD, COMEX GC, USD/INR, and clearly labeled indicative contract estimates.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={exportLiveFeed}
                disabled={feed?.status !== 'LIVE_PARITY' || !feed.contracts}
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                JSON
              </Button>
            </article>
            <article className="flex items-center justify-between gap-4 rounded-[4px] border border-border bg-card p-4">
              <div>
                <h4 className="font-medium">PostgreSQL market history</h4>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {marketHistory.length} minute snapshots
                  {marketHistoryError ? ` · PostgreSQL unavailable: ${marketHistoryError}` : ''}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={exportMarketHistory}
                disabled={marketHistory.length === 0 || Boolean(marketHistoryError)}
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                JSON
              </Button>
            </article>
          </div>
          {exportError ? (
            <p role="alert" className="mt-3 text-xs text-destructive">
              {exportError}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
