import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { z } from 'zod'
import { SupportedContractCode } from '@/lib/goldprism/contract-master'
import { compareNormalizedContracts, contractSpecs } from '@/lib/goldprism/contract-specs'
import { getLiveGoldFeed, LiveFeedResponse } from '@/lib/goldprism/live-feed'
import { rankBestVehicleForExposure } from '@/lib/goldprism/signal'
import { TradeIntentInput } from '@/lib/goldprism/trade-engine'
import { computeXRayWaterfall, DEFAULT_COST_HURDLE_BPS } from '@/lib/goldprism/xray'

export const runtime = 'nodejs'
export const maxDuration = 60

const CopilotRequestSchema = z.object({
  message: z.string().min(1).max(1200),
  mode: z.enum(['gemini', 'deterministic']).optional().default('gemini'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(2400),
      })
    )
    .max(10)
    .optional(),
  portfolioSummary: z
    .object({
      cashInr: z.number(),
      equityInr: z.number(),
      openCount: z.number(),
      unrealizedPnlInr: z.number(),
    })
    .optional(),
  targetExposureG: z.number().min(1).max(10000).optional(),
})

interface StructuredCopilotOutput {
  reply: string
  shouldSuggestTrade: boolean
  tradeKind?: 'SINGLE' | 'SPREAD'
  tradeSide?: 'BUY' | 'SELL' | 'SHORT_A_LONG_B' | 'LONG_A_SHORT_B'
  contractA?: SupportedContractCode
  lotsA?: number
  contractB?: SupportedContractCode
  lotsB?: number
  rationale?: string
}

