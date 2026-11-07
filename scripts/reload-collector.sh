#!/bin/sh
# docker compose doesn't notice edits to a bind-mounted file, so a changed
# observability/collector/config.yaml would be ignored until the next restart.
# Restart the Collector when the file changed since we last saw it, or when a
# previous (broken) config left it stopped.
set -eu

config=observability/collector/config.yaml
state=.collector-config.cksum
sum=$(cksum < "$config")
running() { [ -n "$(docker compose ps -q --status running otel-collector)" ]; }

if { [ -f "$state" ] && [ "$(cat "$state")" != "$sum" ]; } || ! running; then
  docker compose restart otel-collector >/dev/null
  sleep 2
  if ! running; then
    echo "❌ otel-collector doesn't start with $config:" >&2
    docker compose logs --tail 20 otel-collector >&2
    exit 1
  fi
  echo "🔁 Collector config changed — otel-collector restarted"
fi
echo "$sum" > "$state"
