-- A17: Soft delete on services + profiles; merged_into_id on patients
-- patients.deleted_at already exists — skipped
ALTER TABLE services  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE profiles  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE patients  ADD COLUMN IF NOT EXISTS merged_into_id UUID REFERENCES patients(id) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_services_deleted_at  ON services(deleted_at)  WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at  ON profiles(deleted_at)  WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_merged_into ON patients(merged_into_id) WHERE merged_into_id IS NOT NULL;