function buildDeterministicQuantReply(params: {
  message: string
  liveFeed: LiveFeedResponse
  targetG: number
  carryProxy: number
  portfolioSummary?: {
    cashInr: number
    equityInr: number
    openCount: number
    unrealizedPnlInr: number
  }
}): { reply: string; suggestedIntent: TradeIntentInput | null } {
  const { message, liveFeed, targetG, carryProxy, portfolioSummary } = params
  const contracts = liveFeed.contracts!
  const tradeDate = liveFeed.asOf.slice(0, 10)
  const q = message.toLowerCase()
  const isHinglish = /(abhi|karna|kya|batao|chahiye|hai|kitna|mera|meri|paisa|sahi)/i.test(message)

  const xrayGoldtenM = computeXRayWaterfall({
    contractA: 'GOLDTEN',
    priceAQuoted: contracts.GOLDTEN.quotedPrice,
    expiryA: contracts.GOLDTEN.expiryDate,
    contractB: 'GOLDM',
    priceBQuoted: contracts.GOLDM.quotedPrice,
    expiryB: contracts.GOLDM.expiryDate,
    tradeDate,
    annualCarryRate: carryProxy,
    settlementArtifactInrPerG: 0,
  })

  const normalized = compareNormalizedContracts(
    (['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'] as const).map((sym) => ({
      symbol: sym,
      quotedPrice: contracts[sym].quotedPrice,
      expiryDate: contracts[sym].expiryDate,
      asOf: contracts[sym].asOf,
      source: contracts[sym].source,
    })),
    'GOLDM'
  )

  const bestVehicles = rankBestVehicleForExposure(targetG, {
    GOLDM: contracts.GOLDM.quotedPrice,
    GOLDTEN: contracts.GOLDTEN.quotedPrice,
    GOLDGUINEA: contracts.GOLDGUINEA.quotedPrice,
    GOLDPETAL: contracts.GOLDPETAL.quotedPrice,
  })
  const top = bestVehicles[0]

  // 1. Portfolio / Margin check
  if (/(position|margin|risk|portfolio|equity|pnl|account)/i.test(q) && portfolioSummary) {
    const { cashInr, equityInr, openCount, unrealizedPnlInr } = portfolioSummary
    const reply = isHinglish
      ? `Live account snapshot (as_of ${liveFeed.asOf.slice(0, 19).replace('T', ' ')} UTC): Equity ₹${equityInr.toLocaleString('en-IN')}, Free Margin ₹${cashInr.toLocaleString('en-IN')}, Open Positions: ${openCount}, MTM P&L: ${unrealizedPnlInr >= 0 ? '+' : ''}₹${unrealizedPnlInr.toLocaleString('en-IN')}. Abhi GOLDTEN vs GOLDM X-Ray verdict ${xrayGoldtenM.verdict} (${xrayGoldtenM.netEdgeBps.toFixed(1)} bps) hai — over-leverage mat karein.`
      : `Live portfolio snapshot (as_of ${liveFeed.asOf.slice(0, 19).replace('T', ' ')} UTC): Equity ₹${equityInr.toLocaleString('en-IN')}, Available Margin ₹${cashInr.toLocaleString('en-IN')}, Open Positions: ${openCount}, MTM P&L: ${unrealizedPnlInr >= 0 ? '+' : ''}₹${unrealizedPnlInr.toLocaleString('en-IN')}. Current GOLDTEN/GOLDM X-Ray verdict is ${xrayGoldtenM.verdict} (${xrayGoldtenM.netEdgeBps.toFixed(1)} bps). Keep margin utilization conservative until spreads clear ${DEFAULT_COST_HURDLE_BPS.toFixed(1)} bps.`

    return { reply, suggestedIntent: null }
  }

  // 2. 10g Pure-gold normalization breakdown
  if (/(normali|10g|purity|compare|995|999)/i.test(q)) {
    const lines = normalized
      .map(
        (r) =>
          `${r.symbol} (${r.spec.tradingUnitGrams}g, ${r.spec.purity}): Raw ₹${Math.round(r.quotedPrice).toLocaleString('en-IN')} → 10g Pure ₹${r.normalized10gPrice.toLocaleString('en-IN')} (${r.symbol === 'GOLDM' ? 'Baseline' : `${r.spreadVsBaselineBps >= 0 ? '+' : ''}${r.spreadVsBaselineBps.toFixed(1)} bps vs GOLDM`})`
      )
      .join('\n')

    const reply = `${isHinglish ? 'Live 10g pure-gold normalization' : 'Live 10g pure-gold normalization'} (P_10g = (P_q × 10) / (q × p), as_of ${liveFeed.asOf.slice(0, 19).replace('T', ' ')} UTC):\n${lines}`
    return { reply, suggestedIntent: null }
  }

  // 3. Hedge / Gram exposure / Best vehicle recommendation
  if (/(hedge|gram|gm|vehicle|best|buy|sell|lot|goldm|goldten|guinea|petal|\d+\s*g)/i.test(q) && !/(spread|xray|x-ray)/i.test(q)) {
    const qTop = contracts[top.contractCode]
    const suggestedIntent: TradeIntentInput = {
      kind: 'SINGLE',
      side: /\bsell\b|\bshort\b/i.test(q) ? 'SELL' : 'BUY',
      contractA: top.contractCode,
      priceA: qTop.quotedPrice,
      lotsA: top.lotsRequired,
      expiryA: qTop.expiryDate,
      rationale: top.rationale,
      sourceLabel: `Quant Engine · ${qTop.source}`,
      asOf: qTop.asOf,
    }
    const reply = isHinglish
      ? `${targetG}g gold exposure ke liye best vehicle ${top.lotsRequired} × ${top.contractCode} (${top.actualExposureG}g fitted, ${top.exposureMismatchPct}% mismatch) hai @ ₹${Math.round(qTop.quotedPrice).toLocaleString('en-IN')}. Estimated round-trip statutory cost ${top.estimatedCostBps.toFixed(1)} bps hai. Neeche 1-Click Execute ticket ready hai.`
      : `For ${targetG}g physical exposure, the optimal vehicle is ${top.lotsRequired} × ${top.contractCode} (${top.actualExposureG}g fitted, ${top.exposureMismatchPct}% mismatch) quoted at ₹${Math.round(qTop.quotedPrice).toLocaleString('en-IN')} with ${top.estimatedCostBps.toFixed(1)} bps estimated round-trip friction. Review the verified 1-Click ticket below.`
    return { reply, suggestedIntent }
  }

  // 4. Default: X-Ray Spread Decomposition & Discipline Check (GOLDTEN vs GOLDM)
  const side = xrayGoldtenM.netEdgeInrPerG >= 0 ? 'SHORT_A_LONG_B' : 'LONG_A_SHORT_B'
  const spreadIntent: TradeIntentInput = {
    kind: 'SPREAD',
    side,
    contractA: 'GOLDTEN',
    priceA: contracts.GOLDTEN.quotedPrice,
    lotsA: 1,
    expiryA: contracts.GOLDTEN.expiryDate,
    contractB: 'GOLDM',
    priceB: contracts.GOLDM.quotedPrice,
    lotsB: 1,
    expiryB: contracts.GOLDM.expiryDate,
    verdict: xrayGoldtenM.verdict,
    netEdgeBps: xrayGoldtenM.netEdgeBps,
    netEdgeInrPerG: xrayGoldtenM.netEdgeInrPerG,
    rationale: xrayGoldtenM.verdictMessage,
    sourceLabel: 'Quant Engine · Live Parity X-Ray',
    asOf: liveFeed.asOf,
  }

  const reply = isHinglish
    ? `GOLDTEN vs GOLDM live X-Ray (${liveFeed.asOf.slice(0, 19).replace('T', ' ')} UTC): Raw gap ${xrayGoldtenM.rawSpreadBps.toFixed(1)} bps, Basis −${xrayGoldtenM.structuralBasisBps.toFixed(1)} bps, Carry −${xrayGoldtenM.expiryCarryBps.toFixed(1)} bps, Costs −${xrayGoldtenM.transactionCostsBps.toFixed(1)} bps → Net Edge ${xrayGoldtenM.netEdgeBps.toFixed(1)} bps. Verdict: ${xrayGoldtenM.verdict}. ${xrayGoldtenM.verdict === 'TRADABLE' ? 'Residual hurdle ke upar hai, paper trade test kar sakte hain.' : 'Discipline rule: abhi fee hurdle (5.0 bps) clear nahi ho raha, isliye jabardasti spread trade mat lein (sirf paper-test override ke liye card neeche hai).'}`
    : `GOLDTEN vs GOLDM live X-Ray (${liveFeed.asOf.slice(0, 19).replace('T', ' ')} UTC): Raw gap ${xrayGoldtenM.rawSpreadBps.toFixed(1)} bps, Basis −${xrayGoldtenM.structuralBasisBps.toFixed(1)} bps, Carry −${xrayGoldtenM.expiryCarryBps.toFixed(1)} bps, Statutory Costs −${xrayGoldtenM.transactionCostsBps.toFixed(1)} bps → Net Edge ${xrayGoldtenM.netEdgeBps.toFixed(1)} bps. Verdict: ${xrayGoldtenM.verdict}. ${xrayGoldtenM.verdict === 'TRADABLE' ? 'Net residual clears the 5.0 bps hurdle.' : 'Discipline gate active: residual does not clear fees, so skip forced spread entries unless explicitly paper-testing below.'}`

  return { reply, suggestedIntent: spreadIntent }
}

