import { AggregateRoot } from '../../shared/domain/AggregateRoot';
import type { CustomerId } from './CustomerId';
import type { EventId } from './EventId';
import type { LoyaltyTier } from './LoyaltyTier';
import type { Money } from './Money';
import type { OrderDto } from './OrderDto';
import type { OrderId } from './OrderId';
import { OrderPaid } from './OrderPaid';
import { OrderStateError } from './OrderStateError';
import { OrderStatus } from './OrderStatus';
import type { TicketQuantity } from './TicketQuantity';

export class Order extends AggregateRoot {
  private constructor(
    readonly id: OrderId,
    readonly customerId: CustomerId,
    readonly eventId: EventId,
    readonly tickets: TicketQuantity,
    readonly total: Money,
    private status: OrderStatus,
    readonly createdAt: Date,
  ) {
    super();
  }

  static place(
    id: OrderId,
    customerId: CustomerId,
    eventId: EventId,
    tickets: TicketQuantity,
    unitPrice: Money,
    tier: LoyaltyTier,
  ): Order {
    const total = unitPrice.times(tickets.value).percentOff(tier.discountPercent());
    return new Order(id, customerId, eventId, tickets, total, OrderStatus.PENDING, new Date());
  }

  static restore(
    id: OrderId,
    customerId: CustomerId,
    eventId: EventId,
    tickets: TicketQuantity,
    total: Money,
    status: OrderStatus,
    createdAt: Date,
  ): Order {
    return new Order(id, customerId, eventId, tickets, total, status, createdAt);
  }

  markPaid(): void {
    this.assertPending('pay');
    this.status = OrderStatus.PAID;
    this.record(
      new OrderPaid(this.id.value, this.customerId.value, this.eventId.value, this.tickets.value, this.total.cents, this.total.currency),
    );
  }

  markNotified(): void {
    if (!this.status.isPaid()) {
      throw new OrderStateError(`cannot notify order ${this.id.value} in status ${this.status.value}`);
    }
    this.status = OrderStatus.NOTIFIED;
  }

  markFailed(): void {
    this.assertPending('fail');
    this.status = OrderStatus.FAILED;
  }

  currentStatus(): OrderStatus {
    return this.status;
  }

  toDto(): OrderDto {
    return {
      id: this.id.value,
      customerId: this.customerId.value,
      eventId: this.eventId.value,
      tickets: this.tickets.value,
      amountCents: this.total.cents,
      currency: this.total.currency,
      status: this.status.value,
      createdAt: this.createdAt.toISOString(),
    };
  }

  private assertPending(action: string): void {
    if (!this.status.isPending()) {
      throw new OrderStateError(`cannot ${action} order ${this.id.value} in status ${this.status.value}`);
    }
  }
}
