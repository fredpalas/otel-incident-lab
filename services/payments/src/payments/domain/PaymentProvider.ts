import type { PaymentRequest } from './PaymentRequest';

export interface ProviderCharge {
  readonly chargeId: string;
  readonly status: string;
}

/** The external PSP that actually moves the money. */
export abstract class PaymentProvider {
  abstract charge(request: PaymentRequest): Promise<ProviderCharge>;
}
