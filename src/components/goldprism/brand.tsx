import * as React from 'react'
import { cn } from '@/lib/utils'

export type Verdict = 'TRADABLE' | 'WATCH' | 'NO EDGE' | 'BLOCKED'

const VERDICT_TONE: Record<Verdict, string> = {
  TRADABLE: 'text-[var(--gp-tradable-ink)]',
  WATCH: 'text-[var(--gp-watch-ink)]',
  'NO EDGE': 'text-[var(--gp-meta-ink)]',
  BLOCKED: 'text-[var(--gp-blocked-ink)]',
}

const VERDICT_TAG: Record<Verdict, string> = {
  TRADABLE: 'gp-tag gp-tag--tradable',
  WATCH: 'gp-tag gp-tag--watch',
  'NO EDGE': 'gp-tag gp-tag--neutral',
  BLOCKED: 'gp-tag gp-tag--blocked',
}

export function normalizeVerdict(value: string): Verdict {
  const key = value.trim().toUpperCase().replace(/[-_]+/g, ' ')
  if (key === 'TRADABLE') return 'TRADABLE'
  if (key === 'WATCH') return 'WATCH'
  if (key === 'BLOCKED') return 'BLOCKED'
  return 'NO EDGE'
}

/* ------------------------------------------------------------------ */
/* Identity · the ingot is 1:1.618; bands step down 29 · 18 · 11 · 7  */
/* ------------------------------------------------------------------ */

