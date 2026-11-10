'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  ShieldCheck,
  Hash,
  Scale,
  Sparkles,
  Layers,
  Database,
  FileText,
  TrendingUp,
  TrendingDown,
  Activity,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const CONTRACT_CARDS = [
  {
    sym: 'GOLDM',
    purity: '995 · 22k',
    purityClass: 'text-amber-400',
    price: 73510,
    pricePerG: 7320.57,
    unit: '100g · Quote/10g',
    chg: +0.42,
    border: 'hover:border-amber-400/60',
    glow: 'hover:shadow-amber-500/10',
  },
  {
    sym: 'GOLDTEN',
    purity: '999 · 24k',
    purityClass: 'text-emerald-400',
    price: 74080,
    pricePerG: 7408.0,
    unit: '10g · Quote/10g',
    chg: +0.38,
    border: 'hover:border-emerald-400/50',
    glow: 'hover:shadow-emerald-500/10',
  },
  {
    sym: 'GOLDGUINEA',
    purity: '999 · 24k',
    purityClass: 'text-emerald-400',
    price: 59250,
    pricePerG: 7406.25,
    unit: '8g · Quote/8g',
    chg: +0.35,
    border: 'hover:border-emerald-400/50',
    glow: 'hover:shadow-emerald-500/10',
  },
  {
    sym: 'GOLDPETAL',
    purity: '999 · 24k',
    purityClass: 'text-emerald-400',
    price: 7410,
    pricePerG: 7410.0,
    unit: '1g · Quote/1g',
    chg: +0.41,
    border: 'hover:border-emerald-400/50',
    glow: 'hover:shadow-emerald-500/10',
  },
]

const STATS = [
  { label: 'Integrity Gates', value: '6', sub: 'All pass', color: 'text-emerald-400' },
  { label: 'Contracts Tracked', value: '4', sub: 'MCX Gold', color: 'text-amber-400' },
  { label: 'Spread Layers', value: '4', sub: 'X-Ray depth', color: 'text-amber-400' },
  { label: 'Walk-Forward Runs', value: '24', sub: 'Backtest', color: 'text-foreground' },
]

