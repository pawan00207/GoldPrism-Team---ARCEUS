import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseMonitorEvent,
  verifyMonitorCallbackToken,
} from '../../src/lib/goldprism/tinyfish-webhook'

test('Monitor callback token is required and compared exactly', () => {
  assert.equal(verifyMonitorCallbackToken(undefined, 'token'), false)
  assert.equal(verifyMonitorCallbackToken('expected', null), false)
  assert.equal(verifyMonitorCallbackToken('expected', 'other'), false)
  assert.equal(verifyMonitorCallbackToken('expected', 'expected'), true)
})

test('Monitor events must identify an allowlisted Page Monitor', () => {
  const allowed = new Set(['official-rules-monitor'])
  const payload = {
    id: 'run-1',
    fetch_monitor_id: 'unrecognized',
    outcome: 'changed',
  }
  assert.equal(parseMonitorEvent(payload, allowed), null)
})

test('Relevant changes and failed checks require cost-model review', () => {
  const allowed = new Set(['official-rules-monitor'])
  const changed = parseMonitorEvent(
    {
      id: 'run-2',
      fetch_monitor_id: 'official-rules-monitor',
      outcome: 'changed',
      judgment: { is_relevant: true, summary: 'Fee schedule changed.' },
    },
    allowed
  )
  const failed = parseMonitorEvent(
    {
      id: 'run-3',
      fetch_monitor_id: 'official-rules-monitor',
      outcome: 'unchanged',
      errors: [{ error: 'target_unreachable' }],
    },
    allowed
  )

  assert.equal(changed?.requiresReview, true)
  assert.equal(changed?.verified, true)
  assert.equal(failed?.requiresReview, true)
  assert.equal(failed?.verified, false)
})
