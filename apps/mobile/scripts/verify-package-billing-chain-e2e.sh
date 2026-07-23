#!/bin/sh
set -eu

API_BASE="${E2E_API_BASE:-http://127.0.0.1:4949/api}"
DATABASE_URL="${E2E_DATABASE_URL:-postgresql://fizyoflow_e2e:fizyoflow_e2e@127.0.0.1:55433/fizyoflow_e2e}"
WEBHOOK_AUTH="${E2E_REVENUECAT_WEBHOOK_AUTH:-local-e2e-revenuecat-secret}"
ENTITLEMENT_ID="${E2E_REVENUECAT_ENTITLEMENT_ID:-fizyoflow_plus}"
TMP_DIR=$(mktemp -d /tmp/fizyoflow-package-billing-e2e.XXXXXX)
trap 'rm -rf "$TMP_DIR"' EXIT

db_value() {
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "$1"
}

admin_token=$(
  curl -fsS -X POST "$API_BASE/auth/login" \
    -H 'Content-Type: application/json' \
    --data '{"email":"oguzhanuyar531@gmail.com","password":"admin123"}' \
    | node -e 'let b="";process.stdin.on("data",p=>b+=p).on("end",()=>process.stdout.write(JSON.parse(b).data.accessToken))'
)
tenant_id=$(db_value "SELECT id FROM tenants WHERE slug='demo-salon'")

curl -fsS "$API_BASE/admin/packages/form-options" \
  -H "Authorization: Bearer $admin_token" >"$TMP_DIR/options.json"
service_key=$(node -e '
  const p=require(process.argv[1]); const d=p.data||p;
  const row=(d.templates||[])[0]; if(!row?.service_key) throw new Error("service_key_missing");
  process.stdout.write(row.service_key);
' "$TMP_DIR/options.json")

curl -fsS -X POST "$API_BASE/admin/packages" \
  -H "Authorization: Bearer $admin_token" \
  -H 'Content-Type: application/json' \
  --data "{
    \"title\":\"E2E Paket Faturalama\",
    \"total_credits\":12,
    \"weekly_class_hours\":3,
    \"duration_days\":30,
    \"service_key\":\"$service_key\",
    \"display_price\":1500,
    \"trainer_commission_rate\":30,
    \"capacity\":1,
    \"is_visible\":true,
    \"is_public\":true
  }" >"$TMP_DIR/package-create.json"
package_id=$(node -e 'const p=require(process.argv[1]);process.stdout.write(String((p.data||p).id))' "$TMP_DIR/package-create.json")

[ "$(db_value "SELECT total_credits || ':' || duration_days || ':' || (rules->>'weekly_class_hours') FROM packages WHERE id='$package_id'")" = "12:30:3" ] || {
  echo "Paket oluşturma alanları PostgreSQL'e doğru yazılmadı" >&2
  exit 1
}

curl -fsS -X PUT "$API_BASE/admin/packages/$package_id" \
  -H "Authorization: Bearer $admin_token" \
  -H 'Content-Type: application/json' \
  --data "{
    \"title\":\"E2E Paket Faturalama Güncel\",
    \"total_credits\":16,
    \"weekly_class_hours\":4,
    \"duration_days\":60,
    \"service_key\":\"$service_key\",
    \"display_price\":2000,
    \"trainer_commission_rate\":35,
    \"capacity\":1
  }" >"$TMP_DIR/package-update.json"

[ "$(db_value "SELECT title || ':' || total_credits || ':' || duration_days || ':' || display_price || ':' || (rules->>'weekly_class_hours') || ':' || (rules->>'trainer_commission_rate') FROM packages WHERE id='$package_id'")" = "E2E Paket Faturalama Güncel:16:60:2000.00:4:35" ] || {
  echo "Paket güncelleme alanları PostgreSQL'e doğru yazılmadı" >&2
  exit 1
}

