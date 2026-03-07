# AESTHETICA CLINIC ERP — FINAL PLAN
## Single Source of Truth | Version 1.0 | 2026-03-07

---

> This document supersedes MASTER_PLAN.md and GAP_ANALYSIS.md.
> Everything Claude builds must follow this document exactly.
> No feature, table, route, or UI decision should contradict what is written here.

---

## PART 1 — SYSTEM PHILOSOPHY

This ERP is a **Clinic Operating System** for:
- Single dermatology / aesthetic clinics
- Multi-clinic chains
- Franchise networks

It must handle the **real chaos of Indian clinics**:
- Walk-ins with no prior notice
- Double bookings (allowed, not blocked)
- Counsellor-driven sales before treatment
- Package sessions split across multiple visits
- Partial payments and wallet credits
- Staff doing multiple roles simultaneously
- Manual discounts with approval gates

The system must be so easy that a superadmin can configure everything — roles, modules, workflows, invoice formats, integrations — **without touching code**.

---

## PART 2 — TECHNICAL FOUNDATION (LOCKED — DO NOT CHANGE)

| Item | Value |
|---|---|
| Framework | Next.js 14 App Router |
| Database | Supabase (project ID: `lvapwnyvtmmpmqrvtthj`) |
| Auth | `@supabase/ssr` cookie-based — never localStorage for PHI |
| Styling | Tailwind CSS |
| Supabase client | Always `import { supabase } from "@/lib/supabase"` — never `createBrowserClient` |
| TopBar | Accepts NO props — `<TopBar />` only |
| Context | `useClinic()` from `@/contexts/ClinicContext` |
| Retry | `withSupabaseRetry()` for all mutations, `withRetry()` for fetch calls |

### Standard Page Skeleton (Every page must follow this)
```tsx
"use client";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import TopBar from "@/components/TopBar";

export default function MyPage() {
  const { profile, activeClinicId: clinicId } = useClinic();
  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <TopBar />
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* content */}
      </div>
    </div>
  );
}
```

---

## PART 3 — DESIGN SYSTEM (LOCKED)

**Decision: Gold/Linen theme is the confirmed identity. Navy theme from MASTER_PLAN is rejected.**

The entire codebase uses Gold/Linen. Switching to Navy would require rebuilding every component. Gold is more premium for an aesthetics brand.

### Color Tokens
| Token | Value | Usage |
|---|---|---|
| `--gold` | `#C5A059` | Primary buttons, active states, borders, accents |
| `--gold-light` | `#D4B476` | Hover states |
| `--gold-dark` | `#A8863E` | Pressed states |
| `--bg` | `#F9F7F2` | Page background (Linen) |
| `--surface` | `#FFFFFF` | Cards, modals, drawers |
| `--text-primary` | `#1A1A1A` | Headings |
| `--text-secondary` | `#6B7280` | Labels, metadata |
| `--border` | `#E5E0D8` | Dividers, input borders |
| `--success` | `#16A34A` | Paid, completed, active |
| `--warning` | `#D97706` | Pending, partial |
| `--danger` | `#DC2626` | Error, cancelled, overdue |
| `--info` | `#2563EB` | Info states |

### Typography
| Element | Font | Size | Weight |
|---|---|---|---|
| Page title | Georgia | 24px | 600 |
| Section title | Georgia | 18px | 600 |
| Card title | Inter/system | 15px | 600 |
| Body | Inter/system | 14px | 400 |
| Table cell | Inter/system | 13px | 400 |
| Badge/label | Inter/system | 11px | 500 |

### Component Rules
- **Buttons**: Primary = gold bg + white text, rounded-lg. Secondary = white bg + gold border + gold text.
- **Cards**: white bg, rounded-xl, subtle shadow (`shadow-sm`), border `var(--border)`.
- **Modals**: Centered overlay, rounded-2xl, max-w-2xl default.
- **Drawers**: Slide from right, w-[480px] default, w-[720px] for complex forms.
- **Tables**: Striped rows (`bg-gray-50` alternate), sticky header, hover highlight.
- **Badges**: Rounded-full, color-coded per status (see status colors below).
- **Skeleton loaders**: Required on every data-loading state. Never blank screens.
- **Error states**: Show retry button. Never silent failures.

### Status Color System
| Status | Badge Color |
|---|---|
| Active / Paid / Completed | Green |
| Pending / Partial / Planned | Amber |
| Cancelled / Overdue / Lost | Red |
| Confirmed / In Progress | Blue |
| No Show / Expired | Gray |
| Draft | Light purple |

---

## PART 4 — MULTI-TENANT ARCHITECTURE

```
Superadmin Platform
      |
      └── Organization (optional grouping)
              |
              └── Chain (optional)
                      |
                      └── Clinic
                              |
                              ├── Staff (profiles)
                              └── Patients
```

- A patient belongs to a clinic but can be seen across clinics in a chain (`chain_id` on patient).
- Staff belongs to a clinic. Chain admins manage across clinics.
- All queries MUST be scoped by `clinic_id` (RLS enforces this).
- Service role used only in server-side API routes (`/api/**`).

---

## PART 5 — ROLES & PERMISSIONS