export async function POST(req: NextRequest) {
  let body: z.infer<typeof CopilotRequestSchema>
  try {
    const raw = await req.json()
    const parsed = CopilotRequestSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request payload', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    body = parsed.data
  } catch {
    return NextResponse.json({ error: 'Malformed JSON body' }, { status: 400 })
  }

  const liveFeed = await getLiveGoldFeed(false)
  if (liveFeed.status !== 'LIVE_PARITY' || !liveFeed.contracts) {
    return NextResponse.json(
      {
        error: `Live parity feed is currently unavailable (${liveFeed.error ?? 'upstream timeout'}). Please retry in a few seconds.`,
      },
      { status: 503 }
    )
  }

  const contracts = liveFeed.contracts
  const carryProxy =
    typeof liveFeed.benchmarks.comexBasisAnnualizedPct === 'number' &&
    liveFeed.benchmarks.comexBasisAnnualizedPct > 0 &&
    liveFeed.benchmarks.comexBasisAnnualizedPct < 20
      ? liveFeed.benchmarks.comexBasisAnnualizedPct / 100
      : 0.065

  const gramsMatch = body.message.match(/(\d+(?:\.\d+)?)\s*(?:g|gm|gram|grams)/i)
  const targetG = gramsMatch
    ? Math.min(10000, Math.max(1, Number(gramsMatch[1])))
    : body.targetExposureG ?? 50

  // Explicit Deterministic Quant Engine mode (never silently masquerades as Gemini)
  if (body.mode === 'deterministic') {
    const result = buildDeterministicQuantReply({
      message: body.message,
      liveFeed,
      targetG,
      carryProxy,
      portfolioSummary: body.portfolioSummary,
    })
    return NextResponse.json({
      reply: result.reply,
      suggestedIntent: result.suggestedIntent,
      asOf: liveFeed.asOf,
      engine: 'deterministic-quant',
      model: 'GoldPrism Quant Rules Engine (No LLM)',
    })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'GEMINI_API_KEY is not configured in server secrets. Configure your Gemini API key in Settings > Secrets, or switch to the Deterministic Quant Engine.',
        canUseDeterministicFallback: true,
      },
      { status: 503 }
    )
  }

  const tradeDate = liveFeed.asOf.slice(0, 10)
  const xrayGoldtenM = computeXRayWaterfall({
    contractA: 'GOLDTEN',
    priceAQuoted: contracts.GOLDTEN.quotedPrice,
    expiryA: contracts.GOLDTEN.expiryDate,
    contractB: 'GOLDM',
    priceBQuoted: contracts.GOLDM.quotedPrice,
    expiryB: contracts.GOLDM.expiryDate,
    tradeDate,
    annualCarryRate: carryProxy,
    settlementArtifactInrPerG: 0,
  })

  const xrayGuineaM = computeXRayWaterfall({
    contractA: 'GOLDGUINEA',
    priceAQuoted: contracts.GOLDGUINEA.quotedPrice,
    expiryA: contracts.GOLDGUINEA.expiryDate,
    contractB: 'GOLDM',
    priceBQuoted: contracts.GOLDM.quotedPrice,
    expiryB: contracts.GOLDM.expiryDate,
    tradeDate,
    annualCarryRate: carryProxy,
    settlementArtifactInrPerG: 0,
  })

  const bestVehicles = rankBestVehicleForExposure(targetG, {
    GOLDM: contracts.GOLDM.quotedPrice,
    GOLDTEN: contracts.GOLDTEN.quotedPrice,
    GOLDGUINEA: contracts.GOLDGUINEA.quotedPrice,
    GOLDPETAL: contracts.GOLDPETAL.quotedPrice,
  })

  const liveContext = {
    asOf: liveFeed.asOf,
    benchmarks: liveFeed.benchmarks,
    contracts: Object.fromEntries(
      (['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'] as const).map((sym) => [
        sym,
        {
          quotedPriceInr: contracts[sym].quotedPrice,
          normalized10gPureGoldInr: contracts[sym].normalized10gPrice,
          tradingUnitGrams: contractSpecs[sym].tradingUnitGrams,
          quotedPerGrams: contractSpecs[sym].quotedPerGrams,
          purity: contractSpecs[sym].purity,
          expiryDate: contracts[sym].expiryDate,
        },
      ])
    ),
    liveXRayPairs: {
      GOLDTEN_vs_GOLDM: {
        rawSpreadBps: xrayGoldtenM.rawSpreadBps,
        structuralBasisBps: xrayGoldtenM.structuralBasisBps,
        expiryCarryBps: xrayGoldtenM.expiryCarryBps,
        grossResidualBps: xrayGoldtenM.grossResidualBps,
        transactionCostsBps: xrayGoldtenM.transactionCostsBps,
        netEdgeBps: xrayGoldtenM.netEdgeBps,
        hurdleBps: DEFAULT_COST_HURDLE_BPS,
        verdict: xrayGoldtenM.verdict,
        verdictTitle: xrayGoldtenM.verdictTitle,
      },
      GOLDGUINEA_vs_GOLDM: {
        rawSpreadBps: xrayGuineaM.rawSpreadBps,
        structuralBasisBps: xrayGuineaM.structuralBasisBps,
        expiryCarryBps: xrayGuineaM.expiryCarryBps,
        grossResidualBps: xrayGuineaM.grossResidualBps,
        transactionCostsBps: xrayGuineaM.transactionCostsBps,
        netEdgeBps: xrayGuineaM.netEdgeBps,
        verdict: xrayGuineaM.verdict,
      },
    },
    bestVehicleForGrams: {
      targetExposureG: targetG,
      ranked: bestVehicles.map((r) => ({
        rank: r.rank,
        contract: r.contractCode,
        lots: r.lotsRequired,
        fittedGrams: r.actualExposureG,
        mismatchPct: r.exposureMismatchPct,
        costBps: r.estimatedCostBps,
      })),
    },
    userPortfolio: body.portfolioSummary ?? null,
  }

  const systemInstruction = `You are GoldPrism Trade Copilot (Team ARCEUS), an honest quantitative MCX Gold trading & risk-discipline assistant.
Core Philosophy ("GoldPrism Idea"):
1. Normalize heterogeneous MCX contracts (GOLDM 100g/995, GOLDTEN 10g/999, GOLDGUINEA 8g/999, GOLDPETAL 1g/999) to 10g pure gold via P_10g = (P_q * 10) / (q * p).
2. Decompose spreads cleanly: Raw Spread -> Structural Basis -> Expiry Carry -> Settlement Artifact -> Gross Residual -> Round-Trip Statutory Costs (Brokerage Rs 30/lot/side, MCX 0.0026%, CTT 0.01% sell-side, 18% GST, 0.002% Stamp buy-side, 2 bps slippage/leg) -> Net Edge.
3. Discipline first: If a spread verdict is NO EDGE or BLOCKED, clearly tell the trader NOT to force a bad spread trade unless hedging physical exposure or deliberately paper-testing.
4. Language: Match the user's language (friendly Hinglish if they ask in Hindi/Hinglish, or crisp English otherwise). Keep answers under 180 words, clear, structured, and cite ONLY exact numbers from LIVE_MARKET_CONTEXT below. Never invent prices or metrics.
5. One-Click Trade Suggestion: If the user asks what to buy/sell/hedge or wants to execute a trade, set shouldSuggestTrade=true and populate tradeKind, tradeSide, contractA, lotsA (and contractB/lotsB if SPREAD), and a short rationale so the UI shows a 1-Click Execute card. Otherwise set shouldSuggestTrade=false.`

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  })

  const conversationBlock = (body.history ?? [])
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'Trader' : 'Copilot'}: ${m.content}`)
    .join('\n')

  const promptText = `LIVE_MARKET_CONTEXT (exact authoritative values as of ${liveFeed.asOf}):
