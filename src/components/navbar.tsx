'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, Github, Menu, Moon, Sun, X } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { BrandMark } from '@/components/goldprism/brand'
import { cn } from '@/lib/utils'

export function TickerTape() {
  return (
    <div className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-[1200px] items-stretch px-4">
        <div className="gp-hatch flex shrink-0 items-center border-x border-border px-3 py-2">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-foreground">
            Fixture data
          </span>
        </div>
        <div className="flex flex-1 items-center overflow-hidden">
          <div className="flex items-center gap-6 whitespace-nowrap px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            <span>
              Trading date <strong className="font-medium text-foreground">20 Mar 2026</strong>
            </span>
            <span className="text-border" aria-hidden="true">|</span>
            <span>
              Mode <strong className="font-medium text-foreground">Historical fixture</strong>
            </span>
            <span className="text-border" aria-hidden="true">|</span>
            <span>
              Quotations <strong className="font-medium text-foreground">Not live</strong>
            </span>
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
  const pathname = usePathname()
  React.useEffect(() => setMounted(true), [])

  const goldLinks = [
    { href: '/xray', label: 'X-Ray' },
    { href: '/research', label: 'Research' },
    { href: '/methodology', label: 'Methodology' },
    { href: '/workspace', label: 'Workspace' },
  ]

  const workspaceTools = [
    { href: '/workspace#dashboard', label: 'Portfolio Dashboard' },
    { href: '/workspace#agent', label: 'GoldPrism Agent' },
    { href: '/workspace#alphas', label: 'Alpha Zoo' },
    { href: '/workspace#paper-trading', label: 'Paper Trading' },
    { href: '/workspace#shadow', label: 'Shadow Account' },
    { href: '/workspace#swarm', label: 'Swarm' },
    { href: '/workspace#builder', label: 'Strategy Builder' },
  ]

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname?.startsWith(href))

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="GoldPrism home">
            <BrandMark className="h-8 w-8" />
            <div className="flex flex-col">
              <span className="font-serif text-lg font-medium leading-none tracking-tight">
                Gold<span className="gp-foil-text font-normal italic">Prism</span>
              </span>
              <span className="mt-1 font-mono text-[9px] uppercase leading-none tracking-[0.16em] text-muted-foreground">
                MCX research terminal
              </span>
            </div>
          </Link>

          <nav className="ml-4 hidden items-center gap-0.5 lg:flex" aria-label="GoldPrism sections">
            {goldLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(l.href) ? 'page' : undefined}
                className={cn(
                  'relative border-b-2 px-3 py-5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors',
                  isActive(l.href)
                    ? 'border-[var(--gp-gold-500)] text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {l.label}
              </Link>
            ))}

            {/* Workspace tools — direct links to the real, interactive features */}
            <div className="group relative">
              <button
                type="button"
                aria-haspopup="true"
                className={cn(
                  'relative flex items-center gap-1 border-b-2 border-transparent px-3 py-5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-foreground group-hover:text-foreground group-focus-within:text-foreground'
                )}
              >
                Tools
                <ChevronDown className="h-3 w-3 transition-transform duration-150 group-hover:rotate-180 group-focus-within:rotate-180" strokeWidth={2} />
              </button>
              <div
                role="menu"
                aria-label="Workspace tools"
                className="invisible absolute left-0 top-full z-50 w-60 border border-border bg-card px-2 py-2 opacity-0 shadow-[6px_6px_0_color-mix(in_srgb,var(--gp-slag-900)_28%,transparent)] transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
              >
                <p className="px-2 pb-1.5 pt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                  Workspace tools
                </p>
                {workspaceTools.map((tool) => (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    role="menuitem"
                    className="block border-l-2 border-transparent px-2 py-2 text-[11px] font-medium text-foreground/85 transition-colors hover:border-[var(--gp-gold-500)] hover:text-foreground focus-visible:border-[var(--gp-gold-500)] focus-visible:text-foreground focus-visible:outline-none"
                  >
                    {tool.label}
                  </Link>
                ))}
              </div>
            </div>
          </nav>

          <div className="flex-1" />

          <div className="flex items-center gap-1">
            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="h-10 w-10"
                aria-label={theme === 'dark' ? 'Switch to paper theme' : 'Switch to crucible theme'}
              >
                {theme === 'dark' ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button asChild variant="ghost" size="icon" className="h-10 w-10">
              <a
                href="https://github.com/pawan00207/GoldPrism-Team---ARCEUS"
                target="_blank"
                rel="noreferrer"
                aria-label="GoldPrism on GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="ml-1 hidden sm:flex">
              <Link href="/xray">Open X-Ray</Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 lg:hidden"
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
        <div className="fixed left-0 right-0 top-16 z-40 border-b border-border bg-background shadow-[0_6px_0_color-mix(in_srgb,var(--gp-slag-900)_18%,transparent)] lg:hidden">
          <nav className="mx-auto flex max-w-[1200px] flex-col px-4 py-2" aria-label="Mobile menu">
            {goldLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                aria-current={isActive(l.href) ? 'page' : undefined}
                className={cn(
                  'border-b border-border py-3.5 font-mono text-[11px] uppercase tracking-[0.12em]',
                  isActive(l.href)
                    ? 'gp-tick pl-3 text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {l.label}
              </Link>
            ))}

            <p className="border-b border-border pb-2 pt-4 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              Workspace tools
            </p>
            {workspaceTools.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                onClick={() => setMobileOpen(false)}
                className="border-b border-border py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
              >
                {tool.label}
              </Link>
            ))}
            <div className="flex gap-2 py-3">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <a
                  href="https://github.com/pawan00207/GoldPrism-Team---ARCEUS"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Github className="h-3.5 w-3.5" /> GitHub
                </a>
              </Button>
              <Button asChild size="sm" className="flex-1" onClick={() => setMobileOpen(false)}>
                <Link href="/xray">Open X-Ray</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
