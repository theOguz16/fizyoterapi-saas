#!/bin/sh
set -eu

API_BASE="${E2E_API_BASE:-http://127.0.0.1:4949/api}"
DATABASE_URL="${E2E_DATABASE_URL:-postgresql://fizyoflow_e2e:fizyoflow_e2e@127.0.0.1:55433/fizyoflow_e2e}"
TMP_DIR=$(mktemp -d /tmp/fizyoflow-calendar-e2e.XXXXXX)
trap 'rm -rf "$TMP_DIR"' EXIT

db_value() {
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "$1"
}

login() {
  email="$1"
  password="$2"
  curl -fsS -X POST "$API_BASE/auth/login" \
    -H 'Content-Type: application/json' \
    --data "{\"email\":\"$email\",\"password\":\"$password\"}" \
    | node -e 'let body="";process.stdin.on("data",p=>body+=p).on("end",()=>process.stdout.write(JSON.parse(body).data.accessToken))'
}

request_status() {
  method="$1"
  path="$2"
  token="$3"
  body="${4:-}"
  output="$5"
  if [ -n "$body" ]; then
    curl -sS -o "$output" -w '%{http_code}' -X "$method" "$API_BASE$path" \
      -H "Authorization: Bearer $token" \
      -H 'Content-Type: application/json' \
      --data "$body"
  else
    curl -sS -o "$output" -w '%{http_code}' -X "$method" "$API_BASE$path" \
      -H "Authorization: Bearer $token"
  fi
}

admin_token=$(login 'oguzhanuyar531@gmail.com' 'admin123')
trainer_token=$(login 'elisauyar@gmail.com' 'trainer123')
member_token=$(login 'member@gmail.com' 'member123')
test1_token=$(login 'test1.user@demo.local' 'member123')

tenant_id=$(db_value "SELECT id FROM tenants WHERE slug='demo-salon'")
trainer_id=$(db_value "SELECT id FROM users WHERE tenant_id='$tenant_id' AND email='elisauyar@gmail.com'")
member_id=$(db_value "SELECT id FROM users WHERE tenant_id='$tenant_id' AND email='member@gmail.com'")
test1_id=$(db_value "SELECT id FROM users WHERE tenant_id='$tenant_id' AND email='test1.user@demo.local'")
test2_id=$(db_value "SELECT id FROM users WHERE tenant_id='$tenant_id' AND email='test2.user@demo.local'")
test3_id=$(db_value "SELECT id FROM users WHERE tenant_id='$tenant_id' AND email='test3.user@demo.local'")
package_id=$(db_value "SELECT id FROM packages WHERE tenant_id='$tenant_id' AND title='PT Bireysel Ders'")

core_row=$(db_value "
  SELECT id || '|' || status || '|' || starts_at::text || '|' ||
    COALESCE(jsonb_array_length(COALESCE(meta->'reschedule_history','[]'::jsonb)),0)::text
  FROM bookings
  WHERE tenant_id='$tenant_id' AND member_id='$member_id'
  ORDER BY created_at DESC LIMIT 1
")
IFS='|' read -r core_booking_id core_status core_starts_at core_history <<EOF
$core_row
EOF
[ "$core_status" = "RESCHEDULED" ] && [ "$core_history" -ge 1 ] || {
  echo "Ana randevu yeniden planlama DB doğrulaması başarısız: $core_row" >&2
  exit 1
}

request_states=$(db_value "
  SELECT string_agg(payload->>'status', ',' ORDER BY created_at)
  FROM notification_events
  WHERE tenant_id='$tenant_id'
    AND member_id='$member_id'
    AND type='TRAINER_SCHEDULE_CHANGE_REQUEST'
")
case "$request_states" in
  *REJECTED*APPROVED*|*APPROVED*REJECTED*) ;;
  *) echo "Kabul/ret talep zinciri doğrulanamadı: $request_states" >&2; exit 1 ;;
esac

from_date=$(node -e 'const d=new Date();d.setDate(d.getDate()-1);process.stdout.write(d.toISOString())')
to_date=$(node -e 'const d=new Date();d.setDate(d.getDate()+21);process.stdout.write(d.toISOString())')
for role in admin trainer member; do
  eval "role_token=\${${role}_token}"
  curl -fsS "$API_BASE/calendar/feed?from=$from_date&to=$to_date" \
    -H "Authorization: Bearer $role_token" >"$TMP_DIR/calendar-$role.json"
  BOOKING_ID="$core_booking_id" EXPECTED_START="$core_starts_at" node - "$TMP_DIR/calendar-$role.json" <<'NODE'
const fs = require("fs");
const payload = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const feed = payload.data || payload;
const event = (feed.events || []).find((row) => String(row.details?.booking_id) === process.env.BOOKING_ID);
if (!event || new Date(event.starts_at).getTime() !== new Date(process.env.EXPECTED_START).getTime()) process.exit(1);
NODE
done

future_start=$(node -e 'const d=new Date();d.setDate(d.getDate()+8);d.setHours(10,0,0,0);process.stdout.write(d.toISOString())')
future_end=$(node -e 'const d=new Date();d.setDate(d.getDate()+8);d.setHours(11,0,0,0);process.stdout.write(d.toISOString())')
past_start=$(node -e 'const d=new Date();d.setDate(d.getDate()-1);d.setHours(10,0,0,0);process.stdout.write(d.toISOString())')
past_end=$(node -e 'const d=new Date();d.setDate(d.getDate()-1);d.setHours(11,0,0,0);process.stdout.write(d.toISOString())')

