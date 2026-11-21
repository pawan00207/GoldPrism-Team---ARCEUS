import { NextResponse } from 'next/server'
import { loadProvidedBhavcopySnapshot } from '@/lib/goldprism/provided-bhavcopy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 10

export async function GET() {
  try {
    return NextResponse.json(loadProvidedBhavcopySnapshot(), {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not load the research Bhavcopy.'
    console.error('[goldprism/bhavcopy] Snapshot load failed:', message)

    return NextResponse.json(
      { status: 'UNAVAILABLE', error: message },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    )
  }
}
