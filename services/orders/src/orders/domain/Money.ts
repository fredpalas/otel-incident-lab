import { InvalidArgumentError } from '../../shared/domain/InvalidArgumentError';

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

  percentOff(percent: number): Money {
    return Money.of(Math.round((this.cents * (100 - percent)) / 100), this.currency);
  }

  equals(other: Money): boolean {
    return this.cents === other.cents && this.currency === other.currency;
  }
}
