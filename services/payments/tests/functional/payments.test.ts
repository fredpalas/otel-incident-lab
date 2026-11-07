import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createApp } from '../../src/app';
import { type Channel, type ChannelModel, connect } from 'amqplib';
import { EXCHANGE } from '../../src/shared/infrastructure/messaging/RabbitMq';
import { testAmqpUrl } from './messaging';
import { StubServer } from './StubServer';

describe('payments HTTP API', () => {
  let app: INestApplication<App>;
  let psp: StubServer;
  let connection: ChannelModel;
  let channel: Channel;
  let failures: string;

  beforeAll(async () => {
    psp = new StubServer((req) =>
      (req.body as { reference?: string }).reference === 'ord_rejected'
        ? { status: 422, body: { error: 'invalid_request' } }
        : { status: 201, body: { id: 'ch_1', status: 'captured' } },
    );
    process.env.PSP_URL = await psp.start();
    process.env.AMQP_URL = testAmqpUrl();
    connection = await connect(testAmqpUrl());
    channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    ({ queue: failures } = await channel.assertQueue('', { exclusive: true }));
    await channel.bindQueue(failures, EXCHANGE, 'payment.failed');
    app = (await createApp()) as INestApplication<App>;
    await app.init();
  });

  afterAll(async () => {
    await connection.close();
    await app.close();
    await psp.stop();
  });

  test('POST /payments charges the PSP', async () => {
    const res = await request(app.getHttpServer())
      .post('/payments')
      .send({ orderId: 'ord_1', customerId: 'cus_1', amountCents: 9000, currency: 'EUR' })
      .expect(201);

    expect(res.body).toEqual({ paymentId: 'ch_1', orderId: 'ord_1', status: 'captured' });
    expect(psp.requests.at(-1)).toMatchObject({
      method: 'POST',
      url: '/charges',
      body: { amount: 9000, currency: 'EUR', reference: 'ord_1', customer_id: 'cus_1' },
    });
  });

  test('a failed charge is announced as payment.failed', async () => {
    await request(app.getHttpServer())
      .post('/payments')
      .send({ orderId: 'ord_rejected', customerId: 'cus_1', amountCents: 9000, currency: 'EUR' })
      .expect(502);

    // Other suites publish payment.failed to the same broker: look for ours.
    await new Promise((r) => setTimeout(r, 200));
    const events: unknown[] = [];
    for (let m = await channel.get(failures, { noAck: true }); m; m = await channel.get(failures, { noAck: true })) {
      events.push(JSON.parse(m.content.toString()));
    }
    expect(events).toContainEqual(expect.objectContaining({ eventName: 'payment.failed', data: expect.objectContaining({ orderId: 'ord_rejected' }) }));
  });

  test.each([
    [{ orderId: 'ord_1', customerId: 'cus_1', amountCents: 0, currency: 'EUR' }],
    [{ orderId: 'ord_1', customerId: 'cus_1', amountCents: 100 }],
  ])('POST /payments rejects %j with 400', async (body) => {
    await request(app.getHttpServer()).post('/payments').send(body).expect(400);
  });
});
