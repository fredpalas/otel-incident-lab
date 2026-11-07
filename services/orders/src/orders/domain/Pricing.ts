import type { EventId } from './EventId';
import type { Money } from './Money';
import type { TicketQuantity } from './TicketQuantity';

export abstract class Pricing {
  abstract unitPrice(eventId: EventId, tickets: TicketQuantity): Promise<Money>;
}
