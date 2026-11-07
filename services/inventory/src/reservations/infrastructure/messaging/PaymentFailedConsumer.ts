import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import type { EventEnvelope } from '../../../shared/infrastructure/messaging/EventEnvelope';
import { EXCHANGE, RabbitMq } from '../../../shared/infrastructure/messaging/RabbitMq';
import { ReservationService } from '../../application/ReservationService';

const QUEUE = 'inventory.payment-failed';

/** Seats held for an order whose payment failed go back on sale. */
@Injectable()
export class PaymentFailedConsumer implements OnApplicationBootstrap {
  constructor(
    private readonly rabbit: RabbitMq,
    private readonly reservations: ReservationService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const channel = await this.rabbit.channel();
    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE, 'payment.failed');
    await channel.prefetch(10);
    await channel.consume(QUEUE, async (message) => {
      if (!message) return;
      try {
        const event = JSON.parse(message.content.toString()) as EventEnvelope<{ orderId: string }>;
        await this.reservations.release(event.data.orderId);
        channel.ack(message);
      } catch {
        channel.nack(message, false, false);
      }
    });
  }
}
