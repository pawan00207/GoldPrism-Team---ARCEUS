import Link from 'next/link'
import {
  ArrowRight,
  ArrowUpRight,
  FileCheck2,
  ScanLine,
  Scale,
  ShieldCheck,
} from 'lucide-react'
import { SiteShell } from '@/components/goldprism/SiteShell'
import { VaultHero } from '@/components/goldprism/VaultHero'
import { Reveal } from '@/components/goldprism/Reveal'
import { TodayLiveIntelligence } from '@/components/goldprism/TodayLiveIntelligence'
import { TokenizedGoldHome } from '@/components/goldprism/TokenizedGoldHome'

const SEQUENCE = [
  {
    index: '01',
    href: '/research#data-health',
    icon: FileCheck2,
    title: 'Validate the file',
    body: 'Hash, schema, date-match and duplicate gates. Nothing trades until the data is proven.',
  },
  {
    index: '02',
    href: '/normalization',
    icon: Scale,
    title: 'Normalize to 999',
    body: 'Convert 100g·995, 1g, 8g and 10g onto one pure-gold scale before any spread is computed.',
  },
  {
    index: '03',
    href: '/xray',
    icon: ScanLine,
    title: 'Name the structure',
    body: 'Basis, expiry carry, settlement artifact — each component charged, reconciled to 0.01 ₹/g.',
  },
  {
    index: '04',
    href: '/trade',
    icon: ShieldCheck,
    title: 'Refuse or trade',
    body: 'Full statutory cost first. If the residual does not survive, the verdict is NO EDGE.',
  },
]

export default function Home() {
  return (
    <SiteShell>
      <TokenizedGoldHome />
      <VaultHero />
      <TodayLiveIntelligence />

      {/* The audit sequence */}
      <section className="border-b border-border bg-background">
        <div className="gp-container py-14 lg:py-16">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                The sequence
              </p>
              <h2
                className="mt-3 font-serif text-3xl font-medium leading-tight text-foreground sm:text-4xl"
                style={{ fontVariationSettings: '"SOFT" 40, "opsz" 60' }}
              >
                Four steps, in order,<br />
                <span className="italic font-normal text-[var(--gp-caramel)]">no shortcuts.</span>
              </h2>
            </div>
            <Link
              href="/methodology"
              className="group inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
            >
              Read the full method
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>

          <ol className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {SEQUENCE.map((step) => {
              const Icon = step.icon
              return (
                <li key={step.index} className="bg-card transition-colors hover:bg-[var(--gp-vellum)] dark:hover:bg-[#2a2018]">
                  <Link href={step.href} className="group flex h-full flex-col gap-8 p-6">
                    <div className="flex items-center justify-between">
                      <span
                        className="font-serif text-3xl font-normal text-border transition-colors duration-300 group-hover:text-[var(--gp-caramel)]"
                        style={{ fontVariationSettings: '"SOFT" 100, "opsz" 80' }}
                      >
                        {step.index}
                      </span>
                      <Icon className="h-5 w-5 text-muted-foreground transition-colors duration-300 group-hover:text-[var(--gp-caramel)]" aria-hidden="true" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="font-serif text-xl text-foreground">{step.title}</p>
                      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                        {step.body}
                      </p>
                    </div>
                    <span className="mt-auto inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/80 transition-colors group-hover:text-[var(--gp-caramel)]">
                      Open <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      {/* Closing band */}
      <section className="border-b border-border bg-[var(--gp-vellum)]/40 dark:bg-[#1a1512]">
        <Reveal>
          <div className="gp-container flex flex-col items-center gap-6 py-14 text-center lg:py-20">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Verdict before velocity
            </p>
            <h2
              className="max-w-3xl text-balance font-serif text-3xl font-medium leading-tight text-foreground sm:text-5xl"
              style={{ fontVariationSettings: '"SOFT" 50, "opsz" 100' }}
            >
              If the answer is not trade,<br />
              <span className="italic font-normal text-[var(--gp-caramel)]">it cannot be trade.</span>
            </h2>
            <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground">
              Walk any historical day — watch the gate fire, the carry close, and the
              costs keep what was never yours.
            </p>
            <Link
              href="/replay"
              className="group inline-flex h-12 items-center gap-2 rounded-md bg-[var(--gp-caramel)] px-7 font-mono text-[11px] uppercase tracking-[0.16em] text-[#141010] transition-all hover:bg-[#e8bd8a]"
            >
              Watch the gate fire
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
      </section>
    </SiteShell>
  )
}
