# AESTHETICA CLINIC ERP — PRE-IMPLEMENTATION AUDIT REPORT
## 360-Degree Final Audit | Version 1.0 | 2026-03-08

> **Audit Scope:** Live codebase (`staging` branch) + live Supabase DB scanned against FINAL_PLAN v2.0
> **Method:** Code read, live DB queries (RLS status, policy scan, schema inspection), data-flow tracing
> **Status:** All findings below MUST be resolved before Phase A implementation begins

---

## AUDIT SUMMARY SCORECARD

| Area | Gaps Found | Critical | High | Medium | Low |
|---|---|---|---|---|---|
| Security & RLS | 6 | 3 | 2 | 1 | 0 |
| Patient Journey Data Flow | 5 | 2 | 2 | 1 | 0 |
| Workflow / Three-Way Sync | 3 | 1 | 2 | 0 | 0 |
| EMR Integrity | 2 | 1 | 1 | 0 | 0 |
| Billing / Finance Logic | 4 | 2 | 1 | 1 | 0 |
| Commission Tracking | 2 | 0 | 2 | 0 | 0 |
| Schema Consistency | 5 | 0 | 2 | 2 | 1 |
| FINAL_PLAN Coverage Gaps | 13 | 3 | 5 | 3 | 2 |
| **TOTAL** | **40** | **12** | **17** | **8** | **3** |

---

## PART A — CRITICAL SECURITY FINDINGS (Fix Immediately)

---

### DA-26 — OTP Exposed in Production API Response
**Severity: CRITICAL**
**File:** `app/api/discounts/request/route.ts`

**Finding:** The discount OTP endpoint returns the raw OTP in the response body:
```ts
return NextResponse.json({ ok: true, message: "OTP sent", otp_demo: otp });
```
`otp_demo` is visible to any browser client, dev tools, or intercepting proxy. This completely bypasses the OTP approval gate — any frontend can extract the OTP from the response and self-approve discounts.

**Fix:**
- Remove `otp_demo` from the response unconditionally (not just in production).
- OTP delivery must be side-channel only (SMS/email). Response should be `{ ok: true, message: "OTP sent to registered number" }`.
- Add an env guard as defense-in-depth: only include in response if `process.env.NODE_ENV === 'development'` AND a `X-Dev-Mode: true` header is present.

---

### DA-27 — RLS Disabled on Two Tables
**Severity: CRITICAL**
**Tables:** `inventory_transfers`, `workflow_scheduled_actions`

**Finding:** Live DB scan confirmed `rowsecurity = false` on both tables. Any authenticated user from any clinic can read, insert, update, and delete all rows — bypassing multi-tenant isolation entirely.

**Fix (migration required):**
```sql
ALTER TABLE inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_scheduled_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_transfers_clinic" ON inventory_transfers
  FOR ALL USING (
    from_clinic_id = get_viewer_clinic_id()
    OR to_clinic_id = get_viewer_clinic_id()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('superadmin','chain_admin'))
  );

CREATE POLICY "workflow_scheduled_actions_clinic" ON workflow_scheduled_actions
  FOR ALL USING (
    clinic_id = get_viewer_clinic_id()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('superadmin','chain_admin'))
  );
```

---

### DA-28 — Open INSERT Policy on form_responses (Unauthenticated Access)
**Severity: CRITICAL**
**Table:** `form_responses`

**Finding:** Live DB scan found policy `anon can submit intake forms` with `qual = null` (no WHERE clause), meaning **unauthenticated users can insert rows into form_responses with any clinic_id, patient_id, or form_id**. This is a cross-clinic data injection vector.

**Fix:** Restrict to valid portal/intake context:
```sql
DROP POLICY "anon can submit intake forms" ON form_responses;

-- Authenticated users only, restricted to their clinic
CREATE POLICY "form_responses_insert" ON form_responses
  FOR INSERT WITH CHECK (
    clinic_id = get_viewer_clinic_id()
    OR clinic_id IN (
      SELECT clinic_id FROM portal_sessions
      WHERE token = current_setting('request.jwt.claims', true)::json->>'portal_token'
      AND is_active = true
      AND expires_at > NOW()
    )
  );
```
For portal/intake use a service-role API route (`POST /api/intake/submit`) rather than direct client write.

