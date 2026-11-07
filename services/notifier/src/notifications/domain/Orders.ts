/** The orders service, which owns the order status. */
export abstract class Orders {
  abstract confirmNotification(orderId: string): Promise<void>;
}
