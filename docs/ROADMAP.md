# ROADMAP — build phases

Deadline: material frozen **Fri 13 Nov 2026** (event 16–19 Nov). Dry run with
2–3 people on a clean laptop before that.

Each phase: plan → approval → build (verify first) → demo to Adrián → next.

| Phase | Scope | Done when | Status |
|---|---|---|---|
| **0 — Skeleton** | AI coach-mode guardrails (docs/06), pnpm workspace, compose (Postgres, RabbitMQ, Toxiproxy, Collector, otel-lgtm, k6), Makefile (`pull up down reset doctor load`), Grafana provisioning stub, `verify/` harness, CI skeleton | `make up` healthy on mac arm64 + linux amd64, < 4 GB RAM | ✅ linux amd64 (≈ 0.9 GB infra idle); mac arm64 pending (phase 6) |
| **1 — Lab 1 end-to-end** | gateway, orders, payments, fake-psp (minimal), D1, D2 toxic, `lab-1-start` / `lab-1-solution`, `verify-1`, `labs/01-*` | CI matrix: start FAIL / solution PASS | ✅ local + CI; ≈ 1.34 GB with all services + baseline load |
| **2 — Lab 2** | instrumentation.ts per service, D3, log↔trace links, `verify-2` | CI matrix green | ☐ |
| **3 — Lab 3** | inventory + catalog, D10 profile, D4, D5, D6, spanmetrics/servicegraph, Checkout dashboard, `verify-3` | CI matrix green | ☐ |
| **4 — Lab 4** | notifier + RabbitMQ, D7, D8, Baggage, correlation_id, span links, `code.*` attrs, `verify-4` | CI matrix green | ☐ |
| **5 — Lab 5** | `ai` profile, mcp-grafana, `.mcp.json`, incident-5, D9, PROMPT.md, demo recording | Demo runs end-to-end twice in a row | ☐ |
| **6 — Hardening** | image digests, `make pull` offline test, Codespaces devcontainer, Windows/WSL2 test, INSTRUCTOR.md for all labs, slides hand-off | Dry run done | ☐ |

## Open decisions

| # | Decision | Default | Status |
|---|---|---|---|
| 1 | fake-psp language | PHP on FrankenPHP | Decided (ADR-0006) |
| 2 | Lab 5 format | Live demo + optional hands-on | Decided (pending confirm with organisers re "no cloud accounts" note) |
| 3 | SDK vs OBI (eBPF) | SDK in labs; OBI only mentioned in wrap-up / bonus | Decided |
| 4 | Express version | NestJS 11.2.8 → Express 5.2.1 (instrumentation-express `<6`, instrumentation-nestjs-core `<12`) | Decided (ADR-0005) |
