import { getExchangeQuotes } from '@/lib/goldprism/exchange-quotes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const snapshot = await getExchangeQuotes()
  return Response.json(snapshot, {
    headers: { 'Cache-Control': 'private, no-store' },
    status: snapshot.status === 'UNAVAILABLE' ? 503 : 200,
  })
}
