-- A19: Consent form snapshotting — immutable legal record of exactly what was signed
ALTER TABLE form_responses
  ADD COLUMN IF NOT EXISTS form_snapshot_json JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS consent_version    TEXT  DEFAULT NULL;

COMMENT ON COLUMN form_responses.form_snapshot_json IS 'Full JSON of form fields+text at time of signing. Never updated after insert — legal record.';
COMMENT ON COLUMN form_responses.consent_version    IS 'Version string of the form definition at signing time.';
