import type { Order } from './Order';
import type { OrderId } from './OrderId';

export abstract class OrderRepository {
  abstract save(order: Order): Promise<void>;
  abstract find(id: OrderId): Promise<Order | undefined>;
}