past_body="{\"member_id\":\"$test1_id\",\"trainer_id\":\"$trainer_id\",\"starts_at\":\"$past_start\",\"ends_at\":\"$past_end\",\"status\":\"APPROVED\"}"
status=$(request_status POST /admin/bookings "$admin_token" "$past_body" "$TMP_DIR/past.json")
[ "$status" = "409" ] && grep -q 'BOOKING_IN_PAST' "$TMP_DIR/past.json" || {
  echo "Geçmiş saat koruması başarısız: HTTP $status" >&2
  exit 1
}

double_body="{\"member_id\":\"$test1_id\",\"trainer_id\":\"$trainer_id\",\"starts_at\":\"$future_start\",\"ends_at\":\"$future_end\",\"status\":\"APPROVED\",\"meta\":{\"package_id\":\"$package_id\",\"package_title\":\"PT Bireysel Ders\",\"e2e_case\":\"double-submit\"}}"
status=$(request_status POST /admin/bookings "$admin_token" "$double_body" "$TMP_DIR/double-first.json")
[ "$status" = "201" ] || { echo "Çift gönderim ilk kayıt başarısız: HTTP $status" >&2; exit 1; }
double_booking_id=$(node -e 'const p=require(process.argv[1]);process.stdout.write((p.data||p).id)' "$TMP_DIR/double-first.json")
status=$(request_status POST /admin/bookings "$admin_token" "$double_body" "$TMP_DIR/double-second.json")
[ "$status" = "409" ] && grep -Eq 'TRAINER_OVERLAP|MEMBER_OVERLAP' "$TMP_DIR/double-second.json" || {
  echo "Çift gönderim ikinci kayıt engellenmedi: HTTP $status" >&2
  exit 1
}
[ "$(db_value "SELECT count(*) FROM bookings WHERE tenant_id='$tenant_id' AND meta->>'e2e_case'='double-submit'")" = "1" ] || {
  echo "Çift gönderim DB'de birden fazla kayıt üretti" >&2
  exit 1
}

cancel_status=$(request_status PATCH "/member/bookings/$double_booking_id/cancel" "$test1_token" "" "$TMP_DIR/cancel-first.json")
[ "$cancel_status" = "200" ] || { echo "İlk iptal başarısız: HTTP $cancel_status" >&2; exit 1; }
cancel_status=$(request_status PATCH "/member/bookings/$double_booking_id/cancel" "$test1_token" "" "$TMP_DIR/cancel-second.json")
[ "$cancel_status" = "200" ] && grep -q 'zaten iptal' "$TMP_DIR/cancel-second.json" || {
  echo "Tekrarlanan iptal idempotent değil: HTTP $cancel_status" >&2
  exit 1
}

session_start=$(node -e 'const d=new Date();d.setDate(d.getDate()+9);d.setHours(14,0,0,0);process.stdout.write(d.toISOString())')
session_end=$(node -e 'const d=new Date();d.setDate(d.getDate()+9);d.setHours(15,0,0,0);process.stdout.write(d.toISOString())')
session_id=$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -qAt \
  -v tenant="$tenant_id" -v trainer="$trainer_id" -v package="$package_id" \
  -v starts="$session_start" -v ends="$session_end" <<'SQL'
INSERT INTO class_sessions
  (id, tenant_id, type, status, trainer_id, related_package_id, title, starts_at, ends_at,
   capacity, lesson_category, notification_scope, requires_admin_approval, invited_member_count,
   meta, created_at, updated_at)
VALUES
  (gen_random_uuid(), :'tenant', 'PT', 'SCHEDULED', :'trainer', :'package',
   'Kapasite E2E Seansı', :'starts', :'ends', 1, 'PT', 'SALON_MEMBERS', false, 0,
   '{}'::jsonb, now(), now())
RETURNING id;
SQL
)
capacity_first="{\"member_id\":\"$test2_id\",\"trainer_id\":\"$trainer_id\",\"session_id\":\"$session_id\",\"starts_at\":\"$session_start\",\"ends_at\":\"$session_end\",\"status\":\"APPROVED\"}"
status=$(request_status POST /admin/bookings "$admin_token" "$capacity_first" "$TMP_DIR/capacity-first.json")
[ "$status" = "201" ] || { echo "Kapasite ilk kayıt başarısız: HTTP $status" >&2; exit 1; }
capacity_second="{\"member_id\":\"$test3_id\",\"trainer_id\":\"$trainer_id\",\"session_id\":\"$session_id\",\"starts_at\":\"$session_start\",\"ends_at\":\"$session_end\",\"status\":\"APPROVED\"}"
status=$(request_status POST /admin/bookings "$admin_token" "$capacity_second" "$TMP_DIR/capacity-second.json")
[ "$status" = "409" ] && grep -q 'SESSION_CAPACITY_FULL' "$TMP_DIR/capacity-second.json" || {
  echo "Kapasite sınırı engellenmedi: HTTP $status" >&2
  exit 1
}

echo "{\"booking\":\"$core_booking_id\",\"status\":\"$core_status\",\"requests\":\"$request_states\",\"calendars\":\"admin,trainer,member\",\"past\":\"blocked\",\"double_submit\":\"one-row\",\"cancel\":\"idempotent\",\"capacity\":\"blocked\"}"
