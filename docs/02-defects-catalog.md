# 02 — Defects catalog

Each defect is revealed best by **one** signal — that's what drives the lab order.
Every defect has an automated `verify` check (FAIL at `lab-N-start`, PASS at
`lab-N-solution`).

Legend — **Kind**: `code` (fix in code), `config` (fix a parameter), `infra`
(not our code: prove it, then mitigate).

---

## D1 — Swallowed exception · Lab 1 · code

- **Where**: `orders`, `CheckoutService.placeOrder`. The call to `payments` is wrapped
  in `try { … } catch {}` with a comment blaming a "payment reconciliation" job that
  doesn't exist.
- **Symptom**: `POST /checkout` returns `201`. Order stays `PENDING` forever.
  Customer never gets tickets. No error anywhere.
- **Signal**: none — that is the lesson. After adding structured logs: Loki
  `{service_name="orders"} | severity_text=~"(?i)error"` (OTLP logs carry the level as
  `severity_text` structured metadata, not in a JSON body).
- **Fix**: propagate the error, mark order `FAILED`, return `502`, log with context
  (`order_id`, error).
- **Verify-1**: with PSP connections reset at 100 % for its own run (ADR-0007), 5
  checkouts tagged `customer_id = verify-<run>-fail`: none stays `PENDING`, none gets a
  2xx, and Loki has an error line from `orders` whose `order_id` (or `orderId`) is one
  of them. Plus a happy-path check (3 checkouts, PSP healthy → 201 + `PAID`).
- **Lab-1 note**: D2's toxic only bites per request because fake-psp answers with
  `Connection: close`; with keep-alive the 5 % collapses to ~0 %.

## D2 — Generic error re-logged by every hop · Lab 1 → 2 · infra + code

- **Injection**: Toxiproxy `reset_peer` toxic on `payments → fake-psp`, toxicity ~5 %.
- **Symptom (after lab 1)**: gateway, orders and payments all log a similar
  `upstream error 502` / `socket hang up`. Which service is the origin? Unknown.
- **Signal**: Tempo — the **deepest span with status ERROR** is the origin
  (`payments → fake-psp`, `error.type=ECONNRESET`). Jump log → trace via `trace_id`.
- **Fix**: no code fix for the reset itself (infra). Code fix: only the originating
  service logs the full error; upstream hops log a short line referencing it
  (avoid N× duplicated stack traces). Mitigation with retries is D3.
- **Verify-2 (part)**: with PSP connections reset at 100 % for 3 checkouts sent with
  verify's own `traceparent` (ADR-0008): the deepest error span of each trace is a
  `payments` client span; each of gateway/orders/payments has an error log line carrying
  one of those `trace_id`s; only `payments` lines carry `err_stack`.

## D3 — Retries without idempotency / timeout budget mismatch · Lab 2 · config + code

- **Where**: config in `docker-compose.yml` — `payments` `PSP_TIMEOUT_MS=300`,
  `PSP_RETRIES=3`; `orders` → `payments` `PAYMENTS_TIMEOUT_MS=1000`; gateway → orders
  `ORDERS_TIMEOUT_MS=2000`. Code in `payments` `HttpPaymentProvider`: retries
  **timeouts** (not connection errors), no backoff, no `Idempotency-Key`.
