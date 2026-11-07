import { InvalidArgumentError } from '../../shared/domain/InvalidArgumentError';

export class DiscountPercentage {
  static readonly MAX = 50;

  private constructor(readonly value: number) {}

  static of(value: number): DiscountPercentage {
    if (!(value > 0 && value <= DiscountPercentage.MAX)) {
      throw new InvalidArgumentError(`a discount must be between 0 and ${DiscountPercentage.MAX} % [${value}]`);
    }
    return new DiscountPercentage(value);
  }
}
