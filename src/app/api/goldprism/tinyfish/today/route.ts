import { NextResponse } from 'next/server';
import {
  getTinyFishMarketContext,
  getTinyFishMarketWatch,
} from '@/lib/goldprism/tinyfish';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const [market, context] = await Promise.all([
    getTinyFishMarketWatch(),
    getTinyFishMarketContext(),
  ]);
  return NextResponse.json(
    { market, context },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
