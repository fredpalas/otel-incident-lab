import type { CustomerDto } from './CustomerDto';
import type { CustomerId } from './CustomerId';
import { LoyaltyTier } from './LoyaltyTier';

export class Customer {
  private constructor(
    readonly id: CustomerId,
    readonly tier: LoyaltyTier,
  ) {}

  static of(id: CustomerId, tier: LoyaltyTier): Customer {
    return new Customer(id, tier);
  }

  /** Someone buying without an account. */
  static guest(id: CustomerId): Customer {
    return new Customer(id, LoyaltyTier.STANDARD);
  }

  toDto(): CustomerDto {
    return { id: this.id.value, tier: this.tier.value };
  }
}
