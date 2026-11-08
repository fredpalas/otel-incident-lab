# ADR-0011: D8 is the outbox relay, not a missing header

**Date**: 2026-11-08
**Status**: Accepted
**Deciders**: Workshop lead trainer
**Triggered by**: Phase 4 planning (D8, lost context across the queue)

---

## Context

The catalog described D8 as "orders publishes `order.paid` without trace headers". But
from lab 2 every service runs the zero-code auto-instrumentations, and
`@opentelemetry/instrumentation-amqplib` injects `traceparent` on publish and extracts it
on consume by itself. A direct publish inside the request would have "fixed" D8 in lab 2
without anybody touching it.

## Options Considered

### Option A — Disable instrumentation-amqplib in `instrumentation.ts`
- **Cons**: artificial and signposted; the "fix" is to turn it back on. Teaches nothing
  about async boundaries.

### Option B — Transactional outbox with a timer-driven relay
orders writes the event to an `outbox` table in the same transaction as the order
(`PgOrderRepository.save`); `OutboxRelay` publishes pending rows every 500 ms.
- **Pros**: the pattern real systems use to never lose an event (and that DDD folks
  recognise: `AggregateRoot.pullDomainEvents` → outbox). The context is lost exactly
  where it is lost in production: the relay runs outside the request, so amqplib
  propagates the relay's context. The fix is the real one: capture the context (and
  `correlationId`/`causationId`) when the event is recorded, carry it in the envelope,
  and **link** from the consumer.
- **Cons**: a polling relay produces database spans outside any request; the lab-2
  solution sets `instrumentation-pg` `requireParentSpan: true` so they don't flood Tempo.

## Decision

**Option B.** `payment.failed` (payments → inventory) is published directly, inside the
request, and keeps its context thanks to zero-code instrumentation. The contrast is part
of lab 4: same bus, same library; one path keeps the context, the other doesn't.

## Operational Consequences

- verify-4 finds notifier's trace by `correlation_id` (TraceQL), and Tempo only returns
  it once the trace has gone quiet (~10–20 s): the check polls up to 45 s.
- Notifier retries create one trace per delivery attempt, each linked to the checkout;
  retries carry the failed delivery's `eventId` as `causationId`.
