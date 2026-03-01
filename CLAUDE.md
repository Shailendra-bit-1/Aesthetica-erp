# Aesthetica Clinic Suite — Developer Guide

## Project Stack
- **Framework**: Next.js 14 App Router (`"use client"` pages)
- **Database**: Supabase (project ID: `lvapwnyvtmmpmqrvtthj`)
- **Auth**: `@supabase/ssr` cookie-based (HIPAA-compliant — never localStorage for PHI)
- **Styling**: Tailwind CSS + inline gold/linen theme
- **Theme**: Gold `#C5A059` (`var(--gold)`), background `#F9F7F2` (Linen), serif: Georgia

---

## Critical Import Rules

### Supabase client
```ts
// CORRECT — always use the pre-instantiated singleton
import { supabase } from "@/lib/supabase";

// WRONG — createBrowserClient is NOT exported from @/lib/supabase
import { createBrowserClient } from "@/lib/supabase"; // ❌
```

### TopBar — accepts NO props
```tsx
<TopBar />   // ✅
<TopBar title="..." subtitle="..." />  // ❌ — will cause TS error
```

### Standard page skeleton
```tsx
"use client";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import TopBar from "@/components/TopBar";

export default function MyPage() {
  const { profile, activeClinicId: clinicId } = useClinic();
  // ...
  return (
    <div className="min-h-screen" style={{ background: "#F9F7F2" }}>
      <TopBar />
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* content */}
      </div>
    </div>
  );
}
```

---

## Feature Flag / Module Entitlement Rules

### Check access via `check_clinic_access(clinic_id, feature_name)`
- **Never** use the old `is_feature_enabled()` — it is a backward-compat wrapper only
- The unified function evaluates access as:
  ```
  access = (kill switch OFF) AND (clinic alive) AND (clinic_modules toggle OR plan features_json)
  ```
- Returns `boolean` — call as an RPC: `supabase.rpc("check_clinic_access", { p_clinic_id, p_feature_name })`

### Access layers (in evaluation order)
1. **Global kill switch** — `module_registry.is_globally_killed = true` → always false, all clinics
2. **Clinic alive check** — `subscription_status = 'canceled'` AND no active trial → false
3. **clinic_modules toggle** — if a row exists, `is_enabled` is the authoritative value
4. **Plan fallback** — `subscription_plans.features_json ->> feature_name` as boolean

### Trial
- Pull-based: `check_clinic_access()` checks `is_trial = true AND trial_ends_at > NOW()`
- No cron needed. Start trial: set `is_trial=true, trial_ends_at=+7d, subscription_status='active'`

### Demo clinics
- `clinics.is_demo = true` → `logAction()` **silently skips** the audit insert
- Demo clinics are created/cleared via `/api/admin/demo/create` and `/api/admin/demo/clear`

### Impersonation (View Mode)
- Superadmin only, stored in `localStorage` key `aesthetica_impersonation`
- JWT **does NOT change** — superadmin stays superadmin
- Use `useImpersonation()` hook; `auditMeta()` adds impersonation context to `logAction()` calls
- Amber banner renders in TopBar when `isImpersonating === true`

### Login-As
- Generates a real magic link via `supabaseAdmin.auth.admin.generateLink()`
- Route: `POST /api/admin/magic-link` → opens new tab with that user's JWT
- Superadmin only

### Server API gate
```ts
// At top of any API route handler:
import { checkFeature } from "@/lib/checkFeature";
const deny = await checkFeature(req, "scheduler");
if (deny) return deny;
```
- Uses service role + `check_clinic_access()` RPC — cannot be spoofed client-side
- Fires `record_feature_usage()` fire-and-forget on every allowed access

### UI gate
```tsx
// Preferred for page-level gating:
import FeatureGate from "@/components/FeatureGate";
<FeatureGate name="scheduler"><SchedulerPage /></FeatureGate>

// Or use ModuleGate directly from src/lib/feature-flags/gate.tsx
```

### Writing toggles
- Always write to `clinic_modules` table (upsert on `clinic_id, module_key`)
- `FeatureFlagsProvider` subscribes to `clinic_modules` via Realtime → instant propagation
- Kill switches write to `module_registry.is_globally_killed` → separate Realtime channel

