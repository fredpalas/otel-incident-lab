import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { type Channel, type ChannelModel, connect } from 'amqplib';
import { Client } from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createApp } from '../../src/app';
import { EXCHANGE } from '../../src/shared/infrastructure/messaging/RabbitMq';
import { testDatabaseUrl } from '../integration/database';
import { testAmqpUrl } from '../integration/messaging';

describe('inventory on payment.failed', () => {
  let app: INestApplication<App>;
  let db: Client;
  let connection: ChannelModel;
  let channel: Channel;
  const orderId = '0190b0f2-0000-7000-8000-00000000c001';

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl();
    process.env.AMQP_URL = testAmqpUrl();
    app = (await createApp()) as INestApplication<App>;
    await app.init();
    db = new Client({ connectionString: testDatabaseUrl() });
    await db.connect();
    connection = await connect(testAmqpUrl());
    channel = await connection.createChannel();
  });

  afterAll(async () => {
    await db.query(`UPDATE seats SET status = 'AVAILABLE', order_id = NULL WHERE order_id = $1`, [orderId]);
    await connection.close();
    await db.end();
    await app.close();
  });

  test('releases the seats held for the order whose payment failed', async () => {
    await request(app.getHttpServer()).post('/reservations').send({ orderId, eventId: 'evt_2', seats: 2 }).expect(201);

    const event = { eventId: randomUUID(), eventName: 'payment.failed', occurredOn: new Date().toISOString(), data: { orderId } };
    channel.publish(EXCHANGE, 'payment.failed', Buffer.from(JSON.stringify(event)), { contentType: 'application/json' });

    let held = 2;
    for (let i = 0; i < 50 && held > 0; i++) {
      await new Promise((r) => setTimeout(r, 100));
      held = (await db.query('SELECT 1 FROM seats WHERE order_id = $1', [orderId])).rowCount ?? 0;
    }
    expect(held).toBe(0);
  });
});
