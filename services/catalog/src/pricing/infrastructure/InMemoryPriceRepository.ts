import { Injectable } from '@nestjs/common';
import { DateRange } from '../domain/DateRange';
import { EventId } from '../domain/EventId';
import { Money } from '../domain/Money';
import { Price } from '../domain/Price';
import { PriceRepository } from '../domain/PriceRepository';
import { Priority } from '../domain/Priority';

const SEASON = DateRange.of(new Date('2026-01-01'), new Date('2030-12-31T23:59:59Z'));

/** Price list maintained by the box office; small enough to live in memory. */
const PRICE_LIST = [
  Price.of(EventId.of('evt_1'), SEASON, Priority.of(0), Money.of(4500, 'EUR')),
  Price.of(EventId.of('evt_1'), DateRange.of(new Date('2026-01-01'), new Date('2026-06-30')), Priority.of(10), Money.of(3900, 'EUR')),
  Price.of(EventId.of('evt_2'), SEASON, Priority.of(0), Money.of(6000, 'EUR')),
  Price.of(EventId.of('evt_3'), SEASON, Priority.of(0), Money.of(3500, 'EUR')),
];

@Injectable()
export class InMemoryPriceRepository extends PriceRepository {
  constructor(private readonly prices: Price[] = PRICE_LIST) {
    super();
  }

  async currentFor(eventId: EventId, date: Date): Promise<Price | undefined> {
    return this.prices
      .filter((p) => p.eventId.value === eventId.value && p.isValidOn(date))
      .sort((a, b) => b.priority.value - a.priority.value)[0];
  }
}
