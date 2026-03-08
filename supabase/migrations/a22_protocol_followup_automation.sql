-- A22: Protocol-driven follow-up automation columns
ALTER TABLE protocols
  ADD COLUMN IF NOT EXISTS followup_days     INT     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS aftercare_message TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS auto_remind       BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN protocols.followup_days     IS 'Days after treatment completion to auto-suggest follow-up. NULL = no auto follow-up.';
COMMENT ON COLUMN protocols.aftercare_message IS 'Message sent to patient after treatment. Supports {{patient_name}} token.';
