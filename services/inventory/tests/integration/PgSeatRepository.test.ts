import { Client } from 'pg';
import { EventId } from '../../src/reservations/domain/EventId';
import { OrderId } from '../../src/reservations/domain/OrderId';
import { SeatCount } from '../../src/reservations/domain/SeatCount';
import { InventorySchema } from '../../src/reservations/infrastructure/persistence/InventorySchema';
import { PgUnitOfWork } from '../../src/reservations/infrastructure/persistence/PgUnitOfWork';
import { testDatabaseUrl } from './database';

describe('PgSeatRepository', () => {
  let db: Client;
  let unitOfWork: PgUnitOfWork;
  let eventId: EventId;
  let orderId: OrderId;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl();
    await new InventorySchema().onModuleInit();
    db = new Client({ connectionString: testDatabaseUrl() });
    await db.connect();
  });

  afterAll(() => db.end());

  beforeEach(() => {
    unitOfWork = new PgUnitOfWork();
    eventId = EventId.of('evt_2');
    orderId = OrderId.of('0190b0f2-0000-7000-8000-00000000a001');
  });

  afterEach(() => db.query(`UPDATE seats SET status = 'AVAILABLE', order_id = NULL WHERE order_id = $1`, [orderId.value]));

  test('finds available seats and persists a reservation', async () => {
    const reserved = await unitOfWork.run(async (seats) => {
      const [id] = await seats.availableSeatIds(eventId, SeatCount.of(1));
      const seat = await seats.find(id);
      seat?.reserve(orderId);
      if (seat) await seats.save(seat);
      return id;
    });

    const { rows } = await db.query('SELECT status, order_id FROM seats WHERE id = $1', [reserved.value]);
    expect(rows[0]).toEqual({ status: 'RESERVED', order_id: orderId.value });
  });

  test('available seats exclude reserved ones', async () => {
    const first = await unitOfWork.run(async (seats) => {
      const ids = await seats.availableSeatIds(eventId, SeatCount.of(2));
      const seat = await seats.find(ids[0]);
      seat?.reserve(orderId);
      if (seat) await seats.save(seat);
      return ids[0];
    });

    const next = await unitOfWork.run((seats) => seats.availableSeatIds(eventId, SeatCount.of(2)));

    expect(next.map((id) => id.value)).not.toContain(first.value);
  });

  test('a failed unit of work rolls back', async () => {
    await expect(
      unitOfWork.run(async (seats) => {
        const [id] = await seats.availableSeatIds(eventId, SeatCount.of(1));
        const seat = await seats.find(id);
        seat?.reserve(orderId);
        if (seat) await seats.save(seat);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const { rowCount } = await db.query('SELECT 1 FROM seats WHERE order_id = $1', [orderId.value]);
    expect(rowCount).toBe(0);
  });

  test('releases every seat held for an order', async () => {
    await unitOfWork.run(async (seats) => {
      for (const id of await seats.availableSeatIds(eventId, SeatCount.of(2))) {
        const seat = await seats.find(id);
        seat?.reserve(orderId);
        if (seat) await seats.save(seat);
      }
    });

    await unitOfWork.run((seats) => seats.releaseFor(orderId));

    const { rowCount } = await db.query('SELECT 1 FROM seats WHERE order_id = $1', [orderId.value]);
    expect(rowCount).toBe(0);
  });

  test('knows which events exist', async () => {
    expect(await unitOfWork.run((seats) => seats.eventExists(eventId))).toBe(true);
    expect(await unitOfWork.run((seats) => seats.eventExists(EventId.of('evt_nope')))).toBe(false);
  });
});
