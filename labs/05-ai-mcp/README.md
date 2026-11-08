# Lab 5 — The same investigation, with an agent over MCP (25')

```sh
make lab N=5      # checkout lab-5-start: coach mode is off from here
make verify N=5   # tells you if you're done
```

Labs 1–4 built the telemetry and the habit of reading it. Now an AI agent gets the
same Grafana — through the [Grafana MCP server](https://github.com/grafana/mcp-grafana),
with a **read-only** (Viewer) token — and a support ticket it knows nothing about.

The instructor runs this as a **live demo**. If you have an MCP-capable agent (Claude
Code, Copilot CLI, VS Code, Cursor, opencode…), follow along on your laptop.

## Setup

```sh
make up           # if the stack isn't running
make mcp-token    # Grafana service account with the Viewer role → token in .env.mcp
```

The MCP server runs on demand in a container (`docker compose --profile ai run …`) and
talks to the agent over stdio. Configuration for your agent:

- **Claude Code**: `.mcp.json` at the repo root is picked up automatically (approve the
  `grafana` server when asked). Coach mode switched to agent mode with `make lab N=5`.
- **opencode**: `opencode.json` at the repo root (enabled on this checkpoint).
- **Copilot CLI**: `copilot --additional-mcp-config @labs/05-ai-mcp/copilot-mcp.json`.
- **VS Code / Cursor / others**: a stdio server with command
  `docker compose --profile ai run --rm -i -T mcp-grafana`, run from the repo root.

The agent can only **read** Grafana: the token is Viewer-only, so it can't edit
dashboards, alerts or data sources even if it tries.

## The demo

1. A regression ships (`make incident-5`, instructor only). It creates
   `../ticketing-platform`: the platform as a team would inherit it — the code with the
   regression, one "import" commit, no history to compare against. **Open your agent
   there.** Grafana is the only place to look for evidence. (`make up` back in this
   repo returns the stack to the workshop code.)
2. The agent gets the support message in [`PROMPT.md`](PROMPT.md): a customer and an
   error reference, nothing else.
3. Watch what it does: which tools it calls, what it queries, what it reads in the
   repo — and what it *would* need if your telemetry were missing.
4. It proposes a fix and waits for approval. Approve, apply, `make verify N=5`.
5. Contrast: the same prompt against `main` (no logs, no traces).
6. The agent's own work is telemetry too: Tempo → search `service.name = mcp-grafana`
   (`tools/call <tool>` spans).

## Wrap-up: from debugging to strategy

- **PII in telemetry.** Open any `fake-psp` span: what's in its attributes? You can't
  change a third party's instrumentation, but every span passes through *your*
  Collector. Make sure no personal data reaches the backend (`make verify N=5`).
- **RED from spans → one SLO and one alert** for checkout.
- **Sampling**: head vs tail, cost — and why `correlation_id` in logs survives it.
- **The Collector as a gateway**: redaction, routing, cost control.
- **Semantic conventions** are the contract between teams — and with agents
  (`code.function.name`, `code.file.path`).
- **Agent guardrails**: least-privilege token, human approval before changes, query
  cost limits, an audit trail in its own traces.

<details>
<summary>Hint — personal data in the Collector</summary>

The `redaction` processor (contrib) can mask attribute values that match a pattern
(`blocked_values`) or whole keys (`blocked_key_patterns`). Put it in the `traces`
pipeline, before `batch`.

</details>
