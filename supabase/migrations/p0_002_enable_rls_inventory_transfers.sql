-- Phase 0-2: Enable RLS on inventory_transfers + clinic-scoped policy
-- Both source and destination clinic can read; only source clinic can initiate transfer

ALTER TABLE inventory_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_transfers_access" ON inventory_transfers
  FOR ALL
  USING (
    from_clinic_id = get_viewer_clinic_id()
    OR to_clinic_id = get_viewer_clinic_id()
    OR get_viewer_role() = 'superadmin'
  )
  WITH CHECK (
    from_clinic_id = get_viewer_clinic_id()
    OR get_viewer_role() = 'superadmin'
  );
