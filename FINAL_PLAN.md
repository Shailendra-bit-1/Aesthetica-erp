# AESTHETICA CLINIC ERP — FINAL PLAN
## Single Source of Truth | Version 2.0 | 2026-03-07

---

> This document supersedes MASTER_PLAN.md and GAP_ANALYSIS.md.
> Everything Claude builds must follow this document exactly.
> No feature, table, route, or UI decision should contradict what is written here.
>
> **v2.0 Master Overrides applied:**
> - Design: Navy/White SaaS theme replaces Gold/Linen
> - Navigation: Top Bar replaces sidebar
> - Logic: Counsellor Claim System, HSN/SAC mandatory, Force-Overlap walk-ins
> - Infrastructure: Part 16 — Scaling & Stability added

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

The global layout has a fixed Top Bar at the top and no sidebar.
All pages render inside the workspace area below the Top Bar.

```tsx
"use client";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import TopBar from "@/components/TopBar";

export default function MyPage() {
  const { profile, activeClinicId: clinicId } = useClinic();
  return (
    // Top Bar is rendered once in the root layout — do NOT render it per-page
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <nav className="text-sm text-[var(--text-secondary)] mb-1">
              {/* Breadcrumb: Home / Module / Page */}
            </nav>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              Page Title
            </h1>
          </div>
          <div className="flex gap-3">
            {/* Primary action button */}
          </div>
        </div>
        {/* Toolbar — filters, search, secondary actions */}
        {/* Main content */}
      </div>
    </div>
  );
}
```

**Root layout structure (`app/layout.tsx`):**
```tsx
<body>
  <TopBar />                    {/* fixed top, z-50 */}
  <main className="pt-16">     {/* padding-top = TopBar height */}
    {children}
  </main>
  <CommandBar />                {/* portal, rendered globally */}
  <NotificationCenter />        {/* portal */}
</body>
```

---

## PART 3 — DESIGN SYSTEM (LOCKED — v2.0)

**Decision: Navy/White SaaS theme. Replaces the previous Gold/Linen theme.**

The UI must match modern SaaS clinic software (Mangomint/Zenoti tier). Navy communicates authority and clinical professionalism. The full codebase will be migrated to use CSS variables so a single token change propagates everywhere.

### CSS Variables (set in `globals.css` `:root`)
```css
:root {
  --primary:        #0B2A4A;   /* Navy — primary buttons, active nav, accents */
  --primary-hover:  #1F4E79;   /* Navy hover */
  --primary-light:  #2E6CB8;   /* Accent blue — links, icons, secondary actions */
  --primary-subtle: #EFF4FB;   /* Light blue tint — hover backgrounds, badges */

  --bg:             #F7F9FC;   /* Near-white page background */
  --surface:        #FFFFFF;   /* Cards, modals, drawers, panels */
  --surface-muted:  #F1F5F9;   /* Muted surface — table rows alt, input bg */

  --text-primary:   #0F172A;   /* Near-black headings */
  --text-secondary: #64748B;   /* Slate — labels, metadata, placeholder */
  --text-inverse:   #FFFFFF;   /* Text on dark/navy backgrounds */

  --border:         #E2E8F0;   /* Dividers, input borders */
  --border-strong:  #CBD5E1;   /* Stronger border for active/focused */

  --success:        #16A34A;   /* Paid, completed, active, present */
  --success-bg:     #F0FDF4;   /* Success badge background */
  --warning:        #D97706;   /* Pending, partial, half-day */
  --warning-bg:     #FFFBEB;   /* Warning badge background */
  --danger:         #DC2626;   /* Error, cancelled, overdue, absent */
  --danger-bg:      #FEF2F2;   /* Danger badge background */
  --info:           #2563EB;   /* Info, confirmed, in-progress */
  --info-bg:        #EFF6FF;   /* Info badge background */
  --neutral:        #6B7280;   /* No-show, expired, draft */
  --neutral-bg:     #F9FAFB;   /* Neutral badge background */
}
```

