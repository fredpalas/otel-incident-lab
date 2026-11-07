#!/bin/sh
# Applies scenarios/lab-N.{env,toxics.json}: env defaults for services + Toxiproxy toxics.
set -eu
n=${1:?usage: apply-scenario.sh N}

if [ -f "scenarios/lab-$n.env" ]; then
  cp "scenarios/lab-$n.env" .env.scenario
else
  : > .env.scenario
fi

docker compose up -d --wait toxiproxy >/dev/null
docker compose --profile tools run --rm -q --entrypoint node verify apply-toxics.ts "$n"
