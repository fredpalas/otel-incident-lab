# Lab 2 — Solution

`git diff lab-2-start lab-2-solution` shows the whole change: tracing in all six services,
a `traces` pipeline in the Collector, a coherent timeout budget, a safe retry policy with
an idempotency key, and one stack trace per failure instead of three.

## 1. Tracing (every service)

`src/instrumentation.ts`, loaded before the app:

```ts
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { ExpressLayerType } from '@opentelemetry/instrumentation-express';
import { NodeSDK } from '@opentelemetry/sdk-node';

const sdk = new NodeSDK({
  instrumentations: [
    getNodeAutoInstrumentations({
      // low-level noise that buries the spans that matter
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
      '@opentelemetry/instrumentation-net': { enabled: false },
      '@opentelemetry/instrumentation-router': { enabled: false },
      // no trace for every healthcheck
      '@opentelemetry/instrumentation-http': { ignoreIncomingRequestHook: (req) => req.url === '/health' },
      '@opentelemetry/instrumentation-express': { ignoreLayersType: [ExpressLayerType.MIDDLEWARE] },
      // no trace per poll of the outbox relay (orders)
      '@opentelemetry/instrumentation-pg': { requireParentSpan: true },
      // only inject trace_id/span_id: the pino transport already ships the logs
      '@opentelemetry/instrumentation-pino': { disableLogSending: true },
    }),
  ],
});
sdk.start();
process.on('SIGTERM', () => void sdk.shutdown());
```

`Dockerfile`: `CMD ["node", "--import", "./dist/instrumentation.js", "dist/main.js"]`.
`--import` runs the file before the app, so the instrumentations patch `http`, `express`,
`@nestjs/core`, `pg`, `fetch` (undici) and `pino` the first time they are loaded. That is
zero-code instrumentation: no business code changed to get these traces.

`docker-compose.yml` sets `OTEL_METRICS_EXPORTER=none` and `OTEL_LOGS_EXPORTER=none`:
by default the SDK also exports metrics and logs, and the Collector has no metrics
pipeline yet (logs already travel through the pino transport).

Collector — a second pipeline:

```yaml
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp_grpc/lgtm]
```

**Context propagation** happens on its own: the undici instrumentation adds a
`traceparent` header to every outgoing `fetch`, the http instrumentation of the next
service reads it. One checkout = one trace across gateway → orders → payments → PSP.
(The PSP is instrumented by its vendor; it reads the same W3C header.)

## 2. D2 — where the failure starts

In a failed checkout trace, every hop has an error. The **deepest error span** is the
origin: `payments` → `POST http://toxiproxy:8666/charges`, `ECONNRESET`. Something on the
network resets the connection to the PSP. Not our code — but our code must cope with it
(retry safely, see below).

The `trace_id` on every log line (pino instrumentation) turns each error log into a link
to its trace in Grafana.

**Logging fix**: `payments` keeps the full error (`err`, with stack). `orders` and
`gateway` log one short line (`upstream`, `cause`/`upstream_status`, `order_id`): the
trace already links them to the origin. One stack trace per failure instead of three.

## 3. D3 — charged twice

Read a slow checkout's trace at `lab-2-start`: three or four sibling `POST` spans from
`payments` to the PSP, 300 ms each, and PSP spans that last longer — the PSP kept
processing (and charging) after `payments` gave up. Three problems:

| Problem | At lab-2-start | Fix |
|---|---|---|
| Timeout below the PSP's real latency | 300 ms; the PSP takes 300–600 ms for 8 % of calls | **700 ms** — above the 8 % band; only the 2 % tail (1.5–3 s) times out |
| Retrying the unsafe case | retries **timeouts** (the charge may have gone through), not resets | retry **only connection errors** (`ECONNRESET`, `ECONNREFUSED`, socket closed), **once**, after a **jittered backoff** (50–150 ms) |
| No idempotency | every retry is a new charge | `Idempotency-Key: <orderId>` — a repeat becomes a replay of the first charge |
| Inner budget > outer timeout | payments up to 4 × 300 ms = 1.2 s; orders waits 1 s, gateway 2 s | payments ≤ 700 + 150 + 700 ≈ 1.55 s < orders → payments **1.8 s**; orders' whole checkout (≈ 250 ms of inventory and catalog calls + 1.8 s) < gateway → orders **2.5 s** |

Timeouts and retries live in `docker-compose.yml` (config), the retry policy and the
header in `HttpPaymentProvider` (code).

**What's left**: the 2 % tail still times out. The PSP may still charge those, with the
order marked `FAILED`. Retrying a timeout *with* the idempotency key would be safe now,
but the caller's deadline is the limit. The real answers are product decisions —
reconciliation against the PSP, asynchronous confirmation, an SLO. That's lab 3.
