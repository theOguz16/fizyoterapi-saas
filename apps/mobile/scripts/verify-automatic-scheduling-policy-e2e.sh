#!/bin/sh
set -eu

API_BASE="${E2E_API_BASE:-http://127.0.0.1:4949/api}"
DATABASE_URL="${E2E_DATABASE_URL:-postgresql://fizyoflow_e2e:fizyoflow_e2e@127.0.0.1:55433/fizyoflow_e2e}"
TMP_DIR=$(mktemp -d /tmp/fizyoflow-auto-schedule-e2e.XXXXXX)
trap 'rm -rf "$TMP_DIR"' EXIT

db_value() {
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "$1"
}

login() {
  curl -fsS -X POST "$API_BASE/auth/login" \
    -H 'Content-Type: application/json' \
    --data "{\"email\":\"$1\",\"password\":\"$2\"}" \
    | node -e 'let b="";process.stdin.on("data",p=>b+=p).on("end",()=>process.stdout.write(JSON.parse(b).data.accessToken))'
}

request_status() {
  method="$1"
  path="$2"
  token="$3"
  body="$4"
  output="$5"
  curl -sS -o "$output" -w '%{http_code}' -X "$method" "$API_BASE$path" \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    --data "$body"
}

admin_token=$(login 'oguzhanuyar531@gmail.com' 'admin123')
trainer_token=$(login 'elisauyar@gmail.com' 'trainer123')
member_token=$(login 'member@gmail.com' 'member123')

tenant_id=$(db_value "SELECT id FROM tenants WHERE slug='demo-salon'")
trainer_id=$(db_value "SELECT id FROM users WHERE tenant_id='$tenant_id' AND email='elisauyar@gmail.com'")
member_id=$(db_value "SELECT id FROM users WHERE tenant_id='$tenant_id' AND email='member@gmail.com'")
package_id=$(db_value "SELECT id FROM packages WHERE tenant_id='$tenant_id' AND title='PT Bireysel Ders'")

curl -fsS "$API_BASE/public/salons/demo-salon/day-options?package_ids=$package_id" >"$TMP_DIR/day-options.json"
PACKAGE_ID="$package_id" TRAINER_ID="$trainer_id" node - "$TMP_DIR/day-options.json" >"$TMP_DIR/purchase.json" <<'NODE'
const fs = require("fs");
const payload = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const source = payload.data || payload;
const byDay = new Map();
for (const slot of source) {
  const day = String(slot.starts_at).slice(0, 10);
  if (!byDay.has(day)) byDay.set(day, []);
  if (byDay.get(day).length < 3) byDay.get(day).push(slot);
}
const selected = Array.from(byDay.values()).filter((rows) => rows.length >= 3).slice(0, 2).flat();
const slots = selected.map((slot) => ({
  starts_at: slot.starts_at,
  ends_at: slot.ends_at,
  label: slot.label,
  weekday_label: slot.weekday_label,
  time_range_label: slot.time_range_label,
  package_id: process.env.PACKAGE_ID,
  package_title: "PT Bireysel Ders",
}));
if (slots.length !== 6) throw new Error("six_preferences_on_two_distinct_days_required");
process.stdout.write(JSON.stringify({
  tenant_slug: "demo-salon",
  package_id: process.env.PACKAGE_ID,
  package_ids: [process.env.PACKAGE_ID],
  trainer_id: process.env.TRAINER_ID,
  selected_days: slots,
  note: "automatic-scheduling-e2e",
}));
NODE

status=$(request_status POST /member/purchase-requests "$member_token" "$(cat "$TMP_DIR/purchase.json")" "$TMP_DIR/purchase-response.json")
[ "$status" = "201" ] || { echo "Paket yenileme başvurusu başarısız: HTTP $status $(cat "$TMP_DIR/purchase-response.json")" >&2; exit 1; }
request_id=$(node -e 'const p=require(process.argv[1]);process.stdout.write((p.data||p).id)' "$TMP_DIR/purchase-response.json")

status=$(request_status PATCH "/admin/mobile-approvals/payment:$request_id" "$admin_token" '{"decision":"APPROVE"}' "$TMP_DIR/approval.json")
[ "$status" = "200" ] || { echo "Yönetici ödeme onayı başarısız: HTTP $status $(cat "$TMP_DIR/approval.json")" >&2; exit 1; }

