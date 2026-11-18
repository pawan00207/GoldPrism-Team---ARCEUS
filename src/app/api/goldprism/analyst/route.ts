import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SupportedContractCode } from '@/lib/goldprism/contract-master';
import {
  compareContracts,
  costSensitivity,
  explainVerdict,
  liquidityRanking,
  strongestSurvivingOpportunity,
  ToolArtifactBase,
} from '@/lib/goldprism/analyst-tools';
import { validateResponseGrounding } from '@/lib/goldprism/number-grounding';

export const runtime = 'nodejs';
export const maxDuration = 60;

// In-memory sliding window rate limiter: 20 requests per 60s per client key
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const rateBuckets = new Map<string, number[]>();

function checkRateLimit(clientKey: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const prev = rateBuckets.get(clientKey) ?? [];
  const fresh = prev.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  if (fresh.length >= RATE_LIMIT_MAX) {
    const oldest = fresh[0];
    const retryAfterSec = Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldest)) / 1000));
    rateBuckets.set(clientKey, fresh);
    return { allowed: false, retryAfterSec };
  }
  fresh.push(now);
  rateBuckets.set(clientKey, fresh);
  return { allowed: true, retryAfterSec: 0 };
}

const AnalystRequestSchema = z.object({
  question: z.string().min(1).max(1200).optional(),
  asOf: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  action: z.enum(['chat', 'report']).optional().default('chat'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(4000),
      })
    )
    .max(12)
    .optional(),
});

/**
 * Deterministic router mapping natural-language questions to verified quant engine tools.
 */
function selectToolsForQuestion(question: string, asOf?: string): ToolArtifactBase[] {
  const q = question.toLowerCase();
  const results: ToolArtifactBase[] = [];

  if (
    q.includes('premium') ||
    q.includes('discount') ||
    q.includes('compare') ||
    q.includes('purity') ||
    q.includes('goldpetal') ||
    q.includes('goldguinea') ||
    q.includes('goldten')
  ) {
    const contracts: SupportedContractCode[] = [];
    if (q.includes('goldpetal')) contracts.push('GOLDPETAL');
    if (q.includes('goldguinea')) contracts.push('GOLDGUINEA');
    if (q.includes('goldten')) contracts.push('GOLDTEN');
    if (q.includes('goldm')) contracts.push('GOLDM');
    const a = contracts[0] ?? 'GOLDPETAL';
    const b = contracts[1] ?? (a === 'GOLDM' ? 'GOLDTEN' : 'GOLDM');
    results.push(compareContracts(a, b, asOf));
  }

  if (q.includes('liquid') || q.includes('volume') || q.includes('open interest') || q.includes('oi')) {
    results.push(liquidityRanking(asOf));
  }

  if (q.includes('no edge') || q.includes('verdict') || q.includes('why did') || q.includes('filter')) {
    results.push(explainVerdict(`${asOf ?? 'latest'}:GOLDTEN_GOLDM`));
  }

  if (q.includes('cost') || q.includes('increase') || q.includes('20%') || q.includes('sensitivity') || q.includes('fee')) {
    const pctMatch = q.match(/(\d+(?:\.\d+)?)\s*%/);
    const mult = pctMatch ? 1 + Number(pctMatch[1]) / 100 : 1.2;
    results.push(costSensitivity(mult, asOf, 'GOLDTEN_GOLDM'));
  }

  if (q.includes('strongest') || q.includes('best') || q.includes('surviv') || q.includes('opportunity')) {
    results.push(strongestSurvivingOpportunity());
  }

  if (results.length === 0) {
    results.push(explainVerdict(`${asOf ?? 'latest'}:GOLDTEN_GOLDM`));
    results.push(liquidityRanking(asOf));
  }

  return results;
}

