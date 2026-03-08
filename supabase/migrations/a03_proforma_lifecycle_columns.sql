-- A3 + A15: Proforma lifecycle columns on pending_invoices
ALTER TABLE pending_invoices
  ADD COLUMN IF NOT EXISTS proforma_status TEXT
    CHECK (proforma_status IN ('draft','approved','converted','expired'))
    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source_proforma_id UUID REFERENCES pending_invoices(id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS proforma_approved_by UUID REFERENCES profiles(id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS proforma_approved_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS proforma_expires_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_pending_invoices_proforma_status ON pending_invoices(proforma_status) WHERE proforma_status IS NOT NULL;