### Typography
| Element | Font Stack | Size | Weight | Color |
|---|---|---|---|---|
| Page title | Inter, -apple-system, sans-serif | 24px | 700 | `--text-primary` |
| Section title | Inter | 18px | 600 | `--text-primary` |
| Card title | Inter | 15px | 600 | `--text-primary` |
| Body text | Inter | 14px | 400 | `--text-primary` |
| Table cell | Inter | 13px | 400 | `--text-primary` |
| Label / caption | Inter | 12px | 500 | `--text-secondary` |
| Badge text | Inter | 11px | 600 | varies |

Georgia/serif is **removed** from the design system entirely.

### Component Rules
- **Buttons — Primary**: `bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] rounded-lg px-4 py-2 font-medium`
- **Buttons — Secondary**: `bg-white text-[var(--primary)] border border-[var(--primary)] hover:bg-[var(--primary-subtle)] rounded-lg`
- **Buttons — Danger**: `bg-[var(--danger)] text-white hover:opacity-90 rounded-lg`
- **Cards**: `bg-white rounded-xl shadow-sm border border-[var(--border)]`
- **Modals**: Centered overlay with navy header bar, `rounded-2xl`, `max-w-2xl` default, `max-w-4xl` for complex
- **Drawers**: Slide from right, `w-[480px]` default, `w-[720px]` for complex forms. Navy header stripe.
- **Tables**: `bg-[var(--surface-muted)]` alternate rows, sticky header with navy background, hover highlight
- **Input fields**: `border border-[var(--border)] rounded-lg focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]`
- **Badges**: `rounded-full text-xs font-semibold px-2 py-0.5` — use `--success-bg/--success` pair etc.
- **Skeleton loaders**: Required on every data-loading state. Use `animate-pulse bg-[var(--surface-muted)]`. Never blank screens.
- **Error states**: Show retry button with `--danger` color. Never silent failures.
- **Top Bar**: `bg-[var(--primary)] text-white h-16 fixed top-0 left-0 right-0 z-50`
- **Active nav item**: `bg-white/10 rounded-md`

### Status Badge System
| Status | Badge Classes |
|---|---|
| Active / Paid / Completed / Present | `bg-[var(--success-bg)] text-[var(--success)]` |
| Pending / Partial / Planned / Warning | `bg-[var(--warning-bg)] text-[var(--warning)]` |
| Cancelled / Overdue / Lost / Danger | `bg-[var(--danger-bg)] text-[var(--danger)]` |
| Confirmed / In Progress / Info | `bg-[var(--info-bg)] text-[var(--info)]` |
| No Show / Expired / Neutral | `bg-[var(--neutral-bg)] text-[var(--neutral)]` |
| Draft | `bg-purple-50 text-purple-600` |

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

### Layout: Top Bar Navigation (v2.0 Override)

The sidebar is replaced by a fixed Top Bar. This is the primary navigation pattern.

**Top Bar Layout (desktop):**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [A] Aesthetica  [Clinic ▼]  Dashboard  Patients  Scheduler  Billing  CRM   │
│                             Reports  [Apps ⊞]  [⌘K Search...]  [🔔]  [P▼] │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Top Bar Component (`components/TopBar.tsx`) elements:**
1. **Logo + Wordmark** — left side, links to `/`
2. **Clinic Switcher** — dropdown showing active clinic name; chain_admin/superadmin can switch
3. **Primary Nav Links** — Dashboard, Patients, Scheduler, Billing, CRM, Reports
4. **Apps Menu** — grid icon opens a module grid overlay (see below)
5. **Command Bar trigger** — `⌘K` pill button, opens CommandBar
6. **Notification Bell** — `🔔` with unread count badge
7. **Profile Menu** — initials avatar dropdown: Profile, Settings, Switch Role, Sign Out

