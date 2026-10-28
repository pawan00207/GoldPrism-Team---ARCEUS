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
        <div className="py-12 bg-muted/10 border-y border-border/80">
          <div className="container mx-auto px-4 max-w-7xl text-center">
            <Badge variant="outline" className="mb-2 gap-1.5 border-border text-muted-foreground">
              <Globe className="w-3.5 h-3.5 text-amber-400" /> Preserved Multi-Asset Research Engine
            </Badge>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Global Markets, Factor Zoo &amp; Multi-Agent Swarm
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl mx-auto mt-1">
              All original equity, crypto, macro, and quantitative tools remain fully operational alongside the GoldPrism terminal.
            </p>
          </div>
        </div>

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
