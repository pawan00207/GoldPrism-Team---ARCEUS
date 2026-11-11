'use client'

import * as React from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTag, SectionHead } from '@/components/goldprism/brand'
import { StatusIsland, type IslandTask } from '@/components/kokonutui/status-island'
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
  const [tasks, setTasks] = React.useState<IslandTask[]>([])
  const counter = React.useRef(0)

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

  const actions: Record<string, () => void> = {
    bhavcopy: exportBhavcopy,
    backtest: exportBacktest,
    vehicles: exportBestVehicle,
    manifest: exportManifest,
  }

  const runExport = (item: (typeof EXPORTS)[number]) => {
    actions[item.id]()
    counter.current += 1
    const id = `${item.id}-${counter.current}`
    setTasks((list) => [
      ...list.slice(-2),
      {
        id,
        label: item.title,
        detail: `${item.type} downloaded`,
        status: 'done',
      },
    ])
  }

  return (
    <section id="reports" className="scroll-mt-16 border-b border-border bg-background">
      <div className="gp-container py-[var(--gp-space-5)] md:py-[var(--gp-space-6)]">
        <SectionHead
          index="03.2"
          eyebrow="Audit trail · Reports"
          title="Take the record with you."
          description="Download the raw audit artifacts: validated bhavcopy, backtest time series, vehicle rankings and the frozen configuration manifest."
          aside={<DataTag synthetic detail="fixture run" />}
        />

        <div className="mt-10 grid gap-px border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
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
                onClick={() => runExport(item)}
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
            All exports are generated from the frozen fixture run
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            No live market feed is used
          </p>
        </div>
      </div>

      <StatusIsland
        className="fixed bottom-6 right-4 z-40 sm:right-6"
        dismissAfter={4200}
        onDismiss={(id) => setTasks((list) => list.filter((task) => task.id !== id))}
        tasks={tasks}
      />
    </section>
  )
}
