#!/bin/sh
set -eu

MODE="test"
ROLE="all"
MATRIX="tests/e2e/release-role-matrix.txt"

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

selected=0
passed=0
failed=0
MAX_ATTEMPTS="${MAESTRO_MAX_ATTEMPTS:-2}"

echo "Mobile release role matrix"
echo "mode=$MODE role=$ROLE"

while IFS='|' read -r flow_role capability flow; do
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
      if "$MAESTRO_BIN" "$MODE" "$flow"; then
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
