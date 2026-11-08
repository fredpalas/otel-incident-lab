import { Injectable } from '@nestjs/common';
import type { Span } from '@opentelemetry/api';
import { CustomerId } from '../domain/CustomerId';
import { Customers } from '../domain/Customers';
import { EventId } from '../domain/EventId';
import { Order } from '../domain/Order';
import type { OrderDto } from '../domain/OrderDto';
import { OrderId } from '../domain/OrderId';
import { OrderNotFoundError } from '../domain/OrderNotFoundError';
import { OrderRepository } from '../domain/OrderRepository';
import { PaymentFailedError } from '../domain/PaymentFailedError';
import { PaymentGateway } from '../domain/PaymentGateway';
import { Pricing } from '../domain/Pricing';
import { SeatReservations } from '../domain/SeatReservations';
import { TicketQuantity } from '../domain/TicketQuantity';
import { logger } from '../../shared/infrastructure/logger';
import { inSpan } from '../../shared/infrastructure/tracing';
import type { PlaceOrderCommand } from './PlaceOrderCommand';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly payments: PaymentGateway,
    private readonly pricing: Pricing,
    private readonly seats: SeatReservations,
    private readonly customers: Customers,
  ) {}

  placeOrder(command: PlaceOrderCommand): Promise<OrderDto> {
    return inSpan('CheckoutService.placeOrder', __filename, { 'order.tickets': command.tickets }, async (span) => {
      const order = await this.place(command, span);
      return order.toDto();
    });
  }

  private async place(command: PlaceOrderCommand, span: Span): Promise<Order> {
    const orderId = OrderId.generate();
    span.setAttribute('order.id', orderId.value);
    const customerId = CustomerId.of(command.customerId);
    const eventId = EventId.of(command.eventId);
    const tickets = TicketQuantity.of(command.tickets);

    // Independent calls: wait for the slowest, not for the sum. The first failure rejects the checkout.
    const [, unitPrice, tier] = await Promise.all([
      this.seats.reserve(orderId, eventId, tickets),
      this.pricing.unitPrice(eventId, tickets),
      this.customers.tierOf(customerId),
    ]);

    span.setAttribute('customer.tier', tier.value);

    const order = Order.place(orderId, customerId, eventId, tickets, unitPrice, tier);
    await this.orders.save(order);

    try {
      await this.payments.charge({ orderId: order.id, customerId: order.customerId, amount: order.total });
    } catch (error) {
      order.markFailed();
      await this.orders.save(order);
      // payments logs the full error; here one line is enough, the trace links them.
      logger.error(
        { order_id: order.id.value, upstream: 'payments', cause: (error as Error).message },
        'payment failed, order marked as FAILED',
      );
      throw new PaymentFailedError(order.id.value, { cause: error });
    }

    order.markPaid();
    await this.orders.save(order);
    return order;
  }

  async confirmNotification(id: string): Promise<void> {
    const order = await this.orders.find(OrderId.of(id));
    if (!order) throw new OrderNotFoundError(id);
    order.markNotified();
    await this.orders.save(order);
  }

  async findOrder(id: string): Promise<OrderDto> {
    const order = await this.orders.find(OrderId.of(id));
    if (!order) throw new OrderNotFoundError(id);
    return order.toDto();
  }
}
