import type { DomainEvent } from '../../shared/domain/DomainEvent';

export class OrderPaid implements DomainEvent {
  readonly eventName = 'order.paid';
  readonly occurredOn = new Date();

  constructor(
    readonly aggregateId: string,
    readonly customerId: string,
    readonly eventId: string,
    readonly tickets: number,
    readonly amountCents: number,
    readonly currency: string,
  ) {}

  toPrimitives(): Record<string, unknown> {
    return {
      orderId: this.aggregateId,
      customerId: this.customerId,
      eventId: this.eventId,
      tickets: this.tickets,
      amountCents: this.amountCents,
      currency: this.currency,
    };
  }
}
