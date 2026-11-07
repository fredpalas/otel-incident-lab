import type { EventId } from './EventId';
import type { OrderId } from './OrderId';
import type { Seat } from './Seat';
import type { SeatCount } from './SeatCount';
import type { SeatId } from './SeatId';

export abstract class SeatRepository {
  abstract eventExists(eventId: EventId): Promise<boolean>;
  /** Locks the returned seats until the surrounding unit of work ends. */
  abstract availableSeatIds(eventId: EventId, count: SeatCount): Promise<SeatId[]>;
  abstract find(id: SeatId): Promise<Seat | undefined>;
  abstract save(seat: Seat): Promise<void>;
  abstract releaseFor(orderId: OrderId): Promise<void>;
}
