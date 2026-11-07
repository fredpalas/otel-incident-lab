# Lab 1 — Silent failure (25')

```sh
make lab N=1      # checkout lab-1-start, apply scenario, restart affected services
make verify N=1   # tells you if you're done
```

## 🎫 Support ticket #4711

> **Priority: high** — "Some customers paid nothing, got no tickets, and the website
> said *'Order confirmed'*. They're furious on social media. Engineering says
> everything is green."

## The system

```
k6 ──► gateway ──► orders ──► payments ──► (toxiproxy) ──► fake-psp
                     │                                     (external payment provider)
                     └──► Postgres
```

- `gateway` — public API: `POST /checkout`, `GET /orders/:id` (port 8080)
- `orders` — checkout use case, owns the `orders` table (`PENDING → PAID`, or `FAILED`)
- `payments` — talks to the external payment provider
- `fake-psp` — a third-party provider. Not our code, don't edit it.

## Goal

Make the failure **visible** and make the system **honest** with the customer.

You're done when `make verify N=1` is all ✅.

## Steps

1. **Reproduce.** Run `make repro N=1`. It places 60 checkouts and looks at them again
   a few seconds later. What do you see?
2. **Look for evidence.** Open Grafana → **Explore** (<http://localhost:3000/explore>).
   Pick the **Loki** datasource. Anything from our services? Now try
   `docker compose logs orders`. Is there anything useful in there?
3. **Make the services talk.** Add structured logging with
   [`pino`](https://getpino.io) and ship the logs over OTLP with
   [`pino-opentelemetry-transport`](https://github.com/pinojs/pino-opentelemetry-transport):
   `service → Collector → Loki`. Start with `orders`, then do `payments` and `gateway`.
   - Both packages are already installed in every service (venue Wi-Fi is unreliable).
   - The Collector already has a logs pipeline: read
     `observability/collector/config.yaml` to see how logs travel to Loki.
   - Each service already gets `OTEL_SERVICE_NAME` and `OTEL_EXPORTER_OTLP_ENDPOINT`
     from `docker-compose.yml`.
   - After changing code, run `make up` — it rebuilds and restarts only what changed.
4. **Fix the bug.** Find out why a failed payment ends up as a confirmed order, and fix
   it: the order must not stay `PENDING` forever, the customer must not get a success
   response, and the failure must be logged **as an error, with the order id**.
5. **Find it in Grafana.** Run `make repro N=1` again and query Loki:

   ```logql
   {service_name="orders"} | severity_text=~"(?i)error"
   ```

   Then look at the error logs of **all** services:

   ```logql
   {service_name=~".+"} | severity_text=~"(?i)error"
   ```

   Several services complain about the same failure. **Which one is the origin?**
   Can you tell from the logs alone? (Keep that question for lab 2.)

## What you should see in Grafana

- **Before**: Loki has nothing from `gateway`, `orders` or `payments`.
- **After**: error lines from `orders` with an `order_id` attribute (expand a line to see
  its fields), plus similar-looking errors from `payments` and `gateway`.

## Hints

<details>
<summary>Hint 1 — Where should I look?</summary>

The customer gets "confirmed", so the request goes through `gateway → orders` without an
error. Find where `orders` calls `payments` in the checkout use case
(`services/orders/src/orders/application/`). What happens when that call throws?

</details>

<details>
<summary>Hint 2 — The bug</summary>

Read the `try`/`catch` around the payment call. Where does the error go? Does anybody
ever settle those orders "later"? What should the order status be, and what should the
HTTP response be, when the payment provider is unreachable?

</details>

<details>
<summary>Hint 3 — Setting up pino</summary>

Create one logger per service (e.g. `src/logger.ts`) and use transport **targets**: one
that writes to stdout (`pino/file` with `destination: 1`) and one that is
`pino-opentelemetry-transport`. The transport reads the standard `OTEL_*` environment
variables. Log with an object first, message second:
`logger.error({ order_id, err }, 'message')` — the object's fields become attributes in
Loki.

</details>

<details>
<summary>Hint 4 — Nothing shows up in Loki</summary>

- `docker compose logs orders`: does pino write to stdout? Any transport errors?
- Is the time range in Grafana recent enough (last 15 minutes)?
- `{service_name="orders"}` without any filter: do you get *any* line?
- Did you `make up` after changing code?

</details>

Stuck? `make solution N=1` jumps to the solution (your work is saved first).
