import { DateRange } from '../../src/pricing/domain/DateRange';
import { DiscountPercentage } from '../../src/pricing/domain/DiscountPercentage';
import { EventDiscount } from '../../src/pricing/domain/EventDiscount';
import { EventId } from '../../src/pricing/domain/EventId';
import { Money } from '../../src/pricing/domain/Money';
import { Price } from '../../src/pricing/domain/Price';
import { Priority } from '../../src/pricing/domain/Priority';
import { TicketQuantity } from '../../src/pricing/domain/TicketQuantity';
import { InMemoryPriceRepository } from '../../src/pricing/infrastructure/InMemoryPriceRepository';
import { InvalidArgumentError } from '../../src/shared/domain/InvalidArgumentError';

describe('Price', () => {
  let eventId: EventId;
  let year: DateRange;
  let price: Price;

  beforeEach(() => {
    eventId = EventId.of('evt_1');
    year = DateRange.of(new Date('2026-01-01'), new Date('2026-12-31'));
    price = Price.of(eventId, year, Priority.of(0), Money.of(4500, 'EUR'));
  });

  test('an event discount lowers the price, rounded to the cent', () => {
    const discounted = price.applyDiscount(EventDiscount.of(eventId, DiscountPercentage.of(15)));

    expect(discounted.amount).toEqual(Money.of(3825, 'EUR'));
  });

  test('without a discount the price stays the same', () => {
    expect(price.applyDiscount(undefined).amount).toEqual(Money.of(4500, 'EUR'));
  });

  test('below a group booking each ticket costs the listed price', () => {
    expect(price.unitPriceFor(TicketQuantity.of(6))).toEqual(Money.of(4500, 'EUR'));
  });

  test('a group booking gets 10 % off each ticket', () => {
    expect(price.unitPriceFor(TicketQuantity.of(7))).toEqual(Money.of(4050, 'EUR'));
  });

  test('the current price is the one with the highest priority valid on that date', async () => {
    const promo = Price.of(eventId, DateRange.of(new Date('2026-11-01'), new Date('2026-11-30')), Priority.of(10), Money.of(3900, 'EUR'));
    const prices = new InMemoryPriceRepository([price, promo]);

    expect((await prices.currentFor(eventId, new Date('2026-11-16')))?.amount).toEqual(Money.of(3900, 'EUR'));
    expect((await prices.currentFor(eventId, new Date('2026-12-16')))?.amount).toEqual(Money.of(4500, 'EUR'));
    expect(await prices.currentFor(eventId, new Date('2027-01-02'))).toBeUndefined();
  });
});

describe('pricing value objects', () => {
  test('a discount cannot exceed 50 %', () => {
    expect(() => DiscountPercentage.of(60)).toThrow(InvalidArgumentError);
  });

  test('a date range cannot end before it starts', () => {
    expect(() => DateRange.of(new Date('2026-02-01'), new Date('2026-01-01'))).toThrow(InvalidArgumentError);
  });

  test('money is an integer amount of cents', () => {
    expect(() => Money.of(10.5, 'EUR')).toThrow(InvalidArgumentError);
  });
});
