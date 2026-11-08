# Lab 5 — Instructor notes (spoilers: agents are denied reading this file)

**incident-5**: `make incident-5` creates `../ticketing-platform`, a "legacy" copy of
the code (one import commit, no tags or history, no spoiler files) where a "refactor"
of `services/orders/src/orders/domain/LoyaltyTier.ts` moved the discounts into a rate
table and forgot the `gold` entry. The stack is rebuilt from that copy. Every **gold** customer's checkout (registered
customers whose number ends in 0: `cus_10`, `cus_20`, …) fails with
`TypeError: Cannot read properties of undefined (reading 'rate')` in orders → 500 →
gateway 502. No order is created. ~10 % of the baseline's checkouts.

**D9**: fake-psp (third party) puts `customer.email` and `card.last4` on its spans.
Fixed in the Collector with a `redaction` processor (wrap-up, live).

## Before the session

- `make pull` at home includes the `mcp-grafana` image (profile `ai`).
- `make lab N=5`, `make up`, `make mcp-token`, `make load` (let it run a few minutes so
  the dashboards have history).
- Check the agent sees the server: Claude Code `/mcp` → `grafana` connected.
- Record a fallback video of the whole demo (network or LLM may fail on the day).

## Timing (25')

| Min | What |
|---|---|
| 0–2 | Setup on screen: Viewer token, `.mcp.json`, coach mode off (`.lab-state lab=5`). |
| 2–3 | `make incident-5` (don't show the output), `cd ../ticketing-platform`, open the agent there. `make repro N=5` → copy a reference from a `cus_…0` customer. |
| 3–13 | Paste `PROMPT.md`. Narrate every tool call. Pause when it finds the error trace and the exception. |
| 13–16 | It proposes the fix and stops. Approve. It edits, rebuilds, `make verify N=5`. |
| 16–18 | Contrast: `make reset` first (old telemetry would mislead the agent — it happened in a rehearsal), then `make incident-5 BASE=main DIR=../ticketing-platform-main` (same incident, no telemetry, no history), same prompt (or describe it from the rehearsal notes below). `make up` in the workshop repo afterwards. |
| 18–19 | The agent's own trace in Tempo (`service.name = mcp-grafana`). |
| 19–25 | Wrap-up: D9 live (add `redaction`, `make up`, show a PSP span), SLO, sampling, gateway Collector, semconv, guardrails. |

## Expected agent path

correlation_id (the reference) → Loki: gateway `checkout failed: upstream error` with
`trace_id` → Tempo trace → orders span `CheckoutService.placeOrder` in ERROR with the
`TypeError` exception and stack (`LoyaltyTier.discountPercent`), `customer.tier=gold`,
`code.file.path` → reads `LoyaltyTier.ts` → adds `gold: { rate: 0.1 }` (or reverts the
table) → verifies.

Orders itself logs nothing for this error (unknown errors only go to the span): the
trace is what carries the evidence. That's a good point to make.

## Fixes

- incident-5: restore the gold rate (`gold: { rate: 0.1 }`); the orders unit test for
  gold discounts fails on the regression too.
- D9: see `SOLUTION.md`.

## Rehearsal notes (8 Nov 2026)

| Run | Agent | Investigation | Fix + verify | Root cause |
|---|---|---|---|---|
| 1 | Claude Code (`claude -p`) | 64 s, 19 tool calls, $0.75 | applied, but ran `make verify` before rebuilding orders; then `make up` → gold 5/5 | ✅ |
| 2 | Claude Code | 112 s, 16 calls, $0.64 | `make up` → verify gold 5/5, error rate back to ~4 % | ✅ (also typed the table `Record<Tier, …>`) |
| 3 | Copilot CLI, default model, *without* the telemetry conventions in AGENTS.md | 82 s | — | ❌ blamed the PSP timeout |
| 4 | Copilot CLI, with the conventions | 31 s | applied + unit test, `make up`, gold 4/5 | ✅ |
| contrast (old) | Claude Code on `main` with history | 87 s | — | found it from `git show HEAD` — why `make incident-5` now builds a legacy copy |
| 5 | Claude Code in the **legacy copy** | 59 s, 11 calls, $0.60 | — | ✅ first query already filtered by `correlation_id`; `git log` only showed the import commit |
| contrast | Claude Code in a legacy copy of `main` (no telemetry, no history) | 110 s, 28 calls, $0.76 | — | ✅ but the long way: no link from the reference to anything; queried the **business Postgres through Grafana's datasource** (0 orders from gold customers), then read the code and ran the failing test |

What we learned:

- **The reference is structured metadata.** Every agent first searched the
  reference as text in the log line (`|= "…"`) and got nothing. Claude recovered by
  sampling error logs and spotting `correlation_id`; Copilot (smaller model) never did,
  latched onto the most visible errors (the PSP's normal long-tail timeouts) and
  proposed raising the timeout. Since then `AGENTS.md` (lab 5 section) carries a short
  **telemetry conventions** block. That's the wrap-up point in practice: semantic
  conventions are the contract with your agents.
- **Time-to-root-cause with telemetry: ~1–2 minutes**, always via reference →
  gateway log → `trace_id` → orders span exception → `code.file.path`.
- **The commit history was a shortcut** (the agent just read the latest commit), so
  `make incident-5` now builds a legacy copy with one import commit. With it, the
  contrast is real: twice the time, 2.5× the tool calls, no evidence chain from the
  customer's reference, and no telemetry to verify a fix — the agent had to infer from
  business data and code.
- **A Viewer token still reads every data source.** In the contrast the agent used
  `grafana_api_request` to run SQL against the business Postgres through Grafana. Good
  wrap-up material: least privilege is also about *which data sources* the agent's
  account can query, not only "can't edit dashboards".
- **Rebuild before verify**: the approval prompt says `make up` explicitly now.
- **Side findings the agents raised on their own**: seats stay reserved when orders
  fails after inventory reserved them (true since lab 1, discussed in lab 3), and the
  gold unit test was failing on the regression commit.
- Agents can't run the services' unit tests outside CI without `pnpm install` and
  `TEST_DATABASE_URL`; that's fine — the telemetry is the verification here.
- Each agent's tool calls are in Tempo (`service.name = mcp-grafana`, roots
  `tools/call <tool>`).

## If the group is behind

It's a demo: nothing to catch up on. If time is short, skip the contrast run (describe
the rehearsal numbers: 59 s / 11 tool calls with telemetry vs 110 s / 28 without) and
keep the D9 redaction (4 s rebuild of the Collector) and the agent's own trace.

## If it goes wrong

| Symptom | Fix |
|---|---|
| Agent says it has no Grafana tools | `make mcp-token`, restart the agent, approve the project MCP server. |
| `grafana` server fails to start | Is the stack up? `docker compose --profile ai run --rm -i -T mcp-grafana` by hand shows the error. |
| Agent edits before approval | Stop it, point at the prompt ("Don't change anything until I approve"). Claude Code: run it in plan mode. |
| Agent compares against the workshop repo (`../otel-incident-lab`) | Outside its project dir; Claude Code asks before reading there — say no. |
