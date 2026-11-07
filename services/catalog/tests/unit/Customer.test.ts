import { CustomerId } from '../../src/customers/domain/CustomerId';
import { LoyaltyTier } from '../../src/customers/domain/LoyaltyTier';
import { InMemoryCustomerRepository } from '../../src/customers/infrastructure/InMemoryCustomerRepository';
import { InvalidArgumentError } from '../../src/shared/domain/InvalidArgumentError';

describe('customers', () => {
  let customers: InMemoryCustomerRepository;

  beforeEach(() => {
    customers = new InMemoryCustomerRepository();
  });

  test('registered customers have their loyalty tier', async () => {
    expect((await customers.find(CustomerId.of('cus_10')))?.toDto()).toEqual({ id: 'cus_10', tier: 'gold' });
    expect((await customers.find(CustomerId.of('cus_4')))?.toDto()).toEqual({ id: 'cus_4', tier: 'silver' });
    expect((await customers.find(CustomerId.of('cus_3')))?.toDto()).toEqual({ id: 'cus_3', tier: 'standard' });
  });

  test('unknown customers are not found', async () => {
    expect(await customers.find(CustomerId.of('guest_1'))).toBeUndefined();
  });

  test('LoyaltyTier rejects unknown tiers', () => {
    expect(() => LoyaltyTier.of('platinum')).toThrow(InvalidArgumentError);
  });
});
