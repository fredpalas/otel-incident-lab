# Lab 1 — Solution

`git diff lab-1-start lab-1-solution -- services/` shows the whole change. Two things
happen: the services start emitting structured logs over OTLP, and `orders` stops
lying to the customer.

## 1. Structured logs → OTLP → Loki (every service)

`src/shared/infrastructure/logger.ts`:

```ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: {
    targets: [
      { target: 'pino/file', options: { destination: 1 } }, // docker compose logs
      { target: 'pino-opentelemetry-transport' },           // OTLP → Collector → Loki
    ],
  },
});
```

No endpoint or service name in code: the transport reads `OTEL_SERVICE_NAME` and
`OTEL_EXPORTER_OTLP_ENDPOINT`, which `docker-compose.yml` already sets. That's the
OpenTelemetry way — configuration by standard environment variables, so the same code
runs everywhere.

Log **objects, not strings**: `logger.error({ order_id, err }, 'message')`. Every field
becomes a log attribute; Loki stores it as *structured metadata* you can filter on
(`| order_id="…"`), and `err` is expanded into `err_message`, `err_name`, `err_stack`.

## 2. D1 — the swallowed exception (`orders`)

Before (`CheckoutService.placeOrder`):

```ts
try {
  await this.payments.charge({ … });
  order.markPaid();
  await this.orders.save(order);
} catch {
  // Charges the PSP couldn't confirm are settled later by payment reconciliation.
}
return order.toDto(); // 201, status PENDING, forever
```

The comment describes a reconciliation job that doesn't exist. Every failed payment
became a `201 Order confirmed` with an order stuck in `PENDING`.

After:

```ts
try {
  await this.payments.charge({ … });
} catch (error) {
  order.markFailed();
  await this.orders.save(order);
  logger.error({ order_id: order.id.value, err: error }, 'payment failed, order marked as FAILED');
  throw new PaymentFailedError(order.id.value, { cause: error });
}

order.markPaid();
await this.orders.save(order);
return order.toDto();
```

- The order ends in a terminal state (`FAILED`), so support can see what happened.
- `PaymentFailedError` is mapped to **502** by `DomainErrorFilter`: the customer is told
  the checkout failed, and the gateway propagates it.
- The error is logged once, with the order id and the cause.

`payments`, `inventory`, `catalog` and `gateway` log their 5xx responses in their
`DomainErrorFilter`s. The message consumers (`notifier`, `inventory`) and the outbox relay in `orders`
log what happens to each message: a notification retried or given up is now visible.

## 3. What you see now — and why it's not enough

```logql
{service_name=~".+"} | severity_text=~"(?i)error"
```

`gateway`, `orders` and `payments` all log an error for the same failed checkout,
each saying some form of "upstream error". Logs tell you **that** something failed and
**which order**, but not **where the failure started** or how one request travelled
through the services. That's D2, and it's what traces are for → lab 2.

(D2 itself — the connection resets between `payments` and the PSP — is
infrastructure, not our code. Lab 2 proves it.)
