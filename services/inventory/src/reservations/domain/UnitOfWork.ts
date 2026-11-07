import type { SeatRepository } from './SeatRepository';

/** Runs `work` atomically: every change commits together or none does. */
export abstract class UnitOfWork {
  abstract run<T>(work: (seats: SeatRepository) => Promise<T>): Promise<T>;
}
