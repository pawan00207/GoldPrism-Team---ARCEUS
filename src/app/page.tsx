'use client'

import * as React from 'react'
import { Navbar, TickerTape } from '@/components/navbar'
import { GoldPrismHeader } from '@/components/goldprism/GoldPrismHeader'
import { JudgeDemoSection } from '@/components/goldprism/JudgeDemoSection'
import { XRayWaterfallSection } from '@/components/goldprism/XRayWaterfallSection'
import { DataHealthSection } from '@/components/goldprism/DataHealthSection'
import { ContractMasterSection } from '@/components/goldprism/ContractMasterSection'
import { BestVehicleSection } from '@/components/goldprism/BestVehicleSection'
import { BacktestLabSection } from '@/components/goldprism/BacktestLabSection'
import { TermStructureSection } from '@/components/goldprism/TermStructureSection'
import { ContractLifecycleSection } from '@/components/goldprism/ContractLifecycleSection'
import { TraderIntelligenceSection } from '@/components/goldprism/TraderIntelligenceSection'
import { DataAuditMethodologySection } from '@/components/goldprism/DataAuditMethodologySection'
import { ReportsExportSection } from '@/components/goldprism/ReportsExportSection'
import { TeamArceusSection } from '@/components/goldprism/TeamArceusSection'

