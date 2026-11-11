'use client'

import * as React from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  parseAndValidateBhavcopyCsv,
  IngestionResult,
} from '@/lib/goldprism/data-adapter'
import {
  CLEAN_MCX_BHAVCOPY_CSV,
  SEEDED_ERROR_BHAVCOPY_CSV,
} from '@/lib/goldprism/fixtures'
import { DataTag, SectionHead } from '@/components/goldprism/brand'
import { inr, inrPerG } from '@/lib/goldprism/format'
import { cn } from '@/lib/utils'
import { Badge } from '@astryxdesign/core/Badge'
import { Table, pixel, proportional } from '@astryxdesign/core/Table'
import type { TableColumn } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'

// Client-only timestamp to avoid SSR hydration mismatch
function AuditTimestamp({ ts }: { ts: string }) {
  const [label, setLabel] = React.useState('')
  React.useEffect(() => {
    setLabel(new Date(ts).toLocaleTimeString())
  }, [ts])
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
      {label ? `Audited ${label}` : 'Auditing…'}
    </span>
  )
}

const GATES = [
  {
    step: '1',
    title: 'Ingest raw CSV',
    detail: 'Symbol, date, expiry, OHLC, volume, open interest.',
    state: 'Schema check',
    tone: 'tradable' as const,
  },
  {
    step: '2',
    title: 'Date match gate',
    detail: 'Returned date must equal the requested trade date.',
    state: 'Reject mismatch + log',
    tone: 'watch' as const,
  },
  {
    step: '3',
    title: 'Key integrity',
    detail: 'Unique key on symbol and expiry date.',
    state: 'Deduplication gate',
    tone: 'tradable' as const,
  },
  {
    step: '4',
    title: 'Settle trust check',
    detail: 'Volume above 50, otherwise flag THIN_SETTLE.',
    state: 'Flag artifacts',
    tone: 'watch' as const,
  },
  {
    step: '5',
    title: 'Signal & backtest',
    detail: 'Signal at t, fill at t+1. No look-ahead.',
    state: 'Proceed to X-Ray',
    tone: 'tradable' as const,
  },
]

interface ValidatedRecordRow extends Record<string, unknown> {
  id: string
  symbol: string
  expiry: string
  quoted: string
  normalized: string
  volume: string
  trust: 'VERIFIED' | 'THIN_SETTLE'
}

