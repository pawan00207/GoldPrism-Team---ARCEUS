import { calculateExposureInr } from './contract-master'
import {
  calculateTransactionCosts,
  DEFAULT_COST_CONFIG,
} from './transaction-costs'
import { MCX_MARGIN_RATE, estimateMarginRequiredInr } from './trade-engine'
import { TROY_OUNCE_GRAMS } from './gold-market'
import { WALLET_CONFIG } from './wallet-config'

export interface WalletMarketQuote {
  symbol: string
  quotedPrice: number
  source: string
  fetchedAtIst: string
}

export interface WalletCatalogItem {
  id: 'margin-topup' | 'trade-fees' | 'xray-report'
  name: string
  detail: string
  gGoldCost: number | null
  inrValue: number | null
  source: string
  asOf: string | null
}

function isUsableQuote(quote: WalletMarketQuote | null): quote is WalletMarketQuote {
  return Boolean(
    quote &&
      Number.isFinite(quote.quotedPrice) &&
      quote.quotedPrice > 0 &&
      quote.source.trim() &&
      quote.fetchedAtIst.trim()
  )
}

export function buildWalletCatalog(input: {
  paxgPriceInrPerTroyOunce: number | null
  paxgFetchedAt: string | null
  goldmQuote: WalletMarketQuote | null
  goldpetalQuote: WalletMarketQuote | null
}): WalletCatalogItem[] {
  const goldmQuote = isUsableQuote(input.goldmQuote) ? input.goldmQuote : null
  const goldpetalQuote = isUsableQuote(input.goldpetalQuote) ? input.goldpetalQuote : null
  const paxgFetchedAt =
    input.paxgFetchedAt && Number.isFinite(Date.parse(input.paxgFetchedAt))
      ? input.paxgFetchedAt
      : null
  const paxgPerGram =
    input.paxgPriceInrPerTroyOunce !== null &&
    Number.isFinite(input.paxgPriceInrPerTroyOunce) &&
    input.paxgPriceInrPerTroyOunce > 0 &&
    paxgFetchedAt !== null
      ? input.paxgPriceInrPerTroyOunce / TROY_OUNCE_GRAMS
      : null

  const marginProxyInr = goldpetalQuote
    ? estimateMarginRequiredInr(
        calculateExposureInr(goldpetalQuote.quotedPrice, 'GOLDPETAL', 1),
        'SINGLE'
      )
    : null
  const roundTripFeesInr = goldmQuote
    ? calculateTransactionCosts(
        goldmQuote.quotedPrice,
        'GOLDM',
        1,
        DEFAULT_COST_CONFIG
      ).totalRoundTripInr
    : null

  const asOfFor = (quote: WalletMarketQuote | null) =>
    quote && paxgFetchedAt
      ? `MCX page ${quote.fetchedAtIst}; CoinGecko ${paxgFetchedAt}`
      : null

  const toGGold = (valueInr: number | null) =>
    valueInr !== null && paxgPerGram !== null && paxgPerGram > 0
      ? valueInr / paxgPerGram
      : null

  const marginGGold = toGGold(marginProxyInr)
  const feeGGold = toGGold(roundTripFeesInr)
  const reportGGold = WALLET_CONFIG.xrayReportUnlockFeeGGold

  return [
    {
      id: 'margin-topup',
      name: 'Margin top-up: 1 lot GOLDPETAL',
      detail: `Margin proxy at ${(MCX_MARGIN_RATE * 100).toFixed(1)}% of current GOLDPETAL notional.`,
      gGoldCost: marginGGold,
      inrValue: marginProxyInr,
      source: goldpetalQuote
        ? `${goldpetalQuote.source} + CoinGecko PAXG`
        : 'Unavailable — GOLDPETAL and PAXG prices are required',
      asOf: asOfFor(goldpetalQuote),
    },
    {
      id: 'trade-fees',
      name: 'Prepay round-trip trade fees: 1 lot GOLDM',
      detail: 'Existing cost model total: brokerage, exchange, CTT, SEBI, GST, stamp duty, and slippage.',
      gGoldCost: feeGGold,
      inrValue: roundTripFeesInr,
      source: goldmQuote
        ? `${goldmQuote.source} + CoinGecko PAXG; existing transaction cost model`
        : 'Unavailable — GOLDM and PAXG prices are required',
      asOf: asOfFor(goldmQuote),
    },
    {
      id: 'xray-report',
      name: 'Unlock 1 live X-Ray verdict report',
      detail: `Configured report access fee: ${reportGGold} gGOLD. Access is simulated in this wallet demo.`,
      gGoldCost: reportGGold,
      inrValue: paxgPerGram === null ? null : reportGGold * paxgPerGram,
      source: 'WALLET_CONFIG fee + CoinGecko PAXG',
      asOf: paxgFetchedAt,
    },
  ]
}
