import { NextRequest, NextResponse } from 'next/server';
import { getLiveGoldFeed } from '@/lib/goldprism/live-feed';
import { archiveLiveMarketSnapshot } from '@/lib/goldprism/market-snapshot-archive';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1';
    const payload = await getLiveGoldFeed(forceRefresh);
    const archive = await archiveLiveMarketSnapshot(payload);
    return NextResponse.json({ ...payload, archive }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'UNAVAILABLE',
        error: err instanceof Error ? err.message : 'Live market feed error',
        asOf: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
