#!/bin/sh
# Lab 5 (instructor): ship the unknown regression the agent has to find, the way it would
# meet it in a legacy codebase — no history to compare against, only the telemetry.
#
# usage: incident-5.sh [BASE] [DIR]
#   BASE  git ref whose code becomes the "legacy" platform (default: HEAD).
#         BASE=main gives the contrast: the same incident with no telemetry at all.
#   DIR   where to put it (default: ../ticketing-platform)
#
# DIR gets the code of BASE with the regression applied, minus anything that describes
# the incident, and a single "import" commit: no tags, no branches, no diff to read.
# The compose project name is the same, so it drives the same stack. Open the agent in
# DIR; `make up` back in the workshop repo returns the stack to it.
set -eu

base=${1:-HEAD}
dest=${2:-../ticketing-platform}
src=$(pwd)
marker=.incident-5

# A fresh clone may only have origin/main.
if ! git rev-parse -q --verify "$base^{commit}" >/dev/null; then
  if git rev-parse -q --verify "origin/$base^{commit}" >/dev/null; then
    base="origin/$base"
  else
    echo "❌ unknown git ref: $base" >&2
    exit 1
  fi
fi

if [ -e "$dest" ]; then
  if [ ! -e "$dest/$marker" ]; then
    echo "❌ $dest exists and wasn't created by incident-5; choose another DIR" >&2
    exit 1
  fi
  rm -rf "$dest"
fi
mkdir -p "$dest"

# Same file modes as a checkout: BuildKit keys its layer cache on them, and a cache miss
# would need the network (npm, composer) to rebuild.
git -c tar.umask="$(umask)" archive "$base" | tar -x -C "$dest"
cd "$dest"
git init -q
echo "$marker" >> .git/info/exclude
git apply "$src/scenarios/incident-5/regression.patch"
rm -rf scenarios/incident-5 docs/02-defects-catalog.md docs/authoring \
  labs/05-ai-mcp/INSTRUCTOR.md labs/05-ai-mcp/SOLUTION.md
for f in .env.mcp .env.scenario .mcp.json; do
  if [ -f "$src/$f" ] && [ ! -e "$f" ]; then cp "$src/$f" .; fi
done
printf 'lab=5\nmode=incident\n' > .lab-state
touch "$marker"
git add -A
git -c user.name="Ticketing team" -c user.email="team@ticketing.example" commit -q -m "Import ticketing platform"

docker compose up -d --build --wait >/dev/null 2>&1 || { echo "❌ the stack didn't start from $dest" >&2; exit 1; }
# Some compose versions keep the old orders container: make sure it runs the new code.
docker compose up -d --no-deps --force-recreate --wait orders >/dev/null 2>&1
if ! docker compose exec -T orders grep -q LOYALTY_RATES dist/orders/domain/LoyaltyTier.js; then
  echo "❌ orders is still running the old code" >&2
  exit 1
fi
echo "🔥 incident-5 is live in $dest. Open your agent there and give it labs/05-ai-mcp/PROMPT.md."
