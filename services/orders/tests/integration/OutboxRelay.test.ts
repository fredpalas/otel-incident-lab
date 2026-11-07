import { randomUUID } from 'node:crypto';
import { type Channel, type ChannelModel, connect } from 'amqplib';
import { Pool } from 'pg';
import { OutboxRelay } from '../../src/orders/infrastructure/messaging/OutboxRelay';
import { PgOrderRepository } from '../../src/orders/infrastructure/persistence/PgOrderRepository';
import { EXCHANGE, RabbitMq } from '../../src/shared/infrastructure/messaging/RabbitMq';
import { testDatabaseUrl } from './database';
import { testAmqpUrl } from './messaging';

describe('OutboxRelay', () => {
  let pool: Pool;
  let rabbit: RabbitMq;
  let relay: OutboxRelay;
  let connection: ChannelModel;
  let channel: Channel;
  let queue: string;
  let eventId: string;

  beforeAll(async () => {
    process.env.AMQP_URL = testAmqpUrl();
    pool = new Pool({ connectionString: testDatabaseUrl() });
    await new PgOrderRepository(pool).onModuleInit();
    rabbit = new RabbitMq();
    relay = new OutboxRelay(pool, rabbit);
    connection = await connect(testAmqpUrl());
    channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    ({ queue } = await channel.assertQueue('', { exclusive: true }));
    await channel.bindQueue(queue, EXCHANGE, 'order.paid');
  });

  afterAll(async () => {
    await connection.close();
    await rabbit.onApplicationShutdown();
    await pool.end();
  });

  beforeEach(async () => {
    // Start from an empty outbox: rows left pending by other tests would be published too.
    await pool.query('UPDATE outbox SET published_at = now() WHERE published_at IS NULL');
    eventId = randomUUID();
    await pool.query(`INSERT INTO outbox (id, event_name, payload, occurred_on) VALUES ($1, 'order.paid', $2, now())`, [
      eventId,
      { eventId, eventName: 'order.paid', occurredOn: new Date().toISOString(), data: { orderId: 'o-1' } },
    ]);
  });

  afterEach(() => pool.query('DELETE FROM outbox WHERE id = $1', [eventId]));

  // Other test suites publish order.paid to the same broker at the same time: only our
  // event counts.
  const ours = async (): Promise<number> => {
    await new Promise((r) => setTimeout(r, 200));
    let count = 0;
    for (let message = await channel.get(queue, { noAck: true }); message; message = await channel.get(queue, { noAck: true })) {
      if ((JSON.parse(message.content.toString()) as { eventId?: string }).eventId === eventId) count++;
    }
    return count;
  };

  test('publishes pending events to the exchange and marks them published', async () => {
    await relay.publishPending();

    expect(await ours()).toBe(1);
    const { rows } = await pool.query('SELECT published_at FROM outbox WHERE id = $1', [eventId]);
    expect(rows[0].published_at).not.toBeNull();
  });

  test('does not publish an event twice', async () => {
    await relay.publishPending();
    await relay.publishPending();

    expect(await ours()).toBe(1);
  });
});
