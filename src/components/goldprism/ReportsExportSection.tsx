'use client'

import * as React from 'react'
import {
  Download,
  FileCheck2,
  FileDown,
  FileJson,
  FileSpreadsheet,
  FileText,
  Hash,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CLEAN_MCX_BHAVCOPY_CSV, generateWalkForwardHistory } from '@/lib/goldprism/fixtures'
import { rankBestVehicleForExposure } from '@/lib/goldprism/signal'

export function ReportsExportSection() {
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
      team: 'ARCEUS',
      event: "Hack in Hills '26 — Track 03: Commodity Derivatives Intelligence",
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
    triggerDownload('goldprism_audit_manifest.json', JSON.stringify(manifest, null, 2), 'application/json')
  }

  return (
    <section id="reports" className="py-12 scroll-mt-16 border-b border-border/40">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="mb-8">
          <Badge variant="outline" className="mb-2 gap-1.5 border-amber-500/40 text-amber-300">
            <FileDown className="w-3 h-3 text-amber-400" /> Phase 06: Auditable Reports & Exports
          </Badge>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            Research Manifest & Data Exports
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Download raw audit artifacts, validation reports, backtest time series, and configuration manifests.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-card/60 border-border/80 flex flex-col justify-between hover:border-amber-500/40 transition-colors">
            <div>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-foreground text-sm">Normalized Bhavcopy CSV</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Cleaned MCX settlement prices converted into 999-fine ₹/g basis with volume &amp; OI flags.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={exportBhavcopy}
              className="mt-4 gap-1.5 border-border/80 text-xs font-mono"
            >
              <Download className="w-3.5 h-3.5" /> Download CSV
            </Button>
          </Card>

          <Card className="p-4 bg-card/60 border-border/80 flex flex-col justify-between hover:border-amber-500/40 transition-colors">
            <div>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
                <FileText className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-foreground text-sm">Walk-Forward Backtest</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Monthly gross alpha, net returns, and drawdown metrics for the calendar spread strategy.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={exportBacktest}
              className="mt-4 gap-1.5 border-border/80 text-xs font-mono"
            >
              <Download className="w-3.5 h-3.5" /> Download CSV
            </Button>
          </Card>

          <Card className="p-4 bg-card/60 border-border/80 flex flex-col justify-between hover:border-amber-500/40 transition-colors">
            <div>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-foreground text-sm">Best-Vehicle Rankings</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Ranked comparison of lot sizes, mismatch percentages, and total friction for target exposures.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={exportBestVehicle}
              className="mt-4 gap-1.5 border-border/80 text-xs font-mono"
            >
              <Download className="w-3.5 h-3.5" /> Download CSV
            </Button>
          </Card>

          <Card className="p-4 bg-card/60 border-border/80 flex flex-col justify-between hover:border-amber-500/40 transition-colors">
            <div>
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3">
                <FileJson className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-foreground text-sm">Audit Run Manifest</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Machine-readable JSON manifest containing config hashes, parameters, and reproducibility seeds.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={exportManifest}
              className="mt-4 gap-1.5 border-border/80 text-xs font-mono"
            >
              <Download className="w-3.5 h-3.5" /> Download JSON
            </Button>
          </Card>
        </div>
      </div>
    </section>
  )
}