---

## Module Keys
Defined in `src/lib/config/environment.ts` — `MODULE_KEYS` array.
Always-on modules (never gated): `core, patients, services, billing, intake`

| Key | Plan | Notes |
|---|---|---|
| `core` | always | |
| `patients` | always | |
| `services` | always | |
| `billing` | always | |
| `intake` | always | |
| `scheduler` | starter | |
| `photos` | starter | |
| `inventory` | starter | |
| `advanced_analytics` | growth | |
| `multi_chain` | growth | |
| `sms_reminders` | growth | |
| `whatsapp_booking` | growth | |
| `leads` | growth | |
| `membership` | growth | Memberships & Wallet |
| `counselling` | growth | Counselling pipeline |
| `crm` | growth | CRM & Marketing |
| `staff_hr` | growth | Staff HR & Attendance |
| `payroll` | enterprise | Payroll processing |

---

## Contexts & Hooks

### `useClinic()` — from `@/contexts/ClinicContext`
```ts
const { profile, activeClinicId, loading } = useClinic();
```
`UserProfile` interface:
```ts
interface UserProfile {
  id: string;
  full_name: string | null;
  role: string | null;         // superadmin | chain_admin | clinic_admin | doctor | therapist | counsellor | front_desk
  clinic_id: string | null;
  email: string | null;
  // NOTE: NO chain_id field on UserProfile
}
```
- `profiles` table has **no** `email` column — email comes from `auth.users`
- Active staff filter: `.eq("is_active", true)` — NOT `.eq("status", "active")`

### `useImpersonation()` — from `@/contexts/ImpersonationContext`
```ts
const { isImpersonating, impersonated, startImpersonation, stopImpersonation, auditMeta } = useImpersonation();
```

---

## Audit Logging
```ts
import { logAction } from "@/lib/audit";
await logAction({
  actor_id: profile.id,
  actor_name: profile.full_name,
  clinic_id: clinicId,           // enables demo suppression
  action: "patient.create",
  target_id: patient.id,
  target_name: patient.full_name,
  ...auditMeta(),                // spreads impersonation context if active
});
```
- `logAction()` is non-blocking (fire-and-forget)
- Demo suppression: if `clinicId` matches a clinic with `is_demo = true` → insert silently skipped

---

## God Mode
- Route: `/admin/god-mode` — superadmin only, client-side redirect guard
- Tab 1: Clinics — per-clinic module toggles, trial/plan management, impersonation, login-as
- Tab 2: Plans — `features_json` checkbox grid, batch apply to all clinics on a plan
- Tab 3: Dev Panel — kill switch toggles, 90-day usage audit
- Tab 4: Demo Manager — create/clear demo clinics

---

## Pages Built

### Core
| Route | File | Notes |
|---|---|---|
| `/login` | `app/login/page.tsx` | Auth |
| `/` | `app/page.tsx` | Dashboard — stats, appointments, quick actions; customize button for admins |
| `/patients` | `app/patients/page.tsx` | HIPAA-masked list, reveal/hide, search |
| `/patients/[id]` | `app/patients/[id]/page.tsx` | Master EMR — SOAP, CPT, photos, timeline |
| `/scheduler` | `app/scheduler/page.tsx` | Day/Week/Month, WhatsApp hook, credit consumption |
| `/billing` | `app/billing/page.tsx` | Invoices, line items, GST, print |
| `/inventory` | `app/inventory/page.tsx` | |
| `/photos` | `app/photos/page.tsx` | |
| `/intake/[clinicId]` | `app/intake/[clinicId]/` | Patient-facing digital intake |

### Services
| Route | File |
|---|---|
| `/settings/services` | `app/settings/services/page.tsx` — 3 tabs: Services / Packages / Templates |
| `/settings/services/credits` | `app/settings/services/credits/page.tsx` — Credits / Approvals / Transfers / Commissions |

### Phase 1-5 New Pages
| Route | File | Tabs |
|---|---|---|
| `/membership` | `app/membership/page.tsx` | Plans / Members / Wallet |
| `/counselling` | `app/counselling/page.tsx` | Sessions / Pipeline |
| `/crm` | `app/crm/page.tsx` | Leads / Campaigns / Log |
| `/staff` | `app/staff/page.tsx` | Directory / Attendance / Leaves |
| `/payroll` | `app/payroll/page.tsx` | Runs / Payslips |

