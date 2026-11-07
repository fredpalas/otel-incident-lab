import { Uuid } from '../../shared/domain/Uuid';

export class OrderId extends Uuid {
  static generate(): OrderId {
    return new OrderId(Uuid.v7());
  }

  static of(value: string): OrderId {
    return new OrderId(value);
  }
}
