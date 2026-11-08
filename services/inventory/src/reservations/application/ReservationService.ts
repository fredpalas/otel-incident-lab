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
      const available = await seats.findAvailable(eventId, count);
      if (available.length < count.value) {
        if (!(await seats.eventExists(eventId))) throw new EventNotFoundError(eventId.value);
        throw new NotEnoughSeatsError(`only ${available.length} seats left for ${eventId.value}`);
      }

      for (const seat of available) seat.reserve(orderId);
      await seats.saveAll(available);
      return { orderId: orderId.value, eventId: eventId.value, seatIds: available.map((seat) => seat.id.value) };
    });
  }

  async release(orderIdValue: string): Promise<void> {
    const orderId = OrderId.of(orderIdValue);
    await this.unitOfWork.run((seats) => seats.releaseFor(orderId));
  }
}
