-- A21: Add clinical outcome tracking columns to patient_treatments
ALTER TABLE patient_treatments
  ADD COLUMN IF NOT EXISTS doctor_id             UUID REFERENCES profiles(id)     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS appointment_id        UUID REFERENCES appointments(id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS outcome               TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS side_effects          TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS next_recommended_date DATE DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_patient_treatments_doctor      ON patient_treatments(doctor_id)      WHERE doctor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patient_treatments_appointment ON patient_treatments(appointment_id) WHERE appointment_id IS NOT NULL;