### Role Hierarchy
| Role | Scope | Notes |
|---|---|---|
| `superadmin` | Platform-wide | God mode — all clinics, all data |
| `chain_admin` | Chain-wide | Manages all clinics in a chain |
| `clinic_admin` | Single clinic | Full access within clinic |
| `doctor` | Clinic | Consultations, SOAP, prescriptions |
| `counsellor` | Clinic | Counselling pipeline, proforma — cannot collect payment |
| `therapist` | Clinic | Treatment execution |
| `front_desk` | Clinic | Appointments, check-in, basic billing |

### Permission Matrix (what each role can do)
| Action | superadmin | chain_admin | clinic_admin | doctor | counsellor | therapist | front_desk |
|---|---|---|---|---|---|---|---|
| View patients | Y | Y | Y | Y | Y | Y | Y |
| Create patient | Y | Y | Y | Y | Y | N | Y |
| View appointments | Y | Y | Y | Y | Y | Y | Y |
| Create appointment | Y | Y | Y | Y | Y | N | Y |
| Add consultation/SOAP | Y | Y | Y | Y | N | N | N |
| Add counselling notes | Y | Y | Y | Y | Y | N | N |
| Create proforma | Y | Y | Y | Y | Y | N | N |
| Create invoice | Y | Y | Y | N | N | N | Y |
| Collect payment | Y | Y | Y | N | N | N | Y |
| Apply discount | Y | Y | Y | N | N | N | N |
| Approve discount | Y | Y | Y | N | N | N | N |
| View revenue reports | Y | Y | Y | N | N | N | N |
| Manage staff | Y | Y | Y | N | N | N | N |
| Toggle modules | Y | N | N | N | N | N | N |
| God mode | Y | N | N | N | N | N | N |

### CRITICAL COUNSELLOR RESTRICTION
Counsellors **cannot** collect payment or close invoices. They can only:
1. Create proforma invoices
2. Add counselling notes
3. Move patients through counselling pipeline stages

This is enforced at API level via role check, not just UI hiding.

---

## PART 6 — NAVIGATION & LAYOUT

### Current Layout (Sidebar) — Keep As Is
The sidebar navigation is established and users are familiar with it. Do NOT migrate to top-bar navigation — this would require rebuilding the entire layout. The sidebar is mobile-responsive.

### Sidebar Structure (Confirmed)
```
MAIN
  Dashboard
  Patients
  Scheduler
  Billing
  Membership
  Counselling
  CRM
  Staff HR

ADMIN
  Reports
  Form Builder
  Webhooks
  Plugins
  Payroll
  Simulator (dev)

SETTINGS
  Services
  Settings
```

### Command Bar (Cmd+K) — TO BE BUILT
A global command palette triggered by `Cmd+K` (Mac) / `Ctrl+K` (Windows).

**Capabilities:**
1. **Navigation** — jump to any module
2. **Quick Create** — New Patient, New Appointment, New Invoice, New Lead
3. **Search** — across patients (name, phone), invoices (number), appointments

**Role-aware:** shows only commands the user has permission to execute.

**Implementation:** `components/CommandBar.tsx` using a modal overlay with `cmdk` library or custom implementation with keyboard navigation (↑↓ arrows, Enter to select, Esc to close).

**Must open in < 100ms.**

---

## PART 7 — MODULE STATUS & ROADMAP

### Status Key: LIVE | PARTIAL | MISSING

| Module | Status | Notes |
|---|---|---|
| Auth / Login | LIVE | Cookie-based SSR |
| Dashboard | LIVE | Stats, appointments, quick actions |
| Patient List | LIVE | HIPAA-masked, search, filters |
| Patient Profile v2 | LIVE | 12-tab EMR — see Section 9.1 for tab gaps |
| Scheduler | LIVE | Day/Week/Month — see Section 9.2 for gaps |
| Billing / Invoices | LIVE | GST, print, multi-payment modes |
| Proforma | PARTIAL | Exists as invoice_type flag — no lifecycle |
| Services & Packages | LIVE | 3 tabs: Services / Packages / Templates |
| Credits System | LIVE | Consumption, transfers, commissions |
| Membership | LIVE | Plans, members, wallet |
| Counselling | LIVE | Sessions, pipeline |
| CRM | LIVE | Leads, campaigns, activity log |
| Inventory | LIVE | Products, batches, inter-clinic transfers |
| Staff HR | LIVE | Directory, attendance, leaves |
| Payroll | LIVE | Runs, payslips |
| Photos | LIVE | Before/after, gallery |
| Intake Flow | LIVE | Digital intake with portal |
| Patient Portal | LIVE | Self-booking, consent e-sig |
| Notification Bell | LIVE | Real-time, Supabase Realtime |
| Workflow Designer | LIVE | 50 templates, DLQ, dry-run |
| God Mode | LIVE | Clinics, plans, dev panel, demo manager |
| Integration Simulator | LIVE | Razorpay, Meta, Google, WhatsApp mocks |
| Command Bar (Cmd+K) | MISSING | Build per Section 9.10 |
| Room Management | MISSING | Rooms as entities, Room View in scheduler |
| Proforma Lifecycle | MISSING | Draft/Approved/Converted/Expired |
| Appointment Status Fix | MISSING | Add consultation_done, treatment_done |
| Walk-in Button | MISSING | Quick walk-in flow in scheduler |
| Doctor Queue View | MISSING | Waiting list for doctor |
| Consumable Auto-deduction | MISSING | Link service to inventory items |
| CRM Stage Fix | MISSING | Add "Appointment Booked" and "Visited" stages |
| GSTR-1 / HSN Codes | MISSING | Tax compliance line items |
| Purchase Orders | MISSING | PO workflow for inventory |
| Patient Tags | MISSING | VIP, Influencer, Sensitive Skin |
| Duplicate Patient Detection | MISSING | Phone/name check on create |

