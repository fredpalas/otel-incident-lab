import { InvalidArgumentError } from '../../shared/domain/InvalidArgumentError';

/** The concert the tickets are for. */
export class EventId {
  private constructor(readonly value: string) {}

  static of(value: string): EventId {
    if (!/^evt_[a-z0-9]{1,32}$/i.test(value)) {
      throw new InvalidArgumentError(`"${value}" is not a valid event id`);
    }
    return new EventId(value);
  }

  toString(): string {
    return this.value;
  }
}
