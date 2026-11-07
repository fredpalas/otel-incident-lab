import { InvalidArgumentError } from '../../shared/domain/InvalidArgumentError';

export class EmailAddress {
  private constructor(readonly value: string) {}

  static of(value: string): EmailAddress {
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(value)) throw new InvalidArgumentError(`"${value}" is not an email address`);
    return new EmailAddress(value);
  }

  /** Every customer account has a mailbox at the customers domain. */
  static forCustomer(customerId: string): EmailAddress {
    const local = customerId.toLowerCase().replace(/[^a-z0-9._-]+/g, '.');
    return EmailAddress.of(`${local}@customers.example`);
  }
}
