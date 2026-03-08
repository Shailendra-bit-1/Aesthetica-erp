# AESTHETICA CLINIC ERP — FINAL PLAN
## Single Source of Truth | Version 2.3 | 2026-03-08

---

> This document supersedes MASTER_PLAN.md, GAP_ANALYSIS.md, and PRE_IMPLEMENTATION_AUDIT.md.
> **Everything Claude builds must follow this document exactly.**
> No feature, table, route, API, or UI decision should contradict what is written here.
>
> **v2.3 additions (SSOT audit — 2026-03-08):**
> - 13 documentation/cross-reference fixes applied (F-1 through F-10 + C-1 through C-3)
> - Header phase count corrected (A16–A24 → A1–A27)
> - 13 missing inventory_transfers, before_after_photos, patient_packages, workflow_scheduled_actions
>   table definitions added to Part 8
> - staff_commissions definition updated with commission_type column
> - inventory_movements naming standardised (was inventory_transactions in consume_session SQL)
> - Appointment status constraint SQL added to Part 8 Column Alterations (canonical migration location)
> - Orphaned navigation line removed from Section 9.15
> - Part 7 Module Status updated with all 13 NG MISSING items
> - POST /api/billing/invoice added to Part 12 API Routes
> - Demo clinic trigger suppression mechanism specified in Part 16.5
> - is_reverse_charge marked [FUTURE] in Section 9.5
>
> **v2.2 additions (Gap List 2 + clinical audit — 2026-03-08):**
> - 13 new gaps added (NG-1 → NG-13): patient merge, consent snapshotting, timing timestamps,
>   protocol automation, inventory transit lock, UTM tracking, patient events table,
>   patient_metrics view, soft delete, search_index, background job queue,
>   service credit expiry worker, clinical audit log
> - 5 new tables: patient_merge_log, patient_events, search_index, background_jobs, clinical_audit_log
> - 9 new column alterations across 5 tables
> - Execution order: Phase A expanded (A1–A27), Phase B + E + F expanded
>
> **v2.1 additions (audit-validated 2026-03-08):**
> - Security: 3 critical security fixes folded in (OTP leak, RLS gaps, PHI masking)
> - DB: 12 missing column alterations added (clinic_id, commission tracking, proforma FK)
> - Flows: 5 new P0 broken flows documented (void reversal, price lock, immutability, sale commission)
> - Execution: Phase 0 (security hotfixes) added before Phase A
> - All 24 Draft Amendments (DA-26→DA-49) resolved into plan sections
>
> **v2.0 Master Overrides (unchanged):**
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
| Patient Merge (NG-1) | MISSING | Merge modal + POST /api/patients/merge |
| Consent Snapshotting (NG-2) | MISSING | form_snapshot_json on portal/intake submit |
| Appointment Timing Timestamps (NG-3) | MISSING | checked_in_at + consultation/treatment time columns |
| Protocol Follow-up Automation (NG-4) | MISSING | Auto-suggest follow-up after treatment completion |
| Inventory Transit Lock (NG-5) | MISSING | 2-step dispatch/receive on inter-clinic transfers |
| Marketing Attribution / UTM (NG-6) | MISSING | UTM capture on intake + lead webhooks + reports |
| Patient Activity Timeline (NG-7) | MISSING | patient_events table + Timeline tab in patient profile |
| Patient Metrics View (NG-8) | MISSING | patient_metrics DB view — LTV, avg ticket, visit count |
| Soft Delete (NG-9) | MISSING | deleted_at on patients/services/profiles |
| Command Bar Search Index (NG-10) | MISSING | search_index table + GIN index + population triggers |
| Background Job Queue (NG-11) | MISSING | background_jobs table + Edge Function processor |
| Service Credit Expiry Worker (NG-12) | MISSING | pg_cron daily + patient notification |
| Clinical Audit Log (NG-13) | MISSING | field-level change tracking on 5 clinical tables |

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
patient_packages      id, patient_id, package_name, total_sessions,
                      used_sessions, price_per_session, created_at
                      (clinic_id added via migration A14)
before_after_photos   id, patient_id, clinic_id, photo_url, photo_type
                      (before|after), service_id, pair_id UUID nullable,
                      taken_at, uploaded_by, notes
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
                      commission_pct, commission_amount,
                      commission_type (sale|delivery),
                      status, paid_at
                      (commission_type added via migration A13)
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
inventory_transfers   id, from_clinic_id UUID→clinics, to_clinic_id UUID→clinics,
                      product_id UUID→inventory_products,
                      batch_id UUID→inventory_batches,
                      quantity INT NOT NULL,
                      transfer_status TEXT DEFAULT 'requested'
                        CHECK (transfer_status IN
                          ('requested','in_transit','received','cancelled')),
                      requested_by UUID→profiles,
                      received_by UUID→profiles,
                      requested_at TIMESTAMPTZ DEFAULT NOW(),
                      received_at TIMESTAMPTZ, notes TEXT
                      (transfer_status/received_by/received_at added via migration A20
                       for 2-step transit lock — NG-5)
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
workflow_scheduled_actions  id, clinic_id, rule_id UUID→rule_definitions,
                      trigger_event TEXT NOT NULL,
                      context JSONB NOT NULL DEFAULT '{}',
                      scheduled_for TIMESTAMPTZ NOT NULL,
                      status TEXT DEFAULT 'pending'
                        CHECK (status IN ('pending','processed','cancelled')),
                      processed_at TIMESTAMPTZ
                      (supports delay_minutes action type — Phase 0 item 0-3
                       requires RLS to be enabled on this table)
workflow_clinic_overrides  rule_id UUID, clinic_id UUID (composite PK),
                           is_enabled BOOLEAN
                           (superadmin-only — per-branch rule overrides)
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

patient_merge_log     id, clinic_id, source_patient_id UUID→patients,
                      target_patient_id UUID→patients,
                      merged_by UUID→profiles, merged_by_name TEXT,
                      merged_at TIMESTAMPTZ DEFAULT NOW(),
                      reason TEXT NOT NULL
                      (NG-1 — tracks every merge; source patient set to is_active=false
                       with merged_into_id pointer — never hard deleted)

patient_events        id, clinic_id, patient_id UUID→patients,
                      event_type TEXT NOT NULL,
                      entity_type TEXT,     -- appointment, invoice, encounter, etc.
                      entity_id UUID,
                      summary TEXT NOT NULL,
                      actor_name TEXT,
                      created_at TIMESTAMPTZ DEFAULT NOW()
                      event_type values: appointment_booked, consultation_done,
                      treatment_done, invoice_paid, photo_uploaded,
                      package_purchased, membership_activated,
                      credit_expired, referral_made, note_added
                      (NG-7 — powers Activity Timeline tab; separate from audit_logs
                       which tracks admin/security events)

search_index          id, clinic_id, entity_type TEXT, entity_id UUID,
                      primary_text TEXT NOT NULL,   -- patient name, invoice number, etc.
                      secondary_text TEXT,          -- phone (masked), date, amount
                      url TEXT NOT NULL,            -- navigation target on click
                      updated_at TIMESTAMPTZ DEFAULT NOW()
                      UNIQUE(clinic_id, entity_type, entity_id)
                      (NG-10 — powers Cmd+K instant search; single ILIKE query
                       replaces 4+ separate queries; GIN index on primary_text)

background_jobs       id, clinic_id, job_type TEXT NOT NULL,
                      payload JSONB NOT NULL DEFAULT '{}',
                      status TEXT DEFAULT 'pending'
                        CHECK (status IN ('pending','processing','completed','failed')),
                      scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                      started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
                      error TEXT, attempt_count INT DEFAULT 0,
                      max_attempts INT DEFAULT 3
                      job_type values: whatsapp_reminder, campaign_send,
                      follow_up_suggestion, credit_expiry_notify,
                      post_visit_survey, protocol_followup
                      (NG-11 — generic background job queue; failures route to
                       workflow_dlq after max_attempts exceeded)

