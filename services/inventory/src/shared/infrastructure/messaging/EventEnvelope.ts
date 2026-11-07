/** What travels on the bus: the event plus the metadata every consumer can rely on. */
export interface EventEnvelope<T = Record<string, unknown>> {
  readonly eventId: string;
  readonly eventName: string;
  readonly occurredOn: string;
  readonly data: T;
}
