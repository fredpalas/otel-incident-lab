/** What travels on the bus: the event plus the metadata every consumer can rely on. */
export interface EventEnvelope<T = Record<string, unknown>> {
  readonly eventId: string;
  readonly eventName: string;
  readonly occurredOn: string;
  /** The business conversation (one checkout) this event belongs to. */
  readonly correlationId?: string;
  /** The request or message that directly caused this event. */
  readonly causationId?: string;
  /** Trace context (traceparent, baggage) of the request that recorded the event. */
  readonly headers?: Record<string, string>;
  readonly data: T;
}