clinical_audit_log    id, clinic_id, patient_id UUID→patients,
                      record_type TEXT NOT NULL
                        CHECK (record_type IN (
                          'patient_treatment','patient_medical_history',
                          'prescription','counselling_session','patient_notes'
                        )),
                      record_id UUID NOT NULL,
                      changed_by UUID NOT NULL→profiles,
                      changed_by_name TEXT NOT NULL,
                      field_name TEXT NOT NULL,
                      old_value TEXT, new_value TEXT,
                      change_reason TEXT,    -- required for prescription changes
                      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                      (NG-13 — field-level change tracking for editable clinical
                       records; populated by DB trigger on UPDATE; no DELETE policy —
                       immutable like audit_logs; separate from clinical_encounters
                       which are immutable and never edited)
```

### Column Alterations Required (MISSING)

> All of these run in Phase A migrations before any feature code is written.

```sql
-- ─── Proforma lifecycle ───────────────────────────────────────────────────────
ALTER TABLE pending_invoices
  ADD COLUMN proforma_status TEXT
    CHECK (proforma_status IN ('draft','approved','converted','expired'))
    DEFAULT NULL,
  ADD COLUMN source_proforma_id UUID REFERENCES pending_invoices(id),
  ADD COLUMN proforma_approved_by UUID REFERENCES profiles(id),
  ADD COLUMN proforma_approved_at TIMESTAMPTZ,
  ADD COLUMN proforma_expires_at TIMESTAMPTZ;

-- ─── Counsellor Claim System ──────────────────────────────────────────────────
ALTER TABLE counselling_sessions
  ADD COLUMN claimed_by UUID REFERENCES profiles(id) DEFAULT NULL,
  ADD COLUMN claimed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN claim_status TEXT
    CHECK (claim_status IN ('unclaimed','claimed','admin_override'))
    DEFAULT 'unclaimed';

-- ─── HSN/SAC on services ─────────────────────────────────────────────────────
ALTER TABLE services
  ADD COLUMN hsn_sac_code VARCHAR(8) DEFAULT NULL,
  ADD COLUMN gst_category TEXT
    CHECK (gst_category IN ('exempt','5%','12%','18%','28%'))
    DEFAULT '18%';

-- ─── HSN/SAC on invoice line items ───────────────────────────────────────────
ALTER TABLE invoice_line_items
  ADD COLUMN hsn_sac_code VARCHAR(8) DEFAULT NULL;

-- ─── Appointment status constraint — add consultation_done, treatment_done (A1) ─
-- This migration DROPS and re-creates the constraint. Run before any feature code.
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check
  CHECK (status IN (
    'planned', 'confirmed', 'arrived',
    'consultation_done', 'treatment_done',
    'in_session', 'completed', 'cancelled', 'no_show'
  ));

-- ─── Room assignment on appointments ─────────────────────────────────────────
ALTER TABLE appointments
  ADD COLUMN room_id UUID REFERENCES rooms(id) DEFAULT NULL;

-- ─── Walk-in flag ─────────────────────────────────────────────────────────────
ALTER TABLE appointments
  ADD COLUMN is_walkin BOOLEAN NOT NULL DEFAULT false;

-- ─── Sale commission tracking on package credits ──────────────────────────────
-- Tracks who sold the package (separate from who delivers sessions)
ALTER TABLE patient_service_credits
  ADD COLUMN sold_by_provider_id UUID REFERENCES profiles(id),
  ADD COLUMN sale_commission_pct  NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN sale_commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

-- ─── clinic_id on tables that are missing it (multi-tenant isolation) ─────────
ALTER TABLE patient_notes
  ADD COLUMN clinic_id UUID REFERENCES clinics(id);
UPDATE patient_notes pn SET clinic_id = p.clinic_id
  FROM patients p WHERE pn.patient_id = p.id;
ALTER TABLE patient_notes ALTER COLUMN clinic_id SET NOT NULL;
CREATE INDEX ON patient_notes(clinic_id);

ALTER TABLE patient_packages
  ADD COLUMN clinic_id UUID REFERENCES clinics(id);
UPDATE patient_packages pp SET clinic_id = p.clinic_id
  FROM patients p WHERE pp.patient_id = p.id;

ALTER TABLE prescriptions
  ADD COLUMN clinic_id UUID REFERENCES clinics(id);
UPDATE prescriptions pr SET clinic_id = ce.clinic_id
  FROM clinical_encounters ce WHERE pr.encounter_id = ce.id;

-- package_items, package_members: inherit from patient_service_credits
ALTER TABLE package_items
  ADD COLUMN clinic_id UUID REFERENCES clinics(id);
ALTER TABLE package_members
  ADD COLUMN clinic_id UUID REFERENCES clinics(id);

-- service_transfers
ALTER TABLE service_transfers
  ADD COLUMN clinic_id UUID REFERENCES clinics(id);

