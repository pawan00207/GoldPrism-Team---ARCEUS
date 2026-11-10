import type { ReactNode } from 'react'
import { Footer } from '@/components/sections/footer'
import { Navbar, TickerTape } from '@/components/navbar'
import { DataTag, SpectralRule } from '@/components/goldprism/brand'

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <TickerTape />
      <main className="flex-1">{children}</main>
      <Footer />
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
    <section className="relative overflow-hidden border-b border-border bg-background">
      <div className="gp-register-mark gp-register-mark--top" aria-hidden="true" />
      <div className="gp-container py-[var(--gp-space-5)] md:py-[var(--gp-space-6)]">
        <div className="gp-split items-end">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3">
              <p className="gp-kicker">{eyebrow}</p>
              <DataTag synthetic detail="not live" />
            </div>
            <h1 className="gp-title mt-4 text-balance">
              {title}
            </h1>
            <SpectralRule className="mt-6 max-w-md" />
          </div>
          <p className="gp-clerk max-w-xl text-base lg:justify-self-end">
            {description}
          </p>
        </div>
      </div>
    </section>
  )
}
