#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
MOBILE_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
MAESTRO_BIN=${MAESTRO_BIN:-"$HOME/.maestro/bin/maestro"}
MAESTRO_UDID=${MAESTRO_UDID:?MAESTRO_UDID is required}
MAESTRO_METRO_URL=${MAESTRO_METRO_URL:-http://127.0.0.1:8081}
HELPER_FLOW="$MOBILE_DIR/tests/e2e/maestro/_ios-dev-client-clean-start.yaml"

[ -x "$MAESTRO_BIN" ] || {
  echo "Maestro CLI bulunamadi: $MAESTRO_BIN" >&2
  exit 1
}

"$MAESTRO_BIN" test -p ios --udid "$MAESTRO_UDID" "$HELPER_FLOW"

ENCODED_METRO_URL=$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$MAESTRO_METRO_URL")
xcrun simctl openurl "$MAESTRO_UDID" "fizyoflow://expo-development-client/?url=$ENCODED_METRO_URL"

attempt=1
while [ "$attempt" -le 60 ]; do
  if curl -fsS "$MAESTRO_METRO_URL/status" 2>/dev/null | grep -q "packager-status:running"; then
    exit 0
  fi
  sleep 1
  attempt=$((attempt + 1))
done

echo "Metro development client baglantisi hazir olmadi: $MAESTRO_METRO_URL" >&2
exit 1
