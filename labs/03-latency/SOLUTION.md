# Lab 3 — Solution

`git diff lab-3-start lab-3-solution` shows the whole change: two connectors in the
Collector, one query instead of a loop in `inventory`, `Promise.all` in `orders`, and a
connection pool in `inventory`. The p99 itself (D10) has no code fix.

## 1. Metrics from traces (Collector)

```yaml
connectors:
  spanmetrics:
    histogram:
      explicit:
        buckets: [50ms, 100ms, 200ms, 300ms, 500ms, 750ms, 1s, 1.5s, 2s, 3s, 5s]
    exemplars:
      enabled: true
    metrics_flush_interval: 15s
  servicegraph:
    metrics_flush_interval: 15s

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp_grpc/lgtm, spanmetrics, servicegraph]
    metrics:
      receivers: [spanmetrics, servicegraph]
      processors: [batch]
      exporters: [otlp_grpc/lgtm]
```

A connector is the exporter of one pipeline and the receiver of another. `spanmetrics`
turns every span into calls, errors and a duration histogram per service and span name
(`traces_span_metrics_calls_total`, `traces_span_metrics_duration_milliseconds_bucket`).
**Exemplars** attach the trace id of a sample span to each histogram bucket: a point
on the p99 line becomes a link to a real trace. `servicegraph` pairs client and server
spans into `traces_service_graph_request_total{client, server}`, which is what
Grafana's service graph draws.

The services still don't export any metrics of their own: RED from spans is enough here.

## 2. D10 — who owns the p99

The heatmap has two bands: almost every checkout under 300 ms, a thin band at
0.5–1 s. p50 (~150 ms) sits in the first, p99 (~900 ms) in the second; the average
describes neither. An exemplar from the top band opens a trace where one span,
`payments → fake-psp`, takes nearly all the time: either a slow charge (300–600 ms) or
one that payments cut at its 700 ms timeout — and in that trace the PSP's own span
keeps going for 1.5–3 s. TraceQL proves it at scale:

```
{ resource.service.name = "fake-psp" && duration > 1s }
```

It's the provider's long tail (~8 % of charges take 300–600 ms, ~2 % take 1.5–3 s). No code to fix in our
services. What you *can* decide, with the heatmap as evidence:

- the **timeout** (lab 2 set it to 700 ms: those charges fail fast instead of hanging);
- what the customer sees then, and how the order is **reconciled** with the PSP later;
- an **SLO** you can keep ("p95 < 500 ms", not "p99 < 300 ms") or an asynchronous
  confirmation ("we'll email you");
- a conversation with the provider.

## 3. D4 — the comb (N+1)

`ReservationService` loaded each seat on its own and saved it on its own: 1 + 2N
queries (13 for 6 tickets, 21 for 10). One query locks the seats it needs, one saves
them all:

```ts
// ReservationService
const available = await seats.findAvailable(eventId, count);   // SELECT … LIMIT n FOR UPDATE SKIP LOCKED
for (const seat of available) seat.reserve(orderId);           // the domain still decides
await seats.saveAll(available);                                // UPDATE … FROM unnest($1, $2, $3)
```

The aggregate keeps its rule (`Seat.reserve` refuses a seat that isn't available). Only
the repository changed: it loads and stores seats in sets.

## 4. D5 — the staircase

`orders` waited for inventory, then pricing, then the customer's tier. None of them
needs the others' result:

```ts
const [, unitPrice, tier] = await Promise.all([
  this.seats.reserve(orderId, eventId, tickets),
  this.pricing.unitPrice(eventId, tickets),
  this.customers.tierOf(customerId),
]);
```

Before payments: ~190 ms → ~90 ms (the slowest call: catalog, across the WAN). If any of
them fails, `Promise.all` rejects and the checkout fails, as before.

**What's left**: when pricing fails after inventory reserved the seats, those seats stay
reserved. It was already true with the sequential code. Fixing it is a design decision:
release them (compensation), let reservations expire, or a saga.

## 5. D6 — a connection per request

`PgUnitOfWork` opened a new `Client` for every request: TCP handshake + authentication
(the `pg.connect` span, 5–10 ms), and one Postgres connection per request in flight.
Postgres accepts 20 for every service together. In a burst, the 21st request got
`sorry, too many clients already`.

```ts
// AppModule: one pool per process
{ provide: Pool, useFactory: () => new Pool({ connectionString: config.databaseUrl, max: 5, idleTimeoutMillis: 30_000 }) }

// PgUnitOfWork: borrow, use, give back
const client = await this.pool.connect();
try { … } finally { client.release(); }
```

Requests beyond 5 wait for a free connection instead of failing. `orders` (5) +
`inventory` (5) stay well under 20.

## Stretch — where the waiting goes

With `max: 2`, `make spike` makes requests queue for a connection. In a trace it shows as
a **gap**: the inventory server span starts, and its first database span begins much
later. Nothing in the trace says why. A manual span makes it visible:

```ts
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('inventory');
const client = await tracer.startActiveSpan('pool.acquire', async (span) => {
  try {
    return await this.pool.connect();
  } finally {
    span.end();
  }
});
```

(`instrumentation-pg` also records a `pg-pool.connect` span; the manual one shows the
same idea with code you own.)
