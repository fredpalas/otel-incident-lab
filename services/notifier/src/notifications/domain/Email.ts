import { EmailAddress } from './EmailAddress';

interface PaidOrder {
  readonly orderId: string;
  readonly customerId: string;
  readonly eventId: string;
  readonly tickets: number;
  readonly amountCents: number;
  readonly currency: string;
}

export class Email {
  private constructor(
    readonly to: EmailAddress,
    readonly subject: string,
    readonly text: string,
  ) {}

  static orderConfirmation(order: PaidOrder): Email {
    const amount = (order.amountCents / 100).toFixed(2);
    return new Email(
      EmailAddress.forCustomer(order.customerId),
      `Your ${order.tickets} ticket(s) for ${order.eventId}`,
      `Thanks for your order ${order.orderId}. We charged ${amount} ${order.currency}. Your tickets are attached.`,
    );
  }
}
