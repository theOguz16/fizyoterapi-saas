#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
MOBILE_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
ROOT_DIR=$(cd "$MOBILE_DIR/../.." && pwd)
MATRIX="$MOBILE_DIR/tests/e2e/functional-e2e-matrix.txt"
ENV_RUNNER="$ROOT_DIR/scripts/mobile-e2e-env.sh"
MAESTRO_UDID=${MAESTRO_UDID:?MAESTRO_UDID is required for isolated iOS functional E2E}
MAESTRO_DRIVER_STARTUP_TIMEOUT=${MAESTRO_DRIVER_STARTUP_TIMEOUT:-180000}

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

# Image yalnız bir kez güncel kaynakla build edilir. Her flow öncesindeki reset
# yalnız veriyi temizleyip seed eder; 31 kez aynı Docker image'ını rebuild etmez.
sh "$ENV_RUNNER" up

# Development client Metro'ya koşu başında bir kez bağlanır. Her senaryoda bu
# yardımcı flow'u yeniden çalıştırmak iki ayrı XCTest oturumu açıyor ve uzun
# regresyonlarda iOS sürücüsünün yorulup başlatılamamasına neden oluyordu.
MAESTRO_UDID="$MAESTRO_UDID" \
MAESTRO_BIN="$MAESTRO_BIN" \
MAESTRO_METRO_URL="${MAESTRO_METRO_URL:-http://127.0.0.1:8081}" \
MAESTRO_DRIVER_STARTUP_TIMEOUT="$MAESTRO_DRIVER_STARTUP_TIMEOUT" \
sh "$SCRIPT_DIR/prepare-ios-maestro-dev-client.sh" </dev/null

run_maestro_flow() {
  if [ -n "${maestro_env_name:-}" ]; then
    (cd "$MOBILE_DIR" && MAESTRO_DRIVER_STARTUP_TIMEOUT="$MAESTRO_DRIVER_STARTUP_TIMEOUT" "$MAESTRO_BIN" test -p ios --udid "$MAESTRO_UDID" -e "$maestro_env_name=$setup_value" "$flow" </dev/null)
  else
    (cd "$MOBILE_DIR" && MAESTRO_DRIVER_STARTUP_TIMEOUT="$MAESTRO_DRIVER_STARTUP_TIMEOUT" "$MAESTRO_BIN" test -p ios --udid "$MAESTRO_UDID" "$flow" </dev/null)
  fi
}

run_maestro_flow_with_infra_retry() {
  maestro_attempt_log=$(mktemp "${TMPDIR:-/tmp}/fizyoflow-maestro-attempt.XXXXXX")

  if run_maestro_flow >"$maestro_attempt_log" 2>&1; then
    cat "$maestro_attempt_log"
    rm -f "$maestro_attempt_log"
    return 0
  fi

  cat "$maestro_attempt_log"
  if grep -Eq 'kAXErrorInvalidUIElement|Request for viewHierarchy failed|XCTestDriver request failed' "$maestro_attempt_log"; then
    echo "Maestro iOS gorunum surucusu gecici hata verdi; akis bir kez yeniden deneniyor."
    rm -f "$maestro_attempt_log"
    sleep 2
    run_maestro_flow
    return $?
  fi

  rm -f "$maestro_attempt_log"
  return 1
}

selected=0
passed=0
failed=0

while IFS='|' read -r capability flow verifier maestro_env_name setup_command; do
  case "$capability" in
    ''|'#'*) continue ;;
  esac

  # İlk tam koşuda düşen akışları, başarılı olanları yeniden tüketmeden hedefli
  # doğrulamak için boşlukla ayrılmış flow yolları kabul edilir. Değer verilmezse
  # matrisin tamamı çalışır.
  if [ -n "${E2E_FLOW_LIST:-}" ]; then
    flow_selected=0
    for requested_flow in $E2E_FLOW_LIST; do
      if [ "$flow" = "$requested_flow" ]; then
        flow_selected=1
        break
      fi
    done
    [ "$flow_selected" -eq 1 ] || continue
  fi

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

  if E2E_SKIP_BUILD=1 sh "$ENV_RUNNER" reset </dev/null &&
    { [ -z "${setup_command:-}" ] || {
        set -- $setup_command
        setup_value=$(cd "$ROOT_DIR" && sh "$@" </dev/null)
      }; } &&
    run_maestro_flow_with_infra_retry &&
    { [ -z "${verifier:-}" ] || (
        cd "$ROOT_DIR"
        # Matrisin üçüncü alanı "script [arg...]" biçimindedir; shell operatörü
        # kabul edilmez, yalnız script yolu ve düz argümanlar çalıştırılır.
        set -- $verifier
        sh "$@" </dev/null
      ); }; then
    passed=$((passed + 1))
  else
    failed=$((failed + 1))
  fi
done < "$MATRIX"

echo "summary selected=$selected passed=$passed failed=$failed"
[ "$selected" -gt 0 ] && [ "$failed" -eq 0 ]
