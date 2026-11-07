# ADR-0004: Enforce a coach mode for AI agents in labs 1–4

**Date**: 2026-11-07
**Status**: Accepted
**Deciders**: Workshop lead trainer
**Triggered by**: Workshop design

---

## Context

Most senior participants will have an AI coding agent in their editor or terminal.
Labs 1–4 teach manual investigation with Grafana; an agent with repo access can read
`SOLUTION.md` or the tag diffs and solve a lab instantly, removing the learning and
spoiling the lab 5 contrast ("the agent is only as good as your telemetry").

## Options Considered

### Option A — Just ask people not to use AI
- **Pros**: zero work.
- **Cons**: agents read the repo by default; many participants will use them
  reflexively.

### Option B — Strip solutions and docs from participant tags
- **Pros**: nothing to leak.
- **Cons**: breaks `make solution` (needed so nobody falls behind); agents can still
  write the fix from scratch.

### Option C — Layered coach-mode harness
`AGENTS.md` + pointer files for every major agent, Claude Code hooks that block
edits/peeks before lab 5, `.lab-state` as source of truth, honest README copy.
- **Pros**: agents stay useful (concepts, env problems, hints); default path respects
  the exercise; lab 5 unlocks naturally.
- **Cons**: soft for non-Claude agents; bypassable; hook maintenance.

## Decision

**Option C.** It keeps the agent as a helpful coach instead of banning it, and makes
the transition to lab 5 explicit. We accept it is an honor system.

Authoring is separated: builder context lives in `docs/authoring/` and is loaded via
the git-ignored `CLAUDE.local.md`; `OTEL_LAB_AUTHOR=1` in the git-ignored
`.claude/settings.local.json` bypasses the hooks.

## Operational Consequences

- **Infrastructure**: none.
- **CI/CD**: hook tests + pointer-file sync check.
- **Security**: none (honor system); hooks never block environment commands.
- **Rollback plan**: delete `.claude/settings.json` hooks; AGENTS.md alone remains.

## Success Criteria

- Dry run: with Claude Code and Copilot, asking "fix lab 2" yields a hint, not code.
- Zero false positives on `make` / `docker compose` commands in the dry run.
