'use client'

import * as React from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileCheck2,
  FileUp,
  FileWarning,
  Hash,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  parseAndValidateBhavcopyCsv,
  IngestionResult,
} from '@/lib/goldprism/data-adapter'
import {
  CLEAN_MCX_BHAVCOPY_CSV,
  SEEDED_ERROR_BHAVCOPY_CSV,
} from '@/lib/goldprism/fixtures'

export function DataHealthSection({
  onDatasetChange,
}: {
  onDatasetChange?: (res: IngestionResult) => void
}) {
  const [ingestionResult, setIngestionResult] = React.useState<IngestionResult>(() =>
    parseAndValidateBhavcopyCsv(CLEAN_MCX_BHAVCOPY_CSV, {
      requestedDate: '2026-03-20',
      fileName: 'mcx_bhavcopy_clean_20260320.csv',
      dataMode: 'HISTORICAL_FIXTURE',
    })
  )

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (content) {
        const res = parseAndValidateBhavcopyCsv(content, {
          fileName: file.name,
          dataMode: 'USER_UPLOAD',
        })
        setIngestionResult(res)
        onDatasetChange?.(res)
      }
    }
    reader.readAsText(file)
  }

  const loadCleanData = () => {
    const res = parseAndValidateBhavcopyCsv(CLEAN_MCX_BHAVCOPY_CSV, {
      requestedDate: '2026-03-20',
      fileName: 'mcx_bhavcopy_clean_20260320.csv',
      dataMode: 'HISTORICAL_FIXTURE',
    })
    setIngestionResult(res)
    onDatasetChange?.(res)
  }

  const loadSeededFault = () => {
    const res = parseAndValidateBhavcopyCsv(SEEDED_ERROR_BHAVCOPY_CSV, {
      requestedDate: '2026-03-20',
      fileName: 'mcx_bhavcopy_seeded_fault.csv',
      dataMode: 'HISTORICAL_FIXTURE',
    })
    setIngestionResult(res)
    onDatasetChange?.(res)
  }

  return (
    <section id="data-health" className="py-12 scroll-mt-16 border-b border-border/40">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <Badge variant="outline" className="mb-2 gap-1.5 border-amber-500/40 text-amber-300">
              <Database className="w-3 h-3 text-amber-400" /> Phase 01: Auditable Data Pipeline
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Data Health & Ingestion Gates
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Deterministic date-match gates, immutable Parquet schema validation, and SHA-256 provenance tracking.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadCleanData}
              className="gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
            >
              <FileCheck2 className="w-4 h-4" />
              Load Clean Bhavcopy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadSeededFault}
              className="gap-1.5 border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
            >
              <FileWarning className="w-4 h-4" />
              Load Seeded Fault (Fault Demo)
            </Button>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button asChild size="sm" variant="default" className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold">
                <span>
                  <Upload className="w-4 h-4" />
                  Upload CSV Bhavcopy
                </span>
              </Button>
            </label>
          </div>
        </div>

        {/* Integrity Gates Flowchart Banner */}
        <Card className="mb-6 p-4 bg-muted/20 border-border/60">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center justify-between">
            <span>MCX Bhavcopy Integrity Gate Flowchart (Slide 4 Specification)</span>
            <span className="font-mono text-[11px] text-amber-400">DuckDB / Parquet Store</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-xs">
            <div className="p-3 rounded-lg bg-card border border-border/80 flex flex-col justify-between">
              <div className="font-bold text-foreground">1. Ingest Raw CSV</div>
              <div className="text-muted-foreground text-[11px] mt-1">Symbol, Date, Expiry, OHLC, Volume, OI</div>
              <div className="mt-2 text-emerald-400 font-mono text-[10px]">PASS: Schema check</div>
            </div>
            <div className="p-3 rounded-lg bg-card border border-border/80 flex flex-col justify-between">
              <div className="font-bold text-foreground">2. Date Match Gate</div>
              <div className="text-muted-foreground text-[11px] mt-1">Returned date == Requested trade date</div>
              <div className="mt-2 text-amber-400 font-mono text-[10px]">Reject mismatch + log</div>
            </div>
            <div className="p-3 rounded-lg bg-card border border-border/80 flex flex-col justify-between">
              <div className="font-bold text-foreground">3. Key Integrity</div>
              <div className="text-muted-foreground text-[11px] mt-1">Unique key: (symbol, expiry_date)</div>
              <div className="mt-2 text-emerald-400 font-mono text-[10px]">Deduplication gate</div>
            </div>
            <div className="p-3 rounded-lg bg-card border border-border/80 flex flex-col justify-between">
              <div className="font-bold text-foreground">4. Settle Trust Check</div>
              <div className="text-muted-foreground text-[11px] mt-1">Volume &gt; 50 or flag as THIN_SETTLE</div>
              <div className="mt-2 text-amber-400 font-mono text-[10px]">Flag artifacts</div>
            </div>
            <div className="p-3 rounded-lg bg-card border border-border/80 flex flex-col justify-between">
              <div className="font-bold text-foreground">5. Signal & Backtest</div>
              <div className="text-muted-foreground text-[11px] mt-1">Signal at t, fill at t+1 (no look-ahead)</div>
              <div className="mt-2 text-emerald-400 font-mono text-[10px]">Proceed to X-Ray</div>
            </div>
          </div>
        </Card>

        {/* Provenance & Status Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 bg-card/60 border-border/80">
            <div className="text-xs text-muted-foreground mb-1">Pipeline Status</div>
            <div className="flex items-center gap-2">
              {ingestionResult.status === 'PASSED' ? (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 gap-1">
                  <CheckCircle2 className="w-3 h-3" /> PASSED
                </Badge>
              ) : ingestionResult.status === 'FAILED' ? (
                <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/40 gap-1">
                  <ShieldAlert className="w-3 h-3" /> FAILED: RUN BLOCKED
                </Badge>
              ) : (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 gap-1">
                  <AlertTriangle className="w-3 h-3" /> PARTIAL VERIFICATION
                </Badge>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground mt-2 truncate">
              {ingestionResult.statusSummary}
            </div>
          </Card>

          <Card className="p-4 bg-card/60 border-border/80">
            <div className="text-xs text-muted-foreground mb-1">Row Counts</div>
            <div className="text-xl font-bold font-mono">
              <span className="text-emerald-400">{ingestionResult.totalRowsValidated}</span>
              <span className="text-muted-foreground text-sm font-normal"> / {ingestionResult.totalRowsRaw}</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-2">
              Rejected rows: <span className="text-rose-400 font-semibold">{ingestionResult.totalRowsRejected}</span>
            </div>
          </Card>

          <Card className="p-4 bg-card/60 border-border/80">
            <div className="text-xs text-muted-foreground mb-1">Source Provenance</div>
            <div className="text-sm font-semibold truncate font-mono text-foreground">
              {ingestionResult.originalFileName}
            </div>
            <div className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1 font-mono">
              <Hash className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="truncate">{ingestionResult.sha256Hash}</span>
            </div>
          </Card>

          <Card className="p-4 bg-card/60 border-border/80">
            <div className="text-xs text-muted-foreground mb-1">Data Mode</div>
            <Badge variant="outline" className="border-amber-500/40 text-amber-300 font-mono text-[11px]">
              {ingestionResult.dataMode}
            </Badge>
            <div className="text-[11px] text-muted-foreground mt-2">
              Audited at {new Date(ingestionResult.retrievalTimestamp).toLocaleTimeString()}
            </div>
          </Card>
        </div>

        {/* Detailed Table: Validated vs Rejected */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Validated Records */}
          <Card className="border-border/80 bg-card/60">
            <CardHeader className="py-3 px-4 border-b border-border/60 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Validated & Normalized Records ({ingestionResult.validatedRecords.length})
              </CardTitle>
              <span className="text-xs text-muted-foreground font-mono">₹/g (999 Fine)</span>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-64">
                {ingestionResult.validatedRecords.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No validated records in current dataset.
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/40 text-muted-foreground bg-muted/20">
                        <th className="py-2 px-3 text-left">Symbol</th>
                        <th className="py-2 px-3 text-left">Expiry</th>
                        <th className="py-2 px-3 text-right">Quoted Settle</th>
                        <th className="py-2 px-3 text-right">Norm Settle (₹/g)</th>
                        <th className="py-2 px-3 text-right">Volume</th>
                        <th className="py-2 px-3 text-center">Trust</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ingestionResult.validatedRecords.map((r, i) => (
                        <tr key={i} className="border-b border-border/20 hover:bg-muted/30">
                          <td className="py-2 px-3 font-semibold text-foreground">{r.symbol}</td>
                          <td className="py-2 px-3 font-mono text-muted-foreground">{r.expiryDate}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">₹{r.settlePrice.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-amber-300 font-semibold">
                            ₹{r.normalizedSettlePerG.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-muted-foreground">{r.volume}</td>
                          <td className="py-2 px-3 text-center">
                            {r.trustStatus === 'VERIFIED' ? (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 font-mono">
                                OK
                              </span>
                            ) : (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 font-mono">
                                THIN
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Rejected Rows Audit */}
          <Card className="border-border/80 bg-card/60">
            <CardHeader className="py-3 px-4 border-b border-border/60 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                Integrity Gate Rejected Rows ({ingestionResult.rejectedRows.length})
              </CardTitle>
              <span className="text-xs text-rose-400 font-mono">Execution Blocked</span>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-64">
                {ingestionResult.rejectedRows.length === 0 ? (
                  <div className="p-6 text-center text-sm text-emerald-400 flex flex-col items-center justify-center gap-2">
                    <CheckCircle2 className="w-6 h-6" />
                    <span>Zero rejection anomalies. All rows passed data integrity gates.</span>
                  </div>
                ) : (
                  <div className="divide-y divide-border/20 text-xs">
                    {ingestionResult.rejectedRows.map((r, i) => (
                      <div key={i} className="p-3 hover:bg-rose-500/5">
                        <div className="flex items-center justify-between font-mono mb-1">
                          <span className="font-bold text-rose-400">Row #{r.lineIndex}: {r.symbol}</span>
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[10px]">
                            {r.reasonCode}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-[11px] mb-1">
                          {r.reasonDescription}
                        </p>
                        <div className="p-1 rounded bg-black/40 text-[10px] font-mono text-muted-foreground/80 truncate">
                          {r.rawRow}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

      </div>
    </section>
  )
}
