#!/bin/sh
# Regenerates the pointer files for agents that don't read AGENTS.md (docs/06, layer 2).
# usage: sync-pointers.sh          → write files
#        sync-pointers.sh --check  → exit 1 if any file is out of date (CI)
set -eu
cd "$(dirname "$0")/../.."

header='<!-- Generated from AGENTS.md by scripts/agent-guard/sync-pointers.sh — do not edit by hand. -->'

render() {
  case "$1" in
    .cursor/rules/workshop.mdc)
      printf -- '---\ndescription: Workshop rules for AI agents (coach mode in labs 1-4)\nalwaysApply: true\n---\n\n' ;;
  esac
  printf '%s\n\n' "$header"
  cat AGENTS.md
}

status=0
for target in GEMINI.md .github/copilot-instructions.md .cursor/rules/workshop.mdc; do
  if [ "${1:-}" = "--check" ]; then
    if ! render "$target" | cmp -s - "$target"; then
      echo "❌ $target is out of date — run scripts/agent-guard/sync-pointers.sh"
      status=1
    fi
  else
    mkdir -p "$(dirname "$target")"
    render "$target" > "$target"
    echo "wrote $target"
  fi
done
exit $status
