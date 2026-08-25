#!/bin/sh
set -eu

MODE="test"
ROLE="all"
MATRIX="tests/e2e/release-role-matrix.txt"
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
MOBILE_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
ROOT_DIR=$(cd "$MOBILE_DIR/../.." && pwd)
ENV_RUNNER="$ROOT_DIR/scripts/mobile-e2e-env.sh"

usage() {
  echo "Kullanim: $0 [--check-syntax | --list] [--role all|shared|admin|trainer|member]" >&2
}

if [ "${1:-}" = "--" ]; then
  shift
fi

while [ "$#" -gt 0 ]; do
  case "$1" in
    --check-syntax)
      MODE="check-syntax"
      ;;
    --list)
      MODE="list"
      ;;
    --role)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      ROLE="$2"
      shift
      ;;
    *)
      usage
      exit 2
      ;;
  esac
  shift
done

case "$ROLE" in
  all|shared|admin|trainer|member) ;;
  *) usage; exit 2 ;;
esac

[ -f "$MATRIX" ] || {
  echo "Release role matrix bulunamadi: $MATRIX" >&2
  exit 1
}

if [ "$MODE" != "list" ]; then
  if command -v maestro >/dev/null 2>&1; then
    MAESTRO_BIN="$(command -v maestro)"
  elif [ -x "$HOME/.maestro/bin/maestro" ]; then
    MAESTRO_BIN="$HOME/.maestro/bin/maestro"
  else
    echo "Mobile release E2E icin Maestro CLI gerekli." >&2
    exit 1
  fi
fi

if [ "$MODE" = "test" ]; then
  # Release matrisi gerçek API/DB mutasyonları içerir. Her flow ve retry aynı
  # başlangıç verisini görmezse önceki akışın başvurusu/iptali bir sonrakini
  # kirletir ve sonuç deterministik olmaz.
  sh "$ENV_RUNNER" up </dev/null
fi

selected=0
passed=0
failed=0
MAX_ATTEMPTS="${MAESTRO_MAX_ATTEMPTS:-2}"

echo "Mobile release role matrix"
echo "mode=$MODE role=$ROLE"

while IFS='|' read -r flow_role capability flow setup_command; do
  case "$flow_role" in
    ''|'#'*) continue ;;
  esac

  if [ "$ROLE" != "all" ] && [ "$flow_role" != "$ROLE" ]; then
    continue
  fi

  selected=$((selected + 1))
  printf '[%02d] %-7s | %-42s | %s\n' "$selected" "$flow_role" "$capability" "$flow"

  [ -f "$flow" ] || {
    echo "      FAIL: flow dosyasi bulunamadi" >&2
    failed=$((failed + 1))
    continue
  }

  if [ "$MODE" = "list" ]; then
    passed=$((passed + 1))
  else
    attempt=1
    flow_passed=0
    while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
      # Matris while-read döngüsü stdin üzerinden ilerler. Maestro aynı stdin'i
      # miras alırsa kalan satırları tüketip koşuyu ilk flow'dan sonra bitirebilir.
      if { [ "$MODE" != "test" ] || E2E_SKIP_BUILD=1 sh "$ENV_RUNNER" reset </dev/null; } &&
        { [ "$MODE" != "test" ] || [ -z "${setup_command:-}" ] || {
            set -- $setup_command
            (cd "$ROOT_DIR" && sh "$@" </dev/null)
          }; } &&
        { if [ -n "${MAESTRO_UDID:-}" ]; then
            "$MAESTRO_BIN" "$MODE" -p ios --udid "$MAESTRO_UDID" "$flow" </dev/null
          else
            "$MAESTRO_BIN" "$MODE" "$flow" </dev/null
          fi; }; then
        flow_passed=1
        break
      fi
      if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
        echo "      RETRY: Maestro device/driver failure ($attempt/$MAX_ATTEMPTS)" >&2
      fi
      attempt=$((attempt + 1))
    done
    if [ "$flow_passed" -eq 1 ]; then
      passed=$((passed + 1))
    else
      failed=$((failed + 1))
    fi
  fi
done < "$MATRIX"

echo "summary selected=$selected passed=$passed failed=$failed"

[ "$selected" -gt 0 ] || {
  echo "Secilen rol icin flow bulunamadi: $ROLE" >&2
  exit 1
}

[ "$failed" -eq 0 ]
