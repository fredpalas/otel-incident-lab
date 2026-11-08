# ROADMAP — build phases

Deadline: material frozen **Fri 13 Nov 2026** (event 16–19 Nov). Dry run with
2–3 people on a clean laptop before that.

Each phase: plan → approval → build (verify first) → demo to Adrián → next.

| Phase | Scope | Done when | Status |
|---|---|---|---|
| **0 — Skeleton** | AI coach-mode guardrails (docs/06), pnpm workspace, compose (Postgres, RabbitMQ, Toxiproxy, Collector, otel-lgtm, k6), Makefile (`pull up down reset doctor load`), Grafana provisioning stub, `verify/` harness, CI skeleton | `make up` healthy on mac arm64 + linux amd64, < 4 GB RAM | ✅ linux amd64 (≈ 0.9 GB infra idle); mac arm64 pending (phase 6) |
| **1 — Lab 1 end-to-end** | gateway, orders, payments, fake-psp (minimal), D1, D2 toxic, `lab-1-start` / `lab-1-solution`, `verify-1`, `labs/01-*` | CI matrix: start FAIL / solution PASS | ✅ local + CI; ≈ 1.34 GB with all services + baseline load |
| **2 — Lab 2** | instrumentation.ts per service, D3, log↔trace links, `verify-2` | CI matrix green | ✅ (D3 reframed: double charges + budget, ADR-0008 traced verify) |
| **3 — Lab 3** | inventory + catalog, D10 profile, D4, D5, D6, spanmetrics/servicegraph, Checkout dashboard, `verify-3` | CI matrix green | ✅ defects planted since `lab-1-start` (incl. D7); Tempo generator off (ADR-0009), catalog latency via Toxiproxy (ADR-0010); ≈ 1.9 GB with baseline load, ≈ 2.5 GB after `make spike` |
| **4 — Lab 4** | notifier + RabbitMQ, D7 (already planted in catalog since `lab-1-start`: only lab text, fix and verify), `payment.failed` event (payments publishes it, inventory consumes it and releases the order's seats, order stays `FAILED`; real-world retry + 15 min hold only mentioned), D8, Baggage, correlation_id, span links, `code.*` attrs, `verify-4` | CI matrix green | ✅ messaging since `lab-1-start`; D8 = outbox relay (ADR-0011); email via Mailpit + Toxiproxy (ADR-0012); `payment.failed` is published directly, so it *keeps* the trace context — a deliberate contrast with the outbox |
| **5 — Lab 5** | `ai` profile, mcp-grafana, `.mcp.json`, incident-5, D9, PROMPT.md, demo recording | Demo runs end-to-end twice in a row | ✅ rehearsed 2× Claude Code + Copilot CLI (notes in `labs/05-ai-mcp/INSTRUCTOR.md`); mcp-grafana 2.2.0 over stdio, Viewer token; opencode.json locked on labs 1–4; demo **recording still to do** (phase 6) |
| **6 — Hardening** | image digests, `make pull` offline test, Codespaces devcontainer, Windows/WSL2 test, INSTRUCTOR.md for all labs, slides hand-off | Dry run done | 🟡 digests + CI check ✅; offline `make pull` → everything (labs 1–5, mcp-token, incident-5) verified in a network-less DinD ✅; devcontainer verified locally ✅ (real Codespace not tried); guardrails validated with Claude Code / Copilot CLI / opencode (`scripts/agent-guard/COMPATIBILITY.md`) ✅; INSTRUCTOR for every lab + `labs/INSTRUCTOR.md` ✅; timed replay ✅ — **timing doesn't hold for labs 2 and 4** (see `labs/INSTRUCTOR.md`). Pending: WSL2 run (`docs/authoring/WSL2-CHECKLIST.md`), mac arm64, demo recording, slides, dry run with 2–3 people, agenda decision |

## Open decisions

| # | Decision | Default | Status |
|---|---|---|---|
| 1 | fake-psp language | PHP on FrankenPHP | Decided (ADR-0006) |
| 2 | Lab 5 format | Live demo + optional hands-on | Decided (pending confirm with organisers re "no cloud accounts" note) |
| 3 | SDK vs OBI (eBPF) | SDK in labs; OBI only mentioned in wrap-up / bonus | Decided |
| 4 | Express version | NestJS 11.2.8 → Express 5.2.1 (instrumentation-express `<6`, instrumentation-nestjs-core `<12`) | Decided (ADR-0005) |
