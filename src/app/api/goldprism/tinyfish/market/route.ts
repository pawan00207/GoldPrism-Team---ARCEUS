import { getTinyFishMarketWatch } from '@/lib/goldprism/tinyfish'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 90

export async function GET() {
  const market = await getTinyFishMarketWatch()
  return Response.json(market, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}
