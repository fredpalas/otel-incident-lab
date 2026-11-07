import { randomBytes } from 'node:crypto';
import { env } from './env.ts';

export interface CheckoutResult {
  status: number;
  body: unknown;
  /** Set when the request was sent with our own traceparent (see newTraceId). */
  traceId?: string;
}

/** A W3C trace id we choose, so we can fetch exactly this request's trace from Tempo. */
export const newTraceId = (): string => randomBytes(16).toString('hex');

export async function checkout(
  customerId: string,
  { tickets = 2, eventId = 'evt_1', traceId }: { tickets?: number; eventId?: string; traceId?: string } = {},
): Promise<CheckoutResult> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (traceId) headers.traceparent = `00-${traceId}-${randomBytes(8).toString('hex')}-01`;
  try {
    const res = await fetch(`${env.gatewayUrl}/checkout`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ customerId, eventId, tickets }),
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // non-JSON error pages are fine, keep the text
    }
    return { status: res.status, body, traceId };
  } catch (err) {
    return { status: 0, body: (err as Error).message, traceId };
  }
}

export async function checkouts(customerId: string, count: number): Promise<CheckoutResult[]> {
  return Promise.all(Array.from({ length: count }, () => checkout(customerId)));
}

/** Concurrent checkouts, each one in its own trace that we pick. */
export async function tracedCheckouts(customerId: string, count: number): Promise<CheckoutResult[]> {
  return Promise.all(Array.from({ length: count }, () => checkout(customerId, { traceId: newTraceId() })));
}
