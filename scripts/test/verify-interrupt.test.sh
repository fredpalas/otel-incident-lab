#!/bin/sh
# Ctrl+C on `make verify` must stop it at once and leave the lab's scenario in Toxiproxy.
# Node runs as PID 1 in the verify container, where SIGINT is ignored unless handled:
# participants pressed Ctrl+C during a 30 s Loki poll and nothing happened.
# Needs the stack up on lab-1-start (`make lab N=1`), where that poll always times out.
set -eu
cd "$(dirname "$0")/../.."

name=verify-interrupt-test
toxics() { curl -sf localhost:8474/proxies/psp/toxics; }

before=$(toxics)
docker rm -f "$name" >/dev/null 2>&1 || true
docker compose --profile tools run --build -q -d --name "$name" verify 1 >/dev/null
sleep 12 # warm-up and the first checks; then the Loki poll runs for 30 s

started=$(date +%s)
docker kill -s INT "$name" >/dev/null
code=$(docker wait "$name")
elapsed=$(($(date +%s) - started))
docker rm "$name" >/dev/null

fail=0
[ "$elapsed" -le 5 ] || { echo "❌ verify took ${elapsed}s to stop after SIGINT"; fail=1; }
[ "$code" = 130 ] || { echo "❌ verify exited with $code after SIGINT, expected 130"; fail=1; }
[ "$(toxics)" = "$before" ] || { echo "❌ psp toxics changed: $before → $(toxics)"; fail=1; }
[ "$fail" = 0 ] && echo "✅ verify stops on SIGINT and restores the scenario"
exit "$fail"