### Admin
| Route | File | Notes |
|---|---|---|
| `/admin/billing` | `app/admin/billing/page.tsx` | Platform billing, plan management |
| `/admin/god-mode` | `app/admin/god-mode/page.tsx` | Superadmin: modules, plans, dev, demo |
| `/admin/rules` | `app/admin/rules/page.tsx` | Quick Rules / Advanced Rules / Templates |
| `/admin/reports` | `app/admin/reports/page.tsx` | 2-panel report builder |
| `/admin/forms` | `app/admin/forms/page.tsx` | Form builder — intake, consent, surveys |
| `/admin/webhooks` | `app/admin/webhooks/page.tsx` | Endpoints + delivery log |
| `/admin/plugins` | `app/admin/plugins/page.tsx` | Marketplace + installed plugins |
| `/settings` | `app/settings/page.tsx` | 6 tabs incl. DB-backed Integrations tab |

---

## Database Tables (public schema)

### Core Tables
| Table | Key Columns |
|---|---|
| `patients` | id, clinic_id, chain_id, full_name, email, phone, preferred_provider_id (UUID→profiles), primary_concern (TEXT[]), intake_notes, medical_history (JSONB), notes, date_of_birth, fitzpatrick_type, previous_injections, allergies (TEXT[]), **wallet_balance** NUMERIC(12,2) DEFAULT 0, created_at |
| `profiles` | id, clinic_id, chain_id, full_name, role (enum), is_active, created_at — **no email column** |
| `clinics` | id, chain_id, name, location, admin_email, subscription_status, subscription_plan, is_trial, trial_ends_at, is_custom_plan, is_demo, demo_created_at, created_at |
| `chains` | id, name, created_at |
| `audit_logs` | id, actor_id, actor_name, clinic_id, action, target_id, target_name, metadata (JSONB), permission_key, old_value, new_value, created_at |

### Clinical
| Table | Key Columns |
|---|---|
| `clinical_encounters` | id, patient_id, clinic_id, provider_id, subjective, objective, assessment, plan, cpt_codes, photos (JSONB), created_by_name, created_at |
| `patient_medical_history` | id, patient_id, clinic_id, allergies (TEXT[]), current_medications, past_procedures, skin_type, primary_concerns (TEXT[]), preferred_specialist, had_prior_injections, last_injection_date, injection_complications, patient_notes, recorded_at |
| `patient_notes` | id, patient_id, note_type, content, author_name, created_at |
| `patient_treatments` | id, patient_id, clinic_id, treatment_name, status, price, counselled_by, notes, created_at |
| `patient_packages` | id, patient_id, package_name, total_sessions, used_sessions, price_per_session, created_at |
| `prescriptions` | id, encounter_id, patient_id, medication_name, dosage, frequency, duration, created_at |
| `medical_codes` | code (PK), description, category — seeded with 27 aesthetic CPT codes |

### Services & Billing
| Table | Key Columns |
|---|---|
| `services` | id, clinic_id, chain_id, name, category, duration_minutes, mrp, selling_price, discount_pct, is_premium, is_global_template, description, is_active, created_by |
| `service_packages` | id, clinic_id, chain_id, name, description, total_price, mrp, discount_pct, is_active, is_fixed, is_global_template |
| `package_items` | id, package_id, service_id, sessions |
| `discount_approvals` | id, clinic_id, requested_by, service_id, package_id, discount_pct, otp_code, otp_expires_at, status, approved_by |
| `patient_service_credits` | id, patient_id, purchase_clinic_id, current_clinic_id, service_id, package_id, service_name, total_sessions, used_sessions, purchase_price, per_session_value, status (credit_status), provider_id, family_shared, commission_pct, expires_at |
| `credit_consumption_log` | id, credit_id, patient_id, consumed_at_clinic_id, provider_id, commission_pct, commission_amount, session_date |
| `service_transfers` | id, credit_id, from_clinic_id, to_clinic_id, sessions_transferred, revenue_split_pct, status, transferred_by, approved_by |
| `service_refunds` | id, credit_id, patient_id, clinic_id, total_sessions, used_sessions, original_price, per_session_value, cancellation_fee, refund_amount, refund_reason, status, requested_by, approved_by |
| `staff_commissions` | id, consumption_id, provider_id, clinic_id, patient_id, service_name, sale_amount, commission_pct, commission_amount, status (commission_status), paid_at |
| `package_members` | id, credit_id, primary_patient_id, member_patient_id, allowed_sessions, added_by, is_active |
| `pending_invoices` | id, clinic_id, patient_name, provider_id, provider_name, discount_amount, total_amount, payment_mode, payment_ref, due_date, paid_at, void_reason, gst_pct, invoice_type, invoice_number (auto via trigger INV-YYYYMM-NNNN) |
| `invoice_line_items` | id, invoice_id, clinic_id, service_id, description, quantity, unit_price, discount_pct, gst_pct, line_total |
| `invoice_payments` | id, invoice_id, clinic_id, amount, payment_mode (cash/card/upi/bank_transfer/wallet/insurance), transaction_ref, notes, recorded_by |

