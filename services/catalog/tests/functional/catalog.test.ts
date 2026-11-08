import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createApp } from '../../src/app';

describe('catalog HTTP API', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = (await createApp()) as INestApplication<App>;
    await app.init();
  });

  afterAll(() => app.close());

  test('GET /pricing/:eventId quotes the unit price', async () => {
    const res = await request(app.getHttpServer()).get('/pricing/evt_1?tickets=2').expect(200);

    expect(res.body).toEqual({ eventId: 'evt_1', tickets: 2, unitPriceCents: 4500, currency: 'EUR' });
  });

  test('GET /pricing/:eventId applies the event discount', async () => {
    const res = await request(app.getHttpServer()).get('/pricing/evt_3?tickets=1').expect(200);

    expect(res.body.unitPriceCents).toBe(3150);
  });

  test('GET /pricing/:eventId quotes the group unit price from 7 tickets', async () => {
    const res = await request(app.getHttpServer()).get('/pricing/evt_1?tickets=7').expect(200);

    expect(res.body.unitPriceCents).toBe(4050);
  });

  test('GET /pricing/:eventId is 404 for an event without a price', async () => {
    await request(app.getHttpServer()).get('/pricing/evt_nope?tickets=1').expect(404);
  });

  test.each(['/pricing/evt_1?tickets=0', '/pricing/evt_1', '/pricing/concert?tickets=1'])('GET %s is 400', async (url) => {
    await request(app.getHttpServer()).get(url).expect(400);
  });

  test('GET /customers/:id returns the loyalty tier', async () => {
    const res = await request(app.getHttpServer()).get('/customers/cus_20').expect(200);

    expect(res.body).toEqual({ id: 'cus_20', tier: 'gold' });
  });

  test('GET /customers/:id treats unknown customers as guests with the standard tier', async () => {
    const res = await request(app.getHttpServer()).get('/customers/guest_42').expect(200);

    expect(res.body).toEqual({ id: 'guest_42', tier: 'standard' });
  });
});
