import { InvalidArgumentError } from '../../shared/domain/InvalidArgumentError';

/** Inclusive on both ends. */
export class DateRange {
  private constructor(
    readonly start: Date,
    readonly end: Date,
  ) {}

  static of(start: Date, end: Date): DateRange {
    if (end < start) throw new InvalidArgumentError('a date range cannot end before it starts');
    return new DateRange(start, end);
  }

  contains(date: Date): boolean {
    return date >= this.start && date <= this.end;
  }
}
