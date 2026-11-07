import { Injectable, type OnModuleInit } from '@nestjs/common';
import { Client } from 'pg';
import { config } from '../../../config';

// Venue capacity per event. evt_1 is the big on-sale event the background traffic buys.
const EVENTS = [
  { id: 'evt_1', name: 'Arena Night', seats: 200_000 },
  { id: 'evt_2', name: 'Jazz Club Session', seats: 5_000 },
  { id: 'evt_3', name: 'Open Air Festival', seats: 5_000 },
];
const SEATS_PER_ROW = 50;
const ROWS_PER_SECTION = 40;

/** Creates the tables and puts the seats on sale the first time the service starts. */
@Injectable()
export class InventorySchema implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    const client = new Client({ connectionString: config.databaseUrl });
    await client.connect();
    try {
      // Several replicas (or test runs) may start at once: seed only once.
      await client.query('SELECT pg_advisory_lock(4711)');
      await client.query(`
        CREATE TABLE IF NOT EXISTS events (
          id    text PRIMARY KEY,
          name  text NOT NULL
        );
        CREATE TABLE IF NOT EXISTS seats (
          id        bigserial PRIMARY KEY,
          event_id  text    NOT NULL REFERENCES events (id),
          section   integer NOT NULL,
          seat_row  integer NOT NULL,
          seat_no   integer NOT NULL,
          status    text    NOT NULL DEFAULT 'AVAILABLE',
          order_id  uuid
        );
        CREATE INDEX IF NOT EXISTS seats_available_idx ON seats (event_id, id) WHERE status = 'AVAILABLE';
        CREATE INDEX IF NOT EXISTS seats_order_id_idx ON seats (order_id);
      `);
      await client.query('BEGIN');
      for (const event of EVENTS) {
        const { rowCount } = await client.query('INSERT INTO events (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
          event.id,
          event.name,
        ]);
        if (rowCount === 0) continue;
        await client.query(
          `INSERT INTO seats (event_id, section, seat_row, seat_no)
           SELECT $1, n / ($3::int * $4::int) + 1, n / $3::int % $4::int + 1, n % $3::int + 1
           FROM generate_series(0, $2::int - 1) AS n`,
          [event.id, event.seats, SEATS_PER_ROW, ROWS_PER_SECTION],
        );
      }
      await client.query('COMMIT');
    } finally {
      await client.query('SELECT pg_advisory_unlock(4711)');
      await client.end();
    }
  }
}
