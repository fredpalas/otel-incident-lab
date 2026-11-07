import { Injectable } from '@nestjs/common';
import { config } from '../../../config';
import type { EventId } from '../../domain/EventId';
import type { OrderId } from '../../domain/OrderId';
import { SeatReservations } from '../../domain/SeatReservations';
import type { TicketQuantity } from '../../domain/TicketQuantity';
import { callUpstream } from '../upstream/callUpstream';

@Injectable()
export class HttpSeatReservations extends SeatReservations {
  async reserve(orderId: OrderId, eventId: EventId, tickets: TicketQuantity): Promise<void> {
    await callUpstream('inventory', `${config.inventoryUrl}/reservations`, config.inventoryTimeoutMs, {
      method: 'POST',
      body: JSON.stringify({ orderId: orderId.value, eventId: eventId.value, seats: tickets.value }),
    });
  }
}
