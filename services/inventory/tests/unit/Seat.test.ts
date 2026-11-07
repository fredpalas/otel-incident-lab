import { EventId } from '../../src/reservations/domain/EventId';
import { OrderId } from '../../src/reservations/domain/OrderId';
import { Seat } from '../../src/reservations/domain/Seat';
import { SeatId } from '../../src/reservations/domain/SeatId';
import { SeatStatus } from '../../src/reservations/domain/SeatStatus';
import { SeatUnavailableError } from '../../src/reservations/domain/SeatUnavailableError';

describe('Seat', () => {
  let seat: Seat;
  let orderId: OrderId;

  beforeEach(() => {
    seat = Seat.restore(SeatId.of('42'), EventId.of('evt_1'), SeatStatus.AVAILABLE);
    orderId = OrderId.of('0190b0f2-0000-7000-8000-000000000001');
  });

  test('an available seat can be reserved for an order', () => {
    seat.reserve(orderId);

    expect(seat.toDto()).toEqual({ id: '42', eventId: 'evt_1', status: 'RESERVED', orderId: orderId.value });
  });

  test('a reserved seat cannot be reserved again', () => {
    seat.reserve(orderId);

    expect(() => seat.reserve(OrderId.of('0190b0f2-0000-7000-8000-000000000002'))).toThrow(SeatUnavailableError);
  });
});
