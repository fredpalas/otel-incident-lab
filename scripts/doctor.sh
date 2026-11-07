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

# Loki silently stops ingesting logs when Docker's disk is more than 90 % full.
# Images are pinned by digest: use the exact reference compose pulls (works offline).
probe=$(docker compose config --images 2>/dev/null | grep '^postgres:' | head -1)
disk_pct=$(docker run --rm --entrypoint df "$probe" -P / 2>/dev/null | awk 'NR==2 {gsub("%","",$5); print $5}')
if [ -z "$disk_pct" ]; then
  echo "❌ could not measure Docker's disk usage — run: make pull"; ok=1
elif [ "$disk_pct" -lt 85 ]; then
  echo "✅ Docker disk ${disk_pct}% used"
else
  echo "❌ Docker disk ${disk_pct}% used — free space (docker system prune) or grow the Docker disk; Loki stops accepting logs above 90 %"; ok=1
fi

for port in 3000 4317 4318 8025 8080 8474 15672; do
  if [ -n "$(docker ps -q --filter publish="$port" --filter label=com.docker.compose.project=otel-incident-lab 2>/dev/null)" ]; then
    echo "✅ port $port (used by this stack)"
  elif (echo > /dev/tcp/127.0.0.1/$port) 2>/dev/null || nc -z 127.0.0.1 "$port" 2>/dev/null; then
    echo "❌ port $port is busy — stop whatever is using it"; ok=1
  else
    echo "✅ port $port free"
  fi
done

# Windows: the repo must live inside WSL2, with LF line endings.
if grep -qi microsoft /proc/version 2>/dev/null; then
  case "$(pwd)" in
    /mnt/*) echo "❌ the repo is under $(pwd) (Windows filesystem) — clone it inside WSL (e.g. ~/otel-incident-lab): bind mounts from /mnt/c are slow and miss file changes"; ok=1 ;;
    *) echo "✅ repo inside the WSL filesystem" ;;
  esac
fi
if git ls-files --eol 2>/dev/null | grep -q 'w/crlf'; then
  echo "❌ some files were checked out with CRLF line endings — re-clone with: git -c core.autocrlf=false clone …"; ok=1
else
  echo "✅ line endings are LF"
fi

missing=$(docker compose --profile tools --profile load --profile ai config --images 2>/dev/null | sort -u | while read -r img; do
  docker image inspect "$img" >/dev/null 2>&1 || echo "$img"; done)
if [ -z "$missing" ]; then echo "✅ all images present"; else echo "❌ missing images — run: make pull"; echo "$missing" | sed 's/^/   /'; ok=1; fi

exit $ok
