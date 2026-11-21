'use client'

import * as React from 'react'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SectionHead } from '@/components/goldprism/brand'
import type { ProvidedBhavcopySnapshot } from '@/lib/goldprism/provided-bhavcopy'

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
})

const number = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

export function ProvidedBhavcopySection() {
  const [snapshot, setSnapshot] = React.useState<ProvidedBhavcopySnapshot | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const loadSnapshot = React.useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/goldprism/bhavcopy', { cache: 'no-store' })
      const payload = (await response.json()) as
        | ProvidedBhavcopySnapshot
        | { status: 'UNAVAILABLE'; error?: string }

      if (!response.ok || 'status' in payload) {
        throw new Error(
          'error' in payload && payload.error
            ? payload.error
            : 'Research Bhavcopy snapshot is unavailable.'
        )
      }

      setSnapshot(payload)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Research Bhavcopy snapshot is unavailable.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadSnapshot()
  }, [loadSnapshot])

  return (
    <section
      id="provided-bhavcopy"
      className="scroll-mt-16 border-b border-border bg-background"
    >
      <div className="mx-auto max-w-[1360px] px-4 py-8 md:py-10">
        <SectionHead
          index="02.0"
          eyebrow="Market structure · Supplied Bhavcopy"
          title="A dated market file, shown as received."
          description="The research CSV is fetched from the bundled snapshot and validated before display. Refresh re-reads this file; it does not request a new MCX feed."
          aside={
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadSnapshot()}
              disabled={loading}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              Refresh snapshot
            </Button>
          }
        />

        <div
          className="mt-5 flex flex-wrap items-start gap-2 border border-[var(--gp-watch-ink)]/30 bg-[var(--gp-watch-ink)]/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground"
          role="note"
        >
          <TriangleAlert
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gp-watch-ink)]"
            aria-hidden="true"
          />
          <p>
            This is a daily Bhavcopy snapshot, not an intraday real-time feed. The file was
            supplied locally and has not been independently checked against MCX.
          </p>
        </div>

        {error ? (
          <p
            className="mt-4 border border-[var(--gp-blocked-ink)]/30 bg-[var(--gp-blocked-ink)]/5 px-4 py-3 text-sm text-[var(--gp-blocked-ink)]"
            role="alert"
          >
            Could not fetch the research CSV: {error}
          </p>
        ) : null}

        {loading && !snapshot ? (
          <p className="mt-6 text-sm text-muted-foreground" role="status">
            Fetching the saved research CSV…
          </p>
        ) : null}

        {snapshot ? (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Trading date" value={snapshot.tradingDate} />
              <Metric
                label="Rows in CSV"
                value={number.format(snapshot.rawRowCount)}
              />
              <Metric
                label="Validated gold futures"
                value={number.format(snapshot.goldFuturesRowCount)}
                detail={
                  snapshot.rejectedGoldFuturesRowCount > 0
                    ? `${number.format(snapshot.rejectedGoldFuturesRowCount)} matching rows rejected`
                    : 'No matching gold-futures rows rejected'
                }
              />
              <Metric
                label="Fetched from CSV"
                value={new Date(snapshot.fetchedAt).toLocaleString()}
                detail={snapshot.sourceFileName}
              />
            </div>

            <div className="mt-6 overflow-hidden border border-border bg-card shadow-[var(--gp-hard-shadow)]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-[var(--gp-vellum)]/60 px-4 py-3">
                <h3 className="gp-serif text-base">
                  Gold futures · daily close ({snapshot.rows.length})
                </h3>
                <a
                  className="text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground"
                  href={snapshot.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  MCX Bhavcopy reference
                </a>
              </div>

              <div className="max-h-[34rem] overflow-auto">
                <table className="gp-table min-w-[900px]">
                  <thead>
                    <tr>
                      <th scope="col">Symbol</th>
                      <th scope="col">Expiry</th>
                      <th scope="col" className="gp-num">Open</th>
                      <th scope="col" className="gp-num">High</th>
                      <th scope="col" className="gp-num">Low</th>
                      <th scope="col" className="gp-num">Close</th>
                      <th scope="col" className="gp-num">Previous close</th>
                      <th scope="col" className="gp-num">Volume (lots)</th>
                      <th scope="col" className="gp-num">Open interest</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.rows.map((row) => (
                      <tr key={`${row.symbol}-${row.expiryDate}`}>
                        <td className="font-medium text-foreground">{row.symbol}</td>
                        <td className="text-muted-foreground">{row.expiryDate}</td>
                        <td className="gp-num">{inr.format(row.open)}</td>
                        <td className="gp-num">{inr.format(row.high)}</td>
                        <td className="gp-num">{inr.format(row.low)}</td>
                        <td className="gp-num font-medium text-foreground">
                          {inr.format(row.close)}
                        </td>
                        <td className="gp-num text-muted-foreground">
                          {inr.format(row.previousClose)}
                        </td>
                        <td className="gp-num">{number.format(row.volumeLots)}</td>
                        <td className="gp-num">{number.format(row.openInterestLots)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-border px-4 py-3 text-[10px] leading-relaxed text-muted-foreground">
                SHA-256 · <span className="font-mono">{snapshot.sha256Hash}</span>
                <span className="mx-2">|</span>
                {snapshot.sourceNote}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </section>
  )
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail?: string
}) {
  return (
    <div className="min-w-0 border border-border bg-card p-4 shadow-[var(--gp-hard-shadow)]">
      <p className="gp-label">{label}</p>
      <p className="gp-figure mt-2 truncate text-lg" title={value}>
        {value}
      </p>
      {detail ? (
        <p className="mt-1 truncate text-[10px] text-muted-foreground" title={detail}>
          {detail}
        </p>
      ) : null}
    </div>
  )
}
