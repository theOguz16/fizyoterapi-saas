#!/bin/sh
set -eu

DATABASE_URL="${E2E_DATABASE_URL:-postgresql://fizyoflow_e2e:fizyoflow_e2e@127.0.0.1:55433/fizyoflow_e2e}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  demo_tenant uuid;
  demo_member uuid;
  demo_package uuid;
  monday_start timestamptz;
  tuesday_start timestamptz;
BEGIN
  SELECT id INTO demo_tenant FROM tenants WHERE slug = 'demo-salon';
  SELECT id INTO demo_member
  FROM users
  WHERE tenant_id = demo_tenant AND email = 'member@gmail.com' AND role = 'MEMBER';
  SELECT id INTO demo_package
  FROM packages
  WHERE tenant_id = demo_tenant AND title = 'PT Bireysel Ders';

  DELETE FROM notification_events
  WHERE tenant_id = demo_tenant
    AND type = 'TRAINER_SCHEDULE_CHANGE_REQUEST'
    AND member_id = demo_member;
  DELETE FROM bookings WHERE tenant_id = demo_tenant AND member_id = demo_member;
  DELETE FROM availabilities WHERE tenant_id = demo_tenant AND member_id = demo_member;

  monday_start :=
    (date_trunc('week', now() AT TIME ZONE 'Europe/Istanbul') + interval '7 days 10 hours')
    AT TIME ZONE 'Europe/Istanbul';
  tuesday_start := monday_start + interval '1 day 4 hours';

  INSERT INTO availabilities
    (id, tenant_id, member_id, package_id, starts_at, ends_at, note, created_at, updated_at)
  VALUES
    (gen_random_uuid(), demo_tenant, demo_member, demo_package, monday_start, monday_start + interval '1 hour',
      'Randevu zinciri E2E alternatif 1', now(), now()),
    (gen_random_uuid(), demo_tenant, demo_member, demo_package, tuesday_start, tuesday_start + interval '1 hour',
      'Randevu zinciri E2E alternatif 2', now(), now());
END $$;
SQL

echo "appointment-calendar-e2e fixture ready"
