#!/bin/sh
# Every image the workshop pulls is pinned by digest: the same bytes on every laptop,
# whatever happens to the tag between `make pull` at home and the session.
set -eu
cd "$(dirname "$0")/.."

status=0
for f in docker-compose.yml services/*/Dockerfile verify/Dockerfile .devcontainer/devcontainer.json; do
  [ -f "$f" ] || continue
  # Locally built images (otel-incident-lab/…) need no digest.
  grep -nE '^\s*(image:|FROM )|"image":' "$f" | grep -v 'otel-incident-lab/' | grep -v '@sha256:' |
    while IFS= read -r line; do echo "❌ $f:$line — pin it by digest (tag@sha256:…)"; done | grep . && status=1
done
[ "$status" -eq 0 ] && echo "✅ every image is pinned by digest"
exit "$status"
