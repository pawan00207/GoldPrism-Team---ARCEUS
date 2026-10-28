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

        {/* 7. Auditable Reports & Data Exports */}
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
