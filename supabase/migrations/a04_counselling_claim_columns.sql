-- A4: Counsellor claim system columns on counselling_sessions
ALTER TABLE counselling_sessions
  ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES profiles(id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS claim_status TEXT
    CHECK (claim_status IN ('unclaimed','claimed','admin_override'))
    DEFAULT 'unclaimed';

CREATE INDEX IF NOT EXISTS idx_counselling_sessions_claim_status ON counselling_sessions(claim_status);
CREATE INDEX IF NOT EXISTS idx_counselling_sessions_claimed_by ON counselling_sessions(claimed_by) WHERE claimed_by IS NOT NULL;
