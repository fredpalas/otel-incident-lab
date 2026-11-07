import type { CustomerId } from './CustomerId';
import type { LoyaltyTier } from './LoyaltyTier';

export abstract class Customers {
  abstract tierOf(customerId: CustomerId): Promise<LoyaltyTier>;
}
