import { InvalidArgumentError } from '../../src/shared/domain/InvalidArgumentError';
import { OrderId } from '../../src/reservations/domain/OrderId';
import { SeatCount } from '../../src/reservations/domain/SeatCount';
import { SeatId } from '../../src/reservations/domain/SeatId';
import { SeatStatus } from '../../src/reservations/domain/SeatStatus';

describe('value objects', () => {
  test.each([0, 11, 2.5])('SeatCount rejects %p', (value) => {
    expect(() => SeatCount.of(value)).toThrow(InvalidArgumentError);
  });

  test('SeatCount accepts 1 to 10', () => {
    expect(SeatCount.of(10).value).toBe(10);
  });

  test('SeatId must be a positive integer', () => {
    expect(() => SeatId.of('abc')).toThrow(InvalidArgumentError);
  });

  test('OrderId must be a uuid', () => {
    expect(() => OrderId.of('ord_1')).toThrow(InvalidArgumentError);
  });

  test('SeatStatus rejects unknown values', () => {
    expect(() => SeatStatus.of('SOLD_OUT')).toThrow(InvalidArgumentError);
  });
});
