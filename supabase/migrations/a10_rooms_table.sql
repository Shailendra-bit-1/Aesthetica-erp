-- A10: Rooms as entities for Room View in scheduler
CREATE TABLE IF NOT EXISTS rooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT CHECK (type IN ('treatment','consultation','laser','facial','general')) DEFAULT 'treatment',
  capacity    INT NOT NULL DEFAULT 1,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rooms_clinic ON rooms(clinic_id);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rooms_clinic_access" ON rooms
  FOR ALL
  USING (clinic_id = get_viewer_clinic_id() OR get_viewer_role() = 'superadmin')
  WITH CHECK (clinic_id = get_viewer_clinic_id() OR get_viewer_role() = 'superadmin');

-- Add room_id FK to appointments (nullable — room assignment is optional)
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_room ON appointments(room_id) WHERE room_id IS NOT NULL;
