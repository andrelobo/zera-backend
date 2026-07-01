#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env in $PROJECT_ROOT"
  exit 1
fi

read_env_value() {
  local key="$1"
  sed -n "s/^${key}=//p" .env | head -n 1
}

docker_cmd=(docker)
if ! docker info >/dev/null 2>&1; then
  if command -v sudo >/dev/null 2>&1 && sudo -n docker info >/dev/null 2>&1; then
    docker_cmd=(sudo docker)
  else
    echo "Docker is not available for the current user."
    exit 1
  fi
fi

app_port="$(sed -n 's/^APP_PORT=//p' .env | head -n 1)"
app_port="${APP_PORT:-${app_port:-3000}}"
docker_dns_1="$(read_env_value DOCKER_DNS_1)"
docker_dns_1="${DOCKER_DNS_1:-${docker_dns_1:-1.1.1.1}}"
docker_dns_2="$(read_env_value DOCKER_DNS_2)"
docker_dns_2="${DOCKER_DNS_2:-${docker_dns_2:-8.8.8.8}}"
health_url="http://127.0.0.1:${app_port}/health"
container_name="zera-backend-api"
image_name="zera-backend-api:latest"
compose_cmd=()

if "${docker_cmd[@]}" compose version >/dev/null 2>&1; then
  compose_cmd=("${docker_cmd[@]}" compose)
elif command -v docker-compose >/dev/null 2>&1; then
  if [[ "${docker_cmd[0]}" == "sudo" ]]; then
    compose_cmd=(sudo docker-compose)
  else
    compose_cmd=(docker-compose)
  fi
fi

run_health_check() {
  local health_ok=0

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
    return 1
  fi
}

print_runtime_logs() {
  if [[ "${#compose_cmd[@]}" -gt 0 ]]; then
    "${compose_cmd[@]}" ps || true
    "${compose_cmd[@]}" logs --tail=200 api || true
    return
  fi

  "${docker_cmd[@]}" ps --filter "name=$container_name" || true
  "${docker_cmd[@]}" logs --tail=200 "$container_name" || true
}

deploy_with_plain_docker() {
  "${docker_cmd[@]}" build --target runner -t "$image_name" .
  "${docker_cmd[@]}" rm -f "$container_name" >/dev/null 2>&1 || true

  "${docker_cmd[@]}" run -d \
    --name "$container_name" \
    --restart unless-stopped \
    --init \
    --env-file .env \
    -e NODE_ENV=production \
    -e APP_PORT="$app_port" \
    --dns "$docker_dns_1" \
    --dns "$docker_dns_2" \
    -p "${app_port}:${app_port}" \
    --health-cmd "wget -qO- http://127.0.0.1:${app_port}/health >/dev/null 2>&1 || exit 1" \
    --health-interval 30s \
    --health-timeout 5s \
    --health-retries 5 \
    --health-start-period 40s \
    --log-driver json-file \
    --log-opt max-size=10m \
    --log-opt max-file=3 \
    "$image_name"
}

if [[ "${#compose_cmd[@]}" -gt 0 ]]; then
  "${compose_cmd[@]}" up -d --build
else
  deploy_with_plain_docker
fi

if ! run_health_check; then
  print_runtime_logs
  exit 1
fi

echo "Deploy finished successfully."