**Apps Menu Grid (click ⊞):**
```
PATIENT MANAGEMENT     OPERATIONS          SALES
  Patients               Scheduler           CRM
  Medical Records        Rooms               Counselling
  Intake Portal          Inventory           Packages

FINANCE                ADMIN               SETTINGS
  Billing                Staff HR            Services
  Memberships            Payroll             Integrations
  Wallet                 God Mode            Webhooks
                         Form Builder
                         Reports
                         Simulator
```

**TopBar accepts NO props** — `<TopBar />` only. All data comes from context.

**TopBar is NOT rendered per-page.** It is rendered once in `app/layout.tsx` and all pages sit in `<main className="pt-16">`.

### Mobile Navigation (Bottom Bar)
On viewport `< 768px`, the Top Bar collapses and a bottom navigation bar appears:
```
[Home]  [Patients]  [Scheduler]  [CRM]  [Apps]
```

### Tablet Navigation
Top Bar stays. Clinic name truncates. Primary nav shows 4 items; overflow goes to Apps.

### Breadcrumb (per page)
Every page shows a breadcrumb below the Top Bar:
```
Dashboard / Patients / Rahul Sharma
```
Implemented as a `<Breadcrumb>` component, passed via page-level `<PageHeader>` component.

### Page Structure Pattern
Every module page follows this structure:
```
[Top Bar — fixed, from layout]
[Page Header — breadcrumb + title + primary action button]
[Toolbar — filters, search, sort, export]
[Content — table / cards / scheduler / form]
[Footer actions — where applicable]
```

### Command Bar (Cmd+K) — TO BE BUILT
A global command palette triggered by `Cmd+K` (Mac) / `Ctrl+K` (Windows).

**Capabilities:**
1. **Navigation** — jump to any module instantly
2. **Quick Create** — New Patient, New Appointment, New Invoice, New Lead
3. **Search** — live results across patients (name, phone), invoices (number), appointments

**Role-aware:** shows only commands the user has permission to execute.

**Implementation:** `components/CommandBar.tsx` — modal portal, keyboard navigable (↑↓ arrows, Enter to select, Esc to close), results debounced 200ms, max 5 per category.

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
| Top Bar Navigation | MISSING | Replace sidebar — rebuild TopBar + root layout |
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
rooms                 id, clinic_id, name, type, capacity, is_active,
                      metadata JSONB DEFAULT '{}'
                      (entities for Room View scheduler)

patient_tags          id, clinic_id, patient_id, tag, created_by, created_at

purchase_orders       id, clinic_id, vendor_id, status, items (JSONB),
                      total_amount, ordered_at, received_at,
                      metadata JSONB DEFAULT '{}'

service_consumables   id, service_id, inventory_product_id,
                      quantity_per_session
                      (links services to inventory for auto-deduction)

clinic_feature_flags  id, clinic_id, flag_key, is_enabled, config JSONB DEFAULT '{}'
                      UNIQUE(clinic_id, flag_key)
                      (granular per-clinic behavioral flags — see Part 16)
```

### Column Alterations Required (MISSING)
```sql
-- Proforma lifecycle
ALTER TABLE pending_invoices
  ADD COLUMN proforma_status TEXT
    CHECK (proforma_status IN ('draft','approved','converted','expired'))
    DEFAULT NULL;

-- Counsellor Claim System
ALTER TABLE counselling_sessions
  ADD COLUMN claimed_by UUID REFERENCES profiles(id) DEFAULT NULL,
  ADD COLUMN claimed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN claim_status TEXT
    CHECK (claim_status IN ('unclaimed','claimed','admin_override'))
    DEFAULT 'unclaimed';

-- HSN/SAC on services
ALTER TABLE services
  ADD COLUMN hsn_sac_code VARCHAR(8) DEFAULT NULL,
  ADD COLUMN gst_category TEXT
    CHECK (gst_category IN ('exempt','5%','12%','18%','28%'))
    DEFAULT '18%';

-- HSN/SAC on invoice line items
ALTER TABLE invoice_line_items
  ADD COLUMN hsn_sac_code VARCHAR(8) DEFAULT NULL;

-- Room assignment on appointments
ALTER TABLE appointments
  ADD COLUMN room_id UUID REFERENCES rooms(id) DEFAULT NULL;

