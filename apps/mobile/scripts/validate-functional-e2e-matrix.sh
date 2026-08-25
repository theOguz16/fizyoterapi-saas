#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
MOBILE_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
ROOT_DIR=$(cd "$MOBILE_DIR/../.." && pwd)
MATRIX="$MOBILE_DIR/tests/e2e/functional-e2e-matrix.txt"

rows=0
failures=0

while IFS='|' read -r capability flow verifier maestro_env_name setup_command extra; do
  case "$capability" in
    ''|'#'*) continue ;;
  esac

  rows=$((rows + 1))
  if [ -n "${extra:-}" ]; then
    echo "Fazla matris alanı: $capability" >&2
    failures=$((failures + 1))
  fi

  flow_path="$MOBILE_DIR/$flow"
  if [ ! -f "$flow_path" ]; then
    echo "Flow bulunamadı: $flow" >&2
    failures=$((failures + 1))
    continue
  fi

  if ! grep -q 'clearState: true' "$flow_path"; then
    echo "clearState eksik: $flow" >&2
    failures=$((failures + 1))
  fi
  if ! grep -q 'clearKeychain: true' "$flow_path"; then
    echo "clearKeychain eksik: $flow" >&2
    failures=$((failures + 1))
  fi
  if ! grep -q 'e2e-reset' "$flow_path"; then
    echo "e2e-reset eksik: $flow" >&2
    failures=$((failures + 1))
  fi
  if grep -q 'optional: true' "$flow_path"; then
    echo "Kritik akışta optional:true kullanılmış: $flow" >&2
    failures=$((failures + 1))
  fi

  if [ -n "${verifier:-}" ]; then
    set -- $verifier
    if [ ! -f "$ROOT_DIR/$1" ]; then
      echo "Verifier bulunamadı: $verifier" >&2
      failures=$((failures + 1))
    fi
  else
    case "$flow" in
      tests/e2e/maestro/member-clinic-connection-functional.yaml|\
      tests/e2e/maestro/member-salon-qr-invalid-salon.yaml|\
      tests/e2e/maestro/member-salon-qr-block-active-member.yaml)
        # Bu üç flow kalıcı mutation değil, yönlendirme/rol koruması kanıtıdır.
        ;;
      *)
        echo "API/DB verifier eksik: $flow" >&2
        failures=$((failures + 1))
        ;;
    esac
  fi

  if [ -n "${setup_command:-}" ]; then
    set -- $setup_command
    if [ ! -f "$ROOT_DIR/$1" ]; then
      echo "Fixture setup bulunamadı: $setup_command" >&2
      failures=$((failures + 1))
    fi
  fi
done < "$MATRIX"

printf 'functional matrix rows=%s failures=%s\n' "$rows" "$failures"
[ "$rows" -gt 0 ] && [ "$failures" -eq 0 ]
