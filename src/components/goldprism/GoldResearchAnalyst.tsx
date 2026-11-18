'use client'

import * as React from 'react'
import Markdown from 'react-markdown'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { DataTag, SectionHead } from '@/components/goldprism/brand'
import type { ToolArtifactBase } from '@/lib/goldprism/analyst-tools'
import type { GroundingValidationResult } from '@/lib/goldprism/number-grounding'
import { cn } from '@/lib/utils'

interface AnalystMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  mode?: 'deterministic_engine' | 'deterministic_tools_only'
  artifacts?: ToolArtifactBase[]
  grounding?: GroundingValidationResult
  error?: string
}

const SUGGESTED_QUESTIONS = [
  'Why is GOLDPETAL at a premium to GOLDM? Is it purity or carry?',
  'Which contract has the best liquidity?',
  'Why did the strategy produce NO EDGE?',
  'What if transaction costs increased by 20%?',
  'What was the strongest opportunity that survived costs?',
]

export function GoldResearchAnalyst() {
  const [asOf, setAsOf] = React.useState<string>('2025-06-30')
  const [messages, setMessages] = React.useState<AnalystMessage[]>([])
  const [input, setInput] = React.useState<string>('')
  const [streaming, setStreaming] = React.useState<boolean>(false)
  const [selectedArtifact, setSelectedArtifact] = React.useState<ToolArtifactBase | null>(null)
  const [reportLoading, setReportLoading] = React.useState<boolean>(false)
  const [reportError, setReportError] = React.useState<string | null>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, streaming])

  async function askAnalyst(overrideQuestion?: string) {
    const q = (overrideQuestion ?? input).trim()
    if (!q || streaming) return

    const userMsg: AnalystMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: q,
    }
    const assistantId = `a-${Date.now()}`
    const initialAssistant: AnalystMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
    }

    const historySnapshot = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    setMessages((prev) => [...prev, userMsg, initialAssistant])
    setInput('')
    setStreaming(true)

    try {
      const res = await fetch('/api/goldprism/analyst', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          question: q,
          asOf,
          history: historySnapshot,
        }),
      })

      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || `HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let currentEvent = 'message'

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const rawLine of lines) {
          const line = rawLine.trimEnd()
          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim()
            continue
          }
          if (!line.startsWith('data:')) continue
          const jsonStr = line.slice(5).trim()
          if (!jsonStr) continue

          let payload: any
          try {
            payload = JSON.parse(jsonStr)
          } catch {
            continue
          }

          if (currentEvent === 'meta') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, mode: payload.mode, artifacts: payload.artifacts }
                  : m
              )
            )
            if (Array.isArray(payload.artifacts) && payload.artifacts.length > 0) {
              setSelectedArtifact(payload.artifacts[0])
            }
          } else if (currentEvent === 'token') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + (payload.text ?? '') }
                  : m
              )
            )
          } else if (currentEvent === 'grounding') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, grounding: payload } : m
              )
            )
          } else if (currentEvent === 'error') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, error: payload.error } : m
              )
            )
          }
        }
      }
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                error: e instanceof Error ? e.message : 'Analyst request failed',
              }
            : m
        )
      )
    } finally {
      setStreaming(false)
    }
  }

  async function generateResearchReport() {
    setReportLoading(true)
    setReportError(null)
    try {
      const res = await fetch('/api/goldprism/analyst', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'report', asOf }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)

      const header = `# GoldPrism Quantitative Research Report\n\n- **Generated**: ${data.generatedAt}\n- **Context as_of**: ${asOf}\n- **Provenance**: Deterministic TypeScript Quantitative Engine + MCX 18M Bhavcopy\n\n---\n\n`
      const md = header + data.markdown

      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `goldprism_research_report_${asOf}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      setReportError(e instanceof Error ? e.message : 'Failed to generate report')
    } finally {
      setReportLoading(false)
    }
  }

  return (
    <section id="gold-analyst" className="border-b border-border bg-background">
      <div className="mx-auto max-w-[1360px] px-4 py-8 md:py-10">
        <SectionHead
          index="03.5"
          eyebrow="Feature 03 · Gold Research Analyst"
          title="Every number comes from the engine, never the model."
          description="Our specialist Gold Research Analyst calls deterministic server-side tools first, attaches immutable artifact IDs, and validates every numeric figure in the streamed response."
          aside={
            <div className="flex flex-col items-start gap-2 lg:items-end">
              <DataTag detail={`as_of ${asOf}`} />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={generateResearchReport}
                  disabled={reportLoading}
                  className="gp-button gp-button--primary"
                >
                  {reportLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  Generate research report (MD)
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="gp-button"
                >
                  <FileText className="h-3.5 w-3.5" /> Print / PDF
                </button>
              </div>
              {reportError ? (
                <p className="font-mono text-[10px] text-[var(--gp-blocked-ink)]">
                  {reportError}
                </p>
              ) : null}
            </div>
          }
        />

        {/* Suggested Chips & as_of selector */}
        <div className="mt-6 rounded-[4px] border border-border bg-card p-4 shadow-[var(--gp-hard-shadow)]">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-3.5">
            <p className="gp-label text-foreground">Suggested specialist queries</p>
            <div className="flex items-center gap-2">
              <label className="gp-label" htmlFor="analyst-asof">
                Context as_of
              </label>
              <input
                id="analyst-asof"
                type="date"
                value={asOf}
                min="2024-01-01"
                max="2025-06-30"
                onChange={(e) => setAsOf(e.target.value)}
                className="gp-field text-xs"
              />
            </div>
          </div>

          <div className="mt-3.5 flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => askAnalyst(q)}
                disabled={streaming}
                className="gp-button text-left text-[11px] normal-case tracking-normal"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 gp-gold-text" />
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Main 61.8 / 38.2 Split: Chat Stream + Artifact Evidence Inspector */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,61.8%)_minmax(0,38.2%)]">
          {/* Chat Panel */}
          <div className="flex min-w-0 flex-col overflow-hidden rounded-[4px] border border-border bg-card shadow-[var(--gp-hard-shadow)]">
            <div className="flex items-center justify-between gap-2 border-b border-border bg-[var(--gp-vellum)]/60 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 gp-gold-text" />
                <span className="gp-label text-foreground">Grounded analyst stream</span>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
                5 deterministic tools · artifact-cited
              </span>
            </div>

            <div ref={scrollRef} className="h-[460px] space-y-4 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <p className="gp-ledger text-xl text-foreground">
                    Ask a verifiable MCX gold question.
                  </p>
                  <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
                    Select one of the five specialist questions above or type your own. Every
                    figure returned is cross-checked against the deterministic tool payload.
                  </p>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      'border p-4',
                      m.role === 'user'
                        ? 'ml-8 border-border bg-background'
                        : 'mr-4 border-border bg-card'
                    )}
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="gp-label">
                        {m.role === 'user' ? 'Researcher' : 'Gold Research Analyst'}
                      </span>
                      {m.grounding ? (
                        <span
                          className={cn(
                            'gp-tag',
                            m.grounding.ok ? 'gp-tag--tradable' : 'gp-tag--watch'
                          )}
                        >
                          {m.grounding.ok ? (
                            <>
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Numbers grounded
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="mr-1 h-3 w-3" /> Flagged (
                              {m.grounding.ungroundedNumbers.length})
                            </>
                          )}
                        </span>
                      ) : null}
                    </div>

                    {m.error ? (
                      <p className="font-mono text-xs text-[var(--gp-blocked-ink)]">
                        Error: {m.error}
                      </p>
                    ) : (
                      <div className="prose prose-sm max-w-none text-foreground dark:prose-invert">
                        <Markdown>{m.content || (streaming ? 'Executing deterministic tools…' : '')}</Markdown>
                      </div>
                    )}

                    {/* Clickable Artifact Citation Chips */}
                    {m.artifacts && m.artifacts.length > 0 ? (
                      <div className="mt-4 border-t border-border pt-3">
                        <p className="gp-label mb-2">Artifact citations (click to inspect)</p>
                        <div className="flex flex-wrap gap-1.5">
                          {m.artifacts.map((art) => (
                            <button
                              key={art.artifactId}
                              type="button"
                              onClick={() => setSelectedArtifact(art)}
                              className={cn(
                                'border px-2 py-1 font-mono text-[10px] transition-colors',
                                selectedArtifact?.artifactId === art.artifactId
                                  ? 'border-[var(--gp-gold-500)] bg-[var(--gp-gold-50)] text-foreground dark:bg-[var(--gp-gold-900)]'
                                  : 'border-border bg-background text-muted-foreground hover:text-foreground'
                              )}
                            >
                              [{art.artifactId}] · as_of {art.asOf}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                askAnalyst()
              }}
              className="flex gap-2 border-t border-border p-3"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about contract spreads, liquidity, NO EDGE filters, or cost sensitivity…"
                className="gp-field flex-1 text-sm"
                aria-label="Research analyst question"
              />
              <button
                type="submit"
                disabled={streaming || !input.trim()}
                className="gp-button gp-button--primary px-4"
              >
                {streaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Ask
              </button>
            </form>
          </div>

          {/* Right Column: Artifact Evidence Inspector */}
          <aside className="min-w-0 rounded-[4px] border border-border bg-card p-4 shadow-[var(--gp-hard-shadow)]">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
              <p className="gp-label text-foreground">Artifact evidence inspector</p>
              {selectedArtifact ? (
                <span className="gp-tag gp-tag--neutral">{selectedArtifact.toolName}</span>
              ) : null}
            </div>

            {selectedArtifact ? (
              <div className="mt-4">
                <dl className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Artifact ID</dt>
                    <dd className="text-foreground">{selectedArtifact.artifactId}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">as_of</dt>
                    <dd className="text-foreground">{selectedArtifact.asOf}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Source</dt>
                    <dd className="truncate text-foreground" title={selectedArtifact.source}>
                      {selectedArtifact.source}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd className="text-foreground">{selectedArtifact.status}</dd>
                  </div>
                </dl>

                <pre className="mt-4 max-h-[380px] overflow-auto border border-border bg-background p-3 font-mono text-[11px] leading-relaxed text-foreground">
                  {JSON.stringify(selectedArtifact, null, 2)}
                </pre>
              </div>
            ) : (
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                Ask a question to inspect the exact deterministic JSON payload, artifact ID, and{' '}
                <code className="font-mono">as_of</code> timestamp returned by the engine.
              </p>
            )}
          </aside>
        </div>
      </div>
    </section>
  )
}
