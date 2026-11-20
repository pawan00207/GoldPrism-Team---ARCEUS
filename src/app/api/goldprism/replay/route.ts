import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  computeFullReplaySummary,
  computeReplayAtDate,
  loadDatasetProvenance,
  loadHistoricalBhavcopyRows,
  REPLAY_PAIRS,
  ReplayPairId,
} from '@/lib/goldprism/historical-store';

export const runtime = 'nodejs';

const ReplayQuerySchema = z.object({
  as_of: z.iso.date().optional(),
  pair: z
    .enum(['GOLDM_CALENDAR', 'GOLDTEN_GOLDM', 'GOLDGUINEA_GOLDM', 'GOLDPETAL_GOLDM'])
    .optional(),
  reveal: z.enum(['0', '1', 'true', 'false']).optional(),
  include_summary: z.enum(['0', '1', 'true', 'false']).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const params = {
      as_of: req.nextUrl.searchParams.get('as_of') ?? undefined,
      pair: req.nextUrl.searchParams.get('pair') ?? undefined,
      reveal: req.nextUrl.searchParams.get('reveal') ?? undefined,
      include_summary: req.nextUrl.searchParams.get('include_summary') ?? undefined,
    };

    const parsed = ReplayQuerySchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid replay query parameters', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const provenance = loadDatasetProvenance();
    const pairId: ReplayPairId = parsed.data.pair ?? 'GOLDM_CALENDAR';
    const asOf = parsed.data.as_of ?? provenance.holdoutStartDate;
    const reveal = parsed.data.reveal === '1' || parsed.data.reveal === 'true';
    const includeSummary =
      parsed.data.include_summary === '1' || parsed.data.include_summary === 'true';

    const replay = computeReplayAtDate(asOf, { pairId, reveal });
    const summary = includeSummary ? computeFullReplaySummary(pairId, undefined, asOf) : undefined;

    return NextResponse.json({
      replay,
      summary,
      availableDates: includeSummary ? [...new Set(loadHistoricalBhavcopyRows().map(row => row.tradeDate))].sort() : undefined,
      pairs: Object.values(REPLAY_PAIRS),
    });
  } catch (err) {
    console.error('Replay API error:', err);
    return NextResponse.json(
      {
        error: 'Failed to compute point-in-time replay',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
