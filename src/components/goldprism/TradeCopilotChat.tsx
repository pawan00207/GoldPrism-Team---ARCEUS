'use client'

import * as React from 'react'
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { Bot, CheckCircle2, Cpu, Loader2, Send, Sparkles, X } from 'lucide-react'
import { useLiveFeed } from '@/components/goldprism/LiveFeedProvider'
import { OneClickTradeBar } from '@/components/goldprism/OneClickTradeBar'
import { saveCopilotLogToCloud } from '@/lib/firebase/client'
import { TradeIntentInput } from '@/lib/goldprism/trade-engine'
import { Mascot } from '@/components/goldprism/Mascot'
import { cn } from '@/lib/utils'

interface CopilotMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  asOf?: string
  engineLabel?: string
  suggestedIntent?: TradeIntentInput | null
  evidence?: Array<{ title: string; url: string; excerpt: string }>
  runId?: string
}

interface TinyFishProgress {
  runId: string | null
  steps: string[]
  viewerUrl: string | null
}

const QUICK_PROMPTS = [
  'GOLDTEN vs GOLDM spread abhi trade karna sahi hai?',
  '50g gold hedge karna hai — best contract aur cost batao',
  'Explain all 4 MCX contracts normalized to 10g pure gold',
  'Find the current MCX gold contract quotes and cite the source',
  'Check my open positions & margin risk right now',
]

function validTinyFishEvidence(value: unknown): CopilotMessage['evidence'] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 3) return null
  const evidence: NonNullable<CopilotMessage['evidence']> = []
  for (const item of value) {
    if (!item || typeof item !== 'object') return null
    const record = item as Record<string, unknown>
    if (
      typeof record.title !== 'string' ||
      typeof record.url !== 'string' ||
      typeof record.excerpt !== 'string'
    ) {
      return null
    }
    try {
      const url = new URL(record.url)
      if (
        url.protocol !== 'https:' ||
        (url.hostname !== 'mcxindia.com' && url.hostname !== 'www.mcxindia.com')
      ) {
        return null
      }
    } catch {
      return null
    }
    evidence.push({
      title: record.title,
      url: record.url,
      excerpt: record.excerpt,
    })
  }
  return evidence
}

function validTinyFishViewerUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname.endsWith('.tinyfish.ai')
      ? url.toString()
      : null
  } catch {
    return null
  }
}

