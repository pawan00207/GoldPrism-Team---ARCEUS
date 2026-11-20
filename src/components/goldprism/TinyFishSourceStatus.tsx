'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface SourceStatusPayload {
  sources?: {
    bhavcopyPrimary?: { name: string; status: string; detail: string; lastRunAt: string | null }
    tinyFishFallback?: { name: string; status: string; detail: string }
    tinyFishApi?: { status: string; message: string }
    lastSuccessfulFetch?: {
      source: string
      fetchedAt: string | null
      tradeDate: string
    } | null
    sourceRadar?: {
      rows: Array<{
        sourceName: string
        method: string
        checkedAt: string
        status: 'ok' | 'failed' | 'timeout' | 'empty'
        latencyMs: number
        rowsReturned: number
        url: string
      }>
      counters: {
        sourcesCheckedToday: number
        failuresToday: number
        lastSuccessfulFullRefresh: string | null
      }
      settlementCrossCheck: string
      crossCheckActiveSince: string
    }
  }
}

function statusTone(value: string): string {
  if (value === 'HEALTHY' || value === 'USED' || value === 'READY' || value === 'AVAILABLE') {
    return 'gp-tag--tradable'
  }
  if (value === 'DEGRADED' || value === 'REJECTED') return 'gp-tag--watch'
  return 'gp-tag--neutral'
}

function formatIst(value: string | null | undefined): string {
  if (!value) return 'Unavailable'
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) return 'Unavailable'
  return `${timestamp.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  })} IST`
}

function relativeIst(value: string): string {
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) return 'Unavailable'
  const ageMinutes = Math.max(0, (Date.now() - timestamp.getTime()) / 60_000)
  const relative =
    ageMinutes < 1
      ? 'just now'
      : ageMinutes < 60
        ? `${Math.floor(ageMinutes)} min ago`
        : ageMinutes < 1440
          ? `${Math.floor(ageMinutes / 60)} hr ago`
          : `${Math.floor(ageMinutes / 1440)} day ago`
  return `${relative} · ${formatIst(value)}`
}

function freshnessBadge(value: string): 'Live < 5 min' | 'Delayed' | 'Stale' {
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) return 'Stale'
  const ageMinutes = Math.max(0, (Date.now() - timestamp.getTime()) / 60_000)
  if (ageMinutes < 5) return 'Live < 5 min'
  if (ageMinutes < 60) return 'Delayed'
  return 'Stale'
}

export function TinyFishSourceStatus() {
  const [payload, setPayload] = React.useState<SourceStatusPayload | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const response = await fetch('/api/goldprism/tinyfish/status', { cache: 'no-store' })
        if (!response.ok) throw new Error('Source status is unavailable.')
        const result = (await response.json()) as SourceStatusPayload
        if (active) {
          setPayload(result)
          setError(null)
        }
      } catch {
        if (active) setError('Source status is unavailable; the data pipeline remains unchanged.')
      }
    }

    void refresh()
    const timer = window.setInterval(() => void refresh(), 60_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  const sources = payload?.sources
  const primary = sources?.bhavcopyPrimary
  const fallback = sources?.tinyFishFallback
  const api = sources?.tinyFishApi
  const lastFetch = sources?.lastSuccessfulFetch
  const radar = sources?.sourceRadar

  return (
    <div className="mt-6 overflow-hidden rounded-[4px] border border-border bg-card shadow-[var(--gp-hard-shadow)]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border bg-[var(--gp-vellum)]/60 px-4 py-3">
        <div>
          <p className="gp-label">External source status</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Python ingestion status is reported by the authenticated GitHub Actions bridge.
          </p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          Refreshes every 60 seconds
        </span>
      </div>

      {error ? (
        <p role="status" className="px-4 py-4 text-sm text-muted-foreground">
          {error}
        </p>
      ) : (
        <>
          <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
            <SourceCell
              title={primary?.name ?? 'Bhavcopy primary (mcxlib)'}
              status={primary?.status ?? 'CHECKING'}
              detail={primary?.detail ?? 'Checking reported ingestion status…'}
              timestamp={formatIst(primary?.lastRunAt)}
              loading={!payload}
            />
            <SourceCell
              title={fallback?.name ?? 'TinyFish fallback'}
              status={fallback?.status ?? 'CHECKING'}
              detail={fallback?.detail ?? 'Checking fallback configuration…'}
              loading={!payload}
            />
            <SourceCell
              title="TinyFish API health"
              status={api?.status ?? 'CHECKING'}
              detail={api?.message ?? 'Checking TinyFish availability…'}
              loading={!payload}
            />
            <SourceCell
              title="Last successful fetch"
              status={lastFetch ? 'AVAILABLE' : 'UNAVAILABLE'}
              detail={
                lastFetch
                  ? `${lastFetch.source} · trade date ${lastFetch.tradeDate}`
                  : 'No accepted ingestion run has been reported.'
              }
              timestamp={formatIst(lastFetch?.fetchedAt)}
              loading={!payload}
            />
          </div>
          <SourceRadar radar={radar} loading={!payload} />
        </>
      )}
    </div>
  )
}

