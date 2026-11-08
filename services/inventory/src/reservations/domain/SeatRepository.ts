import type { EventId } from './EventId';
import type { OrderId } from './OrderId';
import type { Seat } from './Seat';
import type { SeatCount } from './SeatCount';

export abstract class SeatRepository {
  abstract eventExists(eventId: EventId): Promise<boolean>;
  /** Locks the returned seats until the surrounding unit of work ends. */
  abstract findAvailable(eventId: EventId, count: SeatCount): Promise<Seat[]>;
  abstract saveAll(seats: Seat[]): Promise<void>;
  abstract releaseFor(orderId: OrderId): Promise<void>;
}
