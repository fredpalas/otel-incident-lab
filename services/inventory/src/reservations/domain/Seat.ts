import type { EventId } from './EventId';
import type { OrderId } from './OrderId';
import type { SeatDto } from './SeatDto';
import type { SeatId } from './SeatId';
import { SeatStatus } from './SeatStatus';
import { SeatUnavailableError } from './SeatUnavailableError';

export class Seat {
  private constructor(
    readonly id: SeatId,
    readonly eventId: EventId,
    private status: SeatStatus,
    private orderId?: OrderId,
  ) {}

  static restore(id: SeatId, eventId: EventId, status: SeatStatus, orderId?: OrderId): Seat {
    return new Seat(id, eventId, status, orderId);
  }

  reserve(orderId: OrderId): void {
    if (!this.status.isAvailable()) {
      throw new SeatUnavailableError(`seat ${this.id.value} is already ${this.status.value}`);
    }
    this.status = SeatStatus.RESERVED;
    this.orderId = orderId;
  }

  toDto(): SeatDto {
    return { id: this.id.value, eventId: this.eventId.value, status: this.status.value, orderId: this.orderId?.value };
  }
}
