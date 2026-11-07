import { BadRequestException } from '@nestjs/common';
import type { PayCommand } from '../../application/PayCommand';

/** Shape validation at the HTTP edge; business rules live in the domain value objects. */
export function parsePayRequest(body: unknown): PayCommand {
  const input = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const { orderId, customerId, amountCents, currency } = input;
  if (
    typeof orderId !== 'string' ||
    typeof customerId !== 'string' ||
    typeof amountCents !== 'number' ||
    typeof currency !== 'string'
  ) {
    throw new BadRequestException('expected { orderId: string, customerId: string, amountCents: number, currency: string }');
  }
  return { orderId, customerId, amountCents, currency };
}
