'use client'

import * as React from 'react'
import {
  Code2,
  Github,
  GraduationCap,
  Linkedin,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SectionHead } from '@/components/goldprism/brand'

export function TeamArceusSection() {
  return (
    <section id="team-arceus" className="scroll-mt-16 border-b border-border bg-background">
      <div className="mx-auto max-w-[1360px] px-4 py-8 md:py-10">
        <SectionHead
          index="04"
          eyebrow="Team ARCEUS · Track 03 Commodity Derivatives"
          title="Builders of GoldPrism."
          description="Engineered end-to-end to separate genuine spread value from expiry carry, purity skew, and statutory transaction drag."
          aside={<span className="gp-tag gp-tag--gold">Hack in Hills &apos;26</span>}
        />

        {/* 3 Team Members Grid */}
        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
          {/* Pawan Singh (Lead Builder Card) */}
          <article className="flex flex-col justify-between overflow-hidden rounded-[4px] border border-[var(--gp-gold-500)]/60 bg-card shadow-[var(--gp-hard-shadow)]">
            <div>
              <div className="flex items-center justify-between gap-2 border-b border-border bg-[var(--gp-gold-50)]/70 px-4 py-2.5 dark:bg-[var(--gp-gold-900)]/30">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] gp-gold-text">
                  01 · Lead Developer
                </span>
                <span className="gp-tag gp-tag--gold">Full-Stack &amp; Quant</span>
              </div>

              <div className="p-5">
                <div className="mb-4 flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[4px] border border-[var(--gp-gold-500)]/50 bg-[var(--gp-gold-50)] font-mono text-sm font-semibold gp-gold-text dark:bg-[var(--gp-gold-900)]/40">
                    PS
                  </div>
                  <div>
                    <h3 className="gp-serif text-lg font-medium text-foreground">Pawan Singh</h3>
                    <p className="font-mono text-[11px] gp-gold-text">
                      Data &amp; Backend Engineering
                    </p>
                  </div>
                </div>

                <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                  Full-Stack Developer &amp; AI Builder
                </p>

                <div className="mb-4 space-y-1.5 rounded-[4px] border border-border bg-[var(--gp-vellum)]/60 p-3 font-mono text-[11px]">
                  <div className="flex items-center gap-1.5 text-foreground">
                    <GraduationCap className="h-3.5 w-3.5 shrink-0 gp-gold-text" />
                    <span>B.Tech CSE (2024–2028)</span>
                  </div>
                  <div className="pl-5 text-muted-foreground">
                    Delhi Technical Campus (DTC), GGSIPU
                  </div>
                  <div className="pl-5 font-semibold gp-gold-text">
                    CGPA: 9+
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">
                    Key GoldPrism Responsibilities
                  </div>
                  <div>• Bhavcopy fetcher, schema validators &amp; trust flags</div>
                  <div>• DuckDB / Parquet store &amp; contract calendar</div>
                  <div>• Full-stack Next.js research terminal transformation</div>
                  <div>• Zero-lookahead backtest pipeline &amp; test suite</div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-border bg-[var(--gp-vellum)]/40 px-5 py-3">
              <Button asChild size="sm" variant="outline" className="w-full gap-1.5 rounded-[4px] font-mono text-xs">
                <a href="https://github.com/pawan00207" target="_blank" rel="noreferrer">
                  <Github className="h-3.5 w-3.5" /> GitHub
                </a>
              </Button>
              <Button asChild size="sm" variant="outline" className="w-full gap-1.5 rounded-[4px] font-mono text-xs">
                <a href="https://linkedin.com/in/pawan-singh-555423322/" target="_blank" rel="noreferrer">
                  <Linkedin className="h-3.5 w-3.5 gp-gold-text" /> LinkedIn
                </a>
              </Button>
            </div>
          </article>

          {/* Manik Khurana */}
          <article className="flex flex-col justify-between overflow-hidden rounded-[4px] border border-border bg-card shadow-[var(--gp-hard-shadow)]">
            <div>
              <div className="flex items-center justify-between gap-2 border-b border-border bg-[var(--gp-vellum)]/60 px-4 py-2.5">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  02 · Quant Strategy
                </span>
                <span className="gp-tag gp-tag--neutral">Analytics Lead</span>
              </div>

              <div className="p-5">
                <div className="mb-4 flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[4px] border border-border bg-[var(--gp-vellum)] font-mono text-sm font-semibold text-foreground">
                    MK
                  </div>
                  <div>
                    <h3 className="gp-serif text-lg font-medium text-foreground">Manik Khurana</h3>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      Product Lead · Quant Analytics
                    </p>
                  </div>
                </div>

                <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                  Quantitative Strategy &amp; Model Architecture
                </p>

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">
                    Key GoldPrism Responsibilities
                  </div>
                  <div>• Spread decomposition &amp; structural signal model</div>
                  <div>• Walk-forward backtest &amp; transaction cost modeling</div>
                  <div>• Block bootstrap, MDE &amp; statistical significance</div>
                  <div>• 4-verdict decision logic (TRADABLE/WATCH/NO EDGE/BLOCKED)</div>
                </div>
              </div>
            </div>

            <div className="border-t border-border bg-[var(--gp-vellum)]/40 px-5 py-3 font-mono text-[11px] text-muted-foreground">
              Team ARCEUS · Track 03 Lead
            </div>
          </article>

          {/* Vikas Shukla */}
          <article className="flex flex-col justify-between overflow-hidden rounded-[4px] border border-border bg-card shadow-[var(--gp-hard-shadow)]">
            <div>
              <div className="flex items-center justify-between gap-2 border-b border-border bg-[var(--gp-vellum)]/60 px-4 py-2.5">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  03 · Terminal UX
                </span>
                <span className="gp-tag gp-tag--neutral">Design &amp; Demo</span>
              </div>

              <div className="p-5">
                <div className="mb-4 flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[4px] border border-border bg-[var(--gp-vellum)] font-mono text-sm font-semibold text-foreground">
                    VS
                  </div>
                  <div>
                    <h3 className="gp-serif text-lg font-medium text-foreground">Vikas Shukla</h3>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      Frontend, UX &amp; Demo
                    </p>
                  </div>
                </div>

                <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                  Interactive Design &amp; Presentation Delivery
                </p>

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">
                    Key GoldPrism Responsibilities
                  </div>
                  <div>• Streamlit dashboard &amp; interactive terminal wireframes</div>
                  <div>• X-Ray waterfall visual hierarchy</div>
                  <div>• Best-vehicle exposure ranking UX &amp; alerts</div>
                  <div>• 5-minute judge demo script &amp; pitch delivery</div>
                </div>
              </div>
            </div>

            <div className="border-t border-border bg-[var(--gp-vellum)]/40 px-5 py-3 font-mono text-[11px] text-muted-foreground">
              Team ARCEUS · UX Architecture
            </div>
          </article>
        </div>

        {/* Pawan Singh — Other Notable Projects Compact Grid */}
        <div className="mt-8 overflow-hidden rounded-[4px] border border-border bg-card shadow-[var(--gp-hard-shadow)]">
          <div className="flex items-center gap-2 border-b border-border bg-[var(--gp-vellum)]/60 px-4 py-2.5">
            <Code2 className="h-4 w-4 gp-gold-text" />
            <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">
              Pawan Singh — Other Portfolio Projects
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-px bg-border text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-card p-4">
              <div className="font-medium text-foreground">MediVerse.AI</div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                AI-driven healthcare assistant providing automated patient triage and clinical data intelligence.
              </p>
            </div>
            <div className="bg-card p-4">
              <div className="font-medium text-foreground">Swasth-Saathi</div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                Bilingual health empowerment platform delivering preventative care insights for underserved communities.
              </p>
            </div>
            <div className="bg-card p-4">
              <div className="font-medium text-foreground">TrafficGuard Pro</div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                Computer-vision system for real-time intersection traffic density estimation and emergency routing.
              </p>
            </div>
            <div className="bg-card p-4">
              <div className="font-medium text-foreground">ResQMap</div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                Disaster relief mapping tool coordinating resource allocation during urban flood crises.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

