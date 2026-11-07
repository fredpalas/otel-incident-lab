import { Injectable } from '@nestjs/common';
import { Checkout } from '../domain/Checkout';
import { OrdersApi } from '../domain/OrdersApi';
import type { OrderView } from '../domain/OrderView';
import type { CheckoutCommand } from './CheckoutCommand';

@Injectable()
export class StorefrontService {
  constructor(private readonly orders: OrdersApi) {}

  checkout(command: CheckoutCommand): Promise<OrderView> {
    return this.orders.place(Checkout.of(command.customerId, command.eventId, command.tickets));
  }

  order(orderId: string): Promise<OrderView> {
    return this.orders.find(orderId);
  }
}
