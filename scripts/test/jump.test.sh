#!/bin/sh
# Safe-jump contract (docs/04): dirty tree → jump → jump back → no work lost, no detached HEAD.
set -eu

here=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cd "$tmp"

failures=0
assert() { if eval "$2"; then echo "  ✅ $1"; else echo "  ❌ $1"; failures=$((failures + 1)); fi; }

git init -q -b main
git config user.email test@example.com
git config user.name test
printf '.env*\n.lab-state\n' > .gitignore
echo start > app.txt
git add -A && git commit -q -m start && git tag lab-1-start
echo solution > app.txt
git commit -qam solution && git tag lab-1-solution
git switch -q main && git reset -q --hard lab-1-start
git switch -q -c my/lab-1

echo "participant edit" > app.txt
echo "new file" > notes.txt
echo "SECRET=1" > .env.local

echo "jump to solution with a dirty tree"
sh "$here/jump.sh" solution 1 >/dev/null
assert "on branch solution/lab-1" '[ "$(git branch --show-current)" = solution/lab-1 ]'
assert "tree has the solution" '[ "$(cat app.txt)" = solution ]'
assert ".lab-state says lab 1 solution" '[ "$(cat .lab-state)" = "$(printf "lab=1\nmode=solution")" ]'
assert "git-ignored .env untouched" '[ "$(cat .env.local)" = SECRET=1 ]'
assert "wip commit on my/lab-1 has the tracked edit" '[ "$(git show my/lab-1:app.txt)" = "participant edit" ]'
assert "wip commit on my/lab-1 has the untracked file" '[ "$(git show my/lab-1:notes.txt)" = "new file" ]'
assert "wip commit message" 'git log -1 --format=%s my/lab-1 | grep -q "^wip: before jump to lab-1-solution"'
assert "tags never move" '[ "$(git rev-parse lab-1-start)" = "$(git rev-parse main)" ]'

echo "jump back to the lab start"
sh "$here/jump.sh" lab 1 >/dev/null
assert "existing my/lab-1 is not reused: my/lab-1-2" '[ "$(git branch --show-current)" = my/lab-1-2 ]'
assert "tree is the pristine start" '[ "$(cat app.txt)" = start ] && [ ! -f notes.txt ]'
git switch -q my/lab-1
assert "previous work is back" '[ "$(cat app.txt)" = "participant edit" ] && [ "$(cat notes.txt)" = "new file" ]'

echo "dirty detached HEAD is saved on a wip branch"
git switch -q --detach lab-1-start
echo detached > app.txt
sh "$here/jump.sh" solution 1 >/dev/null
assert "a wip/* branch holds the detached work" '[ "$(git show "$(git branch --list "wip/*" --format="%(refname:short)")":app.txt)" = detached ]'
assert "not detached after jump" '[ -n "$(git branch --show-current)" ]'

echo "works without a git identity"
git config --unset user.email
echo "no identity" > app.txt
assert "jump succeeds" 'HOME="$tmp" GIT_CONFIG_NOSYSTEM=1 sh "$here/jump.sh" lab 1 >/dev/null'

echo "unknown tag fails cleanly"
assert "exit non-zero" '! sh "$here/jump.sh" lab 9 >/dev/null 2>&1'

[ "$failures" -eq 0 ] && echo "jump: all assertions passed" || { echo "jump: $failures failure(s)"; exit 1; }
