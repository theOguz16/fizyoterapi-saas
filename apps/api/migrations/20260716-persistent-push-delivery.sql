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

ALTER TABLE notification_deliveries
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
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

ALTER TABLE notification_deliveries
  ALTER COLUMN title TYPE text,
  ALTER COLUMN body TYPE text;

CREATE INDEX IF NOT EXISTS "IDX_notification_deliveries_due"
  ON notification_deliveries (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS "IDX_notification_deliveries_receipt_due"
  ON notification_deliveries (status, receipt_check_at);
CREATE INDEX IF NOT EXISTS "IDX_notification_deliveries_provider_ticket"
  ON notification_deliveries (provider_ticket_id)
  WHERE provider_ticket_id IS NOT NULL;

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
);

CREATE INDEX IF NOT EXISTS "IDX_background_jobs_due"
  ON background_jobs (status, next_run_at)
  WHERE deleted_at IS NULL;
