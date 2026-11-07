export interface QuoteDto {
  readonly eventId: string;
  readonly tickets: number;
  readonly unitPriceCents: number;
  readonly currency: string;
}
