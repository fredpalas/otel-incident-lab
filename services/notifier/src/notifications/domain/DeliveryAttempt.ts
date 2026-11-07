import { InvalidArgumentError } from '../../shared/domain/InvalidArgumentError';

/** Which delivery of a notification this is; after the last one we stop trying. */
export class DeliveryAttempt {
  static readonly MAX = 3;

  private constructor(readonly number: number) {}

  static first(): DeliveryAttempt {
    return new DeliveryAttempt(1);
  }

  static of(number: number): DeliveryAttempt {
    if (!Number.isInteger(number) || number < 1) throw new InvalidArgumentError(`"${number}" is not a delivery attempt`);
    return new DeliveryAttempt(number);
  }

  next(): DeliveryAttempt {
    return new DeliveryAttempt(this.number + 1);
  }

  canRetry(): boolean {
    return this.number < DeliveryAttempt.MAX;
  }
}
