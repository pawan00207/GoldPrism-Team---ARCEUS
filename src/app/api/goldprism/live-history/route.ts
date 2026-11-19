import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPrismaClient } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(60),
});

export async function GET(req: NextRequest) {
  const parsed = QuerySchema.safeParse({
    limit: req.nextUrl.searchParams.get('limit') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { status: 'UNAVAILABLE', error: 'PostgreSQL market history is unavailable.' },
      { status: 503 }
    );
  }

  try {
    const records = await getPrismaClient().marketSnapshot.findMany({
      take: parsed.data.limit,
      orderBy: { bucketAt: 'desc' },
      select: {
        bucketAt: true,
        asOf: true,
        status: true,
        payload: true,
      },
    });

    return NextResponse.json(
      {
        status: 'CONNECTED',
        records,
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    const errorType = error instanceof Error ? error.name : 'UnknownError';
    const errorCode =
      error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
    console.error('Live market history query failed', { errorType, errorCode });
    return NextResponse.json(
      { status: 'UNAVAILABLE', error: 'PostgreSQL market history is unavailable.' },
      { status: 503 }
    );
  }
}
