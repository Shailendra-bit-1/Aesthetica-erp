-- A23: Patient merge log — tracks every merge, source never hard-deleted
CREATE TABLE IF NOT EXISTS patient_merge_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  source_patient_id UUID NOT NULL REFERENCES patients(id),
  target_patient_id UUID NOT NULL REFERENCES patients(id),
  merged_by         UUID NOT NULL REFERENCES profiles(id),
  merged_by_name    TEXT NOT NULL,
  merged_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason            TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_patient_merge_log_clinic ON patient_merge_log(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patient_merge_log_source ON patient_merge_log(source_patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_merge_log_target ON patient_merge_log(target_patient_id);

ALTER TABLE patient_merge_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pml_clinic_read" ON patient_merge_log
  FOR SELECT USING (clinic_id = get_viewer_clinic_id() OR get_viewer_role() = 'superadmin');

CREATE POLICY "pml_admin_insert" ON patient_merge_log
  FOR INSERT WITH CHECK (clinic_id = get_viewer_clinic_id() OR get_viewer_role() = 'superadmin');
