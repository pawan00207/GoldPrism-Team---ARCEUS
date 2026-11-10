'use client'

import * as React from 'react'
import { ArrowRight, Database, Layers, Scale } from 'lucide-react'
import { BrandMark, DataTag, Hallmark, SpectralRule } from '@/components/goldprism/brand'
import { inr, inrPerG } from '@/lib/goldprism/format'

const CONTRACT_CARDS = [
  { sym: 'GOLDM', purity: '995 fine', price: 73510, pricePerG: 7321.57, unit: '100g · quote/10g' },
  { sym: 'GOLDTEN', purity: '999 fine', price: 74080, pricePerG: 7408, unit: '10g · quote/10g' },
  { sym: 'GOLDGUINEA', purity: '999 fine', price: 59250, pricePerG: 7406.25, unit: '8g · quote/8g' },
  { sym: 'GOLDPETAL', purity: '999 fine', price: 7410, pricePerG: 7410, unit: '1g · quote/1g' },
]

export function GoldPrismHeader() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-background">
      <div className="gp-register-mark gp-register-mark--top" aria-hidden="true" />
      <div className="relative z-10 mx-auto max-w-[1200px] px-4 py-16 md:py-24">
        <div className="grid items-end gap-12 lg:grid-cols-[minmax(0,61.8%)_minmax(0,38.2%)]">
          <div>
            <div className="mb-8 flex items-center gap-4">
              <BrandMark className="h-12 w-12" />
              <div>
                <p className="gp-kicker">MCX gold / research terminal</p>
                <h1 className="gp-display mt-2">
                  Gold<span className="gp-gold-text">Prism</span>
                </h1>
              </div>
            </div>

            <p className="gp-ledger text-2xl leading-tight text-foreground md:text-4xl">
              Prism that explains scattered gold.
            </p>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Normalize the contract. Name the carry. Price the friction. The remaining spread is
              the only number that deserves attention.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a className="gp-button gp-button--primary" href="/xray">
                <Layers className="h-4 w-4" aria-hidden="true" /> Open X-Ray
              </a>
              <a className="gp-button" href="/research#data-health">
                <Database className="h-4 w-4" aria-hidden="true" /> Inspect data
              </a>
              <a className="gp-button" href="/research#best-vehicle">
                <Scale className="h-4 w-4" aria-hidden="true" /> Match exposure
              </a>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <DataTag synthetic detail="20 Mar 2026" />
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Not a live market feed
              </span>
            </div>
          </div>

          <div className="gp-certificate">
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-border pb-4">
              <div>
                <p className="gp-label">Assay certificate</p>
                <p className="mt-2 font-mono text-sm text-foreground">
                  No. 2026-0320 · GUINEA/M
                </p>
              </div>
              <Hallmark verdict="NO EDGE" size={44} />
            </div>

            <dl className="space-y-3 font-mono text-xs">
              <div className="flex items-end justify-between gap-4">
                <dt className="gp-label">Reference pair</dt>
                <dd className="text-foreground">GOLDGUINEA / GOLDM</dd>
              </div>
              <div className="flex items-end justify-between gap-4">
                <dt className="gp-label">Raw gap</dt>
                <dd className="gp-figure">+45.0 bps</dd>
              </div>
              <div className="flex items-end justify-between gap-4">
                <dt className="gp-label">Basis</dt>
                <dd className="gp-figure">+12.5 bps</dd>
              </div>
              <div className="flex items-end justify-between gap-4">
                <dt className="gp-label">Carry</dt>
                <dd className="gp-figure">−48.4 bps</dd>
              </div>
              <div className="flex items-end justify-between gap-4 border-b border-border pb-3">
                <dt className="gp-label">Artifact</dt>
                <dd className="gp-figure">−7.0 bps</dd>
              </div>
              <div className="gp-double-rule flex items-end justify-between gap-4 pt-3">
                <dt className="gp-label">= Judged residual</dt>
                <dd className="gp-figure text-base text-foreground">+2.1 bps</dd>
              </div>
              <div className="flex items-end justify-between gap-4">
                <dt className="gp-label">Cost hurdle</dt>
                <dd className="gp-figure">−6.8 bps</dd>
              </div>
              <div className="gp-double-rule flex items-end justify-between gap-4 pt-3">
                <dt className="gp-label">= Net edge</dt>
                <dd className="gp-figure text-base text-foreground">−4.7 bps</dd>
              </div>
            </dl>

            <SpectralRule className="my-4" />

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="gp-label">Verdict</p>
                <p className="gp-ledger mt-1 text-xl">No edge today.</p>
                <p className="mt-2 max-w-[15rem] text-[11px] leading-relaxed text-muted-foreground">
                  The residual is real, but it does not clear the 6.8 bps cost of harvesting it.
                </p>
              </div>
              <p className="max-w-[15rem] text-right text-[11px] leading-relaxed text-muted-foreground">
                Historical fixture values for audit walkthroughs, not current market quotations.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-14 border-t border-border pt-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="gp-kicker">Contract family · normalized to 999 fine</p>
            <p className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:block">
              ₹/g · fixture
            </p>
          </div>
          <div className="grid grid-cols-2 border border-border lg:grid-cols-4">
            {CONTRACT_CARDS.map((contract, index) => (
              <div
                key={contract.sym}
                className={`relative p-4 ${index > 0 ? 'border-l border-border' : ''} ${
                  index > 1 ? 'border-t border-border lg:border-t-0' : ''
                } ${index === 1 ? 'border-l border-border' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-medium tracking-wide text-foreground">
                    {contract.sym}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                    {contract.purity}
                  </span>
                </div>
                <p className="gp-figure mt-4 text-lg">{inr(contract.price, 0)}</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {inrPerG(contract.pricePerG)}
                </p>
                <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                  {contract.unit}
                </p>
                <ArrowRight
                  className="absolute bottom-4 right-4 h-3 w-3 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
