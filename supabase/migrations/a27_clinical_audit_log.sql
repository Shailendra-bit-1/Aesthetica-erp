-- A27: Field-level clinical change tracking — immutable, trigger-populated
CREATE TABLE IF NOT EXISTS clinical_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID REFERENCES patients(id),
  record_type     TEXT NOT NULL CHECK (record_type IN (
    'patient_treatment','patient_medical_history',
    'prescription','counselling_session','patient_notes'
  )),
  record_id       UUID NOT NULL,
  changed_by      UUID NOT NULL REFERENCES profiles(id),
  changed_by_name TEXT NOT NULL DEFAULT '',
  field_name      TEXT NOT NULL,
  old_value       TEXT,
  new_value       TEXT,
  change_reason   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cal_record  ON clinical_audit_log(record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_cal_patient ON clinical_audit_log(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cal_clinic  ON clinical_audit_log(clinic_id,   created_at DESC);

ALTER TABLE clinical_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cal_clinic_read" ON clinical_audit_log
  FOR SELECT USING (clinic_id = get_viewer_clinic_id() OR get_viewer_role() = 'superadmin');

CREATE POLICY "cal_trigger_insert" ON clinical_audit_log
  FOR INSERT WITH CHECK (true);

-- Generic trigger function — called by all 5 tables with column list as args
CREATE OR REPLACE FUNCTION log_clinical_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_clinic_id UUID;
  v_is_demo   BOOLEAN;
  v_col       TEXT;
  v_old_val   TEXT;
  v_new_val   TEXT;
BEGIN
  v_clinic_id := NEW.clinic_id;
  SELECT is_demo INTO v_is_demo FROM clinics WHERE id = v_clinic_id LIMIT 1;
  IF v_is_demo THEN RETURN NEW; END IF;

  FOREACH v_col IN ARRAY TG_ARGV LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', v_col, v_col)
      INTO v_old_val, v_new_val USING OLD, NEW;
    IF v_old_val IS DISTINCT FROM v_new_val THEN
      INSERT INTO clinical_audit_log (
        clinic_id, patient_id, record_type, record_id,
        changed_by, changed_by_name, field_name, old_value, new_value
      ) VALUES (
        v_clinic_id, NEW.patient_id, TG_TABLE_NAME, NEW.id,
        COALESCE((SELECT auth.uid()), '00000000-0000-0000-0000-000000000000'),
        '', v_col, v_old_val, v_new_val
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_patient_treatments     ON patient_treatments;
CREATE TRIGGER trg_audit_patient_treatments
  AFTER UPDATE ON patient_treatments FOR EACH ROW
  EXECUTE FUNCTION log_clinical_change('treatment_name','status','outcome','side_effects','notes','next_recommended_date');

DROP TRIGGER IF EXISTS trg_audit_patient_medical_history ON patient_medical_history;
CREATE TRIGGER trg_audit_patient_medical_history
  AFTER UPDATE ON patient_medical_history FOR EACH ROW
  EXECUTE FUNCTION log_clinical_change('allergies','current_medications','past_procedures','skin_type','patient_notes');

DROP TRIGGER IF EXISTS trg_audit_prescriptions ON prescriptions;
CREATE TRIGGER trg_audit_prescriptions
  AFTER UPDATE ON prescriptions FOR EACH ROW
  EXECUTE FUNCTION log_clinical_change('medication_name','dosage','frequency','duration');

DROP TRIGGER IF EXISTS trg_audit_counselling_sessions ON counselling_sessions;
CREATE TRIGGER trg_audit_counselling_sessions
  AFTER UPDATE ON counselling_sessions FOR EACH ROW
  EXECUTE FUNCTION log_clinical_change('chief_complaint','treatments_discussed','total_proposed','total_accepted','conversion_status','notes');

DROP TRIGGER IF EXISTS trg_audit_patient_notes ON patient_notes;
CREATE TRIGGER trg_audit_patient_notes
  AFTER UPDATE ON patient_notes FOR EACH ROW
  EXECUTE FUNCTION log_clinical_change('content');
