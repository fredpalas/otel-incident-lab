# Lab 3 — Instructor notes

**Defects**: D10 (fake-psp `longtail`: 90 % 50–100 ms, 8 % 300–600 ms, 2 % 1.5–3 s),
D4 (inventory loads and saves seats one by one: 2N + 1 queries), D5 (orders calls
inventory, `/pricing` and `/customers` sequentially, ~100 ms of it avoidable: catalog sits
behind ~80 ms of WAN latency), D6 (inventory opens a new Postgres connection per request;
`max_connections=20`).

## Timing (40')

| Min | What |
|---|---|
| 0–9 | Connectors in the Collector (Hint 1 on the projector at minute 5 if stuck); `make load` should already be running since the break. Checkout dashboard: bimodal heatmap, click a p99 exemplar → the PSP span. "Not our code": what would you do? Take 2–3 answers. |
| 9–21 | Comb in inventory (D4). Fix with one `SELECT … FOR UPDATE SKIP LOCKED` and one `UPDATE … = ANY` / `unnest`. |
| 21–30 | Staircase in orders (D5). `Promise.all`. Two traces side by side: ~190 ms → ~90 ms before payments. |
| 30–40 | `pg.connect` in every trace; `make spike` → "too many clients" in Loki (D6). Module-level `Pool`. `make verify N=3`. |

## What to show on the projector

1. The heatmap before/after `make load` runs a few minutes: a dense band under 300 ms and
   a sparse one at 0.5–1 s (slow charges, and the ones cut at payments' 700 ms timeout:
   their PSP span runs 1.5–3 s). Averages hide the second band.
2. An exemplar from the top band: the trace is all `payments → fake-psp`.
3. The comb (13 database spans for 6 tickets) and the staircase in the same trace.
4. `make spike` at `lab-3-start` vs. after the pool: ~70 % of checkouts fail vs. none.

## Expected fix (see SOLUTION.md)

- Collector: `spanmetrics` (exemplars on, flush 15 s) + `servicegraph`, `metrics`
  pipeline to lgtm.
- inventory: one query to lock the available seats, one to reserve them all.
- orders: `Promise.all` for seats, price and tier.
- inventory: `Pool` (`max: 5`) shared by every request; `PgUnitOfWork` borrows a client.
- D10: no code. Timeout already sized in lab 2; the discussion is SLO / fallback /
  reconciliation.

## Common blockers

| Symptom | Cause / fix |
|---|---|
| Collector restarts in a loop after editing | YAML error, or a connector declared but not used in a pipeline. `docker compose logs otel-collector`. |
| Dashboard still empty after the connectors | Metrics are flushed every 15 s and the panels use 1 m rates: wait a minute. Is `make load` running? |
| No exemplars on the graph | `exemplars.enabled: true` missing; or the panel's "Exemplars" toggle is off. |
| Spanmetrics present but the service graph is empty | `servicegraph` not in the traces pipeline's exporters. |
| verify still counts many queries after the fix | They batched the `SELECT` but still save each seat one by one (N `UPDATE`s). |
| `Promise.all` fix breaks the 409 for sold-out events | They swallowed the rejection. Let the first error propagate. |
| Pool fix still shows `pg.connect` in every trace | The pool is created per request (inside `run`), not once per process. |

## If the group is behind

Measured: connectors → first span metrics in Prometheus ~15 s (flush interval); the
heatmap needs **3–5 minutes of `make load`** before the 2 % tail forms a visible band —
start `make load` at the very beginning of the lab (or during the break). `make spike`
~30 s; `make verify N=3` ~20 s (60 s if span metrics are missing).

- D4 is the slowest step (rewriting the repository queries): at minute 18 put Hint 3
  and the `= ANY($1)` / `unnest` shape on the projector.
- Minute 32 and D6 not started: the pool change is ~10 lines, live-code it.
- The stretch (pool.acquire span) is homework.

## Discussion prompts

- Which percentile would you put in an SLO for checkout — and what does the PSP's tail
  do to it?
- D4 came from a clean repository pattern. Where else does "load one aggregate at a
  time" hide in your codebase?
- `Promise.all` started three requests at once. If inventory succeeds and pricing fails,
  the seats stay reserved. What would you do (compensation, expiry, a saga)?
