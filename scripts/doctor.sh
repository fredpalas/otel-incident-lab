#!/bin/sh
# Environment check. Everything here is fair game for an AI assistant to help with.
set -u
ok=0
check() { if eval "$2" >/dev/null 2>&1; then echo "✅ $1"; else echo "❌ $1 — $3"; ok=1; fi; }

check "docker is installed" "docker version" "install Docker Desktop (or Docker Engine on Linux)"
check "docker daemon is running" "docker info" "start Docker Desktop"
check "docker compose v2" "docker compose version" "update Docker"
check "git is installed" "git --version" "install git"
check "curl is installed" "curl --version" "install curl"

mem_bytes=$(docker info --format '{{.MemTotal}}' 2>/dev/null || echo 0)
mem_gb=$((mem_bytes / 1024 / 1024 / 1024))
if [ "$mem_gb" -ge 4 ]; then echo "✅ Docker has ${mem_gb} GB RAM"; else echo "❌ Docker has ${mem_gb} GB RAM — give Docker at least 4 GB"; ok=1; fi

for port in 3000 4317 4318 8080 8474 15672; do
  if [ -n "$(docker ps -q --filter publish="$port" --filter label=com.docker.compose.project=otel-incident-lab 2>/dev/null)" ]; then
    echo "✅ port $port (used by this stack)"
  elif (echo > /dev/tcp/127.0.0.1/$port) 2>/dev/null || nc -z 127.0.0.1 "$port" 2>/dev/null; then
    echo "❌ port $port is busy — stop whatever is using it"; ok=1
  else
    echo "✅ port $port free"
  fi
done

missing=$(docker compose --profile tools --profile load config --images 2>/dev/null | sort -u | while read -r img; do
  docker image inspect "$img" >/dev/null 2>&1 || echo "$img"; done)
if [ -z "$missing" ]; then echo "✅ all images present"; else echo "❌ missing images — run: make pull"; echo "$missing" | sed 's/^/   /'; ok=1; fi

exit $ok
