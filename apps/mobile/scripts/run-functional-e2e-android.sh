#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
MOBILE_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
ROOT_DIR=$(cd "$MOBILE_DIR/../.." && pwd)
MATRIX="$MOBILE_DIR/tests/e2e/functional-e2e-matrix.txt"
ENV_RUNNER="$ROOT_DIR/scripts/mobile-e2e-env.sh"
ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/Library/Android/sdk}}
ANDROID_HOME=${ANDROID_HOME:-$ANDROID_SDK_ROOT}
export ANDROID_SDK_ROOT ANDROID_HOME
ADB_BIN=${ADB_BIN:-$ANDROID_SDK_ROOT/platform-tools/adb}
ANDROID_API_BASE=${ANDROID_API_BASE:-http://10.0.2.2:4949/api}
APK_PATH=${ANDROID_E2E_APK:-$MOBILE_DIR/android/app/build/outputs/apk/e2e/app-e2e.apk}
ANDROID_STUDIO_JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"

if [ -z "${JAVA_HOME:-}" ] && [ -x "$ANDROID_STUDIO_JAVA_HOME/bin/java" ]; then
  JAVA_HOME=$ANDROID_STUDIO_JAVA_HOME
  export JAVA_HOME
fi

if command -v maestro >/dev/null 2>&1; then
  MAESTRO_BIN=$(command -v maestro)
elif [ -x "$HOME/.maestro/bin/maestro" ]; then
  MAESTRO_BIN="$HOME/.maestro/bin/maestro"
else
  echo "Maestro CLI gerekli." >&2
  exit 1
fi

[ -x "$ADB_BIN" ] || {
  echo "ADB bulunamadi: $ADB_BIN" >&2
  exit 1
}

[ -f "$MATRIX" ] || {
  echo "Fonksiyonel E2E matrisi bulunamadi: $MATRIX" >&2
  exit 1
}

if [ -z "${MAESTRO_UDID:-}" ]; then
  MAESTRO_UDID=$($ADB_BIN devices | awk 'NR > 1 && $2 == "device" { print $1; exit }')
fi

[ -n "${MAESTRO_UDID:-}" ] || {
  echo "Calisan Android emulatoru bulunamadi. MAESTRO_UDID verin." >&2
  exit 1
}

if [ "${E2E_SKIP_BUILD:-0}" != "1" ]; then
  (
    cd "$MOBILE_DIR/android"
    EXPO_PUBLIC_E2E_MODE=1 \
    EXPO_PUBLIC_API_BASE="$ANDROID_API_BASE" \
    ./gradlew :app:assembleE2e \
      -PreactNativeArchitectures=arm64-v8a \
      '-Dorg.gradle.jvmargs=-Xmx3072m -XX:MaxMetaspaceSize=1024m' \
      --no-parallel \
      -x lintVitalAnalyzeRelease
  )
fi

[ -f "$APK_PATH" ] || {
  echo "Android E2E APK bulunamadi: $APK_PATH" >&2
  exit 1
}

sh "$ENV_RUNNER" up
"$ADB_BIN" -s "$MAESTRO_UDID" wait-for-device
"$ADB_BIN" -s "$MAESTRO_UDID" uninstall com.fizyoflow.mobile >/dev/null 2>&1 || true
"$ADB_BIN" -s "$MAESTRO_UDID" install "$APK_PATH"

run_maestro_flow() {
  if [ -n "${maestro_env_name:-}" ]; then
    (cd "$MOBILE_DIR" && "$MAESTRO_BIN" test -p android --udid "$MAESTRO_UDID" -e "$maestro_env_name=$setup_value" "$flow" </dev/null)
  else
    (cd "$MOBILE_DIR" && "$MAESTRO_BIN" test -p android --udid "$MAESTRO_UDID" "$flow" </dev/null)
  fi
}

run_maestro_flow_with_infra_retry() {
  maestro_attempt_log=$(mktemp "${TMPDIR:-/tmp}/fizyoflow-maestro-android-attempt.XXXXXX")

  if run_maestro_flow >"$maestro_attempt_log" 2>&1; then
    cat "$maestro_attempt_log"
    rm -f "$maestro_attempt_log"
    return 0
  fi

  cat "$maestro_attempt_log"
  if grep -Eq 'ADB server didn.t ACK|device offline|Unable to reach device|gRPC.*UNAVAILABLE' "$maestro_attempt_log"; then
    echo "Maestro Android surucusu gecici hata verdi; akis bir kez yeniden deneniyor."
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

  setup_value=""
  if E2E_SKIP_BUILD=1 sh "$ENV_RUNNER" reset </dev/null &&
    { [ -z "${setup_command:-}" ] || {
        set -- $setup_command
        setup_value=$(cd "$ROOT_DIR" && sh "$@" </dev/null)
      }; } &&
    run_maestro_flow_with_infra_retry &&
    { [ -z "${verifier:-}" ] || (
        cd "$ROOT_DIR"
        set -- $verifier
        sh "$@" </dev/null
      ); }; then
    passed=$((passed + 1))
  else
    failed=$((failed + 1))
  fi
done < "$MATRIX"

echo "summary platform=android selected=$selected passed=$passed failed=$failed"
[ "$selected" -gt 0 ] && [ "$failed" -eq 0 ]
