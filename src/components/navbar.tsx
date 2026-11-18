'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LogIn,
  Menu,
  Moon,
  RefreshCw,
  Sun,
  UserCheck,
  X,
  Zap,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { BrandMark } from '@/components/goldprism/brand'
import { useLiveFeed } from '@/components/goldprism/LiveFeedProvider'
import { inr } from '@/lib/goldprism/format'
import { cn } from '@/lib/utils'

export function TickerTape() {
  const { feed, loading, refreshing, refreshFeed, tickCount } = useLiveFeed()
  const isLive = feed?.status === 'LIVE_PARITY'
  const b = feed?.benchmarks

  return (
    <div className="border-b border-border bg-[var(--gp-vellum)]/70 dark:bg-card">
      <div className="mx-auto flex max-w-[1360px] items-stretch px-4">
        <button
          type="button"
          onClick={() => refreshFeed(true)}
          title="Refresh live parity market feed"
          className={cn(
            'flex shrink-0 items-center gap-2 border-r border-border pr-3.5 py-1.5 transition-colors hover:text-[var(--gp-gold-ink)]',
            !isLive && 'opacity-80'
          )}
        >
          <span
            className={cn(
              'inline-block h-2 w-2 rounded-[2px]',
              isLive
                ? 'bg-[var(--gp-tradable-ink)]'
                : 'bg-[var(--gp-meta-ink)]'
            )}
            aria-hidden="true"
          />
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.11em] text-foreground whitespace-nowrap">
            {isLive
              ? `Live parity · 10s (#${tickCount})`
              : loading
              ? 'Connecting'
              : 'Feed offline'}
          </span>
          <RefreshCw
            className={cn('h-3 w-3 text-muted-foreground', refreshing && 'animate-spin')}
            aria-hidden="true"
          />
        </button>

        <div className="flex flex-1 items-center overflow-x-auto scrollbar-thin">
          <div className="flex items-center gap-5 whitespace-nowrap px-4 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.09em] text-muted-foreground">
            {isLive && b ? (
              <>
                <span>
                  XAU/USD{' '}
                  <strong className="font-semibold text-foreground">
                    {b.xauUsd !== null ? `$${b.xauUsd.toFixed(2)}` : 'N/A'}
                  </strong>
                </span>
                <span className="text-border" aria-hidden="true">·</span>
                <span>
                  COMEX GC=F{' '}
                  <strong className="font-semibold text-foreground">
                    {b.comexGcUsd !== null ? `$${b.comexGcUsd.toFixed(2)}` : 'N/A'}
                  </strong>
                </span>
                <span className="text-border" aria-hidden="true">·</span>
                <span>
                  USD/INR{' '}
                  <strong className="font-semibold text-foreground">
                    {b.usdInr !== null ? `₹${b.usdInr.toFixed(2)}` : 'N/A'}
                  </strong>
                </span>
                <span className="text-border" aria-hidden="true">·</span>
                <span>
                  MCX 10g Parity{' '}
                  <strong className="font-semibold text-[var(--gp-gold-ink)]">
                    {b.landedSpotParity10gInr !== null
                      ? inr(b.landedSpotParity10gInr, 0)
                      : 'N/A'}
                  </strong>
                </span>
                <span className="text-border" aria-hidden="true">·</span>
                <span>
                  GOLDBEES{' '}
                  <strong className="font-semibold text-foreground">
                    {b.goldBeesInr !== null ? `₹${b.goldBeesInr.toFixed(2)}` : 'N/A'}
                  </strong>
                </span>
                <span className="text-border" aria-hidden="true">·</span>
                <span>
                  As of{' '}
                  <strong className="font-medium text-foreground">
                    {feed.asOf.slice(0, 19).replace('T', ' ')} UTC
                  </strong>
                </span>
              </>
            ) : (
              <span>
                {loading
                  ? 'Fetching live XAU/USD, COMEX GC=F, USD/INR & GOLDBEES.NS…'
                  : `Live parity feed unavailable (${feed?.error ?? 'upstream unreachable'}). Historical 18M Bhavcopy archive active.`}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function Navbar() {
  const { resolvedTheme, setTheme } = useTheme()
  const { user, authBusy, signInWithGoogle } = useLiveFeed()
  const [mounted, setMounted] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const pathname = usePathname()
  React.useEffect(() => setMounted(true), [])

  const goldLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/xray', label: 'X-Ray' },
    { href: '/normalization', label: 'Normalize' },
    { href: '/replay', label: 'Replay' },
    { href: '/research', label: 'Research' },
    { href: '/analyst', label: 'Analyst' },
  ]

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname?.startsWith(href))

  const isDark = mounted && resolvedTheme === 'dark'

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1360px] items-center justify-between gap-6 px-4">
          {/* Zone 1: Clean single-line wordmark */}
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 whitespace-nowrap"
            aria-label="GoldPrism home"
          >
            <BrandMark className="h-6 w-6 shrink-0" tone={isDark ? 'dark' : 'paper'} />
            <span className="font-serif text-lg font-semibold leading-none tracking-tight text-foreground">
              Gold<span className="gp-gold-text">Prism</span>
            </span>
          </Link>

          {/* Zone 2: Concise single-line navigation links */}
          <nav
            className="hidden items-center gap-6 lg:flex"
            aria-label="GoldPrism primary navigation"
          >
            {goldLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(l.href) ? 'page' : undefined}
                className={cn(
                  'relative shrink-0 whitespace-nowrap border-b-2 py-4 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors',
                  isActive(l.href)
                    ? 'border-[var(--gp-gold-500)] font-semibold text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Zone 3: Theme + Account + Primary CTA */}
          <div className="flex shrink-0 items-center gap-2">
            {mounted ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className="h-8 w-8 shrink-0 rounded-[4px]"
                title={isDark ? 'Switch to Ivory (Light) theme' : 'Switch to Charcoal (Dark) theme'}
                aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            ) : null}

            {user ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="hidden h-8 shrink-0 rounded-[4px] whitespace-nowrap sm:inline-flex"
              >
                <Link href="/dashboard" className="inline-flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-[var(--gp-tradable-ink)]" />
                  <span className="max-w-[96px] truncate">
                    {user.displayName?.split(' ')[0] || 'Account'}
                  </span>
                </Link>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={authBusy}
                onClick={() => void signInWithGoogle()}
                className="hidden h-8 shrink-0 rounded-[4px] whitespace-nowrap sm:inline-flex"
              >
                <LogIn className="h-3.5 w-3.5" />
                {authBusy ? 'Signing in…' : 'Sign In'}
              </Button>
            )}

            <Button
              asChild
              size="sm"
              className="hidden h-8 shrink-0 rounded-[4px] whitespace-nowrap sm:inline-flex"
            >
              <Link href="/trade" className="inline-flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                1-Click Trade
              </Link>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 lg:hidden"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed left-0 right-0 top-14 z-40 border-b border-border bg-background shadow-[var(--gp-hard-shadow)] lg:hidden">
          <nav className="mx-auto flex max-w-[1360px] flex-col px-4 py-2" aria-label="Mobile menu">
            {goldLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                aria-current={isActive(l.href) ? 'page' : undefined}
                className={cn(
                  'border-b border-border py-3 font-mono text-[11px] uppercase tracking-[0.12em]',
                  isActive(l.href)
                    ? 'font-semibold text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {l.label}
              </Link>
            ))}
            <div className="flex gap-2 py-3">
              {user ? (
                <Button asChild variant="outline" size="sm" className="flex-1" onClick={() => setMobileOpen(false)}>
                  <Link href="/dashboard">My Dashboard</Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setMobileOpen(false)
                    void signInWithGoogle()
                  }}
                >
                  Sign In
                </Button>
              )}
              <Button asChild size="sm" className="flex-1" onClick={() => setMobileOpen(false)}>
                <Link href="/trade">1-Click Trade</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
