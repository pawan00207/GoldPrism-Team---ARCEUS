import assert from 'node:assert/strict'
import { createExchangeQuoteService } from '../../src/lib/goldprism/exchange-quotes'
import { createMcxPublicationService, parseOfficialBhavcopy } from '../../src/lib/goldprism/mcx-snapshot'

const day = Date.parse('2026-11-19T12:00:00Z')
const row = { InstrumentName: 'FUTCOM', Symbol: 'GOLDM  ', Date: '11/19/2026', ExpiryDate: '04DEC2026',
  Close: 140000, Volume: 23, OpenInterest: 58 }
function html(rows: unknown[]) { return '<div id="bhavcopy-data">' + JSON.stringify(rows) + '</div>' }
const page = html([{ ...row, InstrumentName: 'OPTCOM' }, row, { ...row, ExpiryDate: '05JAN2027' }])

async function run() {
  const parsed = parseOfficialBhavcopy(page, day)
  assert.equal(parsed.status, 'MCX_EOD')
  assert.equal(parsed.bhavcopyDate, '2026-11-19')
  assert.deepEqual(parsed.contracts.GOLDM.map(c => c.expiryDate), ['04DEC2026','05JAN2027'])
  assert.deepEqual(parsed.contracts.GOLDTEN, [])
  assert.equal(parsed.contracts.GOLDM[0].close, 140000)
  assert.equal(parsed.hashScope, 'EXCHANGE_JSON_BLOCK')
  assert.equal(parsed.contentHash?.length, 64)
  assert.equal(parseOfficialBhavcopy(page, day + 2 * 86_400_000).status, 'MCX_STALE')
  assert.equal(parseOfficialBhavcopy(page, day + 5 * 86_400_000).status, 'UNAVAILABLE')
  assert.equal(parseOfficialBhavcopy(page, day - 86_400_000).status, 'UNAVAILABLE')
  assert.throws(() => parseOfficialBhavcopy(html([row, row]), day))
  assert.throws(() => parseOfficialBhavcopy(html([row, { ...row, Date: '11/18/2026' }]), day))
  assert.throws(() => parseOfficialBhavcopy(html([{ ...row, ExpiryDate: '99APR2027' }]), day))
  let requests = 0, clock = day
  const service = createMcxPublicationService(async () => {
    requests++
    if (requests > 1) throw new Error('offline')
    return page
  }, () => parsed, () => clock)
  const [first, parallel] = await Promise.all([service(), service()])
  assert.equal(first, parallel)
  assert.equal(requests, 1)
  clock += 16 * 60_000
  const fallback = await service()
  assert.equal(fallback.delivery, 'CACHED_PUBLICATION')
  assert.equal(fallback.fetchedAt, first.fetchedAt)

  const env = { GDFL_ENDPOINT: 'https://licensed.example', GDFL_API_KEY: 'test-only', GDFL_MCX_DISPLAY_ENTITLED: 'true' }
  assert.equal((await createExchangeQuoteService({ ...env, GDFL_MCX_DISPLAY_ENTITLED: 'false' }, async () => { throw new Error() })()).status, 'NOT_CONFIGURED')
  let instrumentCalls = 0, quoteCalls = 0
  const products = ['GOLDM','GOLDTEN','GOLDPETAL','GOLDGUINEA']
  const instruments = products.map(PRODUCT => ({ PRODUCT, EXCHANGE: 'MCX', NAME: 'FUTCOM', EXPIRY: '04Dec2026', IDENTIFIER: PRODUCT + '-exact-expiry' }))
  const quoteRows = instruments.map((c, i) => ({ EXCHANGE: 'MCX', INSTRUMENTIDENTIFIER: c.IDENTIFIER, LASTTRADEPRICE: 10000,
    LASTTRADETIME: i === 0 ? day / 1000 : day, BUYPRICE: 9999, SELLPRICE: 10001, BUYQTY: 2, SELLQTY: 1 }))
  clock = day
  const quotes = createExchangeQuoteService(env, async (_settings, method, params) => {
    if (method === 'GetInstruments') {
      instrumentCalls++
      return { INSTRUMENTS: [...instruments, { ...instruments[0], EXPIRY: '03Jan2027', IDENTIFIER: 'far-leg' },
        { ...instruments[0], EXPIRY: '01Oct2026', IDENTIFIER: 'expired' }] }
    }
    quoteCalls++
    assert.deepEqual(params.instrumentIdentifiers.split(' ').sort(), instruments.map(c => c.IDENTIFIER).sort())
    return quoteRows
  }, () => clock)
  const [a,b] = await Promise.all([quotes(), quotes()])
  assert.equal(a.status, 'LIVE')
  assert.equal(a.quotes.length, 4)
  assert.equal(a, b)
  assert.equal(a.quotes[0].asOf, new Date(day).toISOString())
  assert.equal(quoteCalls, 1)
  clock += 121_000
  assert.equal((await quotes()).status, 'STALE')
  assert.equal(instrumentCalls, 1)
  clock += 10_001
  quoteRows[0].LASTTRADETIME = clock
  quoteRows[1].LASTTRADETIME = clock + 300_000
  const partial = await quotes()
  assert.equal(partial.status, 'PARTIAL')
  assert.equal(partial.quotes.length, 3)
  assert.equal((await createExchangeQuoteService(env, async () => { throw new Error('sensitive') })()).status, 'UNAVAILABLE')
}
run().catch(err => { console.error(err); process.exitCode = 1 })
