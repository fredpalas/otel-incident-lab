import { InvalidArgumentError } from '../../shared/domain/InvalidArgumentError';

const STATUSES = ['PENDING', 'PAID', 'FAILED', 'NOTIFIED'] as const;
type Status = (typeof STATUSES)[number];

export class OrderStatus {
  static readonly PENDING = new OrderStatus('PENDING');
  static readonly PAID = new OrderStatus('PAID');
  static readonly FAILED = new OrderStatus('FAILED');
  static readonly NOTIFIED = new OrderStatus('NOTIFIED');

  private constructor(readonly value: Status) {}

  static of(value: string): OrderStatus {
    if (!(STATUSES as readonly string[]).includes(value)) {
      throw new InvalidArgumentError(`"${value}" is not an order status`);
    }
    return new OrderStatus(value as Status);
  }

  isPending(): boolean {
    return this.value === 'PENDING';
  }

  isPaid(): boolean {
    return this.value === 'PAID';
  }

  toString(): string {
    return this.value;
  }
}
