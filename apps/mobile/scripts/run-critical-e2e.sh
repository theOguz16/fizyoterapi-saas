#!/bin/sh
set -eu

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
  "$MAESTRO_BIN" test "$flow"
done
