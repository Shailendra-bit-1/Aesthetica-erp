-- A25: Search index for Cmd+K instant search — single GIN table replaces 4+ queries
CREATE TABLE IF NOT EXISTS search_index (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  entity_type    TEXT NOT NULL,
  entity_id      UUID NOT NULL,
  primary_text   TEXT NOT NULL,
  secondary_text TEXT,
  url            TEXT NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(clinic_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_search_index_gin
  ON search_index USING GIN (to_tsvector('simple', primary_text));
CREATE INDEX IF NOT EXISTS idx_search_index_clinic
  ON search_index(clinic_id);

ALTER TABLE search_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "si_clinic_read" ON search_index
  FOR SELECT USING (clinic_id = get_viewer_clinic_id() OR get_viewer_role() = 'superadmin');

CREATE POLICY "si_service_write" ON search_index
  FOR ALL USING (get_viewer_role() = 'superadmin')
  WITH CHECK (true);

-- Trigger: refresh on patient insert/update
CREATE OR REPLACE FUNCTION refresh_patient_search_index()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF (SELECT is_demo FROM clinics WHERE id = NEW.clinic_id LIMIT 1) THEN RETURN NEW; END IF;
  INSERT INTO search_index (clinic_id, entity_type, entity_id, primary_text, secondary_text, url)
  VALUES (NEW.clinic_id, 'patient', NEW.id, NEW.full_name, COALESCE(NEW.phone,''), '/patients/'||NEW.id::text)
  ON CONFLICT (clinic_id, entity_type, entity_id) DO UPDATE
    SET primary_text=EXCLUDED.primary_text, secondary_text=EXCLUDED.secondary_text, updated_at=NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_patient_search_index ON patients;
CREATE TRIGGER trg_patient_search_index
  AFTER INSERT OR UPDATE OF full_name, phone ON patients
  FOR EACH ROW EXECUTE FUNCTION refresh_patient_search_index();

-- Trigger: refresh on invoice insert/update
CREATE OR REPLACE FUNCTION refresh_invoice_search_index()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF (SELECT is_demo FROM clinics WHERE id = NEW.clinic_id LIMIT 1) THEN RETURN NEW; END IF;
  INSERT INTO search_index (clinic_id, entity_type, entity_id, primary_text, secondary_text, url)
  VALUES (NEW.clinic_id, 'invoice', NEW.id, COALESCE(NEW.invoice_number, NEW.id::text), NEW.patient_name, '/billing?invoice='||NEW.id::text)
  ON CONFLICT (clinic_id, entity_type, entity_id) DO UPDATE
    SET primary_text=EXCLUDED.primary_text, secondary_text=EXCLUDED.secondary_text, updated_at=NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_search_index ON pending_invoices;
CREATE TRIGGER trg_invoice_search_index
  AFTER INSERT OR UPDATE OF invoice_number, patient_name ON pending_invoices
  FOR EACH ROW EXECUTE FUNCTION refresh_invoice_search_index();
