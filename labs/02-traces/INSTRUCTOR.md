# Lab 2 — Instructor notes

**Defects**: D2 origin (Toxiproxy `reset_peer` on payments → PSP, 5 %), D3 (PSP timeout
300 ms × 3 retries on timeouts, no backoff, no idempotency key, budget 1.2 s > orders'
1 s), D10 active (fake-psp `longtail` profile).

## Timing (45')

| Min | What |
|---|---|
| 0–3 | Ticket. Recap the lab 1 cliffhanger: three services, same error. |
| 3–18 | Instrumentation: `instrumentation.ts` in `orders` → `--import` in the Dockerfile → `traces` pipeline in the Collector → see a trace. Copy to `payments` and `gateway` (the other three are optional). Show Hint 1 on the projector at minute 12 if the room is stuck. |
| 18–26 | Log → trace jump; deepest error span = payments → PSP, `ECONNRESET`. "Not our code" (infra). Dedupe the error logs. |
| 26–40 | Slow-checkout trace: sibling `POST` spans, PSP span longer than the client span. Timeout budget + retries + Idempotency-Key. |
| 40–45 | `make verify N=2`. Teaser: the service graph comes with the span metrics of lab 3. |

## What to show on the projector

1. A failed checkout trace: error on every hop; the deepest error span carries
   `error.type`/`ECONNRESET`. Ask "which service do we blame?".
2. A slow trace before the fix: 3–4 `POST` siblings of 300 ms each from `payments`, and a
   `fake-psp` span that lasts 500 ms+ — the PSP kept working (and charging) after we left.
3. Point out the `orders` span ending at ~1 s with an error while `payments` spans keep
   going: the order is `FAILED`, the customer is charged.

## Expected fix (see SOLUTION.md)

- PSP timeout 700 ms (above the 8 % band; only the 2 % tail times out), **1** retry, with
  jittered backoff, **only on connection errors** (reset/refused) — never on timeouts.
- `Idempotency-Key: <orderId>` on every charge.
- Budget: payments ≤ ~1.55 s < orders → payments 1.8 s < gateway → orders 2.5 s.
- Only payments logs the full error; orders and gateway log one short line.

## Common blockers

| Symptom | Cause / fix |
|---|---|
| No traces, Collector logs nothing | `traces` pipeline missing, or the service still runs `node dist/main.js` (no `--import`). |
| Traces only for gateway, separate traces for orders | `orders`/`payments` not instrumented: the `traceparent` header is injected by the undici (fetch) instrumentation of the caller and read by the http instrumentation of the callee — both sides need the SDK. |
| Every log line appears twice in Loki | pino instrumentation sending logs through the SDK *and* the transport. `disableLogSending: true` for `@opentelemetry/instrumentation-pino`. |
| OTLP 404 errors in service logs | SDK exporting metrics to a Collector with no metrics pipeline. `OTEL_METRICS_EXPORTER=none` (already in the solution's compose). |
| "Retry storm" check still fails | They lowered retries but still retry on timeouts. A timed-out charge may have succeeded at the PSP. |
| Idempotency check fails | Header name typo, or key regenerated per attempt — it must be stable per order. |

## If the group is behind

This is the heaviest lab for its slot (see `labs/INSTRUCTOR.md`, timing reality): six
services × (`instrumentation.ts` + Dockerfile `CMD`), the Collector, two log changes
and three D3 changes. Measured machine time: `make up` 5–15 s per service, ~40 s when
several services rebuild at once (2–3 min on a laptop).

- verify-2 only needs **gateway, orders and payments** traced: tell the room the other
  three are optional.
- Minute 15 without a trace in Tempo: Hint 1 + Hint 2 on the projector.
- Minute 30: those who haven't started D3, `make solution N=2` and read SOLUTION
  section 3 together — the double-charge discussion matters more than typing it.

## Discussion prompts

- Retries are a load multiplier. Who pays for them? (The PSP, and your customers.)
- "Inner timeout < outer timeout" is necessary but not enough: the inner **total** (with
  retries and backoff) must fit in the outer one.
- The 2 % long tail still fails after the fix — and the PSP may still charge those.
  What would you do? (Reconciliation, async confirmation, an SLO.) → lab 3.
