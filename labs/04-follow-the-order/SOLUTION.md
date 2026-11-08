# Lab 4 — Solution

`git diff lab-4-start lab-4-solution` shows the whole change: one line of pricing in
catalog, and the telemetry that lets you follow one order across requests and a queue.

## 1. Business attributes and `code.*` (orders)

```ts
// CheckoutService
placeOrder(command: PlaceOrderCommand): Promise<OrderDto> {
  return inSpan('CheckoutService.placeOrder', __filename, { 'order.tickets': command.tickets }, async (span) => {
    const order = await this.place(command, span);   // sets order.id and customer.tier
    return order.toDto();
  });
}
```

`inSpan` (`src/shared/infrastructure/tracing.ts`) starts an active span with
`code.function.name` and `code.file.path` (the source path in the repo), records the
exception and the error status, and ends it. Auto-instrumentation knows HTTP routes;
only your code knows that this request is "an order of 8 tickets for a gold customer".

## 2. D7 — group bookings

```
{ status = error && span.order.tickets > 6 }
```

Every failing checkout has 7+ tickets. In the trace: the PSP answers `422 amount exceeds
the per-transaction limit`, the amount is ~7× too high. `catalog` quoted the group
**total** as the unit price (`Price.unitPriceFor` → `forGroup(tickets)` returned
`unit × tickets − 10 %`), and orders multiplied it by the tickets again. Fix, in
`services/catalog/src/pricing/domain/Price.ts`:

```ts
unitPriceFor(tickets: TicketQuantity): Money {
  return tickets.value >= GROUP_SIZE ? this.forGroup() : this.amount;
}

/** Price of each ticket in a group booking: 10 % off. */
private forGroup(): Money {
  return this.amount.applyDiscount(GROUP_DISCOUNT);
}
```

…and the unit test for the group path that was missing (it's why the bug shipped).

## 3. `correlation_id` in Baggage

```ts
// gateway — src/shared/infrastructure/correlation.ts, app.use(correlation)
const correlationId = randomUUID();
res.setHeader('X-Correlation-Id', correlationId);       // support can ask the customer for it
trace.getActiveSpan()?.setAttribute('correlation_id', correlationId);  // span started before us
context.with(propagation.setBaggage(context.active(), propagation.createBaggage({ correlation_id: { value: correlationId } })), next);
```

Baggage travels in the W3C `baggage` header on every outgoing call (the SDK's default
propagators are `tracecontext,baggage`). In **every** service:

```ts
// instrumentation.ts
spanProcessors: [
  new BaggageSpanProcessor(ALLOW_ALL_BAGGAGE_KEYS),        // Baggage → span attributes
  new BatchSpanProcessor({ exporter: new OTLPTraceExporter() }), // listing processors replaces the default
],

// logger.ts
mixin: () => {
  const correlationId = propagation.getActiveBaggage()?.getEntry('correlation_id')?.value;
  return correlationId ? { correlation_id: correlationId } : {};
},
```

### Don't leak it

Look at a fake-psp span after adding Baggage: `correlation_id` is there. The PSP records
whatever Baggage it receives — so would any third party. Baggage is for your services:

```ts
// payments, HttpPaymentProvider
const withoutBaggage = propagation.deleteBaggage(context.active());
const response = await context.with(withoutBaggage, () => fetch(`${config.pspUrl}/charges`, …));
```

(Production alternative: drop the `baggage` header at the egress proxy.)

## 4. D8 — context lost in the outbox

`order.paid` is written to the `outbox` table in the same transaction as the order, and
a relay publishes it on a timer. That is the right pattern for not losing events, and
exactly where the context is lost: the relay runs **outside** the request, so the
zero-code amqplib instrumentation injects the relay's own (empty) context. Every
notifier trace started at `publish ticketing`.

By contrast, `payment.failed` is published by payments directly, inside the request:
amqplib's instrumentation propagates the context by itself and inventory's release shows
up inside the checkout's trace.

**Technical continuity** — capture the context when the event is recorded, carry it in
the envelope:

```ts
// orders — causedByCurrentRequest(), called while building the envelope in PgOrderRepository.save
const headers: Record<string, string> = {};
propagation.inject(context.active(), headers);                    // traceparent + baggage
const correlationId = propagation.getActiveBaggage()?.getEntry('correlation_id')?.value;
return { correlationId, causationId: correlationId, headers };
```

```ts
// notifier — OrderPaidConsumer
const checkout = trace.getSpanContext(propagation.extract(ROOT_CONTEXT, event.headers ?? {}));
const baggage = propagation.createBaggage({ correlation_id: { value: event.correlationId } });
await context.with(propagation.setBaggage(context.active(), baggage), () =>
  tracer.startActiveSpan('process order.paid', { links: [{ context: checkout }] }, …));
```

A **link**, not a parent: the email is *caused by* the checkout but happens later,
possibly after retries; making it a child would stretch the checkout's trace to minutes.

**Business continuity** — `correlationId` and `causationId` in the envelope:
- `correlationId`: the conversation (one checkout), the same on every event and log;
- `causationId`: what directly caused this message. For `order.paid`, the checkout
  request; for a notification retry, the `eventId` of the delivery that failed — so the
  chain checkout → attempt 1 → attempt 2 → attempt 3 can be rebuilt.

`SmtpMailer.send` gets a manual span (with `code.*`): SMTP has no auto-instrumentation,
and without it a failed send is invisible in the trace.

## 5. Following #4805

```logql
{service_name=~".+"} | order_id="<id>"                # → correlation_id
{service_name=~".+"} | correlation_id="<cid>"          # the whole story
```

The customer was charged, then notifier tried three times: `notification failed,
retrying later` ×2, `giving up` — the mail provider dropped the connection every time
(Toxiproxy resets 30 % of SMTP connections in this scenario). Tempo
`{ span.correlation_id = "<cid>" }`: the checkout trace plus one trace per delivery
attempt, each linked back to the checkout.

**What's left**: the real flows. A failed email should not be the end (a dead-letter
queue someone looks at, a "resend tickets" button). A failed payment should let the
customer retry while the seats are held for 15 minutes; here inventory releases them at
once when `payment.failed` arrives.
