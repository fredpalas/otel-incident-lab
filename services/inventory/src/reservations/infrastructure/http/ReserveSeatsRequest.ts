import { BadRequestException } from '@nestjs/common';
import type { ReserveSeatsCommand } from '../../application/ReserveSeatsCommand';

/** Shape validation at the HTTP edge; business rules live in the domain value objects. */
export function parseReserveSeatsRequest(body: unknown): ReserveSeatsCommand {
  const input = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const { orderId, eventId, seats } = input;
  if (typeof orderId !== 'string' || typeof eventId !== 'string' || typeof seats !== 'number') {
    throw new BadRequestException('expected { orderId: string, eventId: string, seats: number }');
  }
  return { orderId, eventId, seats };
}
