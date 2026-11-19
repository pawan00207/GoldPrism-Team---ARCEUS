import { NextRequest, NextResponse } from 'next/server';
import { getMcxSnapshot } from '@/lib/goldprism/mcx-snapshot';

export const dynamic = 'force-dynamic';

/**
 * Real MCX market snapshot for the gold family, fetched from MCX by
 * scripts/fetch_mcx_snapshot.py (via the `mcxdata` package) on a schedule.
 *
 * Status semantics:
 *   MCX_LIVE     - fetched within the last 30 minutes
 *   MCX_STALE    - snapshot older than that (weekends / session gaps / fetch gaps)
 *   UNAVAILABLE  - missing/corrupt/too old snapshot; fields are null, never fabricated
 */
export async function GET(_req: NextRequest) {
  try {
    const payload = getMcxSnapshot();
    return NextResponse.json(payload, {
      status: 200,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'UNAVAILABLE',
        source: 'mcx_data (MCX India public bhavcopy & spot feeds)',
        fetchedAt: null,
        ageMinutes: null,
        bhavcopyDate: null,
        spot: null,
        contracts: { GOLDM: [], GOLDTEN: [], GOLDGUINEA: [], GOLDPETAL: [] },
        notice: null,
        contentHash: null,
        error: err instanceof Error ? err.message : 'MCX snapshot read failed',
      },
      { status: 500 }
    );
  }
}
