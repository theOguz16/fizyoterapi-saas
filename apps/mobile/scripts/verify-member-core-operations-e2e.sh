#!/bin/sh
set -eu

DATABASE_URL=${DATABASE_URL:-postgresql://fizyoflow_e2e:fizyoflow_e2e@127.0.0.1:55433/fizyoflow_e2e}

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  account_id_value uuid;
  member_user_id uuid;
  membership_status text;
  membership_active boolean;
  member_active boolean;
  remaining_total integer;
  canceled_bookings integer;
  canceled_group_requests integer;
  preferences jsonb;
BEGIN
  SELECT id, notification_preferences
    INTO account_id_value, preferences
    FROM accounts
   WHERE email = 'member@gmail.com';

  SELECT user_id, status::text, is_active_context
    INTO member_user_id, membership_status, membership_active
    FROM salon_memberships
   WHERE account_id = account_id_value
   ORDER BY updated_at DESC
   LIMIT 1;

  SELECT is_active INTO member_active FROM users WHERE id = member_user_id;
  SELECT COALESCE(SUM(remaining_credits), 0) INTO remaining_total
    FROM user_packages
   WHERE user_id = member_user_id AND is_active = true;
  SELECT COUNT(*) INTO canceled_bookings
    FROM bookings
   WHERE member_id = member_user_id AND status::text = 'CANCELED';
  SELECT COUNT(*) INTO canceled_group_requests
    FROM notification_events
   WHERE member_id = member_user_id
     AND type = 'MEMBER_PAYMENT_REQUEST'
     AND payload->>'request_type' = 'GROUP_CLASS_JOIN'
     AND payload->>'decision' = 'CANCELED';

  IF remaining_total <> 18 THEN
    RAISE EXCEPTION 'Beklenen toplam hak 18, bulunan %', remaining_total;
  END IF;
  IF canceled_bookings < 1 THEN
    RAISE EXCEPTION 'Iptal edilmis randevu kaydi bulunamadi';
  END IF;
  IF canceled_group_requests < 1 THEN
    RAISE EXCEPTION 'Geri cekilmis grup dersi talebi bulunamadi';
  END IF;
  IF COALESCE((preferences->>'campaign_alerts')::boolean, true) <> false THEN
    RAISE EXCEPTION 'Kampanya bildirimi tercihi sunucuda false degil: %', preferences;
  END IF;
  IF COALESCE((preferences->>'weekly_summary')::boolean, true) <> false THEN
    RAISE EXCEPTION 'Haftalik ozet tercihi sunucuda false degil: %', preferences;
  END IF;
  IF membership_status <> 'LEFT' OR membership_active <> false THEN
    RAISE EXCEPTION 'Salon uyeligi sonlanmadi: status=%, active=%', membership_status, membership_active;
  END IF;
  IF member_active <> false THEN
    RAISE EXCEPTION 'Tenant kullanicisi pasif olmadi';
  END IF;

  RAISE NOTICE 'Task 8 DB dogrulamasi basarili: rights=%, canceled_bookings=%, canceled_group_requests=%, membership=%',
    remaining_total, canceled_bookings, canceled_group_requests, membership_status;
END $$;
SQL
