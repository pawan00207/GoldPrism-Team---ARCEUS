import assert from 'node:assert/strict'
import test from 'node:test'
import { readTinyFishAgentStream } from '../../src/lib/goldprism/tinyfish-agent'

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

test('TinyFish Agent reads a structured result from its SSE completion event', async () => {
  const stream = streamFromChunks([
    'event: update\ndata: {"type":"STARTED"}\n\n',
    'data: {"type":"COMPLETE","status":"COMPLETED","result":{"quotes":[{"symbol":"GOLDM"}]}}\n\n',
  ])

  assert.deepEqual(await readTinyFishAgentStream(stream), {
    quotes: [{ symbol: 'GOLDM' }],
  })
})

test('TinyFish Agent rejects failed and incomplete SSE runs', async () => {
  await assert.rejects(
    () => readTinyFishAgentStream(
      streamFromChunks(['data: {"type":"ERROR","message":"provider unavailable"}\n\n'])
    ),
    /provider unavailable/
  )
  await assert.rejects(
    () => readTinyFishAgentStream(streamFromChunks(['data: {"type":"STARTED"}'])),
    /ended before a result/
  )
})

test('TinyFish Agent rejects a completion without a structured result', async () => {
  await assert.rejects(
    () => readTinyFishAgentStream(
      streamFromChunks(['data: {"type":"COMPLETE","status":"COMPLETED","result":[]}\n\n'])
    ),
    /without a structured result/
  )
})
