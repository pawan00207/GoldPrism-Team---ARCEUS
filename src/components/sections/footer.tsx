'use client'

import * as React from 'react'
import { Github } from 'lucide-react'
import { BrandMark, DataTag } from '@/components/goldprism/brand'

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-card">
      <div className="mx-auto max-w-[1360px] px-4 py-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <BrandMark className="h-7 w-7" />
              <span className="font-serif text-lg font-semibold tracking-tight">
                Gold<span className="gp-gold-text">Prism</span>
              </span>
            </div>
            <p className="gp-serif mt-3 text-base text-foreground">
              Institutional MCX gold spread analytics &amp; execution terminal.
            </p>
            <p className="mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">
              Separates audited purity basis, expiry carry, settlement artifact and statutory
              friction across GOLDM, GOLDTEN, GOLDGUINEA, and GOLDPETAL.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <DataTag detail="MCX 18M + Live Parity" />
              <a
                href="https://github.com/pawan00207/GoldPrism-Team---ARCEUS"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-[4px] border border-border text-muted-foreground transition-colors hover:border-[var(--gp-gold-500)] hover:text-foreground"
                aria-label="GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div>
            <div className="gp-kicker">GoldPrism research</div>
            <ul className="mt-3 space-y-2 font-mono text-[11px] text-muted-foreground">
              <li><a href="/research#data-health" className="hover:text-foreground hover:underline hover:decoration-[var(--gp-gold-500)] hover:underline-offset-4">Data health &amp; ingestion</a></li>
              <li><a href="/research#contract-master" className="hover:text-foreground hover:underline hover:decoration-[var(--gp-gold-500)] hover:underline-offset-4">MCX contract master</a></li>
              <li><a href="/xray" className="hover:text-foreground hover:underline hover:decoration-[var(--gp-gold-500)] hover:underline-offset-4">X-Ray waterfall</a></li>
              <li><a href="/research#best-vehicle" className="hover:text-foreground hover:underline hover:decoration-[var(--gp-gold-500)] hover:underline-offset-4">Best-vehicle ranking</a></li>
              <li><a href="/research#backtest-lab" className="hover:text-foreground hover:underline hover:decoration-[var(--gp-gold-500)] hover:underline-offset-4">Backtest lab (walk-forward)</a></li>
              <li><a href="/methodology#reports" className="hover:text-foreground hover:underline hover:decoration-[var(--gp-gold-500)] hover:underline-offset-4">Audit reports &amp; exports</a></li>
            </ul>
          </div>

          <div>
            <div className="gp-kicker">Research workspace</div>
            <ul className="mt-3 space-y-2 font-mono text-[11px] text-muted-foreground">
              <li><a href="/dashboard" className="hover:text-foreground">Authenticated terminal</a></li>
              <li><a href="/trade" className="hover:text-foreground">1-Click trade desk</a></li>
              <li><a href="/normalization" className="hover:text-foreground">10g normalization lab</a></li>
              <li><a href="/replay" className="hover:text-foreground">Point-in-time replay</a></li>
              <li><a href="/analyst" className="hover:text-foreground">Quant research analyst</a></li>
              <li><a href="/workspace#dashboard" className="hover:text-foreground">Factor &amp; alpha workspace</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-2 border-t border-border pt-4 font-mono text-[10px] uppercase tracking-[0.11em] text-muted-foreground sm:flex-row sm:items-center">
          <div>© {new Date().getFullYear()} GoldPrism · MIT License</div>
          <div>MCX Bullion Research &amp; Execution Terminal · Team ARCEUS</div>
        </div>
      </div>
    </footer>
  )
}
