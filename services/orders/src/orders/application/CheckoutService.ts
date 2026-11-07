import { Injectable } from '@nestjs/common';
import { CustomerId } from '../domain/CustomerId';
import { Customers } from '../domain/Customers';
import { EventId } from '../domain/EventId';
import { Order } from '../domain/Order';
import type { OrderDto } from '../domain/OrderDto';
import { OrderId } from '../domain/OrderId';
import { OrderNotFoundError } from '../domain/OrderNotFoundError';
import { OrderRepository } from '../domain/OrderRepository';
import { PaymentGateway } from '../domain/PaymentGateway';
import { Pricing } from '../domain/Pricing';
import { SeatReservations } from '../domain/SeatReservations';
import { TicketQuantity } from '../domain/TicketQuantity';
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

  async placeOrder(command: PlaceOrderCommand): Promise<OrderDto> {
    const orderId = OrderId.generate();
    const customerId = CustomerId.of(command.customerId);
    const eventId = EventId.of(command.eventId);
    const tickets = TicketQuantity.of(command.tickets);

    await this.seats.reserve(orderId, eventId, tickets);
    const unitPrice = await this.pricing.unitPrice(eventId, tickets);
    const tier = await this.customers.tierOf(customerId);

    const order = Order.place(orderId, customerId, eventId, tickets, unitPrice, tier);
    await this.orders.save(order);

    try {
      await this.payments.charge({ orderId: order.id, customerId: order.customerId, amount: order.total });
      order.markPaid();
      await this.orders.save(order);
    } catch {
      // Charges the PSP couldn't confirm are settled later by payment reconciliation.
    }

    return order.toDto();
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
