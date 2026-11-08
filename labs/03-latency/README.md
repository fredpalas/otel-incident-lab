# Lab 3 — Latency (40')

```sh
make lab N=3      # checkout lab-3-start, apply scenario, restart affected services
make verify N=3   # tells you if you're done
```

## 🚨 Alert: `CheckoutLatencyHigh`

> **Checkout p99 > 800 ms for 10 minutes.** p50 looks fine (~200 ms).
>
> Marketing launches a flash sale on Friday. "Can the checkout take it?"

Nothing is broken, nothing logs an error: it's just slow, *sometimes*. Errors were easy
to follow trace by trace. Latency needs the **whole distribution** first, then the right
trace.

## Goal

1. Turn your traces into latency metrics, with **exemplars** linking metrics to traces.
2. Find out who owns the p99. Decide what you'd do about it.
3. Find and fix what makes *every* checkout slower than it should be.
4. Make the checkout survive a burst of traffic.

You're done when `make verify N=3` is all ✅.

## Steps

1. **Metrics from traces.** `make load` to start background traffic. The Collector can
   derive RED metrics (rate, errors, duration) from the spans that pass through it:
   - add the `spanmetrics` connector, with **exemplars** enabled, and the `servicegraph`
     connector to `observability/collector/config.yaml`;
   - a connector is an *exporter* of one pipeline and a *receiver* of another: the
     `traces` pipeline feeds them, a new `metrics` pipeline sends their output to `lgtm`.
   - `make up` restarts the Collector when its config changes.
2. **The p99.** Open the **Checkout** dashboard (Grafana → Dashboards → Workshop). Look
   at the latency heatmap: one hump or two? Click an exemplar (◆) high up on the p99 line
   and open its trace. Which span takes the time? Is it our code? Write down what you'd
   do about it (there's no code to change here).
3. **The comb.** Now take a checkout that is *not* an outlier (TraceQL
   `{ resource.service.name = "inventory" && span.http.route = "/reservations" }`) and
   look at `inventory`'s database spans. How many queries to reserve 6 seats? What would it take for 10?
4. **The staircase.** In the same trace, look at the calls `orders` makes before it
   charges the customer. Do they overlap in time? Do they need each other's result?
   Fix it, then compare a trace from before with one from after (open them in two tabs).
5. **The flash sale.** Look for a `pg.connect` span in `inventory`. Is it in every
   trace? Run `make spike` and, while it runs, look at `inventory`'s error logs in Loki.
   Postgres accepts 20 connections (`docker-compose.yml`). Fix `inventory` so it doesn't
   need one per request.
6. **Stretch.** Limit the fix of step 5 to 2 connections and run `make spike` again.
   Where does the waiting show up in a trace — and how could you make it visible?

## What you should see in Grafana

- **Checkout dashboard**: rate, errors, p50/p95/p99 with exemplars, a latency heatmap,
  RED per service. Before step 1 those panels are empty: "No data" is the point.
- **Explore → Tempo → Service graph**: the services and the calls between them, with
  their rate, errors and latency (after step 1).
- Before step 3, a "comb": many tiny sibling database spans under one request.
- Before step 4, a "staircase": sibling spans that start only when the previous ends.

## Hints

<details>
<summary>Hint 1 — Collector connectors</summary>

```yaml
connectors:
  spanmetrics:
    histogram:
      explicit:
        buckets: [50ms, 100ms, 200ms, 300ms, 500ms, 750ms, 1s, 1.5s, 2s, 3s, 5s]
    exemplars:
      enabled: true
    metrics_flush_interval: 15s
  servicegraph:
    metrics_flush_interval: 15s

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp_grpc/lgtm, spanmetrics, servicegraph]
    metrics:
      receivers: [spanmetrics, servicegraph]
      processors: [batch]
      exporters: [otlp_grpc/lgtm]
```

</details>

<details>
<summary>Hint 2 — The p99</summary>

The slow traces spend almost all their time in one span: `payments` → `fake-psp`. The
PSP is a third party; its latency has a long tail. You can't fix their code. What you
can decide: a timeout and what the customer sees when it hits, an SLO you can actually
meet, a fallback, a conversation with the provider — with the heatmap as evidence.

</details>

<details>
<summary>Hint 3 — The comb</summary>

Look at `db.query.text` of the repeated spans and find the loop in
`services/inventory/src/reservations/`. A repository that loads one aggregate at a
time is clean, until it runs in a loop. How would you load and update all the seats of
the order in one go (`= ANY($1)`)?

</details>

<details>
<summary>Hint 4 — The staircase and the flash sale</summary>

- `orders`: the seats, the price and the customer's tier are independent of each other.
  `Promise.all` runs them concurrently — what should happen if one of them fails?
- `inventory`: look at how `PgUnitOfWork` gets its database connection. Opening a
  connection costs a TCP handshake and authentication, every time. A `pg` `Pool`
  keeps a few open and lends them out.

</details>

Stuck? `make solution N=3` jumps to the solution (your work is saved first).