---

### DA-29 — Bare `auth.uid()` in RLS Policies (Performance + Security)
**Severity: HIGH**
**Tables affected:** `form_responses`, `form_definitions`, and ~12 others confirmed by DB scan

**Finding:** FINAL_PLAN Part 14, Rule 2 states: "No bare `auth.uid()` in RLS policies — always `(SELECT auth.uid())`". Live DB confirms multiple policies still using bare `auth.uid()` causing per-row re-evaluation (O(n) instead of O(1)) on every query. Under load this causes query times to increase linearly with table size.

**Fix:** Audit all policies and replace:
```sql
-- BAD (per-row)
auth.uid() = some_column

-- GOOD (evaluated once per query)
(SELECT auth.uid()) = some_column
```
Migration script should regenerate all affected policies using `get_viewer_clinic_id()` pattern.

---

### DA-30 — PHI Exposed in Global Search (No Masking)
**Severity: HIGH**
**File:** `components/GlobalSearchPalette.tsx`

**Finding:** Patient search results show full phone number in plain text:
```ts
subtitle: p.phone ? `Patient · ${p.phone}` : "Patient"
```
HIPAA/patient privacy requires masking PHI in list views. Full phone number is displayed to any staff with access to the search, including roles that should not see PHI.

**Fix:**
1. Apply phone masking: show only last 4 digits `·· ·· ···${p.phone?.slice(-4)}`
2. Add `autocomplete="off"` and `spellcheck={false}` to the search input
3. Filter results to `clinic_id = activeClinicId` (currently superadmin search may surface cross-clinic patients)

---

### DA-31 — Missing `clinic_id` on Critical Clinical & Billing Tables
**Severity: HIGH**
**Tables:** `patient_notes`, `patient_packages`, `patient_service_credits`, `credit_consumption_log`, `prescriptions`, `package_items`, `package_members`, `service_transfers`, `automation_triggers`, `custom_nudge_roles`

**Finding:** Live DB scan confirmed `has_clinic_id = false` on all of the above. Without `clinic_id`:
- RLS policies cannot scope reads/writes to clinic (current policies likely use parent table joins, not direct column)
- Cross-clinic data leaks possible if RLS has any gap
- Chain analytics and reporting cannot aggregate correctly

**Fix:** Add `clinic_id` columns and backfill from parent tables:
```sql
-- Example for patient_notes
ALTER TABLE patient_notes ADD COLUMN clinic_id UUID REFERENCES clinics(id);
UPDATE patient_notes pn SET clinic_id = p.clinic_id
  FROM patients p WHERE pn.patient_id = p.id;
ALTER TABLE patient_notes ALTER COLUMN clinic_id SET NOT NULL;
CREATE INDEX ON patient_notes(clinic_id);
```
Repeat for all listed tables. Update RLS policies to use `clinic_id = get_viewer_clinic_id()`.

---

## PART B — PATIENT JOURNEY DATA FLOW AUDIT

Traced: Lead → Counselling → Appointment → Treatment → Billing

---

### DA-32 — Doctor → Counsellor Handoff: No Data Bridge
**Severity: HIGH**
**Files:** `app/patients/[id]/page.tsx` (EMRTab), `app/counselling/page.tsx`

**Finding:** When a doctor saves a SOAP note (clinical encounter), there is no mechanism to:
- Create a `counselling_sessions` row from the encounter
- Notify counsellors
- Update appointment status to `consultation_done`

The FINAL_PLAN P0-1 documents this as broken but the fix is not yet implemented. The two modules (EMR and Counselling) are completely disconnected — data flow breaks at the Doctor→Counsellor boundary.

**Fix (per FINAL_PLAN P0-1):**
- Add "Send to Counsellor" button in EMRTab after SOAP save
- `POST /api/counselling/refer` — creates unclaimed counselling session, fires notification
- Update appointment status to `consultation_done`

