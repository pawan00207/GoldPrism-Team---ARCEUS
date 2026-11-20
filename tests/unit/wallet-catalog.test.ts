import assert from 'node:assert/strict'
import test from 'node:test'
import { buildWalletCatalog } from '../../src/lib/goldprism/wallet-catalog'
import { WALLET_CONFIG } from '../../src/lib/goldprism/wallet-config'
import { DEFAULT_COST_CONFIG, calculateTransactionCosts } from '../../src/lib/goldprism/transaction-costs'
import { MCX_MARGIN_RATE } from '../../src/lib/goldprism/trade-engine'

test('wallet catalog converts live market costs into gGOLD using PAXG per gram', () => {
  const catalog = buildWalletCatalog({
    // Test fixture only: prices are deterministic inputs for the calculation test.
    paxgPriceInrPerTroyOunce: 300_000,
    paxgFetchedAt: '2026-11-20T10:00:00.000Z',
    goldmQuote: {
      symbol: 'GOLDM',
      quotedPrice: 75_000,
      source: 'MCX test fixture',
      fetchedAtIst: '20 Nov 2026, 3:30 pm IST',
    },
    goldpetalQuote: {
      symbol: 'GOLDPETAL',
      quotedPrice: 7_500,
      source: 'MCX test fixture',
      fetchedAtIst: '20 Nov 2026, 3:30 pm IST',
    },
  })

  assert.equal(catalog.length, 3)
  const paxgPricePerGram = 300_000 / 31.1035
  const expectedMarginInr = 7_500 * MCX_MARGIN_RATE
  const expectedFeesInr = calculateTransactionCosts(75_000, 'GOLDM', 1, DEFAULT_COST_CONFIG).totalRoundTripInr
  assert.equal(catalog[0].inrValue, expectedMarginInr)
  assert.equal(catalog[0].gGoldCost, expectedMarginInr / paxgPricePerGram)
  assert.equal(catalog[1].inrValue, expectedFeesInr)
  assert.equal(catalog[1].gGoldCost, expectedFeesInr / paxgPricePerGram)
  assert.equal(catalog[2].gGoldCost, WALLET_CONFIG.xrayReportUnlockFeeGGold)
  assert.match(catalog[0].source, /CoinGecko PAXG/)
  assert.match(catalog[0].asOf ?? '', /MCX page.*CoinGecko/)
})

test('wallet catalog withholds market-priced items when quotes are unavailable', () => {
  const catalog = buildWalletCatalog({
    paxgPriceInrPerTroyOunce: null,
    paxgFetchedAt: null,
    goldmQuote: null,
    goldpetalQuote: null,
  })

  assert.equal(catalog[0].gGoldCost, null)
  assert.equal(catalog[1].gGoldCost, null)
  assert.equal(catalog[0].inrValue, null)
  assert.equal(catalog[2].inrValue, null)
  assert.match(catalog[0].source, /Unavailable/)
})

test('wallet catalog rejects invalid live quote values', () => {
  const catalog = buildWalletCatalog({
    paxgPriceInrPerTroyOunce: 300_000,
    paxgFetchedAt: '2026-11-20T10:00:00.000Z',
    goldmQuote: {
      symbol: 'GOLDM',
      quotedPrice: 0,
      source: 'MCX test fixture',
      fetchedAtIst: '20 Nov 2026, 3:30 pm IST',
    },
    goldpetalQuote: {
      symbol: 'GOLDPETAL',
      quotedPrice: Number.NaN,
      source: 'MCX test fixture',
      fetchedAtIst: '20 Nov 2026, 3:30 pm IST',
    },
  })

  assert.equal(catalog[0].gGoldCost, null)
  assert.equal(catalog[1].gGoldCost, null)
})
