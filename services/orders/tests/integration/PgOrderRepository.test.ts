import { Pool } from 'pg';
import { CustomerId } from '../../src/orders/domain/CustomerId';
import { EventId } from '../../src/orders/domain/EventId';
import { LoyaltyTier } from '../../src/orders/domain/LoyaltyTier';
import { Money } from '../../src/orders/domain/Money';
import { Order } from '../../src/orders/domain/Order';
import { OrderId } from '../../src/orders/domain/OrderId';
import { TicketQuantity } from '../../src/orders/domain/TicketQuantity';
import { PgOrderRepository } from '../../src/orders/infrastructure/persistence/PgOrderRepository';
import { testDatabaseUrl } from './database';

describe('PgOrderRepository', () => {
  let pool: Pool;
  let repository: PgOrderRepository;
  let order: Order;

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl() });
    repository = new PgOrderRepository(pool);
    await repository.onModuleInit();
  });

  afterAll(() => pool.end());

  beforeEach(() => {
    order = Order.place(OrderId.generate(), CustomerId.of('cus_it'), EventId.of('evt_1'), TicketQuantity.of(2), Money.of(4500, 'EUR'), LoyaltyTier.STANDARD);
  });

  afterEach(async () => {
    await pool.query(`DELETE FROM outbox WHERE payload->'data'->>'orderId' = $1`, [order.id.value]);
    await pool.query('DELETE FROM orders WHERE id = $1', [order.id.value]);
  });

  test('persists and retrieves an order by id', async () => {
    await repository.save(order);

    const found = await repository.find(order.id);

    expect(found?.toDto()).toEqual(order.toDto());
  });

  test('saving again updates the status', async () => {
    await repository.save(order);
    order.markPaid();
    await repository.save(order);

    expect((await repository.find(order.id))?.currentStatus().value).toBe('PAID');
  });

  test('the events of a saved order go to the outbox, to be published later', async () => {
    order.markPaid();
    await repository.save(order);

    const { rows } = await pool.query(
      `SELECT event_name, payload, published_at FROM outbox WHERE payload->'data'->>'orderId' = $1`,
      [order.id.value],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ event_name: 'order.paid', published_at: null });
    expect(rows[0].payload).toMatchObject({
      eventName: 'order.paid',
      data: { orderId: order.id.value, customerId: 'cus_it', eventId: 'evt_1', tickets: 2, amountCents: 9000, currency: 'EUR' },
    });
  });

  test('returns undefined for an unknown id', async () => {
    expect(await repository.find(OrderId.generate())).toBeUndefined();
  });
});
