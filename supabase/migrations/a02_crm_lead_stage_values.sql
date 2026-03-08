-- A2: Add appointment_booked and visited to crm_leads status constraint
ALTER TABLE crm_leads DROP CONSTRAINT IF EXISTS crm_leads_status_check;
ALTER TABLE crm_leads ADD CONSTRAINT crm_leads_status_check
  CHECK (status IN (
    'new','contacted','interested',
    'appointment_booked','visited',
    'converted','lost','junk'
  ));