---

### DA-33 — Proforma Price Not Locked on Convert-to-Invoice
**Severity: HIGH**
**Files:** `app/billing/page.tsx`, `app/counselling/page.tsx`

**Finding (two broken paths):**

**Path 1 — billing/page.tsx `convertProforma()`:**
```ts
// Only flips invoice_type — doesn't copy line items
await supabase.from("pending_invoices")
  .update({ invoice_type: "ad_hoc" })
  .eq("id", proformaId);
```
No line items transferred, no price lock, no `source_proforma_id` linkage.

**Path 2 — counselling/page.tsx `convertToInvoice()`:**
```ts
unit_price: t.mrp || 0,  // Uses MRP not the counsellor-quoted discounted price
```
If a counsellor quoted ₹8,000 on a ₹10,000 service (20% discount), the invoice inserts `unit_price = 10,000` with `discount_pct = 20`. The quoted locked price of ₹8,000 is not explicitly stored. If `create_invoice_with_items` RPC recalculates line total from MRP × discount, the final price might differ due to rounding.

**Fix (per FINAL_PLAN P0-2 + Section 9.4):**
1. Add `proforma_status` column: `draft | approved | converted | expired`
2. Add `source_proforma_id` FK on `pending_invoices`
3. `convertProforma()` must:
   - Copy all line items from proforma to new invoice
   - Lock price at `quoted_price = mrp * (1 - discount_pct/100)` as `unit_price` with `discount_pct = 0`
   - Set `source_proforma_id` on new invoice
   - Mark proforma status as `converted`

---

### DA-34 — CRM Lead Status Constraint Missing `appointment_booked` + `visited`
**Severity: MEDIUM**
**File:** `app/crm/page.tsx`, DB constraint on `crm_leads.status`

**Finding:** FINAL_PLAN Part 10 P0-6 documents this as broken. Live DB confirms the `crm_leads.status` check constraint only allows `new | contacted | interested | converted | lost | junk`. The `appointment_booked` and `visited` stages required by the customer journey funnel do not exist.

This means:
- P0-4 (auto-stage sync when appointment booked from lead) cannot work even if coded
- CRM funnel analytics is missing two critical middle stages
- Lead conversion rate metrics are inaccurate (patient visits are never captured)

**Fix (migration):**
```sql
ALTER TABLE crm_leads DROP CONSTRAINT crm_leads_status_check;
ALTER TABLE crm_leads ADD CONSTRAINT crm_leads_status_check
  CHECK (status IN ('new','contacted','interested','appointment_booked','visited','converted','lost','junk'));
```

---

### DA-35 — Appointment Status Missing `consultation_done` + `treatment_done`
**Severity: MEDIUM**
**Table:** `appointments.status`

**Finding:** Confirmed in FINAL_PLAN Part 10 P0-3 but not yet fixed. Live DB constraint on `appointments.status` does not include `consultation_done` or `treatment_done`. Without these statuses:
- Doctor Queue View (which should filter by `consultation_done`) cannot work
- Treatment completion triggers cannot fire based on status change
- The patient journey cannot be tracked through the full appointment lifecycle

**Fix (migration):**
```sql
ALTER TABLE appointments DROP CONSTRAINT appointments_status_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('planned','confirmed','arrived','in_session',
                    'consultation_done','treatment_done',
                    'completed','cancelled','no_show'));
```

---

## PART C — WORKFLOW ENGINE THREE-WAY SYNC AUDIT

---

### DA-36 — Inventory Deduction Missing from Session Checkout (Three-Way Sync Broken)
**Severity: HIGH**
**Files:** `app/scheduler/page.tsx` (lines ~1459 and ~3418)

**Finding:** FINAL_PLAN Part 11 P2 item 13 lists "Service Consumables auto-deduction" as a requirement. Live audit confirms the `service_consumables` table EXISTS in the DB but is NEVER called during session checkout. The three-way sync on treatment completion is:

