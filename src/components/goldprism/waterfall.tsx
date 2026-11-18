'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { bps as fmtBps, inrPerG } from '@/lib/goldprism/format'

export type WaterfallBar = {
  label: string
  bps: number
  inr: number
  kind: 'raw' | 'basis' | 'carry' | 'artifact' | 'residual' | 'cost' | 'net'
  working?: string
}

function barFill(bar: WaterfallBar, tradable: boolean): React.CSSProperties {
  switch (bar.kind) {
    case 'raw':
      return { background: 'var(--gp-slag-900)' }
    case 'basis':
      return { background: 'var(--gp-slag-500)' }
    case 'carry':
      return { background: 'var(--gp-slag-400)' }
    case 'artifact':
      return {
        background:
          'repeating-linear-gradient(135deg, var(--gp-slag-400) 0 1px, transparent 1px 5px), var(--gp-slag-200)',
      }
    case 'residual':
      return { background: 'var(--gp-slag-700)' }
    case 'cost':
      return {
        background:
          'repeating-linear-gradient(135deg, color-mix(in srgb, var(--gp-blocked) 60%, transparent) 0 1px, transparent 1px 5px), color-mix(in srgb, var(--gp-blocked) 18%, transparent)',
      }
    case 'net':
      if (bar.bps <= 0) return { background: 'var(--gp-blocked)' }
      if (tradable) {
        return { background: 'var(--gp-foil)', backgroundSize: '240% 100%' }
      }
      return { background: 'var(--gp-tradable)' }
    default:
      return { background: 'var(--gp-slag-500)' }
  }
}

function isTotalBar(kind: WaterfallBar['kind']): boolean {
  return kind === 'raw' || kind === 'residual' || kind === 'net'
}

