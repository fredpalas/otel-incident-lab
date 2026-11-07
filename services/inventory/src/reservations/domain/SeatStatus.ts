import { InvalidArgumentError } from '../../shared/domain/InvalidArgumentError';

const STATUSES = ['AVAILABLE', 'RESERVED'] as const;
type Status = (typeof STATUSES)[number];

export class SeatStatus {
  static readonly AVAILABLE = new SeatStatus('AVAILABLE');
  static readonly RESERVED = new SeatStatus('RESERVED');

  private constructor(readonly value: Status) {}

  static of(value: string): SeatStatus {
    if (!(STATUSES as readonly string[]).includes(value)) {
      throw new InvalidArgumentError(`"${value}" is not a seat status`);
    }
    return new SeatStatus(value as Status);
  }

  isAvailable(): boolean {
    return this.value === 'AVAILABLE';
  }
}
