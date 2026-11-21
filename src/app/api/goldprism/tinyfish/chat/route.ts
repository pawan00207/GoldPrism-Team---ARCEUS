import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  buildTinyFishChatGoal,
  parseTinyFishSseEvent,
  TINYFISH_CHAT_OUTPUT_SCHEMA,
  TINYFISH_CHAT_URL,
  validateTinyFishChatResult,
} from '@/lib/goldprism/tinyfish-chat'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 180

const REQUEST_LIMIT = 5
const RATE_WINDOW_MS = 5 * 60_000
const AGENT_TIMEOUT_MS = 175_000
const requestTimes = new Map<string, number[]>()
const RequestSchema = z.object({
  question: z.string().trim().min(1).max(600),
})

function consumeRateLimit(key: string): boolean {
  const now = Date.now()
  const active = (requestTimes.get(key) ?? []).filter((time) => now - time < RATE_WINDOW_MS)
  if (active.length >= REQUEST_LIMIT) {
    requestTimes.set(key, active)
    return false
  }
  active.push(now)
  requestTimes.set(key, active)
  return true
}

function sse(data: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
}

async function providerErrorMessage(response: Response): Promise<string | null> {
  const payload: unknown = await response.json().catch(() => null)
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null

  const error = 'error' in payload ? payload.error : null
  if (!error || typeof error !== 'object' || Array.isArray(error)) return null

  const message = 'message' in error ? error.message : null
  return typeof message === 'string'
    ? message.replace(/[\r\n]/g, ' ').slice(0, 240)
    : null
}

function allowedStreamingUrl(value: unknown): string | null {
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

export async function POST(request: NextRequest) {
  const apiKey = process.env.TINYFISH_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'TinyFish Agent is unavailable: TINYFISH_API_KEY is not configured.' },
      { status: 503 }
    )
  }

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'A question of at most 600 characters is required.' }, { status: 400 })
  }

  const clientKey = request.headers.get('x-real-ip') ?? 'unknown-client'
  if (!consumeRateLimit(clientKey)) {
    return NextResponse.json(
      { error: 'TinyFish request limit reached. Try again in a few minutes.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(RATE_WINDOW_MS / 1000)) } }
    )
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS)
  const abortRequest = () => controller.abort()
  request.signal.addEventListener('abort', abortRequest, { once: true })

  let upstream: Response
  try {
    upstream = await fetch('https://agent.tinyfish.ai/v1/automation/run-sse', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        url: TINYFISH_CHAT_URL,
        goal: buildTinyFishChatGoal(parsed.data.question),
        output_schema: TINYFISH_CHAT_OUTPUT_SCHEMA,
        agent_config: { max_duration_seconds: 45 },
      }),
      signal: controller.signal,
    })
  } catch {
    clearTimeout(timeout)
    request.signal.removeEventListener('abort', abortRequest)
    return NextResponse.json(
      { error: 'TinyFish Agent could not be reached. No research result was produced.' },
      { status: 502 }
    )
  }

  if (!upstream.ok || !upstream.body) {
    clearTimeout(timeout)
    request.signal.removeEventListener('abort', abortRequest)
    const detail = await providerErrorMessage(upstream)
    return NextResponse.json(
      {
        error: detail
          ? `TinyFish Agent rejected the run: ${detail}`
          : `TinyFish Agent rejected the run (HTTP ${upstream.status}).`,
      },
      { status: upstream.status === 429 ? 429 : 502 }
    )
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(output) {
      const reader = upstream.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let dataLines: string[] = []
      let complete = false

      const emitProviderEvent = (rawData: string) => {
        let event: Record<string, unknown> | null
        try {
          event = parseTinyFishSseEvent(rawData)
        } catch {
          output.enqueue(sse({ type: 'ERROR', message: 'TinyFish returned an invalid event.' }))
          complete = true
          return
        }
        if (!event || typeof event.type !== 'string') return

        if (event.type === 'STARTED') {
          output.enqueue(sse({
            type: 'STARTED',
            runId: typeof event.run_id === 'string' ? event.run_id : null,
            timestamp: typeof event.timestamp === 'string' ? event.timestamp : null,
          }))
        } else if (event.type === 'PROGRESS') {
          output.enqueue(sse({
            type: 'PROGRESS',
            purpose:
              typeof event.purpose === 'string'
                ? event.purpose.slice(0, 240)
                : 'Agent is working on the MCX page.',
            timestamp: typeof event.timestamp === 'string' ? event.timestamp : null,
          }))
        } else if (event.type === 'STREAMING_URL') {
          const viewerUrl = allowedStreamingUrl(event.streaming_url)
          if (viewerUrl) output.enqueue(sse({ type: 'STREAMING_URL', viewerUrl }))
        } else if (event.type === 'COMPLETE') {
          complete = true
          if (event.status !== 'COMPLETED') {
            output.enqueue(sse({
              type: 'ERROR',
              message: `TinyFish run ended with status ${String(event.status ?? 'unknown')}.`,
            }))
            return
          }
          try {
            output.enqueue(sse({
              type: 'COMPLETE',
              runId: typeof event.run_id === 'string' ? event.run_id : null,
              timestamp: typeof event.timestamp === 'string' ? event.timestamp : null,
              result: validateTinyFishChatResult(event.result),
            }))
          } catch {
            output.enqueue(sse({
              type: 'ERROR',
              message: 'The run finished, but its answer or MCX citations failed validation.',
            }))
          }
        }
      }

      const dispatch = () => {
        if (dataLines.length === 0) return
        emitProviderEvent(dataLines.join('\n'))
        dataLines = []
      }

      try {
        while (!complete) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let newline = buffer.indexOf('\n')
          while (newline >= 0) {
            const line = buffer.slice(0, newline).replace(/\r$/, '')
            buffer = buffer.slice(newline + 1)
            if (line === '') dispatch()
            else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
            newline = buffer.indexOf('\n')
          }
        }
        if (dataLines.length > 0) dispatch()
        if (!complete) {
          output.enqueue(sse({ type: 'ERROR', message: 'TinyFish stream ended before a result arrived.' }))
        }
      } catch {
        if (!request.signal.aborted) {
          output.enqueue(sse({
            type: 'ERROR',
            message: controller.signal.aborted
              ? 'TinyFish Agent timed out before returning a result.'
              : 'TinyFish stream failed before a result arrived.',
          }))
        }
      } finally {
        await reader.cancel().catch(() => undefined)
        clearTimeout(timeout)
        request.signal.removeEventListener('abort', abortRequest)
        output.close()
      }
    },
    cancel() {
      controller.abort()
      clearTimeout(timeout)
      request.signal.removeEventListener('abort', abortRequest)
    },
  })

  return new Response(stream, {
    headers: {
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream; charset=utf-8',
      'X-Accel-Buffering': 'no',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