---

## PART 8 — DATABASE SCHEMA (COMPLETE REFERENCE)

### Core Tables (LIVE)
```
organizations         id, name, created_at
chains                id, org_id, name, created_at
clinics               id, chain_id, name, location, admin_email,
                      subscription_status, subscription_plan,
                      is_trial, trial_ends_at, is_custom_plan, is_demo,
                      monthly_service_target, monthly_product_target
profiles              id, clinic_id, chain_id, full_name, role,
                      is_active, basic_salary, allowances, deductions
patients              id, clinic_id, chain_id, full_name, email, phone,
                      gender, date_of_birth, fitzpatrick_type,
                      primary_concern (TEXT[]), intake_notes,
                      medical_history (JSONB), allergies (TEXT[]),
                      wallet_balance NUMERIC(12,2) DEFAULT 0,
                      preferred_provider_id UUID→profiles,
                      previous_injections, notes, created_at
```

### Clinical Tables (LIVE)
```
appointments          id, clinic_id, patient_id, provider_id, service_id,
                      service_name, start_time, end_time,
                      status (planned|confirmed|arrived|in_session|completed|cancelled|no_show),
                      notes, recurrence_group_id, created_at
clinical_encounters   id, patient_id, clinic_id, provider_id,
                      subjective, objective, assessment, plan,
                      cpt_codes, photos (JSONB), created_by_name, created_at
patient_medical_history  id, patient_id, clinic_id, allergies (TEXT[]),
                         current_medications, past_procedures, skin_type,
                         primary_concerns (TEXT[]), preferred_specialist,
                         had_prior_injections, last_injection_date,
                         injection_complications, patient_notes, recorded_at
patient_notes         id, patient_id, note_type, content, author_name, created_at
patient_treatments    id, patient_id, clinic_id, treatment_name,
                      status, price, counselled_by, notes, created_at
prescriptions         id, encounter_id, patient_id, medication_name,
                      dosage, frequency, duration, created_at
patient_sticky_notes  id, patient_id, clinic_id, content, created_by, created_at
patient_face_charts   id, patient_id, clinic_id, annotations (JSONB), created_at
patient_communications  id, patient_id, clinic_id, channel, direction,
                        content, sent_by, sent_at
conditions            id, name, category, description
patient_conditions    id, patient_id, condition_id, diagnosed_at, notes
protocols             id, clinic_id, name, condition_id
protocol_steps        id, protocol_id, step_number, description
protocol_services     id, protocol_id, service_id
```

### Billing Tables (LIVE)
```
pending_invoices      id, clinic_id, patient_id, patient_name,
                      provider_id, provider_name, discount_amount,
                      total_amount, payment_mode, payment_ref,
                      due_date, paid_at, void_reason, gst_pct,
                      invoice_type (invoice|proforma|credit_note),
                      invoice_number (auto INV-YYYYMM-NNNN)
invoice_line_items    id, invoice_id, clinic_id, service_id,
                      inventory_product_id, description,
                      quantity, unit_price, discount_pct, gst_pct, line_total
invoice_payments      id, invoice_id, clinic_id, amount,
                      payment_mode (cash|card|upi|bank_transfer|wallet|insurance|gift_card),
                      transaction_ref, gift_card_id, notes, recorded_by
discount_approvals    id, clinic_id, requested_by, service_id, package_id,
                      discount_pct, otp_code, otp_expires_at, status, approved_by
gift_cards            id, clinic_id, code, initial_amount, balance,
                      purchased_by_patient_id, status, expires_at
```

### Services & Credits (LIVE)
```
services              id, clinic_id, chain_id, name, category,
                      duration_minutes, mrp, selling_price, discount_pct,
                      is_premium, is_global_template, description, is_active
service_packages      id, clinic_id, chain_id, name, description,
                      total_price, mrp, discount_pct, is_active,
                      is_fixed, is_global_template
package_items         id, package_id, service_id, sessions
patient_service_credits  id, patient_id, purchase_clinic_id,
                         current_clinic_id, service_id, package_id,
                         service_name, total_sessions, used_sessions,
                         purchase_price, per_session_value, status,
                         provider_id, family_shared, commission_pct, expires_at
credit_consumption_log   id, credit_id, patient_id, consumed_at_clinic_id,
                         provider_id, commission_pct, commission_amount, session_date
service_transfers     id, credit_id, from_clinic_id, to_clinic_id,
                      sessions_transferred, revenue_split_pct, status
service_refunds       id, credit_id, patient_id, clinic_id,
                      total_sessions, used_sessions, original_price,
                      per_session_value, cancellation_fee, refund_amount,
                      refund_reason, status
staff_commissions     id, consumption_id, provider_id, clinic_id,
                      patient_id, service_name, sale_amount,
                      commission_pct, commission_amount, status, paid_at
package_members       id, credit_id, primary_patient_id,
                      member_patient_id, allowed_sessions, is_active
provider_commission_rates  id, provider_id, clinic_id, service_id,
                           commission_pct
```

