import { Injectable } from '@nestjs/common';
import { config } from '../../../config';
import type { EventId } from '../../domain/EventId';
import { Money } from '../../domain/Money';
import { Pricing } from '../../domain/Pricing';
import type { TicketQuantity } from '../../domain/TicketQuantity';
import { callUpstream } from '../upstream/callUpstream';

@Injectable()
export class HttpPricing extends Pricing {
  async unitPrice(eventId: EventId, tickets: TicketQuantity): Promise<Money> {
    const quote = await callUpstream<{ unitPriceCents: number; currency: string }>(
      'catalog',
      `${config.catalogUrl}/pricing/${eventId.value}?tickets=${tickets.value}`,
      config.catalogTimeoutMs,
    );
    return Money.of(quote.unitPriceCents, quote.currency);
  }
}
