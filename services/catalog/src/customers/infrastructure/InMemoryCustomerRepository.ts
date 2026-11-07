import { Injectable } from '@nestjs/common';
import { Customer } from '../domain/Customer';
import type { CustomerId } from '../domain/CustomerId';
import { CustomerRepository } from '../domain/CustomerRepository';
import { LoyaltyTier } from '../domain/LoyaltyTier';

const REGISTERED = 500;

/** Stand-in for the CRM: cus_1 … cus_500 are registered, every 10th is gold, every 4th silver. */
@Injectable()
export class InMemoryCustomerRepository extends CustomerRepository {
  async find(id: CustomerId): Promise<Customer | undefined> {
    const n = Number(/^cus_(\d+)$/.exec(id.value)?.[1]);
    if (!(n >= 1 && n <= REGISTERED)) return undefined;
    const tier = n % 10 === 0 ? LoyaltyTier.GOLD : n % 4 === 0 ? LoyaltyTier.SILVER : LoyaltyTier.STANDARD;
    return Customer.of(id, tier);
  }
}
