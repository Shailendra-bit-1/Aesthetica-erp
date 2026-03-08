-- A14: Add clinic_id to 6 tables missing multi-tenant isolation

ALTER TABLE patient_notes ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id);
UPDATE patient_notes pn SET clinic_id = p.clinic_id FROM patients p WHERE pn.patient_id = p.id AND pn.clinic_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_patient_notes_clinic ON patient_notes(clinic_id);

ALTER TABLE patient_packages ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id);
UPDATE patient_packages pp SET clinic_id = p.clinic_id FROM patients p WHERE pp.patient_id = p.id AND pp.clinic_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_patient_packages_clinic ON patient_packages(clinic_id);

ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id);
UPDATE prescriptions pr SET clinic_id = ce.clinic_id FROM clinical_encounters ce WHERE pr.encounter_id = ce.id AND pr.clinic_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_prescriptions_clinic ON prescriptions(clinic_id);

ALTER TABLE package_items ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id);
UPDATE package_items pi SET clinic_id = sp.clinic_id FROM service_packages sp WHERE pi.package_id = sp.id AND pi.clinic_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_package_items_clinic ON package_items(clinic_id);

ALTER TABLE package_members ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id);
UPDATE package_members pm SET clinic_id = psc.current_clinic_id FROM patient_service_credits psc WHERE pm.credit_id = psc.id AND pm.clinic_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_package_members_clinic ON package_members(clinic_id);

ALTER TABLE service_transfers ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id);
UPDATE service_transfers st SET clinic_id = psc.current_clinic_id FROM patient_service_credits psc WHERE st.credit_id = psc.id AND st.clinic_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_service_transfers_clinic ON service_transfers(clinic_id);
