-- A5: Walk-in flag on appointments
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS is_walkin BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_appointments_is_walkin ON appointments(is_walkin) WHERE is_walkin = true;
