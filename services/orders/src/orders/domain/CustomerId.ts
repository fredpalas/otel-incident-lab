import { InvalidArgumentError } from '../../shared/domain/InvalidArgumentError';

export class CustomerId {
  private constructor(readonly value: string) {}

  static of(value: string): CustomerId {
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed.length > 64) {
      throw new InvalidArgumentError('customerId must be 1-64 characters');
    }
    return new CustomerId(trimmed);
  }

  toString(): string {
    return this.value;
  }
}
