#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
MAESTRO_BIN="${MAESTRO_BIN:-$HOME/.maestro/bin/maestro}"

cd "$ROOT_DIR"
sh scripts/mobile-e2e-env.sh up
sh scripts/mobile-e2e-env.sh reset
MAESTRO_UDID="$MAESTRO_UDID" MAESTRO_BIN="$MAESTRO_BIN" MAESTRO_METRO_URL="${MAESTRO_METRO_URL:-http://127.0.0.1:8081}" sh apps/mobile/scripts/prepare-ios-maestro-dev-client.sh
"$MAESTRO_BIN" test -p ios --udid "${MAESTRO_UDID:?MAESTRO_UDID is required}" apps/mobile/tests/e2e/maestro/clinic-owner-activation-flow.yaml
sh apps/mobile/scripts/verify-clinic-activation-api.sh