### Entitlement
| Table | Key Columns |
|---|---|
| `module_registry` | module_key, display_name, description, version, is_beta, is_core, min_plan, is_globally_killed, killed_reason, killed_at, last_usage_check |
| `clinic_modules` | clinic_id, module_key, is_enabled, last_used_at, last_used_by, usage_count, valid_until |
| `role_permissions` | id, role (enum), permission |
| `user_overrides` | id, user_id, permission, is_enabled |
| `feature_usage_log` | clinic_id, module_key, used_at, used_by |

### Phase 1 — Memberships & Custom Fields
| Table | Key Columns |
|---|---|
| `custom_field_definitions` | id, clinic_id, entity_type, field_key, field_label, field_type, options (JSONB), validation (JSONB), display_order, section_group; UNIQUE(clinic_id, entity_type, field_key) |
| `custom_field_values` | id, clinic_id, entity_type, entity_id, field_key, value (JSONB); UNIQUE(clinic_id, entity_type, entity_id, field_key) |
| `workflow_definitions` | id, clinic_id, entity_type, stages (JSONB), transitions (JSONB) |
| `membership_plans` | id, clinic_id, name, duration_type (monthly/quarterly/annual/lifetime), price, benefits (JSONB), max_members, is_global, is_active |
| `patient_memberships` | id, clinic_id, patient_id, plan_id, status (active/expired/cancelled/paused), started_at, expires_at, auto_renew, invoice_id |
| `wallet_transactions` | id, clinic_id, patient_id, type (credit/debit/refund/expiry), amount, balance_after, reason, reference_id, reference_type |

### Phase 2 — CRM, Counselling, Staff
| Table | Key Columns |
|---|---|
| `counselling_sessions` | id, clinic_id, patient_id, counsellor_id, session_date, chief_complaint, treatments_discussed (JSONB), total_proposed, total_accepted, conversion_status (pending/converted/partial/declined), followup_date, notes |
| `crm_leads` | id, clinic_id, full_name, phone, email, source, interest (TEXT[]), status (new/contacted/interested/converted/lost/junk), assigned_to, patient_id (set on convert), next_followup |
| `crm_campaigns` | id, clinic_id, name, type (whatsapp/sms/email), target_segment (JSONB), message_template, status (draft/scheduled/running/completed), scheduled_at, sent_count, delivered_count |
| `staff_attendance` | id, clinic_id, staff_id, date, clock_in, clock_out, hours_worked (GENERATED), status (present/absent/half_day/late/on_leave); UNIQUE(clinic_id, staff_id, date) |
| `staff_leaves` | id, clinic_id, staff_id, leave_type (casual/sick/earned/unpaid/other), from_date, to_date, days (GENERATED), status (pending/approved/rejected), approved_by |

