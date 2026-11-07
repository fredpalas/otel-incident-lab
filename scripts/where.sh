#!/bin/sh
set -eu
lab=1; mode=start
if [ -f .lab-state ]; then
  lab=$(sed -n 's/^lab=//p' .lab-state); mode=$(sed -n 's/^mode=//p' .lab-state)
fi
echo "Lab:      ${lab} (${mode:-start})"
echo "Branch:   $(git branch --show-current 2>/dev/null || echo '?')"
echo "Scenario: $( [ -f .env.scenario ] && head -n1 .env.scenario || echo 'none (defaults)')"
dirty=$(git status --short)
if [ -n "$dirty" ]; then echo "Changed files:"; echo "$dirty" | sed 's/^/  /'; else echo "Changed files: none"; fi
