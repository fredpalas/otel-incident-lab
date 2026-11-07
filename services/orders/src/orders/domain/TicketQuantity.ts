import { InvalidArgumentError } from '../../shared/domain/InvalidArgumentError';

export class TicketQuantity {
  static readonly MAX = 10;

  private constructor(readonly value: number) {}

  static of(value: number): TicketQuantity {
    if (!Number.isInteger(value) || value < 1 || value > TicketQuantity.MAX) {
      throw new InvalidArgumentError(`tickets must be an integer between 1 and ${TicketQuantity.MAX}`);
    }
    return new TicketQuantity(value);
  }
}
