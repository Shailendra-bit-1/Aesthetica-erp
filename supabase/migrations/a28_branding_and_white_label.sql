-- A28: Branding & White-Label (NG-14)
-- system_settings table already exists — seed platform branding rows
-- Add per-clinic brand columns to clinics

ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS brand_name      TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS brand_logo_url  TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS brand_color     TEXT DEFAULT NULL;

COMMENT ON COLUMN clinics.brand_name     IS 'Shown on patient portal, intake form, invoice PDF. Defaults to clinics.name if null.';
COMMENT ON COLUMN clinics.brand_logo_url IS 'Clinic logo for patient-facing surfaces only.';
COMMENT ON COLUMN clinics.brand_color    IS 'Hex accent colour for patient portal only.';

-- Seed platform-level branding (scope=global)
INSERT INTO system_settings (scope, key, value, description, is_active)
VALUES
  ('global', 'app_name',        '"Aesthetica ERP"',        'Platform display name', true),
  ('global', 'logo_url',        '""',                      'Platform logo URL',     true),
  ('global', 'favicon_url',     '""',                      'Browser favicon URL',   true),
  ('global', 'support_email',   '"support@aesthetica.in"', 'Support email address', true),
  ('global', 'primary_color',   '"#0B2A4A"',               'Primary brand colour',  true),
  ('global', 'secondary_color', '"#F7F9FC"',               'Secondary colour',      true)
ON CONFLICT DO NOTHING;
