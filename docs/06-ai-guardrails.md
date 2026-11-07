# 06 — AI guardrails: coach mode for labs 1–4

## Goal

Labs 1–4 are solved **without AI**. Participants will have AI agents installed
(Claude Code, Copilot, Cursor, Codex…). Without guidance, an agent will happily read
`SOLUTION.md` and fix everything in 30 seconds. The repo ships a harness that turns
any agent into a **coach** during labs 1–4 and unlocks it in lab 5.

It's a **speed bump + honor system**, not DRM. Participants can bypass it; the point
is that the default path respects the exercise. Say this openly in the README and
the intro.

## Layers

| Layer | Agents covered | Strength |
|---|---|---|
| 1. `AGENTS.md` (instructions) | Codex, Cursor, Copilot, Claude Code (via import), most others | Soft |
| 2. Pointer files: `CLAUDE.md` (`@AGENTS.md`), `GEMINI.md`, `.github/copilot-instructions.md`, `.cursor/rules/workshop.mdc` (`alwaysApply: true`) | Agents that don't read AGENTS.md | Soft |
| 3. Claude Code hooks in `.claude/settings.json` | Claude Code | Hard-ish (blocks tool calls) |
| 4. `.lab-state` + Makefile | All (source of truth for the active lab) | — |
| 5. Social: README section + intro slide | Humans | — |

Pointer files that can't import must duplicate the core rules (keep them generated
from AGENTS.md by `scripts/agent-guard/sync-pointers.sh`, checked in CI).

## `.lab-state`

- Written by `make lab N=` / `make solution N=` / `make incident-5`. Git-ignored.
- Format (simple, greppable): `lab=3` on the first line, optionally `mode=start|solution`.
- Missing → treated as `lab=1` (locked).

## Claude Code hooks (`.claude/settings.json`, committed)

Scripts in `scripts/agent-guard/`, POSIX sh + `jq`-free if possible (use Node if
parsing JSON is needed — Node is already required).

**Bypass:** if `INCIDENT_LAB_AUTHOR=1` → exit 0 immediately, no output (authoring
mode, set in the git-ignored `.claude/settings.local.json`).
The name must **not** start with `OTEL_`: Claude Code strips `OTEL_*` variables from
the environment of hook processes (they configure its own telemetry), so an
`OTEL_`-prefixed bypass never reaches the hook.

### `UserPromptSubmit` → `prompt-reminder`

- lab < 5: emit additional context:
  `Coach mode active (lab N). Follow AGENTS.md: hints and questions only; no code for services/, observability/, scenarios/; don't read SOLUTION.md or authoring docs.`
- lab ≥ 5: emit `Agent mode (lab 5): follow labs/05-ai-mcp/README.md; ask before editing.`

### `PreToolUse` → `deny-edits`

Matcher: `Edit|Write|MultiEdit|NotebookEdit|Bash|Read` (plus MCP tools — see below).
For lab < 5, **deny** with a friendly reason when:

- **Edit/Write/MultiEdit/NotebookEdit** targets a path under `services/`,
  `observability/`, `scenarios/`.
- **Read** targets `labs/*/SOLUTION.md`, `docs/02-defects-catalog.md`,
  `docs/authoring/**`, `scenarios/incident-5/**`.
- **Bash** command matches write/peek patterns touching those paths or solutions:
  `sed -i`, `tee`, `>`/`>>` redirection, `git apply`, `patch`, `cp`/`mv` into
  protected dirs, `git checkout|switch|diff|show` with `lab-*-solution`,
  `make solution`, `cat`/`less`/`head` on the protected read paths.
  (Best effort; false negatives are acceptable, false positives on normal
  commands like `make up`, `docker compose logs`, `make verify` are NOT.)
- **MCP tools** for Grafana/Tempo/Loki/Prometheus (`mcp__grafana__*` or whatever
  name the `ai` profile registers) → deny before lab 5.

Deny reason shown to the agent/participant:
`Lab N is hands-on without AI 🙂 Ask me for a hint or a guiding question instead. Stuck? make solution N=N. The agent unlocks in lab 5.`

Use the official hook JSON contract (verify against current Claude Code docs before
implementing; expected shape for PreToolUse is
`hookSpecificOutput.permissionDecision: "deny"` + `permissionDecisionReason`, and
for UserPromptSubmit `hookSpecificOutput.additionalContext`).

### Tests (`scripts/agent-guard/test/`)

Table-driven: feed hook JSON payloads on stdin, assert decision. Cases at minimum:

| lab | tool | input | expected |
|---|---|---|---|
| 2 | Edit | `services/orders/src/checkout.ts` | deny |
| 2 | Edit | `README.md` | allow |
| 2 | Read | `labs/02-traces/SOLUTION.md` | deny |
| 2 | Read | `services/orders/src/checkout.ts` | allow (reading code is fine) |
| 2 | Bash | `make up` | allow |
| 2 | Bash | `docker compose logs orders` | allow |
| 2 | Bash | `sed -i 's/a/b/' services/orders/src/x.ts` | deny |
| 2 | Bash | `git diff lab-2-start lab-2-solution` | deny |
| 2 | Bash | `make solution N=2` | deny |
| 2 | mcp__grafana__query_loki_logs | — | deny |
| 5 | Edit | `services/catalog/src/pricing.ts` | allow |
| missing | Edit | `services/orders/src/x.ts` | deny |
| 2 + `INCIDENT_LAB_AUTHOR=1` | Edit | `services/orders/src/x.ts` | allow |

Run in CI.

## Participant-facing copy

- `README.md` section **"About AI assistants"**: what coach mode is, why (lab 5 is
  the payoff), that it's an honor system, and that environment problems are fair
  game for the agent.
- Intro slide (10' block): one line — "Labs 1–4: your eyes and Grafana. Lab 5: your
  agent and the same Grafana."

## Instructor note

If someone bypasses it, don't police. Ask them in lab 5 to compare how much faster
they understand what the agent is doing — that's the lesson.
