import { InvalidArgumentError } from '../../shared/domain/InvalidArgumentError';

const DISCOUNT_PERCENT = { standard: 0, silver: 5, gold: 10 } as const;
type Tier = keyof typeof DISCOUNT_PERCENT;

export class LoyaltyTier {
  static readonly STANDARD = new LoyaltyTier('standard');

  private constructor(readonly value: Tier) {}

  static of(value: string): LoyaltyTier {
    if (!Object.hasOwn(DISCOUNT_PERCENT, value)) throw new InvalidArgumentError(`"${value}" is not a loyalty tier`);
    return new LoyaltyTier(value as Tier);
  }

  discountPercent(): number {
    return DISCOUNT_PERCENT[this.value];
  }
}
