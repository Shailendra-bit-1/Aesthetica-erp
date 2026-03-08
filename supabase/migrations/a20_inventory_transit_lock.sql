-- A20: 2-step inventory transit lock — prevents stock vanishing during inter-clinic transfers
ALTER TABLE inventory_transfers
  ADD COLUMN IF NOT EXISTS transfer_status TEXT DEFAULT 'requested'
    CHECK (transfer_status IN ('requested','in_transit','received','cancelled')),
  ADD COLUMN IF NOT EXISTS received_by UUID REFERENCES profiles(id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_transfers_status ON inventory_transfers(transfer_status);
