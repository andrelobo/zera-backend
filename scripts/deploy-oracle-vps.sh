#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env in $PROJECT_ROOT"
  exit 1
fi

docker_cmd=(docker)
if ! docker info >/dev/null 2>&1; then
  if command -v sudo >/dev/null 2>&1 && sudo -n docker info >/dev/null 2>&1; then
    docker_cmd=(sudo docker)
  else
    echo "Docker is not available for the current user."
    exit 1
  fi
fi

if ! "${docker_cmd[@]}" compose version >/dev/null 2>&1; then
  if command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y docker-compose-plugin
  else
    echo "Docker Compose plugin is unavailable and cannot be installed automatically."
    exit 1
  fi
fi

"${docker_cmd[@]}" compose up -d --build

app_port="$(sed -n 's/^APP_PORT=//p' .env | head -n 1)"
app_port="${APP_PORT:-${app_port:-3000}}"
health_url="http://127.0.0.1:${app_port}/health"

health_ok=0
for _attempt in $(seq 1 30); do
  if command -v curl >/dev/null 2>&1; then
    if curl -fsS "$health_url" >/dev/null; then
      health_ok=1
      break
    fi
  elif wget -qO- "$health_url" >/dev/null 2>&1; then
    health_ok=1
    break
  fi

  sleep 2
done

if [[ "$health_ok" -ne 1 ]]; then
  echo "Health check failed for $health_url"
  "${docker_cmd[@]}" compose ps || true
  "${docker_cmd[@]}" compose logs --tail=200 api || true
  exit 1
fi

echo "Deploy finished successfully."
