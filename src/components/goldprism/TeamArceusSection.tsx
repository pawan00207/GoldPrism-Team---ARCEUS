'use client'

import * as React from 'react'
import {
  ExternalLink,
  Github,
  GraduationCap,
  Linkedin,
  MapPin,
  Sparkles,
  Award,
  Code2,
  Cpu,
  Layers,
  Database,
  Terminal,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function TeamArceusSection() {
  return (
    <section id="team-arceus" className="py-16 scroll-mt-16 bg-gradient-to-b from-background via-card/20 to-background">
      <div className="container mx-auto px-4 max-w-7xl">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Badge variant="outline" className="mb-3 gap-1.5 border-amber-500/40 text-amber-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Team ARCEUS · Hack in Hills '26
          </Badge>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Meet the Builders of <span className="text-amber-400">GoldPrism</span>
          </h2>
          <p className="text-muted-foreground text-sm md:text-base mt-2">
            Track 03: Commodity Derivatives Intelligence — Built end-to-end to separate real economic value from expiry carry and transaction friction.
          </p>
        </div>

        {/* 3 Team Members Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          
          {/* Pawan Singh (Lead Builder Card) */}
          <Card className="border-amber-500/50 bg-gradient-to-b from-amber-500/10 to-card p-6 relative overflow-hidden flex flex-col justify-between shadow-lg shadow-amber-500/5">
            <div className="absolute top-0 right-0 p-3">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500 text-black">
                LEAD DEVELOPER
              </span>
            </div>

            <div>
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-xl mb-4 font-mono">
                PS
              </div>

              <h3 className="text-xl font-bold text-foreground">Pawan Singh</h3>
              <div className="text-xs font-semibold text-amber-300 font-mono mt-0.5 mb-2">
                Data &amp; Backend Engineering
              </div>
              <div className="text-xs text-muted-foreground mb-4 leading-relaxed">
                Full-Stack Developer &amp; AI Builder
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-border/60 text-xs space-y-1.5 font-mono mb-4">
                <div className="flex items-center gap-1.5 text-foreground">
                  <GraduationCap className="w-3.5 h-3.5 text-amber-400" />
                  <span>B.Tech CSE (2024–2028)</span>
                </div>
                <div className="text-muted-foreground pl-5">
                  Delhi Technical Campus (DTC), GGSIPU
                </div>
                <div className="text-amber-300 font-semibold pl-5">
                  CGPA: 9+
                </div>
              </div>

              <div className="text-xs space-y-1.5 text-muted-foreground mb-4">
                <div className="font-semibold text-foreground text-[11px] uppercase tracking-wider mb-1">
                  Key GoldPrism Responsibilities:
                </div>
                <div>• Bhavcopy fetcher, schema validators &amp; trust flags</div>
                <div>• DuckDB / Parquet store &amp; contract calendar</div>
                <div>• Full-stack Next.js research terminal transformation</div>
                <div>• Zero-lookahead backtest pipeline &amp; test suite</div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-4 border-t border-border/40">
              <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs font-mono w-full">
                <a href="https://github.com/pawan00207" target="_blank" rel="noreferrer">
                  <Github className="w-3.5 h-3.5" /> GitHub
                </a>
              </Button>
              <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs font-mono w-full">
                <a href="https://linkedin.com/in/pawan-singh-555423322/" target="_blank" rel="noreferrer">
                  <Linkedin className="w-3.5 h-3.5 text-blue-400" /> LinkedIn
                </a>
              </Button>
            </div>
          </Card>

          {/* Manik Khurana */}
          <Card className="border-border/80 bg-card/60 p-6 flex flex-col justify-between">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xl mb-4 font-mono">
                MK
              </div>

              <h3 className="text-xl font-bold text-foreground">Manik Khurana</h3>
              <div className="text-xs font-semibold text-blue-300 font-mono mt-0.5 mb-2">
                Product Lead · Quant Analytics
              </div>
              <div className="text-xs text-muted-foreground mb-4 leading-relaxed">
                Quantitative Strategy &amp; Model Architecture
              </div>

              <div className="text-xs space-y-1.5 text-muted-foreground mb-4">
                <div className="font-semibold text-foreground text-[11px] uppercase tracking-wider mb-1">
                  Key GoldPrism Responsibilities:
                </div>
                <div>• Spread decomposition &amp; structural signal model</div>
                <div>• Walk-forward backtest &amp; transaction cost modeling</div>
                <div>• Block bootstrap, MDE &amp; statistical significance</div>
                <div>• 4-verdict decision logic (TRADABLE/WATCH/NO EDGE/BLOCKED)</div>
              </div>
            </div>

            <div className="pt-4 border-t border-border/40 text-xs text-muted-foreground font-mono">
              Team ARCEUS · Track 03 Lead
            </div>
          </Card>

          {/* Vikas Shukla */}
          <Card className="border-border/80 bg-card/60 p-6 flex flex-col justify-between">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xl mb-4 font-mono">
                VS
              </div>

              <h3 className="text-xl font-bold text-foreground">Vikas Shukla</h3>
              <div className="text-xs font-semibold text-amber-300 font-mono mt-0.5 mb-2">
                Frontend, UX &amp; Demo
              </div>
              <div className="text-xs text-muted-foreground mb-4 leading-relaxed">
                Interactive Design &amp; Presentation Delivery
              </div>

              <div className="text-xs space-y-1.5 text-muted-foreground mb-4">
                <div className="font-semibold text-foreground text-[11px] uppercase tracking-wider mb-1">
                  Key GoldPrism Responsibilities:
                </div>
                <div>• Streamlit dashboard &amp; interactive terminal wireframes</div>
                <div>• X-Ray waterfall visual hierarchy</div>
                <div>• Best-vehicle exposure ranking UX &amp; alerts</div>
                <div>• 5-minute judge demo script &amp; pitch delivery</div>
              </div>
            </div>

            <div className="pt-4 border-t border-border/40 text-xs text-muted-foreground font-mono">
              Team ARCEUS · UX Architecture
            </div>
          </Card>
        </div>

        {/* Pawan Singh — Other Notable Projects Compact Grid */}
        <Card className="p-6 border-border/60 bg-muted/20">
          <div className="flex items-center gap-2 mb-4">
            <Code2 className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Pawan Singh — Other Portfolio Projects
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-card border border-border/60">
              <div className="font-bold text-foreground mb-1">MediVerse.AI</div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                AI-driven healthcare assistant providing automated patient triage and clinical data intelligence.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-card border border-border/60">
              <div className="font-bold text-foreground mb-1">Swasth-Saathi</div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Bilingual health empowerment platform delivering preventative care insights for underserved communities.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-card border border-border/60">
              <div className="font-bold text-foreground mb-1">TrafficGuard Pro</div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Computer-vision system for real-time intersection traffic density estimation and emergency routing.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-card border border-border/60">
              <div className="font-bold text-foreground mb-1">ResQMap</div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Disaster relief mapping tool coordinating resource allocation during urban flood crises.
              </p>
            </div>
          </div>
        </Card>

      </div>
    </section>
  )
}
