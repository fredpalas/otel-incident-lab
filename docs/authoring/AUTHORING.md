# AUTHORING.md — otel-incident-lab (authoring mode)

Context for the AI agent that **builds** this repo. Loaded via the git-ignored
`CLAUDE.local.md`. Read this first, then `docs/`.

> The root `CLAUDE.md` / `AGENTS.md` are **participant-facing product content**
> (coach-mode guardrails, see `docs/06-ai-guardrails.md`). They do not apply to you
> while authoring — you maintain them. Keep authoring docs under `docs/authoring/`.

## What this repo is

The material for a **3-hour hands-on workshop** ("Production Incident Lab: Debugging
Distributed Systems with OpenTelemetry") at Upskilling Week Barcelona (Mobile World
Capital / Talent Arena), 16–19 Nov 2026. Audience: senior engineers, 20–80 people,
each on their own laptop.

It is a **deliberately broken** distributed ticketing system plus a local Grafana
stack. Participants find and fix planted defects by adding observability step by step:
no signals → logs → traces → business context → an AI agent doing the same over MCP.

## THE most important rule

**The bugs are the product.** Defects D1–D10 (see `docs/02-defects-catalog.md`) are
intentional and must exist at each lab's `lab-N-start` tag.

- Never "fix" a catalogued defect except in the commit that is tagged as its
  `lab-N-solution`.
- Never add instrumentation (OTel SDK, logger, trace attributes) ahead of the lab that
  teaches it. On `lab-1-start` the services have **no** OTel and **no** useful logs.
- If you spot a bug that is NOT in the catalog, flag it to the user; do not fix it silently.
- Code must look like plausible, ordinary production code. Defects must not be
  signposted with comments like `// BUG HERE` in participant-facing code. Defect
  locations are documented only in `docs/` and in `labs/*/SOLUTION.md`.

## Read next

| File | Purpose |
|---|---|
| `docs/00-workshop-overview.md` | Goals, audience, agenda, constraints |
| `docs/01-architecture.md` | Services, compose topology, ports, telemetry pipeline |
| `docs/02-defects-catalog.md` | Every defect: injection, symptom, signal, fix, verify |
| `docs/03-labs-spec.md` | Lab-by-lab spec: steps, timings, checkpoints |
| `docs/04-repo-conventions.md` | Git tags, Makefile contract, verify contract, CI |
| `docs/05-lab5-ai-mcp.md` | Final lab: agent + Grafana MCP |
| `docs/06-ai-guardrails.md` | Coach-mode harness that stops agents solving labs 1–4 |
| `docs/ROADMAP.md` | Build phases and current status |
| `docs/adr/` | Decisions already taken — don't relitigate without asking |

## Stack (decided)

- **Services**: TypeScript, Node.js 24 LTS, Express, pnpm workspaces, ESM, `strict` TS
  (no `any`, explicit return types).
- **Data**: PostgreSQL 17, RabbitMQ 4 (`amqplib`).
- **Fault injection**: Toxiproxy + env-driven scenario profiles (`scenarios/*.env`).
- **Load**: k6 (continuous baseline + per-incident scripts).
- **Observability**: `otel/opentelemetry-collector-contrib` (editable by participants)
  → `grafana/otel-lgtm` (Grafana, Loki, Tempo, Prometheus, Pyroscope).
- **fake-psp**: separate language, pre-instrumented, never edited by participants.
  Default **Go**; PHP is an open alternative (see ROADMAP open decisions).

Pin every image to an explicit version (digests before the event). Before pinning,
check the latest stable version — do not guess versions from memory.

## Working agreements

- **Plan before building.** For each roadmap phase: propose the plan, wait for approval.
- **TDD for the harness**: every `verify-N` must FAIL on `lab-N-start` and PASS on
  `lab-N-solution`. CI enforces this matrix. Write the verify check before the fix.
- Conventional commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
  Solution commits: `fix(lab-N): <what participants fix>`.
- Comments explain *why*, not *what*.
- Participant-facing text (code, `labs/*/README.md`, Grafana dashboards) is in **English**.
- Budget: the whole compose must run in **< 4 GB RAM** and start in < 90 s after images
  are pulled. Measure it; report if exceeded.
- Must run on macOS (Docker Desktop, arm64), Linux (amd64) and Windows/WSL2. Multi-arch
  images only. No host-specific mounts (no docker socket, no `/var/lib/docker`).
- Keep it simple: no Kubernetes, no Helm, no cloud accounts. Docker Compose only.

## Commands (target contract — see docs/04)

```
make pull            # pre-pull all images (participants run this at home)
make up / down       # start / stop the stack
make reset           # wipe volumes, back to clean state
make lab N=2         # checkout lab-2-start + apply scenario profile
make solution N=2    # checkout lab-2-solution
make verify N=2      # run the automated check for lab 2
make load            # (re)start baseline traffic
```
