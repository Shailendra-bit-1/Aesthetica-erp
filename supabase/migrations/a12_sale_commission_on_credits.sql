-- A12: Track who sold the package (separate from who delivers sessions)
ALTER TABLE patient_service_credits
  ADD COLUMN IF NOT EXISTS sold_by_provider_id   UUID REFERENCES profiles(id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sale_commission_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sale_commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_psc_sold_by ON patient_service_credits(sold_by_provider_id) WHERE sold_by_provider_id IS NOT NULL;
