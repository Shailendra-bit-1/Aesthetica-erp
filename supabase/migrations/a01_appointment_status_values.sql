-- A1: Add consultation_done and treatment_done to appointment status constraint
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check
  CHECK (status IN (
    'planned','confirmed','arrived',
    'consultation_done','treatment_done',
    'in_session','completed','cancelled','no_show'
  ));
