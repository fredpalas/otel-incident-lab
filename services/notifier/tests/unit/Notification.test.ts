import { DeliveryAttempt } from '../../src/notifications/domain/DeliveryAttempt';
import { Email } from '../../src/notifications/domain/Email';
import { EmailAddress } from '../../src/notifications/domain/EmailAddress';
import { InvalidArgumentError } from '../../src/shared/domain/InvalidArgumentError';

describe('EmailAddress', () => {
  test('customers get their mail at the customers domain', () => {
    expect(EmailAddress.forCustomer('cus_10').value).toBe('cus_10@customers.example');
  });

  test('characters that are not valid in an address are replaced', () => {
    expect(EmailAddress.forCustomer('Verify Run#1').value).toBe('verify.run.1@customers.example');
  });

  test('rejects malformed addresses', () => {
    expect(() => EmailAddress.of('not-an-address')).toThrow(InvalidArgumentError);
  });
});

describe('Email', () => {
  test('the order confirmation goes to the customer with the tickets and the amount charged', () => {
    const email = Email.orderConfirmation({
      orderId: 'ord_1',
      customerId: 'cus_10',
      eventId: 'evt_1',
      tickets: 2,
      amountCents: 9050,
      currency: 'EUR',
    });

    expect(email.to).toEqual(EmailAddress.of('cus_10@customers.example'));
    expect(email.subject).toBe('Your 2 ticket(s) for evt_1');
    expect(email.text).toBe('Thanks for your order ord_1. We charged 90.50 EUR. Your tickets are attached.');
  });
});

describe('DeliveryAttempt', () => {
  test('a failed delivery is retried until the third attempt', () => {
    const first = DeliveryAttempt.first();

    expect(first.canRetry()).toBe(true);
    expect(first.next().canRetry()).toBe(true);
    expect(first.next().next().canRetry()).toBe(false);
  });

  test('rejects attempts below 1', () => {
    expect(() => DeliveryAttempt.of(0)).toThrow(InvalidArgumentError);
  });
});
