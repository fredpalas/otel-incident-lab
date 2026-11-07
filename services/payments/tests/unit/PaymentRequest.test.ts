import { InvalidArgumentError } from '../../src/shared/domain/InvalidArgumentError';
import { Money } from '../../src/payments/domain/Money';
import { PaymentRequest } from '../../src/payments/domain/PaymentRequest';

describe('PaymentRequest', () => {
  let amount: Money;

  beforeEach(() => {
    amount = Money.of(9000, 'EUR');
  });

  test('holds the order, customer and amount', () => {
    const request = PaymentRequest.of('ord_1', 'cus_1', amount);
    expect(request.orderId).toBe('ord_1');
    expect(request.amount.equals(amount)).toBe(true);
  });

  test.each([
    ['', 'cus_1'],
    ['ord_1', ' '],
  ])('requires order and customer (%p, %p)', (orderId, customerId) => {
    expect(() => PaymentRequest.of(orderId, customerId, amount)).toThrow(InvalidArgumentError);
  });

  test('rejects a zero amount', () => {
    expect(() => PaymentRequest.of('ord_1', 'cus_1', Money.of(0, 'EUR'))).toThrow(InvalidArgumentError);
  });
});

describe('Money', () => {
  test.each([[-1, 'EUR'], [10.5, 'EUR'], [100, 'EURO']])('rejects %p %p', (cents, currency) => {
    expect(() => Money.of(cents, currency)).toThrow(InvalidArgumentError);
  });
});