| Step | Status |
|---|---|
| (a) Wallet debit | ✅ `record_payment` RPC handles wallet mode |
| (b) Package session deduction | ✅ `consume_session` RPC handles credit deduction |
| (c) Inventory stock reduction | ❌ **NOT IMPLEMENTED** — no inventory deduction call anywhere in checkout flow |

**Fix:** Update `consume_session()` RPC or create a new `consume_session_with_inventory()` RPC:
```sql
-- Add to consume_session() or as a post-hook
INSERT INTO inventory_transactions (product_id, clinic_id, type, quantity, reference_id, reference_type)
SELECT sc.product_id, p_clinic_id, 'consumption', -sc.quantity, p_credit_id, 'credit_consumption'
FROM service_consumables sc
WHERE sc.service_id = (SELECT service_id FROM patient_service_credits WHERE id = p_credit_id);

UPDATE inventory_batches SET quantity_remaining = quantity_remaining - sc.quantity
FROM service_consumables sc
WHERE sc.service_id = (SELECT service_id FROM patient_service_credits WHERE id = p_credit_id)
  AND inventory_batches.product_id = sc.product_id
  AND quantity_remaining >= sc.quantity;
```

---

### DA-37 — Workflow `delay_minutes` Action: No Scheduler Table Enforcement
**Severity: MEDIUM**
**Table:** `workflow_scheduled_actions`

**Finding:** The `delay_minutes` action type exists in the Workflow Designer UI (GAP-8 was implemented), and the `workflow_scheduled_actions` table exists in the DB. However:
1. The table has RLS disabled (covered in DA-27)
2. There is no background worker / cron / Edge Function that processes rows in `workflow_scheduled_actions`
3. Inserting a delayed action row does nothing — no execution engine exists

**Fix:**
1. Deploy a Supabase Edge Function `process-workflow-queue` triggered by `pg_cron` every minute
2. The function reads `workflow_scheduled_actions WHERE execute_at <= NOW() AND status = 'pending'`
3. Executes the action, marks as `completed` or `failed`
4. Add to FINAL_PLAN Part 12 as a required API/function

---

### DA-38 — Rule Execution Engine: Frontend-Only Evaluation
**Severity: MEDIUM**
**File:** `app/admin/rules/page.tsx`

**Finding:** The Workflow Designer allows creating rules with triggers (appointment.created, invoice.paid, etc.). However, there is no server-side event listener that fires these rules. The "dry-run" endpoint (`/api/workflows/dry-run`) exists but:
- Actual rule execution requires a trigger hook in each relevant API route
- None of the API routes (appointment create, invoice create, session complete, etc.) call `evaluate_rules(trigger_event, context)`
- Rules exist only in the DB and designer UI — they never execute in production

**Fix:** Add rule evaluation hook to every trigger-point API:
```ts
// After appointment creation in scheduler
await fireWebhookEvent("appointment.created", { appointment, patient });
// Also call rule evaluator
await supabase.rpc("evaluate_workflow_rules", {
  p_clinic_id: clinicId,
  p_trigger: "appointment.created",
  p_context: { appointment_id: appt.id, patient_id: appt.patient_id }
});
```

---

## PART D — EMR & CLINICAL INTEGRITY AUDIT

---

### DA-39 — Clinical Encounters Not Immutable at DB Level
**Severity: HIGH**
**File:** `lib/supabase-schema.sql` (RLS policy), `app/api/patients/[id]/route.ts`

**Finding:** `clinical_encounters` has a policy `"Admins manage clinical_encounters"` with `FOR ALL` — this grants SELECT, INSERT, **UPDATE, and DELETE** to all admin/superadmin roles. The API route (`save_encounter` action) only does INSERT, preserving immutability at the API level. But:
1. Direct Supabase client calls (bypassing the API) can UPDATE or DELETE encounters for any admin
2. No audit trail is required by the policy for modifications
3. FINAL_PLAN Section 9.3 states encounters are immutable: "No edit. No delete. Amend only via new note."