### Phase 3 — Advanced Rules
| Table | Key Columns |
|---|---|
| `rule_definitions` | id, clinic_id, name, category (automation/validation/calculation/notification), trigger_event, priority, run_mode (sync/async), is_active |
| `rule_conditions` | id, rule_id, parent_id (self-ref for nesting), logic_op (AND/OR/NOT), field_path, operator (eq/neq/gt/lt/contains/in/between/is_null), value (JSONB), sort_order |
| `rule_actions` | id, rule_id, action_type, params (JSONB), sort_order, on_failure (stop/continue) |
| `rule_execution_log` | id, clinic_id, rule_id, trigger_event, result (success/skipped/failed), error_message, executed_at, duration_ms |
| `rule_templates` | id, name, description, category, trigger_event, conditions (JSONB), actions (JSONB), is_featured — SELECT open; mutations superadmin only |

### Phase 4 — Intelligence
| Table | Key Columns |
|---|---|
| `report_definitions` | id, clinic_id, name, base_entity, columns (JSONB), filters (JSONB), default_sort (JSONB), chart_config (JSONB), schedule (JSONB) |
| `dashboard_configs` | id, clinic_id, user_id, layout (JSONB), widgets (JSONB); UNIQUE(clinic_id, user_id) |
| `form_definitions` | id, clinic_id, form_type (intake/consent/feedback/survey/custom), fields (JSONB), branding (JSONB), submit_action (JSONB), is_active |
| `form_responses` | id, clinic_id, form_id, patient_id, responses (JSONB), submitted_at |

### Phase 5 — Ecosystem
| Table | Key Columns |
|---|---|
| `payroll_runs` | id, clinic_id, period_start, period_end, status (draft/processing/approved/paid), total_gross, total_deductions, total_net, created_by |
| `payslips` | id, clinic_id, run_id, staff_id, basic_salary, commission_total, allowances, deductions, tds, net_pay, attendance_days, breakdown (JSONB) |
| `integration_configs` | id, clinic_id, integration, config (JSONB), is_active, last_tested_at, test_result; UNIQUE(clinic_id, integration) |
| `webhook_endpoints` | id, clinic_id, name, url, secret, events (TEXT[]), is_active, retry_count |
| `webhook_deliveries` | id, clinic_id, endpoint_id, event, payload (JSONB), status (pending/delivered/failed), response_code, attempt_count |
| `plugin_registry` | plugin_key (UNIQUE), name, version, entry_point, config_schema (JSONB), events (TEXT[]), is_verified — mutations superadmin only |
| `clinic_plugins` | clinic_id, plugin_key (PK composite), config (JSONB), is_enabled |

---

## API Routes

### Patients
- `GET /api/patients/[id]` — full EMR bundle (patient, medicalHistory, notes, encounters, treatments, packages)
- `POST /api/patients/[id]` — actions: `save_encounter`, `add_note`, `add_treatment`

### Admin
- `PATCH /api/admin/kill-switch` — toggle `module_registry.is_globally_killed` (superadmin only)
- `POST /api/admin/magic-link` — generate magic link for login-as (superadmin only)
- `POST /api/admin/demo/create` — create demo clinic + seed patients + enable all modules
- `DELETE /api/admin/demo/clear` — clear all data for demo clinic + delete clinic

---

## Storage
- Bucket: `patient-photos` (private, 10 MB limit, image/jpeg + image/png + image/webp)
- `storageEnv` in `src/lib/config/environment.ts`

---

## Sidebar Navigation
Defined in `components/Sidebar.tsx`:
- `SIDEBAR_ITEMS` — main nav (Memberships, Counselling, CRM, Staff HR included)
- `ADMIN_ITEMS` — admin nav (Reports, Form Builder, Webhooks, Plugins, Payroll included)
- Each item: `{ label, href, icon, permission?, module?, superadminOnly? }`
- Module-gated items hidden when module is off via `FeatureFlagsProvider`

---

## Common Gotchas
1. **`UserProfile` has no `chain_id`** — don't pass it to patient inserts from `profile?.chain_id`
2. **`Toggle` is not in lucide-react** — use `ToggleLeft` / `ToggleRight` instead
3. **`primary_concern` on patients is `TEXT[]`** — insert as `[value]`, display as `arr[0]`
4. **`preferred_provider_id`** is a UUID FK — join `profiles` to get the name
5. **Invoice `action` column** in `audit_logs` was renamed from `action_type`
6. **Invoice status flow**: pending → partial → paid (overdue = auto from due_date; void = manual)
7. **`staff_attendance` upsert** conflict key: `clinic_id, staff_id, date`
