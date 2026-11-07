import type { EventId } from './EventId';
import type { Price } from './Price';

export abstract class PriceRepository {
  abstract currentFor(eventId: EventId, date: Date): Promise<Price | undefined>;
}
