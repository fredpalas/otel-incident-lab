export class PaymentFailedError extends Error {
  override readonly name = 'PaymentFailedError';

  constructor(
    readonly orderId: string,
    options?: ErrorOptions,
  ) {
    super(`payment failed for order ${orderId}`, options);
  }
}
