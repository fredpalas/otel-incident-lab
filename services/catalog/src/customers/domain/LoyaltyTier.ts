import { InvalidArgumentError } from '../../shared/domain/InvalidArgumentError';

const TIERS = ['standard', 'silver', 'gold'] as const;
type Tier = (typeof TIERS)[number];

export class LoyaltyTier {
  static readonly STANDARD = new LoyaltyTier('standard');
  static readonly SILVER = new LoyaltyTier('silver');
  static readonly GOLD = new LoyaltyTier('gold');

  private constructor(readonly value: Tier) {}

  static of(value: string): LoyaltyTier {
    if (!(TIERS as readonly string[]).includes(value)) {
      throw new InvalidArgumentError(`"${value}" is not a loyalty tier`);
    }
    return new LoyaltyTier(value as Tier);
  }
}
