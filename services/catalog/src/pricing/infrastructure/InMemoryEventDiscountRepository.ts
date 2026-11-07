import { Injectable } from '@nestjs/common';
import { DiscountPercentage } from '../domain/DiscountPercentage';
import { EventDiscount } from '../domain/EventDiscount';
import { EventDiscountRepository } from '../domain/EventDiscountRepository';
import { EventId } from '../domain/EventId';

const DISCOUNTS = [EventDiscount.of(EventId.of('evt_3'), DiscountPercentage.of(10))];

@Injectable()
export class InMemoryEventDiscountRepository extends EventDiscountRepository {
  async forEvent(eventId: EventId): Promise<EventDiscount | undefined> {
    return DISCOUNTS.find((d) => d.eventId.value === eventId.value);
  }
}
