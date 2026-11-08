# 05 — Lab 5: the same investigation, with an agent over MCP

## Format

Instructor-led **live demo** (the trainer's machine + projector). Optional hands-on
for participants who already have an MCP-capable agent (Claude Code, VS Code
Copilot, Cursor…). Labs 1–4 stay AI-free and cost-free.

## Setup (compose profile `ai`)

- `mcp-grafana` (`grafana/mcp-grafana:2.2.0`) as a compose service in profile `ai`
  (defined since `lab-1-start` so `make pull` caches the image), run **on demand over
  stdio** by the agent: `docker compose --profile ai run --rm -i -T mcp-grafana`.
  stdio avoids the caller token the HTTP transports require.
- Auth: Grafana **service account with Viewer role** — least privilege. otel-lgtm
  stopped creating `/tmp/grafana-sa-token` in v0.36.0, so `make mcp-token`
  (`scripts/mcp-token.sh`) creates the `workshop-agent` service account and a token
  through the Grafana HTTP API and writes `GRAFANA_SERVICE_ACCOUNT_TOKEN` to `.env.mcp`
  (git-ignored). A write attempt (`update_dashboard`) gets a 403.
- `.mcp.json` (Claude Code), `opencode.json` (unlocked on `lab-5-start`),
  `labs/05-ai-mcp/copilot-mcp.json` (Copilot CLI `--additional-mcp-config`).
- `mcp-grafana` exports its own traces and logs over OTLP/gRPC to the Collector, so the
  agent's tool calls appear in Tempo (`tools/call <tool>` spans, `gen_ai.tool.name`).
- Tempo's own MCP server: not enabled — mcp-grafana's Tempo tools (TraceQL search,
  `get_tempo_trace`, attribute names/values) covered everything the rehearsals needed.

## Demo flow (≈ 15')

1. `make incident-5` (unknown regression — see catalog). It creates
   `../ticketing-platform`: the code with the regression, a single import commit (no
   tags, no history to diff), spoiler files removed; the stack runs from it. Open the
   agent there. Show nothing to the room.
2. `make repro N=5` prints failed checkouts with the error reference the customer saw
   (`X-Correlation-Id`). Give the agent the support message from
   `labs/05-ai-mcp/PROMPT.md`: a customer id and that reference (the failing checkout
   never creates an order, so there is no order id), plus "Investigate using Grafana…
   propose a minimal fix… Don't change anything until I approve."
3. Expected agent path: reference = correlation_id → Loki gateway error log →
   `trace_id` → error trace with exception + stack → `code.function.name` /
   `code.file.path` → reads the code → proposes patch.
4. Human approves → apply → `make verify N=5` → agent re-checks error rate via PromQL.
5. **The contrast**: `make incident-5 BASE=main DIR=../ticketing-platform-main` — same
   incident, same "legacy" shape, no instrumentation. Same prompt. Point: *the agent is
   only as good as your telemetry.* (Rehearsals showed that with commit history an agent
   finds the cause by diffing; the legacy copy removes that shortcut.)
6. Show the agent's own trace in Tempo.

## Wrap-up (≈ 10') — from debugging to strategy

- RED metrics from spans (spanmetrics) → one SLO + alert for checkout.
- Sampling: head vs tail, cost; why `correlation_id` in logs survives sampling.
- Collector as a gateway: redaction (D9 live: add `redaction` processor, PII gone),
  routing, cost control.
- Semantic conventions as the contract between teams (and with agents).
- Agent guardrails: Viewer-only token, human approval for code changes, query cost
  guardrails, audit trail via its own traces.

## Fallback

Record the demo beforehand (screen capture). If network/LLM fails on the day, play
the recording and narrate.
