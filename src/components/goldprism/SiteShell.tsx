import type { ReactNode } from 'react'
import { Footer } from '@/components/sections/footer'
import { Navbar, TickerTape } from '@/components/navbar'
import { SpectralRule } from '@/components/goldprism/brand'
import { LivePageBadge } from '@/components/goldprism/LivePageBadge'
import { FloatingTradeCopilot } from '@/components/goldprism/TradeCopilotChat'

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <TickerTape />
      <main className="flex-1">{children}</main>
      <Footer />
      <FloatingTradeCopilot />
    </div>
  )
}

export function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <section className="border-b border-border bg-card/50">
      <div className="mx-auto max-w-[1360px] px-4 py-8 md:py-10">
        <div className="grid items-end gap-6 lg:grid-cols-[minmax(0,61.8%)_minmax(0,38.2%)]">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <p className="gp-kicker">{eyebrow}</p>
              <LivePageBadge />
            </div>
            <h1 className="gp-title mt-2.5 text-balance">
              {title}
            </h1>
            <SpectralRule className="mt-4 max-w-sm" />
          </div>
          <p className="gp-clerk max-w-xl lg:justify-self-end">
            {description}
          </p>
        </div>
      </div>
    </section>
  )
}
