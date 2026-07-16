#!/bin/sh
set -eu

MODE="${1:-matrix}"
ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
EVIDENCE_DIR="${PUSH_E2E_EVIDENCE_DIR:-}"
DEVICE_ID="${PUSH_E2E_DEVICE_ID:-}"

fail() {
  echo "Push release E2E: $1" >&2
  exit 1
}

[ -n "$EVIDENCE_DIR" ] || fail "PUSH_E2E_EVIDENCE_DIR zorunludur."
[ -n "$DEVICE_ID" ] || fail "PUSH_E2E_DEVICE_ID zorunludur."
case "$EVIDENCE_DIR" in
  /*) ;;
  *) EVIDENCE_DIR="$ROOT_DIR/$EVIDENCE_DIR" ;;
esac
mkdir -p "$EVIDENCE_DIR"

if command -v maestro >/dev/null 2>&1; then
  MAESTRO_BIN="$(command -v maestro)"
elif [ -x "$HOME/.maestro/bin/maestro" ]; then
  MAESTRO_BIN="$HOME/.maestro/bin/maestro"
else
  fail "Maestro CLI bulunamadı."
fi

command -v xcrun >/dev/null 2>&1 || fail "iOS fiziksel cihaz doğrulaması için xcrun gerekli."
DEVICE_LINE="$(xcrun devicectl list devices 2>/dev/null | grep -F "$DEVICE_ID" | head -n 1 || true)"
if [ -z "$DEVICE_LINE" ]; then
  fail "PUSH_E2E_DEVICE_ID bağlı fiziksel iOS cihazları arasında bulunamadı. Simülatör kabul edilmez."
fi
case "$DEVICE_LINE" in
  *unavailable*) fail "Fiziksel iPhone kayıtlı ancak unavailable. Cihazı USB ile bağlayın, kilidini açın ve Developer Mode'u doğrulayın." ;;
esac

env_value() {
  printenv "$1" 2>/dev/null || true
}

run_maestro() {
  log_file="$1"
  shift
  if ! "$MAESTRO_BIN" --device "$DEVICE_ID" test "$@" >>"$log_file" 2>&1; then
    cat "$log_file" >&2
    exit 1
  fi
}

run_permission_denied() {
  email="$(env_value PUSH_E2E_MEMBER_EMAIL)"
  password="$(env_value PUSH_E2E_MEMBER_PASSWORD)"
  [ -n "$email" ] || fail "PUSH_E2E_MEMBER_EMAIL zorunludur."
  [ -n "$password" ] || fail "PUSH_E2E_MEMBER_PASSWORD zorunludur."
  rm -f "$EVIDENCE_DIR/permission-denied.log" "$EVIDENCE_DIR/permission-denied.png"
  run_maestro "$EVIDENCE_DIR/permission-denied.log" \
    -e "PUSH_E2E_EMAIL=$email" \
    -e "PUSH_E2E_PASSWORD=$password" \
    -e "PUSH_E2E_HOME_ID=member-home-screen" \
    -e "PUSH_E2E_SCREENSHOT=$EVIDENCE_DIR/permission-denied" \
    "$ROOT_DIR/tests/e2e/maestro/push/permission-denied.yaml"
  [ -s "$EVIDENCE_DIR/permission-denied.png" ] || fail "İzin reddi screenshot'ı oluşmadı."
  echo "İzin reddi kanıtı hazır. Matrix koşusundan önce iOS Ayarlar'dan FizyoFlow bildirim iznini açın."
}

role_config() {
  case "$1" in
    ADMIN) echo "admin-dashboard-screen|/(admin)/approvals|admin-approvals-screen" ;;
    TRAINER) echo "trainer-home-screen|/(trainer)/calendar|trainer-calendar-screen" ;;
    MEMBER) echo "member-home-screen|/(member)/bookings|member-bookings-screen" ;;
    *) fail "Bilinmeyen rol: $1" ;;
  esac
}

run_matrix() {
  for required_file in permission-denied.png permission-denied.log; do
    [ -s "$EVIDENCE_DIR/$required_file" ] || fail "$required_file eksik. Önce permission-denied modunu çalıştırın."
  done

  for role in ADMIN TRAINER MEMBER; do
    lower_role="$(printf '%s' "$role" | tr '[:upper:]' '[:lower:]')"
    email="$(env_value "PUSH_E2E_${role}_EMAIL")"
    password="$(env_value "PUSH_E2E_${role}_PASSWORD")"
    expo_token="$(env_value "PUSH_E2E_${role}_EXPO_TOKEN")"
    registration_log="$(env_value "PUSH_E2E_${role}_REGISTRATION_LOG")"
    [ -n "$email" ] || fail "PUSH_E2E_${role}_EMAIL zorunludur."
    [ -n "$password" ] || fail "PUSH_E2E_${role}_PASSWORD zorunludur."
    [ -n "$expo_token" ] || fail "PUSH_E2E_${role}_EXPO_TOKEN zorunludur."
    [ -s "$registration_log" ] || fail "PUSH_E2E_${role}_REGISTRATION_LOG bulunamadı veya boş."

    config="$(role_config "$role")"
    home_id="$(printf '%s' "$config" | cut -d'|' -f1)"
    href="$(printf '%s' "$config" | cut -d'|' -f2)"
    target_id="$(printf '%s' "$config" | cut -d'|' -f3)"
    registration_target="$EVIDENCE_DIR/${lower_role}-token-registration.log"
    if [ "$registration_log" != "$registration_target" ]; then
      cp "$registration_log" "$registration_target"
    fi

    run_maestro "$EVIDENCE_DIR/${lower_role}-login-maestro.log" \
      -e "PUSH_E2E_EMAIL=$email" \
      -e "PUSH_E2E_PASSWORD=$password" \
      -e "PUSH_E2E_HOME_ID=$home_id" \
      -e "PUSH_E2E_SCREENSHOT=$EVIDENCE_DIR/${lower_role}-token-registration" \
      "$ROOT_DIR/tests/e2e/maestro/push/role-login-and-register.yaml"
    [ -s "$EVIDENCE_DIR/${lower_role}-token-registration.png" ] || fail "$role token kayıt screenshot'ı oluşmadı."

    for state in foreground background terminated; do
      scenario="$lower_role-$state"
      scenario_log="$EVIDENCE_DIR/$scenario.log"
      ticket_path="$EVIDENCE_DIR/$scenario-ticket.json"
      receipt_path="$EVIDENCE_DIR/$scenario-receipt.json"
      screenshot_base="$EVIDENCE_DIR/$scenario"
      title="FF-PUSH-$role-$(printf '%s' "$state" | tr '[:lower:]' '[:upper:]')-$(date +%s)"
      : >"$scenario_log"

      run_maestro "$scenario_log" \
        -e "PUSH_E2E_HOME_ID=$home_id" \
        "$ROOT_DIR/tests/e2e/maestro/push/prepare-$state.yaml"

      PUSH_E2E_EXPO_TOKEN="$expo_token" \
      PUSH_E2E_ROLE="$role" \
      PUSH_E2E_STATE="$state" \
      PUSH_E2E_HREF="$href" \
      PUSH_E2E_NOTIFICATION_TITLE="$title" \
      PUSH_E2E_TICKET_PATH="$ticket_path" \
        node "$ROOT_DIR/scripts/send-release-push.mjs" send >>"$scenario_log" 2>&1

      run_maestro "$scenario_log" \
        -e "PUSH_E2E_NOTIFICATION_TITLE=$title" \
        -e "PUSH_E2E_TARGET_ID=$target_id" \
        -e "PUSH_E2E_SCREENSHOT=$screenshot_base" \
        "$ROOT_DIR/tests/e2e/maestro/push/open-and-assert.yaml"

      PUSH_E2E_TICKET_PATH="$ticket_path" \
      PUSH_E2E_RECEIPT_PATH="$receipt_path" \
        node "$ROOT_DIR/scripts/send-release-push.mjs" receipt >>"$scenario_log" 2>&1
      [ -s "$screenshot_base.png" ] || fail "$scenario push hedef screenshot'ı oluşmadı."
    done
  done

  PUSH_E2E_EVIDENCE_DIR="$EVIDENCE_DIR" node "$ROOT_DIR/scripts/build-push-release-evidence.mjs"
  PUSH_RELEASE_EVIDENCE="$EVIDENCE_DIR/push-release-evidence.json" \
  PUSH_RELEASE_BUILD="${PUSH_E2E_BUILD:-}" \
    node "$ROOT_DIR/scripts/validate-push-release-evidence.mjs"
}

case "$MODE" in
  permission-denied) run_permission_denied ;;
  matrix) run_matrix ;;
  *) fail "Kullanım: scripts/run-device-push-release.sh <permission-denied|matrix>" ;;
esac
