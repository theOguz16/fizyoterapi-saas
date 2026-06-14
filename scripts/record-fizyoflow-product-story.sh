#!/bin/zsh

set -euo pipefail

ROOT_DIR="${0:A:h:h}"
FLOW_FILE="$ROOT_DIR/apps/mobile/tests/e2e/maestro/marketing-product-story.yaml"
OUTPUT_FILE="$ROOT_DIR/apps/web/public/product-tour/fizyoflow-product-story.mp4"
MAESTRO_BIN="${MAESTRO_BIN:-$HOME/.maestro/bin/maestro}"

if ! curl -fsS http://127.0.0.1:4949/health >/dev/null; then
  echo "Fizyoflow API 4949 portunda çalışmıyor. Önce demo veritabanını ve API'yi başlatın." >&2
  exit 1
fi

if [[ ! -x "$MAESTRO_BIN" ]]; then
  echo "Maestro bulunamadı: $MAESTRO_BIN" >&2
  exit 1
fi

mkdir -p "${OUTPUT_FILE:h}"
rm -f "$OUTPUT_FILE"

xcrun simctl io booted recordVideo --codec=h264 --force "$OUTPUT_FILE" &
RECORD_PID=$!

cleanup() {
  kill -INT "$RECORD_PID" 2>/dev/null || true
  wait "$RECORD_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

"$MAESTRO_BIN" test "$FLOW_FILE"
sleep 1
cleanup
trap - EXIT INT TERM

echo "$OUTPUT_FILE"