export function BrandMark({
  className,
  tone = 'paper',
  title = 'GoldPrism',
}: {
  className?: string
  tone?: 'paper' | 'dark'
  title?: string
}) {
  const bands =
    tone === 'dark'
      ? ['#D9D2BF', '#A89F8C', '#6F6859', '#D09A1C']
      : ['#3A352C', '#6F6859', '#A89F8C', '#D09A1C']

  return (
    <svg
      viewBox="0 0 120 100"
      className={className}
      role="img"
      aria-label={title}
      focusable="false"
    >
      <defs>
        <clipPath id="gp-mark-clip">
          <polygon points="0,13 120,13 97,87 23,87" />
        </clipPath>
      </defs>
      <g clipPath="url(#gp-mark-clip)">
        <rect y="13" width="120" height="29" fill={bands[0]} />
        <rect y="45" width="120" height="18" fill={bands[1]} />
        <rect y="66" width="120" height="11" fill={bands[2]} />
        <rect y="80" width="120" height="7" fill={bands[3]} />
      </g>
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Hallmarks · the shape differs, not just the colour                  */
/* ------------------------------------------------------------------ */

function HallmarkBands({ verdict }: { verdict: Verdict }) {
  switch (verdict) {
    case 'TRADABLE':
      return (
        <>
          <rect x="26" y="22" width="36" height="6" fill="#D9D2BF" />
          <rect x="29" y="32" width="30" height="6" fill="#A89F8C" />
          <rect x="32" y="42" width="24" height="6" fill="#6F6859" />
          <rect x="35" y="52" width="18" height="8" fill="url(#gp-foil-grad)" />
        </>
      )
    case 'WATCH':
      return (
        <>
          <rect x="26" y="22" width="36" height="6" fill="#D9D2BF" />
          <rect x="29" y="32" width="30" height="6" fill="#A89F8C" />
          <rect x="32" y="42" width="24" height="6" fill="#6F6859" />
          <rect x="35" y="55" width="18" height="3" fill="#D98B2B" />
        </>
      )
    case 'BLOCKED':
      return (
        <>
          <path d="M26 26L62 62M62 26L26 62" stroke="currentColor" strokeWidth="5" fill="none" />
        </>
      )
    default:
      return (
        <>
          <rect x="26" y="22" width="36" height="6" fill="#D9D2BF" />
          <rect x="29" y="32" width="30" height="6" fill="#A89F8C" />
          <rect x="32" y="42" width="24" height="6" fill="#6F6859" />
          <rect
            x="35"
            y="52"
            width="18"
            height="8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="3 2"
          />
        </>
      )
  }
}

function HallmarkShape({ verdict }: { verdict: Verdict }) {
  switch (verdict) {
    case 'TRADABLE':
      return <path d="M10 8h68v40L44 82 10 48z" />
    case 'WATCH':
      return <path d="M28 6h32l22 22v32L60 82H28L6 60V28z" />
    case 'BLOCKED':
      return <rect x="8" y="8" width="72" height="72" />
    default:
      return <circle cx="44" cy="44" r="37" />
  }
}

export function Hallmark({
  verdict,
  size = 88,
  className,
  label = true,
}: {
  verdict: Verdict | string
  size?: number
  className?: string
  label?: boolean
}) {
  const v = typeof verdict === 'string' ? normalizeVerdict(verdict) : verdict
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 88 88"
      role="img"
      aria-label={label ? `${v} hallmark` : undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
      className={cn(VERDICT_TONE[v], className)}
    >
      <defs>
        <linearGradient id="gp-foil-grad" x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0%" stopColor="#8A5F0B" />
          <stop offset="16%" stopColor="#D09A1C" />
          <stop offset="36%" stopColor="#F6D983" />
          <stop offset="46%" stopColor="#FFF3C4" />
          <stop offset="58%" stopColor="#D9A62E" />
          <stop offset="78%" stopColor="#9A6B10" />
          <stop offset="100%" stopColor="#C99318" />
        </linearGradient>
      </defs>
      <g
        fill="var(--background)"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinejoin="round"
      >
        <HallmarkShape verdict={v} />
      </g>
      <HallmarkBands verdict={v} />
    </svg>
  )
}

export function VerdictTag({
  verdict,
  className,
}: {
  verdict: Verdict | string
  className?: string
}) {
  const v = typeof verdict === 'string' ? normalizeVerdict(verdict) : verdict
  return (
    <span className={cn(VERDICT_TAG[v], className)}>
      <svg
        width="12"
        height="12"
        viewBox="0 0 88 88"
        aria-hidden="true"
        focusable="false"
        className="shrink-0"
      >
        <g fill="none" stroke="currentColor" strokeWidth="8" strokeLinejoin="round">
          <HallmarkShape verdict={v} />
        </g>
      </svg>
      {v}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Provenance · real and synthetic shown in the material              */
/* ------------------------------------------------------------------ */

export function DataTag({
  synthetic = false,
  detail,
  className,
}: {
  synthetic?: boolean
  detail?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'gp-tag',
        synthetic ? 'gp-hatch gp-tag--neutral' : 'gp-tag--neutral',
        className
      )}
    >
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 border border-current"
        style={{ background: synthetic ? 'transparent' : 'currentColor' }}
      />
      {synthetic ? 'Synthetic' : 'Real'}
      {detail ? (
        <span className="normal-case tracking-normal opacity-80">· {detail}</span>
      ) : null}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Section chrome                                                     */
/* ------------------------------------------------------------------ */

export function SectionHead({
  index,
  eyebrow,
  title,
  description,
  aside,
  className,
}: {
  index?: string
  eyebrow: string
  title: React.ReactNode
  description?: React.ReactNode
  aside?: React.ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        'flex flex-col gap-[var(--gp-space-4)] border-b border-border pb-[var(--gp-space-4)] lg:flex-row lg:items-end lg:justify-between',
        className
      )}
    >
      <div className="min-w-0 max-w-3xl">
        <p className="gp-kicker">
          {index ? <span className="mr-3">{index}</span> : null}
          {eyebrow}
        </p>
        <h2 className="gp-title mt-3 text-balance">{title}</h2>
        {description ? <p className="gp-clerk mt-4 max-w-2xl">{description}</p> : null}
      </div>
      {aside ? <div className="shrink-0 lg:pb-1">{aside}</div> : null}
    </header>
  )
}

export function Metric({
  label,
  value,
  unit,
  note,
  tone = 'ink',
  className,
}: {
  label: React.ReactNode
  value: React.ReactNode
  unit?: string
  note?: React.ReactNode
  tone?: 'ink' | 'gold' | 'tradable' | 'watch' | 'blocked' | 'muted'
  className?: string
}) {
  const tones: Record<string, string> = {
    ink: 'text-foreground',
    gold: 'gp-gold-text',
    tradable: 'gp-tradable-text',
    watch: 'gp-watch-text',
    blocked: 'gp-blocked-text',
    muted: 'gp-watch-text',
  }
  return (
    <div className={cn('border-t border-border pt-3', className)}>
      <p className="gp-label">{label}</p>
      <p className={cn('gp-figure mt-2 text-2xl leading-none', tones[tone])}>
        {value}
        {unit ? (
          <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>
        ) : null}
      </p>
      {note ? (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{note}</p>
      ) : null}
    </div>
  )
}

export function SpectralRule({ className }: { className?: string }) {
  return <div className={cn('gp-spectral', className)} aria-hidden="true" />
}
