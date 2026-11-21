import assert from 'node:assert/strict'
import test from 'node:test'
import {
  loadProvidedBhavcopySnapshot,
  parseProvidedBhavcopyCsv,
} from '../../src/lib/goldprism/provided-bhavcopy'

const HEADER =
  'Date,Instrument Name,Symbol,Expiry Date,Option Type,Strike Price,Open,High,Low,Close,Previous Close,Volume(Lots),Volume(In 000\'s),Value(Lacs),Open Interest(Lots)'

test('parses the supplied daily Bhavcopy and keeps only validated gold futures', () => {
  const snapshot = loadProvidedBhavcopySnapshot()

  assert.equal(snapshot.tradingDate, '2026-11-20')
  assert.equal(snapshot.rawRowCount, 18419)
  assert.equal(snapshot.goldFuturesRowCount, 24)
  assert.equal(snapshot.rejectedGoldFuturesRowCount, 0)
  assert.match(snapshot.sha256Hash, /^[a-f0-9]{64}$/)
  assert.deepEqual(
    Array.from(new Set(snapshot.rows.map((row) => row.symbol))).sort(),
    ['GOLDGUINEA', 'GOLDM', 'GOLDPETAL', 'GOLDTEN']
  )
  assert.deepEqual(
    snapshot.rows.find(
      (row) => row.symbol === 'GOLDM' && row.expiryDate === '2026-12-04'
    ),
    {
      symbol: 'GOLDM',
      expiryDate: '2026-12-04',
      open: 126000,
      high: 126000,
      low: 121461,
      close: 121770,
      previousClose: 127499,
      volumeLots: 95276,
      openInterestLots: 36582,
    }
  )
})

test('parses quoted CSV fields and excludes option contracts', () => {
  const validRow =
    '"20 Nov 2026","FUTCOM","GOLDM","04DEC2026","-",0,126000,126000,121461,121770,127499,95276,"95276.000 KGS",11033.83,36582'
  const optionRow =
    '"20 Nov 2026","OPTFUT","GOLDM","27NOV2026","PE",161500,,,,34001,34001,0,"0.000 KGS",0,0'

  const snapshot = parseProvidedBhavcopyCsv(
    `${HEADER}\r\n${validRow}\r\n${optionRow}\r\n`,
    '2026-11-21T00:00:00.000Z'
  )

  assert.equal(snapshot.rawRowCount, 2)
  assert.equal(snapshot.rows.length, 1)
  assert.equal(snapshot.rows[0].symbol, 'GOLDM')
  assert.equal(snapshot.fetchedAt, '2026-11-21T00:00:00.000Z')
})

test('rejects invalid gold-futures OHLC rows and fails malformed files', () => {
  const validOhlc =
    '"20 Nov 2026","FUTCOM","GOLDTEN","30NOV2026","-",0,124190,124802,121809,122299,128030,41078,"41078.000 KGS",1,22686'
  const invalidOhlc =
    '"20 Nov 2026","FUTCOM","GOLDM","04DEC2026","-",0,126000,120000,121461,121770,127499,95276,"95276.000 KGS",11033.83,36582'
  const snapshot = parseProvidedBhavcopyCsv(`${HEADER}\n${validOhlc}\n${invalidOhlc}`)

  assert.equal(snapshot.goldFuturesRowCount, 1)
  assert.equal(snapshot.rejectedGoldFuturesRowCount, 1)
  assert.throws(() => parseProvidedBhavcopyCsv('Date,Symbol\n20 Nov 2026,GOLDM'), /missing the/)
})
