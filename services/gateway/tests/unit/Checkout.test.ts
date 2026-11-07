import { InvalidArgumentError } from '../../src/shared/domain/InvalidArgumentError';
import { Checkout } from '../../src/storefront/domain/Checkout';

describe('Checkout', () => {
  test('trims identifiers', () => {
    const checkout = Checkout.of(' cus_1 ', ' evt_1 ', 2);
    expect([checkout.customerId, checkout.eventId, checkout.tickets]).toEqual(['cus_1', 'evt_1', 2]);
  });

  test.each([
    ['', 'evt_1', 1],
    ['cus_1', ' ', 1],
    ['cus_1', 'evt_1', 0],
    ['cus_1', 'evt_1', 1.5],
  ])('rejects (%p, %p, %p)', (customerId, eventId, tickets) => {
    expect(() => Checkout.of(customerId, eventId, tickets)).toThrow(InvalidArgumentError);
  });
});
