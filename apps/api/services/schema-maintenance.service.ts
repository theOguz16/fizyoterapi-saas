// Runtime schema guard'lari migration altyapisi olmayan kurulumlarda geriye uyumlu kolon eklemeleri yapar.
// Sadece idempotent ve veri kaybina yol acmayan islemler burada tutulmali.
import { DataSource } from "typeorm";

export class SchemaMaintenanceService {
  static async ensureRuntimeColumns(dataSource: DataSource) {
    await dataSource.query(`
      ALTER TABLE IF EXISTS referrals
      ADD COLUMN IF NOT EXISTS invitee_name varchar(120)
    `);

    await dataSource.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'salon_profiles_managed_growth_status_enum'
        ) THEN
          CREATE TYPE salon_profiles_managed_growth_status_enum AS ENUM (
            'PREPARING',
            'WAITING_INFO',
            'LIVE',
            'OPTIMIZING'
          );
        END IF;
      END $$;
    `);

    await dataSource.query(`
      ALTER TABLE IF EXISTS salon_profiles
      ADD COLUMN IF NOT EXISTS seo_title varchar(160),
      ADD COLUMN IF NOT EXISTS seo_description varchar(240),
      ADD COLUMN IF NOT EXISTS google_business_url varchar(260),
      ADD COLUMN IF NOT EXISTS google_maps_url varchar(260),
      ADD COLUMN IF NOT EXISTS business_category varchar(100),
      ADD COLUMN IF NOT EXISTS service_area jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS digital_brief jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS managed_growth_status salon_profiles_managed_growth_status_enum NOT NULL DEFAULT 'PREPARING'
    `);

    await dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_salon_profiles_managed_growth_status"
      ON salon_profiles (managed_growth_status)
    `);

    await dataSource.query(`
      ALTER TABLE IF EXISTS tenants
      ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz,
      ADD COLUMN IF NOT EXISTS subscription_current_period_ends_at timestamptz,
      ADD COLUMN IF NOT EXISTS subscription_last_event_at timestamptz,
      ADD COLUMN IF NOT EXISTS revenuecat_original_app_user_id varchar(120),
      ADD COLUMN IF NOT EXISTS revenuecat_product_id varchar(160),
      ADD COLUMN IF NOT EXISTS revenuecat_entitlement_id varchar(120),
      ADD COLUMN IF NOT EXISTS revenuecat_store varchar(40),
      ADD COLUMN IF NOT EXISTS revenuecat_last_event_type varchar(80)
    `);

    await dataSource.query(`
      ALTER TABLE IF EXISTS accounts
      ADD COLUMN IF NOT EXISTS notification_preferences jsonb,
      ADD COLUMN IF NOT EXISTS legal_consents jsonb
    `);

    await dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tenants_subscription_current_period_ends_at"
      ON tenants (subscription_current_period_ends_at)
    `);

    await dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tenants_subscription_last_event_at"
      ON tenants (subscription_last_event_at)
    `);

    await dataSource.query(`
      DO $$
      DECLARE
        idx record;
        con record;
      BEGIN
        FOR con IN
          SELECT c.conname
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname = current_schema()
            AND t.relname = 'users'
            AND c.contype = 'u'
            AND pg_get_constraintdef(c.oid) ILIKE '%(email)%'
        LOOP
          EXECUTE format('ALTER TABLE users DROP CONSTRAINT IF EXISTS %I', con.conname);
        END LOOP;

        FOR idx IN
          SELECT indexname
          FROM pg_indexes
          WHERE schemaname = current_schema()
            AND tablename = 'users'
            AND indexdef ILIKE '%UNIQUE%'
            AND indexdef ILIKE '%(email)%'
        LOOP
          EXECUTE format('DROP INDEX IF EXISTS %I', idx.indexname);
        END LOOP;
      END $$;
    `);

    await dataSource.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_tenant_email_role"
      ON users (tenant_id, email, role)
      WHERE deleted_at IS NULL
    `);

    await dataSource.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_tenant_qr_code"
      ON users (tenant_id, qr_code)
      WHERE qr_code IS NOT NULL AND deleted_at IS NULL
    `);

    await dataSource.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_deliveries_channel_enum') THEN
          ALTER TYPE notification_deliveries_channel_enum ADD VALUE IF NOT EXISTS 'EXPO_PUSH';
        END IF;
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_deliveries_status_enum') THEN
          ALTER TYPE notification_deliveries_status_enum ADD VALUE IF NOT EXISTS 'QUEUED';
          ALTER TYPE notification_deliveries_status_enum ADD VALUE IF NOT EXISTS 'SENDING';
          ALTER TYPE notification_deliveries_status_enum ADD VALUE IF NOT EXISTS 'AWAITING_RECEIPT';
          ALTER TYPE notification_deliveries_status_enum ADD VALUE IF NOT EXISTS 'RETRY_SCHEDULED';
          ALTER TYPE notification_deliveries_status_enum ADD VALUE IF NOT EXISTS 'DELIVERED';
        END IF;
      END $$;
    `);

    await dataSource.query(`
      ALTER TABLE IF EXISTS notification_deliveries
      ADD COLUMN IF NOT EXISTS device_token_id uuid,
      ADD COLUMN IF NOT EXISTS token_snapshot varchar(255),
      ADD COLUMN IF NOT EXISTS platform varchar(20),
      ADD COLUMN IF NOT EXISTS title varchar(180),
      ADD COLUMN IF NOT EXISTS body varchar(500),
      ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS provider_ticket_id varchar(120),
      ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 4,
      ADD COLUMN IF NOT EXISTS receipt_attempt_count integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
      ADD COLUMN IF NOT EXISTS receipt_check_at timestamptz,
      ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
      ADD COLUMN IF NOT EXISTS delivered_at timestamptz
    `);
    await dataSource.query(`
      ALTER TABLE IF EXISTS notification_deliveries
      ALTER COLUMN title TYPE text,
      ALTER COLUMN body TYPE text
    `);

    await dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notification_deliveries_due"
      ON notification_deliveries (status, next_attempt_at)
    `);
    await dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notification_deliveries_receipt_due"
      ON notification_deliveries (status, receipt_check_at)
    `);
    await dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notification_deliveries_provider_ticket"
      ON notification_deliveries (provider_ticket_id)
      WHERE provider_ticket_id IS NOT NULL
    `);

    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS background_jobs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        key varchar(100) NOT NULL UNIQUE,
        type varchar(80) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'READY',
        interval_seconds integer NOT NULL,
        next_run_at timestamptz NOT NULL,
        last_started_at timestamptz,
        last_completed_at timestamptz,
        consecutive_failures integer NOT NULL DEFAULT 0,
        last_error varchar(500)
      )
    `);
    await dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_background_jobs_due"
      ON background_jobs (status, next_run_at)
      WHERE deleted_at IS NULL
    `);

    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        tenant_id uuid NOT NULL,
        name varchar(140) NOT NULL,
        audience varchar(20) NOT NULL,
        audience_config jsonb NOT NULL DEFAULT '{}'::jsonb,
        trigger_type varchar(24) NOT NULL,
        trigger_count integer NOT NULL CHECK (trigger_count > 0),
        reward_type varchar(40) NOT NULL,
        reward_value integer NOT NULL CHECK (reward_value > 0),
        reward_target varchar(24) NOT NULL,
        fulfillment_type varchar(40) NOT NULL,
        is_active boolean NOT NULL DEFAULT false,
        activated_at timestamptz,
        created_by_admin_id uuid,
        legacy_id varchar(120)
      )
    `);
    await dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_campaigns_tenant_trigger_active"
      ON campaigns (tenant_id, trigger_type, is_active)
      WHERE deleted_at IS NULL
    `);
    await dataSource.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_campaigns_tenant_legacy_id"
      ON campaigns (tenant_id, legacy_id)
      WHERE legacy_id IS NOT NULL AND deleted_at IS NULL
    `);
    await dataSource.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_credit_ledger_campaign_fulfillment"
      ON credit_ledger (tenant_id, member_id, reference_id)
      WHERE reference_type = 'CAMPAIGN' AND reference_id IS NOT NULL AND deleted_at IS NULL
    `);

    await dataSource.query(`
      ALTER TABLE IF EXISTS audit_logs
      ADD COLUMN IF NOT EXISTS product_event_name varchar(40),
      ADD COLUMN IF NOT EXISTS product_event_id varchar(120),
      ADD COLUMN IF NOT EXISTS product_funnel_id varchar(120),
      ADD COLUMN IF NOT EXISTS product_install_id varchar(120),
      ADD COLUMN IF NOT EXISTS product_session_id varchar(120),
      ADD COLUMN IF NOT EXISTS product_occurred_at timestamptz
    `);
    await dataSource.query(`
      UPDATE audit_logs
      SET product_event_name = metadata ->> 'event_name',
          product_event_id = COALESCE(metadata ->> 'event_id', request_id),
          product_install_id = metadata ->> 'install_id',
          product_session_id = metadata ->> 'session_id',
          product_funnel_id = COALESCE(metadata ->> 'funnel_id', metadata ->> 'install_id', actor_account_id::text),
          product_occurred_at = created_at
      WHERE product_event_name IS NULL
        AND metadata ->> 'event_name' IN (
          'app_opened', 'clinic_signup_started', 'clinic_created', 'trial_started', 'package_created',
          'working_hours_saved', 'clinic_qr_viewed', 'member_invite_started', 'subscription_viewed', 'purchase_started'
        )
    `);
    await dataSource.query(`
      WITH duplicates AS (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY product_event_name, product_event_id ORDER BY created_at, id
        ) AS row_number
        FROM audit_logs
        WHERE product_event_name IS NOT NULL AND product_event_id IS NOT NULL AND deleted_at IS NULL
      )
      UPDATE audit_logs audit
      SET product_event_id = audit.product_event_id || '-legacy-' || audit.id::text
      FROM duplicates
      WHERE audit.id = duplicates.id AND duplicates.row_number > 1
    `);
    await dataSource.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_audit_logs_product_event_id"
      ON audit_logs (product_event_name, product_event_id)
      WHERE product_event_name IS NOT NULL AND product_event_id IS NOT NULL AND deleted_at IS NULL
    `);
    await dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_product_funnel"
      ON audit_logs (product_funnel_id, product_event_name, product_occurred_at)
      WHERE product_event_name IS NOT NULL AND deleted_at IS NULL
    `);
    await dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_product_tenant_event"
      ON audit_logs (tenant_id, product_event_name, product_occurred_at)
      WHERE product_event_name IS NOT NULL AND deleted_at IS NULL
    `);

    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS product_demo_leads (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        full_name varchar(160) NOT NULL,
        clinic_name varchar(200) NOT NULL,
        email varchar(254) NOT NULL,
        phone varchar(32) NOT NULL,
        city varchar(100),
        note text,
        clinic_type varchar(80),
        primary_need varchar(80),
        attribution varchar(160),
        page_path varchar(240),
        source varchar(80) NOT NULL DEFAULT 'PRODUCT_SITE_DEMO',
        source_audit_log_id uuid
      )
    `);
    await dataSource.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_product_demo_leads_source_audit_log_id"
      ON product_demo_leads (source_audit_log_id)
      WHERE source_audit_log_id IS NOT NULL
    `);
    await dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_demo_leads_created_at"
      ON product_demo_leads (created_at)
    `);
    await dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_demo_leads_deleted_created_at"
      ON product_demo_leads (deleted_at, created_at)
    `);
    await dataSource.query(`
      INSERT INTO product_demo_leads (
        created_at,
        updated_at,
        full_name,
        clinic_name,
        email,
        phone,
        city,
        note,
        clinic_type,
        primary_need,
        attribution,
        page_path,
        source,
        source_audit_log_id
      )
      SELECT
        audit.created_at,
        audit.created_at,
        left(audit.metadata ->> 'full_name', 160),
        left(audit.metadata ->> 'clinic_name', 200),
        left(lower(audit.metadata ->> 'email'), 254),
        left(audit.metadata ->> 'phone', 32),
        left(NULLIF(audit.metadata ->> 'city', ''), 100),
        NULLIF(audit.metadata ->> 'note', ''),
        left(NULLIF(audit.metadata ->> 'clinic_type', ''), 80),
        left(NULLIF(audit.metadata ->> 'primary_need', ''), 80),
        left(NULLIF(audit.metadata ->> 'attribution', ''), 160),
        left(NULLIF(audit.metadata ->> 'page_path', ''), 240),
        left(COALESCE(NULLIF(audit.metadata ->> 'source', ''), 'PRODUCT_SITE_DEMO'), 80),
        audit.id
      FROM audit_logs audit
      WHERE audit.event_type = 'PRODUCT_SITE_DEMO_LEAD_SUBMIT'
        AND audit.deleted_at IS NULL
        AND NULLIF(audit.metadata ->> 'full_name', '') IS NOT NULL
        AND NULLIF(audit.metadata ->> 'clinic_name', '') IS NOT NULL
        AND NULLIF(audit.metadata ->> 'email', '') IS NOT NULL
        AND NULLIF(audit.metadata ->> 'phone', '') IS NOT NULL
      ON CONFLICT (source_audit_log_id) WHERE source_audit_log_id IS NOT NULL DO NOTHING
    `);
    await dataSource.query(`
      UPDATE audit_logs audit
      SET metadata = (COALESCE(audit.metadata, '{}'::jsonb)
          - 'full_name'
          - 'clinic_name'
          - 'email'
          - 'phone'
          - 'city'
          - 'note'
          - 'clinic_type'
          - 'primary_need'
          - 'attribution'
          - 'page_path')
        || jsonb_build_object(
          'demo_lead_id', lead.id::text,
          'source', lead.source,
          'status', 'MIGRATED'
        ),
        target_id = COALESCE(audit.target_id, lead.id::text)
      FROM product_demo_leads lead
      WHERE lead.source_audit_log_id = audit.id
        AND audit.event_type = 'PRODUCT_SITE_DEMO_LEAD_SUBMIT'
    `);
    await dataSource.query(`
      UPDATE audit_logs
      SET metadata = jsonb_strip_nulls(jsonb_build_object(
        'demo_lead_id', metadata ->> 'demo_lead_id',
        'source', 'PRODUCT_SITE_DEMO',
        'status', CASE
          WHEN metadata ? 'demo_lead_id' THEN COALESCE(NULLIF(metadata ->> 'status', ''), 'PERSISTED')
          ELSE 'PII_SCRUBBED_NOT_MIGRATED'
        END
      ))
      WHERE event_type = 'PRODUCT_SITE_DEMO_LEAD_SUBMIT'
    `);
    await dataSource.query(`
      UPDATE audit_logs
      SET metadata = jsonb_strip_nulls(jsonb_build_object(
          'demo_lead_id', metadata ->> 'demo_lead_id',
          'status', CASE WHEN success THEN 'DELIVERED' ELSE 'PARTIAL_OR_FAILED' END,
          'smtp_configured', metadata -> 'smtp_configured',
          'admin_delivered', metadata -> 'admin_delivered',
          'applicant_delivered', metadata -> 'applicant_delivered',
          'errors_count', CASE
            WHEN jsonb_typeof(metadata -> 'errors') = 'array' THEN jsonb_array_length(metadata -> 'errors')
            WHEN jsonb_typeof(metadata -> 'errors_count') = 'number' THEN (metadata ->> 'errors_count')::integer
            ELSE 0
          END
        ))
      WHERE event_type = 'PRODUCT_SITE_DEMO_LEAD_EMAIL'
    `);
  }
}
