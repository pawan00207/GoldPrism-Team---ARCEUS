'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  ShieldCheck,
  Hash,
  Scale,
  Sparkles,
  Flame,
  ArrowRight,
  TrendingDown,
  Layers,
  Database,
  FileText,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function GoldPrismHeader() {
  return (
    <section className="relative overflow-hidden pt-12 pb-10 border-b border-border/60 bg-gradient-to-b from-amber-500/5 via-background to-background">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="container mx-auto px-4 max-w-7xl relative z-10">
        
        {/* Badges Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 gap-1.5 py-1 px-3">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Hack in Hills '26 · Track 03: Commodity Derivatives Intelligence
            </Badge>
            <Badge variant="outline" className="text-muted-foreground border-border/80 gap-1">
              <Scale className="w-3 h-3 text-amber-400" /> Team ARCEUS
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span className="px-2 py-0.5 rounded bg-muted/60 border border-border/60 flex items-center gap-1">
              <Hash className="w-3 h-3 text-amber-400" />
              RUN: <span className="text-foreground font-semibold">GP-A84F2B01</span>
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              DATA INTEGRITY: VERIFIED
            </span>
          </div>
        </div>

        {/* Main Hero Title */}
        <div className="max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-black font-black text-xl">
                ▲
              </div>
              <h1 className="text-4xl md:text-6xl font-black tracking-tight text-foreground">
                Gold<span className="text-amber-400">Prism</span>
              </h1>
              <span className="text-xs uppercase tracking-widest px-2.5 py-1 rounded bg-amber-400/10 border border-amber-400/30 text-amber-300 font-semibold">
                MCX Research Terminal
              </span>
            </div>

            <p className="text-xl md:text-2xl font-medium text-amber-200/90 mb-3 tracking-tight">
              Prism That Explains Scattered Gold
            </p>

            <p className="text-muted-foreground text-sm md:text-base leading-relaxed max-w-3xl mb-6">
              Separate real economic value from expiry carry, settlement artifacts and transaction costs — then make a disciplined decision.
            </p>

            {/* Core Value Proposition Quote */}
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 backdrop-blur-sm flex items-start gap-3 mb-8 max-w-2xl">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-amber-400 font-bold mb-0.5">
                  Core Positioning
                </div>
                <div className="text-sm md:text-base font-semibold text-foreground">
                  “The only tool that tells you when NOT to trade, and proves it.”
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="sm" className="bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-1.5 shadow-md shadow-amber-500/20">
                <a href="#judge-demo">
                  <Sparkles className="w-4 h-4" />
                  5-Minute Judge Demo
                </a>
              </Button>
              <Button asChild variant="outline" size="sm" className="gap-1.5 border-border/80">
                <a href="#xray-waterfall">
                  <Layers className="w-4 h-4 text-amber-400" />
                  X-Ray Waterfall
                </a>
              </Button>
              <Button asChild variant="outline" size="sm" className="gap-1.5 border-border/80">
                <a href="#best-vehicle">
                  <Scale className="w-4 h-4 text-amber-400" />
                  Best Vehicle
                </a>
              </Button>
              <Button asChild variant="outline" size="sm" className="gap-1.5 border-border/80">
                <a href="#backtest-lab">
                  <Database className="w-4 h-4 text-amber-400" />
                  Backtest Lab
                </a>
              </Button>
              <Button asChild variant="outline" size="sm" className="gap-1.5 border-border/80">
                <a href="#team-arceus">
                  <FileText className="w-4 h-4 text-amber-400" />
                  Team ARCEUS
                </a>
              </Button>
            </div>
          </motion.div>
        </div>

        {/* 4 Contracts Quick Ticker Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-10">
          <Card className="p-3 bg-card/60 border-border/80 hover:border-amber-500/40 transition-colors">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="font-bold text-foreground">GOLDM</span>
              <span className="text-amber-400 font-mono text-[11px]">995 Purity (22k)</span>
            </div>
            <div className="text-lg font-bold tabular-nums font-mono">₹73,510</div>
            <div className="text-[11px] text-muted-foreground flex justify-between mt-1">
              <span>100g unit · Quote/10g</span>
              <span className="text-amber-400 font-mono">≈ ₹7,320.57/g (999)</span>
            </div>
          </Card>

          <Card className="p-3 bg-card/60 border-border/80 hover:border-amber-500/40 transition-colors">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="font-bold text-foreground">GOLDTEN</span>
              <span className="text-emerald-400 font-mono text-[11px]">999 Purity (24k)</span>
            </div>
            <div className="text-lg font-bold tabular-nums font-mono">₹74,080</div>
            <div className="text-[11px] text-muted-foreground flex justify-between mt-1">
              <span>10g unit · Quote/10g</span>
              <span className="text-emerald-400 font-mono">= ₹7,408.00/g</span>
            </div>
          </Card>

          <Card className="p-3 bg-card/60 border-border/80 hover:border-amber-500/40 transition-colors">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="font-bold text-foreground">GOLDGUINEA</span>
              <span className="text-emerald-400 font-mono text-[11px]">999 Purity (24k)</span>
            </div>
            <div className="text-lg font-bold tabular-nums font-mono">₹59,250</div>
            <div className="text-[11px] text-muted-foreground flex justify-between mt-1">
              <span>8g unit · Quote/8g</span>
              <span className="text-emerald-400 font-mono">= ₹7,406.25/g</span>
            </div>
          </Card>

          <Card className="p-3 bg-card/60 border-border/80 hover:border-amber-500/40 transition-colors">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="font-bold text-foreground">GOLDPETAL</span>
              <span className="text-emerald-400 font-mono text-[11px]">999 Purity (24k)</span>
            </div>
            <div className="text-lg font-bold tabular-nums font-mono">₹7,410</div>
            <div className="text-[11px] text-muted-foreground flex justify-between mt-1">
              <span>1g unit · Quote/1g</span>
              <span className="text-emerald-400 font-mono">= ₹7,410.00/g</span>
            </div>
          </Card>
        </div>

      </div>
    </section>
  )
}
