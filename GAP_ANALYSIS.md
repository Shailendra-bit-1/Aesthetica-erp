# GAP ANALYSIS — MASTER_PLAN.md vs Current Codebase
**Date:** 2026-03-07
**Method:** Line-by-line comparison of MASTER_PLAN.md against live code in `staging` branch
**Verdict key:** ✅ Implemented | ⚠️ Partial | ❌ Missing | 🔴 Conflict

---

## SUMMARY SCORECARD

| Area | Total Plan Items | Implemented | Partial | Missing |
|---|---|---|---|---|
| Design System & Navigation | 12 | 2 | 3 | 7 |
| Patient Module | 18 | 8 | 3 | 7 |
| Appointment / Scheduler | 22 | 7 | 3 | 12 |
| Billing & Proforma | 10 | 4 | 3 | 3 |
| CRM Pipeline | 8 | 4 | 1 | 3 |
| Counselling Module | 8 | 3 | 2 | 3 |
| Roles & Permissions | 10 | 5 | 1 | 4 |
| Superadmin / God Mode | 12 | 5 | 2 | 5 |
| Database Tables | 22 | 14 | 0 | 8 |
| Command Bar | 12 | 1 | 1 | 10 |
| Inventory | 6 | 4 | 1 | 1 |
| Reporting & Analytics | 6 | 3 | 2 | 1 |

**Overall: ~46% of the MASTER_PLAN is fully implemented. 54% is missing or partial.**

---

## 1. DESIGN SYSTEM & NAVIGATION

### 🔴 CRITICAL CONFLICT — Color Theme
**Plan says:**
```
Primary Navy   #0B2A4A
Secondary Navy #1F4E79
Accent Blue    #2E6CB8
Background     #F7F9FC
Font: Inter / SF Pro / Roboto
```
**Code has:**
```
Gold       #C5A059  (var(--gold))
Background #F9F7F2  (Linen)
Font: Georgia (serif)
```
These are **directly contradictory**. The MASTER_PLAN defines a White/Navy B2B SaaS aesthetic. The codebase has a Gold/Linen luxury aesthetic. **One must be chosen as SSOT.** Currently CLAUDE.md (Gold/Linen) is enforced at every component level. Changing it requires a full design token sweep.

---

### Navigation Layout

| Plan Requirement | Code Reality | Gap |
|---|---|---|
| Top bar as primary nav (Dashboard / Patients / Scheduler / Billing / CRM / Reports / Apps) | ✅ TopBar exists but modules are in **left sidebar** (Sidebar.tsx), not top bar | ❌ Top-nav-first layout not implemented |
| "Apps" menu — clicking opens a module grid (organized by category) | ❌ No Apps menu exists | ❌ Missing |
| Floating Quick Action (+) button bottom-right for New Patient / Appointment / Invoice / Lead | ⚠️ `QuickActions.tsx` exists but it is a component on the dashboard, not a persistent floating FAB on all pages | ⚠️ Partial |
| Multi-clinic switcher in top bar | ✅ Exists in TopBar via ClinicContext dropdown | ✅ Done |
| Breadcrumb + Back/Close navigation on every page (Mangomint style) | ❌ Not implemented on most pages | ❌ Missing |
| Mobile bottom navigation (Home / Patients / Scheduler / CRM / Apps) | ❌ Not implemented | ❌ Missing |
| Tablet compact layout | ❌ No tablet-specific responsive breakpoints | ❌ Missing |
| Skeleton loaders everywhere — no blank screens | ⚠️ 38 pages have `isLoading`/`Skeleton` states but not all pages covered | ⚠️ Partial |
| Error states with Retry button | ⚠️ Inconsistent — some pages have retry, most show plain error text | ⚠️ Partial |

---

## 2. PATIENT MODULE

### Patient Creation

| Plan Requirement | Code Reality | Gap |
|---|---|---|
| Mandatory: name, mobile, gender, DOB | ⚠️ Code makes name + phone mandatory; gender and DOB optional | ⚠️ Partial |
| Duplicate detection on mobile before creation | ✅ Implemented (GAP-6, `normalizePhone`) | ✅ Done |
| Duplicate popup: "Open existing" or "Create new (admin only)" | ⚠️ Popup exists but "admin only" restriction on Create New is not enforced by role | ⚠️ Partial |
| Referral source capture on creation | ✅ Implemented via referral codes | ✅ Done |

