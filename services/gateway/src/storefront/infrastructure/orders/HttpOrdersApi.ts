import { Injectable } from '@nestjs/common';
import { config } from '../../../config';
import type { Checkout } from '../../domain/Checkout';
import { OrdersApi } from '../../domain/OrdersApi';
import type { OrderView } from '../../domain/OrderView';
import { UpstreamError } from './UpstreamError';

@Injectable()
export class HttpOrdersApi extends OrdersApi {
  place(checkout: Checkout): Promise<OrderView> {
    return this.call('/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ customerId: checkout.customerId, eventId: checkout.eventId, tickets: checkout.tickets }),
    });
  }

  find(orderId: string): Promise<OrderView> {
    return this.call(`/orders/${encodeURIComponent(orderId)}`, { method: 'GET' });
  }

  private async call(path: string, init: RequestInit): Promise<OrderView> {
    const response = await fetch(`${config.ordersUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(config.ordersTimeoutMs),
    });
    const text = await response.text();
    const body: unknown = text ? JSON.parse(text) : {};
    if (!response.ok) throw new UpstreamError(response.status, body);
    return body as OrderView;
  }
}
