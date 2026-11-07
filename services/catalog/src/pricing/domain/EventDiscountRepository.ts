import type { EventDiscount } from './EventDiscount';
import type { EventId } from './EventId';

export abstract class EventDiscountRepository {
  abstract forEvent(eventId: EventId): Promise<EventDiscount | undefined>;
}
