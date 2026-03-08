-- A18: Marketing attribution — UTM on crm_leads, acquisition on patients
ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS utm_source   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS utm_medium   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS utm_content  TEXT DEFAULT NULL;

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS acquisition_source   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS acquisition_campaign TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_leads_utm_source        ON crm_leads(utm_source)   WHERE utm_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_leads_utm_campaign      ON crm_leads(utm_campaign) WHERE utm_campaign IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_acquisition_source ON patients(acquisition_source) WHERE acquisition_source IS NOT NULL;
