'use client'

import * as React from 'react'
import { Bot, CheckCircle2, Cpu, Loader2, MessageSquare, Send, Sparkles, X } from 'lucide-react'
import { useLiveFeed } from '@/components/goldprism/LiveFeedProvider'
import { OneClickTradeBar } from '@/components/goldprism/OneClickTradeBar'
import { saveCopilotLogToCloud } from '@/lib/firebase/client'
import { TradeIntentInput } from '@/lib/goldprism/trade-engine'
import { cn } from '@/lib/utils'

interface CopilotMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  asOf?: string
  engineLabel?: string
  suggestedIntent?: TradeIntentInput | null
}

const QUICK_PROMPTS = [
  'GOLDTEN vs GOLDM spread abhi trade karna sahi hai?',
  '50g gold hedge karna hai — best contract aur cost batao',
  'Explain all 4 MCX contracts normalized to 10g pure gold',
  'Check my open positions & margin risk right now',
]

export function TradeCopilotChat({
  embedded = false,
}: {
  embedded?: boolean
}) {
  const { user, feed, cashInr, equityInr, positions, unrealizedPnlInr } = useLiveFeed()
  const [engineMode, setEngineMode] = React.useState<'gemini' | 'deterministic'>('gemini')
  const [messages, setMessages] = React.useState<CopilotMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Namaste! Main GoldPrism Trade Copilot hoon. Live parity prices, X-Ray decomposition, aur 10g pure-gold normalization ke hisaab se aapki trade samajhne aur 1-click execute karne me help karunga. Poochiye kya check karna hai!',
    },
  ])
  const [input, setInput] = React.useState('')
  const [lastPrompt, setLastPrompt] = React.useState<string>('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<{
    message: string
    canFallback: boolean
  } | null>(null)
  const scrollRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, busy])

  const sendMessage = async (text: string, overrideMode?: 'gemini' | 'deterministic') => {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    const activeMode = overrideMode ?? engineMode
    setError(null)
    setLastPrompt(trimmed)

    const shouldAppendUser = !overrideMode
    if (shouldAppendUser) {
      const userMsg: CopilotMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: trimmed,
      }
      setMessages((prev) => [...prev, userMsg])
      setInput('')
    }
    setBusy(true)

    try {
      const res = await fetch('/api/goldprism/trade-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          mode: activeMode,
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
          portfolioSummary: {
            cashInr,
            equityInr,
            openCount: positions.length,
            unrealizedPnlInr,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError({
          message: data.error || `HTTP ${res.status}`,
          canFallback: Boolean(data.canUseDeterministicFallback),
        })
        return
      }

      const replyMsg: CopilotMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: String(data.reply ?? ''),
        asOf: data.asOf,
        engineLabel:
          data.engine === 'deterministic-quant'
            ? 'Deterministic Quant Engine'
            : 'Gemini 4 Grounded',
        suggestedIntent: data.suggestedIntent ?? null,
      }
      setMessages((prev) => [...prev, replyMsg])

      if (user) {
        void saveCopilotLogToCloud(user.uid, trimmed, replyMsg.content).catch(() => {
          // Non-blocking audit log write
        })
      }
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Copilot request failed',
        canFallback: activeMode === 'gemini',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-[4px] border border-border bg-card',
        embedded ? 'h-[580px]' : 'h-[500px] shadow-[var(--gp-hard-shadow)]'
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-[var(--gp-vellum)]/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-[var(--gp-gold-ink)]" />
          <div>
            <p className="gp-label text-foreground">GoldPrism Trade Copilot</p>
            <p className="font-mono text-[9px] uppercase tracking-[0.09em] text-muted-foreground">
              {engineMode === 'gemini' ? 'Gemini + X-Ray' : 'Quant Rules Engine'} ·{' '}
              {feed?.status === 'LIVE_PARITY' ? 'Live Connected' : 'Syncing'}
            </p>
          </div>
        </div>

        <div className="flex items-center rounded-[4px] border border-border bg-background p-0.5">
          <button
            type="button"
            onClick={() => setEngineMode('gemini')}
            className={cn(
              'inline-flex items-center gap-1 rounded-[3px] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors',
              engineMode === 'gemini'
                ? 'bg-card text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Sparkles className="h-3 w-3 text-[var(--gp-gold-ink)]" />
            Gemini AI
          </button>
          <button
            type="button"
            onClick={() => setEngineMode('deterministic')}
            className={cn(
              'inline-flex items-center gap-1 rounded-[3px] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors',
              engineMode === 'deterministic'
                ? 'bg-card text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Cpu className="h-3 w-3 text-[var(--gp-tradable-ink)]" />
            Quant Engine
          </button>
        </div>
      </div>

      {/* Quick Prompts */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-border bg-background/60 px-3 py-2 scrollbar-thin">
        {QUICK_PROMPTS.map((qp) => (
          <button
            key={qp}
            type="button"
            disabled={busy}
            onClick={() => void sendMessage(qp)}
            className="shrink-0 whitespace-nowrap rounded-[4px] border border-border bg-card px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:border-[var(--gp-gold-500)] hover:text-foreground"
          >
            {qp}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              'flex flex-col gap-2',
              m.role === 'user' ? 'items-end' : 'items-start'
            )}
          >
            <div
              className={cn(
                'max-w-[92%] rounded-[4px] border px-3.5 py-2.5 text-sm leading-relaxed',
                m.role === 'user'
                  ? 'border-[var(--gp-gold-500)] bg-[var(--gp-gold-50)] text-foreground dark:bg-[var(--gp-gold-900)]'
                  : 'border-border bg-background text-foreground'
              )}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.asOf ? (
                <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.09em] text-muted-foreground">
                  <CheckCircle2 className="mr-1 inline h-2.5 w-2.5 text-[var(--gp-tradable-ink)]" />
                  {m.engineLabel ?? 'Grounded'} · as_of {m.asOf.slice(0, 19).replace('T', ' ')} UTC
                </p>
              ) : null}
            </div>

            {m.suggestedIntent ? (
              <div className="w-full max-w-[96%]">
                <OneClickTradeBar
                  intent={m.suggestedIntent}
                  compact
                  title="Copilot Recommended Trade · 1-Click Execute"
                />
              </div>
            ) : null}
          </div>
        ))}

        {busy ? (
          <div className="inline-flex items-center gap-2 rounded-[4px] border border-border bg-background px-3 py-2 font-mono text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--gp-gold-ink)]" />
            Checking live parity, X-Ray waterfall &amp; statutory fees…
          </div>
        ) : null}

        {error ? (
          <div className="space-y-2 rounded-[4px] border border-[var(--gp-blocked-ink)] bg-background p-3 font-mono text-xs text-[var(--gp-blocked-ink)]">
            <p>{error.message}</p>
            {error.canFallback && lastPrompt ? (
              <button
                type="button"
                onClick={() => {
                  setEngineMode('deterministic')
                  void sendMessage(lastPrompt, 'deterministic')
                }}
                className="gp-button min-h-0 px-2.5 py-1 text-[10px]"
              >
                <Cpu className="h-3 w-3" /> Switch to Deterministic Quant Engine &amp; Retry
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void sendMessage(input)
        }}
        className="flex items-center gap-2 border-t border-border bg-background p-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask in English or Hinglish (e.g., 50g hedge best contract?)…"
          className="gp-field flex-1 px-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="gp-button gp-button--primary shrink-0 px-3"
          aria-label="Send to Trade Copilot"
        >
          <Send className="h-3.5 w-3.5" />
          Ask
        </button>
      </form>
    </div>
  )
}

export function FloatingTradeCopilot() {
  const [open, setOpen] = React.useState(false)

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open ? (
        <div className="w-[min(94vw,440px)]">
          <div className="flex items-center justify-end bg-transparent pb-1.5">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="gp-button gp-button--primary min-h-0 px-2.5 py-1 text-[10px]"
              aria-label="Close Trade Copilot"
            >
              <X className="h-3.5 w-3.5" /> Minimize
            </button>
          </div>
          <TradeCopilotChat />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="gp-button gp-button--primary shadow-[var(--gp-hard-shadow)] whitespace-nowrap"
        >
          <MessageSquare className="h-4 w-4" />
          Trade Copilot AI
        </button>
      )}
    </div>
  )
}
