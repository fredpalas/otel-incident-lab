import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createApp } from '../../src/app';
import { testDatabaseUrl } from '../integration/database';
import { testAmqpUrl } from '../integration/messaging';
import { StubServer } from './StubServer';

describe('orders HTTP API', () => {
  let app: INestApplication<App>;
  let payments: StubServer;
  let inventory: StubServer;
  let catalog: StubServer;

  beforeAll(async () => {
    payments = new StubServer(() => ({ status: 201, body: { paymentId: 'pay_1', status: 'captured' } }));
    inventory = new StubServer((req) =>
      (req.body as { eventId?: string }).eventId === 'evt_soldout'
        ? { status: 409, body: { error: 'only 0 seats left for evt_soldout' } }
        : { status: 201, body: { seatIds: ['1', '2'] } },
    );
    catalog = new StubServer((req) =>
      req.url.startsWith('/customers/')
        ? { status: 200, body: { id: req.url.split('/')[2], tier: req.url.endsWith('/cus_gold') ? 'gold' : 'standard' } }
        : { status: 200, body: { unitPriceCents: 4500, currency: 'EUR' } },
    );
    process.env.PAYMENTS_URL = await payments.start();
    process.env.INVENTORY_URL = await inventory.start();
    process.env.CATALOG_URL = await catalog.start();
    process.env.DATABASE_URL = testDatabaseUrl();
    process.env.AMQP_URL = testAmqpUrl();
    app = (await createApp()) as INestApplication<App>;
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await payments.stop();
    await inventory.stop();
    await catalog.stop();
  });

  test('POST /orders charges the customer and returns a paid order', async () => {
    const res = await request(app.getHttpServer())
      .post('/orders')
      .send({ customerId: 'cus_fn', eventId: 'evt_1', tickets: 2 })
      .expect(201);

    expect(res.body).toMatchObject({ customerId: 'cus_fn', eventId: 'evt_1', tickets: 2, amountCents: 9000, status: 'PAID' });
    expect(payments.requests.at(-1)).toMatchObject({
      method: 'POST',
      url: '/payments',
      body: { orderId: res.body.id, customerId: 'cus_fn', amountCents: 9000, currency: 'EUR' },
    });
  });

  test('POST /orders reserves the seats and prices the tickets for the event', async () => {
    const res = await request(app.getHttpServer())
      .post('/orders')
      .send({ customerId: 'cus_fn', eventId: 'evt_2', tickets: 2 })
      .expect(201);

    expect(inventory.requests.at(-1)).toMatchObject({
      method: 'POST',
      url: '/reservations',
      body: { orderId: res.body.id, eventId: 'evt_2', seats: 2 },
    });
    expect(catalog.requests.map((r) => r.url)).toEqual(expect.arrayContaining(['/pricing/evt_2?tickets=2', '/customers/cus_fn']));
  });

  test('POST /orders applies the loyalty discount of the customer', async () => {
    const res = await request(app.getHttpServer())
      .post('/orders')
      .send({ customerId: 'cus_gold', eventId: 'evt_1', tickets: 2 })
      .expect(201);

    expect(res.body.amountCents).toBe(8100);
  });

  test('POST /orders is 409 when the seats are gone', async () => {
    await request(app.getHttpServer()).post('/orders').send({ customerId: 'cus_fn', eventId: 'evt_soldout', tickets: 2 }).expect(409);
  });

  test('POST /orders/:id/notification marks a paid order as notified', async () => {
    const created = await request(app.getHttpServer())
      .post('/orders')
      .send({ customerId: 'cus_fn', eventId: 'evt_1', tickets: 1 })
      .expect(201);

    await request(app.getHttpServer()).post(`/orders/${created.body.id}/notification`).expect(204);

    const res = await request(app.getHttpServer()).get(`/orders/${created.body.id}`).expect(200);
    expect(res.body.status).toBe('NOTIFIED');
  });

  test('GET /orders/:id returns the stored order', async () => {
    const created = await request(app.getHttpServer())
      .post('/orders')
      .send({ customerId: 'cus_fn', eventId: 'evt_1', tickets: 1 })
      .expect(201);

    const res = await request(app.getHttpServer()).get(`/orders/${created.body.id}`).expect(200);

    expect(res.body).toEqual(created.body);
  });

  test('GET /orders/:id is 404 for an unknown order', async () => {
    await request(app.getHttpServer()).get('/orders/0190b0f2-0000-7000-8000-000000000000').expect(404);
  });

  test.each([
    [{ customerId: 'cus_fn', eventId: 'evt_1', tickets: 11 }],
    [{ customerId: 'cus_fn', eventId: 'concert', tickets: 1 }],
    [{ customerId: 'cus_fn' }],
  ])('POST /orders rejects %j with 400', async (body) => {
    await request(app.getHttpServer()).post('/orders').send(body).expect(400);
  });
});
