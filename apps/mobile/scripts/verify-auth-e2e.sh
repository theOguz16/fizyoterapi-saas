#!/bin/sh
set -eu

CASE_NAME="${1:?verification case is required}"
API_BASE="${E2E_API_BASE:-http://127.0.0.1:4949/api}"
DATABASE_URL="${E2E_DATABASE_URL:-postgresql://fizyoflow_e2e:fizyoflow_e2e@127.0.0.1:55433/fizyoflow_e2e}"

db_value() {
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "$1"
}

assert_login() {
  email="$1"
  password="$2"
  expected="$3"
  actual=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API_BASE/auth/login" \
    -H 'Content-Type: application/json' \
    --data "{\"email\":\"$email\",\"password\":\"$password\"}")
  [ "$actual" = "$expected" ] || {
    echo "Auth E2E doğrulaması başarısız: $email login HTTP $actual, beklenen $expected" >&2
    exit 1
  }
}

case "$CASE_NAME" in
  owner-registration)
    email='owner.registration.e2e@demo.local'
    row=$(db_value "SELECT global_role_default || '|' || is_active::text || '|' || COALESCE(legal_consents->>'source','') || '|' || COALESCE(legal_consents->'terms'->>'version','') FROM accounts WHERE email = '$email'")
    case "$row" in
      "ADMIN|true|MOBILE_CLINIC_OWNER_REGISTER|"*) ;;
      *) echo "Kayıt DB doğrulaması başarısız: $row" >&2; exit 1 ;;
    esac
    assert_login "$email" 'owner-register123' 200
    echo "owner-registration: account, legal consent and login verified"
    ;;
  member-registration)
    email='member.registration.e2e@demo.local'
    row=$(db_value "SELECT global_role_default || '|' || is_active::text || '|' || COALESCE(legal_consents->>'source','') || '|' || COALESCE(legal_consents->'terms'->>'version','') FROM accounts WHERE email = '$email'")
    case "$row" in
      "MEMBER|true|MOBILE_CLINIC_MEMBER_REGISTER|"*) ;;
      *) echo "Danışan kayıt DB doğrulaması başarısız: $row" >&2; exit 1 ;;
    esac
    assert_login "$email" 'member-register123' 200
    echo "member-registration: account, legal consent and login verified"
    ;;
  trainer-invite)
    email='trainer.registration.e2e@demo.local'
    row=$(db_value "SELECT invite.status || '|' || invite.role || '|' || user_record.is_active::text || '|' || COALESCE(invite.meta->'legal_consents'->>'source','') FROM invites invite JOIN users user_record ON user_record.id = invite.accepted_user_id WHERE invite.email_or_phone = '$email' ORDER BY invite.created_at DESC LIMIT 1")
    [ "$row" = "ACCEPTED|TRAINER|true|MOBILE_INVITE_ACCEPT" ] || {
      echo "Eğitmen davet DB doğrulaması başarısız: $row" >&2
      exit 1
    }
    assert_login "$email" 'trainer-invite123' 200
    echo "trainer-invite: invite acceptance, legal consent, trainer user and login verified"
    ;;
  role-switch-logout)
    email='clinic.owner.e2e@demo.local'
    account_id=$(db_value "SELECT id FROM accounts WHERE email = '$email'")
    memberships=$(db_value "SELECT string_agg(role || ':' || is_active_context::text, ',' ORDER BY role) FROM salon_memberships WHERE account_id = '$account_id' AND status = 'ACTIVE'")
    case "$memberships" in
      *"ADMIN:false"*"TRAINER:true"*|*"TRAINER:true"*"ADMIN:false"*) ;;
      *) echo "Rol değişimi DB doğrulaması başarısız: $memberships" >&2; exit 1 ;;
    esac
    logout_count=$(db_value "SELECT count(*) FROM audit_logs WHERE actor_account_id = '$account_id' AND event_type = 'AUTH_LOGOUT' AND success = true")
    [ "$logout_count" -ge 1 ] || {
      echo "Çıkış audit doğrulaması başarısız: count=$logout_count" >&2
      exit 1
    }
    assert_login "$email" 'clinic-owner123' 200
    echo "role-switch-logout: trainer context, logout audit and subsequent login verified"
    ;;
  password-reset-request)
    account_id=$(db_value "SELECT id FROM accounts WHERE email = 'password.reset.e2e@demo.local'")
    active_count=$(db_value "SELECT count(*) FROM password_reset_tokens WHERE account_id = '$account_id' AND used_at IS NULL AND expires_at > now()")
    used_count=$(db_value "SELECT count(*) FROM password_reset_tokens WHERE account_id = '$account_id' AND used_at IS NOT NULL")
    [ "$active_count" = "1" ] && [ "$used_count" -ge 1 ] || {
      echo "Reset request DB doğrulaması başarısız: active=$active_count used=$used_count" >&2
      exit 1
    }
    echo "password-reset-request: old token invalidated and one active token created"
    ;;
  password-reset-confirm)
    email='password.reset.e2e@demo.local'
    row=$(db_value "SELECT auth_version || '|' || count(token.id) FILTER (WHERE token.used_at IS NOT NULL) FROM accounts account LEFT JOIN password_reset_tokens token ON token.account_id = account.id WHERE account.email = '$email' GROUP BY account.auth_version")
    case "$row" in
      "2|"*) ;;
      *) echo "Reset confirm DB doğrulaması başarısız: $row" >&2; exit 1 ;;
    esac
    assert_login "$email" 'password-old123' 401
    assert_login "$email" 'password-new123' 200
    echo "password-reset-confirm: token consumed, auth version incremented, old/new login verified"
    ;;
  *)
    echo "Bilinmeyen auth E2E doğrulaması: $CASE_NAME" >&2
    exit 2
    ;;
esac
