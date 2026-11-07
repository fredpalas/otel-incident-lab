import type { EventId } from './EventId';
import type { OrderId } from './OrderId';
import type { TicketQuantity } from './TicketQuantity';

/** Holds seats for an order so nobody else can buy them. */
export abstract class SeatReservations {
  abstract reserve(orderId: OrderId, eventId: EventId, tickets: TicketQuantity): Promise<void>;
}
