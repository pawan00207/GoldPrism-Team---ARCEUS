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

function barFill(bar: WaterfallBar, tradable: boolean, active = false): React.CSSProperties {
  switch (bar.kind) {
    case 'raw':
      return { background: 'var(--gp-slag-800)' }
    case 'basis':
      return { background: 'var(--gp-slag-600)' }
    case 'carry':
      return { background: 'var(--gp-slag-500)' }
    case 'artifact':
      return {
        background:
          'repeating-linear-gradient(135deg, var(--gp-slag-400) 0 1px, transparent 1px 5px), var(--gp-slag-300)',
      }
    case 'residual':
      return { background: 'var(--gp-slag-700)' }
    case 'cost':
      // Cost drag is hatched in slag grey. Oxide red is reserved for bad
      // data and blocked verdicts, never for ordinary friction.
      return {
        background:
          'repeating-linear-gradient(135deg, var(--gp-slag-700) 0 1px, transparent 1px 5px), color-mix(in srgb, var(--gp-slag-500) 35%, transparent)',
      }
    case 'net':
      // Gold is a verdict, not a positive number. It appears only when the
      // residual has survived the full cost hurdle.
      if (bar.bps <= 0) return { background: 'var(--gp-slag-900)' }
      if (tradable) {
        return {
          background: 'var(--gp-foil)',
          backgroundSize: '240% 100%',
          backgroundPosition: active ? '100% 0' : '0% 0',
          transition: 'background-position 900ms var(--gp-ease-foil)',
        }
      }
      return { background: 'var(--gp-slag-600)' }
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

      // The nearest earlier total sets the running baseline; deductions then
      // stack from it until the next total closes the group.
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
  const H = 208
  const y = (value: number) => ((max - value) / range) * H

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-baseline justify-between gap-4">
        <p className="gp-label">Waterfall breakdown · bps of raw gap</p>
        <p className="font-mono text-[11px] text-muted-foreground">
          hover a bar to read its working
        </p>
      </div>

      <div className="relative mt-6" style={{ height: H }}>
        {/* baseline and register rules */}
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
            const height = Math.max(2, Math.abs(y(bar.start) - y(bar.end)))
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
                    'gp-waterfall-bar absolute w-full transition-opacity duration-150',
                    dimmed ? 'opacity-30' : 'opacity-100',
                    isActive ? 'brightness-105' : ''
                  )}
                  style={{
                    top,
                    height,
                    animationDelay: `${idx * 60}ms`,
                    ...barFill(bar, tradable, isActive),
                  }}
                />

                {isActive ? (
                  <div
                    role="status"
                    className="absolute left-1/2 z-20 w-48 -translate-x-1/2 -translate-y-2 border border-[var(--gp-slag-500)] bg-[var(--gp-crucible)] px-3 py-2 text-left font-mono text-[11px] leading-relaxed text-[var(--gp-paper)] shadow-[4px_4px_0_rgba(0,0,0,0.35)]"
                    style={{ bottom: H - top + 8 }}
                  >
                    <div className="uppercase tracking-widest text-[var(--gp-slag-300)]">
                      {bar.label}
                    </div>
                    <div className="mt-1 text-sm">{fmtBps(bar.bps)}</div>
                    <div className="text-[var(--gp-slag-300)]">{inrPerG(bar.inr)}</div>
                    {bar.working ? (
                      <div className="mt-1 border-t border-[var(--gp-slag-700)] pt-1 text-[var(--gp-slag-300)]">
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

      {/* value rail */}
      <div className="mt-3 grid grid-cols-7 gap-1.5 border-t border-border pt-3 md:gap-3">
        {segments.map((bar, idx) => (
          <div key={`${bar.label}-rail-${idx}`} className="min-w-0 text-center">
            <div
              className={cn(
                'gp-figure text-[13px] leading-tight',
                bar.kind === 'net' && tradable && bar.bps > 0 ? 'gp-gold-text' : ''
              )}
            >
              {fmtBps(bar.bps)}
            </div>
            <div className="mt-1 truncate font-mono text-[9px] uppercase tracking-wider text-muted-foreground" title={bar.label}>
              {bar.label}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        <span className="inline-block h-2.5 w-2.5 bg-[var(--gp-gold-500)]" aria-hidden="true" />
        gold marks only the residual that survives costs
      </p>
    </div>
  )
}
