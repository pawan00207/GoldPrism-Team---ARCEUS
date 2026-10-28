'use client'

import * as React from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, Github, Moon, Sun, Menu, X } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { TICKER_ITEMS } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

export function TickerTape() {
  const mcxGoldItems = [
    { sym: 'MCX:GOLDM', price: 73510.0, chg: 0.42 },
    { sym: 'MCX:GOLDTEN', price: 74080.0, chg: 0.38 },
    { sym: 'MCX:GOLDGUINEA', price: 59250.0, chg: 0.35 },
    { sym: 'MCX:GOLDPETAL', price: 7410.0, chg: 0.41 },
  ]
  const allItems = [...mcxGoldItems, ...TICKER_ITEMS]
  const items = [...allItems, ...allItems]

  return (
    <div className="border-y border-border bg-muted/30 overflow-hidden">
      <div className="flex items-center">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-black text-xs font-bold shrink-0 relative overflow-hidden">
          <Activity className="w-3 h-3 animate-pulse" />
          <span>COMMODITY &amp; GLOBAL DESK</span>
        </div>
        <div className="overflow-hidden flex-1">
          <div className="flex ticker-track whitespace-nowrap">
            {items.map((it, i) => {
              const isMcx = it.sym.startsWith('MCX:')
              return (
                <div key={i} className="flex items-center gap-2 px-4 py-1.5 text-xs">
                  <span className={cn('font-semibold', isMcx ? 'text-amber-400 font-bold' : '')}>
                    {it.sym}
                  </span>
                  <span className="tabular-nums text-muted-foreground font-mono">
                    {isMcx ? '₹' : ''}
                    {it.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span
                    className={cn(
                      'tabular-nums font-medium font-mono',
                      it.chg >= 0 ? 'text-emerald-500' : 'text-rose-500'
                    )}
                  >
                    {it.chg >= 0 ? '+' : ''}{it.chg.toFixed(2)}%
                  </span>
                  <span className="text-muted-foreground/40">|</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export function Navbar() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const goldLinks = [
    { href: '#xray-waterfall', label: 'X-Ray Waterfall' },
    { href: '#data-health', label: 'Data Health' },
    { href: '#best-vehicle', label: 'Best Vehicle' },
    { href: '#backtest-lab', label: 'Backtest Lab' },
    { href: '#judge-demo', label: 'Judge Demo' },
    { href: '#dashboard', label: 'Global Markets' },
    { href: '#agent', label: 'AI Agent' },
    { href: '#team-arceus', label: 'Team ARCEUS' },
  ]

  return (
    <>
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/90 backdrop-blur-md"
    >
      <div className="flex h-14 items-center px-4 gap-4 max-w-7xl mx-auto">
        <Link href="#" className="flex items-center gap-2 font-bold shrink-0">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black font-black text-sm shadow-md shadow-amber-500/20">
              ▲
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="text-base tracking-tight font-black leading-none text-foreground">
              Gold<span className="text-amber-400">Prism</span>
            </span>
            <span className="text-[10px] text-muted-foreground font-mono tracking-widest uppercase">
              By Team ARCEUS
            </span>
          </div>
        </Link>

        <nav className="hidden xl:flex items-center gap-1 text-xs font-medium">
          {goldLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="px-2.5 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="h-8 w-8"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>
          )}
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-xs hidden sm:flex">
            <a
              href="https://github.com/pawan00207/GoldPrism-Team---ARCEUS"
              target="_blank"
              rel="noreferrer"
            >
              <Github className="w-4 h-4" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </Button>
          <Button asChild size="sm" className="gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold shadow-sm hidden sm:flex">
            <a href="#judge-demo">
              <Activity className="w-3.5 h-3.5" />
              Judge Demo
            </a>
          </Button>
          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 xl:hidden"
            aria-label="Toggle menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </motion.header>

    {/* Mobile dropdown menu */}
    <AnimatePresence>
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="xl:hidden fixed top-14 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-b border-border shadow-lg"
        >
          <nav className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
            {goldLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors font-medium"
              >
                {l.label}
              </a>
            ))}
            <div className="flex gap-2 pt-2 border-t border-border mt-1">
              <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs flex-1">
                <a href="https://github.com/pawan00207/GoldPrism-Team---ARCEUS" target="_blank" rel="noreferrer">
                  <Github className="w-3.5 h-3.5" /> GitHub
                </a>
              </Button>
              <Button asChild size="sm" className="gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold flex-1" onClick={() => setMobileOpen(false)}>
                <a href="#judge-demo">
                  <Activity className="w-3.5 h-3.5" /> Judge Demo
                </a>
              </Button>
            </div>
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  )
}
