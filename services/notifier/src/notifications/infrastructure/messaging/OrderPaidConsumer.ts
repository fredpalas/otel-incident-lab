import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import type { ConsumeMessage } from 'amqplib';
import { config } from '../../../config';
import type { EventEnvelope } from '../../../shared/infrastructure/messaging/EventEnvelope';
import { EXCHANGE, RabbitMq } from '../../../shared/infrastructure/messaging/RabbitMq';
import { NotificationService } from '../../application/NotificationService';
import type { OrderPaid } from '../../application/OrderPaid';
import { DeliveryAttempt } from '../../domain/DeliveryAttempt';

const QUEUE = 'notifier.order-paid';
// Failed deliveries wait here and then go back to QUEUE (dead-lettering after the TTL).
const RETRY_QUEUE = 'notifier.order-paid.retry';

@Injectable()
export class OrderPaidConsumer implements OnApplicationBootstrap {
  constructor(
    private readonly rabbit: RabbitMq,
    private readonly notifications: NotificationService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const channel = await this.rabbit.channel();
    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE, 'order.paid');
    await channel.assertQueue(RETRY_QUEUE, {
      durable: true,
      arguments: { 'x-message-ttl': config.retryDelayMs, 'x-dead-letter-exchange': '', 'x-dead-letter-routing-key': QUEUE },
    });
    await channel.prefetch(10);
    await channel.consume(QUEUE, (message) => {
      if (message) void this.handle(message);
    });
  }

  private async handle(message: ConsumeMessage): Promise<void> {
    const channel = await this.rabbit.channel();
    const attempt = DeliveryAttempt.of(Number(message.properties.headers?.['x-attempt'] ?? 1));
    try {
      const event = JSON.parse(message.content.toString()) as EventEnvelope<OrderPaid>;
      await this.notifications.notifyOrderPaid(event.data);
    } catch {
      if (attempt.canRetry()) {
        channel.sendToQueue(RETRY_QUEUE, message.content, {
          ...message.properties,
          headers: { ...message.properties.headers, 'x-attempt': attempt.next().number },
        });
      }
    }
    channel.ack(message);
  }
}