-- Create indexes for all new clinic_id columns
CREATE INDEX IF NOT EXISTS idx_patient_notes_clinic ON patient_notes(clinic_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_clinic ON prescriptions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_package_items_clinic ON package_items(clinic_id);
CREATE INDEX IF NOT EXISTS idx_package_members_clinic ON package_members(clinic_id);
CREATE INDEX IF NOT EXISTS idx_service_transfers_clinic ON service_transfers(clinic_id);

-- ─── Provider ID on clinical encounters (FK, was only text) ───────────────────
-- provider_id already exists as a column; ensure it is populated going forward.
-- The API route must pass profile.id as provider_id on every SOAP save.

-- ─── Appointment timing timestamps (NG-3) ────────────────────────────────────
-- Set by scheduler action menu when each status transition occurs.
-- Enables patient wait time, consultation duration, and treatment duration analytics.
ALTER TABLE appointments
  ADD COLUMN checked_in_at        TIMESTAMPTZ,
  ADD COLUMN consultation_start_at TIMESTAMPTZ,
  ADD COLUMN consultation_end_at   TIMESTAMPTZ,
  ADD COLUMN treatment_start_at    TIMESTAMPTZ,
  ADD COLUMN treatment_complete_at TIMESTAMPTZ;

-- ─── Protocol follow-up automation (NG-4) ────────────────────────────────────
ALTER TABLE protocols
  ADD COLUMN followup_days     INT DEFAULT NULL,
  ADD COLUMN aftercare_message TEXT DEFAULT NULL,
  ADD COLUMN auto_remind       BOOLEAN NOT NULL DEFAULT true;

-- ─── Inventory transit lock — 2-step transfer (NG-5) ─────────────────────────
-- Stock leaves source on in_transit; arrives at destination on received.
-- Prevents stock vanishing during inter-clinic transfers.
ALTER TABLE inventory_transfers
  ADD COLUMN transfer_status TEXT DEFAULT 'requested'
    CHECK (transfer_status IN ('requested','in_transit','received','cancelled')),
  ADD COLUMN received_by UUID REFERENCES profiles(id),
  ADD COLUMN received_at TIMESTAMPTZ;

-- ─── Marketing attribution / UTM (NG-6) ──────────────────────────────────────
ALTER TABLE crm_leads
  ADD COLUMN utm_source   TEXT,
  ADD COLUMN utm_medium   TEXT,
  ADD COLUMN utm_campaign TEXT,
  ADD COLUMN utm_content  TEXT;

ALTER TABLE patients
  ADD COLUMN acquisition_source   TEXT,
  ADD COLUMN acquisition_campaign TEXT;

-- ─── patient_treatments missing clinical columns (Gap List 2 §2.2) ───────────
ALTER TABLE patient_treatments
  ADD COLUMN doctor_id             UUID REFERENCES profiles(id),
  ADD COLUMN appointment_id        UUID REFERENCES appointments(id),
  ADD COLUMN outcome               TEXT,
  ADD COLUMN side_effects          TEXT,
  ADD COLUMN next_recommended_date DATE;

-- ─── Consent form snapshotting (NG-2) ────────────────────────────────────────
-- Stores exact form text at time of signing — immutable legal record.
ALTER TABLE form_responses
  ADD COLUMN form_snapshot_json JSONB,
  ADD COLUMN consent_version    TEXT;

-- ─── Soft delete on core tables (NG-9) ───────────────────────────────────────
-- Hard deletes replaced with soft deletes on these tables only.
-- All SELECT queries must add .is('deleted_at', null) filter.
-- Superadmin-only hard purge after 90 days.
-- NOT applied to: clinical_encounters (immutable), audit_logs, financial tables.
ALTER TABLE patients   ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE services   ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE profiles   ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- ─── merged_into_id on patients (NG-1) ───────────────────────────────────────
ALTER TABLE patients
  ADD COLUMN merged_into_id UUID REFERENCES patients(id) DEFAULT NULL;

-- ─── JSONB metadata on all core tables (see Part 16) ─────────────────────────
ALTER TABLE patients              ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE appointments          ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE pending_invoices      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE clinical_encounters   ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE crm_leads             ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE counselling_sessions  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE services              ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE inventory_products    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE profiles              ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
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

#### Patient Merge Operation (NG-1)
When two patient records represent the same person, staff can merge them.

**Merge rules:**
- Any admin or above can initiate. Requires a `reason` text entry.
- `source_patient_id` = the duplicate (to be retired)
- `target_patient_id` = the canonical record (to keep)

**What gets reassigned from source → target:**
`appointments`, `clinical_encounters`, `invoice_payments`, `pending_invoices`,
`wallet_transactions`, `patient_service_credits`, `before_after_photos`,
`patient_communications`, `counselling_sessions`, `crm_leads`, `patient_notes`,
`patient_treatments`, `prescriptions`, `patient_memberships`, `form_responses`

**After merge:**
- Source patient: `is_active = false`, `merged_into_id = target_patient_id`, `deleted_at = NOW()`
- Insert row into `patient_merge_log`
- Log `logAction({ action: "patient.merge", ... })`
- Source patient is never hard deleted — always recoverable by superadmin

**API route:** `POST /api/patients/merge { source_id, target_id, reason }`
Server-side only (service role) — runs all FK reassignments in a single DB transaction.

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
- Reverse charge: `is_reverse_charge` boolean on invoice — **[FUTURE — not in Phase A–F, no migration planned]**

#### Discount Approval Flow (LIVE)
1. Staff requests discount → OTP sent to clinic admin via SMS/email
2. Admin approves OTP → discount applied
3. Logged in `discount_approvals`
4. **OTP must NEVER appear in the API response body** (see P0-9)

#### Void Invoice — Wallet Reversal (Fix Required — see P0-13)
Voiding an invoice must reverse all wallet payments made against it.
Call `credit_wallet()` RPC for each `invoice_payments` row with `payment_mode = 'wallet'` before updating status to void.

#### Gift Card Validation (Required)
Before accepting a gift card payment, the `record_payment` RPC (or the API route) must validate:
1. Gift card exists and belongs to this clinic
2. Gift card is not expired (`expires_at > NOW()`)
3. Gift card remaining balance >= payment amount
Raise an error if any check fails — do not silently accept.

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

#### Three-Way Sync on Session Completion (Fix Required)
When a service session is consumed (`consume_session()` RPC is called), three things must happen atomically:

| Step | Action | Current Status |
|---|---|---|
| (a) Package credit deduction | `patient_service_credits.used_sessions++` | ✅ Live |
| (b) Commission record creation | Insert into `staff_commissions` | ✅ Live |
| (c) Inventory stock deduction | Deduct from `inventory_batches` via `service_consumables` | ❌ **Missing** |

**Fix — update `consume_session()` RPC to include:**
```sql
-- After existing credit + commission logic, add:
INSERT INTO inventory_movements (
  product_id, clinic_id, type, quantity, reference_id, notes, created_by
)
SELECT
  sc.inventory_product_id,
  p_clinic_id,
  'consumption',
  -sc.quantity_per_session,
  p_credit_id,
  'credit_consumption',
  'Auto-deducted on session consume'
FROM service_consumables sc
WHERE sc.service_id = (
  SELECT service_id FROM patient_service_credits WHERE id = p_credit_id
);

-- Update batch quantities (FIFO — earliest non-zero batch first)
UPDATE inventory_batches ib
SET quantity_remaining = quantity_remaining - sc.quantity_per_session
FROM service_consumables sc
  JOIN (
    SELECT id FROM inventory_batches
    WHERE product_id = sc.inventory_product_id
      AND quantity_remaining >= sc.quantity_per_session
    ORDER BY expiry_date NULLS LAST, received_at ASC
    LIMIT 1
  ) oldest ON ib.id = oldest.id
WHERE sc.service_id = (
  SELECT service_id FROM patient_service_credits WHERE id = p_credit_id
);
```

#### Service Consumables Table (Missing)
```sql
CREATE TABLE service_consumables (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id          UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  inventory_product_id UUID NOT NULL REFERENCES inventory_products(id),
  quantity_per_session NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit                TEXT DEFAULT 'unit',
  UNIQUE(service_id, inventory_product_id)
);
```

**UI:** In `/settings/services`, each service has a "Consumables" tab where clinic admin maps inventory products to the service with quantities.

#### Inter-Clinic Transfer — Transit Lock (NG-5)
Stock transfers between clinics follow a **2-step process** to prevent stock from vanishing in transit.

**Transfer lifecycle:**
```
requested → in_transit → received
                       ↘ cancelled
```

| Step | Who | Stock effect |
|---|---|---|
| `requested` | Sending clinic creates transfer | No stock change |
| `in_transit` | Sending clinic confirms dispatch | Stock DEDUCTED from source |
| `received` | Receiving clinic confirms receipt | Stock ADDED to destination |
| `cancelled` | Either clinic (before received) | Stock RESTORED to source if in_transit |

**API routes:**
```
POST  /api/inventory/transfers           Create transfer request
PATCH /api/inventory/transfers/[id]/dispatch   → in_transit
PATCH /api/inventory/transfers/[id]/receive    → received (sets received_by, received_at)
PATCH /api/inventory/transfers/[id]/cancel     → cancelled (reverses stock if in_transit)
```

#### Purchase Orders (Missing — P3)
Full PO workflow: create PO → approve → receive → auto-update stock.

---

### 9.7b — COMMISSION TRACKING (Sale vs Delivery)

Indian aesthetic clinics have two distinct commission types that must both be tracked:

| Type | When | Who | Table |
|---|---|---|---|
| **Sale commission** | At package purchase | Counsellor / doctor who sold | `staff_commissions` (type='sale') |
| **Delivery commission** | At each session | Doctor / therapist who performed | `staff_commissions` (type='delivery') |

**Current gap:** Only delivery commission is tracked. The counsellor who sold a ₹50,000 package gets ₹0 unless they also deliver sessions.

**Required columns on `patient_service_credits` (see Part 8):**
```sql
sold_by_provider_id  UUID REFERENCES profiles(id)
sale_commission_pct  NUMERIC(5,2) DEFAULT 0
sale_commission_amount NUMERIC(12,2) DEFAULT 0
```

**At package purchase time** (when creating `patient_service_credits`):
```ts
// Calculate and store sale commission
const saleCommAmt = (credit.purchase_price * credit.sale_commission_pct) / 100;

// Insert staff_commissions row for the seller
await supabase.from("staff_commissions").insert({
  provider_id: credit.sold_by_provider_id,
  clinic_id,
  patient_id: credit.patient_id,
  service_name: credit.service_name,
  sale_amount: credit.purchase_price,
  commission_pct: credit.sale_commission_pct,
  commission_amount: saleCommAmt,
  commission_type: "sale",   // add this column to staff_commissions
  status: "pending",
  credit_id: credit.id,
});
```

**`staff_commissions` requires a new `commission_type` column:**
```sql
ALTER TABLE staff_commissions
  ADD COLUMN commission_type TEXT
    CHECK (commission_type IN ('sale', 'delivery'))
    DEFAULT 'delivery';
```

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
- Results fetched from `search_index` table with debounce (200ms) — single query, not multiple
- Max 5 results per category

**Search backend — `search_index` table (NG-10):**
A single denormalized table for instant Cmd+K results. Replaces 4+ parallel Supabase queries.

```ts
// Single query replaces: patients + appointments + invoices + appointments searches
const { data } = await supabase
  .from("search_index")
  .select("entity_type, entity_id, primary_text, secondary_text, url")
  .eq("clinic_id", clinicId)
  .ilike("primary_text", `%${query}%`)
  .limit(20);
```

**Populated by DB triggers** on INSERT/UPDATE to:
- `patients` → `primary_text = full_name`, `secondary_text = masked phone`
- `pending_invoices` → `primary_text = invoice_number`, `secondary_text = patient_name + amount`
- `appointments` → `primary_text = patient_name + service_name`, `secondary_text = formatted date`

GIN index on `search_index(primary_text)` for sub-50ms full-text search.

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

---

### 9.13 — CLINICAL AUDIT LOG (NG-13)

Field-level change tracking for editable clinical records. Separate from:
- `audit_logs` (tracks admin/security events — who did what)
- `clinical_encounters` (immutable SOAP — cannot be edited at all)

**Covers these editable records:**
| Table | What gets tracked |
|---|---|
| `patient_treatments` | status, treatment_notes, outcome, side_effects, next_recommended_date |
| `patient_medical_history` | any field change |
| `prescriptions` | dosage, frequency, duration, medication_name |
| `counselling_sessions` | notes, conversion_status, treatments_discussed |
| `patient_notes` | content |

**How it works:**
- DB trigger fires on `UPDATE` to each covered table
- Trigger iterates `OLD` vs `NEW` row column by column
- Inserts one `clinical_audit_log` row per changed field
- `change_reason` is mandatory for `prescriptions` changes (enforced at API level — 400 if missing)

**RLS:** Clinic-scoped SELECT. **No DELETE policy** — this log is also immutable.

**UI:**
- History icon on each row in Treatments, Prescriptions, Counselling tabs
- Click opens a right-side drawer: "Edit History" — chronological list of all field changes with who/when/old/new
- Medical History form: footer shows "Last updated by [Name] on [Date]" per section

**Audit actions logged separately via `logAction()`:**
Add these to required audit actions in Part 16.5:
- `treatment.update`, `prescription.update`, `medical_history.update`
- `counselling.update`

---

### 9.14 — PATIENT EVENTS & ACTIVITY TIMELINE (NG-7)

The **Activity Timeline tab** (Phase D, item D4) reads from the `patient_events` table — not from `audit_logs`.

**`audit_logs`** = admin/security events (who toggled a module, who voided an invoice)
**`patient_events`** = patient journey events (appointment booked, invoice paid, photo uploaded)

**Insertion points** (each API route or DB trigger fires an insert):
| Event | Fired by |
|---|---|
| `appointment_booked` | `POST /api/appointments` or scheduler create |
| `consultation_done` | Scheduler status change → `consultation_done` |
| `treatment_done` | Scheduler status change → `treatment_done` |
| `invoice_paid` | `record_payment` RPC on final payment |
| `photo_uploaded` | `POST /api/photos` |
| `package_purchased` | `patient_service_credits` insert |
| `membership_activated` | `patient_memberships` insert |
| `credit_expired` | `expire_service_credits()` pg_cron function |
| `referral_made` | `referral_events` insert |
| `note_added` | `patient_notes` insert |

**Timeline Tab UI:**
- Chronological list (newest first), grouped by date
- Each event: icon + summary + actor name + timestamp
- Filter by event type (clinical / financial / communications)

---

### 9.15 — MARKETING ATTRIBUTION & UTM TRACKING (NG-6)

Aesthetic clinics spend heavily on Meta Ads, Google Ads, and WhatsApp campaigns. Without UTM tracking, there is no way to answer: "Which campaign generated ₹2,00,000 revenue this month?"

**Where UTM is captured:**
1. **Intake URL**: `?utm_source=instagram&utm_campaign=diwali_sale` — captured on form submit, stored in `form_responses.metadata`
2. **External lead webhook** (`/api/webhooks/inbound/meta`, `/api/webhooks/inbound/google`) — UTM fields extracted from payload and stored in `crm_leads`
3. **Lead to Patient conversion** — `acquisition_source` and `acquisition_campaign` copied from `crm_leads` to `patients` on conversion

**Reports enabled:**
- "Revenue by Campaign" — join `patients.acquisition_campaign` → `pending_invoices`
- "Leads by Source" — `crm_leads` grouped by `utm_source`
- "Cost per Acquisition" — (requires ad spend input from clinic) — future feature

**Standard UTM values:**
- `utm_source`: `instagram | google | facebook | whatsapp | referral | organic`
- `utm_medium`: `cpc | social | email | sms | qr_code`
- `utm_campaign`: free text (e.g., `diwali_2026`, `laser_offer_march`)

---

## PART 10 — BROKEN FLOWS TO FIX (P0 — Fix First)

These are flows that exist in the UI but don't work end-to-end correctly.
All P0 items must be resolved before Phase B starts.

### P0-1: Doctor → Counsellor Handoff
**Broken:** Doctor saves SOAP note but counsellor is not notified and no counselling row is created.

**Fix:**
1. After SOAP save, show "Send to Counsellor" button in EMR tab
2. On click: `POST /api/counselling/refer` → insert `counselling_sessions` row (`claim_status='unclaimed'`), fire notification to all counsellors in clinic, update appointment status to `consultation_done`

### P0-2: Proforma Lifecycle
**Broken:** Proforma has no status lifecycle. Counsellor creates it, nothing happens after.

**Fix:** Add `proforma_status`, `source_proforma_id`, `proforma_expires_at` columns (Part 8 migrations). Build Convert-to-Invoice, Approve, and Expire actions (Section 9.5).

### P0-3: Appointment Status — Missing Values
**Broken:** `consultation_done` and `treatment_done` statuses don't exist in DB constraint.

**Fix:** Migration in Part 8 Column Alterations. After migration, add action menu items in scheduler card.

### P0-4: CRM Auto-Stage Sync
**Broken:** Booking appointment from a lead does not update lead status to `appointment_booked`.

**Fix:** When appointment created from CRM lead context, update `crm_leads.status = 'appointment_booked'` in the same API transaction.

### P0-5: Counsellor Payment Restriction
**Broken:** Role check not enforced at API level — only hidden in UI.

**Fix:** All invoice-create and record-payment API routes must check `profile.role !== 'counsellor'` server-side and return 403. UI hiding alone is not a security control.

### P0-6: CRM Stage Values
**Broken:** `appointment_booked` and `visited` don't exist in DB constraint.

**Fix:** Migration in Part 8 Column Alterations (see Section 9.6).

### P0-7: Walk-in Force-Overlap
**Broken:** Walk-ins go through `create_appointment_safe` which performs conflict check.

**Fix:** `POST /api/appointments/walkin` uses direct service-role insert (bypasses conflict RPC). Sets `is_walkin = true`. Scheduler renders as orange stacked card. Migration in Part 8.

### P0-8: Counsellor Claim System
**Missing:** Multiple counsellors can simultaneously work on the same patient's counselling session.

**Fix:** Add `claimed_by`, `claimed_at`, `claim_status` columns to `counselling_sessions` (Part 8 migration). Build Claim/Unclaim UI and API routes (see Section 9.4).

### P0-9: OTP Exposed in Discount API Response (CRITICAL SECURITY)
**Broken:** `POST /api/discounts/request` returns `otp_demo: otp` in the response body. Any browser client can read the OTP directly, bypassing the entire approval gate.

**Fix:** Remove `otp_demo` from response unconditionally:
```ts
// WRONG — remove this
return NextResponse.json({ ok: true, otp_demo: otp });

// CORRECT
return NextResponse.json({ ok: true, message: "OTP sent to registered number" });
```
OTP is delivered via SMS/email only. Never in API response body. Ever.

### P0-10: PHI Masking Missing in Global Search
**Broken:** `GlobalSearchPalette` shows full patient phone number in plain text:
```ts
subtitle: p.phone ? `Patient · ${p.phone}` : "Patient"  // WRONG
```

**Fix:**
```ts
const masked = p.phone ? `·· ·· ···${p.phone.slice(-4)}` : "";
subtitle: masked ? `Patient · ${masked}` : "Patient"
```
Also add `autocomplete="off"` on the search input. Search results must be scoped to `activeClinicId`.

### P0-11: Proforma Convert Does Not Lock Price
**Broken:** Two broken convert paths:
- `billing/page.tsx convertProforma()` only flips `invoice_type` — no line items copied, no price locked, no proforma linkage.
- `counselling/page.tsx convertToInvoice()` uses `unit_price: t.mrp` (the full list price) not the counsellor-quoted discounted price.

**Fix:**
1. `convertProforma()` must copy all `invoice_line_items` from the source proforma to the new invoice, locking `unit_price` at the quoted value with `discount_pct = 0`, and set `source_proforma_id` on the new invoice.
2. Set `proforma_status = 'converted'` on the source proforma.
3. `convertToInvoice()` in counselling must calculate and store `quoted_price = mrp * (1 - discount_pct/100)` as `unit_price` with `discount_pct = 0`.

### P0-12: Clinical Encounters Deletable (Not Immutable)
**Broken:** RLS policy `"Admins manage clinical_encounters"` uses `FOR ALL` — grants DELETE and UPDATE to admins. SOAP notes must be permanent records (HIPAA clinical documentation standard).

**Fix:** Drop the `FOR ALL` policy. Replace with:
```sql
DROP POLICY "Admins manage clinical_encounters" ON clinical_encounters;

-- INSERT only — no UPDATE, no DELETE for anyone (not even superadmin)
CREATE POLICY "clinical_encounters_insert" ON clinical_encounters
  FOR INSERT WITH CHECK (clinic_id = get_viewer_clinic_id());

CREATE POLICY "clinical_encounters_select" ON clinical_encounters
  FOR SELECT USING (
    clinic_id = get_viewer_clinic_id()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('superadmin','chain_admin'))
  );
-- No UPDATE policy. No DELETE policy. Encounters are immutable.
```
Amendments must be added as new `patient_notes` rows, never as edits to existing encounters.

### P0-13: Void Invoice Does Not Reverse Wallet Payment
**Broken:** `voidInvoice()` only sets `status = 'void'`. If patient paid via wallet, the wallet balance is never restored.

**Fix:** Before voiding, reverse all wallet payments:
```ts
// In voidInvoice(), before updating status:
const { data: walletPayments } = await supabase
  .from("invoice_payments")
  .select("amount")
  .eq("invoice_id", invoiceId)
  .eq("payment_mode", "wallet");

for (const p of walletPayments ?? []) {
  await supabase.rpc("credit_wallet", {
    p_patient_id: invoice.patient_id,
    p_amount: p.amount,
    p_reason: `Void reversal: invoice ${invoice.invoice_number}`,
    p_reference_id: invoiceId,
    p_reference_type: "invoice_void"
  });
}
```

---

## PART 11 — FEATURE BUILD QUEUE (By Priority)

### P1 — High Priority (Build After P0 Fixes)
1. **Top Bar Navigation** — rebuild `components/TopBar.tsx` + Apps Menu + update `app/layout.tsx`
2. **Navy/White theme migration** — update `globals.css` CSS variables, sweep all hardcoded hex colors
3. **Command Bar (Cmd+K)** — `components/CommandBar.tsx` + `search_index` table + triggers (NG-10)
4. **HSN/SAC on services + line items** — DB migration + validation in billing UI
5. Appointment Room View — `rooms` table + scheduler tab
6. Walk-in Force-Overlap button in scheduler
7. Patient Packages tab (dedicated)
8. **Patient Activity Timeline tab** — reads from `patient_events` table (NG-7)
9. Patient Documents tab
10. Doctor Queue View
11. Patient Tags (`patient_tags` table + UI)
12. Duplicate Patient Detection + **Patient Merge** — `POST /api/patients/merge` + UI (NG-1)
13. **Protocol-Driven Follow-up Automation** — extend protocols + follow-up suggestion job (NG-4)
14. **Appointment Timing Timestamps** — status change hooks populate checked_in_at etc. (NG-3)
15. **Consent Form Snapshotting** — capture form_snapshot_json on every portal/intake submit (NG-2)
16. **Marketing Attribution** — UTM capture on intake + lead webhooks + "Revenue by Campaign" report (NG-6)
17. **Inventory Transit Lock** — 2-step transfer dispatch/receive flow (NG-5)
18. **Clinical Audit Log** — DB triggers on 5 editable clinical tables + "Edit History" drawer (NG-13)

### P2 — Medium Priority
19. Service Consumables auto-deduction (`service_consumables` table + `consume_session()` update)
20. GSTR-1 HSN/SAC report (CSV export in GSTR-1 format)
21. CRM campaign segment targeting UI (currently only template, no segment builder)
22. List View in scheduler (for reception call list)
23. Appointment drag-and-drop rescheduling
24. Bulk rescheduling (doctor unavailable → move all appointments)
25. Patient Blacklist feature
26. System Health Monitor tab in God Mode (see Part 16)
27. Granular Feature Flags UI in God Mode (see Part 16)
28. **`patient_metrics` DB view** — total_spend, LTV, avg_ticket, visit_count (NG-8)
29. **Service Credit Expiry Worker** — `pg_cron` daily + patient notification (NG-12)
30. **Background Job Queue** — `background_jobs` table + Edge Function processor (NG-11)
31. **Soft Delete** — `deleted_at` on patients/services/profiles + superadmin purge UI (NG-9)

### P3 — Polish / Nice-to-Have
32. Purchase Orders workflow
33. Mobile bottom navigation bar
34. Smart room/doctor conflict warnings
35. Superadmin: Create Organization/Chain from UI
36. Appointment buffer time configuration per service
37. Doctor availability schedule builder
38. AI command suggestions in Command Bar
39. Patient lifetime value dashboard widget (powered by `patient_metrics` view)

---

## PART 12 — API ROUTES (Complete Reference)

### Patient APIs
```
GET  /api/patients/[id]           Full EMR bundle
POST /api/patients/[id]           Actions: save_encounter, add_note, add_treatment
POST /api/patients/merge          Merge two patient records (NG-1)
GET  /api/patients/[id]/events    Patient activity timeline events (NG-7)
GET  /api/patients/[id]/metrics   Patient metrics (LTV, visits, avg ticket) (NG-8)
```

### Portal APIs
```
POST /api/portal/book             Patient self-booking (token auth)
GET  /api/portal/services         Available services for portal
POST /api/portal/consent          E-signature capture
```

### Billing APIs
```
POST /api/billing/invoice         Create invoice (validates HSN/SAC on all line items — returns 400 if missing)
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
GET   /api/rooms                    List rooms for clinic
POST  /api/rooms                    Create room
POST  /api/appointments/walkin      Force-overlap walk-in (bypasses conflict check, sets is_walkin=true)
POST  /api/proforma/convert         Convert proforma → invoice (copies line items, locks price)
PATCH /api/proforma/[id]/approve    Approve proforma (admin only)
PATCH /api/proforma/[id]/expire     Expire proforma (cron or manual)
POST  /api/counselling/refer        Doctor → counsellor handoff (creates unclaimed session + notification)
POST  /api/counselling/claim        Counsellor claims a session
POST  /api/counselling/unclaim      Admin overrides / releases claim
GET   /api/billing/gstr1            GSTR-1 export (HSN/SAC grouped, date range, CSV)
GET   /api/health                   System health check (for God Mode monitor)
GET   /api/admin/feature-flags      List clinic_feature_flags for a clinic
PUT   /api/admin/feature-flags      Upsert a clinic feature flag
POST  /api/service-consumables              Link inventory product to service with quantity_per_session
GET   /api/service-consumables              List consumables for a service
PATCH /api/inventory/transfers/[id]/dispatch → in_transit, deducts source stock (NG-5)
PATCH /api/inventory/transfers/[id]/receive  → received, adds destination stock (NG-5)
PATCH /api/inventory/transfers/[id]/cancel   → cancelled, restores source stock (NG-5)
GET   /api/clinical-audit/[record_type]/[id] Field-level edit history for a clinical record (NG-13)
GET   /api/search                            Cmd+K search via search_index table (NG-10)
POST  /api/jobs                              Enqueue a background job (NG-11)
```

---

## PART 13 — DB HELPER FUNCTIONS (Reference)

| Function | Purpose | Status |
|---|---|---|
| `check_clinic_access(clinic_id, feature_name)` | Entitlement check (kill switch → plan → module) | ✅ Live |
| `create_appointment_safe(...)` | Server-side conflict check + insert | ✅ Live |
| `consume_session(...)` | Atomic credit deduction + commission + **inventory** | ⚠️ Needs inventory step (Phase B) |
| `record_payment(...)` | Atomic payment + wallet debit | ✅ Live |
| `debit_wallet(patient_id, amount)` | Wallet deduction (raises on insufficient) | ✅ Live |
| `credit_wallet(patient_id, amount, reason, ...)` | Wallet top-up / reversal | ✅ Live |
| `assign_membership_safe(...)` | Prevents duplicate active memberships | ✅ Live |
| `increment_no_show(...)` | Restores credit + decrements used_sessions | ✅ Live |
| `earn_loyalty_points(...)` | Loyalty point award | ✅ Live |
| `update_expired_memberships()` | Fire-and-forget on membership page load | ✅ Live |
| `mark_overdue_invoices()` | Fire-and-forget on billing page load | ✅ Live |
| `get_viewer_clinic_id()` | SECURITY DEFINER — used in RLS policies | ✅ Live |
| `get_viewer_role()` | SECURITY DEFINER — used in RLS policies | ✅ Live |
| `record_feature_usage(...)` | Logs to feature_usage_log | ✅ Live |
| `logAction(...)` | Audit trail — skips silently for demo clinics | ✅ Live |
| `validate_gift_card(gift_card_id, amount, clinic_id)` | Checks expiry, balance, clinic scope | ❌ Missing (Phase B) |
| `evaluate_workflow_rules(clinic_id, trigger, context)` | Fires matching rules for a trigger event | ❌ Missing (Phase B) |
| `merge_patients(source_id, target_id, merged_by, reason)` | Reassigns all FK refs, sets source inactive | ❌ Missing (Phase D) |
| `expire_service_credits()` | Sets credits past expires_at to 'expired', fires notification | ❌ Missing (Phase E) |
| `refresh_search_index(entity_type, entity_id)` | Upserts one row in search_index — called by triggers | ❌ Missing (Phase C) |
| `process_background_jobs()` | Picks up due background_jobs rows, executes, marks status | ❌ Missing (Phase E) |

**All SECURITY DEFINER functions MUST have `SET search_path = 'public'`.**

---

## PART 14 — SECURITY RULES (Non-Negotiable)

1. **RLS on ALL tables** — every table in the `public` schema must have `rowsecurity = true` AND at least one policy. No exceptions. Confirmed violated by `inventory_transfers` and `workflow_scheduled_actions` — fix is in Phase 0.

2. **No bare `auth.uid()`** in RLS policies — always `(SELECT auth.uid())` to prevent per-row re-evaluation. Bare `auth.uid()` causes O(n) policy evaluation instead of O(1), causing linear query degradation under load.

3. **All SECURITY DEFINER functions** must have `SET search_path = 'public'` to prevent search path injection.

4. **Service role** only used in `/api/**` server routes — never in client components or `"use client"` pages.

5. **No PHI in localStorage** — auth tokens and patient data only in cookies / server state. PHI includes: full name, phone, email, DOB, diagnosis, treatment notes.

6. **PHI masking in list views** — phone numbers shown as `·· ·· ···XXXX` (last 4 only) in all list views, search results, and autocomplete dropdowns. Full reveal only on explicit user action (click to reveal, logged in audit).

7. **Portal routes** — token-based auth (`portal_sessions` table), no Supabase JWT. Service role for portal API operations.

8. **Superadmin routes** — always check `profile.role === 'superadmin'` server-side via `getUser()`. Client-side role claims are not trusted.

9. **Counsellor restriction** — API-level check (`profile.role !== 'counsellor'`), not just UI hiding. Return 403 for invoice-create and record-payment routes if role is counsellor.

10. **Demo clinics** — `logAction()` silently skips audit insert for demo clinic_id.

11. **Webhook endpoints** — HMAC-SHA256 signature verification on all inbound webhooks. Reject any request with invalid or missing signature.

12. **OTP delivery** — OTPs for discount approval must be delivered via SMS/email only. OTP must NEVER appear in any API response body. No `otp_demo` or similar fields in responses — not in development, not in production.

13. **No open `using(true)` INSERT policies** — reference tables (medical_codes, rule_templates, etc.) may have open SELECT policies for authenticated users. But INSERT/UPDATE/DELETE must always be restricted. Form submissions via portal/intake must go through a server-side API route using service role, never direct client write.

14. **clinic_id on every data table** — every table storing clinic-specific data must have a `clinic_id` column and an RLS policy scoping it to `get_viewer_clinic_id()`. Tables without `clinic_id` cannot have proper multi-tenant isolation.

15. **Clinical encounters are immutable** — no UPDATE or DELETE RLS policies on `clinical_encounters`. Not even for superadmin. Amendments are new `patient_notes` rows. This is a HIPAA clinical documentation requirement.

16. **Scheduler checkout must pass `service_id`** — all invoice line items created from session checkout must carry the actual `service_id` UUID (not null) so HSN/SAC codes can be resolved for GSTR-1 filing.

---

## PART 15 — EXECUTION ORDER

Do NOT start implementation until this plan is reviewed and approved.

Once approved, implement in this exact order. Do not skip phases.

```
PHASE 0 — Security Hotfixes (deploy to staging immediately — no feature code until these are done)
  0-1. Remove otp_demo from /api/discounts/request response (P0-9)
  0-2. Enable RLS on inventory_transfers + add clinic-scoped policy
  0-3. Enable RLS on workflow_scheduled_actions + add clinic-scoped policy
  0-4. Fix form_responses INSERT policy — remove open anon policy, restrict to clinic or portal token
  0-5. Replace bare auth.uid() with (SELECT auth.uid()) across all RLS policies
  0-6. Drop clinical_encounters FOR ALL policy → INSERT + SELECT only (P0-12)

PHASE A — DB Migrations (run after Phase 0, unblocks all feature code)
  A1.  Add appointment statuses: consultation_done, treatment_done (P0-3)
  A2.  Add CRM stages: appointment_booked, visited (P0-6)
  A3.  Add proforma columns: proforma_status, source_proforma_id, expires_at, approved_by (P0-2)
  A4.  Add counselling_sessions claim columns: claimed_by, claimed_at, claim_status (P0-8)
  A5.  Add appointments.is_walkin column (P0-7)
  A6.  Add hsn_sac_code + gst_category to services
  A7.  Add hsn_sac_code to invoice_line_items
  A8.  Add metadata JSONB to 9 core tables (Part 16)
  A9.  Create clinic_feature_flags table (Part 16)
  A10. Create rooms table (Section 9.11)
  A11. Create service_consumables table (Section 9.7)
  A12. Add sold_by_provider_id + sale_commission_pct + sale_commission_amount to patient_service_credits
  A13. Add commission_type column to staff_commissions
  A14. Add clinic_id to: patient_notes, patient_packages, prescriptions, package_items, package_members, service_transfers (backfill + index)
  A15. Add source_proforma_id FK on pending_invoices (self-referential)
  A16. Add appointment timing timestamps: checked_in_at, consultation_start/end_at, treatment_start/complete_at (NG-3)
  A17. Add merged_into_id + deleted_at to patients; deleted_at to services, profiles (NG-1, NG-9)
  A18. Add UTM columns to crm_leads + acquisition columns to patients (NG-6)
  A19. Add form_snapshot_json + consent_version to form_responses (NG-2)
  A20. Add transfer_status + received_by + received_at to inventory_transfers (NG-5)
  A21. Add doctor_id, appointment_id, outcome, side_effects, next_recommended_date to patient_treatments
  A22. Add followup_days, aftercare_message, auto_remind to protocols (NG-4)
  A23. Create patient_merge_log table (NG-1)
  A24. Create patient_events table (NG-7)
  A25. Create search_index table + GIN index + population triggers (NG-10)
  A26. Create background_jobs table (NG-11)
  A27. Create clinical_audit_log table + UPDATE triggers on 5 clinical tables (NG-13)

PHASE B — Logic Fixes (P0 Broken Flows)
  B1. Fix Doctor → Counsellor handoff — POST /api/counselling/refer + notification (P0-1)
  B2. Build Proforma lifecycle — approve / convert / expire with price locking (P0-2, P0-11)
  B3. Fix Counsellor payment restriction at API level (P0-5)
  B4. Fix CRM auto-stage sync on appointment creation (P0-4)
  B5. Build Counsellor Claim System — POST /api/counselling/claim + /unclaim + UI (P0-8)
  B6. Build Walk-in Force-Overlap — POST /api/appointments/walkin + scheduler button (P0-7)
  B7. Fix GlobalSearchPalette PHI masking — mask phone to last 4 digits (P0-10)
  B8. Fix void invoice wallet reversal — credit_wallet() call before status = void (P0-13)
  B9. Fix scheduler checkout to pass service_id (not null) in invoice line items
  B10. Wire sale commission at package purchase time (Section 9.7b)
  B11. Wire inventory deduction into consume_session() RPC (Section 9.7 three-way sync)
  B12. Wire patient_events inserts at all trigger points (appointment, invoice, photo, etc.) (NG-7)
  B13. Capture form_snapshot_json on portal/intake form submit (NG-2)
  B14. Capture UTM params from intake URL + lead webhooks into crm_leads (NG-6)
  B15. Copy acquisition_source/campaign to patients on lead conversion (NG-6)
  B16. Build inventory transfer dispatch/receive API + UI (NG-5)
  B17. Wire appointment timing timestamp writes on each status transition (NG-3)

PHASE C — Visual Overhaul (P1 — Design)
  C1. Update globals.css with Navy/White CSS variables
  C2. Rebuild TopBar.tsx — Navy bg, top nav links, Apps Menu grid, Clinic Switcher
  C3. Update app/layout.tsx — TopBar in root, main pt-16, remove sidebar
  C4. Sweep all pages — replace hardcoded hex colors with CSS variables
  C5. Build CommandBar.tsx (Cmd+K) + wire to search_index (NG-10)
  C6. Mobile bottom nav bar

PHASE D — High Impact Features (P1 — Features)
  D1. HSN/SAC mandatory validation in billing UI + GSTR-1 export
  D2. Room Management — CRUD + Room View tab in scheduler
  D3. Patient: Packages tab (dedicated, with redeem/freeze/transfer)
  D4. Patient: Activity Timeline tab — reads from patient_events (NG-7)
  D5. Patient: Documents tab
  D6. Patient Tags (patient_tags table + header chips + filter)
  D7. Duplicate Patient Detection + Merge (NG-1) — merge modal + POST /api/patients/merge
  D8. Doctor Queue View
  D9. Protocol follow-up automation — extend protocols table + background job trigger (NG-4)
  D10. Clinical Audit Log "Edit History" drawer on Treatments / Prescriptions tabs (NG-13)
  D11. Consent snapshotting verification — confirm snapshot captured on test submission (NG-2)
  D12. Marketing Attribution report — "Revenue by Campaign" in /admin/reports (NG-6)

PHASE E — Medium Priority (P2)
  E1. Service Consumables UI — map products to services in /settings/services
  E2. System Health Monitor tab in God Mode
  E3. Granular Feature Flags UI in God Mode (clinic_feature_flags CRUD)
  E4. CRM campaign segment builder
  E5. List View in scheduler (reception call list)
  E6. Appointment drag-and-drop rescheduling
  E7. Patient Blacklist
  E8. patient_metrics DB view + Dashboard "Top Patients" widget (NG-8)
  E9. Service Credit Expiry Worker — pg_cron daily + notification (NG-12)
  E10. Background Job Queue processor — Edge Function + pg_cron (NG-11)
  E11. Soft Delete UI — "Deleted Records" recovery page for superadmin (NG-9)

PHASE F — Polish (P3)
  F1. Purchase Orders workflow
  F2. Smart room/doctor conflict warnings
  F3. Doctor availability schedule builder
  F4. Superadmin org/chain creator
  F5. AI command suggestions in Command Bar
  F6. Patient LTV dashboard widget (powered by patient_metrics view)
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
| OTP delivery | SMS/email only — **never in API response** | Audit DA-26: OTP was exposed in response body — security vulnerability |
| Clinical encounter mutability | **Immutable** — INSERT only, no UPDATE/DELETE | HIPAA clinical documentation standard; audit DA-39 |
| Commission tracking | **Two types**: sale commission + delivery commission | Audit DA-42: counsellors who sell packages must also earn commission |
| PHI in list views | **Masked** — phone shows last 4 digits only | HIPAA/privacy requirement; audit DA-30 |
| Three-way sync | `consume_session()` must include inventory deduction | Audit DA-36: inventory was not part of the sync |
| Proforma price lock | `unit_price = quoted_price`, `discount_pct = 0` | Audit DA-33: price must be locked at conversion, not recalculated |

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
- `patient.create`, `patient.update`, `patient.deactivate`, `patient.merge`
- `appointment.create`, `appointment.cancel`, `appointment.no_show`
- `invoice.create`, `invoice.void`, `invoice.refund`
- `payment.record`, `wallet.debit`, `wallet.credit`
- `discount.request`, `discount.approve`, `discount.reject`
- `counselling.claim`, `counselling.unclaim`, `counselling.convert`, `counselling.update`
- `proforma.create`, `proforma.approve`, `proforma.convert`, `proforma.expire`
- `staff.invite`, `staff.deactivate`, `role.change`
- `module.enable`, `module.disable`, `kill_switch.toggle`
- `treatment.update`, `prescription.update`, `medical_history.update`

**Two-tier audit system (v2.2):**

| System | Table | Purpose | Populated by |
|---|---|---|---|
| Admin/Security audit | `audit_logs` | Who did what (entity-level) | `logAction()` in API routes |
| Clinical change audit | `clinical_audit_log` | What changed field-by-field | DB triggers on UPDATE |
| Patient journey events | `patient_events` | Business events for timeline | API hooks + RPC hooks |

**Demo clinic suppression:** `logAction()` silently skips insert if `clinicId` is a demo clinic.
`clinical_audit_log` triggers and `patient_events` inserts also skip demo clinics — implementation:
DB triggers check `(SELECT is_demo FROM clinics WHERE id = NEW.clinic_id LIMIT 1)` and return early if true.
This is a single indexed lookup per trigger fire and does not affect performance under normal (non-demo) load.

---

*Last updated: 2026-03-08*
*Version: 2.3 — SSOT audit-clean. All cross-reference and schema inconsistencies resolved.*
*Status: APPROVED — Single Source of Truth. Start with Phase 0 security hotfixes.*

---

## PART 17 — AUDIT TRAIL

All findings from the 360-degree pre-implementation audit (2026-03-08, DA-26 → DA-49) have been folded into this document:

| Finding | Folded Into |
|---|---|
| DA-26: OTP in API response | Part 10 P0-9, Part 14 Rule 12 |
| DA-27: RLS disabled on 2 tables | Part 14 Rule 1, Part 15 Phase 0 |
| DA-28: Open form_responses INSERT | Part 14 Rule 13, Part 15 Phase 0 |
| DA-29: Bare auth.uid() in policies | Part 14 Rule 2, Part 15 Phase 0 |
| DA-30: PHI in search results | Part 10 P0-10, Part 14 Rule 6 |
| DA-31: clinic_id missing on 10 tables | Part 8 Column Alterations, Part 15 Phase A |
| DA-32: Doctor→Counsellor handoff | Part 10 P0-1, Part 9.3 |
| DA-33: Proforma price not locked | Part 10 P0-11, Part 9.4 |
| DA-34: CRM status constraint | Part 9.6, Part 15 Phase A |
| DA-35: Appointment status constraint | Part 9.2, Part 15 Phase A |
| DA-36: Inventory not in consume_session | Part 9.7 Three-Way Sync |
| DA-37: workflow_scheduled_actions no engine | Part 12 APIs To Be Created |
| DA-38: Rules not wired to API triggers | Part 13 DB Functions |
| DA-39: Encounters deletable | Part 10 P0-12, Part 14 Rule 15 |
| DA-40: provider_id missing on encounter insert | Part 9.3 |
| DA-41: Void invoice no wallet reversal | Part 10 P0-13, Part 9.5 |
| DA-42: Sale commission not tracked | Part 9.7b Commission Tracking |
| DA-43: service_id null in checkout | Part 14 Rule 16, Part 15 Phase B |
| DA-44: Gift card not validated | Part 9.5 Gift Card Validation |
| DA-45: profiles.email contradiction | CLAUDE.md to be updated — remove email from profiles |
| DA-46: is_walkin column missing | Part 8 Column Alterations, Part 10 P0-7 |
| DA-47: counselling claim columns missing | Part 8 Column Alterations, Part 10 P0-8 |
| DA-48: proforma_status column missing | Part 8 Column Alterations, Part 10 P0-2 |
| DA-49: 109 tables undocumented | Schema is larger than documented — SSOT is the live DB |

**The raw audit report is preserved in `PRE_IMPLEMENTATION_AUDIT.md` for reference.**

---

### v2.3 Fixes — SSOT Audit Clean-up (2026-03-08)

| Fix | Change |
|---|---|
| F-1: Phase A count in header | Corrected "A16–A24" → "A1–A27" |
| F-2: inventory_transfers missing from Part 8 | Full column definition added to Inventory LIVE tables |
| F-3: inventory_transactions naming conflict | Standardised to `inventory_movements` in consume_session() SQL |
| F-4: before_after_photos undocumented | Column definition added to Clinical Tables LIVE section |
| F-5: patient_packages undocumented | Column definition added to Clinical Tables LIVE section |
| F-6: staff_commissions stale definition | Added `commission_type (sale\|delivery)` column with migration note |
| F-7: workflow_scheduled_actions undocumented | Table definition added to Workflow LIVE section; workflow_clinic_overrides also added |
| F-8: Orphaned text in Section 9.15 | Removed stray "Navigation manager" line |
| F-9: Part 7 Module Status missing NG items | All 13 NG-1 through NG-13 items added as MISSING |
| F-10: Appointment status SQL not in Part 8 | Added canonical SQL to Part 8 Column Alterations (migration A1) |
| C-1: POST /api/billing/invoice missing | Added to Part 12 Billing APIs |
| C-2: Demo suppression mechanism unspecified | Added DB trigger implementation note to Part 16.5 |
| C-3: is_reverse_charge ambiguous | Marked explicitly as [FUTURE — not in Phase A–F] |

---

### v2.2 Additions — Gap List 2 + Clinical Audit (2026-03-08)

| # | Gap | Folded Into |
|---|---|---|
| NG-1 | Patient Merge Operation | Part 9.1, Part 12, Part 13, Part 15 Phase A23+D7 |
| NG-2 | Consent Form Snapshotting | Part 8 Column Alterations A19, Part 15 Phase B13+D11 |
| NG-3 | Appointment Timing Timestamps | Part 8 Column Alterations A16, Part 15 Phase B17 |
| NG-4 | Protocol-Driven Follow-up Automation | Part 8 Column Alterations A22, Part 9.7, Part 15 Phase D9 |
| NG-5 | Inventory Transit Lock (2-step) | Part 9.7 Inventory, Part 12, Part 15 Phase A20+B16 |
| NG-6 | Marketing Attribution / UTM Tracking | Part 8 Column Alterations A18, Part 9.15, Part 15 Phase B14+D12 |
| NG-7 | `patient_events` table + Activity Timeline | Part 8 Tables, Part 9.14, Part 15 Phase A24+B12+D4 |
| NG-8 | `patient_metrics` DB view | Part 12, Part 13, Part 15 Phase E8 |
| NG-9 | Soft Delete on patients/services/profiles | Part 8 Column Alterations A17, Part 15 Phase E11 |
| NG-10 | `search_index` table for Cmd+K | Part 8 Tables, Part 9.10, Part 13, Part 15 Phase A25+C5 |
| NG-11 | Generic Background Job Queue | Part 8 Tables, Part 12, Part 13, Part 15 Phase E10 |
| NG-12 | Service Credit Expiry Worker | Part 13, Part 15 Phase E9 |
| NG-13 | `clinical_audit_log` — field-level clinical change tracking | Part 8 Tables, Part 9.13, Part 15 Phase A27+D10, Part 16.5 |
