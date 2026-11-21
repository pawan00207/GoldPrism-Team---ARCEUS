type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function readTinyFishAgentStream(
  stream: ReadableStream<Uint8Array>
): Promise<JsonRecord> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let dataLines: string[] = []
  let result: JsonRecord | null = null
  let providerError: Error | null = null

  const dispatch = () => {
    if (dataLines.length === 0) return
    const rawData = dataLines.join('\n')
    dataLines = []

    let event: unknown
    try {
      event = JSON.parse(rawData)
    } catch {
      throw new Error('TinyFish Agent returned an invalid event.')
    }
    if (!isRecord(event) || typeof event.type !== 'string') return

    if (event.type === 'ERROR') {
      providerError = new Error(
        typeof event.message === 'string'
          ? event.message.slice(0, 240)
          : 'TinyFish Agent reported an error.'
      )
    } else if (event.type === 'COMPLETE') {
      if (event.status !== 'COMPLETED') {
        providerError = new Error(
          `TinyFish Agent ended with status ${String(event.status ?? 'unknown')}.`
        )
      } else if (!isRecord(event.result)) {
        providerError = new Error('TinyFish Agent completed without a structured result.')
      } else {
        result = event.result
      }
    }
  }

  try {
    while (!result && !providerError) {
      const { value, done } = await reader.read()
      if (!done && value) buffer += decoder.decode(value, { stream: true })
      if (done) buffer += decoder.decode()

      let newline = buffer.indexOf('\n')
      while (newline >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, '')
        buffer = buffer.slice(newline + 1)
        if (line === '') dispatch()
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
        newline = buffer.indexOf('\n')
      }

      if (done) break
    }

    if (buffer.length > 0) {
      const line = buffer.replace(/\r$/, '')
      if (line === '') dispatch()
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
    }
    if (dataLines.length > 0) dispatch()
    if (providerError) throw providerError
    if (!result) throw new Error('TinyFish Agent stream ended before a result arrived.')
    return result
  } finally {
    await reader.cancel().catch(() => undefined)
  }
}
