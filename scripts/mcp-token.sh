#!/bin/sh
# Lab 5: a least-privilege token for the agent. Creates (once) a Grafana service account
# with the Viewer role and a fresh token for it, written to .env.mcp (git-ignored).
# otel-lgtm no longer generates one itself (since 0.36). Grafana runs with anonymous
# admin for the workshop, so these API calls need no credentials.
# Only curl, grep and sed: participants' machines don't need Node or jq.
set -eu

grafana=${GRAFANA_URL:-http://localhost:3000}
name=workshop-agent
json='content-type: application/json'

account=$(curl -fsS "$grafana/api/serviceaccounts/search?query=$name" |
  grep -o "{[^{}]*\"name\":\"$name\"[^{}]*}" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2 || true)
if [ -z "$account" ]; then
  account=$(curl -fsS -X POST "$grafana/api/serviceaccounts" -H "$json" \
    -d "{\"name\":\"$name\",\"role\":\"Viewer\",\"isDisabled\":false}" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
fi

token=$(curl -fsS -X POST "$grafana/api/serviceaccounts/$account/tokens" -H "$json" \
  -d "{\"name\":\"$name-$(date +%s)-$$\"}" | grep -o '"key":"[^"]*"' | cut -d'"' -f4)
[ -n "$token" ] || { echo "❌ Grafana didn't return a token" >&2; exit 1; }

printf 'GRAFANA_SERVICE_ACCOUNT_TOKEN=%s\n' "$token" > .env.mcp
echo "🔑 Viewer token for service account '$name' written to .env.mcp"
