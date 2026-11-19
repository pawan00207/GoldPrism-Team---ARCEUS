import 'server-only';

import { Prisma } from '@prisma/client';
import type { LiveFeedResponse } from '@/lib/goldprism/live-feed';
import { getPrismaClient } from '@/lib/db';

export type MarketSnapshotArchiveStatus = {
  status: 'saved' | 'already_saved' | 'skipped' | 'unavailable';
  bucketAt?: string;
  message?: string;
};

const MINUTE_MS = 60_000;

export async function archiveLiveMarketSnapshot(
  feed: LiveFeedResponse
): Promise<MarketSnapshotArchiveStatus> {
  if (feed.status !== 'LIVE_PARITY' || !feed.contracts) {
    return {
      status: 'skipped',
      message: 'A complete live parity feed is required to archive a snapshot.',
    };
  }

  if (!process.env.DATABASE_URL) {
    return {
      status: 'unavailable',
      message: 'Configure DATABASE_URL and apply the PostgreSQL migration to enable market history.',
    };
  }

  const bucketAt = new Date(Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS);

  try {
    const asOf = new Date(feed.asOf);
    if (Number.isNaN(asOf.getTime())) {
      throw new Error('Live feed returned an invalid as-of timestamp');
    }

    const payload = JSON.parse(JSON.stringify(feed)) as Prisma.InputJsonValue;
    const result = await getPrismaClient().marketSnapshot.createMany({
      data: [
        {
          bucketAt,
          asOf,
          status: feed.status,
          payload,
        },
      ],
      skipDuplicates: true,
    });

    return {
      status: result.count === 1 ? 'saved' : 'already_saved',
      bucketAt: bucketAt.toISOString(),
    };
  } catch (error) {
    const errorType = error instanceof Error ? error.name : 'UnknownError';
    const errorCode =
      error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
    console.error('Live market snapshot archive failed', { errorType, errorCode });
    return {
      status: 'unavailable',
      bucketAt: bucketAt.toISOString(),
      message: 'The live feed is available, but its PostgreSQL archive is unavailable.',
    };
  }
}
