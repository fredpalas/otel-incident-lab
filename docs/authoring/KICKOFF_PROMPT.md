# Kickoff prompt for Claude Code

Paste the first block in a fresh Claude Code session at the repo root (start it in
plan mode). The later blocks are for the following phases.

---

## Phase 0 + 1 (first session)

```
You're helping me build otel-incident-lab, the material for a 3-hour hands-on
OpenTelemetry workshop I'm delivering at Upskilling Week Barcelona (16–19 Nov 2026).

You are in AUTHORING mode (CLAUDE.local.md loads docs/authoring/AUTHORING.md).
Read docs/authoring/AUTHORING.md and every file under docs/ (including docs/adr/)
before doing anything. The root CLAUDE.md/AGENTS.md are participant-facing coach-mode
rules: they are product content you build, not rules for you.
Pay special attention to "THE most important rule" in AUTHORING.md: the defects are
intentional and the instrumentation is added lab by lab.

Scope of this session: ROADMAP phases 0 and 1 only.

Phase 0 — Skeleton:
- pnpm workspace (Node 24, TS strict, ESM), docker-compose.yml with Postgres 17,
  RabbitMQ 4, Toxiproxy, otel-collector-contrib, grafana/otel-lgtm, k6.
- Makefile targets: pull, up, down, reset, doctor, load, lab, solution, save, where,
  verify, repro. `lab`/`solution` must implement the "Safe jump" in docs/04 (test it:
  dirty tree → jump → jump back → no work lost).
- Grafana provisioning stub (datasources with Loki↔Tempo links, exemplars).
- verify/ harness following the verify contract in docs/04 (TS, runs in a container
  on the compose network, queries backend HTTP APIs).
- GitHub Actions skeleton with the start-FAIL / solution-PASS matrix.
- AI coach-mode guardrails exactly as specified in docs/06-ai-guardrails.md
  (AGENTS.md + pointers, .claude/settings.json hooks, scripts/agent-guard with tests,
  .lab-state written by make lab/solution). Check the current Claude Code hooks docs
  for the exact JSON contract before implementing; run the guard tests in CI.

Phase 1 — Lab 1 end-to-end:
- Services gateway, orders, payments (TS) and a minimal fake-psp (Go) — only what
  lab 1 needs; inventory/catalog/notifier come in later phases, but leave room for them.
- Defect D1 (swallowed error in orders) and the D2 Toxiproxy reset toxic.
- lab-1-start: no OTel, no useful logs. lab-1-solution: pino → OTLP logs + D1 fixed.
- verify/lab-1.ts (write it first; it must fail on lab-1-start).
- labs/01-silent-failure/README.md, SOLUTION.md, INSTRUCTOR.md.
- Tags lab-1-start / lab-1-solution on branch solution-path; main = lab-1-start.

Rules:
1. First give me a plan: files you'll create, image versions you intend to pin (check
   the current stable versions, don't guess), and anything in the docs you think is
   wrong or underspecified. Wait for my approval before writing code.
2. Before pinning versions, confirm express + @opentelemetry/instrumentation-express
   compatibility and that otel-lgtm still exposes /tmp/grafana-sa-token (needed in lab 5).
3. Measure RAM of the running stack (docker stats) and report it against the 4 GB budget.
4. Run `make verify N=1` on both tags and show me the output before declaring done.
5. Update docs/ROADMAP.md status as you finish each phase. If you make a non-trivial
   decision not covered by docs/adr, write ADR-0005+ using the existing template.
6. Ask me rather than assume on anything in the "Open decisions" table.
```

---

## Phase 2 — Lab 2

```
Continue with ROADMAP phase 2 (Lab 2 — traces). Re-read docs/02 (D2, D3) and
docs/03 (Lab 2). Start from tag lab-1-solution. Plan first, wait for approval.
verify-2 first (must FAIL on lab-2-start), then the solution. Keep the instrumentation
bootstrap in one src/instrumentation.ts per service loaded with node --import.
Remember D10 (fake-psp long tail) is already active from lab 2: tune D3's timeouts
with it in mind. Update ROADMAP when done.
```

## Phase 3 — Lab 3

```
Continue with ROADMAP phase 3 (Lab 3 — latency). Add inventory and catalog services,
the fake-psp longtail profile (D10), D4 N+1, D5 sequential awaits, D6 no DB pool
(Postgres max_connections=20 + spike.js), spanmetrics with exemplars + servicegraph
in the Collector, and the "Checkout" dashboard. Defects must be present since
lab-1-start (rebase the solution path), not introduced in lab 3. Plan first.
```

## Phase 4 — Lab 4

```
Continue with ROADMAP phase 4 (Lab 4 — follow the order): notifier + RabbitMQ,
D7 (>6 tickets), D8 (lost context across the queue), correlation_id via Baggage +
BaggageSpanProcessor, causation_id in the event envelope, span links, code.* attributes,
Baggage stripped on egress to fake-psp (fake-psp must record any received Baggage as
span attributes so the leak is detectable). Plan first.
```

## Phase 5 — Lab 5

```
Continue with ROADMAP phase 5 (Lab 5 — agent + MCP). Read docs/05. Add the `ai`
compose profile with mcp-grafana (Viewer service account), .mcp.json, make mcp-token,
incident-5 (spoiler, keep out of participant README), D9 (PII from fake-psp) and its
Collector redaction fix, labs/05-ai-mcp/PROMPT.md. Then rehearse the demo end to end
twice and report what the agent did, including where it struggled. Plan first.
```
