import { timingSafeEqual } from 'node:crypto';

export interface VerifiedMonitorEvent {
  id: string;
  monitorId: string;
  outcome: string;
  isRelevant: boolean | null;
  summary: string | null;
  requiresReview: boolean;
  verified: boolean;
}

export function verifyMonitorCallbackToken(
  expectedToken: string | undefined,
  providedToken: string | null
): boolean {
  if (!expectedToken || !providedToken) return false;
  const expected = Buffer.from(expectedToken);
  const provided = Buffer.from(providedToken);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export function parseMonitorEvent(
  payload: unknown,
  allowedMonitorIds: ReadonlySet<string>
): VerifiedMonitorEvent | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const monitorId =
    typeof record.fetch_monitor_id === 'string' ? record.fetch_monitor_id : '';
  const id = typeof record.id === 'string' ? record.id : '';
  const outcome = typeof record.outcome === 'string' ? record.outcome : '';
  if (!id || !allowedMonitorIds.has(monitorId)) return null;
  if (!['baseline', 'changed', 'unchanged'].includes(outcome)) return null;

  const judgment =
    typeof record.judgment === 'object' && record.judgment !== null
      ? (record.judgment as Record<string, unknown>)
      : null;
  const isRelevant =
    typeof judgment?.is_relevant === 'boolean' ? judgment.is_relevant : null;
  const hasErrors = Array.isArray(record.errors) && record.errors.length > 0;
  const summary =
    typeof judgment?.summary === 'string' ? judgment.summary.trim().slice(0, 1000) : null;

  return {
    id,
    monitorId,
    outcome,
    isRelevant,
    summary,
    verified: !hasErrors,
    requiresReview:
      hasErrors || (outcome === 'changed' && isRelevant !== false),
  };
}
