import { InvalidArgumentError } from '../../shared/domain/InvalidArgumentError';
import type { DiscountPercentage } from './DiscountPercentage';

/** Amount in minor units (cents) to avoid floating point rounding. */
export class Money {
  private constructor(
    readonly cents: number,
    readonly currency: string,
  ) {}

  static of(cents: number, currency: string): Money {
    if (!Number.isInteger(cents) || cents < 0) {
      throw new InvalidArgumentError('amount must be a non-negative integer in cents');
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new InvalidArgumentError(`"${currency}" is not an ISO 4217 currency`);
    }
    return new Money(cents, currency);
  }

  times(quantity: number): Money {
    return Money.of(this.cents * quantity, this.currency);
  }

  applyDiscount(discount: DiscountPercentage): Money {
    return Money.of(Math.round((this.cents * (100 - discount.value)) / 100), this.currency);
  }
}
