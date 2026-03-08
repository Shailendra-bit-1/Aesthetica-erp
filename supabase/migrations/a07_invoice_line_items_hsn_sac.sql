-- A7: HSN/SAC on invoice line items (copied from service at invoice creation time)
ALTER TABLE invoice_line_items
  ADD COLUMN IF NOT EXISTS hsn_sac_code VARCHAR(8) DEFAULT NULL;

COMMENT ON COLUMN invoice_line_items.hsn_sac_code IS 'Required for GSTR-1 filing. Must be non-null on all invoice (non-proforma) line items.';
