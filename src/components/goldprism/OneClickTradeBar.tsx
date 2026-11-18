'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, ShieldCheck, Zap } from 'lucide-react'
import { useLiveFeed } from '@/components/goldprism/LiveFeedProvider'
import { VerdictTag } from '@/components/goldprism/brand'
import { inr } from '@/lib/goldprism/format'
import { evaluateTradePlan, TradeIntentInput } from '@/lib/goldprism/trade-engine'
import { cn } from '@/lib/utils'

export function OneClickTradeBar({
  intent,
  title = 'Understand & execute in one click',
  compact = false,
}: {
  intent: TradeIntentInput
  title?: string
  compact?: boolean
}) {
  const { cashInr, positions, executeOneClickTrade } = useLiveFeed()
  const [ackOverride, setAckOverride] = React.useState(false)
  const [feedback, setFeedback] = React.useState<{ ok: boolean; message: string } | null>(null)

  const { plan, canExecute, blockerMessage } = React.useMemo(
    () => evaluateTradePlan(intent, cashInr),
    [intent, cashInr]
  )

  // Reset override acknowledgment when verdict/pair changes
  React.useEffect(() => {
    setAckOverride(false)
  }, [intent.contractA, intent.contractB, intent.side, intent.verdict, intent.lotsA])

  const handleExecute = () => {
    const res = executeOneClickTrade(intent, { allowDisciplineOverride: ackOverride })
    setFeedback({ ok: res.ok, message: res.message })
  }

  const buttonDisabled =
    !canExecute || (plan.requiresDisciplineOverride && !ackOverride)

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[4px] border border-border bg-card',
        !compact && 'shadow-[var(--gp-hard-shadow)]'
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-[var(--gp-vellum)]/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-[var(--gp-gold-ink)]" aria-hidden="true" />
          <p className="gp-label text-foreground">{title}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {plan.verdict === 'DIRECT_HEDGE' ? (
            <span className="gp-tag gp-tag--gold">Matched hedge</span>
          ) : (
            <VerdictTag verdict={plan.verdict} />
          )}
          <span className="gp-tag gp-tag--neutral">
            Paper cash · {inr(cashInr, 0)}
          </span>
          {positions.length > 0 ? (
            <Link
              href="/trade"
              className="gp-tag gp-tag--tradable hover:opacity-80"
            >
              {positions.length} open · Manage
            </Link>
          ) : null}
        </div>
      </div>

      <div className="p-4">
        <p className="text-sm leading-relaxed text-foreground">{plan.plainEnglishSummary}</p>

        {/* 4-Step Plain-English Clarity Strip */}
        <div className="mt-3.5 grid gap-px overflow-hidden rounded-[4px] border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {plan.stepsChecklist.map((item) => (
            <div key={item.step} className="bg-background p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
                {item.step} · {item.title}
              </p>
              <p className="mt-1 font-mono text-xs font-medium text-foreground">
                {item.detail}
              </p>
            </div>
          ))}
        </div>

        {/* Discipline warning if NO EDGE / BLOCKED */}
        {plan.requiresDisciplineOverride ? (
          <div className="mt-3.5 flex flex-col gap-3 rounded-[4px] border border-[var(--gp-watch-ink)]/60 bg-[var(--gp-gold-50)] p-3 dark:bg-[var(--gp-gold-900)] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gp-watch-ink)]" />
              <p className="font-mono text-[11px] leading-relaxed text-foreground">
                {plan.warningReason}
              </p>
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-[4px] border border-border bg-background px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-foreground">
              <input
                type="checkbox"
                checked={ackOverride}
                onChange={(e) => setAckOverride(e.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--gp-gold-500)]"
              />
              Paper-test anyway
            </label>
          </div>
        ) : plan.warningReason ? (
          <p className="mt-3 font-mono text-[11px] text-[var(--gp-watch-ink)]">
            Note: {plan.warningReason}
          </p>
        ) : null}

        {blockerMessage ? (
          <p className="mt-3 font-mono text-[11px] text-[var(--gp-blocked-ink)]">
            {blockerMessage}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3.5">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--gp-tradable-ink)]" />
            <span>
              {plan.sourceLabel} · as_of {plan.asOf.slice(0, 19).replace('T', ' ')}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/trade" className="gp-button gp-button--quiet whitespace-nowrap shrink-0">
              Open Trade Desk
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={handleExecute}
              disabled={buttonDisabled}
              className={cn(
                'gp-button whitespace-nowrap shrink-0',
                !buttonDisabled && 'gp-button--primary',
                buttonDisabled && 'cursor-not-allowed opacity-50'
              )}
            >
              <Zap className="h-3.5 w-3.5" />
              1-Click Execute · {plan.headline}
            </button>
          </div>
        </div>

        {feedback ? (
          <div
            className={cn(
              'mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[4px] border px-3 py-2 font-mono text-xs',
              feedback.ok
                ? 'border-[var(--gp-tradable-ink)] bg-background text-[var(--gp-tradable-ink)]'
                : 'border-[var(--gp-blocked-ink)] bg-background text-[var(--gp-blocked-ink)]'
            )}
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              {feedback.message}
            </span>
            {feedback.ok ? (
              <Link href="/trade" className="underline">
                View live P&amp;L →
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
