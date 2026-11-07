import { Injectable } from '@nestjs/common';
import { config } from '../../../config';
import { PaymentGateway, type PaymentRequest } from '../../domain/PaymentGateway';
import { PaymentsUnavailableError } from './PaymentsUnavailableError';

@Injectable()
export class HttpPaymentGateway extends PaymentGateway {
  async charge(request: PaymentRequest): Promise<void> {
    const response = await fetch(`${config.paymentsUrl}/payments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        orderId: request.orderId.value,
        customerId: request.customerId.value,
        amountCents: request.amount.cents,
        currency: request.amount.currency,
      }),
      signal: AbortSignal.timeout(config.paymentsTimeoutMs),
    });
    if (!response.ok) {
      throw new PaymentsUnavailableError(`payments responded ${response.status}: ${await response.text()}`);
    }
  }
}
