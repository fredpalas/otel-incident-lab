import { InvalidArgumentError } from '../../shared/domain/InvalidArgumentError';

export class SeatId {
  private constructor(readonly value: string) {}

  static of(value: string): SeatId {
    if (!/^[1-9][0-9]*$/.test(value)) throw new InvalidArgumentError(`"${value}" is not a valid seat id`);
    return new SeatId(value);
  }
}
