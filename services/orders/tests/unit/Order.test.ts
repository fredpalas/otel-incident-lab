import { CustomerId } from '../../src/orders/domain/CustomerId';
import { EventId } from '../../src/orders/domain/EventId';
import { LoyaltyTier } from '../../src/orders/domain/LoyaltyTier';
import { Money } from '../../src/orders/domain/Money';
import { Order } from '../../src/orders/domain/Order';
import { OrderId } from '../../src/orders/domain/OrderId';
import { OrderPaid } from '../../src/orders/domain/OrderPaid';
import { OrderStateError } from '../../src/orders/domain/OrderStateError';
import { TicketQuantity } from '../../src/orders/domain/TicketQuantity';

describe('Order', () => {
  let order: Order;

  beforeEach(() => {
    order = Order.place(
      OrderId.generate(),
      CustomerId.of('cus_1'),
      EventId.of('evt_1'),
      TicketQuantity.of(3),
      Money.of(4500, 'EUR'),
      LoyaltyTier.STANDARD,
    );
  });

  test('a placed order is pending and totals unit price times tickets', () => {
    const dto = order.toDto();
    expect(dto.status).toBe('PENDING');
    expect(dto.amountCents).toBe(13500);
    expect(dto.currency).toBe('EUR');
  });

  test.each([
    ['silver', 12825],
    ['gold', 12150],
  ])('a %s customer gets the loyalty discount', (tier, cents) => {
    const discounted = Order.place(
      OrderId.generate(),
      CustomerId.of('cus_1'),
      EventId.of('evt_1'),
      TicketQuantity.of(3),
      Money.of(4500, 'EUR'),
      LoyaltyTier.of(tier),
    );

    expect(discounted.toDto().amountCents).toBe(cents);
  });

  test('paying a pending order records order.paid', () => {
    order.markPaid();

    expect(order.currentStatus().value).toBe('PAID');
    const events = order.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(OrderPaid);
    expect(events[0].aggregateId).toBe(order.id.value);
    expect(order.pullDomainEvents()).toHaveLength(0);
  });

  test('a pending order can fail', () => {
    order.markFailed();
    expect(order.currentStatus().value).toBe('FAILED');
  });

  test('a failed order cannot be paid', () => {
    order.markFailed();
    expect(() => order.markPaid()).toThrow(OrderStateError);
  });

  test('a paid order is marked notified once the customer got the email', () => {
    order.markPaid();
    order.markNotified();
    expect(order.currentStatus().value).toBe('NOTIFIED');
  });

  test('an unpaid order cannot be marked notified', () => {
    expect(() => order.markNotified()).toThrow(OrderStateError);
  });

  test('a paid order cannot fail', () => {
    order.markPaid();
    expect(() => order.markFailed()).toThrow(OrderStateError);
  });
});
