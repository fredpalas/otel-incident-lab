import { Injectable, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { config } from '../../../config';
import type { EventEnvelope } from '../../../shared/infrastructure/messaging/EventEnvelope';
import { logger } from '../../../shared/infrastructure/logger';
import { EXCHANGE, RabbitMq } from '../../../shared/infrastructure/messaging/RabbitMq';

interface OutboxRow {
  id: string;
  event_name: string;
  payload: EventEnvelope;
}

/** Publishes the events stored in the outbox, in order, at least once. */
@Injectable()
export class OutboxRelay implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly pool: Pool,
    private readonly rabbit: RabbitMq,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.tick(), config.outboxPollMs);
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  async publishPending(): Promise<void> {
    const channel = await this.rabbit.channel();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<OutboxRow>(
        `SELECT id, event_name, payload FROM outbox WHERE published_at IS NULL
         ORDER BY occurred_on LIMIT 50 FOR UPDATE SKIP LOCKED`,
      );
      for (const row of rows) {
        channel.publish(EXCHANGE, row.event_name, Buffer.from(JSON.stringify(row.payload)), {
          persistent: true,
          contentType: 'application/json',
          messageId: row.id,
        });
      }
      if (rows.length > 0) {
        await client.query('UPDATE outbox SET published_at = now() WHERE id = ANY($1)', [rows.map((r) => r.id)]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.publishPending();
    } catch (error) {
      // The rows stay pending and the next tick tries again.
      logger.error({ err: error }, 'outbox relay failed');
    } finally {
      this.running = false;
    }
  }
}
