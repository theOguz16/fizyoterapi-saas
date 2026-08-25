#!/bin/sh
set -eu

CASE_NAME="${1:?verification case is required}"
DATABASE_URL=${DATABASE_URL:-postgresql://fizyoflow_e2e:fizyoflow_e2e@127.0.0.1:55433/fizyoflow_e2e}

verify_sql() {
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "$1"
}

assert_value() {
  actual=$(verify_sql "$2")
  [ "$actual" = "$3" ] || {
    echo "$1 doğrulaması başarısız: bulunan '$actual', beklenen '$3'" >&2
    exit 1
  }
}

assert_positive() {
  actual=$(verify_sql "$2")
  [ "${actual:-0}" -gt 0 ] || {
    echo "$1 doğrulaması başarısız: eşleşen kayıt bulunamadı" >&2
    exit 1
  }
}

case "$CASE_NAME" in
  auth-login-member)
    assert_value "Danışan oturum audit kaydı" \
      "SELECT log.success::text || ':' || log.actor_role::text FROM audit_logs log JOIN accounts account ON account.id=log.actor_account_id WHERE log.event_type='AUTH_LOGIN' AND account.email='member@gmail.com' ORDER BY log.created_at DESC LIMIT 1" \
      "true:MEMBER"
    ;;
  auth-login-admin)
    assert_value "Yönetici oturum audit kaydı" \
      "SELECT log.success::text || ':' || log.actor_role::text FROM audit_logs log JOIN accounts account ON account.id=log.actor_account_id WHERE log.event_type='AUTH_LOGIN' AND account.email='oguzhanuyar531@gmail.com' ORDER BY log.created_at DESC LIMIT 1" \
      "true:ADMIN"
    ;;
  auth-login-trainer)
    assert_value "Eğitmen oturum audit kaydı" \
      "SELECT log.success::text || ':' || log.actor_role::text FROM audit_logs log JOIN accounts account ON account.id=log.actor_account_id WHERE log.event_type='AUTH_LOGIN' AND account.email='elisauyar@gmail.com' ORDER BY log.created_at DESC LIMIT 1" \
      "true:TRAINER"
    ;;
  connectivity-offline-recovery)
    assert_value "Offline kurtarma öncesi gerçek üye oturumu" \
      "SELECT log.success::text || ':' || log.actor_role::text FROM audit_logs log JOIN accounts account ON account.id=log.actor_account_id WHERE log.event_type='AUTH_LOGIN' AND account.email='member@gmail.com' ORDER BY log.created_at DESC LIMIT 1" \
      "true:MEMBER"
    ;;
  admin-approval)
    assert_value "Yönetici başvuru onayı" \
      "SELECT status::text FROM salon_applications WHERE note='E2E yönetici başvuru onayı' ORDER BY updated_at DESC LIMIT 1" \
      "APPROVED"
    ;;
  admin-campaign-notification)
    assert_value "Kampanya oluşturma ve pasifleştirme" \
      "SELECT is_active::text FROM campaigns WHERE name='E2E Sadakat Kampanyasi' ORDER BY created_at DESC LIMIT 1" \
      "false"
    assert_positive "Yönetici bildirim olayı" \
      "SELECT count(*) FROM notification_events WHERE type LIKE 'TEMPLATE_%' AND triggered_by_admin_id IS NOT NULL"
    assert_positive "Yönetici bildirim teslimi" \
      "SELECT count(*) FROM notification_deliveries delivery JOIN notification_events event ON event.id=delivery.event_id WHERE event.type LIKE 'TEMPLATE_%' AND delivery.status::text='SENT'"
    ;;
  admin-entry-scan)
    assert_positive "Manuel salon girişi" \
      "SELECT count(*) FROM notification_events WHERE type='SALON_ENTRY_SCAN' AND status::text='PROCESSED' AND payload->>'source'='ADMIN_ENTRY_SCAN' AND created_at > now() - interval '15 minutes'"
    ;;
  admin-group-class-approval)
    assert_value "Grup dersi yönetici onayı" \
      "SELECT status::text FROM class_sessions WHERE title='E2E Aksam Pilates' ORDER BY updated_at DESC LIMIT 1" \
      "SCHEDULED"
    assert_value "Grup dersi onay kuyruğu sonucu" \
      "SELECT status::text FROM notification_events WHERE payload->>'request_type'='GROUP_CLASS_CREATE' AND payload->>'lesson_name'='E2E Aksam Pilates' ORDER BY updated_at DESC LIMIT 1" \
      "PROCESSED"
    ;;
  admin-package-crud)
    assert_value "Paket arşivleme" \
      "SELECT is_active::text || ':' || is_visible::text || ':' || is_public::text FROM packages WHERE title='E2E CRUD Paket' ORDER BY updated_at DESC LIMIT 1" \
      "false:false:false"
    assert_value "Paket CRUD audit zinciri" \
      "SELECT count(*)::text FROM audit_logs WHERE event_type IN ('ADMIN_PACKAGE_CREATED','ADMIN_PACKAGE_UPDATED','ADMIN_PACKAGE_ARCHIVED') AND metadata->>'package_id'=(SELECT id::text FROM packages WHERE title='E2E CRUD Paket' ORDER BY updated_at DESC LIMIT 1)" \
      "4"
    ;;
  admin-salon-settings)
    assert_value "Salon profil başlığı" \
      "SELECT (hero_title LIKE 'FizyoFlow E2E Klinik Profili%')::text FROM salon_profiles profile JOIN tenants tenant ON tenant.id=profile.tenant_id WHERE tenant.slug='demo-salon'" \
      "true"
    assert_value "Çalışma günü güncellemesi" \
      "SELECT (business_hours->'working_days' @> '[7]'::jsonb)::text FROM salon_profiles profile JOIN tenants tenant ON tenant.id=profile.tenant_id WHERE tenant.slug='demo-salon'" \
      "true"
    ;;
  admin-subscription-lifecycle)
    assert_value "Abonelik geri yükleme sonucu" \
      "SELECT subscription_status::text || ':' || revenuecat_last_event_type || ':' || revenuecat_product_id FROM tenants WHERE slug='demo-salon'" \
      "ACTIVE:UNCANCELLATION:fizyoflow_plus_yearly"
    assert_value "Satın alma-iptal-geri yükleme webhook zinciri" \
      "SELECT string_agg(action, ',' ORDER BY created_at) FROM audit_logs WHERE event_type='REVENUECAT_WEBHOOK_RECEIVED' AND target_id=(SELECT id::text FROM tenants WHERE slug='demo-salon')" \
      "INITIAL_PURCHASE,CANCELLATION,UNCANCELLATION"
    assert_value "Abonelik webhookları başarıyla işlendi" \
      "SELECT count(*)::text FROM audit_logs WHERE event_type='REVENUECAT_WEBHOOK_RECEIVED' AND target_id=(SELECT id::text FROM tenants WHERE slug='demo-salon') AND success=true AND status_code=200" \
      "3"
    ;;
  admin-risk-action)
    assert_value "Riskli üye kampanya aksiyonu" \
      "SELECT audience || ':' || is_active::text FROM campaigns WHERE name='E2E Risk Takip Kampanyasi' ORDER BY created_at DESC LIMIT 1" \
      "RISK:true"
    ;;
  duo-application)
    assert_positive "Duo paket başvurusu" \
      "SELECT count(*) FROM notification_events WHERE type='MEMBER_PAYMENT_REQUEST' AND payload->>'duo_partner_name'='Duo Partner E2E' AND payload->>'duo_partner_contact'='duo.partner@example.com' AND jsonb_array_length(payload->'selected_days') >= 3"
    assert_positive "Duo salon başvurusu" \
      "SELECT count(*) FROM salon_applications WHERE note::jsonb->>'duo_partner_name'='Duo Partner E2E' AND status::text='PENDING'"
    ;;
  member-measurement)
    assert_value "Danışan ölçüm kaydı" \
      "SELECT trim(to_char(height_cm,'FM999990.00')) || ':' || trim(to_char(weight_kg,'FM999990.00')) || ':' || ((extras::jsonb)->>'note') FROM measurements WHERE (extras::jsonb)->>'note'='Smoke test measurement' ORDER BY created_at DESC LIMIT 1" \
      "178.00:74.00:Smoke test measurement"
    ;;
  member-multi-package)
    assert_value "Çoklu paket başvuru zinciri" \
      "SELECT count(DISTINCT package_id)::text FROM (SELECT jsonb_array_elements_text(payload->'package_ids') package_id FROM notification_events WHERE type='MEMBER_PAYMENT_REQUEST') rows" \
      "2"
    assert_positive "Çoklu pakette duo partner bilgisi" \
      "SELECT count(*) FROM notification_events WHERE type='MEMBER_PAYMENT_REQUEST' AND payload->>'duo_partner_name'='Coklu Partner E2E' AND payload->>'duo_partner_contact'='multi.partner@example.com'"
    assert_value "Çoklu paket salon başvurusu" \
      "SELECT jsonb_array_length(note::jsonb->'package_ids')::text FROM salon_applications WHERE account_id=(SELECT id FROM accounts WHERE email='member.intake.e2e@demo.local') ORDER BY updated_at DESC LIMIT 1" \
      "2"
    ;;
  member-onboarding-full)
    assert_value "Üye onboarding hesap zinciri" \
      "SELECT global_role_default || ':' || is_active::text FROM accounts WHERE email='member.onboarding.e2e@demo.local'" \
      "MEMBER:true"
    assert_value "Onay öncesi üyelik oluşturulmaması" \
      "SELECT count(*)::text FROM salon_memberships WHERE account_id=(SELECT id FROM accounts WHERE email='member.onboarding.e2e@demo.local')" \
      "0"
    assert_value "Üye onboarding paket başvurusu" \
      "SELECT status::text FROM salon_applications WHERE account_id=(SELECT id FROM accounts WHERE email='member.onboarding.e2e@demo.local') ORDER BY created_at DESC LIMIT 1" \
      "PENDING"
    assert_positive "Üye onboarding ödeme talebi" \
      "SELECT count(*) FROM notification_events WHERE type='MEMBER_PAYMENT_REQUEST' AND payload->>'account_id'=(SELECT id::text FROM accounts WHERE email='member.onboarding.e2e@demo.local')"
    ;;
  member-renewal-addon)
    assert_value "Yenileme ve add-on ödeme talepleri" \
      "SELECT count(*)::text FROM notification_events WHERE type='MEMBER_PAYMENT_REQUEST' AND payload->>'account_id'=(SELECT id::text FROM accounts WHERE email='member@gmail.com') AND payload->>'request_scope'='ACTIVE_MEMBERSHIP'" \
      "2"
    assert_value "Yenileme ve add-on farklı paket zinciri" \
      "SELECT count(DISTINCT payload->>'package_id')::text FROM notification_events WHERE type='MEMBER_PAYMENT_REQUEST' AND payload->>'account_id'=(SELECT id::text FROM accounts WHERE email='member@gmail.com') AND payload->>'request_scope'='ACTIVE_MEMBERSHIP'" \
      "2"
    assert_value "Mevcut grup paketi yenilemesi" \
      "SELECT count(*)::text FROM notification_events WHERE type='MEMBER_PAYMENT_REQUEST' AND payload->>'account_id'=(SELECT id::text FROM accounts WHERE email='member@gmail.com') AND payload->>'package_id'=(SELECT id::text FROM packages WHERE title='Grup Dersi (8 Kişi)' ORDER BY created_at DESC LIMIT 1)" \
      "1"
    assert_value "Yeni katalog paketi add-on başvurusu" \
      "SELECT count(*)::text FROM notification_events WHERE type='MEMBER_PAYMENT_REQUEST' AND payload->>'account_id'=(SELECT id::text FROM accounts WHERE email='member@gmail.com') AND (payload->>'package_id')::uuid NOT IN (SELECT package_id FROM user_packages WHERE user_id=(SELECT id FROM users WHERE email='member@gmail.com' AND role='MEMBER' ORDER BY created_at DESC LIMIT 1))" \
      "1"
    assert_value "Yenileme ve add-on saat seçimleri" \
      "SELECT count(*)::text FROM notification_events WHERE type='MEMBER_PAYMENT_REQUEST' AND payload->>'account_id'=(SELECT id::text FROM accounts WHERE email='member@gmail.com') AND jsonb_array_length(payload->'selected_days') >= 1" \
      "2"
    ;;
  member-referral)
    assert_value "Danışan referans kaydı" \
      "SELECT status::text || ':' || invitee_phone_or_email FROM referrals WHERE invitee_name='E2E Davetli' ORDER BY created_at DESC LIMIT 1" \
      "INVITED:e2e.referral@demo.local"
    ;;
  release-edge-cases)
    assert_positive "Mevcut üyeye ek paket başvurusu" \
      "SELECT count(*) FROM notification_events WHERE type='MEMBER_PAYMENT_REQUEST' AND payload->>'request_scope'='ACTIVE_MEMBERSHIP'"
    assert_positive "Yönetici ret sonucu" \
      "SELECT count(*) FROM notification_events WHERE payload->>'decision'='REJECTED' AND status::text='PROCESSED'"
    assert_positive "Hatalı giriş audit kaydı" \
      "SELECT count(*) FROM audit_logs WHERE event_type='AUTH_ERROR' AND success=false AND status_code=401 AND error_code='INVALID_LOGIN' AND metadata->>'action_kind'='LOGIN'"
    ;;
  account-security-three-roles)
    assert_value "Üç rolde şifre sürümü yenilendi" \
      "SELECT count(*)::text FROM accounts WHERE email IN ('oguzhanuyar531@gmail.com','elisauyar@gmail.com','member@gmail.com') AND auth_version=2" \
      "3"
    assert_value "Üç rolde şifre değişikliği audit zinciri" \
      "SELECT count(*)::text FROM audit_logs WHERE event_type='AUTH_PASSWORD_CHANGED' AND actor_account_id IN (SELECT id FROM accounts WHERE email IN ('oguzhanuyar531@gmail.com','elisauyar@gmail.com','member@gmail.com'))" \
      "3"
    assert_positive "Güvenli logout audit zinciri" \
      "SELECT count(*) FROM audit_logs WHERE event_type='AUTH_LOGOUT' AND success=true AND actor_account_id IN (SELECT id FROM accounts WHERE email IN ('oguzhanuyar531@gmail.com','elisauyar@gmail.com','member@gmail.com'))"
    ;;
  trainer-daily-operations)
    assert_positive "Eğitmen not güncellemesi" \
      "SELECT count(*) FROM trainer_member_note_history WHERE lower(note) LIKE '%danisanin guncellenmis e2e takip notu.%'"
    assert_positive "Eğitmen saat değişikliği talebi" \
      "SELECT count(*) FROM notification_events WHERE type='TRAINER_SCHEDULE_CHANGE_REQUEST' AND payload->>'status'='PENDING'"
    ;;
  trainer-client-management)
    assert_positive "Danışan detayından koç notu" \
      "SELECT count(*) FROM trainer_member_note_history WHERE note LIKE '%\"title\":\"E2E Danisan Yonetimi\"%' AND note LIKE '%\"body\":\"Danisan detayindan olusturulan takip aksiyonu.\"%'"
    ;;
  trainer-group-class-create)
    assert_value "Eğitmen grup dersi oluşturma" \
      "SELECT status::text FROM class_sessions WHERE title='E2E Aksam Pilates' ORDER BY created_at DESC LIMIT 1" \
      "PENDING"
    assert_positive "Grup dersi oluşturma onay olayı" \
      "SELECT count(*) FROM notification_events WHERE payload->>'request_type'='GROUP_CLASS_CREATE' AND payload->>'lesson_name'='E2E Aksam Pilates'"
    ;;
  trainer-group-class-full)
    assert_positive "Grup dersi oluşturma-güncelleme-silme talepleri" \
      "SELECT CASE WHEN count(DISTINCT payload->>'request_type')=3 THEN 1 ELSE 0 END FROM notification_events WHERE payload->>'lesson_name' IN ('E2E Aksam Pilates','E2E Aksam Pilates Guncel') AND payload->>'request_type' IN ('GROUP_CLASS_CREATE','GROUP_CLASS_UPDATE','GROUP_CLASS_CANCEL')"
    ;;
  trainer-manual-checkin)
    assert_positive "Eğitmen manuel check-in" \
      "SELECT count(*) FROM attendance WHERE manual_code='MEM-DEMO001' AND created_at > now() - interval '15 minutes'"
    ;;
  trainer-operations)
    assert_positive "Eğitmen toplu bildirim olayı" \
      "SELECT count(*) FROM notification_events WHERE type='MOBILE_PUSH' AND payload->>'type'='TRAINER_BULK_MESSAGE'"
    assert_positive "Eğitmen çıkış audit kaydı" \
      "SELECT count(*) FROM audit_logs log JOIN accounts account ON account.id=log.actor_account_id WHERE log.event_type='AUTH_LOGOUT' AND log.success=true AND account.email='elisauyar@gmail.com'"
    ;;
  *)
    echo "Bilinmeyen fonksiyonel E2E doğrulaması: $CASE_NAME" >&2
    exit 2
    ;;
esac

printf '%s API/DB verification passed\n' "$CASE_NAME"
