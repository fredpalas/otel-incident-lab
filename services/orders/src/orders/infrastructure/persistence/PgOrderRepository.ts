import { randomUUID } from 'node:crypto';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { CustomerId } from '../../domain/CustomerId';
import { EventId } from '../../domain/EventId';
import { Money } from '../../domain/Money';
import { Order } from '../../domain/Order';
import { OrderId } from '../../domain/OrderId';
import { OrderRepository } from '../../domain/OrderRepository';
import { OrderStatus } from '../../domain/OrderStatus';
import { TicketQuantity } from '../../domain/TicketQuantity';
import type { EventEnvelope } from '../../../shared/infrastructure/messaging/EventEnvelope';
import { causedByCurrentRequest } from '../../../shared/infrastructure/messaging/causedByCurrentRequest';

interface OrderRow {
  id: string;
  customer_id: string;
  event_id: string;
  tickets: number;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: Date;
}

@Injectable()
export class PgOrderRepository extends OrderRepository implements OnModuleInit {
  constructor(private readonly pool: Pool) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id           uuid PRIMARY KEY,
        customer_id  text        NOT NULL,
        event_id     text        NOT NULL,
        tickets      integer     NOT NULL,
        amount_cents integer     NOT NULL,
        currency     char(3)     NOT NULL,
        status       text        NOT NULL,
        created_at   timestamptz NOT NULL,
        updated_at   timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders (customer_id);
      CREATE TABLE IF NOT EXISTS outbox (
        id           uuid PRIMARY KEY,
        event_name   text        NOT NULL,
        payload      jsonb       NOT NULL,
        occurred_on  timestamptz NOT NULL,
        published_at timestamptz
      );
      CREATE INDEX IF NOT EXISTS outbox_pending_idx ON outbox (occurred_on) WHERE published_at IS NULL;
    `);
  }

  /** The order and its domain events are stored in one transaction (transactional outbox). */
  async save(order: Order): Promise<void> {
    const dto = order.toDto();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO orders (id, customer_id, event_id, tickets, amount_cents, currency, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, updated_at = now()`,
        [dto.id, dto.customerId, dto.eventId, dto.tickets, dto.amountCents, dto.currency, dto.status, dto.createdAt],
      );
      for (const event of order.pullDomainEvents()) {
        const envelope: EventEnvelope = {
          eventId: randomUUID(),
          eventName: event.eventName,
          occurredOn: event.occurredOn.toISOString(),
          ...causedByCurrentRequest(),
          data: event.toPrimitives(),
        };
        await client.query('INSERT INTO outbox (id, event_name, payload, occurred_on) VALUES ($1, $2, $3, $4)', [
          envelope.eventId,
          envelope.eventName,
          envelope,
          envelope.occurredOn,
        ]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async find(id: OrderId): Promise<Order | undefined> {
    const { rows } = await this.pool.query<OrderRow>('SELECT * FROM orders WHERE id = $1', [id.value]);
    const row = rows[0];
    if (!row) return undefined;
    return Order.restore(
      OrderId.of(row.id),
      CustomerId.of(row.customer_id),
      EventId.of(row.event_id),
      TicketQuantity.of(row.tickets),
      Money.of(row.amount_cents, row.currency),
      OrderStatus.of(row.status),
      row.created_at,
    );
  }
}