-- JSONB metadata on all core tables (see Part 16)
ALTER TABLE patients              ADD COLUMN metadata JSONB DEFAULT '{}';
ALTER TABLE appointments          ADD COLUMN metadata JSONB DEFAULT '{}';
ALTER TABLE pending_invoices      ADD COLUMN metadata JSONB DEFAULT '{}';
ALTER TABLE clinical_encounters   ADD COLUMN metadata JSONB DEFAULT '{}';
ALTER TABLE crm_leads             ADD COLUMN metadata JSONB DEFAULT '{}';
ALTER TABLE counselling_sessions  ADD COLUMN metadata JSONB DEFAULT '{}';
ALTER TABLE services              ADD COLUMN metadata JSONB DEFAULT '{}';
ALTER TABLE inventory_products    ADD COLUMN metadata JSONB DEFAULT '{}';
ALTER TABLE profiles              ADD COLUMN metadata JSONB DEFAULT '{}';
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

#### Walk-in Button — Force-Overlap (Missing)
Top of scheduler: `+ Walk-in` button. Walk-ins are **force-overlapped** — they bypass all conflict checks with no warning and no confirmation dialog.

**Force-Overlap logic:**
- Walk-in appointment is created immediately, regardless of whether the doctor/room slot is already occupied.
- No warning shown. No confirmation required. This matches real Indian clinic chaos where walk-ins cannot be turned away.
- Walk-in appointment is created with status = `arrived` and visually rendered as an **orange stacked card** on the scheduler.
- The `create_appointment_safe` RPC's conflict check is **bypassed** for walk-ins. Use a direct insert with service role.

**Walk-in Flow:**
1. Staff clicks `+ Walk-in` button
2. Mini form opens: Patient (search/create) + Doctor + Service (optional)
3. System auto-fills start_time = now, end_time = now + service.duration_minutes (default 15min)
4. Appointment created immediately — no slot validation
5. Card appears on scheduler with orange color + "Walk-in" badge

#### Double Booking (Regular Appointments)
Regular (non-walk-in) appointments show a warning on conflict but allow override.
Show: "Dr [Name] already has an appointment at this time. Proceed anyway?" with Confirm / Cancel.
Do NOT block — just warn. Walk-ins never show this warning (Force-Overlap).

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

**Counsellor Claim System (New Logic):**

When a doctor sends a patient to counselling, the session appears as **Unclaimed** in the counselling dashboard. Any available counsellor in the clinic can **Claim** it. Once claimed:
- Only the claiming counsellor can edit the session notes, pipeline stage, and proforma.
- Other counsellors see the session as locked (read-only with "Claimed by [Name]" label).
- Clinic admin can **Override Claim** to reassign to a different counsellor.
- If unclaimed for > 30 minutes, a notification fires to all counsellors: "Patient waiting for counsellor."

**DB change:**
```sql
ALTER TABLE counselling_sessions
  ADD COLUMN claimed_by UUID REFERENCES profiles(id) DEFAULT NULL,
  ADD COLUMN claimed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN claim_status TEXT
    CHECK (claim_status IN ('unclaimed', 'claimed', 'admin_override'))
    DEFAULT 'unclaimed';
```

**API routes:**
```
POST /api/counselling/claim       Counsellor claims a session
POST /api/counselling/unclaim     Admin overrides / releases claim
```

**UI — Counselling Dashboard:**
- Shows two columns: **Unclaimed** (red border, pulsing dot) and **My Sessions** (claimed by me)
- Unclaimed cards have a prominent `[ Claim ]` button
- Claimed-by-others cards are grayed out with a lock icon

**Counsellor Restrictions:**
- Can create proforma
- Cannot create invoice
- Cannot collect payment
- Cannot edit another counsellor's claimed session
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

#### GST & HSN/SAC (Mandatory)

HSN/SAC codes are **mandatory** on every invoice line item for GST compliance (GSTR-1 filing). This is not optional — it is a legal requirement for clinics above the GST threshold.