${JSON.stringify(liveContext, null, 2)}

${conversationBlock ? `RECENT CONVERSATION:\n${conversationBlock}\n\n` : ''}TRADER QUESTION:
${body.message}`

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: promptText,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description:
                'Clear explanation grounded strictly in LIVE_MARKET_CONTEXT, matching user language.',
            },
            shouldSuggestTrade: {
              type: Type.BOOLEAN,
              description:
                'True only if recommending a concrete single-contract hedge or spread paper trade.',
            },
            tradeKind: {
              type: Type.STRING,
              enum: ['SINGLE', 'SPREAD'],
            },
            tradeSide: {
              type: Type.STRING,
              enum: ['BUY', 'SELL', 'SHORT_A_LONG_B', 'LONG_A_SHORT_B'],
            },
            contractA: {
              type: Type.STRING,
              enum: ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'],
            },
            lotsA: {
              type: Type.INTEGER,
            },
            contractB: {
              type: Type.STRING,
              enum: ['GOLDM', 'GOLDTEN', 'GOLDGUINEA', 'GOLDPETAL'],
            },
            lotsB: {
              type: Type.INTEGER,
            },
            rationale: {
              type: Type.STRING,
            },
          },
          required: ['reply', 'shouldSuggestTrade'],
        },
      },
    })

    const rawText = (response.text ?? '{}').trim()
    const parsedJson = JSON.parse(rawText) as StructuredCopilotOutput

    let suggestedIntent: TradeIntentInput | null = null
    if (parsedJson.shouldSuggestTrade && parsedJson.contractA) {
      const cA = parsedJson.contractA
      const qA = contracts[cA]
      const lotsA = Math.max(1, Math.min(50, parsedJson.lotsA ?? 1))

      if (parsedJson.tradeKind === 'SPREAD' && parsedJson.contractB) {
        const cB = parsedJson.contractB
        const qB = contracts[cB]
        const lotsB = Math.max(1, Math.min(50, parsedJson.lotsB ?? 1))
        const spreadCalc = computeXRayWaterfall({
          contractA: cA,
          priceAQuoted: qA.quotedPrice,
          expiryA: qA.expiryDate,
          lotsA,
          contractB: cB,
          priceBQuoted: qB.quotedPrice,
          expiryB: qB.expiryDate,
          lotsB,
          tradeDate,
          annualCarryRate: carryProxy,
          settlementArtifactInrPerG: 0,
        })
        suggestedIntent = {
          kind: 'SPREAD',
          side:
            parsedJson.tradeSide === 'LONG_A_SHORT_B' ? 'LONG_A_SHORT_B' : 'SHORT_A_LONG_B',
          contractA: cA,
          priceA: qA.quotedPrice,
          lotsA,
          expiryA: qA.expiryDate,
          contractB: cB,
          priceB: qB.quotedPrice,
          lotsB,
          expiryB: qB.expiryDate,
          verdict: spreadCalc.verdict,
          netEdgeBps: spreadCalc.netEdgeBps,
          netEdgeInrPerG: spreadCalc.netEdgeInrPerG,
          rationale: parsedJson.rationale ?? spreadCalc.verdictMessage,
          sourceLabel: 'GoldPrism Copilot · Live Parity',
          asOf: liveFeed.asOf,
        }
      } else {
        suggestedIntent = {
          kind: 'SINGLE',
          side: parsedJson.tradeSide === 'SELL' ? 'SELL' : 'BUY',
          contractA: cA,
          priceA: qA.quotedPrice,
          lotsA,
          expiryA: qA.expiryDate,
          rationale:
            parsedJson.rationale ??
            `Copilot matched ${lotsA} lot (${contractSpecs[cA].tradingUnitGrams * lotsA}g) ${cA} at live parity.`,
          sourceLabel: qA.source,
          asOf: qA.asOf,
        }
      }
    }

    return NextResponse.json({
      reply: parsedJson.reply,
      suggestedIntent,
      asOf: liveFeed.asOf,
      engine: 'gemini',
      model: 'gemini-4-hydrogen',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED')) {
      return NextResponse.json(
        {
          error:
            'The configured GEMINI_API_KEY is invalid or lacks permission. Please verify or select a valid Gemini API key in Settings > Secrets, or switch to the Deterministic Quant Engine.',
          canUseDeterministicFallback: true,
        },
        { status: 502 }
      )
    }
    return NextResponse.json(
      {
        error: `Gemini Trade Copilot request failed: ${msg}`,
        canUseDeterministicFallback: true,
      },
      { status: 502 }
    )
  }
}
