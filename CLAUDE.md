# CLAUDE.md

@AGENTS.md

## Claude Code specifics

- Hooks in `.claude/settings.json` enforce coach mode for labs 1–4: edits to
  `services/`, `observability/` and `scenarios/` are blocked, and every prompt
  carries a reminder of the active lab. If a tool call is denied by the
  `agent-guard` hook, do not try to work around it (no `sed`, `tee`, shell
  redirection, `git apply` or alternative tools to achieve the same edit).
  Explain to the participant and offer a hint instead.
- From lab 5, the hooks allow edits, but still ask for approval before changing files.