**DB changes:**
```sql
-- Add to services table (default HSN/SAC per service type)
ALTER TABLE services
  ADD COLUMN hsn_sac_code VARCHAR(8) DEFAULT NULL,
  ADD COLUMN gst_category TEXT
    CHECK (gst_category IN ('exempt','5%','12%','18%','28%'))
    DEFAULT '18%';

-- Add to invoice_line_items (required, not nullable for invoices)
ALTER TABLE invoice_line_items
  ADD COLUMN hsn_sac_code VARCHAR(8) DEFAULT NULL;
```

**Enforcement:**
- When creating an invoice line item, `hsn_sac_code` is **required**. If the service has a default HSN/SAC code, it is auto-populated. If not, the billing staff must enter it before saving.
- Proforma invoices: HSN/SAC required on conversion to invoice, not on draft creation.
- API route `POST /api/billing/invoice` returns 400 if any line item is missing `hsn_sac_code`.

**Default HSN/SAC codes for aesthetic services:**
| Service Category | HSN/SAC | GST Rate |
|---|---|---|
| Consultation / Doctor Services | 999311 | 0% (exempt) |
| Laser / Aesthetic Procedures | 999316 | 18% |
| Facials / Skincare Treatments | 999721 | 18% |
| Dermatology / Medical Services | 999312 | 5% |
| Retail Products | varies by product | 12–18% |

**GSTR-1 Export:**
- Report at `/admin/reports` → "GSTR-1 Export"
- Groups line items by HSN/SAC code with aggregate taxable value and GST amount
- Downloadable as CSV in GSTR-1 format

**GST rules:**
- GST % configurable per service (pulled from `services.gst_category`)
- Total GST shown as separate line on invoice (CGST + SGST split for intrastate, IGST for interstate)
- Reverse charge: supported via `is_reverse_charge` boolean on invoice (future)

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

### P0-7: Walk-in Force-Overlap
**Broken:** Walk-ins go through `create_appointment_safe` which performs conflict check and may fail or warn.

**Fix:** Walk-in route `POST /api/appointments/walkin` uses a direct insert (bypasses conflict RPC). Sets `is_walkin = true` on appointment. Scheduler renders it with orange color.
```sql
ALTER TABLE appointments ADD COLUMN is_walkin BOOLEAN DEFAULT false;
```

### P0-8: Counsellor Claim System
**Missing:** Multiple counsellors can simultaneously work on the same patient's counselling session, creating data conflicts.

**Fix:** Add `claimed_by`, `claimed_at`, `claim_status` columns to `counselling_sessions`. Build Claim/Unclaim UI and API routes (see Section 9.4).

---

## PART 11 — FEATURE BUILD QUEUE (By Priority)

### P1 — High Priority (Build After P0 Fixes)
1. **Top Bar Navigation** — rebuild `components/TopBar.tsx` + Apps Menu + update `app/layout.tsx`
2. **Navy/White theme migration** — update `globals.css` CSS variables, sweep all hardcoded hex colors
3. **Command Bar (Cmd+K)** — `components/CommandBar.tsx`
4. **HSN/SAC on services + line items** — DB migration + validation in billing UI
5. Appointment Room View — `rooms` table + scheduler tab
6. Walk-in Force-Overlap button in scheduler
7. Patient Packages tab (dedicated)
8. Patient Activity Timeline tab
9. Patient Documents tab
10. Doctor Queue View
11. Patient Tags (`patient_tags` table + UI)
12. Duplicate Patient Detection on create

### P2 — Medium Priority
13. Service Consumables auto-deduction (`service_consumables` table + `consume_session()` update)
14. GSTR-1 HSN/SAC report (CSV export in GSTR-1 format)
15. CRM campaign segment targeting UI (currently only template, no segment builder)
16. List View in scheduler (for reception call list)
17. Appointment drag-and-drop rescheduling
18. Bulk rescheduling (doctor unavailable → move all appointments)
19. Patient Blacklist feature
20. System Health Monitor tab in God Mode (see Part 16)
21. Granular Feature Flags UI in God Mode (see Part 16)

