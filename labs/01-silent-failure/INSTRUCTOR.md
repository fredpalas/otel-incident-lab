# Lab 1 — Instructor notes

**Defects**: D1 (swallowed payment error in `orders`), D2 (Toxiproxy `reset_peer`,
5 % of PSP connections) — D2 is only *noticed* here; its origin is found in lab 2.

## Timing (25')

| Min | What |
|---|---|
| 0–3 | Read the ticket aloud. Everyone runs `make lab N=1` and `make repro N=1`. |
| 3–6 | Show on the projector: Grafana Explore → Loki → nothing. `docker compose logs orders` → only Nest startup lines. "Everything is green." |
| 6–18 | Hands-on: pino + transport in `orders`, then fix D1. Fast people do `payments` and `gateway`. |
| 18–22 | `make verify N=1`. Show the error query in Loki, expand a line, point at `order_id`. |
| 22–25 | Cliffhanger: the all-services error query. gateway, orders and payments all log the same failure (notifier's email retries show up too). "Who started it?" → lab 2. |

## What to show on the projector

1. `make repro N=1` output: 60/60 "confirmed", ~3 `PENDING`.
2. Loki empty before; after the fix, `{service_name="orders"} | severity_text=~"(?i)error"`.
3. Expand a log line: `order_id`, `err.message` (`psp request failed`/`payments responded 502`).
4. `{service_name=~".+"} | severity_text=~"(?i)error"` — gateway, orders and payments
   all logging "upstream" errors. Ask the room which one is the origin.

## Common blockers

| Symptom | Cause / fix |
|---|---|
| No logs in Loki at all | Forgot `make up` after editing; or transport target misspelled. `docker compose logs orders` shows transport errors. |
| Logs in Loki but `service_name="unknown_service"` | Logger created a custom resource without `service.name`; the env var `OTEL_SERVICE_NAME` is already set — don't override it. |
| `verify` says no `order_id` | They logged `orderId` inside a message string. The field must be in the log object. Both `order_id` and `orderId` are accepted. |
| `verify` "customer is told" fails | They mark the order `FAILED` but still return 201. The API must fail (502 is the expected answer). |
| Order still `PENDING` | They rethrow but never save the `FAILED` status. |
| Logs reach the Collector but never Loki; Loki answers `Ingester is shutting down` | Docker's disk is > 90 % full: Loki throttles its WAL and drops writes. `make doctor` warns at 85 %. `docker system prune`, then `make reset`. |
| Build fails offline | They ran `pnpm add` — not needed, deps are pre-installed. Revert `package.json`. |

## Why the 5 % matters

`make repro N=1` shows ~5 % stuck orders: the classic "some customers" ticket.
`make verify N=1` does **not** rely on that randomness: it temporarily resets 100 % of
PSP connections, generates its own traffic and restores the scenario afterwards
(ADR-0007). If a verify run is killed mid-way, `make lab N=1` re-applies the scenario.

## If the group is behind

Measured (phase 6 replay, fast machine; expect 2–3× on laptops): `make lab N=1` ~20 s,
`make repro N=1` ~20 s, each `make up` after an edit 6–12 s, `make verify N=1` ~30 s at
start (it waits for Loki), ~5 s once logs flow.

- Minute 12 and still no logs in Loki: show Hint 1 (the logger) on the projector.
- Minute 18: `make solution N=1` for anyone > 5 minutes behind; the cliffhanger at
  minute 22 needs everyone to see the multi-service error query.
- Only the `orders` logger and D1 are required for verify; the other services' loggers
  can be copied in the break.