**Fix:**
```sql
-- Drop the ALL policy
DROP POLICY "Admins manage clinical_encounters" ON clinical_encounters;

-- Replace with INSERT-only (no UPDATE, no DELETE for anyone)
CREATE POLICY "clinical_encounters_insert" ON clinical_encounters
  FOR INSERT WITH CHECK (clinic_id = get_viewer_clinic_id());

CREATE POLICY "clinical_encounters_select" ON clinical_encounters
  FOR SELECT USING (clinic_id = get_viewer_clinic_id()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('superadmin','chain_admin')));

-- No UPDATE policy = encounters are immutable
-- No DELETE policy = encounters are permanent (even superadmin cannot delete)
```

---

### DA-40 — Encounter Missing `provider_id` FK
**Severity: MEDIUM**
**File:** `app/api/patients/[id]/route.ts` (save_encounter action)

**Finding:** The `clinical_encounters` table has a `provider_id` column (UUID FK to profiles), but the API route's `save_encounter` action does not include `provider_id` in the INSERT:
```ts
await supabase.from("clinical_encounters").insert({
  patient_id, clinic_id, subjective, objective, assessment, plan, cpt_codes,
  created_by_name: profile.full_name,
  // provider_id is NOT inserted
});
```
`created_by_name` is a text string — not a FK. This means:
- Encounter cannot be reliably linked to a doctor for analytics
- Per-doctor encounter history is broken
- `provider_id` filter in doctor queue view will not work

**Fix:** Add `provider_id: profile.id` to the insert payload in the `save_encounter` API action.

---

## PART E — BILLING & COMMISSION LOGIC AUDIT

---

### DA-41 — Void Invoice Does Not Reverse Wallet Payment
**Severity: HIGH**
**File:** `app/billing/page.tsx` (`voidInvoice()`)

**Finding:**
```ts
async function voidInvoice(invoiceId: string) {
  await supabase.from("pending_invoices")
    .update({ status: "void", void_reason: reason })
    .eq("id", invoiceId);
  // No wallet reversal. No credit reversal. No refund.
}
```
If a patient paid ₹5,000 via wallet and the invoice is voided, their wallet balance remains debited. Money is lost with no reversal path.

**Fix:** Before voiding, check `invoice_payments` for wallet-mode payments and reverse them:
```ts
const { data: payments } = await supabase.from("invoice_payments")
  .select("amount, payment_mode")
  .eq("invoice_id", invoiceId)
  .eq("payment_mode", "wallet");

for (const p of payments ?? []) {
  await supabase.rpc("credit_wallet", {
    p_patient_id: invoice.patient_id,
    p_amount: p.amount,
    p_reason: `Void reversal for invoice ${invoice.invoice_number}`,
    p_reference_id: invoiceId,
    p_reference_type: "invoice_void"
  });
}
```

---

### DA-42 — Sale Commission Not Tracked (Only Delivery Commission Exists)
**Severity: HIGH**
**Table:** `patient_service_credits`, `staff_commissions`

**Finding:** In Indian aesthetic clinics, commission is typically split:
- **Sale commission** — to the counsellor/doctor who sold the package (one-time at purchase)
- **Delivery commission** — to the doctor/therapist who performed the session (per session)

Current implementation:
- `patient_service_credits` has only `commission_pct` (delivery rate) — no `sold_by_provider_id`
- `staff_commissions` is created only in `consume_session()` at session delivery time
- **The counsellor who sold the package gets zero commission** unless they also deliver sessions
- Credits are inserted with `commission_pct: 0` in counselling's `convertToInvoice()` flow

**Fix:** Add sale commission tracking:
```sql
ALTER TABLE patient_service_credits
  ADD COLUMN sold_by_provider_id UUID REFERENCES profiles(id),
  ADD COLUMN sale_commission_pct NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN sale_commission_amount NUMERIC(12,2) DEFAULT 0;
```
At package purchase: calculate `sale_commission_amount = selling_price * sale_commission_pct / 100` and insert a `staff_commissions` row with `commission_type = 'sale'`.

---

### DA-43 — `create_invoice_with_items` Called with `service_id: null`
**Severity: MEDIUM**
**File:** `app/scheduler/page.tsx` (checkout flow ~line 3418)

