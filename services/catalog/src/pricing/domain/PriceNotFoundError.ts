export class PriceNotFoundError extends Error {
  override readonly name = 'PriceNotFoundError';

  constructor(eventId: string) {
    super(`no price for event ${eventId}`);
  }
}
