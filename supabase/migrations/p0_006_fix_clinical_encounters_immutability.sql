-- Phase 0-6: clinical_encounters must be INSERT + SELECT only (HIPAA requirement)
-- Drop the FOR ALL policy that incorrectly allows UPDATE and DELETE.
-- No UPDATE policy — amendments go in patient_notes instead.
-- No DELETE policy — not even for superadmin.

DROP POLICY IF EXISTS "EMR Multi-Tenant Isolation" ON clinical_encounters;

CREATE POLICY "encounters_select" ON clinical_encounters
  FOR SELECT
  USING (
    clinic_id = get_viewer_clinic_id()
    OR get_viewer_role() = 'superadmin'
  );

CREATE POLICY "encounters_insert" ON clinical_encounters
  FOR INSERT
  WITH CHECK (
    clinic_id = get_viewer_clinic_id()
    OR get_viewer_role() = 'superadmin'
  );

-- Intentionally no UPDATE policy.
-- Intentionally no DELETE policy.
-- clinical_encounters are immutable records.
