import { InvalidArgumentError } from '../../shared/domain/InvalidArgumentError';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The order (owned by the orders service) a seat is held for. */
export class OrderId {
  private constructor(readonly value: string) {}

  static of(value: string): OrderId {
    if (!UUID.test(value)) throw new InvalidArgumentError(`"${value}" is not a valid order id`);
    return new OrderId(value);
  }
}
