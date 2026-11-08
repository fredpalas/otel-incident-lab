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
  one span (`payments → fake-psp`) takes all the time. From lab 3 on (lab 2's fix in
  place) payments cuts those calls at 700 ms, so the top band of the checkout heatmap
  sits at ~0.8–1 s with errors, while the PSP's own span in the same trace runs 1.5–3 s.
  TraceQL `{ resource.service.name = "fake-psp" && duration > 1s }`.
- **Fix**: none in our code. Lesson: averages lie; prove it's the dependency;
  decide timeout / SLO / fallback. Discussion, not code.
- **Verify-3 (part)**: the conclusion itself is not checked automatically (it's
  infra). Verify only checks that fresh spanmetrics histograms with exemplars, and the
  service graph, exist in Prometheus (i.e. the Collector step was done). Tempo's own
  metrics generator is off, so only the Collector can produce them (ADR-0009).

## D4 — N+1 queries · Lab 3 · code

- **Where**: `inventory`'s `ReservationService` locks the candidate seat ids, then
  loads and saves each `Seat` aggregate in a loop (`SELECT … WHERE id = $1` and
  `UPDATE … WHERE id = $1`, ×N): 1 + 2N queries. The N+1 a clean repository produces.
- **Symptom**: checkout latency grows with ticket count.
- **Signal**: "comb" pattern — dozens of tiny `pg.query` spans under one parent;
  `db.query.text` shows the repeated query.
- **Fix**: single query with `= ANY($1)` / `IN`, or a `JOIN`.
- **Verify-3 (part)**: for a checkout of 6 tickets (the largest that isn't a group
  booking, see D7), `inventory` emits ≤ 3 query spans, BEGIN/COMMIT/ROLLBACK not
  counted (13 at `lab-3-start`, 2 after the fix).

## D5 — Sequential awaits · Lab 3 · code

- **Where**: `orders` calls `inventory`, `catalog/pricing`, `catalog/customers`
  sequentially although they are independent.
- **Symptom**: ~100 ms of avoidable latency on every checkout (catalog sits behind
  ~80 ms of WAN latency, a Toxiproxy toxic — ADR-0010): ~190 ms → ~90 ms.
- **Signal**: "staircase" — non-overlapping sibling spans. Compare before/after
  traces in two tabs.
- **Fix**: `Promise.all` (with proper error handling).
- **Verify-3 (part)**: in 5 sequential traced checkouts, the three client spans of
  `orders` overlap: their envelope is < 0.8 × the sum of their durations (Tempo rounds
  starts to the millisecond, so a plain start/end comparison is unreliable).

## D6 — No connection pool · Lab 3 · code

- **Where**: `inventory` does `new Client()` + `connect()` + `end()` per request.
  Postgres `max_connections=20` in compose.
- **Symptom**: +5–10 ms per request; under load spikes, `sorry, too many clients
  already` errors (`make spike`: ~70 % of checkouts fail at `lab-3-start`, ~2 % after
  the fix — the PSP tail).
- **Signal**: a `pg.connect` span in **every** trace; Loki errors linked to traces
  during k6 spikes.
- **Fix**: module-level `Pool` with sane `max`.
- **Stretch (optional)**: set `max: 2` → pool exhaustion shows as a **gap** between
  parent start and the DB span; fix by adding a manual `pool.acquire` span.
- **Verify-3 (part)**: right after a burst of 40 concurrent checkouts, ≤ 1 of 5
  traced checkouts has an inventory `pg.connect` span; zero "too many clients" errors
  from inventory in Loki during the burst.

## D7 — Fails only for a business segment · Lab 4 · code

- **Where**: `catalog`'s `Price.unitPriceFor` uses `forGroup(tickets)` for 7+
  tickets, which returns the discounted **total** of the group, and publishes it as
  `unitPriceCents`; `orders` multiplies it by the tickets again. The PSP rejects the
  amount (`422 amount exceeds the per-transaction limit`, 100 000 cents). Planted since
  `lab-1-start` (with D1 at lab 1, those orders silently stay PENDING).
- **Symptom**: ~3 % error rate (baseline: 3 % of checkouts have 7–10 tickets), no
  visible pattern by service/endpoint.
- **Signal**: only after adding business attributes: TraceQL
  `{ status = error && span.order.tickets > 6 }`.
- **Fix**: correct the group discount calculation.
- **Verify-4 (part)**: zero errors for checkouts with 7–10 tickets.

## D8 — Lost context across the queue · Lab 4 · code