### Memberships & Wallet (LIVE)
```
membership_plans      id, clinic_id, name, duration_type,
                      price, benefits (JSONB), max_members, is_active
patient_memberships   id, clinic_id, patient_id, plan_id,
                      status, started_at, expires_at, auto_renew, invoice_id
wallet_transactions   id, clinic_id, patient_id, type,
                      amount, balance_after, reason, reference_id, reference_type
```

### CRM & Counselling (LIVE)
```
crm_leads             id, clinic_id, full_name, phone, email, source,
                      interest (TEXT[]),
                      status (new|contacted|interested|converted|lost|junk),
                      assigned_to, patient_id, next_followup
crm_campaigns         id, clinic_id, name, type, target_segment (JSONB),
                      message_template, status, scheduled_at,
                      sent_count, delivered_count
counselling_sessions  id, clinic_id, patient_id, counsellor_id,
                      session_date, chief_complaint,
                      treatments_discussed (JSONB), total_proposed,
                      total_accepted, conversion_status, followup_date, notes
```

### Staff & HR (LIVE)
```
staff_attendance      id, clinic_id, staff_id, date, clock_in,
                      clock_out, hours_worked (GENERATED), status;
                      UNIQUE(clinic_id, staff_id, date)
staff_leaves          id, clinic_id, staff_id, leave_type,
                      from_date, to_date, days (GENERATED), status, approved_by
payroll_runs          id, clinic_id, period_start, period_end,
                      status, total_gross, total_deductions, total_net
payslips              id, clinic_id, run_id, staff_id, basic_salary,
                      commission_total, allowances, deductions, tds,
                      net_pay, attendance_days, breakdown (JSONB)
```

### Inventory (LIVE)
```
inventory_products    id, clinic_id, name, category, unit, sku,
                      reorder_level, selling_price, cost_price, is_active
inventory_batches     id, product_id, clinic_id, batch_number,
                      quantity, expiry_date, purchase_price, created_at
inventory_movements   id, clinic_id, product_id, batch_id,
                      type (purchase|sale|consumption|transfer|adjustment),
                      quantity, reference_id, notes, created_by, created_at
```

### Entitlement (LIVE)
```
module_registry       module_key, display_name, description, version,
                      is_beta, is_core, min_plan, is_globally_killed,
                      killed_reason, killed_at
clinic_modules        clinic_id, module_key, is_enabled, last_used_at,
                      usage_count, valid_until
role_permissions      id, role, permission
user_permissions      user_id (PK), use_custom, system_override,
                      + 13 permission booleans
feature_usage_log     clinic_id, module_key, used_at, used_by
```

### Intelligence & Forms (LIVE)
```
report_definitions    id, clinic_id, name, base_entity, columns,
                      filters, default_sort, chart_config, schedule
dashboard_configs     id, clinic_id, user_id, layout, widgets
form_definitions      id, clinic_id, form_type
                      (intake|consent|feedback|survey|custom|soap),
                      fields (JSONB), branding (JSONB), submit_action, is_active
form_responses        id, clinic_id, form_id, patient_id,
                      responses (JSONB), submitted_at
notifications         id, clinic_id, user_id, type, title, message,
                      is_read, reference_id, reference_type, created_at
```

### Ecosystem (LIVE)
```
integration_configs   id, clinic_id, integration, config (JSONB),
                      is_active, last_tested_at, test_result
webhook_endpoints     id, clinic_id, name, url, secret,
                      events (TEXT[]), is_active, retry_count
webhook_deliveries    id, clinic_id, endpoint_id, event, payload,
                      status, response_code, attempt_count
plugin_registry       plugin_key, name, version, entry_point,
                      config_schema, events, is_verified
clinic_plugins        clinic_id, plugin_key, config (JSONB), is_enabled
referral_codes        id, clinic_id, patient_id, code, reward_amount,
                      uses_count, created_at
referral_events       id, clinic_id, referrer_patient_id,
                      referred_patient_id, reward_amount, rewarded_at
```

### Workflow (LIVE)
```
rule_definitions      id, clinic_id, name, category, trigger_event,
                      priority, run_mode, is_active, workflow_status,
                      scope_type, description
rule_conditions       id, rule_id, parent_id, logic_op, field_path,
                      operator, value (JSONB), sort_order
rule_actions          id, rule_id, action_type, params (JSONB),
                      sort_order, on_failure
rule_execution_log    id, clinic_id, rule_id, trigger_event,
                      result, error_message, executed_at, duration_ms
rule_templates        id, name, description, category, trigger_event,
                      conditions, actions, is_featured
workflow_dlq          id, clinic_id, rule_id, action_type,
                      error_message, status, retry_count
workflow_action_log   id, rule_id, clinic_id, action_type,
                      result, duration_ms
```

