import { InvalidArgumentError } from '../../shared/domain/InvalidArgumentError';

/** What a customer submits from the storefront. */
export class Checkout {
  private constructor(
    readonly customerId: string,
    readonly eventId: string,
    readonly tickets: number,
  ) {}

  static of(customerId: string, eventId: string, tickets: number): Checkout {
    if (customerId.trim() === '') throw new InvalidArgumentError('customerId is required');
    if (eventId.trim() === '') throw new InvalidArgumentError('eventId is required');
    if (!Number.isInteger(tickets) || tickets < 1) throw new InvalidArgumentError('tickets must be a positive integer');
    return new Checkout(customerId.trim(), eventId.trim(), tickets);
  }
}
