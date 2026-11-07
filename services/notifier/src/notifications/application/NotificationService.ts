import { Injectable } from '@nestjs/common';
import { Email } from '../domain/Email';
import { Mailer } from '../domain/Mailer';
import { Orders } from '../domain/Orders';
import type { OrderPaid } from './OrderPaid';

@Injectable()
export class NotificationService {
  constructor(
    private readonly mailer: Mailer,
    private readonly orders: Orders,
  ) {}

  async notifyOrderPaid(event: OrderPaid): Promise<void> {
    await this.mailer.send(Email.orderConfirmation(event));
    await this.orders.confirmNotification(event.orderId);
  }
}
