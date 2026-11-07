export class EventNotFoundError extends Error {
  override readonly name = 'EventNotFoundError';

  constructor(eventId: string) {
    super(`event ${eventId} not found`);
  }
}
