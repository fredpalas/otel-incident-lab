import { InvalidArgumentError } from '../../shared/domain/InvalidArgumentError';

/** How many seats one order can hold. */
export class SeatCount {
  static readonly MAX = 10;

  private constructor(readonly value: number) {}

  static of(value: number): SeatCount {
    if (!Number.isInteger(value) || value < 1 || value > SeatCount.MAX) {
      throw new InvalidArgumentError(`seats must be an integer between 1 and ${SeatCount.MAX}`);
    }
    return new SeatCount(value);
  }
}
