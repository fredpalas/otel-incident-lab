# Lab 4 — Follow the order (45')

```sh
make lab N=4      # checkout lab-4-start, apply scenario, restart affected services
make verify N=4   # tells you if you're done
```

## 🎫 Two tickets

> **#4802** — "Error rate is ~3 % since the pricing release. Nothing stands out: not one
> service, not one endpoint, not one time of day."

> **#4805** — "Order `<id>` was paid, the customer was charged, but they never got
> their tickets by email. They're asking for a refund."

Find your own `<id>` for #4805: `make repro N=4` (or `make load`), wait a minute, then in
Grafana → Explore → **Postgres**:

```sql
SELECT id, created_at FROM orders
WHERE status = 'PAID' AND updated_at < now() - interval '1 minute'
ORDER BY created_at DESC LIMIT 5;
```

Traces answer "where in *this request*". These tickets ask "what happened to *this
order*", and the answer spans several requests, a queue and a retry.

## Goal

1. Find the segment that fails (#4802) and fix it.
2. Be able to follow one order end to end — logs and traces, across the queue — from
   nothing but its id (#4805).
3. Don't leak your internal ids to third parties.

You're done when `make verify N=4` is all ✅.

## Steps

1. **Business attributes.** In `orders`, put what the business talks about on the
   checkout's span: `order.id`, `order.tickets`, `customer.tier`. While you're there,
   make that a manual span with `code.function.name` and `code.file.path` (lab 5's
   agent will need them to go from a trace to the code). Then ask Tempo:
   `{ status = error && span.order.tickets > 6 }`. Fix what you find.
2. **One id for the whole story.** In `gateway`, create a `correlation_id` per request
   and put it in the OpenTelemetry **Baggage**: it travels with every outgoing call
   (W3C `baggage` header). In every service:
   - a `BaggageSpanProcessor` copies Baggage entries onto every span;
   - the logger adds `correlation_id` to every line (pino `mixin`).
   Look at a `fake-psp` span now: what did the PSP receive? Fix that too.
3. **Across the queue.** `order.paid` reaches `notifier` through an **outbox** (a table
   written in the same transaction as the order) and RabbitMQ. Look at a notifier
   trace: where does it start? Why isn't it part of the checkout's trace?
   - `orders`: when the event is recorded, put `correlationId`, `causationId` and the
     trace context (`traceparent`) in the event envelope.
   - `notifier`: take them out again; start its span with a **link** to the checkout's
     span, and put the `correlation_id` back in the Baggage.
4. **Follow #4805.** From the order id: Loki `{service_name=~".+"} | order_id="<id>"`
   → its `correlation_id` → Loki `| correlation_id="<id>"` (the whole story, retries
   included) and Tempo `{ span.correlation_id = "<id>" }` (one checkout, several
   traces). Why did the customer get no email? Check the inbox at
   http://localhost:8025.

## What you should see in Grafana

- Before step 1: errors spread over services, endpoints and time — no pattern.
- After step 2: every span and log line of a checkout has the same `correlation_id`.
- Before step 3: notifier traces start at `publish ticketing` (the outbox relay in
  `orders`), not at a checkout. After: a span link back to the checkout.
- By contrast: `payment.failed` (payments → inventory, published directly) already shows
  up *inside* the checkout's trace. What's the difference?

## Hints

<details>
<summary>Hint 1 — Attributes on the active span</summary>

```ts
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('orders');
return tracer.startActiveSpan('CheckoutService.placeOrder', async (span) => {
  span.setAttributes({
    'code.function.name': 'CheckoutService.placeOrder',
    'code.file.path': __filename,
    'order.tickets': command.tickets,
  });
  try {
    // … span.setAttribute('order.id', …), span.setAttribute('customer.tier', …)
  } finally {
    span.end();
  }
});
```

</details>

<details>
<summary>Hint 2 — Baggage in, Baggage on spans and logs, Baggage out</summary>

```ts
// gateway: an Express/Nest middleware. The server span already started before it runs,
// so the processor won't see the Baggage for that one span: tag it yourself.
const correlationId = randomUUID();
trace.getActiveSpan()?.setAttribute('correlation_id', correlationId);
const baggage = propagation.createBaggage({ correlation_id: { value: correlationId } });
context.with(propagation.setBaggage(context.active(), baggage), next);

// instrumentation.ts (every service)
import { ALLOW_ALL_BAGGAGE_KEYS, BaggageSpanProcessor } from '@opentelemetry/baggage-span-processor';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace';
// spanProcessors: [new BaggageSpanProcessor(ALLOW_ALL_BAGGAGE_KEYS), new BatchSpanProcessor({ exporter: new OTLPTraceExporter() })]

// logger.ts: pino({ mixin: () => ({ correlation_id: propagation.getActiveBaggage()?.getEntry('correlation_id')?.value }) })

// payments, around the call to the PSP
context.with(propagation.deleteBaggage(context.active()), () => fetch(…));
```

</details>

<details>
<summary>Hint 3 — Context through the outbox</summary>

```ts
// orders, when the event is written to the outbox (still inside the request)
const headers: Record<string, string> = {};
propagation.inject(context.active(), headers);   // { traceparent, baggage }

// notifier, when the message is consumed
const parent = propagation.extract(ROOT_CONTEXT, envelope.headers);
tracer.startActiveSpan('process order.paid', { links: [{ context: trace.getSpanContext(parent)! }] }, …);
```

Why a link and not a parent? The email may be sent minutes later, after retries: it's
caused by the checkout, not part of it.

</details>

Stuck? `make solution N=4` jumps to the solution (your work is saved first).
