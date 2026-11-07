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

  async availableSeatIds(eventId: EventId, count: SeatCount): Promise<SeatId[]> {
    const { rows } = await this.client.query<{ id: string }>(
      `SELECT id FROM seats WHERE event_id = $1 AND status = 'AVAILABLE'
       ORDER BY id LIMIT $2 FOR UPDATE SKIP LOCKED`,
      [eventId.value, count.value],
    );
    return rows.map((row) => SeatId.of(row.id));
  }

  async find(id: SeatId): Promise<Seat | undefined> {
    const { rows } = await this.client.query<SeatRow>('SELECT id, event_id, status, order_id FROM seats WHERE id = $1', [id.value]);
    const row = rows[0];
    if (!row) return undefined;
    return Seat.restore(
      SeatId.of(row.id),
      EventId.of(row.event_id),
      SeatStatus.of(row.status),
      row.order_id ? OrderId.of(row.order_id) : undefined,
    );
  }

  async save(seat: Seat): Promise<void> {
    const dto = seat.toDto();
    await this.client.query('UPDATE seats SET status = $2, order_id = $3 WHERE id = $1', [dto.id, dto.status, dto.orderId ?? null]);
  }

  async releaseFor(orderId: OrderId): Promise<void> {
    await this.client.query(`UPDATE seats SET status = 'AVAILABLE', order_id = NULL WHERE order_id = $1`, [orderId.value]);
  }
}