now_ms=$(node -e 'process.stdout.write(String(Date.now()))')
future_30_ms=$(node -e 'process.stdout.write(String(Date.now()+30*24*60*60*1000))')
future_60_ms=$(node -e 'process.stdout.write(String(Date.now()+60*24*60*60*1000))')
past_ms=$(node -e 'process.stdout.write(String(Date.now()-1000))')

send_event() {
  event_type="$1"
  event_ms="$2"
  expiration_ms="$3"
  curl -fsS -X POST "$API_BASE/billing/revenuecat/webhook" \
    -H "Authorization: $WEBHOOK_AUTH" \
    -H 'Content-Type: application/json' \
    --data "{
      \"api_version\":\"1.0\",
      \"event\":{
        \"type\":\"$event_type\",
        \"app_user_id\":\"$tenant_id\",
        \"entitlement_ids\":[\"$ENTITLEMENT_ID\"],
        \"product_id\":\"fizyoflow_admin_monthly\",
        \"period_type\":\"NORMAL\",
        \"store\":\"APP_STORE\",
        \"event_timestamp_ms\":$event_ms,
        \"purchased_at_ms\":$now_ms,
        \"expiration_at_ms\":$expiration_ms,
        \"transaction_id\":\"e2e-$event_type-$event_ms\"
      }
    }" >/dev/null
}

send_event INITIAL_PURCHASE "$now_ms" "$future_30_ms"
send_event RENEWAL "$((now_ms + 1))" "$future_60_ms"
[ "$(db_value "SELECT subscription_status || ':' || revenuecat_last_event_type FROM tenants WHERE id='$tenant_id'")" = "ACTIVE:RENEWAL" ] || {
  echo "RevenueCat yenileme olayı aboneliği uzatmadı" >&2
  exit 1
}

send_event BILLING_ISSUE "$((now_ms + 2))" "$future_60_ms"
curl -fsS "$API_BASE/admin/clinic/subscription" \
  -H "Authorization: Bearer $admin_token" >"$TMP_DIR/billing-issue.json"
node - "$TMP_DIR/billing-issue.json" <<'NODE'
const p=require(process.argv[2]); const d=p.data||p;
if (d.subscription_status !== "ACTIVE" || d.has_billing_issue !== true) {
  throw new Error("billing_issue_must_warn_without_revoking_current_period");
}
NODE

send_event CANCELLATION "$((now_ms + 3))" "$future_60_ms"
curl -fsS "$API_BASE/admin/clinic/subscription" \
  -H "Authorization: Bearer $admin_token" >"$TMP_DIR/cancellation.json"
node - "$TMP_DIR/cancellation.json" <<'NODE'
const p=require(process.argv[2]); const d=p.data||p;
if (d.subscription_status !== "ACTIVE" || d.will_renew !== false) {
  throw new Error("cancellation_must_keep_current_period_and_disable_renewal");
}
NODE

send_event EXPIRATION "$((now_ms + 4))" "$past_ms"
[ "$(db_value "SELECT subscription_status || ':' || is_public FROM tenants WHERE id='$tenant_id'")" = "READ_ONLY:false" ] || {
  echo "Abonelik bitişi kliniği salt-okunur duruma taşımadı" >&2
  exit 1
}

send_event INITIAL_PURCHASE "$((now_ms + 5))" "$future_30_ms"
[ "$(db_value "SELECT subscription_status || ':' || is_public FROM tenants WHERE id='$tenant_id'")" = "ACTIVE:true" ] || {
  echo "Yeni satın alma bitmiş aboneliği yeniden aktifleştirmedi" >&2
  exit 1
}

curl -fsS -X DELETE "$API_BASE/admin/packages/$package_id" \
  -H "Authorization: Bearer $admin_token" >/dev/null

echo "{\"package_create\":\"passed\",\"package_update\":\"passed\",\"weekly_rule\":\"4\",\"renewal\":\"passed\",\"billing_issue\":\"warning-with-access\",\"cancellation\":\"active-until-expiry\",\"expiration\":\"read-only\",\"repurchase\":\"active\"}"
