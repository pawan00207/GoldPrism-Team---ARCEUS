import { getLatestMcxPublication } from '@/lib/goldprism/mcx-snapshot'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const publication = await getLatestMcxPublication()
  return Response.json(publication, {
    headers: { 'Cache-Control': 'no-store' },
    status: publication.status === 'UNAVAILABLE' ? 503 : 200,
  })
}
