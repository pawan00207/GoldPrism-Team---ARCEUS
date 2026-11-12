'use client'

import * as React from 'react'
import { Github } from 'lucide-react'
import { BrandMark, DataTag } from '@/components/goldprism/brand'

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-card">
      <div className="mx-auto max-w-[1200px] px-4 py-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <BrandMark className="h-8 w-8" />
              <span className="font-serif text-lg font-medium tracking-tight">
                Gold<span className="gp-foil-text font-normal italic">Prism</span>
              </span>
            </div>
            <p className="gp-serif mt-4 text-base text-foreground">
              Prism that explains scattered gold.
            </p>
            <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
              Separates audited basis, expiry carry, settlement artifact and residual from a
              noisy MCX gold calendar spread.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <DataTag synthetic detail="20 Mar 2026" />
              <a
                href="https://github.com/pawan00207/GoldPrism-Team---ARCEUS"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 w-9 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-[var(--gp-gold-500)] hover:text-foreground"
                aria-label="GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div>
            <div className="gp-kicker">Gold<span className="gp-foil-text font-normal italic">Prism</span> research</div>
            <ul className="mt-4 space-y-2.5 font-mono text-[11px] text-muted-foreground">
              <li><a href="/research#data-health" className="hover:text-foreground hover:underline hover:decoration-[var(--gp-gold-500)] hover:decoration-2 hover:underline-offset-4">Data health &amp; ingestion</a></li>
              <li><a href="/research#contract-master" className="hover:text-foreground hover:underline hover:decoration-[var(--gp-gold-500)] hover:decoration-2 hover:underline-offset-4">MCX contract master</a></li>
              <li><a href="/xray" className="hover:text-foreground hover:underline hover:decoration-[var(--gp-gold-500)] hover:decoration-2 hover:underline-offset-4">X-Ray waterfall</a></li>
              <li><a href="/research#best-vehicle" className="hover:text-foreground hover:underline hover:decoration-[var(--gp-gold-500)] hover:decoration-2 hover:underline-offset-4">Best-vehicle ranking</a></li>
              <li><a href="/research#backtest-lab" className="hover:text-foreground hover:underline hover:decoration-[var(--gp-gold-500)] hover:decoration-2 hover:underline-offset-4">Backtest lab (walk-forward)</a></li>
              <li><a href="/methodology#reports" className="hover:text-foreground hover:underline hover:decoration-[var(--gp-gold-500)] hover:decoration-2 hover:underline-offset-4">Audit reports &amp; exports</a></li>
            </ul>
          </div>

          <div>
            <div className="gp-kicker">Research workspace</div>
            <ul className="mt-4 space-y-2.5 font-mono text-[11px] text-muted-foreground">
              <li><a href="/workspace#dashboard" className="hover:text-foreground">Global markets dashboard</a></li>
              <li><a href="/workspace#agent" className="hover:text-foreground">AI research agent</a></li>
              <li><a href="/workspace#alphas" className="hover:text-foreground">Alpha zoo (456 factors)</a></li>
              <li><a href="/workspace#paper-trading" className="hover:text-foreground">Paper trading arena</a></li>
              <li><a href="/workspace#shadow" className="hover:text-foreground">Shadow account journal</a></li>
              <li><a href="/workspace#swarm" className="hover:text-foreground">Multi-agent swarm</a></li>
              <li><a href="/workspace#builder" className="hover:text-foreground">Strategy builder</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-border pt-5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground sm:flex-row sm:items-center">
          <div>© {new Date().getFullYear()} GoldPrism · MIT License</div>
          <div>Hack in Hills '26 · Track 03 · Team ARCEUS</div>
        </div>
      </div>
    </footer>
  )
}