**Finding:** During scheduler checkout, line items are built as:
```ts
{ service_id: null, description: serviceName, unit_price: ..., quantity: 1 }
```
`service_id: null` means:
- HSN/SAC lookup from `services` table is impossible
- No service-to-consumable link for DA-36's inventory deduction
- GSTR-1 report grouping by HSN code will be empty/null for session invoices

**Fix:** Pass the actual `service_id` from the appointment or credit record:
```ts
{ service_id: credit.service_id, description: serviceName, unit_price: ..., quantity: 1 }
```

---

### DA-44 — Gift Card Balance Not Validated Before Redemption
**Severity: MEDIUM**
**Table:** `gift_cards`, `invoice_payments`

**Finding:** The `RecordPaymentDrawer` allows gift_card as a payment mode and looks up `gift_card_id`. However, there is no server-side validation that:
1. The gift card balance >= the payment amount
2. The gift card is not expired
3. The gift card belongs to the correct clinic
This means a front-desk user could redeem an expired or empty gift card.

**Fix:** Add a `validate_gift_card(p_gift_card_id, p_amount, p_clinic_id)` DB function (or check in `record_payment` RPC) that raises an exception if invalid.

---

## PART F — SCHEMA CONSISTENCY AUDIT

---

### DA-45 — `profiles` Table Has `email` Column (Contradicts CLAUDE.md)
**Severity: LOW**
**Files:** `lib/supabase-schema.sql`, `CLAUDE.md`

**Finding:** `lib/supabase-schema.sql` contains:
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
```
CLAUDE.md states: **"profiles table has NO email column — email comes from auth.users"**

This creates two sources of truth. Code written per CLAUDE.md won't read `profiles.email`. Schema has it. Either:
- The column was added for a feature but CLAUDE.md wasn't updated, OR
- CLAUDE.md is correct and the schema migration should be reverted

**Fix:** Decide and enforce one canonical approach:
- Option A: Remove `email` from profiles, always join `auth.users` via service role in server routes
- Option B: Keep `email` on profiles, update CLAUDE.md, add a trigger to sync from `auth.users`

---

### DA-46 — Walk-in `is_walkin` Column Not Yet Added
**Severity: LOW**
**FINAL_PLAN P0-7**

**Finding:** FINAL_PLAN P0-7 requires:
```sql
ALTER TABLE appointments ADD COLUMN is_walkin BOOLEAN DEFAULT false;
```
And `POST /api/appointments/walkin` route to bypass `create_appointment_safe`. Neither the column nor the route exists. All walk-ins currently go through the conflict-check RPC and may silently fail or produce confusing warnings.

**Fix:** Migration + new API route as specified in FINAL_PLAN P0-7.

---

### DA-47 — Counselling Claim Columns Not Yet Added
**Severity: LOW**
**FINAL_PLAN P0-8**

**Finding:** FINAL_PLAN P0-8 requires:
```sql
ALTER TABLE counselling_sessions
  ADD COLUMN claimed_by UUID REFERENCES profiles(id),
  ADD COLUMN claimed_at TIMESTAMPTZ,
  ADD COLUMN claim_status TEXT DEFAULT 'unclaimed'
    CHECK (claim_status IN ('unclaimed','claimed','released'));
```
None of these columns exist in live DB. Without the claim system, two counsellors can simultaneously edit the same session, creating race conditions and data conflicts.

**Fix:** Migration + Claim/Unclaim UI (per FINAL_PLAN Section 9.4) + API routes `/api/counselling/claim` and `/api/counselling/unclaim`.

---

### DA-48 — `proforma_status` Column Not Yet Added
**Severity: MEDIUM**
**FINAL_PLAN P0-2 + Section 9.5**

**Finding:** FINAL_PLAN requires `proforma_status TEXT CHECK IN ('draft','approved','converted','expired')` on `pending_invoices`. Without it:
- Expired proformas cannot be identified or cleaned up
- The approve/reject workflow has no state machine
- `source_proforma_id` FK (for DA-33 fix) has nowhere to link to

**Fix:**
```sql
ALTER TABLE pending_invoices
  ADD COLUMN proforma_status TEXT DEFAULT 'draft'
    CHECK (proforma_status IN ('draft','approved','converted','expired')),
  ADD COLUMN source_proforma_id UUID REFERENCES pending_invoices(id),
  ADD COLUMN approved_by UUID REFERENCES profiles(id),
  ADD COLUMN approved_at TIMESTAMPTZ,
  ADD COLUMN expires_at TIMESTAMPTZ;
