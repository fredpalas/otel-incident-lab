import type { CustomerId } from './CustomerId';
import type { Money } from './Money';
import type { OrderId } from './OrderId';

export interface PaymentRequest {
  readonly orderId: OrderId;
  readonly customerId: CustomerId;
  readonly amount: Money;
}

export abstract class PaymentGateway {
  abstract charge(request: PaymentRequest): Promise<void>;
}
