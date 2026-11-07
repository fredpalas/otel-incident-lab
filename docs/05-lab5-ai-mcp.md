# 05 — Lab 5: the same investigation, with an agent over MCP

## Format

Instructor-led **live demo** (the trainer's machine + projector). Optional hands-on
for participants who already have an MCP-capable agent (Claude Code, VS Code
Copilot, Cursor…). Labs 1–4 stay AI-free and cost-free.

## Setup (compose profile `ai`)

- `mcp-grafana` (official Grafana MCP server) pointed at the local Grafana.
- Auth: Grafana **service account with Viewer role** — least privilege. otel-lgtm
  stopped creating `/tmp/grafana-sa-token` in v0.36.0 (see upstream
  `docs/gcx-migration.md`), so `make mcp-token` creates the Viewer service account and
  token through the Grafana HTTP API and writes it to `.env.mcp` (git-ignored).
- Optional: Tempo's own MCP server (`TEMPO_EXTRA_ARGS=--query-frontend.mcp-server.enabled=true`
  on otel-lgtm) — evaluate whether it adds value over mcp-grafana's Tempo tools.
- `.mcp.json` at repo root, ready for Claude Code; `labs/05-ai-mcp/README.md` shows
  the equivalent config for other clients.
- `mcp-grafana` exports its own traces to the Collector, so the agent's tool calls
  appear in Tempo (`tools/call <tool>` spans, `gen_ai.tool.name`).

## Demo flow (≈ 15')

1. `make incident-5` (unknown regression — see catalog). Show nothing to the room.
2. Give the agent the support message from `labs/05-ai-mcp/PROMPT.md`:
   > "Customer reports order `ord_456` failed at checkout. Investigate using Grafana
   > (logs, traces, metrics). Find the root cause in this repo, propose a minimal fix,
   > and tell me how you'll verify it. Don't change anything until I approve."
3. Expected agent path: correlation_id → error trace → logs with stack →
   `code.function.name` / `code.file.path` → reads the code → proposes patch.
4. Human approves → apply → `make verify N=5` → agent re-checks error rate via PromQL.
5. **The contrast**: run the same prompt against `main` (no instrumentation). The agent
   flounders or guesses. Point: *the agent is only as good as your telemetry.*
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
