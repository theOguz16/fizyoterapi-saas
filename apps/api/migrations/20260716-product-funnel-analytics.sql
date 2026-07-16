ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS product_event_name varchar(40),
  ADD COLUMN IF NOT EXISTS product_event_id varchar(120),
  ADD COLUMN IF NOT EXISTS product_funnel_id varchar(120),
  ADD COLUMN IF NOT EXISTS product_install_id varchar(120),
  ADD COLUMN IF NOT EXISTS product_session_id varchar(120),
  ADD COLUMN IF NOT EXISTS product_occurred_at timestamptz;

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
  );

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
WHERE audit.id = duplicates.id AND duplicates.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_audit_logs_product_event_id"
  ON audit_logs (product_event_name, product_event_id)
  WHERE product_event_name IS NOT NULL AND product_event_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS "IDX_audit_logs_product_funnel"
  ON audit_logs (product_funnel_id, product_event_name, product_occurred_at)
  WHERE product_event_name IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS "IDX_audit_logs_product_tenant_event"
  ON audit_logs (tenant_id, product_event_name, product_occurred_at)
  WHERE product_event_name IS NOT NULL AND deleted_at IS NULL;
