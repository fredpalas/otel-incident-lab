import { Injectable } from '@nestjs/common';
import { config } from '../../../config';
import { Orders } from '../../domain/Orders';

@Injectable()
export class HttpOrders extends Orders {
  async confirmNotification(orderId: string): Promise<void> {
    const response = await fetch(`${config.ordersUrl}/orders/${encodeURIComponent(orderId)}/notification`, {
      method: 'POST',
      signal: AbortSignal.timeout(config.ordersTimeoutMs),
    });
    if (!response.ok) throw new Error(`orders responded ${response.status}: ${await response.text()}`);
  }
}