export function GoldPrismHeader() {
  return (
    <section className="relative overflow-hidden pt-14 pb-12 border-b border-border/60 bg-gradient-to-b from-amber-500/5 via-background to-background">
      {/* Ambient glow blobs */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-amber-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 max-w-7xl relative z-10">

        {/* Top badges bar */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-wrap items-center justify-between gap-3 mb-8"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 gap-1.5 py-1 px-3 text-xs">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Hack in Hills '26 · Track 03: Commodity Derivatives Intelligence
            </Badge>
            <Badge variant="outline" className="text-muted-foreground border-border/80 gap-1 text-xs">
              <Scale className="w-3 h-3 text-amber-400" /> Team ARCEUS
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span className="px-2 py-0.5 rounded bg-muted/60 border border-border/60 flex items-center gap-1">
              <Hash className="w-3 h-3 text-amber-400" />
              RUN: <span className="text-foreground font-semibold ml-1">GP-A84F2B01</span>
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              DATA INTEGRITY: VERIFIED
            </span>
          </div>
        </motion.div>

        {/* Hero Title */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 items-start">
          <div className="lg:col-span-3">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/25 text-black font-black text-2xl shrink-0">
                  ▲
                </div>
                <div>
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-foreground leading-none">
                    Gold<span className="text-amber-400">Prism</span>
                  </h1>
                  <span className="text-xs uppercase tracking-widest px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/30 text-amber-300 font-semibold mt-1 inline-block">
                    MCX Quantitative Research Terminal
                  </span>
                </div>
              </div>

              <p className="text-xl md:text-2xl font-semibold text-amber-300/90 mb-3 tracking-tight">
                Prism That Explains Scattered Gold
              </p>
              <p className="text-muted-foreground text-sm md:text-base leading-relaxed max-w-2xl mb-6">
                Separate real economic value from expiry carry, settlement artifacts and transaction costs — then make a disciplined decision.
              </p>

              {/* Core positioning callout */}
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 backdrop-blur-sm flex items-start gap-3 mb-8 max-w-xl">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-amber-400 font-bold mb-0.5">Core Positioning</div>
                  <div className="text-sm md:text-base font-semibold text-foreground">
                    "The only tool that tells you when NOT to trade, and proves it."
                  </div>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild size="sm" className="bg-amber-500 hover:bg-amber-600 text-black font-bold gap-1.5 shadow-md shadow-amber-500/20 transition-all hover:scale-105">
                  <a href="#judge-demo">
                    <Sparkles className="w-4 h-4" />
                    5-Minute Judge Demo
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm" className="gap-1.5 border-border/80 hover:border-amber-500/40 hover:bg-amber-500/5 transition-all">
                  <a href="#xray-waterfall">
                    <Layers className="w-4 h-4 text-amber-400" />
                    X-Ray Waterfall
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm" className="gap-1.5 border-border/80 hover:border-amber-500/40 hover:bg-amber-500/5 transition-all">
                  <a href="#best-vehicle">
                    <Scale className="w-4 h-4 text-amber-400" />
                    Best Vehicle
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm" className="gap-1.5 border-border/80 hover:border-amber-500/40 hover:bg-amber-500/5 transition-all">
                  <a href="#backtest-lab">
                    <Database className="w-4 h-4 text-amber-400" />
                    Backtest Lab
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm" className="gap-1.5 border-border/80 hover:border-amber-500/40 hover:bg-amber-500/5 transition-all">
                  <a href="#team-arceus">
                    <FileText className="w-4 h-4 text-amber-400" />
                    Team ARCEUS
                  </a>
                </Button>
              </div>
            </motion.div>
          </div>

          {/* Right side: live stats panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="lg:col-span-2 grid grid-cols-2 gap-3"
          >
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className="p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm hover:border-amber-500/30 transition-all duration-300"
              >
                <div className={cn('text-3xl font-black tabular-nums font-mono', s.color)}>{s.value}</div>
                <div className="text-xs font-semibold text-foreground mt-0.5">{s.label}</div>
                <div className="text-[11px] text-muted-foreground">{s.sub}</div>
              </div>
            ))}
            <div className="col-span-2 p-3 rounded-xl border border-border/60 bg-card/60 flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
              <span className="text-xs text-muted-foreground">
                <span className="text-foreground font-semibold">LIVE DEMO MODE</span> — Illustrative MCX data. Not a live market feed.
              </span>
            </div>
          </motion.div>
        </div>

        {/* 4 Contract Ticker Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-10">
          {CONTRACT_CARDS.map((c, i) => (
            <motion.div
              key={c.sym}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 + i * 0.07 }}
              whileHover={{ y: -2, transition: { duration: 0.15 } }}
            >
              <Card className={cn(
                'p-3 bg-card/60 border-border/80 transition-all duration-200 cursor-default group shadow-sm',
                c.border,
                'hover:shadow-lg',
                c.glow,
              )}>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span className="font-black text-foreground tracking-tight group-hover:text-amber-400 transition-colors">{c.sym}</span>
                  <span className={cn('font-mono text-[10px] font-semibold', c.purityClass)}>{c.purity}</span>
                </div>
                <div className="text-xl font-black tabular-nums font-mono">
                  ₹{c.price.toLocaleString('en-IN')}
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className={cn(
                    'text-xs font-semibold flex items-center gap-0.5 tabular-nums',
                    c.chg >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  )}>
                    {c.chg >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {c.chg >= 0 ? '+' : ''}{c.chg.toFixed(2)}%
                  </span>
                  <span className="text-[10px] text-amber-400 font-mono font-semibold">
                    ₹{c.pricePerG.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/g
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground/60 mt-1 font-mono">{c.unit}</div>
              </Card>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  )
}
