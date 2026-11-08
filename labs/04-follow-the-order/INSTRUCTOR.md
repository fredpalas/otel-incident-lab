# Lab 4 — Instructor notes

**Defects**: D7 (catalog returns the group *total* as the unit price for 7+ tickets;
the PSP rejects the amount over its 1 000 € per-transaction limit: ~3 % of checkouts),
D8 (order.paid goes through an outbox and a timer-driven relay, so notifier's traces
hang off the relay, not the checkout). Scenario: SMTP resets at 30 %, so ~2.7 % of paid
orders exhaust their 3 email attempts and stay `PAID` (ticket #4805).

## Timing (45')

| Min | What |
|---|---|
| 0–8 | Business attributes + manual span with `code.*` in `CheckoutService`. TraceQL `{ status = error && span.order.tickets > 6 }` → catalog `Price.unitPriceFor` / `forGroup`. Fix. |
| 8–22 | `correlation_id` in gateway → Baggage. `BaggageSpanProcessor` + logger mixin in every service (Hint 2 on the projector at minute 14). Show a fake-psp span with `correlation_id` on it: "we just sent our internal ids to a third party". Strip it in payments. |
| 22–36 | Notifier trace rooted at `publish ticketing`. Why? The outbox relay. Envelope gets `correlationId`, `causationId`, `headers`; notifier extracts and links. |
| 36–45 | Follow #4805 from the order id. `make verify N=4`. |

## What to show on the projector

1. Before step 1: the error-rate panel at ~3 %, and the RED table with errors in
   gateway, orders and payments alike — no pattern by service.
2. The TraceQL query returning only orders with 7+ tickets.
3. A fake-psp span after step 2, before the strip: `correlation_id` in its attributes.
4. Loki `| correlation_id="…"` for an order with two failed emails: the checkout, three
   notifier attempts, the give-up. Tempo: the checkout trace + one trace per attempt,
   each linked back.
5. Contrast: `payment.failed` (published directly by payments) shows inventory releasing
   seats *inside* the checkout trace — zero-code amqplib instrumentation did that. The
   outbox breaks it because the relay publishes later, outside the request.

## Expected fix (see SOLUTION.md)

- catalog: `Price.forGroup()` (called by `unitPriceFor`) returns the discounted **unit** price (plus the missing test).
- orders: manual span `CheckoutService.placeOrder` with `order.*`, `customer.tier`,
  `code.*`; the outbox envelope carries `correlationId`, `causationId`, `headers`.
- gateway: middleware creating `correlation_id` in Baggage (and `X-Correlation-Id`).
- every service: `BaggageSpanProcessor` + batch exporter in `instrumentation.ts`; pino
  `mixin` with `correlation_id`.
- payments: `deleteBaggage` around the PSP call.
- notifier: extract, link, Baggage back; manual `Mailer.send` span with `code.*`.

## Common blockers

| Symptom | Cause / fix |
|---|---|
| No traces at all after editing `instrumentation.ts` | `spanProcessors` replaces the default exporter: the `BatchSpanProcessor` with an OTLP exporter must be in the list too. |
| `correlation_id` only on gateway spans | The other services don't have the `BaggageSpanProcessor` (Baggage travels, but nobody copies it onto spans). |
| `correlation_id` on spans but not in logs | Logger mixin missing, or it reads the Baggage outside the request context. |
| Gateway middleware sets Baggage but nothing propagates | `next()` called outside `context.with(...)`. |
| Notifier spans have the correlation but no link | They put `correlationId` in the envelope but not the trace context (`headers`). |
| The link points to the relay's trace | They injected the context in the relay (outside the request) instead of when the event is recorded. |

## If the group is behind

The largest change of the workshop (~26 files): business attributes + D7, a
correlation_id through six services (processor + logger mixin each), the Baggage strip,
the envelope and the span link. Measured machine time: ~40 s for the multi-service
rebuild (2–3 min on a laptop), `make verify N=4` ~35 s (Tempo only finds the notifier
trace by search once it goes quiet).

- Minute 8: D7 must be done by now — it's the quick win.
- Minute 18: put Hint 2 on the projector; the processor + mixin are copy-paste across
  services.
- Minute 32: envelope + link as an instructor live-code; participants
  `make solution N=4` and follow #4805 (step 4) — the search is the payoff.

## Discussion prompts

- correlation_id vs trace id: one business conversation vs one technical request. Which
  survives sampling, retries, batch jobs, a human support agent?
- What else is in your Baggage today, and who receives it?
- Links vs parent/child: when is an async step "part of" a request, and when only
  "caused by" it?
- The real flow for a failed payment: tell the customer, let them retry, hold the seats
  for 15 minutes. Here inventory releases them at once on `payment.failed`.
