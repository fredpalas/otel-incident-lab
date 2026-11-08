import { context, propagation } from '@opentelemetry/api';

/**
 * Metadata of an event recorded during the current request. Captured now, while the
 * request's context is active: the outbox relay publishes later, outside of it.
 */
export function causedByCurrentRequest(): { correlationId?: string; causationId?: string; headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  propagation.inject(context.active(), headers);
  const correlationId = propagation.getActiveBaggage()?.getEntry('correlation_id')?.value;
  // The checkout request is both the conversation and the direct cause of its events.
  return { correlationId, causationId: correlationId, headers };
}
