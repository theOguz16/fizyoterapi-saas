#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
MOBILE_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
ROOT_DIR=$(cd "$MOBILE_DIR/../.." && pwd)
MATRIX="$MOBILE_DIR/tests/e2e/functional-e2e-matrix.txt"
ENV_RUNNER="$ROOT_DIR/scripts/mobile-e2e-env.sh"
MAESTRO_UDID=${MAESTRO_UDID:?MAESTRO_UDID is required for isolated iOS functional E2E}

if command -v maestro >/dev/null 2>&1; then
  MAESTRO_BIN=$(command -v maestro)
elif [ -x "$HOME/.maestro/bin/maestro" ]; then
  MAESTRO_BIN="$HOME/.maestro/bin/maestro"
else
  echo "Maestro CLI gerekli." >&2
  exit 1
fi

[ -f "$MATRIX" ] || {
  echo "Fonksiyonel E2E matrisi bulunamadi: $MATRIX" >&2
  exit 1
}

sh "$ENV_RUNNER" up

selected=0
passed=0
failed=0

while IFS='|' read -r capability flow verifier maestro_env_name setup_command; do
  case "$capability" in
    ''|'#'*) continue ;;
  esac

  selected=$((selected + 1))
  printf '[%02d] %s\n' "$selected" "$capability"

  [ -f "$MOBILE_DIR/$flow" ] || {
    echo "      FAIL: flow dosyasi bulunamadi: $flow" >&2
    failed=$((failed + 1))
    continue
  }

  # Her akistan once yalnizca e2e PostgreSQL temizlenir ve yeniden seed edilir.
  # iOS development client kosusunda ayri hazirlik adimi clearState ve
  # clearKeychain uygular, ardindan guncel Metro adresini yeniden baglar.
  setup_value=""

  if sh "$ENV_RUNNER" reset &&
    { [ -z "${setup_command:-}" ] || {
        set -- $setup_command
        setup_value=$(cd "$ROOT_DIR" && sh "$@")
      }; } &&
    MAESTRO_UDID="$MAESTRO_UDID" MAESTRO_BIN="$MAESTRO_BIN" MAESTRO_METRO_URL="${MAESTRO_METRO_URL:-http://127.0.0.1:8081}" sh "$SCRIPT_DIR/prepare-ios-maestro-dev-client.sh" &&
    { if [ -n "${maestro_env_name:-}" ]; then
        (cd "$MOBILE_DIR" && "$MAESTRO_BIN" test -p ios --udid "$MAESTRO_UDID" -e "$maestro_env_name=$setup_value" "$flow")
      else
        (cd "$MOBILE_DIR" && "$MAESTRO_BIN" test -p ios --udid "$MAESTRO_UDID" "$flow")
      fi; } &&
    { [ -z "${verifier:-}" ] || (
        cd "$ROOT_DIR"
        # Matrisin üçüncü alanı "script [arg...]" biçimindedir; shell operatörü
        # kabul edilmez, yalnız script yolu ve düz argümanlar çalıştırılır.
        set -- $verifier
        sh "$@"
      ); }; then
    passed=$((passed + 1))
  else
    failed=$((failed + 1))
  fi
done < "$MATRIX"

echo "summary selected=$selected passed=$passed failed=$failed"
[ "$selected" -gt 0 ] && [ "$failed" -eq 0 ]
