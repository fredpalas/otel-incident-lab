import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createApp } from '../../src/app';
import { StubServer } from './StubServer';

const ORDER = { id: 'ord_1', customerId: 'cus_1', eventId: 'evt_1', tickets: 2, status: 'PAID' };

describe('gateway HTTP API', () => {
  let app: INestApplication<App>;
  let orders: StubServer;

  beforeAll(async () => {
    orders = new StubServer((req) => {
      if (req.method === 'GET' && req.url === '/orders/ord_1') return { status: 200, body: ORDER };
      if (req.method === 'GET') return { status: 404, body: { error: 'order not found' } };
      const body = req.body as { tickets: number };
      return body.tickets > 10 ? { status: 400, body: { error: 'too many tickets' } } : { status: 201, body: ORDER };
    });
    process.env.ORDERS_URL = await orders.start();
    app = (await createApp()) as INestApplication<App>;
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await orders.stop();
  });

  test('POST /checkout places the order with the orders service', async () => {
    const res = await request(app.getHttpServer())
      .post('/checkout')
      .send({ customerId: 'cus_1', eventId: 'evt_1', tickets: 2 })
      .expect(201);

    expect(res.body).toEqual(ORDER);
    expect(orders.requests.at(-1)).toMatchObject({
      method: 'POST',
      url: '/orders',
      body: { customerId: 'cus_1', eventId: 'evt_1', tickets: 2 },
    });
  });

  test('every response carries the correlation id of its request, for support', async () => {
    const res = await request(app.getHttpServer())
      .post('/checkout')
      .send({ customerId: 'cus_1', eventId: 'evt_1', tickets: 2 })
      .expect(201);

    expect(res.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('client errors from orders are passed through', async () => {
    const res = await request(app.getHttpServer())
      .post('/checkout')
      .send({ customerId: 'cus_1', eventId: 'evt_1', tickets: 11 })
      .expect(400);
    expect(res.body).toEqual({ error: 'too many tickets' });
  });

  test('malformed checkouts are rejected at the edge', async () => {
    await request(app.getHttpServer()).post('/checkout').send({ customerId: 'cus_1' }).expect(400);
  });

  test('GET /orders/:id returns the order, 404 when unknown', async () => {
    expect((await request(app.getHttpServer()).get('/orders/ord_1').expect(200)).body).toEqual(ORDER);
    await request(app.getHttpServer()).get('/orders/nope').expect(404);
  });
});
