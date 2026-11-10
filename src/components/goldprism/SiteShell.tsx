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
      <div className="mx-auto max-w-[1200px] px-4 py-14 md:py-20">
        <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,61.8%)_minmax(0,38.2%)]">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3">
              <p className="gp-kicker">{eyebrow}</p>
              <DataTag synthetic detail="not live" />
            </div>
            <h1 className="gp-title mt-4 text-balance text-[2.125rem] md:text-[2.625rem]">
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
