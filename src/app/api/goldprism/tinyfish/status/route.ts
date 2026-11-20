import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/db';
import { checkTinyFishHealth } from '@/lib/goldprism/tinyfish';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

interface IngestionRunSummary {
  source: string;
  status: string;
  fetchedAt: Date | null;
  tradeDate: Date;
}

export async function GET() {
  const tinyFishHealth = await checkTinyFishHealth();
  let latestRun: IngestionRunSummary | null = null;
  let lastSuccessfulRun: IngestionRunSummary | null = null;
  let reviewState: {
    needsReview: boolean;
    lastVerifiedAt: Date | null;
    lastChangedAt: Date | null;
    lastSummary: string | null;
  } | null = null;
  let sourceLogRows: Array<{
    tsIst: Date;
    sourceName: string;
    method: string;
    url: string;
    status: string;
    latencyMs: number;
    rowsReturned: number;
    note: string | null;
  }> = [];
  let crossCheckRows: Array<{
    tradeDate: Date;
    symbol: string;
    expiry: Date;
    settleA: number;
    settleB: number | null;
    diffBps: number | null;
    state: string;
    sourceBUrl: string | null;
    checkedAtIst: Date;
  }> = [];
  let persistenceAvailable = Boolean(process.env.DATABASE_URL);

  if (persistenceAvailable) {
    try {
      const prisma = getPrismaClient();
      [latestRun, lastSuccessfulRun, reviewState, sourceLogRows, crossCheckRows] = await Promise.all([
        prisma.ingestionRun.findFirst({
          orderBy: [{ tradeDate: 'desc' }, { receivedAt: 'desc' }],
          select: { source: true, status: true, fetchedAt: true, tradeDate: true },
        }),
        prisma.ingestionRun.findFirst({
          where: { status: 'ACCEPTED', fetchedAt: { not: null } },
          orderBy: [{ fetchedAt: 'desc' }],
          select: { source: true, status: true, fetchedAt: true, tradeDate: true },
        }),
        prisma.costModelReviewState.findUnique({
          where: { id: 'cost-model' },
          select: {
            needsReview: true,
            lastVerifiedAt: true,
            lastChangedAt: true,
            lastSummary: true,
          },
        }),
        prisma.sourceLog.findMany({
          orderBy: [{ tsIst: 'desc' }],
          take: 200,
          select: {
            tsIst: true,
            sourceName: true,
            method: true,
            url: true,
            status: true,
            latencyMs: true,
            rowsReturned: true,
            note: true,
          },
        }),
        prisma.crossCheck.findMany({
          orderBy: [{ tradeDate: 'desc' }, { checkedAtIst: 'desc' }],
          take: 100,
          select: {
            tradeDate: true,
            symbol: true,
            expiry: true,
            settleA: true,
            settleB: true,
            diffBps: true,
            state: true,
            sourceBUrl: true,
            checkedAtIst: true,
          },
        }),
      ]);
    } catch (error) {
      persistenceAvailable = false;
      console.error('TinyFish status persistence unavailable', {
        errorType: error instanceof Error ? error.name : 'UnknownError',
        errorCode: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined,
      });
    }
  }

  const primaryStatus =
    latestRun === null
      ? 'UNKNOWN'
      : latestRun.source === 'mcxlib'
        ? latestRun.status === 'ACCEPTED'
          ? 'HEALTHY'
          : 'REJECTED'
        : 'DEGRADED';

  const latestBySource = new Map<string, (typeof sourceLogRows)[number]>();
  for (const row of sourceLogRows) {
    const key = `${row.sourceName}:${row.method}`;
    if (!latestBySource.has(key)) latestBySource.set(key, row);
  }
  const istNow = new Date(Date.now() + 330 * 60_000);
  const istTodayStart = new Date(
    Date.UTC(
      istNow.getUTCFullYear(),
      istNow.getUTCMonth(),
      istNow.getUTCDate(),
      0,
      0,
      0,
    ) - 330 * 60_000
  );
  const todayRows = sourceLogRows.filter((row) => row.tsIst >= istTodayStart);
  const failuresToday = todayRows.filter((row) =>
    ['failed', 'timeout', 'empty'].includes(row.status)
  ).length;
  const successfulRows = sourceLogRows.filter((row) => row.status === 'ok');
  const lastSuccessfulFullRefresh = successfulRows.length
    ? successfulRows[0].tsIst.toISOString()
    : null;
  const latestCrossChecks = crossCheckRows.filter((row) =>
    row.tradeDate.getTime() ===
    (crossCheckRows[0]?.tradeDate.getTime() ?? Number.NaN)
  );
  const matchCount = latestCrossChecks.filter((row) => row.state === 'MATCH').length;
  const mismatchRows = latestCrossChecks.filter((row) => row.state === 'MISMATCH');
  const unverifiedCount = latestCrossChecks.filter((row) => row.state === 'UNVERIFIED').length;
  const maxDiff = latestCrossChecks.length
    ? Math.max(...latestCrossChecks.map((row) => row.diffBps ?? 0))
    : null;
  const settlementSummary =
    latestCrossChecks.length === 0
      ? 'Settlement cross-check: UNVERIFIED — no live cross-check data'
      : mismatchRows.length > 0
        ? `Settlement cross-check: MISMATCH — ${mismatchRows[0].symbol} ${mismatchRows[0].expiry.toISOString().slice(0, 10)}`
        : unverifiedCount > 0
          ? `Settlement cross-check: UNVERIFIED — ${unverifiedCount} single-source row(s)`
          : `Settlement cross-check: ${matchCount}/${latestCrossChecks.length} MATCH${maxDiff !== null ? `, max diff ${maxDiff.toFixed(2)} bps` : ''}`;

  return NextResponse.json(
    {
      sources: {
        bhavcopyPrimary: {
          name: 'Bhavcopy primary (mcxlib)',
          status: primaryStatus,
          lastRunAt: latestRun?.fetchedAt?.toISOString() ?? null,
          tradeDate: latestRun?.tradeDate.toISOString().slice(0, 10) ?? null,
          detail: latestRun
            ? latestRun.source === 'mcxlib'
              ? `Latest ingestion status: ${latestRun.status}.`
              : `Latest successful source was ${latestRun.source}; mcxlib did not supply that run.`
            : 'No Python ingestion run has been reported to this deployment.',
        },
        tinyFishFallback: {
          name: 'TinyFish fallback',
          status: !tinyFishHealth.configured
            ? 'UNAVAILABLE'
            : !tinyFishHealth.healthy
              ? 'UNAVAILABLE'
              : latestRun?.source === 'tinyfish'
                ? 'USED'
                : 'READY',
          detail: !tinyFishHealth.configured
            ? 'TINYFISH_API_KEY is not configured.'
            : tinyFishHealth.healthy
              ? latestRun?.source === 'tinyfish'
                ? 'TinyFish supplied the latest ingestion run.'
                : 'Configured; invoked only after mcxlib retries fail.'
              : 'TinyFish is configured but its health check failed.',
        },
        tinyFishApi: tinyFishHealth,
        lastSuccessfulFetch: lastSuccessfulRun
          ? {
              source: lastSuccessfulRun.source,
              fetchedAt: lastSuccessfulRun.fetchedAt?.toISOString() ?? null,
              tradeDate: lastSuccessfulRun.tradeDate.toISOString().slice(0, 10),
            }
          : null,
        persistence: persistenceAvailable ? 'AVAILABLE' : 'UNAVAILABLE',
        costModelReview: reviewState
          ? {
              status: 'AVAILABLE',
              needsReview: reviewState.needsReview,
              lastVerifiedAt: reviewState.lastVerifiedAt?.toISOString() ?? null,
              lastChangedAt: reviewState.lastChangedAt?.toISOString() ?? null,
              lastSummary: reviewState.lastSummary,
            }
          : {
              status: persistenceAvailable ? 'NO_MONITOR_EVENTS' : 'UNAVAILABLE',
              needsReview: null,
              lastVerifiedAt: null,
              lastChangedAt: null,
              lastSummary: null,
            },
        sourceRadar: {
          rows: Array.from(latestBySource.values()).map((row) => ({
            sourceName: row.sourceName,
            method: row.method,
            checkedAt: row.tsIst.toISOString(),
            status: row.status,
            latencyMs: row.latencyMs,
            rowsReturned: row.rowsReturned,
            url: row.url,
          })),
          counters: {
            sourcesCheckedToday: new Set(todayRows.map((row) => row.sourceName)).size,
            failuresToday,
            lastSuccessfulFullRefresh,
          },
          settlementCrossCheck: settlementSummary,
          crossCheckActiveSince:
            process.env.CROSS_CHECK_ACTIVE_SINCE ?? '2026-11-20',
        },
    },
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
