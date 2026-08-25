#!/bin/sh
set -eu

CASE_NAME="${1:?fixture case is required}"
DATABASE_URL=${DATABASE_URL:-postgresql://fizyoflow_e2e:fizyoflow_e2e@127.0.0.1:55433/fizyoflow_e2e}

case "$CASE_NAME" in
  admin-approval)
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO salon_applications
  (id, account_id, tenant_id, status, payment_status, note, source, created_at, updated_at)
SELECT
  gen_random_uuid(),
  account.id,
  tenant.id,
  'PENDING',
  'UNPAID',
  'E2E yönetici başvuru onayı',
  'CATALOG',
  now(),
  now()
FROM accounts account
CROSS JOIN tenants tenant
WHERE account.email = 'member.intake.e2e@demo.local'
  AND tenant.slug = 'demo-salon';
SQL
    ;;
  notification-delivery)
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO device_tokens
  (id, tenant_id, member_id, platform, token, is_active, last_seen_at, created_at, updated_at)
SELECT
  gen_random_uuid(),
  user_record.tenant_id,
  user_record.id,
  'IOS',
  'ExponentPushToken[e2e-' || replace(user_record.id::text, '-', '') || ']',
  true,
  now(),
  now(),
  now()
FROM users user_record
JOIN tenants tenant ON tenant.id = user_record.tenant_id
WHERE tenant.slug = 'demo-salon'
  AND user_record.is_active = true
ON CONFLICT (token) DO UPDATE
SET is_active = true,
    last_seen_at = now(),
    updated_at = now();
SQL
    ;;
  trainer-daily-schedule)
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
WITH refs AS (
  SELECT
    tenant.id AS tenant_id,
    member_user.id AS member_id,
    trainer_user.id AS trainer_id,
    package.id AS package_id
  FROM tenants tenant
  JOIN users member_user
    ON member_user.tenant_id = tenant.id
   AND member_user.email = 'member@gmail.com'
  JOIN users trainer_user
    ON trainer_user.tenant_id = tenant.id
   AND trainer_user.email = 'elisauyar@gmail.com'
  JOIN packages package
    ON package.tenant_id = tenant.id
   AND package.type = 'PT'
  WHERE tenant.slug = 'demo-salon'
),
fixture_slots AS (
  SELECT
    refs.*,
    (date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') + interval '1 day 18 hours') AT TIME ZONE 'Europe/Istanbul' AS booking_start,
    (date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') + interval '1 day 19 hours') AT TIME ZONE 'Europe/Istanbul' AS booking_end,
    (date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') + interval '2 days 18 hours') AT TIME ZONE 'Europe/Istanbul' AS alternative_start,
    (date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') + interval '2 days 19 hours') AT TIME ZONE 'Europe/Istanbul' AS alternative_end
  FROM refs
)
INSERT INTO availabilities
  (id, tenant_id, member_id, package_id, starts_at, ends_at, note, created_at, updated_at)
SELECT gen_random_uuid(), tenant_id, member_id, package_id, booking_start, booking_end,
       'E2E gelecek PT başlangıç saati', now(), now()
FROM fixture_slots
UNION ALL
SELECT gen_random_uuid(), tenant_id, member_id, package_id, alternative_start, alternative_end,
       'E2E gelecek PT alternatif saati', now(), now()
FROM fixture_slots;

WITH refs AS (
  SELECT
    tenant.id AS tenant_id,
    member_user.id AS member_id,
    trainer_user.id AS trainer_id,
    package.id AS package_id
  FROM tenants tenant
  JOIN users member_user
    ON member_user.tenant_id = tenant.id
   AND member_user.email = 'member@gmail.com'
  JOIN users trainer_user
    ON trainer_user.tenant_id = tenant.id
   AND trainer_user.email = 'elisauyar@gmail.com'
  JOIN packages package
    ON package.tenant_id = tenant.id
   AND package.type = 'PT'
  WHERE tenant.slug = 'demo-salon'
)
INSERT INTO bookings
  (id, tenant_id, member_id, trainer_id, starts_at, ends_at, status, payment_status,
   payment_requested_at, payment_approved_at, meta, created_at, updated_at)
SELECT
  gen_random_uuid(),
  tenant_id,
  member_id,
  trainer_id,
  (date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') + interval '1 day 18 hours') AT TIME ZONE 'Europe/Istanbul',
  (date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') + interval '1 day 19 hours') AT TIME ZONE 'Europe/Istanbul',
  'APPROVED',
  'APPROVED',
  now(),
  now(),
  jsonb_build_object(
    'package_id', package_id,
    'package_title', 'PT',
    'service_name', 'E2E Gelecek PT Seansı',
    'lesson_category', 'PT'
  ),
  now(),
  now()
FROM refs;
SQL
    ;;
  trainer-manual-checkin)
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
WITH target_session AS (
  UPDATE class_sessions
  SET starts_at = now() - interval '10 minutes',
      ends_at = now() + interval '50 minutes',
      updated_at = now()
  WHERE title = 'Bugünkü Reformer Seansı'
    AND tenant_id = (SELECT id FROM tenants WHERE slug = 'demo-salon')
  RETURNING id, starts_at, ends_at
)
UPDATE bookings booking
SET starts_at = target_session.starts_at,
    ends_at = target_session.ends_at,
    updated_at = now()
FROM target_session
WHERE booking.session_id = target_session.id;
SQL
    ;;
  *)
    echo "Bilinmeyen fonksiyonel E2E fixture durumu: $CASE_NAME" >&2
    exit 2
    ;;
esac

printf '%s fixture ready\n' "$CASE_NAME"
