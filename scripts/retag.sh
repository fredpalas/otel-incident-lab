#!/bin/sh
# Authoring only: re-create lab-N-start / lab-N-solution tags from the commit message
# markers [lab-N-start] / [lab-N-solution] on solution-path, after a history rewrite.
# Moves tags locally; pushing them is a separate, deliberate step:
#   git push --force origin 'refs/tags/lab-*'
set -eu

branch=${1:-solution-path}

git log --format='%H %B' "$branch" | grep -oE '^[0-9a-f]{40}|\[lab-[0-9]+-(start|solution)\]' | {
  sha=''
  while read -r token; do
    case "$token" in
      \[lab-*) tag=$(echo "$token" | tr -d '[]'); git tag -f "$tag" "$sha" >/dev/null; echo "$tag → $(git rev-parse --short "$sha")" ;;
      *) sha=$token ;;
    esac
  done
}