package_credits=$(db_value "SELECT total_credits FROM packages WHERE id='$package_id'")
package_weekly=$(db_value "
  SELECT LEAST(
    7,
    GREATEST(
      1,
      COALESCE(
        (rules->>'weekly_class_hours')::int,
        ROUND(total_credits / GREATEST(1, duration_days::numeric / 7))::int
      )
    )
  )
  FROM packages WHERE id='$package_id'
")
activated_package=$(db_value "
  SELECT (package_snapshot->>'total_credits') || ':' || remaining_credits
  FROM user_packages
  WHERE tenant_id='$tenant_id' AND user_id='$member_id' AND source_request_id='$request_id'
")
[ "$activated_package" = "$package_credits:$package_credits" ] || {
  echo "Yönetici onayı paket haklarını mobile doğru yansıtmadı: $activated_package, beklenen $package_credits:$package_credits" >&2
  exit 1
}
member_weekly=$(db_value "SELECT weekly_class_hours FROM users WHERE id='$member_id'")
[ "$member_weekly" = "$package_weekly" ] || {
  echo "Haftalık ders kuralı üyeye yansımadı: $member_weekly, beklenen $package_weekly" >&2
  exit 1
}

booking_count=$(db_value "
  SELECT count(*) FROM bookings
  WHERE tenant_id='$tenant_id'
    AND member_id='$member_id'
    AND meta->>'request_id'='$request_id'
    AND meta->>'source'='AUTOMATIC_PURCHASE_SCHEDULER'
")
[ "$booking_count" = "2" ] || { echo "6 tercihten haftalık 2 yerine $booking_count kesin ders üretildi" >&2; exit 1; }
booking_day_count=$(db_value "
  SELECT count(DISTINCT ((starts_at AT TIME ZONE 'Europe/Istanbul')::date)) FROM bookings
  WHERE tenant_id='$tenant_id'
    AND member_id='$member_id'
    AND meta->>'request_id'='$request_id'
    AND meta->>'source'='AUTOMATIC_PURCHASE_SCHEDULER'
")
[ "$booking_day_count" = "2" ] || { echo "Haftalık 2 ders farklı günlere dağılmadı: $booking_day_count gün" >&2; exit 1; }
preference_count=$(db_value "
  SELECT count(*) FROM availabilities
  WHERE tenant_id='$tenant_id' AND member_id='$member_id' AND package_id='$package_id'
")
[ "$preference_count" = "6" ] || { echo "Tercih havuzu 6 kayıt içermiyor: $preference_count" >&2; exit 1; }
curl -fsS "$API_BASE/trainer/bookings/availabilities" \
  -H "Authorization: Bearer $trainer_token" >"$TMP_DIR/trainer-availabilities.json"
MEMBER_ID="$member_id" node - "$TMP_DIR/trainer-availabilities.json" <<'NODE'
const payload = require(process.argv[2]);
const rows = (payload.data || payload).filter((row) => row.member_id === process.env.MEMBER_ID);
if (rows.length !== 6) throw new Error(`expected_six_member_preferences_received_${rows.length}`);
if (rows.some((row) => row.action_required !== false || row.availability_kind !== "AUTOMATIC_SCHEDULING_PREFERENCE")) {
  throw new Error("automatic_preferences_must_not_be_trainer_action_requests");
}
NODE
booking_ids=$(db_value "
  SELECT string_agg(id::text, ',' ORDER BY starts_at) FROM bookings
  WHERE tenant_id='$tenant_id' AND meta->>'request_id'='$request_id'
")
first_booking_id=${booking_ids%%,*}
second_booking_id=${booking_ids#*,}

status=$(request_status POST "/trainer/bookings/$first_booking_id/schedule-change-request" "$trainer_token" "{\"member_id\":\"$member_id\"}" "$TMP_DIR/change.json")
[ "$status" = "201" ] && grep -q 'AUTOMATIC_MEMBER_PREFERENCE' "$TMP_DIR/change.json" || {
  echo "Eğitmen otomatik alternatif önerisi başarısız: HTTP $status $(cat "$TMP_DIR/change.json")" >&2
  exit 1
}
change_request_id=$(node -e 'const p=require(process.argv[1]);process.stdout.write((p.data||p).request_id)' "$TMP_DIR/change.json")
credit_before_change=$(db_value "SELECT remaining_credits FROM user_packages WHERE tenant_id='$tenant_id' AND user_id='$member_id' AND source_request_id='$request_id'")
status=$(request_status PATCH "/member/schedule-change-requests/$change_request_id" "$member_token" '{"decision":"APPROVE"}' "$TMP_DIR/change-approve.json")
[ "$status" = "200" ] || { echo "Danışan alternatif saat onayı başarısız: HTTP $status" >&2; exit 1; }
credit_after_change=$(db_value "SELECT remaining_credits FROM user_packages WHERE tenant_id='$tenant_id' AND user_id='$member_id' AND source_request_id='$request_id'")
[ "$credit_before_change" = "$credit_after_change" ] || { echo "Eğitmen değişikliğinde paket hakkı değişti" >&2; exit 1; }
[ "$(db_value "SELECT status FROM bookings WHERE id='$first_booking_id'")" = "RESCHEDULED" ] || {
  echo "Otomatik alternatif kabul sonrası randevu güncellenmedi" >&2
  exit 1
}

credit_before_early=$(db_value "SELECT remaining_credits FROM user_packages WHERE tenant_id='$tenant_id' AND user_id='$member_id' AND source_request_id='$request_id'")
status=$(request_status PATCH "/member/bookings/$second_booking_id/cancel" "$member_token" '{}' "$TMP_DIR/early-cancel.json")
[ "$status" = "200" ] && grep -q '"credit_preserved":true' "$TMP_DIR/early-cancel.json" || {
  echo "Erken iptal başarısız: HTTP $status $(cat "$TMP_DIR/early-cancel.json")" >&2
  exit 1
}
credit_after_early=$(db_value "SELECT remaining_credits FROM user_packages WHERE tenant_id='$tenant_id' AND user_id='$member_id' AND source_request_id='$request_id'")
[ "$credit_before_early" = "$credit_after_early" ] || { echo "Erken iptalde paket hakkı düştü" >&2; exit 1; }

user_package_id=$(db_value "SELECT id FROM user_packages WHERE tenant_id='$tenant_id' AND user_id='$member_id' AND source_request_id='$request_id'")
late_booking_id=$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -qAt \
  -v tenant="$tenant_id" -v member="$member_id" -v trainer="$trainer_id" -v package="$package_id" -v up="$user_package_id" <<'SQL'
INSERT INTO bookings
  (id, tenant_id, member_id, trainer_id, starts_at, ends_at, status, payment_status,
   checkin_status, credits_charged, meta, created_at, updated_at)
VALUES
  (gen_random_uuid(), :'tenant', :'member', :'trainer', now() + interval '2 hours',
   now() + interval '3 hours', 'APPROVED', 'APPROVED', 'PENDING', 0,
   jsonb_build_object('package_id', :'package', 'user_package_id', :'up', 'e2e_case', 'late-cancel'),
   now(), now())
RETURNING id;
SQL
)
status=$(request_status PATCH "/member/bookings/$late_booking_id/cancel" "$member_token" '{}' "$TMP_DIR/late-unconfirmed.json")
[ "$status" = "409" ] && grep -q 'LATE_CANCELLATION_CONFIRMATION_REQUIRED' "$TMP_DIR/late-unconfirmed.json" || {
  echo "Geç iptal onaysız engellenmedi: HTTP $status" >&2
  exit 1
}
credit_before_late=$(db_value "SELECT remaining_credits FROM user_packages WHERE id='$user_package_id'")
status=$(request_status PATCH "/member/bookings/$late_booking_id/cancel" "$member_token" '{"confirm_late_cancellation":true}' "$TMP_DIR/late-confirmed.json")
[ "$status" = "200" ] && grep -q '"credits_deducted":1' "$TMP_DIR/late-confirmed.json" || {
  echo "Onaylı geç iptal başarısız: HTTP $status $(cat "$TMP_DIR/late-confirmed.json")" >&2
  exit 1
}
credit_after_late=$(db_value "SELECT remaining_credits FROM user_packages WHERE id='$user_package_id'")
[ "$((credit_before_late - 1))" = "$credit_after_late" ] || { echo "Geç iptal tam bir hak düşürmedi" >&2; exit 1; }

no_show_booking_id=$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -qAt \
  -v tenant="$tenant_id" -v member="$member_id" -v trainer="$trainer_id" -v package="$package_id" -v up="$user_package_id" <<'SQL'
INSERT INTO bookings
  (id, tenant_id, member_id, trainer_id, starts_at, ends_at, status, payment_status,
   checkin_status, credits_charged, meta, created_at, updated_at)
VALUES
  (gen_random_uuid(), :'tenant', :'member', :'trainer', now() - interval '2 hours',
   now() - interval '1 hour', 'APPROVED', 'APPROVED', 'PENDING', 0,
   jsonb_build_object('package_id', :'package', 'user_package_id', :'up', 'e2e_case', 'no-show'),
   now(), now())
RETURNING id;
SQL
)
status=$(request_status PATCH "/trainer/bookings/$no_show_booking_id/no-show" "$trainer_token" '{}' "$TMP_DIR/no-show-unconfirmed.json")
[ "$status" = "409" ] && grep -q 'NO_SHOW_CONFIRMATION_REQUIRED' "$TMP_DIR/no-show-unconfirmed.json" || {
  echo "No-show onaysız engellenmedi: HTTP $status" >&2
  exit 1
}
credit_before_no_show=$(db_value "SELECT remaining_credits FROM user_packages WHERE id='$user_package_id'")
status=$(request_status PATCH "/trainer/bookings/$no_show_booking_id/no-show" "$trainer_token" '{"confirm_credit_charge":true}' "$TMP_DIR/no-show-confirmed.json")
[ "$status" = "200" ] && grep -q '"credits_deducted":1' "$TMP_DIR/no-show-confirmed.json" || {
  echo "Onaylı no-show başarısız: HTTP $status $(cat "$TMP_DIR/no-show-confirmed.json")" >&2
  exit 1
}
credit_after_no_show=$(db_value "SELECT remaining_credits FROM user_packages WHERE id='$user_package_id'")
[ "$((credit_before_no_show - 1))" = "$credit_after_no_show" ] || { echo "No-show tam bir hak düşürmedi" >&2; exit 1; }

echo "{\"preferences\":6,\"automatic_bookings\":2,\"automatic_booking_days\":2,\"trainer_action_requests_for_preferences\":0,\"trainer_change\":\"automatic-credit-preserved\",\"early_cancel\":\"credit-preserved\",\"late_cancel\":\"confirmed-one-credit\",\"no_show\":\"confirmed-one-credit\"}"
