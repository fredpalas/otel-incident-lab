import type { PaymentRequest } from './PaymentRequest';

/** What other services learn about payments. */
export abstract class PaymentEvents {
  abstract paymentFailed(request: PaymentRequest, reason: string): Promise<void>;
}
