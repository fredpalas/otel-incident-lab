import type { DateRange } from './DateRange';
import { DiscountPercentage } from './DiscountPercentage';
import type { EventDiscount } from './EventDiscount';
import type { EventId } from './EventId';
import type { Money } from './Money';
import type { Priority } from './Priority';
import type { TicketQuantity } from './TicketQuantity';

const GROUP_SIZE = 7;
const GROUP_DISCOUNT = DiscountPercentage.of(10);

export class Price {
  private constructor(
    readonly eventId: EventId,
    readonly dateRange: DateRange,
    readonly priority: Priority,
    readonly amount: Money,
  ) {}

  static of(eventId: EventId, dateRange: DateRange, priority: Priority, amount: Money): Price {
    return new Price(eventId, dateRange, priority, amount);
  }

  isValidOn(date: Date): boolean {
    return this.dateRange.contains(date);
  }

  applyDiscount(discount: EventDiscount | undefined): Price {
    if (!discount) return this;
    return new Price(this.eventId, this.dateRange, this.priority, this.amount.applyDiscount(discount.percentage));
  }

  unitPriceFor(tickets: TicketQuantity): Money {
    return tickets.value >= GROUP_SIZE ? this.forGroup() : this.amount;
  }

  /** Price of each ticket in a group booking: 10 % off. */
  private forGroup(): Money {
    return this.amount.applyDiscount(GROUP_DISCOUNT);
  }
}
