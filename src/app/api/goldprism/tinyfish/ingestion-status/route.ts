import { timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SOURCES = new Set(['mcxlib', 'tinyfish', 'cache', 'unavailable']);

function matchesToken(expected: string, provided: string | null): boolean {
  if (!provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

export async function POST(request: NextRequest) {
  const expectedToken = process.env.INGESTION_STATUS_TOKEN;
  if (!expectedToken) {
    return NextResponse.json({ error: 'Ingestion status bridge is not configured.' }, { status: 503 });
  }

  const authorization = request.headers.get('authorization');
  const providedToken = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;
  if (!matchesToken(expectedToken, providedToken)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Expected a JSON object.' }, { status: 400 });
    }
    payload = body as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const tradeDate = payload.requested_date;
  const fetchedAt = payload.fetched_at;
  const source = payload.source;
  const status = payload.ingestion_status;
  if (
    typeof tradeDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(tradeDate) ||
    (fetchedAt !== null && typeof fetchedAt !== 'string') ||
    typeof source !== 'string' ||
    !SOURCES.has(source) ||
    (status !== 'ACCEPTED' && status !== 'REJECTED')
  ) {
    return NextResponse.json({ error: 'Ingestion status payload is invalid.' }, { status: 400 });
  }

  const tradeDateValue = new Date(`${tradeDate}T00:00:00.000Z`);
  const fetchedAtValue = typeof fetchedAt === 'string' ? new Date(fetchedAt) : null;
  if (Number.isNaN(tradeDateValue.getTime()) || (fetchedAtValue && Number.isNaN(fetchedAtValue.getTime()))) {
    return NextResponse.json({ error: 'Ingestion status contains an invalid date.' }, { status: 400 });
  }

  try {
    const dataHealth = JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue;
    const prisma = getPrismaClient();
    await prisma.ingestionRun.upsert({
      where: {
        tradeDate_source: {
          tradeDate: tradeDateValue,
          source,
        },
      },
      create: {
        tradeDate: tradeDateValue,
        fetchedAt: fetchedAtValue,
        source,
        status,
        dataHealth,
      },
      update: {
        fetchedAt: fetchedAtValue,
        status,
        dataHealth,
        receivedAt: new Date(),
      },
    });
    const sourceLog = Array.isArray(payload.source_log) ? payload.source_log : [];
    await Promise.all(
      sourceLog
        .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
        .map(async (row) => {
          const tsIst =
            typeof row.ts_ist === 'string' ? new Date(row.ts_ist) : null;
          if (
            !tsIst ||
            Number.isNaN(tsIst.getTime()) ||
            typeof row.source_name !== 'string' ||
            typeof row.method !== 'string' ||
            typeof row.url !== 'string' ||
            typeof row.status !== 'string'
          ) return;
          await prisma.sourceLog.create({
            data: {
              tsIst,
              sourceName: row.source_name,
              method: row.method,
              url: row.url,
              status: row.status,
              latencyMs: typeof row.latency_ms === 'number' ? row.latency_ms : 0,
              rowsReturned: typeof row.rows_returned === 'number' ? row.rows_returned : 0,
              note: typeof row.note === 'string' ? row.note.slice(0, 500) : null,
            },
          });
        })
    );
    const crossChecks = Array.isArray(payload.cross_check) ? payload.cross_check : [];
    await Promise.all(
      crossChecks
        .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
        .map(async (row) => {
          if (
            typeof row.trade_date !== 'string' ||
            typeof row.symbol !== 'string' ||
            typeof row.expiry !== 'string' ||
            typeof row.state !== 'string'
          ) return;
          const tradeDateValue = new Date(`${row.trade_date}T00:00:00.000Z`);
          const expiryValue = new Date(`${row.expiry}T00:00:00.000Z`);
          const checkedAt = typeof row.checked_at_ist === 'string'
            ? new Date(row.checked_at_ist)
            : null;
          if (
            Number.isNaN(tradeDateValue.getTime()) ||
            Number.isNaN(expiryValue.getTime()) ||
            !checkedAt ||
            Number.isNaN(checkedAt.getTime())
          ) return;
          await prisma.crossCheck.upsert({
            where: {
              tradeDate_symbol_expiry: {
                tradeDate: tradeDateValue,
                symbol: row.symbol,
                expiry: expiryValue,
              },
            },
            create: {
              tradeDate: tradeDateValue,
              symbol: row.symbol,
              expiry: expiryValue,
              settleA: typeof row.settle_a === 'number' ? row.settle_a : 0,
              settleB: typeof row.settle_b === 'number' ? row.settle_b : null,
              diffBps: typeof row.diff_bps === 'number' ? row.diff_bps : null,
              state: row.state,
              sourceBUrl: typeof row.source_b_url === 'string' ? row.source_b_url : null,
              checkedAtIst: checkedAt,
            },
            update: {
              settleA: typeof row.settle_a === 'number' ? row.settle_a : 0,
              settleB: typeof row.settle_b === 'number' ? row.settle_b : null,
              diffBps: typeof row.diff_bps === 'number' ? row.diff_bps : null,
              state: row.state,
              sourceBUrl: typeof row.source_b_url === 'string' ? row.source_b_url : null,
              checkedAtIst: checkedAt,
            },
          });
        })
    );
    return NextResponse.json({ stored: true }, { status: 200 });
  } catch (error) {
    console.error('Ingestion status persistence failed', {
      errorType: error instanceof Error ? error.name : 'UnknownError',
      errorCode: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined,
    });
    return NextResponse.json({ error: 'Ingestion status could not be stored.' }, { status: 503 });
  }
}
