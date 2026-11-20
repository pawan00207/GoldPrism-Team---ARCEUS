import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/db';
import {
  parseMonitorEvent,
  verifyMonitorCallbackToken,
} from '@/lib/goldprism/tinyfish-webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!verifyMonitorCallbackToken(process.env.TINYFISH_MONITOR_WEBHOOK_TOKEN, token)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const allowedMonitorIds = new Set(
    (process.env.TINYFISH_COST_MONITOR_IDS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const event = parseMonitorEvent(payload, allowedMonitorIds);
  if (!event) {
    return NextResponse.json({ error: 'Unrecognized or unauthorized Monitor event.' }, { status: 400 });
  }

  const receivedAt = new Date();
  try {
    const prisma = getPrismaClient();
    const inserted = await prisma.costModelReviewEvent.createMany({
      data: [
        {
          id: event.id,
          monitorId: event.monitorId,
          outcome: event.outcome,
          isRelevant: event.isRelevant,
          summary: event.summary,
          receivedAt,
          payload: {
            monitorId: event.monitorId,
            outcome: event.outcome,
            isRelevant: event.isRelevant,
            summary: event.summary,
          },
        },
      ],
      skipDuplicates: true,
    });

    if (inserted.count === 0) {
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    }

    await prisma.costModelReviewState.upsert({
      where: { id: 'cost-model' },
      create: {
        id: 'cost-model',
        needsReview: event.requiresReview,
        lastVerifiedAt: event.verified ? receivedAt : null,
        lastChangedAt: event.requiresReview ? receivedAt : null,
        lastSummary: event.summary,
        lastMonitorId: event.monitorId,
      },
      update: {
        ...(event.requiresReview ? { needsReview: true, lastChangedAt: receivedAt } : {}),
        ...(event.verified ? { lastVerifiedAt: receivedAt } : {}),
        lastSummary: event.summary,
        lastMonitorId: event.monitorId,
      },
    });

    console.info('TinyFish rules Monitor event received', {
      eventId: event.id,
      monitorId: event.monitorId,
      outcome: event.outcome,
      requiresReview: event.requiresReview,
    });
    if (event.requiresReview) {
      await sendTelegramAlert(
        `GoldPrism rules monitor: cost model needs review.${event.summary ? ` ${event.summary}` : ''}`
      );
    }
    return NextResponse.json({ received: true, requiresReview: event.requiresReview }, { status: 200 });
  } catch (error) {
    console.error('TinyFish rules Monitor event persistence failed', {
      errorType: error instanceof Error ? error.name : 'UnknownError',
      errorCode: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined,
    });
    return NextResponse.json({ error: 'Monitor event could not be stored.' }, { status: 503 });
  }
}

async function sendTelegramAlert(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message.slice(0, 3500) }),
      cache: 'no-store',
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) {
      console.warn('Telegram rules alert was not delivered', { statusCode: response.status });
    }
  } catch (error) {
    console.warn('Telegram rules alert failed', {
      errorType: error instanceof Error ? error.name : 'UnknownError',
    });
  }
}
