import { setTimeout as sleep } from 'node:timers/promises';
import { Injectable } from '@nestjs/common';
import { config } from '../../../config';
import { PaymentProvider, type ProviderCharge } from '../../domain/PaymentProvider';
import type { PaymentRequest } from '../../domain/PaymentRequest';
import { PaymentProviderError } from './PaymentProviderError';

interface PspCharge {
  id: string;
  status: string;
}

// The connection broke before we got an answer; with an Idempotency-Key the PSP turns a
// repeat into a replay of the first charge, so these are safe to retry.
const RETRYABLE_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'UND_ERR_SOCKET']);

const isConnectionError = (error: unknown): boolean => {
  const code = (error as { cause?: { code?: string } } | undefined)?.cause?.code;
  return code !== undefined && RETRYABLE_CODES.has(code);
};

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
        const charge = await this.post(body, request.orderId);
        return { chargeId: charge.id, status: charge.status };
      } catch (error) {
        // Timeouts are not retried: the PSP may still be charging, and our caller's
        // deadline is already running out.
        if (attempt < config.pspRetries && isConnectionError(error)) {
          await sleep(config.pspBackoffMs * (0.5 + Math.random()));
          continue;
        }
        throw error instanceof PaymentProviderError
          ? error
          : new PaymentProviderError(`psp request failed: ${(error as Error).message}`, { cause: error });
      }
    }
  }

  private async post(body: string, idempotencyKey: string): Promise<PspCharge> {
    const response = await fetch(`${config.pspUrl}/charges`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
      body,
      signal: AbortSignal.timeout(config.pspTimeoutMs),
    });
    if (!response.ok) {
      throw new PaymentProviderError(`psp responded ${response.status}: ${await response.text()}`);
    }
    return (await response.json()) as PspCharge;
  }
}
