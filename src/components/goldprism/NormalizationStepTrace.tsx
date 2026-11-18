'use client'

import * as React from 'react'
import {
  contractSpecs,
  ContractSymbol,
  normalizeContractBySymbol,
} from '@/lib/goldprism/contract-specs'
import { inr, inrPerG } from '@/lib/goldprism/format'

export function NormalizationStepTrace({
  symbol,
  quotedPrice,
  label,
  asOf,
  source,
  compact = false,
}: {
  symbol: ContractSymbol
  quotedPrice: number
  label?: string
  asOf?: string
  source?: string
  compact?: boolean
}) {
  const spec = contractSpecs[symbol]

  if (!Number.isFinite(quotedPrice) || quotedPrice <= 0) {
    return (
      <div className="border border-border bg-card p-3 font-mono text-[11px] text-muted-foreground">
        {label ? `${label}: ` : ''}Enter a positive quoted price for {symbol} to view the normalization trace.
      </div>
    )
  }

  const trace = normalizeContractBySymbol(symbol, quotedPrice)

  return (
    <div className="border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="gp-label">{label ?? `${symbol} · Normalization trace`}</span>
          <span className="gp-tag gp-tag--neutral">
            q={spec.quotedPerGrams}g · p={spec.purity}
          </span>
        </div>
        {asOf || source ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            {source ? `${source}` : ''}
            {source && asOf ? ' · ' : ''}
            {asOf ? `as_of ${asOf}` : ''}
          </span>
        ) : null}
      </div>

      <div className={compact ? 'p-3' : 'p-4'}>
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="border border-border bg-background px-2 py-1 text-foreground">
            {inr(quotedPrice, 2)}
          </span>
          <span className="text-muted-foreground">→ ÷ {spec.quotedPerGrams}g →</span>
          <span className="border border-border bg-background px-2 py-1 text-foreground">
            {inrPerG(trace.pricePerQuotedGram, 2)}
          </span>
          <span className="text-muted-foreground">→ ÷ {spec.purity} →</span>
          <span className="border border-border bg-background px-2 py-1 text-foreground">
            {inrPerG(trace.pricePerPureGram, 2)}
          </span>
          <span className="text-muted-foreground">→ × 10 →</span>
          <span className="border border-[var(--gp-gold-500)] bg-[var(--gp-gold-50)] px-2 py-1 font-medium text-foreground dark:bg-[var(--gp-gold-900)]">
            {inr(trace.normalized10gPrice, 2)} / 10g (1000 fine)
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-muted-foreground">
          <span>Formula: {trace.formulaSubstituted}</span>
          <span>X-Ray 999/g basis: {inrPerG(trace.normalized999PerGram, 2)}</span>
        </div>
      </div>
    </div>
  )
}
