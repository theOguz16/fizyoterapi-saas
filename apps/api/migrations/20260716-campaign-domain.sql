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
);

CREATE INDEX IF NOT EXISTS "IDX_campaigns_tenant_trigger_active"
  ON campaigns (tenant_id, trigger_type, is_active)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_campaigns_tenant_legacy_id"
  ON campaigns (tenant_id, legacy_id)
  WHERE legacy_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_credit_ledger_campaign_fulfillment"
  ON credit_ledger (tenant_id, member_id, reference_id)
  WHERE reference_type = 'CAMPAIGN' AND reference_id IS NOT NULL AND deleted_at IS NULL;
