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
);

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_product_demo_leads_source_audit_log_id"
  ON product_demo_leads (source_audit_log_id)
  WHERE source_audit_log_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS "IDX_product_demo_leads_created_at"
  ON product_demo_leads (created_at);

CREATE INDEX IF NOT EXISTS "IDX_product_demo_leads_deleted_created_at"
  ON product_demo_leads (deleted_at, created_at);

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
ON CONFLICT (source_audit_log_id) WHERE source_audit_log_id IS NOT NULL DO NOTHING;

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
  AND audit.event_type = 'PRODUCT_SITE_DEMO_LEAD_SUBMIT';

UPDATE audit_logs
SET metadata = jsonb_strip_nulls(jsonb_build_object(
  'demo_lead_id', metadata ->> 'demo_lead_id',
  'source', 'PRODUCT_SITE_DEMO',
  'status', CASE
    WHEN metadata ? 'demo_lead_id' THEN COALESCE(NULLIF(metadata ->> 'status', ''), 'PERSISTED')
    ELSE 'PII_SCRUBBED_NOT_MIGRATED'
  END
))
WHERE event_type = 'PRODUCT_SITE_DEMO_LEAD_SUBMIT';

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
WHERE event_type = 'PRODUCT_SITE_DEMO_LEAD_EMAIL';
