# 03 — Labs specification

Each lab ships as `labs/0N-<slug>/` with:

- `README.md` — participant-facing: the **symptom** (as a support ticket / alert),
  the goal, steps, "what you should see in Grafana", and progressive **hints** in
  `<details>` blocks. No spoilers in the visible text.
- `SOLUTION.md` — the fix, with the diff explained (the `lab-N-solution` tag has it
  applied).
- `INSTRUCTOR.md` — timing, common blockers, what to show on the projector.

Every README starts with:

```
make lab N=<n>      # checkout lab-N-start, apply scenario, restart affected services
make verify N=<n>   # tells you if you're done
```

---

## Lab 1 — Silent failure (20')

**Ticket**: "Some customers paid nothing, got no tickets, and the website said
'Order confirmed'."

1. Reproduce: `make load` is running; run `make repro N=1` (k6 script) and check
   `GET /orders/:id` → `PENDING` forever. Open Grafana: nothing.
2. Look at `docker compose logs orders`: nothing useful.
3. Add `pino` structured logging with `pino-opentelemetry-transport` → Collector → Loki.
   Fix D1 (stop swallowing the error).
4. Grafana Explore → Loki: find the errors. Discover they all say some form of
   `upstream error` / `socket hang up` in **three** services (D2). Where does it start?
   → cliffhanger for lab 2.

**Collector**: logs pipeline only. **Verify-1**: D1 checks.

## Lab 2 — Traces (30')

**Ticket**: continues lab 1 + "and sometimes it just times out".

1. Add `src/instrumentation.ts` (NodeSDK + auto-instrumentations) to all TS services,
   load with `node --import`. Add traces pipeline to the Collector.
2. Add `@opentelemetry/instrumentation-pino` → logs now carry `trace_id`.
3. In Grafana: from an error log, jump to its trace. Find the deepest ERROR span
   (D2 origin: reset on payments → fake-psp).
4. Notice repeated sibling spans to fake-psp; open service graph (D3). Fix timeouts,
   retries, backoff, idempotency key.
5. Fix the duplicated error logging (only the origin logs the full error).

**Verify-2**: D2 + D3 checks.

## Lab 3 — Latency (35')

**Alert**: "Checkout p99 > 2 s for 10 minutes. p50 looks fine."

1. (8') Add `spanmetrics` (with exemplars) + `servicegraph` connectors. Open the
   "Checkout" dashboard: bimodal heatmap. Click a p99 exemplar → D10 (fake-psp long
   tail). Conclusion: not our code; write down the mitigation you'd pick.
2. (9') Take a slow-but-not-outlier trace: comb pattern in inventory → fix D4.
3. (9') Staircase in orders → fix D5 with `Promise.all`. Compare traces before/after.
4. (9') `pg.connect` in every trace; run `make spike` → "too many clients" in Loki →
   fix D6 with a `Pool`.
5. Stretch: `max: 2` → gap in trace → manual `pool.acquire` span.

**Verify-3**: D4, D5, D6 + spanmetrics present.

## Lab 4 — Follow the order (25')

**Tickets**: (a) "Error rate ~3 %, no pattern." (b) "Order `ord_123` was paid but the
customer never got the email."

1. (5') Add business attributes to the checkout span: `order.tickets`,
   `customer.tier`, `order.id`. TraceQL `{ status = error && span.order.tickets > 6 }`
   → fix D7.
2. (7') Generate `correlation_id` in gateway, put it in **Baggage**, add
   `BaggageSpanProcessor`, add the field to the logger mixin. Strip Baggage on egress
   to fake-psp.
3. (8') `orders`: add `correlation_id` + `causation_id` to the event envelope and
   inject `traceparent` into message headers. `notifier`: extract context, create a
   span **link**. Also add `code.function.name` / `code.file.path` to manual spans
   (needed by the agent in lab 5).
4. (5') Search `ord_123`:
   - Loki `{service_name=~".+"} | json | correlation_id="ord_123"` → full story
     including the notifier retry.
   - Tempo `{ span.correlation_id = "ord_123" }` → 3 traces, one order.

**Verify-4**: D7 + D8 checks (including no `correlation_id` on fake-psp spans).

## Lab 5 — Agent + MCP, and wrap-up (25')

See `docs/05-lab5-ai-mcp.md`. Instructor-led live demo; optional hands-on for those
with their own MCP-capable agent.

Wrap-up topics (in the demo flow, not separate slides): RED from spans, SLO + alert,
head vs tail sampling and cost, why `correlation_id` survives sampling, Collector as
gateway, semantic conventions, D9 redaction in the Collector.

---

## Bonus (self-study, in repo)

- D6 stretch (pool exhaustion → gap → manual span).
- Profiles: trace → Pyroscope flame graph for a CPU-heavy endpoint.
- OBI (eBPF zero-code) vs SDK: what you lose (business attributes, Baggage).
