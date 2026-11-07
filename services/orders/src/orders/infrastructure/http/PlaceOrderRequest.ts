import { BadRequestException } from '@nestjs/common';
import type { PlaceOrderCommand } from '../../application/PlaceOrderCommand';

/** Shape validation at the HTTP edge; business rules live in the domain value objects. */
export function parsePlaceOrderRequest(body: unknown): PlaceOrderCommand {
  const input = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const { customerId, eventId, tickets } = input;
  if (typeof customerId !== 'string' || typeof eventId !== 'string' || typeof tickets !== 'number') {
    throw new BadRequestException('expected { customerId: string, eventId: string, tickets: number }');
  }
  return { customerId, eventId, tickets };
}
