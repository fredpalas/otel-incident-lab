import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { type Channel, type ChannelModel, connect } from 'amqplib';
import { createApp } from '../../src/app';
import { EXCHANGE } from '../../src/shared/infrastructure/messaging/RabbitMq';
import { testAmqpUrl, testSmtp } from './messaging';
import { StubServer } from './StubServer';
import { TcpSwitch } from './TcpSwitch';

interface MailpitSearch {
  messages: Array<{ Subject: string; To: Array<{ Address: string }> }>;
}

describe('notifier on order.paid', () => {
  let app: INestApplication;
  let orders: StubServer;
  let smtp: TcpSwitch;
  let connection: ChannelModel;
  let channel: Channel;

  const publishOrderPaid = (orderId: string, customerId: string): void => {
    const event = {
      eventId: randomUUID(),
      eventName: 'order.paid',
      occurredOn: new Date().toISOString(),
      data: { orderId, customerId, eventId: 'evt_1', tickets: 2, amountCents: 9000, currency: 'EUR' },
    };
    channel.publish(EXCHANGE, 'order.paid', Buffer.from(JSON.stringify(event)), { contentType: 'application/json' });
  };

  const mailsTo = async (address: string): Promise<MailpitSearch['messages']> => {
    const res = await fetch(`${testSmtp().api}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`);
    return ((await res.json()) as MailpitSearch).messages;
  };

  const eventually = async <T>(probe: () => Promise<T | undefined>, timeoutMs = 5_000): Promise<T | undefined> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const value = await probe();
      if (value !== undefined) return value;
      await new Promise((r) => setTimeout(r, 100));
    }
    return undefined;
  };

  beforeAll(async () => {
    orders = new StubServer(() => ({ status: 204, body: {} }));
    smtp = new TcpSwitch(testSmtp().host, testSmtp().port);
    process.env.ORDERS_URL = await orders.start();
    process.env.SMTP_HOST = '127.0.0.1';
    process.env.SMTP_PORT = String(await smtp.start());
    process.env.AMQP_URL = testAmqpUrl();
    process.env.NOTIFICATION_RETRY_DELAY_MS = '300';
    app = await createApp();
    await app.init();
    connection = await connect(testAmqpUrl());
    channel = await connection.createChannel();
  });

  afterAll(async () => {
    await connection.close();
    await app.close();
    await smtp.stop();
    await orders.stop();
  });

  test('emails the customer and tells orders the customer was notified', async () => {
    const orderId = randomUUID();
    const customer = `fn_${orderId.slice(0, 8)}`;

    publishOrderPaid(orderId, customer);

    const mails = await eventually(async () => {
      const found = await mailsTo(`${customer}@customers.example`);
      return found.length > 0 ? found : undefined;
    });
    expect(mails?.[0].Subject).toContain('evt_1');
    expect(await eventually(async () => orders.requests.find((r) => r.url === `/orders/${orderId}/notification`))).toMatchObject({
      method: 'POST',
    });
  });

  test('retries later when the mail server is unreachable', async () => {
    const orderId = randomUUID();
    const customer = `fn_${orderId.slice(0, 8)}`;
    smtp.enabled = false;

    publishOrderPaid(orderId, customer);
    await new Promise((r) => setTimeout(r, 200));
    smtp.enabled = true;

    const mails = await eventually(async () => {
      const found = await mailsTo(`${customer}@customers.example`);
      return found.length > 0 ? found : undefined;
    });
    expect(mails).toHaveLength(1);
  });
});