### P3 — Polish / Nice-to-Have
22. Purchase Orders workflow
23. Mobile bottom navigation bar
24. Smart room/doctor conflict warnings
25. Superadmin: Create Organization/Chain from UI
26. Appointment buffer time configuration per service
27. Doctor availability schedule builder
28. AI command suggestions in Command Bar
29. Patient lifetime value tracking

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
POST /api/appointments/walkin     Force-overlap walk-in (bypasses conflict check)
POST /api/proforma/convert        Convert proforma → invoice
PATCH /api/proforma/[id]/approve  Approve proforma (admin)
POST /api/counselling/refer       Doctor → counsellor handoff (creates unclaimed session)
POST /api/counselling/claim       Counsellor claims a session
POST /api/counselling/unclaim     Admin overrides claim
GET  /api/billing/gstr1           GSTR-1 export (HSN/SAC grouped, CSV)
GET  /api/health                  System health check (for God Mode monitor)
GET  /api/admin/feature-flags     List clinic_feature_flags
PUT  /api/admin/feature-flags     Upsert a clinic feature flag
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
PHASE A — Critical DB Migrations (run first, unblocks everything)
  A1. DB migration: add appointment statuses (consultation_done, treatment_done)
  A2. DB migration: add CRM stages (appointment_booked, visited)
  A3. DB migration: add proforma_status column to pending_invoices
  A4. DB migration: add counselling_sessions claim columns
  A5. DB migration: add is_walkin column to appointments
  A6. DB migration: add hsn_sac_code + gst_category to services
  A7. DB migration: add hsn_sac_code to invoice_line_items
  A8. DB migration: add metadata JSONB to 9 core tables
  A9. DB migration: create clinic_feature_flags table
  A10. DB migration: create rooms table

PHASE B — Logic Fixes (P0 Broken Flows)
  B1. Fix Doctor → Counsellor handoff (notification + session creation)
  B2. Build Proforma lifecycle (approve / convert / expire)
  B3. Fix Counsellor payment restriction at API level
  B4. Fix CRM auto-stage sync on appointment creation
  B5. Build Counsellor Claim System (API + UI)
  B6. Build Walk-in Force-Overlap (API route + scheduler button)

PHASE C — Visual Overhaul (P1 — Design)
  C1. Update globals.css with Navy/White CSS variables
  C2. Rebuild TopBar.tsx — Navy bg, top nav links, Apps Menu grid, Clinic Switcher
  C3. Update app/layout.tsx — TopBar in root, main pt-16, remove sidebar
  C4. Sweep all pages — replace hardcoded hex colors with CSS variables
  C5. Build CommandBar.tsx (Cmd+K)
  C6. Mobile bottom nav bar

PHASE D — High Impact Features (P1 — Features)
  D1. HSN/SAC mandatory validation in billing UI + GSTR-1 export
  D2. Room Management — CRUD + Room View tab in scheduler
  D3. Patient: Packages tab
  D4. Patient: Activity Timeline tab
  D5. Patient: Documents tab
  D6. Patient Tags (patient_tags table + header chips + filter)
  D7. Duplicate Patient Detection on create
  D8. Doctor Queue View

PHASE E — Medium Priority (P2)
  E1. Service Consumables auto-deduction
  E2. System Health Monitor tab in God Mode
  E3. Granular Feature Flags UI in God Mode
  E4. CRM campaign segment builder
  E5. List View in scheduler
  E6. Appointment drag-and-drop
  E7. Patient Blacklist

PHASE F — Polish (P3)
  F1. Purchase Orders
  F2. Smart conflict warnings
  F3. Doctor availability schedule builder
  F4. Superadmin org/chain creator
  F5. AI command suggestions in Command Bar
