import { env } from './env.ts';

export interface CheckoutResult {
  status: number;
  body: unknown;
}

export async function checkout(customerId: string, tickets = 2, eventId = 'evt_1'): Promise<CheckoutResult> {
  try {
    const res = await fetch(`${env.gatewayUrl}/checkout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
    return { status: res.status, body };
  } catch (err) {
    return { status: 0, body: (err as Error).message };
  }
}

export async function checkouts(customerId: string, count: number): Promise<CheckoutResult[]> {
  return Promise.all(Array.from({ length: count }, () => checkout(customerId)));
}
