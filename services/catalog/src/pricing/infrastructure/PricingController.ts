import { Controller, Get, Param, Query } from '@nestjs/common';
import { PricingService } from '../application/PricingService';
import type { QuoteDto } from '../domain/QuoteDto';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get(':eventId')
  quote(@Param('eventId') eventId: string, @Query('tickets') tickets?: string): Promise<QuoteDto> {
    return this.pricing.quote(eventId, Number(tickets));
  }
}
