ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS auth_version integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_password_reset_token_hash"
  ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS "IDX_password_reset_account"
  ON password_reset_tokens(account_id);
CREATE INDEX IF NOT EXISTS "IDX_password_reset_expiry"
  ON password_reset_tokens(expires_at);
