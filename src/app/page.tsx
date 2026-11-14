import Link from 'next/link'
import { ArrowRight, BookOpen, FlaskConical, Layers3, Wrench } from 'lucide-react'
import { GoldPrismHeader } from '@/components/goldprism/GoldPrismHeader'
import { SiteShell } from '@/components/goldprism/SiteShell'
import { SpectralRule } from '@/components/goldprism/brand'
import { Reveal } from '@/components/goldprism/Reveal'

const pathways = [
  {
    href: '/xray',
    icon: Layers3,
    index: '01',
    eyebrow: 'Decision surface',
    title: 'X-Ray the spread',
    description: 'Decompose a raw contract gap into basis, carry, settlement artifact, costs, and net edge.',
  },
  {
    href: '/research',
    icon: FlaskConical,
    index: '02',
    eyebrow: 'Market structure',
    title: 'Inspect the evidence',
    description: 'Review contract normalization, data quality, vehicle matching, term structure, and backtest context.',
  },
  {
    href: '/methodology',
    icon: BookOpen,
    index: '03',
    eyebrow: 'Audit trail',
    title: 'Read the method',
    description: 'Understand the checks, provenance, reconciliation rules, and exportable research record.',
  },
  {
    href: '/workspace',
    icon: Wrench,
    index: '04',
    eyebrow: 'Research workspace',
    title: 'Build from the evidence',
    description: 'Use the preserved dashboards, factor research, paper trading, agents, and strategy tools.',
  },
]

export default function Home() {
  return (
    <SiteShell>
      <GoldPrismHeader />
      <section className="border-b border-border bg-background">
        <div className="gp-container py-[var(--gp-space-5)] md:py-[var(--gp-space-6)]">
          <Reveal y={6}>
            <div className="flex flex-col gap-[var(--gp-space-3)] border-b border-border pb-[var(--gp-space-4)] lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="gp-kicker">A quiet research interface</p>
                <h2 className="gp-title mt-3 text-balance">
                  Start with the question, not the dashboard.
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground lg:text-right">
                GoldPrism is organized as a sequence of evidence surfaces so each decision has a
                clear place to live.
              </p>
            </div>
          </Reveal>

          <div className="mt-[var(--gp-space-4)] grid gap-px border border-border bg-border md:grid-cols-2">
            {pathways.map((pathway, index) => {
              const Icon = pathway.icon
              return (
                <Reveal key={pathway.href} className="h-full" delay={index * 0.07}>
                  <Link
                    href={pathway.href}
                    className="group relative flex h-full min-h-[15rem] flex-col justify-between bg-card p-6 transition-colors hover:bg-[var(--gp-gold-50)] dark:hover:bg-[var(--gp-gold-900)]"
                  >
                  <div className="flex items-start justify-between gap-5">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground">
                        {pathway.index}
                      </span>
                      <span className="h-px w-8 bg-border" aria-hidden="true" />
                      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                        {pathway.eyebrow}
                      </span>
                    </div>
                    <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </div>

                  <div className="mt-8">
                    <h3 className="gp-subhead">{pathway.title}</h3>
                    <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                      {pathway.description}
                    </p>
                    <SpectralRule className="mt-5" />
                    <span className="mt-4 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition-colors group-hover:text-foreground">
                      Open surface
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>
    </SiteShell>
  )
}