function SourceRadar({
  radar,
  loading,
}: {
  radar: NonNullable<SourceStatusPayload['sources']>['sourceRadar']
  loading: boolean
}) {
  const rows = radar?.rows ?? []
  return (
    <div className="border-t border-border">
      <div className="grid gap-px bg-border sm:grid-cols-3">
        <div className="bg-card p-4">
          <p className="gp-label">Sources checked today</p>
          <p className="gp-figure mt-2 text-2xl">{loading ? '—' : radar?.counters.sourcesCheckedToday ?? 0}</p>
        </div>
        <div className="bg-card p-4">
          <p className="gp-label">Failures today</p>
          <p className="gp-figure mt-2 text-2xl">{loading ? '—' : radar?.counters.failuresToday ?? 0}</p>
        </div>
        <div className="bg-card p-4">
          <p className="gp-label">Last successful full refresh</p>
          <p className="mt-3 text-[11px] text-foreground">
            {loading ? 'Checking…' : radar?.counters.lastSuccessfulFullRefresh
              ? formatIst(radar.counters.lastSuccessfulFullRefresh)
              : 'Unavailable'}
          </p>
        </div>
      </div>

      <div className="border-t border-border px-4 py-3">
        <p className="gp-label">Source Radar</p>
        {loading ? (
          <div className="mt-3 h-20 animate-pulse rounded-sm bg-muted" aria-label="Loading source radar" />
        ) : rows.length === 0 ? (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            Unavailable — no source_log rows have been reported.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-border">
            {rows.map((row) => {
              const freshness = freshnessBadge(row.checkedAt)
              const dot =
                row.status === 'ok'
                  ? freshness === 'Stale'
                    ? 'bg-[var(--gp-watch)]'
                    : 'bg-[var(--gp-tradable)]'
                  : row.status === 'empty'
                    ? 'bg-[var(--gp-watch)]'
                    : 'bg-[var(--gp-blocked)]'
              return (
                <div key={`${row.sourceName}:${row.method}`} className="grid gap-2 py-3 sm:grid-cols-[1fr_1fr_1fr] sm:items-center">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <span className={cn('h-2 w-2 rounded-full', dot)} aria-hidden="true" />
                      {row.sourceName}
                    </p>
                    <p className="mt-1 font-mono text-[9px] uppercase text-muted-foreground">
                      {row.method}
                      {row.method.startsWith('tinyfish') ? ' · Powered by TinyFish' : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-foreground">{relativeIst(row.checkedAt)}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {row.latencyMs} ms · {row.rowsReturned} rows
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <span className={cn(
                      'gp-tag',
                      freshness === 'Live < 5 min'
                        ? 'gp-tag--tradable'
                        : freshness === 'Delayed'
                          ? 'gp-tag--watch'
                          : 'gp-tag--neutral'
                    )}>
                      {freshness}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <p className="mt-3 rounded-sm border border-border bg-[var(--gp-vellum)]/50 px-3 py-2 text-[11px] text-foreground">
          {radar?.settlementCrossCheck ?? 'Settlement cross-check: UNVERIFIED'}
        </p>
        <p className="mt-2 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
          Cross-check active since {radar?.crossCheckActiveSince ?? '2026-11-20'} · not applied to historical backtest
        </p>
      </div>
    </div>
  )
}

function SourceCell({
  title,
  status,
  detail,
  timestamp,
  loading,
}: {
  title: string
  status: string
  detail: string
  timestamp?: string
  loading: boolean
}) {
  return (
    <div className="min-h-32 bg-card p-4">
      <p className="gp-label">{title}</p>
      <div className="mt-3">
        {loading ? (
          <span className="block h-5 w-24 animate-pulse rounded-sm bg-muted" aria-label="Loading status" />
        ) : (
          <span className={cn('gp-tag', statusTone(status))}>{status}</span>
        )}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{detail}</p>
      {timestamp ? (
        <p className="mt-2 font-mono text-[9px] text-muted-foreground">{timestamp}</p>
      ) : null}
    </div>
  )
}
