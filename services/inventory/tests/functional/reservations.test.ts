import type { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createApp } from '../../src/app';
import { testDatabaseUrl } from '../integration/database';
import { testAmqpUrl } from '../integration/messaging';

describe('inventory HTTP API', () => {
  let app: INestApplication<App>;
  let db: Client;
  const orderId = '0190b0f2-0000-7000-8000-00000000b001';

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl();
    process.env.AMQP_URL = testAmqpUrl();
    app = (await createApp()) as INestApplication<App>;
    await app.init();
    db = new Client({ connectionString: testDatabaseUrl() });
    await db.connect();
    await db.query(`INSERT INTO events (id, name) VALUES ('evt_tiny', 'Tiny Room') ON CONFLICT DO NOTHING`);
    await db.query(`DELETE FROM seats WHERE event_id = 'evt_tiny'`);
    await db.query(`INSERT INTO seats (event_id, section, seat_row, seat_no) VALUES ('evt_tiny', 1, 1, 1)`);
  });

  afterAll(async () => {
    await db.query(`UPDATE seats SET status = 'AVAILABLE', order_id = NULL WHERE order_id = $1`, [orderId]);
    await db.end();
    await app.close();
  });

  test('POST /reservations holds the requested seats for the order', async () => {
    const res = await request(app.getHttpServer())
      .post('/reservations')
      .send({ orderId, eventId: 'evt_2', seats: 3 })
      .expect(201);

    expect(res.body).toMatchObject({ orderId, eventId: 'evt_2' });
    expect(new Set(res.body.seatIds).size).toBe(3);
    const { rows } = await db.query('SELECT status FROM seats WHERE id = ANY($1)', [res.body.seatIds]);
    expect(rows.map((r) => r.status)).toEqual(['RESERVED', 'RESERVED', 'RESERVED']);
  });

  test('POST /reservations is 409 when the event has not enough seats left', async () => {
    await request(app.getHttpServer()).post('/reservations').send({ orderId, eventId: 'evt_tiny', seats: 2 }).expect(409);
  });

  test('POST /reservations is 404 for an unknown event', async () => {
    await request(app.getHttpServer()).post('/reservations').send({ orderId, eventId: 'evt_nope', seats: 1 }).expect(404);
  });

  test.each([
    [{ orderId, eventId: 'evt_2', seats: 11 }],
    [{ orderId: 'ord_1', eventId: 'evt_2', seats: 1 }],
    [{ eventId: 'evt_2' }],
  ])('POST /reservations rejects %j with 400', async (body) => {
    await request(app.getHttpServer()).post('/reservations').send(body).expect(400);
  });
});