- **Where**: `orders` writes `order.paid` to an **outbox** table in the same
  transaction as the order; `OutboxRelay` publishes it on a 500 ms timer. The relay runs
  outside the request, so the zero-code amqplib instrumentation propagates the relay's
  context, not the checkout's: notifier's traces hang off a `publish ticketing` root
  (ADR-0011). Planted since `lab-1-start`. Notifier sends via Mailpit behind Toxiproxy
  (SMTP resets: 10 %, 30 % in the lab 4 scenario) and retries from a TTL queue, 3
  attempts at most; then the order stays `PAID` without email (ADR-0012).
- **Contrast**: `payment.failed` (payments → inventory, published directly in the
  request) already shows up inside the checkout trace.
- **Symptom**: support: "order `<id>` paid but no email". No way to follow one order
  from the checkout to the notifier attempts.
- **Signal**: notifier traces rooted at the relay. After fix: span link notifier →
  checkout; `correlation_id` returns **several traces** for one order (checkout + one
  per delivery attempt). The ticket gives an **order id**: Loki `order_id` → its
  `correlation_id` (created by the gateway before the order exists) → everything.
- **Fix (two layers)**:
  1. Technical continuity: capture `traceparent` when the event is recorded (in the
     request) into the envelope's `headers`; notifier extracts it and starts its span
     with a **link** (not a parent: it happens later, after retries).
  2. Business continuity: `correlation_id` (+ `causation_id`) in event envelope;
     `correlation_id` created at gateway, propagated via **Baggage**, copied to
     spans by `BaggageSpanProcessor`, added to every log line.
  3. Security: strip Baggage on egress to `fake-psp` (third party).
- **Verify-4 (part)**: for one traced checkout (resets off): the server spans of
  gateway, orders, inventory, catalog and payments carry the gateway's `correlation_id`;
  **no fake-psp span carries it** (fake-psp records any received Baggage as attributes;
  the check fails while there is no correlation_id, so it can't pass vacuously); TraceQL
  by `correlation_id` finds a notifier span with a **link** to the checkout trace, and
  notifier logs carry it; an orders span has `order.id` (= response), `order.tickets`,
  `customer.tier`, `code.function.name`, `code.file.path`. D7: ≥ 4/5 checkouts of 7–10
  tickets succeed.

## D9 — PII in telemetry · Lab 5 / wrap-up · config

- **Where**: fake-psp (pre-instrumented, "third-party code") sets
  `customer.email` and `card.last4` attributes on its spans.
- **Signal**: visible in any PSP span in Tempo.
- **Fix**: Collector `redaction/pii` processor in the traces pipeline:
  `blocked_values` (email regex, any attribute) + `blocked_key_patterns` (`card\..*`).
  Alternatives: `attributes` delete/hash, `transform`.
- **Verify-5 (part)**: in a traced checkout, no fake-psp span attribute holds an email
  address, and no `card.*` attribute holds digits.

## incident-5 — Unknown regression for the agent · Lab 5 · code

- **Spoiler — keep out of participant docs.** Applied by `make incident-5`
  (a patch under `scenarios/incident-5/`).
- **What it does**: commits a "refactor" of orders' `LoyaltyTier` (discounts moved to a
  `Record<string, { rate }>` table) that forgets `gold`: `TypeError: Cannot read
  properties of undefined (reading 'rate')` in `LoyaltyTier.discountPercent` for every
  gold customer (`cus_N`, N % 10 = 0) → orders 500 → gateway 502. No order is created,
  so the support message gives a customer id and the **error reference**
  (`X-Correlation-Id`, from lab 4), not an order id. `make incident-5` builds a
  "legacy" copy in `../ticketing-platform` (code + regression, one import commit, no
  tags/history, spoiler files removed) and runs the stack from it: the agent can't diff
  its way to the cause. `BASE=main` gives the no-telemetry contrast.
- Discoverable via: reference = `correlation_id` → Loki: gateway error log with
  `trace_id` → Tempo: orders span `CheckoutService.placeOrder` in ERROR, exception +
  stack, `customer.tier=gold`, `code.function.name` / `code.file.path` → the file.
  orders logs nothing itself for this error: the trace carries the evidence.
- Hidden from agents in **every** lab (Claude Code hook + opencode.json): the patch,
  this catalog, `labs/05-ai-mcp/INSTRUCTOR.md` and `SOLUTION.md`.
- **Verify-5 (part)**: ≥ 4/5 checkouts of gold customers succeed (fails while the
  incident is live; CI checks that `make incident-5` breaks it on `lab-5-solution`).

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
