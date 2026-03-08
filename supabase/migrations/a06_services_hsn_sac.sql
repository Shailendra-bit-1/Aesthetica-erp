-- A6: HSN/SAC codes and GST category on services (required for GSTR-1)
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS hsn_sac_code VARCHAR(8) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS gst_category TEXT
    CHECK (gst_category IN ('exempt','5%','12%','18%','28%'))
    DEFAULT '18%';

COMMENT ON COLUMN services.hsn_sac_code IS 'SAC code for GST filing. Common: 999311 (consultation), 999316 (laser/aesthetic), 999721 (facial/skincare), 999312 (dermatology)';
