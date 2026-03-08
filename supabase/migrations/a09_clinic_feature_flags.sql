-- A9: Per-clinic granular behavioral flags (beyond module on/off)
CREATE TABLE IF NOT EXISTS clinic_feature_flags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  flag_key    TEXT NOT NULL,
  is_enabled  BOOLEAN NOT NULL DEFAULT true,
  config      JSONB NOT NULL DEFAULT '{}',
  set_by      UUID REFERENCES profiles(id),
  set_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clinic_id, flag_key)
);

CREATE INDEX IF NOT EXISTS idx_clinic_feature_flags_clinic ON clinic_feature_flags(clinic_id);

ALTER TABLE clinic_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cff_clinic_read" ON clinic_feature_flags
  FOR SELECT USING (clinic_id = get_viewer_clinic_id() OR get_viewer_role() = 'superadmin');

CREATE POLICY "cff_admin_write" ON clinic_feature_flags
  FOR ALL USING (get_viewer_role() IN ('superadmin','clinic_admin','chain_admin'))
  WITH CHECK (get_viewer_role() IN ('superadmin','clinic_admin','chain_admin'));