### Patient Profile Tabs

**Plan defines 12 tabs:**
```
Overview | Appointments | Consultation | Counselling | Treatments
Packages | Invoices | Photos | Documents | Medical History | Notes | Activity Timeline
```

**Code has 12 tabs:**
```
Overview | EMR | Charting | Gallery | Documents | Treatments
Billing | Wallet | Prescriptions | Appointments | Communications | Marketing
```

**Tab-by-tab gap:**

| Plan Tab | Code Equivalent | Gap |
|---|---|---|
| Overview | ✅ OverviewTab | Done |
| Appointments | ✅ AppointmentsTab | Done |
| **Consultation** | ❌ No dedicated Consultation tab. SOAP notes live inside EMRTab combined with all notes | **MISSING** — Plan treats Consultation (doctor notes) as separate from general EMR |
| **Counselling** | ❌ No Counselling tab in patient profile. Counselling sessions are on a separate `/counselling` page, not inside patient profile | **MISSING** |
| Treatments | ✅ TreatmentsTab | Done |
| **Packages** | ❌ Packages visible inside WalletTab but no dedicated Packages tab with session redemption, freeze, transfer controls | **MISSING** |
| **Invoices** | ❌ Billing exists in BillingTab but plan wants an "Invoices" tab specifically (history, refund, download PDF per invoice) | ⚠️ Partial |
| Photos | ✅ GalleryTab (before/after) | Done |
| Documents | ✅ DocumentsTab | Done |
| **Medical History** | ⚠️ Medical history fields shown inside OverviewTab, not a dedicated tab | ⚠️ Partial |
| **Notes** | ❌ No dedicated Notes tab (internal staff notes). Notes mixed into EMRTab | **MISSING** |
| **Activity Timeline** | ❌ No dedicated Activity Timeline tab per patient showing "who did what and when". CommunicationsTab is different (outbound comms log) | **MISSING** |

**Extra tabs in code not in plan:**
- `ChartingTab` (face/body diagram pins) — premium feature not in plan
- `WalletTab` — merged from plan's separate Wallet + Packages
- `PrescriptionsTab` — not mentioned in plan (but clinically correct)
- `MarketingTab` — not mentioned in plan

### Patient Features

| Plan Requirement | Code Reality | Gap |
|---|---|---|
| Patient tags (VIP, Influencer, High Value, Sensitive Skin) — user-defined | ❌ Only system tiers exist (vip/hni/standard) as enum. No user-defined custom tags | ❌ Missing |
| Patient blacklist with reason required | ❌ Not implemented | ❌ Missing |
| Merge patients (Merge Patient button in header) | ❌ Not implemented | ❌ Missing |
| Patient side drawer (open patient from scheduler/CRM without leaving current screen) | ❌ Clicking a patient navigates to full `/patients/[id]` page. No slide-in drawer | ❌ Missing |
| Outstanding balance warning in header | ✅ PatientHeader shows wallet balance | ✅ Done |
| VIP / Allergy alert icons in header | ⚠️ Tier badge exists; allergy shown in profile but no prominent header alert icon | ⚠️ Partial |
| Patient analytics — Visit Frequency, Conversion Rate, Avg Spend | ⚠️ Total visits and spend shown in OverviewTab KPIs, but conversion rate not calculated | ⚠️ Partial |
| Quick Action buttons on profile (New Appointment, Generate Invoice, Start Consultation, Add Counselling, Upload Photo) | ⚠️ Partial — some actions accessible via tabs but no dedicated quick-action button row below header | ⚠️ Partial |

---

## 3. APPOINTMENT / SCHEDULER

### Status Mismatch — CRITICAL

**Plan defines 8 statuses:**
```
Booked → Confirmed → Checked-in → Consultation → Treatment → Completed → Cancelled → No-show
```

**Code has 7 statuses:**
```
planned → confirmed → arrived → in_session → completed → cancelled → no_show
```

**Specific gaps:**

| Plan Status | Code Status | Gap |
|---|---|---|
| Booked | `planned` | Name differs — minor |
| Confirmed | `confirmed` | ✅ Match |
| Checked-in | `arrived` | Name differs — minor |
| **Consultation Done** | ❌ No equivalent — `in_session` combines consultation + treatment into one status | **MISSING** — Can't distinguish "consultation done, waiting for treatment" from "in treatment" |
| **Treatment Done** | ❌ No equivalent | **MISSING** |
| Completed | `completed` | ✅ Match |
| Cancelled | `cancelled` | ✅ Match |
| No-show | `no_show` | ✅ Match |

