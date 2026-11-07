import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import type { ConsumeMessage } from 'amqplib';
import { config } from '../../../config';
import type { EventEnvelope } from '../../../shared/infrastructure/messaging/EventEnvelope';
import { EXCHANGE, RabbitMq } from '../../../shared/infrastructure/messaging/RabbitMq';
import { NotificationService } from '../../application/NotificationService';
import type { OrderPaid } from '../../application/OrderPaid';
import { DeliveryAttempt } from '../../domain/DeliveryAttempt';
import { logger } from '../../../shared/infrastructure/logger';

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
    let orderId: string | undefined;
    try {
      const event = JSON.parse(message.content.toString()) as EventEnvelope<OrderPaid>;
      orderId = event.data.orderId;
      await this.notifications.notifyOrderPaid(event.data);
      logger.info({ order_id: orderId, attempt: attempt.number }, 'customer notified');
    } catch (error) {
      if (attempt.canRetry()) {
        logger.warn({ order_id: orderId, attempt: attempt.number, err: error }, 'notification failed, retrying later');
        channel.sendToQueue(RETRY_QUEUE, message.content, {
          ...message.properties,
          headers: { ...message.properties.headers, 'x-attempt': attempt.next().number },
        });
      } else {
        logger.error({ order_id: orderId, attempt: attempt.number, err: error }, 'notification failed, giving up');
      }
    }
    channel.ack(message);
  }
}
