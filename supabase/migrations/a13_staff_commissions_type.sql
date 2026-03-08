-- A13: Commission type — sale (package sold) vs delivery (session delivered)
ALTER TABLE staff_commissions
  ADD COLUMN IF NOT EXISTS commission_type TEXT
    CHECK (commission_type IN ('sale','delivery'))
    DEFAULT 'delivery';

UPDATE staff_commissions SET commission_type = 'delivery' WHERE commission_type IS NULL;

ALTER TABLE staff_commissions ALTER COLUMN commission_type SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_commissions_type ON staff_commissions(commission_type);
