#!/bin/sh
set -eu

MODE="test"
if [ "${1:-}" = "--" ]; then
  shift
fi
if [ "${1:-}" = "--check-syntax" ]; then
  MODE="check-syntax"
elif [ "$#" -gt 0 ]; then
  echo "Kullanim: $0 [--check-syntax]" >&2
  exit 2
fi

if command -v maestro >/dev/null 2>&1; then
  MAESTRO_BIN="$(command -v maestro)"
elif [ -x "$HOME/.maestro/bin/maestro" ]; then
  MAESTRO_BIN="$HOME/.maestro/bin/maestro"
else
  echo "Mobile release E2E için Maestro CLI gerekli." >&2
  exit 1
fi

for flow in \
  tests/e2e/maestro/release-admin-login.yaml \
  tests/e2e/maestro/admin-package-create-smoke.yaml \
  tests/e2e/maestro/admin-calendar-smoke.yaml \
  tests/e2e/maestro/release-trainer-login.yaml \
  tests/e2e/maestro/trainer-manual-checkin-smoke.yaml \
  tests/e2e/maestro/trainer-calendar-smoke.yaml \
  tests/e2e/maestro/login-role-routing.yaml \
  tests/e2e/maestro/member-salon-qr-deeplink-smoke.yaml \
  tests/e2e/maestro/member-bookings-smoke.yaml
do
  "$MAESTRO_BIN" "$MODE" "$flow"
done