### Tables To Be Created (MISSING)
```
rooms                 id, clinic_id, name, type, capacity, is_active
                      (entities for Room View scheduler)

proforma_invoices     DECISION: reuse pending_invoices.invoice_type='proforma'
                      but add status column:
                      ALTER TABLE pending_invoices
                      ADD COLUMN proforma_status
                        TEXT CHECK (proforma_status IN
                        ('draft','approved','converted','expired'))
                        DEFAULT NULL;
                      (NULL = regular invoice, not a proforma)

patient_tags          id, clinic_id, patient_id, tag, created_by, created_at

purchase_orders       id, clinic_id, vendor_id, status, items (JSONB),
                      total_amount, ordered_at, received_at

service_consumables   id, service_id, inventory_product_id,
                      quantity_per_session
                      (links services to inventory for auto-deduction)
```

---

## PART 9 — MODULE SPECIFICATIONS

### 9.1 — PATIENT MODULE

#### Patient List (`/patients`)
- Table: name, phone (masked by default), last visit, doctor, status
- Filters: date range, doctor, status
- Search: name + phone
- Action: + New Patient button (top right)
- Duplicate detection on phone number before create

#### Patient Profile (`/patients/[id]`)
**12 Tabs — Current + Required Changes:**

| Tab | Status | Action Required |
|---|---|---|
| Overview | LIVE | Add "no-show count" KPI (done), active conditions, patient tags |
| Appointments | LIVE | No change |
| EMR (SOAP) | LIVE | Rename to "Consultation" to match plan |
| Charting | LIVE | No change |
| Counselling | LIVE | Add pipeline stage tracker |
| Treatments | LIVE | No change |
| Billing | LIVE | Show proforma invoices separately |
| Wallet | LIVE | No change |
| Prescriptions | LIVE | No change |
| Communications | LIVE | No change |
| Gallery (Photos) | LIVE | No change |
| Marketing | LIVE | No change |

**Missing Tabs to Add:**
- **Packages** — dedicated tab showing active packages, sessions used/remaining, expiry, redeem/freeze/transfer buttons
- **Documents** — consent forms signed, ID uploads, lab reports
- **Activity Timeline** — chronological log of every action on this patient

**Patient Header must show:**
- Photo placeholder (click to upload)
- Name + Patient ID
- Age | Gender | Phone (masked, click to reveal)
- Last Visit | Outstanding balance
- Membership badge (if active)
- VIP / allergy alert tags
- Edit | Merge | Deactivate buttons

**Quick Action Buttons (below header):**
- New Appointment
- Generate Invoice
- Start Consultation
- Add Counselling
- Add Treatment
- Upload Photo

**Duplicate Detection:**
When creating new patient, check `phone` uniqueness before save.
If match found, show modal: "Possible duplicate — Open existing | Create anyway (admin only)"

---

### 9.2 — SCHEDULER MODULE

#### Appointment Status (Fix Required)
Current statuses: `planned | confirmed | arrived | in_session | completed | cancelled | no_show`

**Add two missing statuses:**
```sql
ALTER TABLE appointments DROP CONSTRAINT appointments_status_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check
  CHECK (status IN (
    'planned', 'confirmed', 'arrived',
    'consultation_done', 'treatment_done',
    'in_session', 'completed', 'cancelled', 'no_show'
  ));
```

**Full Status Flow:**
```
Planned → Confirmed → Arrived → Consultation Done → Treatment Done → Completed
                                                              ↓
                                                     Cancelled / No Show
```

#### Appointment Color Coding
| Status | Color |
|---|---|
| planned | Gray |
| confirmed | Blue |
| arrived / checked-in | Amber |
| consultation_done | Purple |
| treatment_done | Indigo |
| completed | Green |
| cancelled | Red |
| no_show | Dark gray |

#### Views Required
1. **Doctor View** — columns = doctors, rows = time slots (current)
2. **Room View** — columns = rooms (TO BE BUILT — requires `rooms` table)
3. **Day / Week / Month toggle** — current (keep)
4. **List View** — for reception call list (TO BE BUILT)

#### Walk-in Button (Missing)
Top of scheduler: `+ Walk-in` button.
Flow:
1. Select/create patient
2. Auto-assigns to next available slot for selected doctor
3. Creates appointment with status = `arrived`

#### Double Booking
Allow overlapping appointments on same doctor/room.
Show warning: "Doctor already has an appointment at this time. Proceed?" with Confirm / Cancel.
Do NOT block — just warn.

#### Appointment Card (each card shows)
- Patient name
- Service name
- Time range
- Status color dot
- Icons: package (if credit-based), unpaid (if no invoice)

#### Appointment Right-Click / Action Menu
- Open Patient
- Check In (→ arrived)
- Consultation Done
- Treatment Done
- Reschedule
- Add Note
- Cancel
- No Show

#### Doctor Queue View (Missing — P1)
A separate view showing the doctor's waiting room:
- Waiting (arrived)
- In Consultation (consultation in progress)
- Done (consultation_done)
Doctor can reorder the queue.

---

### 9.3 — CONSULTATION MODULE

Doctors use the EMR tab in Patient Profile.
SOAP format: Subjective, Objective, Assessment, Plan.

**Doctor-to-Counsellor Handoff (BROKEN — Fix Required):**
After saving a SOAP note, doctor sees button: **"Send to Counsellor"**

This action:
1. Creates a `counselling_sessions` row with `conversion_status = 'pending'`
2. Sets `treatments_discussed` from doctor's recommended services in the Plan field
3. Sends a notification to all counsellors: "New patient referred by Dr X"
4. Updates appointment status → `consultation_done`

