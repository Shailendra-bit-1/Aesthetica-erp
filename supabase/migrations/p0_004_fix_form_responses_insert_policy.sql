-- Phase 0-4: Remove open anon INSERT on form_responses
-- All form submissions go through /api/intake/form-submit (service role) — anon policy not needed

DROP POLICY IF EXISTS "anon can submit intake forms" ON form_responses;