```

---

## DECISIONS MADE IN THIS PLAN

| Decision | Choice | Reason |
|---|---|---|
| Color theme | **Navy/White** (`#0B2A4A` / `#F7F9FC`) | v2.0 override — SaaS-grade clinical look, CSS variables make migration clean |
| Navigation | **Top Bar** (rebuild required) | v2.0 override — modern SaaS pattern, mobile bottom bar for small screens |
| Proforma storage | Extend `pending_invoices` with `proforma_status` | Avoids duplicate table; same query patterns |
| CRM stages | Extend existing enum with 2 new values | Backward compatible migration |
| Room View | New `rooms` table + `room_id` FK on `appointments` | Clean entity-based approach |
| Walk-in behavior | **Force-Overlap** — bypass conflict check entirely | Matches real Indian clinic chaos; walk-ins cannot be turned away |
| Double booking (regular) | Allow with warning | Matches real Indian clinic behavior |
| Counsellor restriction | API-level check (not just UI) | Security — UI hiding is not a security control |
| Counsellor concurrency | **Claim System** — one counsellor per session | Prevents data conflicts when multiple counsellors are active |
| HSN/SAC codes | **Mandatory** on all invoice line items | Legal GST compliance requirement |
| JSONB metadata | Added to 9 core tables | Extensibility without schema migrations |
| Granular flags | `clinic_feature_flags` table | Per-clinic behavioral overrides beyond module toggles |

---

## PART 16 — SCALING & STABILITY

### 16.1 — Granular Feature Flags

Beyond module-level on/off (`clinic_modules`), clinics need **behavioral flags** — fine-grained settings that control how a feature works, not just whether it's active.

**Table:** `clinic_feature_flags`
```sql
CREATE TABLE clinic_feature_flags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  flag_key        TEXT NOT NULL,
  is_enabled      BOOLEAN NOT NULL DEFAULT true,
  config          JSONB NOT NULL DEFAULT '{}',
  set_by          UUID REFERENCES profiles(id),
  set_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clinic_id, flag_key)
);
```

**Standard flags (seeded for every clinic on creation):**
| Flag Key | Default | Description |
|---|---|---|
| `allow_walkin_overlap` | `true` | Walk-ins force-overlap without warning |
| `require_hsn_sac` | `true` | Block invoice save if HSN/SAC missing |
| `counsellor_claim_required` | `true` | Counselling sessions must be claimed before editing |
| `discount_otp_required` | `true` | OTP required for any manual discount |
| `max_discount_pct` | `config: {max: 30}` | Maximum discount a staff can request |
| `allow_double_booking` | `true` | Regular appointments can overlap with warning |
| `proforma_approval_required` | `false` | Proforma must be approved by admin before counsellor can share |
| `session_expiry_days` | `config: {days: 365}` | Default expiry for purchased service credits |
| `walkin_auto_checkin` | `true` | Walk-ins start as `arrived` automatically |
| `notify_counsellor_on_refer` | `true` | Fire notification to counsellors on doctor handoff |

**Usage in code:**
```ts
// Server-side check
const { data: flag } = await supabaseAdmin
  .from("clinic_feature_flags")
  .select("is_enabled, config")
  .eq("clinic_id", clinicId)
  .eq("flag_key", "require_hsn_sac")
  .maybeSingle();

const requireHsn = flag?.is_enabled ?? true;
```

**God Mode UI:** Superadmin can view and override any flag for any clinic in the "Dev Panel" tab. Each clinic can also configure their own flags in Settings → Clinic Preferences.

---

### 16.2 — System Health Monitor (God Mode Tab 5)

A new **"Health"** tab in God Mode (`/admin/god-mode`) shows real-time and recent system status across all clinics.

**Sections:**

**Database Health**
- Connection pool usage (Supabase dashboard API)
- Slowest queries (last 1h from `pg_stat_statements`)
- Table sizes and dead row counts
- Pending migrations vs applied migrations

**Application Health**
- Failed webhook deliveries in last 24h (from `webhook_deliveries` where `status='failed'`)
- DLQ items pending resolution (from `workflow_dlq` where `status='pending'`)
- Recent API errors (from `audit_logs` where `action LIKE 'error.%'`)