**This handoff is currently broken.** The button exists in some places but does not fire the notification or create the counselling row correctly.

---

### 9.4 — COUNSELLING MODULE

Counsellors work from `/counselling` page and from the Counselling tab in patient profile.

**Pipeline Stages (per counselling session):**
```
pending → in_discussion → negotiation → converted | declined
```

**Proforma Invoice Flow (Fix Required):**

Current state: Proforma is stored as `invoice_type = 'proforma'` with no status lifecycle.

Required: Add `proforma_status` column to `pending_invoices`:
```
NULL          = regular invoice (not a proforma)
'draft'       = counsellor created, patient not yet seen
'approved'    = clinic admin approved the pricing
'converted'   = patient agreed, converted to invoice
'expired'     = validity passed without conversion
```

**Proforma Actions:**
- Counsellor creates proforma (status = draft)
- Clinic admin approves (status = approved)
- Patient agrees → Convert to Invoice button → creates real invoice, sets proforma_status = converted
- Validity expires (cron or check on load) → status = expired

**Counsellor Restrictions:**
- Can create proforma
- Cannot create invoice
- Cannot collect payment
- These are enforced at API level

---

### 9.5 — BILLING MODULE

#### Invoice Types
| Type | `invoice_type` | `proforma_status` |
|---|---|---|
| Regular Invoice | `invoice` | NULL |
| Proforma / Estimate | `proforma` | `draft` / `approved` / `converted` / `expired` |
| Credit Note | `credit_note` | NULL |

#### Invoice Status Flow
```
pending → partial → paid
overdue (auto — due_date < today AND status != paid)
void (manual)
```

#### Payment Modes
`cash | card | upi | bank_transfer | wallet | insurance | gift_card`

Split payments supported — multiple `invoice_payments` rows per invoice.

#### GST
- GST % configurable per line item
- Total GST shown separately on invoice
- GSTR-1 HSN/SAC export (MISSING — P2)

#### Discount Approval Flow (LIVE)
1. Staff requests discount → OTP sent to clinic admin
2. Admin approves OTP → discount applied
3. Logged in `discount_approvals`

---

### 9.6 — CRM MODULE

#### Lead Stages (Fix Required)
Current: `new | contacted | interested | converted | lost | junk`

**Add missing stages:**
```sql
ALTER TABLE crm_leads DROP CONSTRAINT crm_leads_status_check;
ALTER TABLE crm_leads ADD CONSTRAINT crm_leads_status_check
  CHECK (status IN (
    'new', 'contacted', 'interested',
    'appointment_booked', 'visited',
    'converted', 'lost', 'junk'
  ));
```

**Full Pipeline:**
```
New Lead → Contacted → Interested → Appointment Booked → Visited → Converted
                                                                  ↘ Lost
```

**CRM-to-Appointment Sync:**
When a lead's status moves to `appointment_booked`:
1. System auto-creates appointment in scheduler
2. When patient shows up → status moves to `visited`
3. After counselling converts → status moves to `converted` + `patient_id` linked

**Lead Sources:**
`meta_ads | google_ads | website | whatsapp | walkin | referral | other`

---

### 9.7 — INVENTORY MODULE

#### Stock Movement Types
`purchase | sale | consumption | transfer | adjustment`

#### Service Consumables (Missing — P2)
Each service can define which inventory items it consumes per session.

Table: `service_consumables (service_id, inventory_product_id, quantity_per_session)`

When a session is consumed via `consume_session()` RPC:
- Auto-deduct from inventory for each linked consumable
- Creates `inventory_movements` row with type = `consumption`

#### Purchase Orders (Missing — P3)
Full PO workflow: create PO → approve → receive → auto-update stock.

---

### 9.8 — STAFF HR MODULE

**Staff Roles available for HR management:**
doctor | counsellor | therapist | front_desk

**Attendance:**
- Clock-in / clock-out per day
- `hours_worked` computed column
- Status: present | absent | half_day | late | on_leave

**Leaves:**
Types: casual | sick | earned | unpaid | other
Approval flow: pending → approved | rejected

**Doctor Availability for Scheduler:**
Doctors define their weekly schedule. Blocked slots appear gray in scheduler.
Leave dates block calendar from booking.

---

### 9.9 — MEMBERSHIP & WALLET MODULE

**Membership Plans:**
Duration types: monthly | quarterly | annual | lifetime

**Wallet:**
- Credits: purchase, refund, membership topup, referral reward
- Debits: invoice payment, expiry
- All via `wallet_transactions` table
- `debit_wallet()` RPC raises exception on insufficient balance

**Gift Cards (LIVE):**
Separate from wallet. One-time use code.

---

### 9.10 — COMMAND BAR (Cmd+K) — TO BE BUILT

**Component:** `components/CommandBar.tsx`

**Trigger:** `Cmd+K` (Mac) / `Ctrl+K` (Windows) globally

**UI:** Centered modal overlay, auto-focused input, keyboard navigable.

**Commands (grouped):**
```
NAVIGATE
  Go to Dashboard
  Go to Patients
  Go to Scheduler
  Go to Billing
  Go to CRM
  Go to Reports

CREATE
  New Patient
  New Appointment
  New Invoice
  New Lead

SEARCH (live results as user types)
  Search patients by name or phone
  Search invoices by number
  Search appointments
```