export function TradeCopilotChat({
  embedded = false,
}: {
  embedded?: boolean
}) {
  const { user, feed, cashInr, equityInr, positions, unrealizedPnlInr } = useLiveFeed()
  const [engineMode, setEngineMode] = React.useState<
    'gemini' | 'deterministic' | 'tinyfish'
  >('gemini')
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
  const [tinyFishProgress, setTinyFishProgress] = React.useState<TinyFishProgress>({
    runId: null,
    steps: [],
    viewerUrl: null,
  })
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

  const sendMessage = async (
    text: string,
    overrideMode?: 'gemini' | 'deterministic' | 'tinyfish'
  ) => {
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
      if (activeMode === 'tinyfish') {
        setTinyFishProgress({ runId: null, steps: [], viewerUrl: null })
        const response = await fetch('/api/goldprism/tinyfish/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: trimmed }),
        })
        if (!response.ok) {
          const data: unknown = await response.json().catch(() => null)
          const message =
            data &&
            typeof data === 'object' &&
            'error' in data &&
            typeof data.error === 'string'
              ? data.error
              : `TinyFish request failed (HTTP ${response.status}).`
          setError({ message, canFallback: false })
          return
        }
        if (!response.body) {
          setError({ message: 'TinyFish returned no progress stream.', canFallback: false })
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let finalReceived = false
        const processEvent = (line: string) => {
          if (!line.startsWith('data:')) return
          let event: unknown
          try {
            event = JSON.parse(line.slice(5).trimStart())
          } catch {
            setError({ message: 'TinyFish sent an invalid progress event.', canFallback: false })
            finalReceived = true
            return
          }
          if (!event || typeof event !== 'object' || !('type' in event)) return
          const record = event as Record<string, unknown>
          if (record.type === 'STARTED') {
            setTinyFishProgress((current) => ({
              ...current,
              runId: typeof record.runId === 'string' ? record.runId : null,
            }))
          } else if (record.type === 'PROGRESS') {
            setTinyFishProgress((current) => ({
              ...current,
              steps: [
                ...current.steps,
                typeof record.purpose === 'string' ? record.purpose : 'Agent is working.',
              ].slice(-8),
            }))
          } else if (record.type === 'STREAMING_URL') {
            const viewerUrl = validTinyFishViewerUrl(record.viewerUrl)
            if (viewerUrl) {
              setTinyFishProgress((current) => ({ ...current, viewerUrl }))
            }
          } else if (record.type === 'ERROR') {
            setError({
              message:
                typeof record.message === 'string'
                  ? record.message
                  : 'TinyFish Agent failed.',
              canFallback: false,
            })
            finalReceived = true
          } else if (record.type === 'COMPLETE') {
            const result = record.result
            const evidence =
              result && typeof result === 'object' && 'evidence' in result
                ? validTinyFishEvidence(result.evidence)
                : null
            const answer =
              result &&
              typeof result === 'object' &&
              'answer' in result &&
              typeof result.answer === 'string'
                ? result.answer
                : null
            if (!answer || !evidence) {
              setError({
                message: 'TinyFish answer or MCX citations failed validation.',
                canFallback: false,
              })
            } else {
              const replyMsg: CopilotMessage = {
                id: `a-${Date.now()}`,
                role: 'assistant',
                content: answer,
                asOf: typeof record.timestamp === 'string' ? record.timestamp : undefined,
                engineLabel: 'TinyFish Agent · MCX public page',
                evidence,
                runId: typeof record.runId === 'string' ? record.runId : undefined,
              }
              setMessages((prev) => [...prev, replyMsg])
              if (user) {
                void saveCopilotLogToCloud(user.uid, trimmed, replyMsg.content).catch(() => {
                  // Non-blocking audit log write
                })
              }
            }
            finalReceived = true
          }
        }

        while (true) {
          const { value, done } = await reader.read()
          buffer += decoder.decode(value, { stream: !done })
          let newline = buffer.indexOf('\n')
          while (newline >= 0) {
            processEvent(buffer.slice(0, newline).replace(/\r$/, ''))
            buffer = buffer.slice(newline + 1)
            newline = buffer.indexOf('\n')
          }
          if (done) break
        }
        if (!finalReceived) {
          setError({
            message: 'TinyFish progress stream ended before an answer arrived.',
            canFallback: false,
          })
        }
        return
      }

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
              {engineMode === 'gemini'
                ? 'Gemini + X-Ray'
                : engineMode === 'tinyfish'
                  ? 'TinyFish · MCX public page'
                  : 'Quant Rules Engine'}
              {engineMode === 'tinyfish'
                ? ''
                : ` · ${feed?.status === 'LIVE_PARITY' ? 'Live Connected' : 'Syncing'}`}
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
          <button
            type="button"
            onClick={() => setEngineMode('tinyfish')}
            className={cn(
              'inline-flex items-center gap-1 rounded-[3px] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors',
              engineMode === 'tinyfish'
                ? 'bg-card text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Bot className="h-3 w-3 text-[var(--gp-gold-ink)]" />
            MCX Agent
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
              {m.runId ? (
                <p className="mt-1 font-mono text-[9px] text-muted-foreground">
                  TinyFish run · {m.runId}
                </p>
              ) : null}
            </div>

            {m.evidence?.map((item) => (
              <a
                key={`${m.id}-${item.url}`}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="max-w-[92%] rounded-[4px] border border-border bg-background px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <span className="font-medium text-foreground">{item.title}</span>
                <span className="mt-1 block">{item.excerpt}</span>
                <span className="mt-1 block font-mono text-[9px] underline underline-offset-2">
                  {item.url}
                </span>
              </a>
            ))}

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
          <div className="space-y-2 rounded-[4px] border border-border bg-background px-3 py-2 font-mono text-xs text-muted-foreground">
            <p className="inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--gp-gold-ink)]" />
              {engineMode === 'tinyfish'
                ? `TinyFish Agent researching the official MCX page${tinyFishProgress.runId ? ` · ${tinyFishProgress.runId}` : '…'}`
                : 'Checking live parity, X-Ray waterfall & statutory fees…'}
            </p>
            {tinyFishProgress.steps.length > 0 ? (
              <ul className="space-y-1 text-[10px]">
                {tinyFishProgress.steps.map((step, index) => (
                  <li key={`${index}-${step}`}>{step}</li>
                ))}
              </ul>
            ) : null}
            {tinyFishProgress.viewerUrl ? (
              <a
                href={tinyFishProgress.viewerUrl}
                target="_blank"
                rel="noreferrer"
                className="block text-[10px] underline underline-offset-2"
              >
                View live agent session
              </a>
            ) : null}
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
  const [homeHeroVisible, setHomeHeroVisible] = React.useState(false)
  const pathname = usePathname()
  const prefersReduced = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const spring = useSpring(scrollYProgress, { stiffness: 90, damping: 20, mass: 0.4 })

  React.useEffect(() => {
    if (pathname !== '/') {
      setHomeHeroVisible(false)
      return
    }

    const hero = document.getElementById('home-hero')
    if (!hero) return

    const observer = new IntersectionObserver(
      ([entry]) => setHomeHeroVisible(entry.isIntersecting),
      { rootMargin: '-80px 0px -80px 0px' }
    )
    observer.observe(hero)
    return () => observer.disconnect()
  }, [pathname])

  // 3D "presenting the ingot" drift: yaw follows the scroll through the page,
  // pitch counters it, the mascot bobs on a half-helix — CSS perspective on the
  // wrapper sells the depth. Flattens entirely under reduced motion.
  const rotateY = useTransform(spring, [0, 1], [14, -14])
  const rotateX = useTransform(spring, [0, 1], [-7, 7])
  const y = useTransform(spring, [0, 0.25, 0.5, 0.75, 1], [0, -18, 0, -14, 0])
  const glow = useTransform(spring, [0, 0.5, 1], [0.25, 0.5, 0.3])

  const motionStyle = prefersReduced
    ? {}
    : { rotateY, rotateX, y }

  if (pathname === '/' && homeHeroVisible && !open) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-5 sm:right-5" style={{ perspective: 720 }}>
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
        <motion.button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open Trade Copilot AI"
          className="group relative block cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--gp-caramel)] focus-visible:ring-offset-2"
          style={motionStyle}
          whileHover={prefersReduced ? undefined : { scale: 1.06, rotateZ: -1.5 }}
          whileTap={prefersReduced ? undefined : { scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        >
          {/* ingot glow — breathes with scroll position */}
          {prefersReduced ? null : (
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 h-[115%] w-[115%] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                opacity: glow,
                background:
                  'radial-gradient(closest-side, var(--gp-caramel) 0%, transparent 68%)',
                filter: 'blur(14px)',
              }}
            />
          )}
          {/* depth shadow stack — sells the 3D */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-2 -bottom-1 h-4 rounded-full bg-black/45 blur-md"
          />
          <Mascot
            alt="Trade Copilot — GoldPrism's bandaged mummy analyst"
            className="relative h-14 w-14 object-contain drop-shadow-[0_6px_0_rgba(0,0,0,0.25)] transition-transform duration-300 group-hover:-translate-y-1 sm:h-16 sm:w-16"
          />
          {/* sheen sweep on hover */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
          >
            <span className="absolute -left-full top-0 h-full w-2/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/45 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[320%]" />
          </span>
          <span className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-[var(--gp-caramel)]/70 bg-[var(--gp-crucible)]/90 px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-[var(--gp-paper)] shadow-[var(--gp-hard-shadow)] backdrop-blur-sm">
            Trade Copilot AI
          </span>
        </motion.button>
      )}
    </div>
  )
}
