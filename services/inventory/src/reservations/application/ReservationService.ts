import { Injectable } from '@nestjs/common';
import { EventId } from '../domain/EventId';
import { EventNotFoundError } from '../domain/EventNotFoundError';
import { NotEnoughSeatsError } from '../domain/NotEnoughSeatsError';
import { OrderId } from '../domain/OrderId';
import type { ReservationDto } from '../domain/ReservationDto';
import { SeatCount } from '../domain/SeatCount';
import { UnitOfWork } from '../domain/UnitOfWork';
import type { ReserveSeatsCommand } from './ReserveSeatsCommand';

@Injectable()
export class ReservationService {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  async reserve(command: ReserveSeatsCommand): Promise<ReservationDto> {
    const orderId = OrderId.of(command.orderId);
    const eventId = EventId.of(command.eventId);
    const count = SeatCount.of(command.seats);

    return this.unitOfWork.run(async (seats) => {
      const ids = await seats.availableSeatIds(eventId, count);
      if (ids.length < count.value) {
        if (!(await seats.eventExists(eventId))) throw new EventNotFoundError(eventId.value);
        throw new NotEnoughSeatsError(`only ${ids.length} seats left for ${eventId.value}`);
      }

      const seatIds: string[] = [];
      for (const id of ids) {
        const seat = await seats.find(id);
        if (!seat) throw new NotEnoughSeatsError(`seat ${id.value} disappeared`);
        seat.reserve(orderId);
        await seats.save(seat);
        seatIds.push(seat.id.value);
      }
      return { orderId: orderId.value, eventId: eventId.value, seatIds };
    });
  }

  async release(orderIdValue: string): Promise<void> {
    const orderId = OrderId.of(orderIdValue);
    await this.unitOfWork.run((seats) => seats.releaseFor(orderId));
  }
}