**Feature Usage**
- Top 10 most-used modules (from `feature_usage_log`)
- Clinics with zero activity in last 30 days
- Trial clinics expiring in next 7 days

**Notifications & Realtime**
- Unread notification backlog per clinic
- Realtime subscription status (can check if Supabase Realtime channel is connected)

**Implementation:**
- `app/admin/god-mode/page.tsx` — add Tab 5 "Health"
- `GET /api/health` route returns JSON summary of all health signals
- Auto-refreshes every 60 seconds on the page
- Red/amber/green status indicators per section

---

### 16.3 — JSONB Metadata on Core Tables

Every core entity table has a `metadata JSONB DEFAULT '{}'` column. This enables:
- Plugins to store extra data without schema changes
- Workflow rules to attach custom attributes
- Future AI features to store computed signals
- Integration systems to attach external IDs

**Tables with metadata column (migrations in Part 8):**
```
patients, appointments, pending_invoices, clinical_encounters,
crm_leads, counselling_sessions, services, inventory_products, profiles
```

**Convention:**
- Keys are namespaced: `{ "razorpay": { "order_id": "..." }, "meta": { "lead_id": "..." } }`
- Never store PHI (personal health information) in metadata — use proper typed columns for clinical data
- Metadata is indexed with GIN: `CREATE INDEX ON tablename USING GIN (metadata)`

**Usage pattern:**
```ts
// Write
await supabase.from("appointments")
  .update({ metadata: { razorpay: { payment_id: "pay_abc123" } } })
  .eq("id", appointmentId);

// Read specific key
const { data } = await supabase.from("appointments")
  .select("metadata->razorpay")
  .eq("id", appointmentId);
```

---

### 16.4 — Performance Targets (Non-Negotiable)

| Operation | Target p95 | Current (stress test) |
|---|---|---|
| Dashboard load | < 500ms | 420ms |
| Patient EMR load | < 500ms | 364ms |
| Appointment booking | < 300ms | 266ms |
| Invoice creation | < 600ms | 559ms |
| Command Bar open | < 100ms | not built |
| Scheduler initial load | < 800ms | ~600ms est |
| Patient search (Cmd+K) | < 200ms | not built |

**Performance rules:**
- All Supabase mutations use `withSupabaseRetry()` (3 attempts, exponential backoff)
- All fetch calls use `withRetry()` for transient failures
- RLS policies use `(SELECT auth.uid())` not bare `auth.uid()`
- All FK columns have indexes (128+ already applied)
- Unbounded queries must have `.limit()` — minimum `.limit(300)`
- Patient picker queries max `.limit(300)`
- Scheduler loads only current visible date range — not all-time appointments

---

### 16.5 — Audit & Compliance

All state-changing actions must be logged via `logAction()`:

```ts
await logAction({
  actor_id: profile.id,
  actor_name: profile.full_name,
  clinic_id: clinicId,
  action: "appointment.create",   // format: entity.verb
  target_id: appointment.id,
  target_name: patient.full_name,
  ...auditMeta(),                 // spreads impersonation context
});
```

**Required audit actions (must be logged, no exceptions):**
- `patient.create`, `patient.update`, `patient.deactivate`
- `appointment.create`, `appointment.cancel`, `appointment.no_show`
- `invoice.create`, `invoice.void`, `invoice.refund`
- `payment.record`, `wallet.debit`, `wallet.credit`
- `discount.request`, `discount.approve`, `discount.reject`
- `counselling.claim`, `counselling.unclaim`, `counselling.convert`
- `proforma.create`, `proforma.approve`, `proforma.convert`, `proforma.expire`
- `staff.invite`, `staff.deactivate`, `role.change`
- `module.enable`, `module.disable`, `kill_switch.toggle`

**Demo clinic suppression:** `logAction()` silently skips insert if `clinicId` is a demo clinic.

---

*Last updated: 2026-03-07*
*Version: 2.0 — Master Overrides Applied*
*Status: DRAFT — Awaiting final review and approval before Phase A implementation begins*