**Role filtering:** Counsellors don't see "New Invoice". Front desk don't see reports.

**Implementation pattern:**
- Global event listener for `keydown` (Cmd+K / Ctrl+K) in a `useEffect` in root layout
- Portal renders the modal outside DOM hierarchy
- Results fetched with debounce (200ms) via Supabase
- Max 5 results per category

---

### 9.11 — ROOM MANAGEMENT — TO BE BUILT

**Table:** `rooms (id, clinic_id, name, type, capacity, is_active)`

Room types: `consultation_room | treatment_room | laser_room | procedure_room | waiting_area`

**Scheduler Room View:**
- Columns = rooms (instead of doctors)
- Each appointment card shows assigned room
- Appointment creation form includes Room field (optional)

**appointments table:**
```sql
ALTER TABLE appointments ADD COLUMN room_id UUID REFERENCES rooms(id);
```

---

### 9.12 — SUPERADMIN / GOD MODE

God Mode at `/admin/god-mode` — 4 tabs (LIVE):
1. **Clinics** — module toggles, trial/plan, impersonation, login-as
2. **Plans** — `features_json` checkbox grid, batch apply
3. **Dev Panel** — kill switches, 90-day usage audit
4. **Demo Manager** — create/clear demo clinics

**Missing Superadmin Capabilities (P2):**
- Create Organization / Chain from UI
- Bulk-create staff accounts
- Edit invoice format templates from UI
- Navigation manager (reorder sidebar items)

---

## PART 10 — BROKEN FLOWS TO FIX (P0 — Fix First)

These are flows that exist in the UI but don't work end-to-end correctly.

### P0-1: Doctor → Counsellor Handoff
**Broken:** Doctor saves SOAP note but counsellor is not notified and no counselling row is created.

**Fix:**
1. After SOAP save, show "Send to Counsellor" button
2. On click: insert `counselling_sessions` row, fire notification to all counsellors in clinic, update appointment status to `consultation_done`

### P0-2: Proforma Lifecycle
**Broken:** Proforma has no status. Counsellor creates it, nothing happens after.

**Fix:** Add `proforma_status` column. Build Convert-to-Invoice, Approve, Expire actions.

### P0-3: Appointment Status — Missing Values
**Broken:** `consultation_done` and `treatment_done` statuses don't exist in DB constraint.

**Fix:** Migration to add statuses (see Section 9.2).

### P0-4: CRM Auto-Stage Sync
**Broken:** Booking appointment from a lead does not update lead status to `appointment_booked`.

**Fix:** When appointment created from lead context, update `crm_leads.status = 'appointment_booked'`.

### P0-5: Counsellor Payment Restriction
**Broken:** Role check not consistently enforced at API level.

**Fix:** All invoice-create and record-payment API routes must check `profile.role !== 'counsellor'` and return 403.

### P0-6: CRM Stage Values
**Broken:** `appointment_booked` and `visited` don't exist in DB constraint.

**Fix:** Migration to add new status values (see Section 9.6).

---

## PART 11 — FEATURE BUILD QUEUE (By Priority)

### P1 — High Priority (Build After P0 Fixes)
1. Command Bar (Cmd+K) — `components/CommandBar.tsx`
2. Appointment Room View — `rooms` table + scheduler tab
3. Walk-in Button in scheduler
4. Patient Packages tab (dedicated)
5. Patient Activity Timeline tab
6. Patient Documents tab
7. Doctor Queue View
8. Patient Tags (`patient_tags` table + UI)
9. Duplicate Patient Detection on create

### P2 — Medium Priority
10. Service Consumables auto-deduction (`service_consumables` table + `consume_session()` update)
11. GSTR-1 / HSN-SAC report
12. CRM campaign segment targeting UI (currently only template, no segment builder)
13. List View in scheduler (for reception call list)
14. Appointment drag-and-drop rescheduling
15. Bulk rescheduling (doctor unavailable → move all appointments)
16. Patient Blacklist feature

### P3 — Polish / Nice-to-Have
17. Purchase Orders workflow
18. Mobile bottom navigation bar
19. Smart conflict warnings (room/doctor)
20. Superadmin: Create Organization/Chain from UI
21. Appointment buffer time configuration per service
22. Doctor availability schedule builder
23. AI command suggestions in Command Bar
24. Patient lifetime value tracking

---

## PART 12 — API ROUTES (Complete Reference)

### Patient APIs
```
GET  /api/patients/[id]           Full EMR bundle
POST /api/patients/[id]           Actions: save_encounter, add_note, add_treatment
```

### Portal APIs
```
POST /api/portal/book             Patient self-booking (token auth)
GET  /api/portal/services         Available services for portal
POST /api/portal/consent          E-signature capture
```

### Billing APIs
```
POST /api/discounts/request       Request OTP for discount approval
POST /api/discounts/verify-otp    Verify OTP and approve discount
```

### Admin APIs
```
PATCH /api/admin/kill-switch      Toggle module_registry.is_globally_killed
POST  /api/admin/magic-link       Generate login-as link (superadmin only)
POST  /api/admin/demo/create      Create seeded demo clinic
DELETE /api/admin/demo/clear      Destroy demo clinic + all data
POST  /api/admin/invite-staff     Create staff auth user + profile + user_permissions
```

