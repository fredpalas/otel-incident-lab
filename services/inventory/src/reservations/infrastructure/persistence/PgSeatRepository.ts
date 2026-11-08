import type { ClientBase } from 'pg';
import { EventId } from '../../domain/EventId';
import { OrderId } from '../../domain/OrderId';
import { Seat } from '../../domain/Seat';
import type { SeatCount } from '../../domain/SeatCount';
import { SeatId } from '../../domain/SeatId';
import { SeatRepository } from '../../domain/SeatRepository';
import { SeatStatus } from '../../domain/SeatStatus';

interface SeatRow {
  id: string;
  event_id: string;
  status: string;
  order_id: string | null;
}

export class PgSeatRepository extends SeatRepository {
  constructor(private readonly client: ClientBase) {
    super();
  }

  async eventExists(eventId: EventId): Promise<boolean> {
    const { rowCount } = await this.client.query('SELECT 1 FROM events WHERE id = $1', [eventId.value]);
    return (rowCount ?? 0) > 0;
  }

  async findAvailable(eventId: EventId, count: SeatCount): Promise<Seat[]> {
    const { rows } = await this.client.query<SeatRow>(
      `SELECT id, event_id, status, order_id FROM seats WHERE event_id = $1 AND status = 'AVAILABLE'
       ORDER BY id LIMIT $2 FOR UPDATE SKIP LOCKED`,
      [eventId.value, count.value],
    );
    return rows.map((row) =>
      Seat.restore(SeatId.of(row.id), EventId.of(row.event_id), SeatStatus.of(row.status), row.order_id ? OrderId.of(row.order_id) : undefined),
    );
  }

  async saveAll(seats: Seat[]): Promise<void> {
    const dtos = seats.map((seat) => seat.toDto());
    await this.client.query(
      `UPDATE seats AS s SET status = v.status, order_id = v.order_id::uuid
       FROM unnest($1::bigint[], $2::text[], $3::text[]) AS v (id, status, order_id)
       WHERE s.id = v.id`,
      [dtos.map((d) => d.id), dtos.map((d) => d.status), dtos.map((d) => d.orderId ?? null)],
    );
  }

  async releaseFor(orderId: OrderId): Promise<void> {
    await this.client.query(`UPDATE seats SET status = 'AVAILABLE', order_id = NULL WHERE order_id = $1`, [orderId.value]);
  }
}
