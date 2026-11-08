import { randomUUID } from 'node:crypto';
import { context, propagation, trace } from '@opentelemetry/api';
import type { NextFunction, Request, Response } from 'express';

/**
 * Gives every request a correlation_id and puts it in the Baggage, so it travels with
 * every call this request makes and every service puts it on its spans and logs.
 */
export function correlation(_req: Request, res: Response, next: NextFunction): void {
  const correlationId = randomUUID();
  res.setHeader('X-Correlation-Id', correlationId);
  // The server span started before this middleware ran, so the processor never saw it.
  trace.getActiveSpan()?.setAttribute('correlation_id', correlationId);
  const baggage = propagation.createBaggage({ correlation_id: { value: correlationId } });
  context.with(propagation.setBaggage(context.active(), baggage), next);
}
