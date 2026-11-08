import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import type { SeatRepository } from '../../domain/SeatRepository';
import { UnitOfWork } from '../../domain/UnitOfWork';
import { PgSeatRepository } from './PgSeatRepository';

/** One database transaction per unit of work, on a connection borrowed from the pool. */
@Injectable()
export class PgUnitOfWork extends UnitOfWork {
  constructor(private readonly pool: Pool) {
    super();
  }

  async run<T>(work: (seats: SeatRepository) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(new PgSeatRepository(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
