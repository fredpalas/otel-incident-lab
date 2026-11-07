import type { Checkout } from './Checkout';
import type { OrderView } from './OrderView';

export abstract class OrdersApi {
  abstract place(checkout: Checkout): Promise<OrderView>;
  abstract find(orderId: string): Promise<OrderView>;
}