// Preserved original workspace capabilities
import { Dashboard } from '@/components/sections/dashboard'
import { Agent } from '@/components/sections/agent'
import { AlphaZoo } from '@/components/sections/alpha-zoo'
import { PaperTrading } from '@/components/sections/paper-trading'
import { ShadowAccount } from '@/components/sections/shadow-account'
import { Swarm } from '@/components/sections/swarm'
import { StrategyBuilder } from '@/components/sections/strategy-builder'
import { Features } from '@/components/sections/features'
import { Footer } from '@/components/sections/footer'
import { Globe, Layers, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default function Home() {
  return (
<<<<<<< Updated upstream
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />
      <TickerTape />

      <main className="flex-1">
        {/* =========================================================
            PRIMARY PRODUCT: GOLDPRISM COMMODITY RESEARCH TERMINAL
            Team ARCEUS · Hack in Hills '26 · Track 03
            ========================================================= */}
        <div id="goldprism-overview">
          <GoldPrismHeader />
        </div>

        {/* 1. 5-Minute Judge Demo Walkthrough (Slide 7) */}
        <JudgeDemoSection />

        {/* 2. Signature X-Ray Waterfall (Slide 3) */}
        <XRayWaterfallSection />

        {/* 3. Data Health & Bhavcopy Ingestion Gates (Slide 4) */}
        <DataHealthSection />

        {/* 4. MCX Contract Master & Purity Normalizer (Slide 2) */}
        <ContractMasterSection />

        {/* 5. Best Vehicle Ranking for Exposure (Slides 3, 5, 7) */}
        <BestVehicleSection />

        {/* 6. Walk-Forward Backtest Lab & P&L Attribution (Slide 7) */}
        <BacktestLabSection />

        {/* 7. Term Structure & Roll-Down Carry Decomposition (Phase D) */}
        <TermStructureSection />

        {/* 8. Contract Lifecycle & Expiry Calendar Guard (Phase E) */}
        <ContractLifecycleSection />

        {/* 9. Trader Intelligence, Why Quiet Digest & Cost Heatmap (Phase F) */}
        <TraderIntelligenceSection />

        {/* 10. Data Audit, Discrepancy Resolution & Methodology (Phase G) */}
        <DataAuditMethodologySection />

        {/* 11. Auditable Reports & Data Exports */}
        <ReportsExportSection />

        {/* 8. Team ARCEUS & Pawan Singh Builder Profile (Slide 1) */}
        <TeamArceusSection />

        {/* =========================================================
            PRESERVED WORKSPACE CAPABILITIES: GLOBAL MARKETS & TOOLS
            100% Preserved & Enhanced with GoldPrism Context
            ========================================================= */}
        {/* Visual divider: amber accent line */}
        <div className="section-divider mx-8" />
        <div className="py-14 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-amber-500/3 via-transparent to-transparent pointer-events-none" />
          <div className="container mx-auto px-4 max-w-7xl text-center relative z-10">
            <Badge variant="outline" className="mb-3 gap-1.5 border-amber-500/30 text-amber-400 bg-amber-500/5">
              <Globe className="w-3.5 h-3.5" /> Preserved Multi-Asset Research Engine
            </Badge>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Global Markets, Factor Zoo &amp; Multi-Agent Swarm
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl mx-auto mt-2">
              All original equity, crypto, macro, and quantitative research tools remain fully operational alongside the GoldPrism terminal.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs text-muted-foreground">
              <span className="px-2.5 py-1 rounded-full bg-muted/60 border border-border/60">📊 Market Dashboard</span>
              <span className="px-2.5 py-1 rounded-full bg-muted/60 border border-border/60">🤖 AI Agent</span>
              <span className="px-2.5 py-1 rounded-full bg-muted/60 border border-border/60">⚗️ Alpha Zoo · 456 Factors</span>
              <span className="px-2.5 py-1 rounded-full bg-muted/60 border border-border/60">📈 Paper Trading</span>
              <span className="px-2.5 py-1 rounded-full bg-muted/60 border border-border/60">🌐 Multi-Agent Swarm</span>
              <span className="px-2.5 py-1 rounded-full bg-muted/60 border border-border/60">🏗️ Strategy Builder</span>
            </div>
=======
    <SiteShell>
      <GoldPrismHeader />
      <section className="border-b border-border bg-background">
        <div className="gp-container py-[var(--gp-space-5)] md:py-[var(--gp-space-6)]">
          <div className="flex flex-col gap-[var(--gp-space-3)] border-b border-border pb-[var(--gp-space-4)] lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="gp-kicker">A quiet research interface</p>
              <h2 className="gp-title mt-3 text-balance">
                Start with the question, not the dashboard.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground lg:text-right">
              GoldPrism is organized as a sequence of evidence surfaces so each decision has a
              clear place to live.
            </p>
          </div>

          <div className="gp-stagger mt-[var(--gp-space-4)] grid gap-px border border-border bg-border md:grid-cols-2">
            {pathways.map((pathway) => {
              const Icon = pathway.icon
              return (
                <Link
                  key={pathway.href}
                  href={pathway.href}
                  className="group relative flex min-h-[15rem] flex-col justify-between bg-card p-6 transition-colors hover:bg-[var(--gp-gold-50)] dark:hover:bg-[var(--gp-gold-900)]"
                >
                  <div className="flex items-start justify-between gap-5">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground">
                        {pathway.index}
                      </span>
                      <span className="h-px w-8 bg-border" aria-hidden="true" />
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        {pathway.eyebrow}
                      </span>
                    </div>
                    <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </div>

                  <div className="mt-8">
                    <h3 className="gp-subhead">{pathway.title}</h3>
                    <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                      {pathway.description}
                    </p>
                    <SpectralRule className="mt-5" />
                    <span className="mt-4 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground transition-colors group-hover:text-foreground">
                      Open surface
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              )
            })}
>>>>>>> Stashed changes
          </div>
        </div>
        <div className="section-divider mx-8" />

        {/* Preserved Global Dashboard */}
        <Dashboard />

        {/* Preserved AI Research Agent (Enhanced with GoldPrism system prompt) */}
        <Agent />

        {/* Preserved Alpha Zoo (456 Factors + GoldPrism Commodity Spreads) */}
        <AlphaZoo />

        {/* Preserved Paper Trading Arena */}
        <PaperTrading />

        {/* Preserved Shadow Account Behavioral Trade Journal */}
        <ShadowAccount />

        {/* Preserved Multi-Agent Swarm (5 Original Presets + GoldPrism Quant Desk) */}
        <Swarm />

        {/* Preserved Visual Strategy Builder & Backtester */}
        <StrategyBuilder />

        {/* Preserved Features Grid */}
        <Features />
      </main>

      <Footer />
    </div>
  )
}