This is a **workflow-breaking gap**. Indian aesthetic clinics routinely have patients complete consultation with one doctor, then move to a treatment room. Without separate `consultation_done` and `treatment_done` statuses, the handoff between doctor → treatment room cannot be tracked.

---

### Scheduler Views

| Plan Requirement | Code Reality | Gap |
|---|---|---|
| Doctor View (doctors as columns) | ✅ DayView has provider columns | ✅ Done |
| **Room View** (treatment rooms as columns, not text field) | ❌ Room is a free-text field on appointments. No Room View with actual room entities as columns | **MISSING** — requires `treatment_rooms` table + Room View component |
| Combined View (Doctor + Room grid) | ❌ Not implemented | ❌ Missing |
| Day View | ✅ Implemented | ✅ Done |
| Week View | ✅ Implemented | ✅ Done |
| Month View | ⚠️ Type definition exists (`CalendarView = "day" \| "week" \| "month"`) but month view is not visually implemented in the component | ⚠️ Partial |

### Scheduler Features

| Plan Requirement | Code Reality | Gap |
|---|---|---|
| Drag & drop rescheduling | ✅ Implemented via HTML5 drag API | ✅ Done |
| Double booking with warning + override | ✅ Implemented (`enable_double_booking` setting) | ✅ Done |
| **Walk-in button** — auto-creates appointment and checks patient in immediately | ❌ No dedicated Walk-in button. Walk-ins require manually creating an appointment like any other | **MISSING** |
| Appointment color coding by **type** (Consultation=Blue, Treatment=Purple, Followup=Green, Walk-in=Orange) | ❌ Code colors by **status** or **provider**. No coloring by appointment type | ❌ Missing — different visual logic |
| Appointment buffer time **per service** (auto-blocks next slot per service definition) | ❌ `buffer_time_minutes` exists as a **global** scheduler setting, not per-service | ⚠️ Partial |
| **Doctor queue** screen (Waiting / In Consultation / Completed list for doctor view) | ❌ Not implemented | ❌ Missing |
| **Doctor availability schedule** (Mon–Fri 10–18, lunch break) | ❌ No doctor schedule/availability configuration | ❌ Missing |
| Leave blocks calendar (doctor on leave = no bookings) | ❌ Staff leaves exist in HR module but do NOT block the scheduler calendar | ❌ Missing |
| **Bulk rescheduling** when doctor unavailable | ❌ Not implemented | ❌ Missing |
| **Emergency slot** (priority appointment above normal schedule) | ❌ Not implemented | ❌ Missing |
| Patient side drawer in scheduler (click appointment → patient panel slides in, scheduler stays visible) | ❌ Clicking appointment opens a modal with appointment details, not a full patient side drawer | ❌ Missing |
| Appointment right-click context menu (Reschedule / Add Note / Cancel / No Show) | ⚠️ Quick action buttons exist on hover but no right-click context menu | ⚠️ Partial |
| Keyboard shortcuts: N→New Appointment, F→Find Patient, D→Next Day | ⚠️ `N` for New Patient exists but not appointment-specific shortcuts | ⚠️ Partial |
| Scheduler stats bar (Today's Appointments / Checked In / Completed / No Shows) | ⚠️ Basic stats shown but not a persistent top stats bar on the scheduler view | ⚠️ Partial |

---

## 4. BILLING & PROFORMA

### Proforma Lifecycle — CRITICAL GAP

**Plan defines proforma as a distinct entity with its own lifecycle:**
```
Draft → Approved → Converted → Expired
```

**Code reality:**
- Proforma is stored as `invoice_type = "proforma"` inside `pending_invoices`
- `pending_invoices.status` = `pending | partial | paid | overdue | void` — these are **payment** statuses, not **proforma** statuses
- There is **no Draft, Approved, Converted, Expired status** for a proforma
- Convert button exists (changes type to `ad_hoc`) but there's no approval step, no expiry date, no Draft state
- A proforma that a counsellor creates goes directly to "pending" — it bypasses the Draft→Approved workflow the plan requires

**Impact:** Counsellors can create proformas that are never reviewed/approved by a manager. Finance has no visibility on pending proformas vs approved ones.

---

### Billing Gaps

| Plan Requirement | Code Reality | Gap |
|---|---|---|
| 3 revenue categories: Service (immediate), Package (per session), Retail (immediate) | ✅ invoice_type separates these | ✅ Done |
| Per-session revenue recognition reporting for packages | ❌ Package billing creates service credits, but no report shows "revenue recognized per session consumed" | ❌ Missing |
| **Counsellor permission: cannot collect payment or close invoice** | ❌ No role-based guard in billing page. A counsellor can open billing and record payment | ❌ Missing — security gap |
| Partial payments | ✅ Implemented | ✅ Done |
| Wallet payments | ✅ Implemented | ✅ Done |
| GST billing | ✅ Implemented | ✅ Done |
| Package freeze / unfreeze | ❌ Not implemented | ❌ Missing |
| Package transfer (patient A → patient B) | ⚠️ `service_transfers` table exists but no UI to transfer between patients | ⚠️ Partial |
| Refund workflow with stages | ⚠️ `service_refunds` table exists but refund UI is incomplete | ⚠️ Partial |
| PDF invoice download | ✅ Print/PDF via browser print | ✅ Done |

---

## 5. CRM PIPELINE

### Pipeline Stage Mismatch

**Plan defines 7 stages:**
```
New Lead → Contacted → Interested → Appointment Booked → Visited → Converted → Lost
```

**Code has 6 stages:**
```
new → contacted → interested → converted → lost → junk
```

**Gaps:**

| Plan Stage | Code Stage | Gap |
|---|---|---|
| New Lead | `new` | ✅ Match |
| Contacted | `contacted` | ✅ Match |
| Interested | `interested` | ✅ Match |
| **Appointment Booked** | ❌ Missing | **MISSING** — when CRM books an appointment, lead stage doesn't automatically update to "Appointment Booked" |
| **Visited** | ❌ Missing | **MISSING** — no "patient came in" confirmation stage |
| Converted | `converted` | ✅ Match |
| Lost | `lost` | ✅ Match |
| — | `junk` | In code but not in plan |

### CRM Feature Gaps

| Plan Requirement | Code Reality | Gap |
|---|---|---|
| CRM + Appointment sync — booking from CRM instantly updates clinic calendar | ❌ CRM lead has no "Book Appointment" button that creates a real scheduler appointment | ❌ Missing |
| Lead source: Meta Ads, Google Ads, Website, WhatsApp, Walk-in | ✅ Sources captured | ✅ Done |
| Activity tracking on every lead action | ⚠️ Basic log exists but no per-lead activity timeline visible in UI | ⚠️ Partial |
| Counsellor dashboard: Patients referred / Pending conversions / Follow-ups | ❌ The counselling page has sessions, not a conversion-focused counsellor dashboard | ❌ Missing |
| Win-back pipeline (lapsed patients) | ❌ Referenced in code comments but not implemented as a distinct pipeline | ❌ Missing |

---

## 6. COUNSELLING MODULE

| Plan Requirement | Code Reality | Gap |
|---|---|---|
| Doctor sends patient to counsellor from consultation | ❌ No "Send to Counsellor" action exists inside a patient consultation. Doctor must manually tell counsellor. | ❌ Missing — this breaks the workflow chain |
| Counsellor pipeline: Consultation Done → Counsellor explains → Proforma → Patient decides | ⚠️ Counselling sessions page exists with conversion_status, but the pipeline stages do not match the plan's flow | ⚠️ Partial |
| Proforma generated from counselling session | ✅ Counselling → Convert to Invoice (M7 implemented) | ✅ Done |
| Counsellor dashboard: Pending conversions, follow-ups due, referred by doctors | ❌ No dedicated counsellor dashboard view | ❌ Missing |
| Counsellor cannot collect payment or close invoice | ❌ Role-based billing restriction not enforced | ❌ Missing |
| Follow-up scheduling from counselling | ⚠️ `followup_date` field exists in DB but no UI to schedule a follow-up appointment | ⚠️ Partial |

---

## 7. ROLES & PERMISSIONS

### Role Mismatch

**Plan defines 10 roles:**
```
Superadmin | Organization Admin | Chain Admin | Clinic Admin | Doctor
Counsellor | Reception | Marketing | Inventory Manager | Finance Manager
```

**Code has 7 roles (hardcoded enum):**
```
superadmin | chain_admin | clinic_admin | doctor | therapist | counsellor | front_desk
```

**Specific gaps:**

| Plan Role | Code Role | Gap |
|---|---|---|
| Superadmin | `superadmin` | ✅ Match |
| **Organization Admin** | ❌ No `organization_admin` role | **MISSING** — no organizations layer exists at all |
| Chain Admin | `chain_admin` | ✅ Match |
| Clinic Admin | `clinic_admin` | ✅ Match |
| Doctor | `doctor` | ✅ Match |
| Counsellor | `counsellor` | ✅ Match |
| **Reception** | `front_desk` | ⚠️ Name mismatch — functionally same but inconsistent with plan |
| **Marketing** | ❌ Missing | **MISSING** |
| **Inventory Manager** | ❌ Missing | **MISSING** |
| **Finance Manager** | ❌ Missing | **MISSING** |
| — | `therapist` | In code but not in plan |

### Permission Gaps

| Plan Requirement | Code Reality | Gap |
|---|---|---|
| Per-module permissions: View / Create / Edit / Delete / Approve / Export | ⚠️ `user_permissions` table has boolean flags per action type but not cleanly mapped to all modules | ⚠️ Partial |
| Create roles from Superadmin UI | ❌ Roles are a hardcoded TypeScript enum — no UI to create new roles | ❌ Missing |
| Edit permissions from Superadmin UI | ⚠️ `user_permissions` table exists and is editable in god-mode but limited to 13 hardcoded fields | ⚠️ Partial |

---

## 8. SUPERADMIN / GOD MODE

| Plan Requirement | Code Reality | Gap |
|---|---|---|
| Create organization from UI | ❌ No organizations concept exists | ❌ Missing |
| Create chain from UI | ❌ Chains created only via DB seed / demo — no Superadmin UI for it | ❌ Missing |
| Create clinic from UI | ⚠️ Demo clinic creation exists (`/api/admin/demo/create`) but no real "New Clinic" UI for production use | ⚠️ Partial |
| Suspend / unsuspend clinic | ✅ subscription_status management in God Mode | ✅ Done |
| Change subscription plan | ✅ God Mode tab 1 | ✅ Done |
| Enable / disable modules per clinic | ✅ God Mode clinic_modules toggles | ✅ Done |
| Feature flags with global kill switch | ✅ `module_registry.is_globally_killed` | ✅ Done |
| Create roles from UI | ❌ Not possible — roles are enum | ❌ Missing |
| Edit invoice formats (template editor) | ❌ Not implemented | ❌ Missing |
| Manage plugins from UI | ✅ `/admin/plugins` page exists | ✅ Done |
| Manage integrations | ✅ Settings → Integrations tab | ✅ Done |
| Navigation Manager (configure what's in the menu) | ❌ Not implemented | ❌ Missing |

---

## 9. DATABASE — MISSING TABLES

| Plan Requires | In Code? | Gap Detail |
|---|---|---|
| `organizations` | ❌ Missing | Plan's top-level entity. Hierarchy is Org→Chain→Clinic. Code only has Chain→Clinic. |
| `treatment_rooms` | ❌ Missing | Room is a free-text field. No rooms as managed entities with capacity, equipment, etc. |
| `doctor_schedules` / `staff_availability` | ❌ Missing | No table for doctor working hours, break times, leave blocks per schedule |
| `consultations` | ❌ Missing | Plan treats consultation as a separate entity from SOAP notes. Code merges everything into `clinical_encounters` |
| `patient_tags` | ❌ Missing | No custom tagging system (VIP, Influencer, etc.) |
| `command_usage_log` | ❌ Missing | Plan explicitly requires logging command bar usage per user |
| `proforma_status_log` | ❌ Missing | Proforma lifecycle (Draft→Approved→Converted→Expired) has no status tracking |
| `appointment_type_colors` | ❌ Missing | No table for appointment type definitions with associated colors |
| **Plan calls it `package_sessions`** | Code uses `patient_service_credits` | Name mismatch — functionally equivalent but inconsistent with plan terminology |
| **Plan calls it `invoices` / `invoice_items`** | Code uses `pending_invoices` / `invoice_line_items` | Name mismatch — "pending" implies a state, plan uses neutral name |

---

## 10. COMMAND BAR (Cmd+K)

**Plan dedicates an entire section to this feature. Current state: 10% implemented.**

| Plan Requirement | Code Reality | Gap |
|---|---|---|
| Cmd+K / Ctrl+K trigger | ❌ Not implemented as keyboard shortcut | ❌ Missing |
| Center modal overlay | ❌ `GlobalSearchPalette.tsx` exists but is triggered by clicking a search icon, not Cmd+K | ⚠️ Partial |
| Navigation commands (Go to Patients, Scheduler, etc.) | ❌ Search palette only searches records, doesn't navigate to modules | ❌ Missing |
| Create commands (Create Patient, Appointment, Invoice, Lead) | ❌ Search palette is read-only — no create actions | ❌ Missing |
| Search across Patients + Appointments + Invoices + Staff + Products | ⚠️ Search palette queries patients, appointments, invoices — but not staff or products | ⚠️ Partial |
| Context-aware commands (inside patient profile: show patient-specific actions) | ❌ Not implemented | ❌ Missing |
| Role-based command visibility | ❌ Not implemented | ❌ Missing |
| Recent activity section below commands | ❌ Not implemented | ❌ Missing |
| Arrow key navigation + Enter to select + Esc to close | ❌ Not implemented in search palette | ❌ Missing |
| `command_usage_log` DB table | ❌ Missing | ❌ Missing |
| Opens in <100ms | ❌ Can't verify — palette requires DB query | ❌ Unknown |
| Mobile version as top search | ❌ Not implemented | ❌ Missing |

---

## 11. INVENTORY

| Plan Requirement | Code Reality | Gap |
|---|---|---|
| Track consumables, retail, devices | ✅ `inventory_products` with categories | ✅ Done |
| Stock movements: Purchase, Sale, Consumption, Transfer, Adjustment | ✅ `inventory_movements` table with movement types | ✅ Done |
| Low stock alerts | ✅ Alerts on dashboard and inventory page | ✅ Done |
| Purchase orders | ✅ `inventory_purchase_orders` table + UI (GAP-59) | ✅ Done |
| Vendor management | ⚠️ Vendors referenced but no dedicated Vendor management page | ⚠️ Partial |
| **Consumable deduction on service session** (when service performed, consumable stock auto-deducts) | ❌ `service_consumables` table exists (GAP-22) but automatic deduction on appointment completion is not wired | ❌ Missing — the link between completing an appointment and deducting consumable stock is broken |

---

## 12. REPORTING & ANALYTICS

| Plan Requirement | Code Reality | Gap |
|---|---|---|
| Revenue reports | ✅ `/admin/reports` with revenue charts | ✅ Done |
| Doctor performance reports | ✅ Provider performance in reports library | ✅ Done |
| Counsellor conversion rate report | ⚠️ Counselling stats exist but no dedicated conversion funnel report | ⚠️ Partial |
| Inventory usage reports | ⚠️ Basic inventory report exists | ⚠️ Partial |
| Target tracking (Service / Package / Retail targets separately) | ✅ `monthly_service_target` + `monthly_product_target` on clinics table, shown on dashboard | ✅ Done |
| Category-specific targets with progress bars | ⚠️ Dashboard shows combined target — not broken out per category with separate progress | ⚠️ Partial |

---

## 13. BROKEN LOGIC FLOWS

These are workflow-level gaps where the logic chain breaks mid-operation:

### 🔴 FLOW-1: Doctor → Counsellor Handoff
**Plan:** Doctor completes consultation → clicks "Send to Counsellor" → patient appears in counsellor's pending list
**Code:** No such button exists. Doctor writes SOAP notes. Counsellor must independently find the patient. The connection is manual and untracked.

### 🔴 FLOW-2: Proforma Lifecycle
**Plan:** Counsellor creates Draft proforma → Manager approves → Patient accepts → Convert to Invoice → Proforma expires if not converted in X days
**Code:** Counsellor creates a `proforma` invoice_type record → it stays as `pending` status forever → clicking "Convert" changes invoice_type to `ad_hoc`. No Draft state, no approval step, no expiry, no audit trail on conversion.

### 🔴 FLOW-3: CRM Lead → Appointment → Attended → Converted
**Plan:** Lead moves through Appointment Booked → Visited → Converted stages automatically when clinic interactions happen
**Code:** Lead stage is manually updated by dragging in Kanban. No automatic stage transition when appointment is booked from CRM, or when patient checks in, or when invoice is raised.

### 🔴 FLOW-4: Appointment → Treatment Room Handoff
**Plan:** Patient: Checked-in → Consultation Done → Moves to treatment room → Treatment Done → Completed
**Code:** Statuses skip from `arrived` (Checked-in) directly to `in_session` (no distinction between consultation and treatment). No room assignment workflow. No handoff between doctor and therapist in the scheduler.

### 🔴 FLOW-5: Service Consumed → Inventory Deducted
**Plan:** When a service session is marked complete, linked consumables auto-deduct from stock
**Code:** `service_consumables` table defines what a service uses, but marking an appointment as `completed` does NOT trigger any inventory deduction. The tables exist but the trigger/link is missing.

### 🔴 FLOW-6: Counsellor Billing Restriction
**Plan:** Counsellor cannot collect payment or close invoices
**Code:** Role check on the billing page only prevents access via the feature gate. A counsellor with direct URL access to `/billing` can create and record payments. No row-level or server-side enforcement.

---

## 14. PRIORITY RANKING FOR EXECUTION

Based on clinical workflow impact:

### P0 — Breaks Real Clinic Operations
1. **Proforma lifecycle** (Draft/Approved/Converted/Expired) — counsellors are creating proformas with no approval chain
2. **Appointment statuses** — add `consultation_done` and `treatment_done` to distinguish workflow stages
3. **Doctor → Counsellor handoff button** — the revenue-critical step has no UI wire
4. **CRM → Appointment sync** — "Appointment Booked" stage + auto-update when appointment created
5. **Counsellor billing restriction** — server-side guard needed

### P1 — Missing Core Features
6. **Room View in scheduler** — treatment rooms as entities + Room View column layout
7. **Patient side drawer** — from scheduler and CRM without leaving current screen
8. **Walk-in button** with auto-slot assignment
9. **Patient Consultation tab** (dedicated, separate from SOAP/EMR)
10. **Patient Counselling tab** inside patient profile
11. **Consumable auto-deduction** on session completion

### P2 — UX & Navigation
12. **Command Bar** (Cmd+K) with create actions + navigation
13. **Doctor availability schedule** configuration
14. **Leave blocks calendar** in scheduler
15. **Apps menu** module grid in top bar
16. **Patient tags** (user-defined)
17. **Patient blacklist**
18. **Patient merge**

### P3 — Architecture Decisions Needed Before Building
19. **Color theme conflict** — must decide: Gold/Linen (current CLAUDE.md) vs Navy/White (MASTER_PLAN). Cannot do both.
20. **Organizations layer** — adding org above chain requires schema migration + RLS changes across all tables
21. **New roles** (Marketing, Inventory Manager, Finance Manager) — requires enum migration
22. **`consultations` as separate table** vs merged into `clinical_encounters` — architectural decision

---

## 15. WHAT IS FULLY CORRECT ✅

These are implemented exactly as the MASTER_PLAN describes:
- Multi-tenant clinic isolation (chain→clinic hierarchy, RLS scoping)
- Feature flag system (`check_clinic_access` RPC with kill switch, plan entitlement, module toggle)
- Membership system with wallet
- Loyalty points engine
- Package billing with service credits
- Before/after photo gallery with pair linking
- Intake form (patient-facing digital form)
- Notification bell (real-time)
- Audit logging with demo suppression
- Workflow designer (rule engine with 50 templates)
- Staff HR (attendance, leaves, payroll)
- God Mode for superadmin (module toggles, kill switches, plan management)
- Discount approval OTP flow
- GST billing with invoice number auto-generation
- Referral program
- Integration simulator (Razorpay, Meta, Google, WhatsApp)
- Retry logic on critical mutations

---

*This analysis is based on the `staging` branch as of 2026-03-07. Code files checked: `app/scheduler/page.tsx`, `app/billing/page.tsx`, `app/crm/page.tsx`, `app/patients/[id]/page.tsx`, `components/patient/tabs/*`, `components/GlobalSearchPalette.tsx`, `components/Sidebar.tsx`, `components/TopBar.tsx`, `app/counselling/page.tsx`, `app/admin/god-mode/page.tsx`, plus all API routes under `app/api/`.*
