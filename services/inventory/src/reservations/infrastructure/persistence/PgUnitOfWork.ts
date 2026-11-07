import { Injectable } from '@nestjs/common';
import { Client } from 'pg';
import { config } from '../../../config';
import type { SeatRepository } from '../../domain/SeatRepository';
import { UnitOfWork } from '../../domain/UnitOfWork';
import { PgSeatRepository } from './PgSeatRepository';

/** One database transaction per unit of work. */
@Injectable()
export class PgUnitOfWork extends UnitOfWork {
  async run<T>(work: (seats: SeatRepository) => Promise<T>): Promise<T> {
    const client = new Client({ connectionString: config.databaseUrl });
    await client.connect();
    try {
      await client.query('BEGIN');
      const result = await work(new PgSeatRepository(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      await client.end();
    }
  }
}
