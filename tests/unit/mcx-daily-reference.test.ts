import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeContractBySymbol } from '../../src/lib/goldprism/contract-specs'
import { parseMcxDailyCloseReference } from '../../src/lib/goldprism/mcx-daily-reference'

const reference = {
  sourceFileName: 'BhavCopyDateWise_20112026.csv',
  sourceUrl: 'https://www.mcxindia.com/market-data/bhavcopy',
  sourceNote: 'User-supplied daily snapshot; not verified against a live MCX feed.',
  sha256Hash: 'a'.repeat(64),
  tradingDate: '2026-11-20',
  rows: [
    {
      symbol: 'GOLDM',
      expiryDate: '2026-12-05',
      close: 1234500,
      volumeLots: 10,
      openInterestLots: 25,
    },
    {
      symbol: 'GOLDTEN',
      expiryDate: '2026-12-05',
      close: 123450,
      volumeLots: 5,
      openInterestLots: 15,
    },
  ],
}

test('daily MCX reference validates snapshot metadata and normalizes close prices', () => {
  const parsed = parseMcxDailyCloseReference(reference)

  assert.equal(parsed?.tradingDate, '2026-11-20')
  assert.equal(parsed?.quotes.length, 2)
  assert.equal(
    parsed?.quotes[0].pricePerGramFineGold,
    normalizeContractBySymbol('GOLDM', 1234500).pricePerPureGram
  )
})

test('daily MCX reference rejects malformed or duplicate quote data', () => {
  assert.equal(
    parseMcxDailyCloseReference({ ...reference, tradingDate: '2026-02-30' }),
    null
  )
  assert.equal(
    parseMcxDailyCloseReference({
      ...reference,
      rows: [...reference.rows, reference.rows[0]],
    }),
    null
  )
  assert.equal(
    parseMcxDailyCloseReference({
      ...reference,
      rows: [{ ...reference.rows[0], close: Number.NaN }],
    }),
    null
  )
})
