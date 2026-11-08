import { randomUUID } from 'node:crypto';
import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { type Link, ROOT_CONTEXT, context, propagation, trace } from '@opentelemetry/api';
import type { ConsumeMessage } from 'amqplib';
import { config } from '../../../config';
import type { EventEnvelope } from '../../../shared/infrastructure/messaging/EventEnvelope';
import { EXCHANGE, RabbitMq } from '../../../shared/infrastructure/messaging/RabbitMq';
import { NotificationService } from '../../application/NotificationService';
import type { OrderPaid } from '../../application/OrderPaid';
import { DeliveryAttempt } from '../../domain/DeliveryAttempt';
import { logger } from '../../../shared/infrastructure/logger';
import { inSpan } from '../../../shared/infrastructure/tracing';

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
    let event: EventEnvelope<OrderPaid>;
    try {
      event = JSON.parse(message.content.toString()) as EventEnvelope<OrderPaid>;
    } catch (error) {
      logger.error({ err: error }, 'unreadable order.paid message dropped');
      (await this.rabbit.channel()).ack(message);
      return;
    }
    // Back into the checkout's conversation: its correlation_id on our spans and logs, and
    // a link to its trace. A link, not a parent: the email is caused by the checkout but
    // happens later (after retries, maybe minutes later), outside that request.
    const checkout = trace.getSpanContext(propagation.extract(ROOT_CONTEXT, event.headers ?? {}));
    const links: Link[] = checkout ? [{ context: checkout }] : [];
    const baggage = propagation.createBaggage(event.correlationId ? { correlation_id: { value: event.correlationId } } : {});
    await context.with(propagation.setBaggage(context.active(), baggage), () =>
      trace.getTracer('notifier').startActiveSpan('process order.paid', { links }, async (span) => {
        try {
          await this.deliver(message, event);
        } finally {
          span.end();
        }
      }),
    );
  }

  private async deliver(message: ConsumeMessage, event: EventEnvelope<OrderPaid>): Promise<void> {
    const channel = await this.rabbit.channel();
    const attempt = DeliveryAttempt.of(Number(message.properties.headers?.['x-attempt'] ?? 1));
    const orderId = event.data.orderId;
    try {
      await inSpan('OrderPaidConsumer.deliver', __filename, { 'order.id': orderId, 'notification.attempt': attempt.number }, () =>
        this.notifications.notifyOrderPaid(event.data),
      );
      logger.info({ order_id: orderId, attempt: attempt.number }, 'customer notified');
    } catch (error) {
      if (attempt.canRetry()) {
        logger.warn({ order_id: orderId, attempt: attempt.number, err: error }, 'notification failed, retrying later');
        // The retry is a new message, caused by the delivery that failed.
        const retry: EventEnvelope<OrderPaid> = { ...event, eventId: randomUUID(), causationId: event.eventId };
        channel.sendToQueue(RETRY_QUEUE, Buffer.from(JSON.stringify(retry)), {
          ...message.properties,
          messageId: retry.eventId,
          headers: { ...message.properties.headers, 'x-attempt': attempt.next().number },
        });
      } else {
        logger.error({ order_id: orderId, attempt: attempt.number, err: error }, 'notification failed, giving up');
      }
    }
    channel.ack(message);
  }
}
