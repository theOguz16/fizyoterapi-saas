#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
COMPOSE_FILE="$ROOT_DIR/docker-compose.e2e.yml"
COMPOSE_CMD="docker compose -f $COMPOSE_FILE -p fizyoflow-e2e"
API_URL="http://127.0.0.1:4949/ready"

usage() {
  echo "Kullanim: $0 up|reset|status|down" >&2
}

wait_for_api() {
  attempt=1
  while [ "$attempt" -le 30 ]; do
    if curl -fsS "$API_URL" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    attempt=$((attempt + 1))
  done
  echo "E2E API hazir olmadi: $API_URL" >&2
  return 1
}

case "${1:-}" in
  up)
    if [ "${E2E_SKIP_BUILD:-0}" != "1" ]; then
      $COMPOSE_CMD build api e2e-fixtures
    fi
    $COMPOSE_CMD up -d postgres api
    wait_for_api
    echo "E2E ortami hazir. API: http://127.0.0.1:4949/api"
    ;;
  reset)
    if [ "${E2E_SKIP_BUILD:-0}" != "1" ]; then
      $COMPOSE_CMD build api e2e-fixtures
    fi
    $COMPOSE_CMD up -d postgres
    $COMPOSE_CMD run --rm e2e-fixtures
    $COMPOSE_CMD up -d api
    wait_for_api
    echo "E2E verisi temizlendi ve deterministik fixture yeniden olusturuldu."
    ;;
  status)
    $COMPOSE_CMD ps
    ;;
  down)
    $COMPOSE_CMD down
    ;;
  *)
    usage
    exit 2
    ;;
esac