export function WaterfallChart({
  bars,
  tradable = false,
  className,
}: {
  bars: WaterfallBar[]
  tradable?: boolean
  className?: string
}) {
  const [active, setActive] = React.useState<number | null>(null)

  const segments = React.useMemo(() => {
    return bars.map((bar, index) => {
      if (isTotalBar(bar.kind)) {
        return { ...bar, start: 0, end: bar.bps }
      }

      let baseline = 0
      let since = 0
      for (let j = index - 1; j >= 0; j -= 1) {
        if (isTotalBar(bars[j].kind)) {
          baseline = bars[j].bps
          since = j + 1
          break
        }
      }
      const drift = bars.slice(since, index).reduce((sum, b) => sum + b.bps, 0)
      const start = baseline + drift
      return { ...bar, start, end: start + bar.bps }
    })
  }, [bars])

  const all = segments.flatMap((s) => [s.start, s.end, 0])
  const max = Math.max(...all)
  const min = Math.min(...all)
  const range = max - min || 1
  const H = 216
  const y = (value: number) => ((max - value) / range) * H

  return (
    <div className={cn('w-full rounded-[4px] border border-border bg-card p-4 shadow-[var(--gp-hard-shadow)]', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <p className="gp-label text-foreground">Waterfall breakdown · bps of raw gap</p>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            Hover or focus any bar to inspect exact working
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px] bg-[var(--gp-slag-900)]" /> Totals
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px] bg-[var(--gp-slag-500)]" /> Structure
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px] bg-[var(--gp-blocked)]/70" /> Cost / Neg
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px] bg-[var(--gp-gold-500)]" /> Net Edge
          </span>
        </div>
      </div>

      <div className="relative mt-5 flex gap-2">
        {/* Crisp Y-axis scale rail */}
        <div
          className="relative hidden w-12 shrink-0 select-none font-mono text-[9px] tabular-nums text-muted-foreground sm:block"
          style={{ height: H }}
          aria-hidden="true"
        >
          <span className="absolute right-1 -translate-y-1/2" style={{ top: y(max) }}>
            {max > 0 ? `+${max.toFixed(0)}` : max.toFixed(0)}
          </span>
          {Math.abs(y(0) - y(max)) > 18 && Math.abs(y(0) - y(min)) > 18 ? (
            <span className="absolute right-1 -translate-y-1/2 font-semibold text-foreground" style={{ top: y(0) }}>
              0 bps
            </span>
          ) : null}
          {min < 0 ? (
            <span className="absolute right-1 -translate-y-1/2" style={{ top: y(min) }}>
              {min.toFixed(0)}
            </span>
          ) : null}
        </div>

        <div className="relative flex-1" style={{ height: H }}>
          {/* Zero baseline and envelope rules */}
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-[var(--gp-slag-500)]"
            style={{ top: y(0) }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border"
            style={{ top: y(max) }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border"
            style={{ top: y(min) }}
            aria-hidden="true"
          />

          <div className="absolute inset-0 grid grid-cols-7 gap-1.5 md:gap-3">
            {segments.map((bar, idx) => {
              const top = y(Math.max(bar.start, bar.end))
              const height = Math.max(3, Math.abs(y(bar.start) - y(bar.end)))
              const isActive = active === idx
              const dimmed = active !== null && !isActive
              return (
                <div
                  key={`${bar.label}-${idx}`}
                  className="relative flex h-full min-w-0 flex-col items-center justify-end outline-none"
                  tabIndex={0}
                  role="img"
                  aria-label={`${bar.label}: ${fmtBps(bar.bps)}, ${inrPerG(bar.inr)}`}
                  onMouseEnter={() => setActive(idx)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(idx)}
                  onBlur={() => setActive(null)}
                >
                  <div
                    className={cn(
                      'gp-waterfall-bar absolute w-full rounded-[2px] border border-black/10 transition-opacity duration-150 dark:border-white/10',
                      dimmed ? 'opacity-30' : 'opacity-100',
                      isActive ? 'ring-1 ring-[var(--gp-gold-500)] brightness-105' : ''
                    )}
                    style={{
                      top,
                      height,
                      animationDelay: `${idx * 50}ms`,
                      ...barFill(bar, tradable),
                    }}
                  />

                  {isActive ? (
                    <div
                      role="status"
                      className="absolute left-1/2 z-20 w-52 -translate-x-1/2 -translate-y-2 rounded-[4px] border border-[var(--gp-slag-500)] bg-[var(--gp-crucible)] px-3 py-2 text-left font-mono text-[10px] leading-relaxed text-[var(--gp-paper)] shadow-[var(--gp-hard-shadow)]"
                      style={{ bottom: H - top + 8 }}
                    >
                      <div className="uppercase tracking-widest text-[var(--gp-slag-300)]">
                        {bar.label}
                      </div>
                      <div className="mt-0.5 text-sm font-semibold tabular-nums">{fmtBps(bar.bps)}</div>
                      <div className="text-[var(--gp-slag-300)] tabular-nums">{inrPerG(bar.inr)}</div>
                      {bar.working ? (
                        <div className="mt-1.5 border-t border-[var(--gp-slag-700)] pt-1 text-[var(--gp-slag-300)]">
                          {bar.working}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* value rail */}
      <div className="mt-3 grid grid-cols-7 gap-1.5 border-t border-border pt-3 sm:pl-14 md:gap-3">
        {segments.map((bar, idx) => (
          <div key={`${bar.label}-rail-${idx}`} className="min-w-0 text-center">
            <div
              className={cn(
                'gp-figure text-[12px] leading-tight tabular-nums',
                bar.kind === 'net' && tradable && bar.bps > 0
                  ? 'gp-gold-text font-semibold'
                  : bar.kind === 'net' && bar.bps <= 0
                    ? 'text-[var(--gp-blocked-ink)]'
                    : ''
              )}
            >
              {fmtBps(bar.bps)}
            </div>
            <div
              className="mt-1 truncate font-mono text-[9px] uppercase tracking-wider text-muted-foreground"
              title={bar.label}
            >
              {bar.label}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 flex items-center gap-2 border-t border-border pt-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="inline-block h-2 w-2 rounded-[2px] bg-[var(--gp-gold-500)]" aria-hidden="true" />
        Metallic gold marks only net edge that survives full cost hurdle
      </p>
    </div>
  )
}
