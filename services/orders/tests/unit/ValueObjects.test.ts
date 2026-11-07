import { InvalidArgumentError } from '../../src/shared/domain/InvalidArgumentError';
import { CustomerId } from '../../src/orders/domain/CustomerId';
import { EventId } from '../../src/orders/domain/EventId';
import { LoyaltyTier } from '../../src/orders/domain/LoyaltyTier';
import { Money } from '../../src/orders/domain/Money';
import { OrderId } from '../../src/orders/domain/OrderId';
import { OrderStatus } from '../../src/orders/domain/OrderStatus';
import { TicketQuantity } from '../../src/orders/domain/TicketQuantity';

describe('TicketQuantity', () => {
  test.each([1, 6, 10])('accepts %i', (n) => expect(TicketQuantity.of(n).value).toBe(n));
  test.each([0, 11, 2.5, -1])('rejects %p', (n) => expect(() => TicketQuantity.of(n)).toThrow(InvalidArgumentError));
});

describe('Money', () => {
  test('multiplies keeping the currency', () => {
    expect(Money.of(4500, 'EUR').times(3).equals(Money.of(13500, 'EUR'))).toBe(true);
  });
  test('takes a percentage off, rounded to the cent', () => {
    expect(Money.of(4505, 'EUR').percentOff(5).equals(Money.of(4280, 'EUR'))).toBe(true);
  });
  test.each([[-1, 'EUR'], [1.5, 'EUR'], [100, 'eur']])('rejects %p %p', (cents, currency) =>
    expect(() => Money.of(cents, currency)).toThrow(InvalidArgumentError),
  );
});

describe('LoyaltyTier', () => {
  test('rejects unknown tiers', () => expect(() => LoyaltyTier.of('platinum')).toThrow(InvalidArgumentError));
});

describe('OrderId', () => {
  test('generates time-ordered UUIDv7 ids', () => {
    const first = OrderId.generate().value;
    const second = OrderId.generate().value;
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first.slice(0, 13) <= second.slice(0, 13)).toBe(true);
  });
  test('rejects malformed ids', () => expect(() => OrderId.of('nope')).toThrow(InvalidArgumentError));
});

describe('CustomerId, EventId, OrderStatus', () => {
  test('reject invalid values', () => {
    expect(() => CustomerId.of('  ')).toThrow(InvalidArgumentError);
    expect(() => EventId.of('concert-1')).toThrow(InvalidArgumentError);
    expect(() => OrderStatus.of('SHIPPED')).toThrow(InvalidArgumentError);
  });
  test('accept valid values', () => {
    expect(CustomerId.of(' cus_1 ').value).toBe('cus_1');
    expect(EventId.of('evt_42').value).toBe('evt_42');
    expect(OrderStatus.of('PAID').value).toBe('PAID');
  });
});
