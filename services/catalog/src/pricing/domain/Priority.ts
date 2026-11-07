import { InvalidArgumentError } from '../../shared/domain/InvalidArgumentError';

/** When several prices apply on the same date, the highest priority wins. */
export class Priority {
  private constructor(readonly value: number) {}

  static of(value: number): Priority {
    if (!Number.isInteger(value) || value < 0) throw new InvalidArgumentError('priority must be a non-negative integer');
    return new Priority(value);
  }
}