function buildStrictGroundedSummaryFromArtifacts(artifacts: ToolArtifactBase[]): string {
  const lines: string[] = [];
  for (const art of artifacts) {
    if (art.status === 'NO_DATA') {
      lines.push(
        `[${art.artifactId}] (${art.toolName}, as_of ${art.asOf}): Unavailable — ${art.message}`
      );
      continue;
    }

    if (art.toolName === 'compareContracts') {
      const a = art as ReturnType<typeof compareContracts>;
      lines.push(
        `[${a.artifactId}] **${a.contractA} vs ${a.contractB}** (as_of \`${a.asOf}\`, source: ${a.source}):\n` +
          `- Quoted: ${a.contractA} = ₹${a.quotedPriceA} (exp ${a.expiryA}), ${a.contractB} = ₹${a.quotedPriceB} (exp ${a.expiryB})\n` +
          `- Normalized 10 g pure gold: ${a.contractA} = ₹${a.normalized10gA}, ${a.contractB} = ₹${a.normalized10gB} (premium/discount: ${a.normalizedPremium10g} ₹/10g, ${a.normalizedPremiumBps} bps)\n` +
          (a.decomposition
            ? `- Decomposition: Purity/structural basis = ${a.decomposition.purityEffectBps} bps (${a.decomposition.purityEffectInrPerG} ₹/g), Expiry carry = ${a.decomposition.expiryCarryBps} bps (${a.decomposition.expiryCarryInrPerG} ₹/g), Gross residual = ${a.decomposition.residualOtherBps} bps, Round-trip costs = ${a.decomposition.transactionCostsBps} bps, Net edge = ${a.decomposition.netEdgeBps} bps → Verdict: **${a.decomposition.verdict}**.`
            : '')
      );
    } else if (art.toolName === 'liquidityRanking') {
      const l = art as ReturnType<typeof liquidityRanking>;
      lines.push(
        `[${l.artifactId}] **Liquidity Ranking** (as_of \`${l.asOf}\`, source: ${l.source}):\n` +
          `- Best by gram-notional volume: **${l.bestContractByGramNotional}**; Best by contract count: **${l.bestContractByLots}**.\n` +
          l.rankings
            .map(
              (r) =>
                `  ${r.rank}. ${r.symbol} (${r.tradingUnitG}g): ${r.totalVolumeContracts} contracts (${r.gramEquivalentVolume}g notional), OI ${r.totalOpenInterestContracts} contracts, near expiry ${r.nearExpiry}.`
            )
            .join('\n')
      );
    } else if (art.toolName === 'explainVerdict') {
      const e = art as ReturnType<typeof explainVerdict>;
      lines.push(
        `[${e.artifactId}] **Verdict Audit for ${e.signalId}** (as_of \`${e.asOf}\`):\n` +
          `- Verdict: **${e.verdict}** — ${e.verdictTitle}\n` +
          (e.waterfall
            ? `- Waterfall (bps): Raw ${e.waterfall.rawSpreadBps}, Basis ${e.waterfall.structuralBasisBps}, Carry ${e.waterfall.expiryCarryBps}, Residual ${e.waterfall.grossResidualBps}, Costs ${e.waterfall.transactionCostsBps}, Net edge ${e.waterfall.netEdgeBps} (hurdle ${e.waterfall.costHurdleBps} bps).\n`
            : '') +
          `- Failing filters: ${e.failingFilters.join('; ') || 'None'}`
      );
    } else if (art.toolName === 'costSensitivity') {
      const c = art as ReturnType<typeof costSensitivity>;
      lines.push(
        `[${c.artifactId}] **Cost Sensitivity (${c.multiplier}x)** (as_of \`${c.asOf}\`, pair ${c.pairId}):\n` +
          `- Baseline costs: ${c.baselineCostsBps} bps (${c.baselineCostsInrPerG} ₹/g) → Net edge ${c.baselineNetEdgeBps} bps (**${c.baselineVerdict}**)\n` +
          `- Scaled (${c.multiplier}x) costs: ${c.scaledCostsBps} bps (${c.scaledCostsInrPerG} ₹/g) → Net edge ${c.scaledNetEdgeBps} bps (**${c.scaledVerdict}**)\n` +
          `- Delta: +${c.deltaCostsBps} bps cost drag, ${c.deltaNetEdgeBps} bps net edge.`
      );
    } else if (art.toolName === 'strongestSurvivingOpportunity') {
      const s = art as ReturnType<typeof strongestSurvivingOpportunity>;
      if (s.bestOpportunity) {
        const b = s.bestOpportunity;
        lines.push(
          `[${s.artifactId}] **Strongest Surviving Opportunity** (evaluated ${s.totalSnapshotsEvaluated} pair-days; ${s.survivingOpportunitiesCount} survived):\n` +
            `- Date: \`${b.tradeDate}\` (${b.partition}), Pair: **${b.pairLabel}** (${b.legA} exp ${b.expiryA} vs ${b.legB} exp ${b.expiryB})\n` +
            `- Raw ${b.rawSpreadBps} bps, Basis ${b.structuralBasisBps} bps, Carry ${b.expiryCarryBps} bps → Gross residual ${b.grossResidualBps} bps − Costs ${b.transactionCostsBps} bps = Net edge **${b.netEdgeBps} bps** (${b.netEdgeInrPerG} ₹/g) → **${b.verdict}** (config ${b.configHash}).`
        );
      }
    }
  }
  return lines.join('\n\n');
}

function encodeSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const clientIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local-client';
  const rate = checkRateLimit(clientIp);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } }
    );
  }

  let body: z.infer<typeof AnalystRequestSchema>;
  try {
    const raw = await req.json();
    const parsed = AnalystRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: 'Malformed JSON body' }, { status: 400 });
  }

  if (body.action === 'report') {
    const asOf = body.asOf;
    const artifacts: ToolArtifactBase[] = [
      compareContracts('GOLDPETAL', 'GOLDM', asOf),
      compareContracts('GOLDTEN', 'GOLDM', asOf),
      liquidityRanking(asOf),
      explainVerdict(`${asOf ?? 'latest'}:GOLDTEN_GOLDM`),
      costSensitivity(1.2, asOf, 'GOLDTEN_GOLDM'),
      strongestSurvivingOpportunity(),
    ];
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      artifacts,
      markdown: buildStrictGroundedSummaryFromArtifacts(artifacts),
    });
  }

  const question = body.question?.trim();
  if (!question) {
    return NextResponse.json({ error: 'question is required for chat action' }, { status: 400 });
  }

  const artifacts = selectToolsForQuestion(question, body.asOf);
  const artifactIds = artifacts.map((a) => a.artifactId);
  const deterministicReadout = buildStrictGroundedSummaryFromArtifacts(artifacts);
  const grounding = validateResponseGrounding(deterministicReadout, artifacts, artifactIds);

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(
          encodeSseEvent('meta', {
            mode: 'deterministic_engine',
            artifacts,
          })
        )
      );
      controller.enqueue(encoder.encode(encodeSseEvent('token', { text: deterministicReadout })));
      controller.enqueue(encoder.encode(encodeSseEvent('grounding', grounding)));
      controller.enqueue(encoder.encode(encodeSseEvent('done', { ok: true })));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
