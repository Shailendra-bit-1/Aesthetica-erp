-- Phase 0-3: Enable RLS on workflow_scheduled_actions + clinic-scoped policy

ALTER TABLE workflow_scheduled_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wsa_clinic_access" ON workflow_scheduled_actions
  FOR ALL
  USING (
    clinic_id = get_viewer_clinic_id()
    OR get_viewer_role() = 'superadmin'
  )
  WITH CHECK (
    clinic_id = get_viewer_clinic_id()
    OR get_viewer_role() = 'superadmin'
  );
