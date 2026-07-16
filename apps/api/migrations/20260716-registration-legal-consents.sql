ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS legal_consents jsonb;

COMMENT ON COLUMN accounts.legal_consents IS
  'Versioned registration terms acceptance, privacy notice acknowledgement and optional marketing preference';