### Integration APIs
```
POST /api/leads                   External lead capture (Bearer token)
POST /api/webhooks/inbound/meta   Meta Ads webhook (HMAC verified)
POST /api/webhooks/inbound/google Google Ads webhook
POST /api/simulate/lead           Simulator: inject test lead
POST /api/simulate/payment        Simulator: inject test payment
```

### Workflow APIs
```
POST /api/workflows/dry-run       Test a rule without executing
```

### APIs To Be Created
```
GET  /api/rooms                   List rooms for clinic
POST /api/rooms                   Create room
POST /api/appointments/walkin     Quick walk-in flow
POST /api/proforma/convert        Convert proforma → invoice
PATCH /api/proforma/[id]/approve  Approve proforma (admin)
POST /api/counselling/refer       Doctor → counsellor handoff
```

---

## PART 13 — DB HELPER FUNCTIONS (Reference)

| Function | Purpose |
|---|---|
| `check_clinic_access(clinic_id, feature_name)` | Entitlement check (kill switch → plan → module) |
| `create_appointment_safe(...)` | Server-side conflict check + insert |
| `consume_session(...)` | Atomic credit deduction + commission |
| `record_payment(...)` | Atomic payment + wallet debit |
| `debit_wallet(patient_id, amount)` | Wallet deduction (raises on insufficient) |
| `assign_membership_safe(...)` | Prevents duplicate active memberships |
| `increment_no_show(...)` | Restores credit + decrements used_sessions |
| `earn_loyalty_points(...)` | Loyalty point award |
| `update_expired_memberships()` | Fire-and-forget on membership page load |
| `mark_overdue_invoices()` | Fire-and-forget on billing page load |
| `get_viewer_clinic_id()` | SECURITY DEFINER — used in RLS policies |
| `get_viewer_role()` | SECURITY DEFINER — used in RLS policies |
| `record_feature_usage(...)` | Logs to feature_usage_log |
| `logAction(...)` | Audit trail — skips silently for demo clinics |

---

## PART 14 — SECURITY RULES (Non-Negotiable)

1. **RLS on all tables** — every table has Row Level Security enabled
2. **No bare `auth.uid()`** in RLS policies — always `(SELECT auth.uid())` to prevent per-row re-evaluation
3. **All SECURITY DEFINER functions** have `SET search_path = 'public'`
4. **Service role** only used in `/api/**` server routes — never in client components
5. **No PHI in localStorage** — auth tokens and patient data only in cookies / server state
6. **Portal routes** — token-based auth (`portal_sessions` table), no Supabase JWT
7. **Superadmin routes** — always check `profile.role === 'superadmin'` server-side
8. **Counsellor restriction** — API-level check, not just UI hiding
9. **Demo clinics** — `logAction()` silently skips audit insert for demo clinic_id
10. **Webhook endpoints** — HMAC signature verification on all inbound webhooks

---

## PART 15 — EXECUTION ORDER

Do NOT start implementation until this plan is reviewed and approved.

Once approved, implement in this exact order:

```
PHASE A — Critical Fixes (P0 Broken Flows)
  A1. DB migration: add appointment statuses (consultation_done, treatment_done)
  A2. DB migration: add CRM stages (appointment_booked, visited)
  A3. DB migration: add proforma_status column to pending_invoices
  A4. Fix Doctor → Counsellor handoff flow
  A5. Build Proforma lifecycle (approve / convert / expire)
  A6. Fix Counsellor payment restriction at API level
  A7. Fix CRM auto-stage sync on appointment creation

PHASE B — High Impact New Features (P1)
  B1. Command Bar (Cmd+K)
  B2. Walk-in Button in scheduler
  B3. Patient: Packages tab
  B4. Patient: Activity Timeline tab
  B5. Patient: Documents tab
  B6. Patient Tags
  B7. Duplicate Patient Detection
  B8. Room Management + Room View in scheduler
  B9. Doctor Queue View

PHASE C — Medium Priority (P2)
  C1. Service Consumables auto-deduction
  C2. GSTR-1 / HSN-SAC report
  C3. CRM campaign segment builder
  C4. List View in scheduler
  C5. Appointment drag-and-drop
  C6. Patient Blacklist

PHASE D — Polish (P3)
  D1. Purchase Orders
  D2. Mobile bottom nav
  D3. Smart conflict warnings
  D4. Doctor availability schedule builder
  D5. Superadmin org/chain creator
```

---

## DECISIONS MADE IN THIS PLAN

| Decision | Choice | Reason |
|---|---|---|
| Color theme | Gold/Linen (`#C5A059` / `#F9F7F2`) | Entire codebase uses this; Navy would require full rebuild |
| Navigation | Sidebar (existing) | Established, mobile-responsive; top-bar migration not worth disruption |
| Proforma storage | Extend `pending_invoices` with `proforma_status` | Avoids duplicate table; same query patterns |
| CRM stages | Extend existing enum with 2 new values | Backward compatible migration |
| Room View | New `rooms` table + `room_id` FK on `appointments` | Clean entity-based approach |
| Double booking | Allow with warning | Matches real Indian clinic behavior |
| Counsellor restriction | API-level check (not just UI) | Security — UI hiding is not a security control |

---

*Last updated: 2026-03-07*
*Status: DRAFT — Awaiting review and approval before any implementation begins*
