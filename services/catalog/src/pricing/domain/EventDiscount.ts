import type { DiscountPercentage } from './DiscountPercentage';
import type { EventId } from './EventId';

export class EventDiscount {
  private constructor(
    readonly eventId: EventId,
    readonly percentage: DiscountPercentage,
  ) {}

  static of(eventId: EventId, percentage: DiscountPercentage): EventDiscount {
    return new EventDiscount(eventId, percentage);
  }
}
