import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getAllContractSpecs,
  SUPPORTED_CONTRACTS,
} from '@/lib/goldprism/contract-master'
import {
  compareContracts,
  costSensitivity,
  explainVerdict,
  liquidityRanking,
  strongestSurvivingOpportunity,
} from '@/lib/goldprism/analyst-tools'
import {
  getSnapshotAsOf,
  loadDatasetProvenance,
} from '@/lib/goldprism/historical-store'
import { rankBestVehicleForExposure } from '@/lib/goldprism/signal'

export const runtime = 'nodejs'
export const maxDuration = 60

const requestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(4000),
      })
    )
    .min(1)
    .max(20),
})

function pairFromQuestion(question: string) {
  const found = SUPPORTED_CONTRACTS.filter((symbol) =>
    question.toUpperCase().includes(symbol)
  )
  const contractA = found[0] ?? 'GOLDTEN'
  const contractB =
    found[1] ??
    (contractA === 'GOLDM' ? 'GOLDTEN' : 'GOLDM')
  return { contractA, contractB }
}

function answerQuestion(question: string): string {
  const q = question.toLowerCase()
  const provenance = loadDatasetProvenance()
  const snapshot = getSnapshotAsOf(provenance.dateRangeEnd)
  const asOf = snapshot.resolvedTradeDate ?? provenance.dateRangeEnd

  if (/(contract specifications|contract master|specification|purity|expiry window)/i.test(q)) {
    const contracts = getAllContractSpecs()
      .map(
        (spec) =>
          `- **${spec.contractCode}** (${spec.name}): ${spec.tradingUnitG}g trading unit, quoted per ${spec.quoteUnitG}g, ${spec.purityFine}/1000 fineness; typical expiry ${spec.expiryWindow}. Verification: ${spec.verificationStatus}.`
      )
      .join('\n')
    return `### Contract master\n${contracts}\n\nSource: versioned GoldPrism contract master. Historical market observations in this workspace end on **${asOf}**.`
  }

  if (/(best vehicle|which .*contract|physical hedge|exposure|hedge)/i.test(q)) {
    const match = q.match(/(\d+(?:\.\d+)?)\s*(?:g|gm|gram|grams)\b/i)
    const targetGrams = match ? Number(match[1]) : 50
    if (!Number.isFinite(targetGrams) || targetGrams < 1 || targetGrams > 10000) {
      return 'Provide a target exposure between 1g and 10,000g to rank hedge vehicles.'
    }

    const prices: Partial<Record<(typeof SUPPORTED_CONTRACTS)[number], number>> = {}
    for (const symbol of SUPPORTED_CONTRACTS) {
      const row = snapshot.recordsOnResolvedDate
        .filter((record) => record.symbol === symbol && record.expiryDate >= asOf && record.settle > 0)
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))[0]
      if (row) prices[symbol] = row.settle
    }
    if (
      prices.GOLDM === undefined ||
      prices.GOLDTEN === undefined ||
      prices.GOLDGUINEA === undefined ||
      prices.GOLDPETAL === undefined
    ) {
      return `Vehicle ranking is unavailable: the ${asOf} Bhavcopy snapshot does not contain a valid quote for every supported contract.`
    }

    const ranking = rankBestVehicleForExposure(targetGrams, {
      GOLDM: prices.GOLDM,
      GOLDTEN: prices.GOLDTEN,
      GOLDGUINEA: prices.GOLDGUINEA,
      GOLDPETAL: prices.GOLDPETAL,
    })
    const rows = ranking.map(
      (vehicle) =>
        `${vehicle.rank}. **${vehicle.contractCode}** — ${vehicle.lotsRequired} lot(s), ${vehicle.actualExposureG}g exposure (${vehicle.exposureMismatchPct}% mismatch), estimated round-trip cost ${vehicle.estimatedCostBps} bps.`
    )
    return `### Historical hedge-vehicle ranking for ${targetGrams}g\n${rows.join('\n')}\n\nRanked from the ${asOf} MCX Bhavcopy close and GoldPrism's deterministic cost model. This is a historical reference, not a live MCX quote or broker instruction.`
  }

  if (/(liquid|volume|open interest|\boi\b|quiet trading)/i.test(q)) {
    const result = liquidityRanking(asOf)
    if (result.status !== 'OK') return `Liquidity data unavailable: ${result.message ?? 'no records found'}.`
    return `### Liquidity on ${result.asOf}\nBest by gram-notional volume: **${result.bestContractByGramNotional ?? 'N/A'}**. Best by contract count: **${result.bestContractByLots ?? 'N/A'}**.\n\n${result.rankings
      .map(
        (row) =>
          `${row.rank}. **${row.symbol}** — ${row.totalVolumeContracts.toLocaleString('en-IN')} contracts (${row.gramEquivalentVolume.toLocaleString('en-IN')}g notional), OI ${row.totalOpenInterestContracts.toLocaleString('en-IN')}. Volume gate: ${row.passesVolumeGate ? 'passed' : 'failed'}.`
      )
      .join('\n')}\n\nSource: ${result.source}.`
  }

  if (/(cost|fee|brokerage|hurdle|sensitivity)/i.test(q)) {
    const result = costSensitivity(1.2, asOf, 'GOLDTEN_GOLDM')
    if (result.status !== 'OK') return `Cost analysis unavailable: ${result.message ?? 'no records found'}.`
    return `### GOLDTEN/GOLDM cost sensitivity on ${result.asOf}\nBaseline: ${result.baselineCostsBps} bps cost, ${result.baselineNetEdgeBps} bps net edge (**${result.baselineVerdict}**).\n\nAt 1.2× costs: ${result.scaledCostsBps} bps cost, ${result.scaledNetEdgeBps} bps net edge (**${result.scaledVerdict}**).\n\nSource: ${result.source}.`
  }

  if (/(strongest|surviving opportunity)/i.test(q)) {
    const result = strongestSurvivingOpportunity()
    if (!result.bestOpportunity) {
      return `No surviving opportunity is recorded in the verified ${provenance.datasetName} evaluation (${result.totalSnapshotsEvaluated} pair-days evaluated).`
    }
    const best = result.bestOpportunity
    return `### Strongest surviving historical opportunity\nDate: **${best.tradeDate}** (${best.partition}); pair: **${best.pairLabel}**. Net edge: **${best.netEdgeBps} bps** (${best.verdict}) after ${best.transactionCostsBps} bps transaction costs.\n\nThis is the strongest record in the audited dataset, not a current signal.`
  }

  if (/(data quality|data trust|stale|missing contract|integrity)/i.test(q)) {
    const counts = Object.fromEntries(
      snapshot.availableContractsOnDate.map((symbol) => [
        symbol,
        snapshot.recordsOnResolvedDate.filter((row) => row.symbol === symbol).length,
      ])
    )
    return `### Historical data checks (${asOf})\nMarket status: **${snapshot.marketStatus}**; stale by ${snapshot.staleDays} calendar day(s). Records available through date: ${snapshot.rowsAvailableUpToAsOf}; trading dates: ${snapshot.tradingDaysAvailableUpToAsOf}.\n\nAvailable contracts: ${snapshot.availableContractsOnDate.join(', ') || 'none'}.\nMissing contracts: ${snapshot.missingContractsOnDate.join(', ') || 'none'}.\n\nSource: ${provenance.datasetName}; SHA-256 ${provenance.sha256Hash}. This check describes the bundled historical archive, not live-feed freshness.`
  }

  const { contractA, contractB } = pairFromQuestion(question)
  const comparison = compareContracts(contractA, contractB, asOf)
  if (comparison.status !== 'OK' || !comparison.decomposition) {
    return `Comparison unavailable: ${comparison.message ?? 'no matching contract data'}`
  }
  const waterfall = comparison.decomposition
  const extra =
    /verdict|no edge|filter|why/i.test(q)
      ? `\n\n${explainVerdict(`${asOf}:${contractA}_${contractB}`).verdictMessage ?? 'No verdict message is available for this pair.'}`
      : ''
  return `### Historical X-Ray: ${contractA} vs ${contractB}\nAs of **${comparison.asOf}** (${comparison.source}): normalized premium ${comparison.normalizedPremium10g} ₹/10g (${comparison.normalizedPremiumBps} bps).\n\n- Structural basis: ${waterfall.purityEffectBps} bps\n- Expiry carry: ${waterfall.expiryCarryBps} bps\n- Other residual: ${waterfall.residualOtherBps} bps\n- Estimated round-trip costs: ${waterfall.transactionCostsBps} bps\n- Net edge: **${waterfall.netEdgeBps} bps** — **${waterfall.verdict}**${extra}\n\nThese figures are calculated from the bundled historical Bhavcopy; they are not live MCX quotes.`
}

export async function POST(req: NextRequest) {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Malformed JSON body' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid message history', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const lastUserMessage = [...parsed.data.messages]
    .reverse()
    .find((message) => message.role === 'user')?.content.trim()
  if (!lastUserMessage) {
    return NextResponse.json({ error: 'A user message is required' }, { status: 400 })
  }

  try {
    return NextResponse.json({
      content: answerQuestion(lastUserMessage),
      engine: 'GoldPrism deterministic research tools',
      source: 'Bundled MCX Bhavcopy archive',
    })
  } catch (error) {
    console.error('Agent API error:', error)
    return NextResponse.json(
      {
        error: 'Unable to calculate an answer from the historical research data.',
        details: error instanceof Error ? error.message : 'Unknown server error',
      },
      { status: 500 }
    )
  }
}
