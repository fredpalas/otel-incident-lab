import { Injectable } from '@nestjs/common';
import { EventDiscountRepository } from '../domain/EventDiscountRepository';
import { EventId } from '../domain/EventId';
import { PriceNotFoundError } from '../domain/PriceNotFoundError';
import { PriceRepository } from '../domain/PriceRepository';
import type { QuoteDto } from '../domain/QuoteDto';
import { TicketQuantity } from '../domain/TicketQuantity';

@Injectable()
export class PricingService {
  constructor(
    private readonly prices: PriceRepository,
    private readonly discounts: EventDiscountRepository,
  ) {}

  async quote(eventIdValue: string, ticketCount: number): Promise<QuoteDto> {
    const eventId = EventId.of(eventIdValue);
    const tickets = TicketQuantity.of(ticketCount);
    const current = await this.prices.currentFor(eventId, new Date());
    if (!current) throw new PriceNotFoundError(eventId.value);

    const unitPrice = current.applyDiscount(await this.discounts.forEvent(eventId)).unitPriceFor(tickets);
    return { eventId: eventId.value, tickets: tickets.value, unitPriceCents: unitPrice.cents, currency: unitPrice.currency };
  }
}