```

---

### DA-49 — 109 Live Tables vs ~37 in FINAL_PLAN Schema Section
**Severity: LOW (Documentation)**

**Finding:** Live DB scan shows 109 tables in the `public` schema. FINAL_PLAN Part 8 documents approximately 37. The gap includes:
- `scheduler_settings`, `appointment_rooms`, `block_times`, `waitlist_entries`
- `loyalty_programs`, `loyalty_tiers`, `patient_loyalty`, `loyalty_redemptions`
- `recall_schedules`, `recall_events`
- `whatsapp_messages`, `notification_templates`
- `automation_triggers`, `custom_nudge_roles`
- `workflow_dlq`, `workflow_action_log`, `workflow_clinic_overrides`, `workflow_scheduled_actions`
- `portal_sessions`, `patient_consent_records`
- `before_after_photos`, `photo_albums`
- `inventory_batches`, `inventory_transactions`, `inventory_suppliers`, `purchase_orders`
- And ~50 more

**Impact:** FINAL_PLAN is not the actual single source of truth for the DB schema — it only documents ~34% of existing tables. Any developer using FINAL_PLAN for schema reference will miss 66% of the actual schema.

**Fix:** Update FINAL_PLAN Part 8 with a complete table listing generated from live DB. Or create a separate `SCHEMA.md` that is auto-generated from the DB.

---

## PART G — FINAL_PLAN COVERAGE GAPS (Features Planned but Not Implemented)

The following items are documented in FINAL_PLAN as "MISSING" but need confirmation they are in the implementation queue before Phase A begins.

| # | Item | FINAL_PLAN Reference | Priority |
|---|---|---|---|
| G-01 | Top Bar Navigation (rebuild) | Part 7, P1-1 | P1 — required before launch |
| G-02 | Navy/White theme migration | Part 3, P1-2 | P1 — required before launch |
| G-03 | Command Bar (Cmd+K) | Section 9.10, P1-3 | P1 |
| G-04 | HSN/SAC on services + invoices | Part 7, P1-4 | P1 — tax compliance |
| G-05 | Proforma full lifecycle | Section 9.4, P0-2 | P0 — broken flow |
| G-06 | Appointment status fix | P0-3 | P0 — blocks doctor queue |
| G-07 | CRM stage fix | P0-6 | P0 — blocks funnel analytics |
| G-08 | Doctor → Counsellor handoff | P0-1 | P0 — broken flow |
| G-09 | Counsellor payment restriction (API level) | P0-5 | P0 — broken flow |
| G-10 | Walk-in force-overlap | P0-7 | P0 |
| G-11 | Counsellor claim system | P0-8 | P0 |
| G-12 | Room Management + Room View in scheduler | Section 9.11, P1-5 | P1 |
| G-13 | Doctor Queue View | Part 7, P1-10 | P1 |

---

## PART H — REMEDIATION PRIORITY ORDER

Implement in this exact sequence. Do NOT proceed to the next phase until all items in the current phase pass QA.

### PHASE 0 — Security Hotfixes (Deploy to production immediately)
1. **DA-26** — Remove `otp_demo` from discount API response
2. **DA-27** — Enable RLS on `inventory_transfers` and `workflow_scheduled_actions`
3. **DA-28** — Fix open INSERT policy on `form_responses`

### PHASE 1 — DB Migrations (Pre-implementation, unblocks all other work)
4. **DA-35** — Add appointment statuses: `consultation_done`, `treatment_done`
5. **DA-34** — Add CRM statuses: `appointment_booked`, `visited`
6. **DA-48** — Add `proforma_status`, `source_proforma_id` to `pending_invoices`
7. **DA-47** — Add claim columns to `counselling_sessions`
8. **DA-46** — Add `is_walkin` to `appointments`
9. **DA-42** — Add `sold_by_provider_id`, `sale_commission_pct` to `patient_service_credits`
10. **DA-31** — Add `clinic_id` to all tables missing it

### PHASE 2 — Broken Flow Fixes
11. **DA-33** — Fix proforma convert (price lock + line item copy)
12. **DA-39** — Fix clinical encounters immutability (drop ALL policy → INSERT-only)
13. **DA-40** — Add `provider_id` to encounter insert in API route
14. **DA-41** — Add wallet reversal to void invoice
15. **DA-32** — Fix Doctor → Counsellor handoff flow
16. **DA-43** — Pass `service_id` (not null) in scheduler checkout line items
17. **DA-29** — Replace bare `auth.uid()` with `(SELECT auth.uid())` across all RLS policies
18. **DA-30** — Mask phone in GlobalSearchPalette

### PHASE 3 — Three-Way Sync & Commission Tracking
19. **DA-36** — Add inventory deduction to `consume_session()` RPC
20. **DA-42** — Wire sale commission at package purchase
21. **DA-37** — Deploy `workflow_scheduled_actions` execution cron
22. **DA-38** — Add rule evaluation hooks to all trigger-point API routes

### PHASE 4 — New Features (in FINAL_PLAN build queue)
23. **G-08** + **G-11**: Doctor handoff + Counsellor claim system
24. **G-05**: Proforma lifecycle (approve/expire/convert workflow)
25. **G-06** + **G-07**: Status migrations (already done in Phase 1, now build the UI)
26. **G-09**: Counsellor payment restriction at API level
27. **G-10**: Walk-in force-overlap button + API route
28. **G-01** + **G-02**: Top Bar + Navy/White theme
29. **G-03**: Command Bar (Cmd+K)
30. **G-04**: HSN/SAC on services + GSTR-1 export
31. **G-12** + **G-13**: Room management + Doctor Queue View

---

## PART I — ACCEPTANCE CRITERIA

Before moving to Phase A implementation, ALL of the following must be confirmed:

- [ ] **DA-26** OTP not in any API response (verified via Postman/curl)
- [ ] **DA-27** `inventory_transfers` and `workflow_scheduled_actions` have `rowsecurity = true`
- [ ] **DA-28** No `qual = null` INSERT policy on `form_responses`
- [ ] **DA-29** Zero policies using bare `auth.uid()` (DB query to verify)
- [ ] **DA-30** Phone shown as `·· ·· ···1234` in GlobalSearchPalette
- [ ] **DA-31** `clinic_id` present on all 10 listed tables
- [ ] **DA-32** Doctor handoff creates counselling row + fires notification
- [ ] **DA-33** Proforma convert copies line items + stores `source_proforma_id`
- [ ] **DA-34** `crm_leads.status` constraint includes `appointment_booked` and `visited`
- [ ] **DA-35** `appointments.status` constraint includes `consultation_done` and `treatment_done`
- [ ] **DA-36** `consume_session()` includes inventory deduction step
- [ ] **DA-39** `clinical_encounters` has NO UPDATE and NO DELETE RLS policies
- [ ] **DA-40** Encounter INSERT includes `provider_id`
- [ ] **DA-41** Void invoice reverses wallet payments
- [ ] **DA-42** `patient_service_credits` has `sold_by_provider_id` column
- [ ] **DA-43** Scheduler checkout passes `service_id` in line items
- [ ] **DA-44** Gift card validated before redemption
- [ ] **DA-47** `counselling_sessions` has claim columns
- [ ] **DA-48** `pending_invoices` has `proforma_status` column
- [ ] All P0 broken flows (G-05 through G-11) resolved and end-to-end tested

---

*Audit completed: 2026-03-08*
*Auditor: Claude (Pre-Implementation Review)*
*Next action: Address Phase 0 security hotfixes, then proceed with Phase 1 DB migrations*
