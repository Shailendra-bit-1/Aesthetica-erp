-- A26: Generic background job queue
CREATE TABLE IF NOT EXISTS background_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  job_type      TEXT NOT NULL CHECK (job_type IN (
    'whatsapp_reminder','campaign_send','follow_up_suggestion',
    'credit_expiry_notify','post_visit_survey','protocol_followup'
  )),
  payload       JSONB NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed')),
  scheduled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  error         TEXT,
  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts  INT NOT NULL DEFAULT 3,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_background_jobs_pending ON background_jobs(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_background_jobs_clinic  ON background_jobs(clinic_id);

ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bj_clinic_read" ON background_jobs
  FOR SELECT USING (clinic_id = get_viewer_clinic_id() OR get_viewer_role() = 'superadmin');

CREATE POLICY "bj_service_write" ON background_jobs
  FOR ALL USING (get_viewer_role() = 'superadmin')
  WITH CHECK (get_viewer_role() = 'superadmin');
