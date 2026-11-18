import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  Bot,
  FlaskConical,
  History,
  Layers3,
  Scale,
  Wrench,
  Zap,
} from 'lucide-react'
import { GoldPrismHeader } from '@/components/goldprism/GoldPrismHeader'
import { HomeFeaturesShowcase } from '@/components/goldprism/HomeFeaturesShowcase'
import { SiteShell } from '@/components/goldprism/SiteShell'
import { SpectralRule } from '@/components/goldprism/brand'

const pathways = [
  {
    href: '/xray',
    icon: Layers3,
    index: '01',
    eyebrow: 'Decision surface',
    title: 'X-Ray the spread',
    description:
      'Decompose a live or historical gap into basis, carry, settlement artifact, statutory costs, and net edge — then execute in 1 click.',
  },
  {
    href: '/trade',
    icon: Zap,
    index: '02',
    eyebrow: 'One-click execution',
    title: 'Trade & hedge in one click',
    description:
      'See every contract gram, margin block, statutory fee, and X-Ray verdict in plain English before clicking Execute, with live MTM P&L.',
  },
  {
    href: '/normalization',
    icon: Scale,
    index: '03',
    eyebrow: 'Equivalence engine',
    title: 'Normalize 4 MCX contracts',
    description:
      'Convert 1g, 8g, 10g, and 100g contracts across 995 and 999 purity onto one 10g pure-gold scale using live parity or Bhavcopy.',
  },
  {
    href: '/replay',
    icon: History,
    index: '04',
    eyebrow: 'Zero look-ahead audit',
    title: 'Replay point-in-time history',
    description:
      'Pick any date in the 18-month MCX Bhavcopy archive and inspect only information strictly known on or before that timestamp.',
  },
  {
    href: '/analyst',
    icon: Bot,
    index: '05',
    eyebrow: 'Grounded co-pilot',
    title: 'Ask the Research Analyst',
    description:
      'Deterministic tool-calling quant analyst grounded strictly in verified Bhavcopy data, X-Ray outputs, and MCX contract specs.',
  },
  {
    href: '/research',
    icon: FlaskConical,
    index: '06',
    eyebrow: 'Market structure',
    title: 'Inspect the evidence',
    description:
      'Review contract specifications, data quality gates, exposure matching, term structure, and cost-sensitivity backtests.',
  },
  {
    href: '/methodology',
    icon: BookOpen,
    index: '07',
    eyebrow: 'Audit trail',
    title: 'Read the method',
    description:
      'Understand every mathematical formula, fee schedule, reconciliation check, and exportable research record.',
  },
  {
    href: '/workspace',
    icon: Wrench,
    index: '08',
    eyebrow: 'Research workspace',
    title: 'Explore full quant suite',
    description:
      'Access factor dashboards, cointegration heatmaps, alpha zoo scanners, and preserved strategy workbenches.',
  },
]

export default function Home() {
  return (
    <SiteShell>
      <GoldPrismHeader />
      <HomeFeaturesShowcase />
      <section className="border-b border-border bg-background">
        <div className="mx-auto max-w-[1360px] px-4 py-8 md:py-10">
          <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="gp-kicker">Terminal Directory · Surfaces &amp; Research</p>
              <h2 className="gp-title mt-2 text-balance">
                Direct navigation across execution, verification, and audit modules.
              </h2>
            </div>
            <p className="max-w-md text-xs leading-relaxed text-muted-foreground lg:text-right">
              Every module reads from the same parity feed, contract master, and statutory cost
              schedule—zero disconnected tools.
            </p>
          </div>

          <div className="gp-stagger mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {pathways.map((pathway) => {
              const Icon = pathway.icon
              return (
                <Link
                  key={pathway.href}
                  href={pathway.href}
                  className="group relative flex flex-col justify-between rounded-[4px] border border-border bg-card p-4 shadow-[var(--gp-hard-shadow)] transition-colors hover:border-[var(--gp-gold-500)] hover:bg-[var(--gp-gold-50)]/40 dark:hover:bg-[var(--gp-gold-900)]/20"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-medium tracking-[0.11em] text-[var(--gp-gold-ink)]">
                        {pathway.index} · {pathway.eyebrow}
                      </span>
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    </div>
                    <h3 className="gp-ledger mt-3 text-base text-foreground">{pathway.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {pathway.description}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-2.5 font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground group-hover:text-foreground">
                    <span>Open surface</span>
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>
    </SiteShell>
  )
}
