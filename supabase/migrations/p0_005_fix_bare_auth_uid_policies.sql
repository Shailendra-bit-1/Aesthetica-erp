-- Phase 0-5: Replace bare auth.uid() with (SELECT auth.uid()) across 9 affected policies
-- Uses get_viewer_clinic_id() / get_viewer_role() SECURITY DEFINER helpers where possible

-- ─── appointments_insert ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "appointments_insert" ON appointments;
CREATE POLICY "appointments_insert" ON appointments
  FOR INSERT
  WITH CHECK (
    clinic_id = get_viewer_clinic_id()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = ANY(ARRAY['superadmin','chain_admin'])
    )
  );

-- ─── conditions_write ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "conditions_write" ON conditions;
CREATE POLICY "conditions_write" ON conditions
  FOR ALL
  USING (
    clinic_id = get_viewer_clinic_id()
    OR get_viewer_role() = 'superadmin'
  )
  WITH CHECK (
    clinic_id = get_viewer_clinic_id()
    OR get_viewer_role() = 'superadmin'
  );

-- ─── form_definitions ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "clinic staff can manage form_definitions" ON form_definitions;
CREATE POLICY "form_definitions_clinic_access" ON form_definitions
  FOR ALL
  USING (
    clinic_id = get_viewer_clinic_id()
    OR clinic_id IS NULL
    OR get_viewer_role() = 'superadmin'
  )
  WITH CHECK (
    clinic_id = get_viewer_clinic_id()
    OR get_viewer_role() = 'superadmin'
  );

-- ─── form_responses (3 policies) ──────────────────────────────────────────────
DROP POLICY IF EXISTS "clinic staff can read form_responses" ON form_responses;
DROP POLICY IF EXISTS "clinic staff can update form_responses" ON form_responses;
DROP POLICY IF EXISTS "clinic staff can delete form_responses" ON form_responses;

CREATE POLICY "form_responses_select" ON form_responses
  FOR SELECT
  USING (
    clinic_id = get_viewer_clinic_id()
    OR get_viewer_role() = 'superadmin'
  );

CREATE POLICY "form_responses_update" ON form_responses
  FOR UPDATE
  USING (
    clinic_id = get_viewer_clinic_id()
    OR get_viewer_role() = 'superadmin'
  )
  WITH CHECK (
    clinic_id = get_viewer_clinic_id()
    OR get_viewer_role() = 'superadmin'
  );

CREATE POLICY "form_responses_delete" ON form_responses
  FOR DELETE
  USING (
    clinic_id = get_viewer_clinic_id()
    OR get_viewer_role() IN ('superadmin','clinic_admin')
  );

-- ─── protocols_write ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "protocols_write" ON protocols;
CREATE POLICY "protocols_write" ON protocols
  FOR ALL
  USING (
    clinic_id = get_viewer_clinic_id()
    OR get_viewer_role() = 'superadmin'
  )
  WITH CHECK (
    clinic_id = get_viewer_clinic_id()
    OR get_viewer_role() = 'superadmin'
  );

-- ─── workflow_action_log ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "clinic staff can insert action log" ON workflow_action_log;
CREATE POLICY "wfal_clinic_insert" ON workflow_action_log
  FOR INSERT
  WITH CHECK (
    clinic_id = get_viewer_clinic_id()
    OR get_viewer_role() = 'superadmin'
  );

-- ─── workflow_dlq ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "clinic staff can insert dlq" ON workflow_dlq;
CREATE POLICY "wfdlq_clinic_insert" ON workflow_dlq
  FOR INSERT
  WITH CHECK (
    clinic_id = get_viewer_clinic_id()
    OR get_viewer_role() = 'superadmin'
  );
