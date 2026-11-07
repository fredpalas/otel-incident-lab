import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { EventEnvelope } from '../../../shared/infrastructure/messaging/EventEnvelope';
import { EXCHANGE, RabbitMq } from '../../../shared/infrastructure/messaging/RabbitMq';
import { PaymentEvents } from '../../domain/PaymentEvents';
import type { PaymentRequest } from '../../domain/PaymentRequest';

@Injectable()
export class AmqpPaymentEvents extends PaymentEvents {
  constructor(private readonly rabbit: RabbitMq) {
    super();
  }

  async paymentFailed(request: PaymentRequest, reason: string): Promise<void> {
    const envelope: EventEnvelope = {
      eventId: randomUUID(),
      eventName: 'payment.failed',
      occurredOn: new Date().toISOString(),
      data: { orderId: request.orderId, customerId: request.customerId, reason },
    };
    const channel = await this.rabbit.channel();
    channel.publish(EXCHANGE, envelope.eventName, Buffer.from(JSON.stringify(envelope)), {
      persistent: true,
      contentType: 'application/json',
      messageId: envelope.eventId,
    });
  }
}