- **Why it hurts** (with D10 active): ~10 % of PSP calls exceed 300 ms. The PSP keeps
  processing after the client gives up (`ignore_user_abort`), so every timed-out attempt
  is a real charge and each retry charges again → **double charges**. payments' budget
  (4 × 300 ms) exceeds orders' 1 s → orders marks the order `FAILED` while payments keeps
  retrying and charging → **charged but failed**. D2 resets are not retried at all.
  (Independent per-request latency only gives ~1.1× PSP calls per checkout in normal
  traffic, so the original "3–4× load / gateway 504" framing didn't hold.)
- **Symptom**: support — "charged twice", "charged although the site said it failed",
  "sometimes checkout just fails".
- **Signal**: slow checkout trace with **repeated sibling client spans** payments → PSP,
  PSP server spans outliving the client spans, the orders span ending at 1 s with an error
  while payments spans continue.
- **Fix**: PSP timeout 700 ms (above the 8 % band), 1 retry with jittered backoff
  (50–150 ms) **only on connection errors**, `Idempotency-Key: <orderId>` (fake-psp
  replays), budget gateway 2.5 s > orders→payments 1.8 s > payments worst case ~1.55 s.
- **Verify-2 (part)**: with a Toxiproxy `latency` toxic (+300 ms, PSP ≈ 350–400 ms) and 5
  traced checkouts: ≥ 2 return 201; ≤ 2 payments → PSP client spans per trace; every
  fake-psp span carries `psp.idempotency_key`. Deterministic at `lab-2-start` (every
  attempt > 300 ms → 4 calls, 0 successes, 20 keyless charges for 5 orders).

## D10 — Random long-tail latency in a dependency · Lab 3 · infra

- **Injection**: fake-psp `PSP_LATENCY_PROFILE=longtail`: 90 % 50–100 ms,
  8 % 300–600 ms, 2 % 1.5–3 s. Active from lab 2 onwards (lab 2's timeouts must be
  set with it in mind).
- **Symptom**: average and p50 look fine; p99 is terrible; users complain "sometimes".
- **Signal**: latency **heatmap is bimodal**; click a p99 **exemplar** → trace where
  one span (`payments → fake-psp`) takes all the time. TraceQL
  `{ resource.service.name = "payments" && duration > 1s }`.
- **Fix**: none in our code. Lesson: averages lie; prove it's the dependency;
  decide timeout / SLO / fallback. Discussion, not code.
- **Verify-3 (part)**: the conclusion itself is not checked automatically (it's
  infra). Verify only checks that spanmetrics histograms with exemplars exist in
  Prometheus (i.e. the Collector config step was done).

## D4 — N+1 queries · Lab 3 · code

- **Where**: `inventory` loads seats one by one in a loop (`SELECT … WHERE id = $1`
  ×N) to check availability.
- **Symptom**: checkout latency grows with ticket count.
- **Signal**: "comb" pattern — dozens of tiny `pg.query` spans under one parent;
  `db.query.text` shows the repeated query.
- **Fix**: single query with `= ANY($1)` / `IN`, or a `JOIN`.
- **Verify-3 (part)**: for a checkout of 10 tickets, `inventory` emits ≤ 3 DB spans.

## D5 — Sequential awaits · Lab 3 · code

- **Where**: `orders` calls `inventory`, `catalog/pricing`, `catalog/customers`
  sequentially although they are independent.
- **Symptom**: ~250 ms of avoidable latency on every checkout.
- **Signal**: "staircase" — non-overlapping sibling spans. Compare before/after
  traces in two tabs.
- **Fix**: `Promise.all` (with proper error handling).
- **Verify-3 (part)**: in a checkout trace, the three sibling spans overlap in time.

## D6 — No connection pool · Lab 3 · code

- **Where**: `inventory` does `new Client()` + `connect()` + `end()` per request.
  Postgres `max_connections=20` in compose.
- **Symptom**: +20–40 ms per request; under load spikes, `sorry, too many clients
  already` errors.
- **Signal**: a `pg.connect` span in **every** trace; Loki errors linked to traces
  during k6 spikes.
- **Fix**: module-level `Pool` with sane `max`.
- **Stretch (optional)**: set `max: 2` → pool exhaustion shows as a **gap** between
  parent start and the DB span; fix by adding a manual `pool.acquire` span.
- **Verify-3 (part)**: < 5 % of inventory traces contain `pg.connect`; zero
  "too many clients" errors during spike script.

## D7 — Fails only for a business segment · Lab 4 · code

- **Where**: `catalog/pricing` (or orders' total calc) breaks for orders with
  **> 6 tickets** (group discount path) → PSP rejects amount (`422`).
- **Symptom**: ~3 % error rate, no visible pattern by service/endpoint.
- **Signal**: only after adding business attributes: TraceQL
  `{ status = error && span.order.tickets > 6 }`.
- **Fix**: correct the group discount calculation.
- **Verify-4 (part)**: zero errors for checkouts with 7–10 tickets.

## D8 — Lost context across the queue · Lab 4 · code

- **Where**: `orders` publishes `order.paid` without trace headers; `notifier`
  consumes without extracting context. Notifier also retries failed "emails" later.
- **Symptom**: support: "order `ord_123` paid but no email". Notifier traces are
  orphans; no way to follow one order.
- **Signal**: orphan root spans in `notifier`. After fix: span link producer ↔
  consumer; `correlation_id` returns **several traces** for one order.
- **Fix (two layers)**:
  1. Technical continuity: `traceparent` in message headers + span link.
  2. Business continuity: `correlation_id` (+ `causation_id`) in event envelope;
     `correlation_id` created at gateway, propagated via **Baggage**, copied to
     spans by `BaggageSpanProcessor`, added to every log line.
  3. Security: strip Baggage on egress to `fake-psp` (third party).
- **Verify-4 (part)**: notifier spans have links to orders spans; all spans of a test
  order carry `correlation_id`; **no fake-psp span carries `correlation_id`**
  (fake-psp records any received Baggage as attributes, so a leak is detectable).

## D9 — PII in telemetry · Lab 5 / wrap-up · config

- **Where**: fake-psp (pre-instrumented, "third-party code") sets
  `customer.email` and `card.last4` attributes on its spans.
- **Signal**: visible in any PSP span in Tempo.
- **Fix**: Collector `redaction` (or `attributes` delete/hash) processor.
- **Verify-5 (part)**: no span in Tempo has `customer.email` in clear text.

## incident-5 — Unknown regression for the agent · Lab 5 · code

- **Spoiler — keep out of participant docs.** Applied by `make incident-5`
  (a patch under `scenarios/incident-5/`).
- Proposal: `catalog` pricing throws `TypeError: Cannot read properties of undefined
  (reading 'rate')` only for `customer.tier = "gold"` (discount table missing an
  entry after a "refactor").
- Discoverable via: support message with an order id → `correlation_id` → error trace
  → log with stack → `code.function.name` / `code.file.path` → patch.
- **Verify-5 (part)**: zero errors for gold-tier checkouts.

---

## Matrix

| Defect | Lab | Kind | Best signal |
|---|---|---|---|
| D1 | 1 | code | (absence) → logs |
| D2 | 1→2 | infra+code | traces (deepest error span) + log↔trace |
| D3 | 2 | config | trace waterfall + service graph |
| D10 | 3 | infra | heatmap + exemplars |
| D4 | 3 | code | comb pattern |
| D5 | 3 | code | staircase pattern |
| D6 | 3 | code | `pg.connect` per trace + errors under load |
| D7 | 4 | code | business attributes + TraceQL |
| D8 | 4 | code | span links + correlation_id across traces |
| D9 | 5 | config | span attributes → Collector redaction |
| incident-5 | 5 | code | agent via MCP |
