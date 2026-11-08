# 01 — Architecture

## Domain

A small **concert ticketing** system: a customer reserves N tickets for an event,
pays, and receives the tickets by email (simulated).

## Topology

```
                 ┌──────────── k6 loadgen (continuous baseline + incident scripts)
                 ▼
            ┌─────────┐
            │ gateway │  HTTP entrypoint (BFF). Creates correlation_id (from lab 4)
            └────┬────┘
                 ▼
            ┌─────────┐   in parallel after D5 fix:
            │ orders  │──┬──► inventory ──► Postgres (seats)        [D4 N+1, D6 no pool]
            └────┬────┘  ├──► toxiproxy (~80 ms WAN) ──► catalog /pricing    [D7 group price]
                 │       └──► toxiproxy (~80 ms WAN) ──► catalog /customers  (loyalty tier)
                 │
                 ├──► payments ──► toxiproxy ──► fake-psp (PHP, pre-instrumented)
                 │       │                        [D2 resets, D3 retries, D10 long tail, D9 PII]
                 │       └──► RabbitMQ (payment.failed) ──► inventory (releases the seats)
                 │
                 └──► outbox table ··relay (timer)··► RabbitMQ (order.paid) ──► notifier ──► toxiproxy ──► mailpit
                          [D8: the relay publishes outside the request]                     (SMTP resets)

   all services ──OTLP──► otel-collector (contrib, participants edit it)
                              └──OTLP──► grafana/otel-lgtm (Grafana, Loki, Tempo, Prometheus, Pyroscope)
```

## Services

| Service | Lang | Owns | Participants edit? |
|---|---|---|---|
| `gateway` | TS | Public API `POST /checkout`, `GET /orders/:id` | yes |
| `orders` | TS | Checkout orchestration, `orders` table, publishes `order.paid` | yes |
| `inventory` | TS | `events`, `seats` tables; reserve seats | yes |
| `catalog` | TS | `/pricing/:eventId?tickets=N` (price list, event and group discounts), `/customers/:id` (loyalty tier); in memory, reached through Toxiproxy (ADR-0010) | yes (lab 4/5) |
| `payments` | TS | Calls the external PSP | yes |
| `notifier` | TS | Consumes `order.paid`, emails the customer (SMTP → Mailpit via Toxiproxy), marks the order `NOTIFIED`; retries from a TTL queue, 3 attempts | yes |
| `mailpit` | — | Stand-in email provider; UI on 8025 | **no** |
| `fake-psp` | PHP | Simulated external payment provider with latency/error profiles | **no** |

Keep each TS service small (a few hundred lines): one standalone NestJS 11 app per
service (ADR-0005) with `domain/`, `application/`, `infrastructure/` folders and light
DDD — participants must navigate the code in minutes. `fake-psp` is PHP on FrankenPHP
(ADR-0006).

### Order lifecycle

`PENDING → PAID → NOTIFIED`, or `PENDING → FAILED`. An order stuck in `PENDING`
> 30 s is the observable business symptom of D1.

## Ports (host)

| Port | What |
|---|---|
| 8080 | gateway |
| 3000 | Grafana (anonymous admin for the workshop) |
| 4317 / 4318 | Collector OTLP gRPC / HTTP |
| 8474 | Toxiproxy API |
| 15672 | RabbitMQ UI (optional) |
| 8025 | Mailpit UI: the emails customers received |

Internal-only (verify scripts run inside the compose network): Tempo 3200,
Loki 3100, Prometheus 9090, Postgres 5432.

## Telemetry pipeline

```
service ──OTLP──► otel-collector ──OTLP──► otel-lgtm (its internal collector → backends)
```

The **separate Collector** exists so participants can edit a readable
`observability/collector/config.yaml`. It evolves per lab:

| Lab | Collector additions |
|---|---|
| 1 | `otlp` receiver, `batch`, logs pipeline → lgtm |
| 2 | traces pipeline |
| 3 | `spanmetrics` connector (histograms + **exemplars**), `servicegraph` connector |
| 4 | — (baggage/attributes are SDK-side) |
| 5 | `redaction` / `attributes` processor for D9 |

## Instrumentation progression (per service)

| Tag | Logs | Traces | Metrics |
|---|---|---|---|
| `lab-1-start` | none / `console.log` noise | none | none |
| `lab-1-solution` | `pino` JSON → OTLP logs (`pino-opentelemetry-transport`) | none | none |
| `lab-2-solution` | + `@opentelemetry/instrumentation-pino` injects `trace_id`/`span_id` (`disableLogSending`) | NodeSDK + auto-instrumentations (http, express, nestjs-core, undici/fetch, pg, amqplib; fs/dns/net/router off, express middleware layers ignored) | `OTEL_METRICS_EXPORTER=none` until lab 3 |
| `lab-3-solution` | — | + manual spans where needed | spanmetrics from Collector |
| `lab-4-solution` | + `correlation_id` field | + business attributes, Baggage + `BaggageSpanProcessor`, span links in notifier, `code.*` attributes | — |

The SDK bootstrap lives in one file per service (`src/instrumentation.ts`) loaded with
`node --import ./dist/instrumentation.js` (services compile to CommonJS, so the
require hooks are enough — ADR-0005). Participants should see that zero-code gets them 80 % of the way.

## Messaging

Topic exchange `ticketing`, routed by event name. Envelope:
`{ eventId, eventName, occurredOn, data }` (+ `correlationId`, `causationId`, `headers`
from `lab-4-solution`).

| Queue | Bound to | Consumer |
|---|---|---|
| `notifier.order-paid` | `order.paid` | notifier |
| `notifier.order-paid.retry` | — (TTL 10 s, dead-letters back to `notifier.order-paid`) | — |
| `inventory.payment-failed` | `payment.failed` | inventory |

`order.paid` goes through orders' transactional outbox (`outbox` table, relay every
500 ms); `payment.failed` is published directly by payments (ADR-0011).

## Grafana provisioning (shipped ready, not a lab task)

- Datasources: Tempo ↔ Loki (traces-to-logs by `trace_id`, logs-to-traces derived
  field), Prometheus with exemplars → Tempo, service graph, Postgres (business data).
- Tempo's metrics generator is **off** (`observability/lgtm/tempo-config.yaml`): span
  metrics and the service graph come only from the Collector's connectors (ADR-0009).
- Dashboard **"Checkout"**: checkouts/s and error rate, p50/p95/p99 with exemplars,
  latency heatmap, RED per service (all from spanmetrics), orders by status (Postgres,
  works from lab 1), error logs panel.
  Panels that depend on telemetry not yet added must show "No data" gracefully —
  that emptiness is part of the story.

## Fault injection

- **Code defects**: plain code in the services (D1, D4, D5, D6, D7, D8).
- **Config defects**: env vars with bad defaults (D3 timeouts/retries).
- **Infra faults**: Toxiproxy toxics (D2 `reset_peer` on `psp`; WAN latency on
  `catalog`, every lab), fake-psp latency profile (D10), fake-psp per-transaction limit
  (what turns D7 into a `422`).
- **Scenario profiles**: `scenarios/lab-N.env` + `scenarios/lab-N.toxics.json`,
  applied by `make lab N=…`. Incident 5 is applied by `make incident-5`.