const VALIDATED_COLUMNS: TableColumn<ValidatedRecordRow>[] = [
  {
    key: 'symbol',
    header: 'Symbol',
    width: proportional(1, { minWidth: 104 }),
    renderCell: (row) => (
      <Text type="inherit" weight="semibold">
        {row.symbol}
      </Text>
    ),
  },
  {
    key: 'expiry',
    header: 'Expiry',
    width: pixel(104),
    renderCell: (row) => (
      <Text type="inherit" color="secondary">
        {row.expiry}
      </Text>
    ),
  },
  { key: 'quoted', header: 'Quoted', width: pixel(100), align: 'end' },
  {
    key: 'normalized',
    header: 'Norm ₹/g',
    width: pixel(110),
    align: 'end',
    renderCell: (row) => (
      <Text type="inherit" hasTabularNumbers>
        {row.normalized}
      </Text>
    ),
  },
  { key: 'volume', header: 'Volume', width: pixel(72), align: 'end' },
  {
    key: 'trust',
    header: 'Trust',
    width: pixel(62),
    // Verified is the norm; only the thin settle needs attention.
    renderCell: (row) =>
      row.trust === 'VERIFIED' ? (
        <Text type="inherit" color="secondary">
          OK
        </Text>
      ) : (
        <Badge variant="warning" label="Thin" />
      ),
  },
]

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

  const validatedRows: ValidatedRecordRow[] = ingestionResult.validatedRecords.map(
    (r, i) => ({
      id: `${r.symbol}-${r.expiryDate}-${i}`,
      symbol: r.symbol,
      expiry: r.expiryDate,
      quoted: inr(r.settlePrice),
      normalized: inrPerG(r.normalizedSettlePerG),
      volume: String(r.volume),
      trust: r.trustStatus === 'VERIFIED' ? 'VERIFIED' : 'THIN_SETTLE',
    })
  )

  const statusTone =
    ingestionResult.status === 'PASSED'
      ? 'gp-tag--tradable'
      : ingestionResult.status === 'FAILED'
        ? 'gp-tag--blocked'
        : 'gp-tag--watch'

  const statusLabel =
    ingestionResult.status === 'PASSED'
      ? 'Passed'
      : ingestionResult.status === 'FAILED'
        ? 'Failed · run blocked'
        : 'Partial verification'

  return (
    <section id="data-health" className="scroll-mt-16 border-b border-border bg-background">
      <div className="gp-container py-[var(--gp-space-5)] md:py-[var(--gp-space-6)]">
        <SectionHead
          index="02.1"
          eyebrow="Market structure · Data health"
          title="Trust the file before the figure."
          description="Deterministic date-match gates, immutable schema validation and SHA-256 provenance. A rejected day stops the sequence here."
          aside={
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Button variant="outline" size="sm" onClick={loadCleanData}>
                Load clean bhavcopy
              </Button>
              <Button variant="outline" size="sm" onClick={loadSeededFault}>
                Load seeded fault
              </Button>
              <label className="cursor-pointer">
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                <Button asChild size="sm" variant="default">
                  <span>
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    Upload CSV
                  </span>
                </Button>
              </label>
            </div>
          }
        />

        {/* ---------------- Integrity gates ---------------- */}
        <div className="mt-10 border border-border">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <p className="gp-label">MCX bhavcopy · integrity gates</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              DuckDB / Parquet store
            </p>
          </div>

          <ol className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-5">
            {GATES.map((gate) => (
              <li key={gate.step} className="flex flex-col justify-between bg-card p-4">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="gp-figure text-lg text-muted-foreground">{gate.step}</span>
                    <h3 className="text-sm font-medium leading-tight text-foreground">
                      {gate.title}
                    </h3>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    {gate.detail}
                  </p>
                </div>
                <p
                  className={cn(
                    'mt-4 font-mono text-[9px] uppercase tracking-[0.1em]',
                    gate.tone === 'tradable' ? 'gp-tradable-text' : 'gp-watch-text'
                  )}
                >
                  {gate.state}
                </p>
              </li>
            ))}
          </ol>
        </div>

        {/* ---------------- Provenance metrics ---------------- */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="border-t-2 border-[var(--gp-slag-900)] pt-3 dark:border-[var(--gp-paper)]">
            <p className="gp-label">Validation status</p>
            <div className="mt-3">
              <span className={cn('gp-tag', statusTone)}>{statusLabel}</span>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              {ingestionResult.statusSummary}
            </p>
          </div>

          <div className="border-t-2 border-border pt-3">
            <p className="gp-label">Row counts</p>
            <p className="gp-figure mt-3 text-2xl">
              <span className="gp-tradable-text">{ingestionResult.totalRowsValidated}</span>
              <span className="text-sm font-normal text-muted-foreground">
                {' '}
                / {ingestionResult.totalRowsRaw}
              </span>
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Rejected rows{' '}
              <span className="gp-blocked-text font-medium">{ingestionResult.totalRowsRejected}</span>
            </p>
          </div>

          <div className="border-t-2 border-border pt-3">
            <p className="gp-label">Source provenance</p>
            <p className="mt-3 truncate font-mono text-xs text-foreground">
              {ingestionResult.originalFileName}
            </p>
            <p
              className="mt-2 truncate font-mono text-[10px] text-muted-foreground"
              title={ingestionResult.sha256Hash}
            >
              sha256 · {ingestionResult.sha256Hash}
            </p>
          </div>

          <div className="gp-hatch border-t-2 border-border pt-3">
            <p className="gp-label">Data mode</p>
            <div className="mt-3">
              <DataTag
                synthetic={ingestionResult.dataMode === 'HISTORICAL_FIXTURE'}
                detail={ingestionResult.dataMode === 'HISTORICAL_FIXTURE' ? 'fixture' : 'upload'}
              />
            </div>
            <div className="mt-3">
              <AuditTimestamp ts={ingestionResult.retrievalTimestamp} />
            </div>
          </div>
        </div>

        {/* ---------------- Records ---------------- */}
        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <div className="min-w-0 border border-border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h3 className="gp-serif text-base">
                Validated &amp; normalized records ({ingestionResult.validatedRecords.length})
              </h3>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                ₹/g · 999 fine
              </span>
            </div>

            <div className="max-h-72 overflow-auto">
              {ingestionResult.validatedRecords.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No validated records in the current dataset.
                </p>
              ) : (
                <Table
                  data={validatedRows}
                  columns={VALIDATED_COLUMNS}
                  idKey="id"
                  density="compact"
                  dividers="rows"
                  hasHover
                />
              )}
            </div>
          </div>

          <div className="min-w-0 border border-border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h3 className="gp-serif text-base">
                Integrity gate rejected rows ({ingestionResult.rejectedRows.length})
              </h3>
              <span className="gp-tag gp-tag--blocked">Execution blocked</span>
            </div>

            <div className="max-h-72 overflow-auto">
              {ingestionResult.rejectedRows.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Zero rejection anomalies. All rows passed the integrity gates.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {ingestionResult.rejectedRows.map((r, i) => (
                    <li key={`${r.lineIndex}-${i}`} className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-mono text-xs text-foreground">
                          Row #{r.lineIndex} · {r.symbol}
                        </p>
                        <span className="gp-tag gp-tag--blocked">{r.reasonCode}</span>
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                        {r.reasonDescription}
                      </p>
                      <p className="mt-2 truncate border border-border bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground">
                        {r.rawRow}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
