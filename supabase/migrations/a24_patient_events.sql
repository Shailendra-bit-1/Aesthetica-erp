-- A24: Patient events — business event timeline, separate from audit_logs
CREATE TABLE IF NOT EXISTS patient_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id   UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL CHECK (event_type IN (
    'appointment_booked','appointment_cancelled','appointment_no_show',
    'consultation_done','treatment_done',
    'invoice_paid','invoice_voided',
    'photo_uploaded',
    'package_purchased','package_session_used','package_expired',
    'membership_activated','membership_expired',
    'credit_expired','referral_made','note_added','patient_merged'
  )),
  entity_type  TEXT,
  entity_id    UUID,
  summary      TEXT NOT NULL,
  actor_name   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_events_patient ON patient_events(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_events_clinic  ON patient_events(clinic_id,  created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_events_type    ON patient_events(event_type);

ALTER TABLE patient_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pe_clinic_read" ON patient_events
  FOR SELECT USING (clinic_id = get_viewer_clinic_id() OR get_viewer_role() = 'superadmin');

CREATE POLICY "pe_clinic_insert" ON patient_events
  FOR INSERT WITH CHECK (clinic_id = get_viewer_clinic_id() OR get_viewer_role() = 'superadmin');
