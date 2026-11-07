import { Injectable } from '@nestjs/common';
import { config } from '../../../config';
import { PaymentProvider, type ProviderCharge } from '../../domain/PaymentProvider';
import type { PaymentRequest } from '../../domain/PaymentRequest';
import { PaymentProviderError } from './PaymentProviderError';

interface PspCharge {
  id: string;
  status: string;
}

@Injectable()
export class HttpPaymentProvider extends PaymentProvider {
  async charge(request: PaymentRequest): Promise<ProviderCharge> {
    const body = JSON.stringify({
      amount: request.amount.cents,
      currency: request.amount.currency,
      reference: request.orderId,
      customer_id: request.customerId,
    });

    for (let attempt = 0; ; attempt++) {
      try {
        const charge = await this.post(body);
        return { chargeId: charge.id, status: charge.status };
      } catch (error) {
        // The PSP is slow at peak times; a timed-out call is worth another try.
        if (error instanceof Error && error.name === 'TimeoutError' && attempt < config.pspRetries) continue;
        throw error instanceof PaymentProviderError
          ? error
          : new PaymentProviderError(`psp request failed: ${(error as Error).message}`, { cause: error });
      }
    }
  }

  private async post(body: string): Promise<PspCharge> {
    const response = await fetch(`${config.pspUrl}/charges`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      signal: AbortSignal.timeout(config.pspTimeoutMs),
    });
    if (!response.ok) {
      throw new PaymentProviderError(`psp responded ${response.status}: ${await response.text()}`);
    }
    return (await response.json()) as PspCharge;
  }
}
