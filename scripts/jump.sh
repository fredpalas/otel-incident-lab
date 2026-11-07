#!/bin/sh
# Safe jump to a lab checkpoint: never discards work, never leaves a detached HEAD.
# usage: scripts/jump.sh lab|solution <N>
set -eu

kind=${1:?usage: jump.sh lab|solution N}
n=${2:?usage: jump.sh lab|solution N}

case "$kind" in
  lab) tag="lab-$n-start"; base="my/lab-$n"; mode=start ;;
  solution) tag="lab-$n-solution"; base="solution/lab-$n"; mode=solution ;;
  *) echo "unknown kind: $kind" >&2; exit 2 ;;
esac

if ! git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
  echo "❌ Tag $tag not found. Try: git fetch --tags" >&2
  exit 1
fi

# Participants' laptops may have no git identity; a wip commit must not fail for that.
gitc() {
  if [ -z "$(git config user.email || true)" ]; then
    git -c user.name="Workshop participant" -c user.email="participant@otel-incident-lab.local" "$@"
  else
    git "$@"
  fi
}

ts=$(date +%Y%m%d-%H%M%S)
prev=$(git branch --show-current)

if [ -n "$(git status --porcelain)" ]; then
  if [ -z "$prev" ]; then
    prev="wip/$ts"
    git switch -q -c "$prev"
  fi
  git add -A
  gitc commit -q --no-verify -m "wip: before jump to $tag ($ts)"
  echo "💾 Saved your uncommitted work on branch '$prev'."
fi
[ -n "$prev" ] || prev=$(git rev-parse --short HEAD)

branch=$base
i=2
while git rev-parse -q --verify "refs/heads/$branch" >/dev/null; do
  branch="$base-$i"
  i=$((i + 1))
done

git switch -q -c "$branch" "$tag"
printf 'lab=%s\nmode=%s\n' "$n" "$mode" > .lab-state

echo "✅ Now on branch '$branch' (from tag $tag)."
echo "   Back to your previous work:  git switch $prev"
echo "   Your changes vs. the start:  git diff lab-$n-start"
