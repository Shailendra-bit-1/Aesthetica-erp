-- A16: Appointment timing timestamps — set by scheduler on each status transition
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS checked_in_at         TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS consultation_start_at  TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS consultation_end_at    TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS treatment_start_at     TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS treatment_complete_at  TIMESTAMPTZ DEFAULT NULL;
