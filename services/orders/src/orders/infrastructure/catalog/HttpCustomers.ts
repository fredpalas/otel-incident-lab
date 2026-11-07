import { Injectable } from '@nestjs/common';
import { config } from '../../../config';
import type { CustomerId } from '../../domain/CustomerId';
import { Customers } from '../../domain/Customers';
import { LoyaltyTier } from '../../domain/LoyaltyTier';
import { callUpstream } from '../upstream/callUpstream';

@Injectable()
export class HttpCustomers extends Customers {
  async tierOf(customerId: CustomerId): Promise<LoyaltyTier> {
    const customer = await callUpstream<{ tier: string }>(
      'catalog',
      `${config.catalogUrl}/customers/${encodeURIComponent(customerId.value)}`,
      config.catalogTimeoutMs,
    );
    return LoyaltyTier.of(customer.tier);
  }
}
