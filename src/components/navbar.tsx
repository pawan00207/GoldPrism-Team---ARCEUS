'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowRight,
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
import { FirebaseAuthNotice } from '@/components/goldprism/FirebaseAuthNotice'
import { Mascot } from '@/components/goldprism/Mascot'
import { useLiveFeed } from '@/components/goldprism/LiveFeedProvider'
import { useGoldMarket } from '@/hooks/use-gold-market'
import { pricePerGramInr } from '@/lib/goldprism/gold-market'
import { inr } from '@/lib/goldprism/format'
import { cn } from '@/lib/utils'

export function TickerTape() {
  const { feed, mcxSnapshot, loading, refreshing, refreshFeed, tickCount } = useLiveFeed()
  const goldMarket = useGoldMarket()
  const isLive = feed?.status === 'LIVE_PARITY'
  const mcxLive = mcxSnapshot?.status === 'MCX_LIVE'
  const mcxStale = mcxSnapshot?.status === 'MCX_STALE'
  const hasMcxSnapshot = mcxLive || mcxStale
  const b = feed?.benchmarks
  const tokenQuotes = goldMarket.status === 'live' ? goldMarket.data : null

  const tapeItems = (
    <>
      {hasMcxSnapshot && mcxSnapshot?.spot ? (
        <>
          <span>
            GOLD SPOT{' '}
            <strong className="font-semibold text-[var(--gp-caramel)]">
              ₹{Number(mcxSnapshot.spot.price).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </strong>
          </span>
          <Dot />
        </>
      ) : null}
      {hasMcxSnapshot && mcxSnapshot?.contracts?.GOLDM?.[0] ? (
        <>
          <span>
            GOLDM {mcxSnapshot.contracts.GOLDM[0].expiryDate}{' '}
            <strong className="font-semibold text-foreground">
              ₹{Number(mcxSnapshot.contracts.GOLDM[0].close).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </strong>
          </span>
          <Dot />
        </>
      ) : null}
      {tokenQuotes ? (
        <>
          <span>
            PAXG / G{' '}
            <strong className="font-semibold text-[var(--gp-caramel)]">
              ₹{pricePerGramInr(tokenQuotes.paxg.inr).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </strong>
          </span>
          <Dot />
          <span>
            XAUT / G{' '}
            <strong className="font-semibold text-[var(--gp-caramel)]">
              ₹{pricePerGramInr(tokenQuotes.xaut.inr).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </strong>
          </span>
          <Dot />
          <span>
            USD/INR{' '}
            <strong className="font-medium text-foreground">{tokenQuotes.usdInr.toFixed(2)}</strong>
          </span>
          <Dot />
        </>
      ) : (
        <>
          <span>{goldMarket.status === 'error' ? 'PAXG / XAUT fetching live · retrying' : 'Fetching live PAXG / XAUT quotes…'}</span>
          <Dot />
        </>
      )}
      {isLive && b ? (
        <>
          <span>
            XAU/USD{' '}
            <strong className="font-medium text-foreground">{b.xauUsd !== null ? `$${b.xauUsd.toFixed(0)}` : 'N/A'}</strong>
          </span>
          <Dot />
          <span>
            COMEX{' '}
            <strong className="font-medium text-foreground">{b.comexGcUsd !== null ? `$${b.comexGcUsd.toFixed(0)}` : 'N/A'}</strong>
          </span>
          <Dot />
          <span>
            USD/INR{' '}
            <strong className="font-medium text-foreground">{b.usdInr !== null ? b.usdInr.toFixed(2) : 'N/A'}</strong>
          </span>
          <Dot />
          <span>
            10g PARITY{' '}
            <strong className="font-medium text-foreground">
              {b.landedSpotParity10gInr !== null ? inr(b.landedSpotParity10gInr, 0) : 'N/A'}
            </strong>
          </span>
          <Dot />
          <span>
            GOLDBEES{' '}
            <strong className="font-medium text-foreground">{b.goldBeesInr !== null ? `₹${b.goldBeesInr.toFixed(2)}` : 'N/A'}</strong>
          </span>
        </>
      ) : (
        <span>
          {loading
            ? 'Fetching benchmark tape…'
            : 'Benchmark feed unreachable — historical 18-month bhavcopy archive active.'}
        </span>
      )}
    </>
  )

  return (
    <div className="border-b border-border/80 bg-[var(--gp-vellum)]/60 backdrop-blur-sm dark:bg-[#1a1512]">
      <div className="mx-auto flex max-w-[1360px] items-stretch px-4">
        <button
          type="button"
          onClick={() => refreshFeed(true)}
          title="Refresh live market feed"
          className="group flex shrink-0 items-center gap-2 border-r border-border/70 py-2 pl-0 pr-4 transition-colors hover:text-[var(--gp-caramel)]"
        >
          <span
            className={cn(
              'inline-block h-1.5 w-1.5 rounded-full',
              mcxLive || isLive
                ? 'animate-pulse bg-[var(--gp-tradable-ink)]'
                : 'bg-[var(--gp-meta-ink)]'
            )}
            aria-hidden="true"
          />
          <span className="whitespace-nowrap font-mono text-[10px] font-medium uppercase tracking-[0.13em] text-foreground">
            {mcxLive
              ? 'MCX live'
              : mcxStale
                ? 'MCX stale'
              : isLive
                ? `Live parity #${tickCount}`
                : loading
                  ? 'Connecting'
                  : 'Feed offline'}
          </span>
          <RefreshCw
            className={cn('h-3 w-3 text-muted-foreground transition-colors group-hover:text-foreground', refreshing && 'animate-spin')}
            aria-hidden="true"
          />
        </button>

        <div className="ticker-viewport flex min-w-0 flex-1 items-center overflow-hidden">
          <div className="ticker-track flex w-max">
            {[0, 1].map((copy) => (
              <div
                key={copy}
                aria-hidden={copy === 1}
                className="flex shrink-0 items-center gap-5 whitespace-nowrap py-2 pl-4 pr-5 font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground"
              >
                {tapeItems}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Dot() {
  return <span className="text-border/80" aria-hidden="true">·</span>
}

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/xray', label: 'X-Ray' },
  { href: '/replay', label: 'Replay' },
  { href: '/analyst', label: 'Analyst' },
  { href: '/trade', label: 'Trade' },
  { href: '/market', label: 'Market' },
  { href: '/wallet', label: 'Wallet' },
  { href: '/research', label: 'Research' },
]

export function Navbar() {
  const { resolvedTheme, setTheme } = useTheme()
  const { user, authBusy, authError, signInWithGoogle } = useLiveFeed()
  const [mounted, setMounted] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const pathname = usePathname()
  React.useEffect(() => setMounted(true), [])
  React.useEffect(() => setMobileOpen(false), [pathname])

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname?.startsWith(href))

  const isDark = mounted && resolvedTheme === 'dark'

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/85 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-[1360px] items-center justify-between gap-6 px-4 sm:px-6">
          {/* Wordmark */}
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-2.5 whitespace-nowrap"
            aria-label="GoldPrism home"
          >
            <Mascot className="h-9 w-9 shrink-0 object-contain transition-transform duration-500 group-hover:scale-110" tone={isDark ? 'dark' : 'paper'} />
            <span
              className="font-serif text-[1.35rem] font-medium leading-none tracking-[-0.01em] text-foreground"
              style={{ fontVariationSettings: '"SOFT" 50, "opsz" 30' }}
            >
              Gold<span className="gp-foil-text font-normal italic">Prism</span>
            </span>
          </Link>

          {/* Primary navigation */}
          <nav
            className="hidden items-center gap-1 lg:flex"
            aria-label="GoldPrism primary navigation"
          >
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(l.href) ? 'page' : undefined}
                className={cn(
                  'group relative rounded-md px-3 py-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] transition-colors',
                  isActive(l.href)
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {l.label}
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute inset-x-3 -bottom-px h-px origin-left bg-[var(--gp-caramel)] transition-transform duration-300',
                    isActive(l.href) ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                  )}
                />
              </Link>
            ))}
          </nav>

          {/* Trailing actions */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {mounted ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className="h-9 w-9 rounded-md"
                title={isDark ? 'Switch to Assay (light) theme' : 'Switch to Vault (dark) theme'}
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
                className="hidden h-9 rounded-md sm:inline-flex"
              >
                <Link href="/dashboard" className="inline-flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-[var(--gp-tradable-ink)]" />
                  <span className="max-w-[96px] truncate">
                    {user.displayName?.split(' ')[0] || 'Desk'}
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
                className="hidden h-9 rounded-md sm:inline-flex"
              >
                <LogIn className="h-3.5 w-3.5" />
                {authBusy ? 'Signing in…' : 'Sign in'}
              </Button>
            )}

            <Button
              asChild
              size="sm"
              className="hidden h-9 rounded-md bg-[var(--gp-slag-900)] px-4 font-medium text-[var(--gp-paper)] hover:bg-[var(--gp-caramel)] hover:text-[#141010] sm:inline-flex dark:bg-[var(--gp-caramel)] dark:text-[#141010] dark:hover:bg-[#e8bd8a]"
            >
              <Link href="/trade" className="inline-flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                1-Click Trade
              </Link>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-md lg:hidden"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      {authError ? (
        <div className="mx-auto max-w-[1360px] px-4 sm:px-6" role="status" aria-live="polite">
          <FirebaseAuthNotice message={authError} />
        </div>
      ) : null}

      {mobileOpen && (
        <div className="fixed left-0 right-0 top-16 z-40 border-b border-border bg-background/98 shadow-[var(--gp-hard-shadow)] backdrop-blur-lg lg:hidden">
          <nav className="mx-auto flex max-w-[1360px] flex-col px-4 py-3" aria-label="Mobile menu">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                aria-current={isActive(l.href) ? 'page' : undefined}
                className={cn(
                  'rounded-md border-b border-border/60 py-3.5 font-mono text-[11px] uppercase tracking-[0.14em] last:border-0',
                  isActive(l.href)
                    ? 'font-semibold text-[var(--gp-caramel)]'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {l.label}
              </Link>
            ))}
            <div className="flex gap-2 pb-2 pt-3">
              {user ? (
                <Button asChild variant="outline" size="sm" className="flex-1 rounded-md" onClick={() => setMobileOpen(false)}>
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-md"
                  onClick={() => {
                    setMobileOpen(false)
                    void signInWithGoogle()
                  }}
                >
                  Sign in
                </Button>
              )}
              <Button asChild size="sm" className="flex-1 rounded-md" onClick={() => setMobileOpen(false)}>
                <Link href="/trade" className="inline-flex items-center justify-center gap-1.5">
                  1-Click Trade <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
