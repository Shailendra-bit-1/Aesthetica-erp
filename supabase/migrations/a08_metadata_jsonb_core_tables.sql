-- A8: Add metadata JSONB to 9 core tables for plugin/workflow extensibility
-- GIN indexed for fast key-based queries. Never store PHI in metadata.
ALTER TABLE patients             ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE appointments         ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE pending_invoices     ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE clinical_encounters  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE crm_leads            ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE counselling_sessions ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE services             ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE inventory_products   ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE profiles             ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_patients_metadata             ON patients            USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_appointments_metadata         ON appointments        USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_pending_invoices_metadata     ON pending_invoices    USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_crm_leads_metadata            ON crm_leads           USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_counselling_sessions_metadata ON counselling_sessions USING GIN (metadata);
