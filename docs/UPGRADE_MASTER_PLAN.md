# Aesthetica ERP — Complete Build-From-Scratch Upgrade Plan
**Version 3.0 | Ground-Up Redesign | Staging-First | No AI, No Mobile App**

> This document supersedes all previous versions. Treat every module, every screen,
> every data flow, and every UI pattern as a fresh build. Existing code is reference only.

---

## SECTION 0 — CRITICAL BUGS TO FIX FIRST (before any new feature)

These are broken flows found in the audit that must be patched before Phase A starts.

| # | Bug | Module | Fix |
|---|-----|--------|-----|
| B1 | `inventory_items` → should be `inventory_products` in Reports TABLE_MAP | Reports | Change string in page.tsx |
| B2 | Form Builder "Copy Link" generates `/intake/[clinicId]?form=[id]` but intake page ignores `form` param | Forms + Intake | Wire param → dynamic form renderer |
| B3 | Intake page has hardcoded fields, does NOT use `form_definitions` | Intake | Replace hardcoded form with dynamic renderer |
| B4 | `wallet_balance` updated by direct UPDATE across 4 modules → race condition | Billing, Membership, Scheduler, Credits | All wallet writes must go through `debit_wallet()` / `credit_wallet()` RPC |
| B5 | Commission created on appointment complete but NOT reversed on cancellation | Scheduler | Add reversal logic on status → cancelled/no_show |
| B6 | Sidebar links to non-existent pages: `/admin/users`, `/admin/analytics`, `/admin/audit`, `/admin/permissions`, `/settings/team/permissions`, `/admin/manage` | Sidebar | Remove or build stub pages |
| B7 | Service deletion does not cascade → orphaned `service_id` in counselling JSON | Services | Add client-side warning + soft-delete flag |
| B8 | `mark_overdue_invoices()` only runs on page load → invoices not auto-marked | Billing | Move to DB scheduled trigger (pg_cron or rule) |
| B9 | Multi-line invoice insert is NOT atomic → partial invoices possible | Billing | Wrap in single RPC call |
| B10 | `before_after_photos` in counselling has no `clinic_id` filter → data leak risk | Counselling | Add `.eq("clinic_id", clinicId)` filter |

---

## SECTION 1 — DESIGN SYSTEM (Mangomint DNA + Aesthetica Gold)

### 1.1 Color Tokens

```css
/* Global CSS variables — applied in globals.css */

/* Core palette */
--gold:           #C5A059;
--gold-light:     rgba(197, 160, 89, 0.08);
--gold-medium:    rgba(197, 160, 89, 0.18);
--gold-border:    rgba(197, 160, 89, 0.2);
--gold-hover:     rgba(197, 160, 89, 0.12);

/* Surfaces */
--bg-base:        #F9F7F2;   /* page background — warm linen */
--bg-surface:     #FFFFFF;   /* cards, panels, modals */
--bg-elevated:    #FDFCFA;   /* dropdowns, tooltips */
--bg-subtle:      #F4F2ED;   /* section dividers, muted areas */

/* Sidebar (dark) */
--sidebar-bg:     #1A1612;   /* near-black warm */
--sidebar-text:   #E8E2D4;
--sidebar-muted:  rgba(232, 226, 212, 0.4);
--sidebar-active: rgba(197, 160, 89, 0.18);
--sidebar-border: rgba(197, 160, 89, 0.15);

/* Typography */
--text-primary:   #1C1917;   /* almost-black, warm */
--text-secondary: #6B7280;   /* labels, meta */
--text-muted:     #9CA3AF;   /* placeholders, disabled */
--text-gold:      #A8853A;   /* gold text on light bg */

/* Semantic */
--success:        #059669;
--success-bg:     rgba(5, 150, 105, 0.08);
--success-border: rgba(5, 150, 105, 0.2);
--warning:        #D97706;
--warning-bg:     rgba(217, 119, 6, 0.08);
--warning-border: rgba(217, 119, 6, 0.2);
--error:          #DC2626;
--error-bg:       rgba(220, 38, 38, 0.06);
--error-border:   rgba(220, 38, 38, 0.18);
--info:           #3B82F6;
--info-bg:        rgba(59, 130, 246, 0.08);
--info-border:    rgba(59, 130, 246, 0.2);

/* Borders & Shadows */
--border:         rgba(0, 0, 0, 0.08);
--border-focus:   var(--gold);
--shadow-sm:      0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
--shadow-md:      0 4px 12px rgba(0,0,0,0.08);
--shadow-lg:      0 8px 24px rgba(0,0,0,0.1);
--shadow-gold:    0 0 0 3px rgba(197,160,89,0.15);

/* Radius */
--radius-sm:  6px;
--radius-md:  10px;
--radius-lg:  14px;
--radius-xl:  20px;
--radius-pill: 999px;

/* Typography */
--font-sans:  -apple-system, 'Inter', 'Segoe UI', sans-serif;
--font-serif: Georgia, 'Times New Roman', serif;
--font-mono:  'JetBrains Mono', 'Fira Code', monospace;
```

### 1.2 Typography Scale

```
Display (patient names, totals, KPI numbers):
  font-family: var(--font-serif)
  sizes: 32px / 24px / 20px
  weight: 700

Heading (section titles, drawer titles):
  font-family: var(--font-sans)
  sizes: 18px / 16px / 14px
  weight: 600

Label (field labels, nav items, table headers):
  font-family: var(--font-sans)
  size: 11px, uppercase, letter-spacing: 0.08em
  weight: 700
  color: var(--text-secondary)

Body (paragraph text, descriptions):
  font-family: var(--font-sans)
  size: 14px / 13px
  weight: 400
  line-height: 1.6

Caption (timestamps, metadata, badges):
  font-family: var(--font-sans)
  size: 11px / 12px
  weight: 500
```

### 1.3 Component Library

**BUTTON**
```
Primary:     bg=var(--gold), color=white, radius=8px, height=36px, px=16px, fw=600
Secondary:   bg=white, border=var(--gold-border), color=var(--gold), radius=8px
Ghost:       bg=transparent, color=var(--text-secondary), hover=var(--bg-subtle)
Danger:      bg=white, border=var(--error-border), color=var(--error) — hover=var(--error-bg)
Icon-only:   36×36px, radius=8px, bg=var(--bg-subtle) on hover
Loading:     replace label with spinner, keep button width fixed
Disabled:    opacity=0.5, cursor=not-allowed

Sizes: sm=28px, md=36px, lg=44px
```

**INPUT / SELECT / TEXTAREA**
```
Height: 40px (input/select), auto (textarea min-height 96px)
Border: 1px solid var(--border)
Radius: var(--radius-sm)
Focus: border-color=var(--gold), box-shadow=var(--shadow-gold)
Error: border-color=var(--error), helper text in var(--error)
Label: always above, 11px uppercase, var(--text-secondary)
Placeholder: var(--text-muted)
Padding: 10px 12px
```

**CARD**
```
Background: var(--bg-surface)
Border: 1px solid var(--gold-border)
Radius: var(--radius-lg)
Shadow: var(--shadow-sm)
Padding: 20px
Title style: 11px uppercase tracking-wide var(--text-secondary) + 4px bottom margin
Hover (clickable cards): shadow=var(--shadow-md), border-color=rgba(197,160,89,0.35)
```

**TABLE / LIST ROW**
```
Row height: 52px (comfortable, touch-friendly)
No zebra stripes — hover tint: var(--gold-light)
Actions: appear on row hover only (opacity 0 → 1)
Sticky header: background var(--bg-surface), border-bottom var(--border)
Selected row: var(--gold-medium) bg, var(--gold) left border 3px
Empty state: centered, 48px icon, headline, description, primary CTA button
```

**BADGE / PILL**
```
Radius: var(--radius-pill)
Font: 11px, 600 weight, uppercase, letter-spacing 0.06em
Padding: 2px 8px
Colors mapped to status:
  active/paid/confirmed/approved → var(--success) palette
  pending/draft/proposed → var(--warning) palette
  cancelled/void/failed/rejected → var(--error) palette
  transferred/partial → var(--gold) palette
  info/scheduled → var(--info) palette
```

**DRAWER (right-side panel — use instead of modal for all forms)**
```
Width: 520px desktop, 100% mobile
Entry: slide in from right, 250ms ease-out
Exit: slide out to right, 200ms ease-in
Overlay: rgba(0,0,0,0.3) behind
Header: 20px padding, title 18px 600, subtitle 13px muted, close X top-right
Body: scrollable, 24px padding
Footer: sticky bottom, 16px padding, flex gap-3 right-aligned
  Primary action left, Cancel right (Mangomint pattern)
```

**MODAL (only for confirmations / 2-action dialogs)**
```
Max-width: 440px, centered, radius=var(--radius-xl)
Overlay: rgba(0,0,0,0.4)
Content: 28px padding
Confirm (destructive): red button + cancel
Confirm (neutral): gold button + cancel
```

**TAB BAR**
```
Style: underline (not pill)
Active: var(--gold) 2px bottom border, var(--gold) text, 600 weight
Inactive: var(--text-secondary), hover var(--text-primary)
Gap between tabs: 24px
Font: 14px, 500 weight
Count badge: small pill after label (appointments: "3")
```

**SKELETON LOADER (no spinners for page sections)**
```
Animated shimmer: linear-gradient sliding right
Color: rgba(0,0,0,0.06) base, rgba(0,0,0,0.10) highlight
Use for: table rows, cards, chart areas
Show after 300ms delay (prevents flash on fast loads)
```

**NOTIFICATION / TOAST**
```
Position: bottom-right
Types: success (green check), error (red X), info (blue i), warning (amber !)
Duration: 3s success, 5s error
Max width: 360px
Don't stack more than 3
Use sparingly — only for async results, not form validation
```

### 1.4 Page Layout Pattern

```
Every page follows this exact structure:

┌──────────────────────────────────────────────────────┐
│  TopBar (fixed, h=56px)                              │
│  breadcrumb ··· [page actions]                       │
├──────────────────────────────────────────────────────┤
│  Page Header (24px padding-top)                      │
│  h1 title (20px serif 700) + subtitle (13px muted)  │
│  [filter chips] [search] [primary CTA] right-aligned │
├──────────────────────────────────────────────────────┤
│  Content Area (max-width 1280px, centered, px=24px)  │
│                                                      │
│  Tab Bar (if tabbed page)                            │
│  ──────────────────────────────────────────────────  │
│  Tab Content                                         │
└──────────────────────────────────────────────────────┘

NEVER use full-page loading spinners.
Use skeleton screens per section.
All async loads must show content within 400ms or skeleton.
```

### 1.5 Keyboard Shortcuts (global)

```
N     → New Patient (opens new patient drawer)
B     → New Booking (opens booking drawer)
I     → New Invoice (opens invoice drawer)
/     → Global search focus
Esc   → Close open drawer or modal
↑ ↓   → Navigate list rows (when list is focused)
Enter → Open selected row
Ctrl+S (or Cmd+S) → Save current form
```

### 1.6 Sidebar Redesign (Mangomint-Inspired)

```
Width: 220px (collapsed: 60px icon-only, toggle with ← button)
Background: var(--sidebar-bg)

Structure:
┌──────────────────────┐
│ Logo (28px)          │  ← Aesthetica wordmark + Sparkles icon
│ Clinic name (12px)   │
├──────────────────────┤
│ [user avatar]        │  ← initials avatar + name + role + tier badge
│ [notification bell]  │  ← count badge for unread alerts
├──────────────────────┤
│ CLINIC               │  ← section label 9px uppercase
│ • Overview           │
│ • Patients           │
│ • Scheduler          │  ← badge: today's count
│ • Billing            │  ← badge: pending count
│ • Services           │
│ • Memberships        │
│ • Counselling        │
│ • CRM & Leads        │  ← badge: new leads count
│ • Inventory          │  ← badge: low-stock count
│ • Gallery            │
│ • Staff HR           │
├──────────────────────┤
│ ADMIN                │  ← section label, only for clinic_admin+
│ • Payroll            │
│ • Reports            │
│ • Form Builder       │
│ • Rule Builder       │
│ • Webhooks           │
│ • Plugins            │
├──────────────────────┤
│ SUPERADMIN           │  ← section label, only for superadmin
│ ✦ God Mode           │  ← gold glow, crown icon
├──────────────────────┤
│ ⚙ Settings           │  ← bottom pinned
│ ◄ Collapse           │  ← collapse toggle
└──────────────────────┘

Active item:
  - 3px gold left border
  - Gold tint background (var(--sidebar-active))
  - Gold icon + white text

Live badges (Realtime updates):
  - Scheduler: today's unconfirmed appointment count
  - Billing: pending invoices count
  - CRM: new leads today count
  - Inventory: low-stock product count
```

---

## SECTION 2 — COMPLETE MODULE SYNCHRONIZATION MAP

### 2.1 Single Source of Truth: The Patient Record

Every module writes TO or reads FROM `patients`. This is the anchor.

```
patients
  │
  ├── appointments ─────────────── (patient_id FK)
  │     └── credit_consumption_log (appointment_id FK)
  │     └── staff_commissions      (appointment_id FK)
  │     └── appointment_risk_scores (appointment_id FK)    [NEW]
  │     └── recall_tasks            (appointment_id FK)    [NEW]
  │
  ├── pending_invoices ──────────── (patient_id FK)
  │     └── invoice_line_items      (invoice_id FK)
  │     └── invoice_payments        (invoice_id FK)
  │
  ├── patient_service_credits ───── (patient_id FK)
  │     └── credit_consumption_log  (credit_id FK)
  │     └── service_refunds         (credit_id FK)
  │     └── service_transfers       (credit_id FK)
  │     └── package_members         (credit_id FK)
  │
  ├── wallet_transactions ────────── (patient_id FK)
  ├── loyalty_points_ledger ──────── (patient_id FK)       [NEW]
  ├── patient_memberships ──────────  (patient_id FK)
  ├── patient_sticky_notes ────────── (patient_id FK)
  ├── patient_face_charts ─────────── (patient_id FK)
  ├── patient_communications ──────── (patient_id FK)
  ├── clinical_encounters ─────────── (patient_id FK)
  │     └── encounter_injectables     (encounter_id FK)    [NEW]
  │     └── prescriptions             (encounter_id FK)
  ├── patient_notes ───────────────── (patient_id FK)
  ├── patient_treatments ──────────── (patient_id FK)
  ├── patient_medical_history ──────── (patient_id FK)
  ├── patient_packages ─────────────── (patient_id FK)
  ├── counselling_sessions ─────────── (patient_id FK)
  ├── patient_feedback ─────────────── (patient_id FK)    [NEW]
  ├── nps_surveys ──────────────────── (patient_id FK)    [NEW]
  ├── recall_tasks ─────────────────── (patient_id FK)    [NEW]
  ├── referral_codes ───────────────── (patient_id FK)    [NEW]
  ├── whatsapp_conversations ───────── (patient_id FK)    [NEW]
  └── patient_portal_sessions ──────── (patient_id FK)    [NEW]
```

### 2.2 Cross-Module Event Chain (Complete)

Every action in one module that triggers another module is listed here.

```
TRIGGER                           → EFFECTS (in order)

appointment.status → completed
  → create recall_task            (Automation / Rule Engine)
  → schedule post_visit_thank_you  (Automation, T+4h)
  → schedule checkin_48h           (Automation, T+48h)
  → credit loyalty_points          (Loyalty, amount × rate)
  → check tier upgrade             (Loyalty)
  → check if 3rd visit → referral nudge (Automation)
  → if backbar products mapped → deduct inventory (Inventory)
  → if commission rule → create staff_commissions (Payroll chain)

appointment.status → no_show
  → if deposit held → charge no_show_fee (Billing)
  → increment patient.no_show_count (Patient Record)
  → schedule rebook_offer WhatsApp  (Automation, T+1h)
  → REVERSE any commission created for this appointment (Payroll)

invoice.status → paid
  → if line_item type = service_credit → create patient_service_credits
  → if line_item type = membership → create patient_memberships + activate benefits
  → if payment_mode = wallet → debit_wallet() RPC (atomic)
  → credit loyalty_points (amount_paid × rate)
  → send WhatsApp receipt
  → fire post-visit automation rules

patient_memberships.status → active (new activation)
  → if plan.benefits includes wallet_credit → credit_wallet() RPC
  → if plan.benefits includes service_sessions → create patient_service_credits
  → send WhatsApp welcome message (Automation)

patient_memberships → auto_renew → charge attempt
  → success → new patient_memberships row, extend expires_at
  → failure → start dunning sequence (Automation, Day 0/2/5/7)

patient_service_credits → consumed (used_sessions = total_sessions)
  → status → exhausted
  → send WhatsApp expiry notification (Automation)

patient_service_credits.expires_at → 7 days away
  → send WhatsApp expiry warning (Rule: daily scheduled)
  → staff_task created for follow-up

loyalty_points_ledger → balance crosses tier threshold
  → update patient.loyalty_tier
  → send WhatsApp tier_upgrade message (Automation)

counselling_session → accepted treatment
  → create patient_treatments row (status=proposed)
  → appear in patient Treatments tab

crm_lead.status → converted
  → create patients row (from lead data)
  → update lead.patient_id
  → enroll in new_patient_welcome drip sequence (Automation)
  → if referral_code linked → credit referrer wallet/points

recall_task.recall_date = TODAY
  → send recall WhatsApp (Rule: daily scheduled)
  → recall_task.status → sent

patient_feedback.rating >= 4
  → send review_request WhatsApp (T+1h) (Automation)

patient_feedback.rating <= 3
  → create staff_task: follow up with patient (Automation)
  → notify clinic_admin in-app

inventory_product.current_stock <= low_stock_threshold
  → alert clinic_admin (Automation)
  → create draft purchase_order (Automation)

staff_attendance.clock_out
  → hours_worked auto-calculated (DB generated column)
  → if hours > shift_hours → flag overtime

patient.date_of_birth.month+day = TODAY (daily rule)
  → send birthday WhatsApp + discount code

patient.last_visit_at < NOW() - 90 days (daily rule)
  → send win_back WhatsApp (first time only, 60-day cooldown)
```

### 2.3 Shared Tables — Write Access Control

Tables written by multiple modules need strict access rules.

| Table | Writers | Protection |
|-------|---------|------------|
| `patients.wallet_balance` | Billing, Membership, Credits, Scheduler | **ONLY via `credit_wallet()` / `debit_wallet()` RPC. Direct UPDATE forbidden.** |
| `staff_commissions` | Scheduler, Billing | Check for duplicate before insert: `(appointment_id, provider_id)` UNIQUE constraint |
| `patient_service_credits` | Billing (create), Credits (status), Scheduler (consume) | Status transitions via RPC only |
| `pending_invoices` | Billing, Inventory (sale), Scheduler | Each module sets context metadata (source field) |
| `audit_logs` | All modules | Append-only, no UPDATE/DELETE |

### 2.4 Enum Standardization (Fix All Status Conflicts)

All status enums across modules are standardized here.

```sql
-- appointments.status
CHECK (status IN ('scheduled','confirmed','arrived','in_session','completed','cancelled','no_show'))

-- pending_invoices.status
CHECK (status IN ('draft','pending','partial','paid','overdue','void'))
-- 'draft' = saved but not sent; 'pending' = awaiting payment; auto-transition via rule

-- patient_service_credits.status
CHECK (status IN ('active','paused','exhausted','expired','transferred','refunded','cancelled'))
-- 'exhausted' = all sessions used; 'expired' = expires_at < NOW()

-- patient_memberships.status
CHECK (status IN ('active','paused','expired','cancelled'))
-- 'paused' = frozen; 'expired' = auto-marked by rule

-- counselling_sessions.conversion_status
CHECK (conversion_status IN ('pending','partial','converted','declined','no_show'))

-- crm_leads.status
CHECK (status IN ('new','contacted','interested','qualified','booked','converted','lost','junk'))
-- 'qualified' = confirmed genuine interest; 'booked' = consultation scheduled

-- staff_leaves.status
CHECK (status IN ('pending','approved','rejected','cancelled'))

-- payroll_runs.status
CHECK (status IN ('draft','processing','approved','paid','cancelled'))

-- purchase_orders.status  [NEW]
CHECK (status IN ('draft','sent','confirmed','partially_received','received','invoiced','cancelled'))

-- recall_tasks.status  [NEW]
CHECK (status IN ('pending','sent','booked','dismissed','expired'))

-- patient_feedback.source  [NEW]
CHECK (source IN ('post_visit','nps_survey','manual','portal'))
```

---

## SECTION 3 — COMPLETE DATABASE SCHEMA (All Tables, Old + New)

### 3.1 Tables to CREATE (new in this upgrade)

```sql
-- ─── SCHEDULER ─────────────────────────────────────────────────────────────

CREATE TABLE scheduler_waitlist (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id             uuid REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id            uuid REFERENCES patients(id) ON DELETE CASCADE,
  service_id            uuid REFERENCES services(id),
  preferred_provider_id uuid REFERENCES profiles(id),
  requested_date        date NOT NULL,
  time_preference       text CHECK (time_preference IN ('morning','afternoon','evening','any')),
  notified_at           timestamptz,
  notified_count        int DEFAULT 0,
  status                text DEFAULT 'waiting'
    CHECK (status IN ('waiting','offered','booked','expired','cancelled')),
  offered_slot          timestamptz,
  offer_expires_at      timestamptz,
  created_at            timestamptz DEFAULT now()
);
CREATE INDEX ON scheduler_waitlist (clinic_id, requested_date, status);

CREATE TABLE appointment_risk_scores (
  appointment_id   uuid PRIMARY KEY REFERENCES appointments(id) ON DELETE CASCADE,
  score            int NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  factors          jsonb DEFAULT '{}',
  requires_deposit boolean DEFAULT false,
  deposit_amount   numeric DEFAULT 0,
  calculated_at    timestamptz DEFAULT now()
);

CREATE TABLE recall_tasks (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id      uuid REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id     uuid REFERENCES patients(id) ON DELETE CASCADE,
  service_id     uuid REFERENCES services(id),
  appointment_id uuid REFERENCES appointments(id),
  recall_date    date NOT NULL,
  rule_id        uuid,
  sent_at        timestamptz,
  booked_at      timestamptz,
  status         text DEFAULT 'pending'
    CHECK (status IN ('pending','sent','booked','dismissed','expired')),
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX ON recall_tasks (clinic_id, recall_date, status);
CREATE INDEX ON recall_tasks (patient_id, status);

-- ─── LOYALTY ────────────────────────────────────────────────────────────────

CREATE TABLE loyalty_points_ledger (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id        uuid REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id       uuid REFERENCES patients(id) ON DELETE CASCADE,
  points           int NOT NULL,  -- positive = earn, negative = redeem/expire
  type             text NOT NULL CHECK (type IN ('earn','redeem','expire','adjust','bonus')),
  subtype          text,
  reference_id     uuid,
  reference_type   text CHECK (reference_type IN ('invoice','appointment','referral','manual','membership','birthday')),
  balance_after    int NOT NULL DEFAULT 0,
  expires_at       date,
  note             text,
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX ON loyalty_points_ledger (clinic_id, patient_id, created_at DESC);

CREATE TABLE loyalty_tiers (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id        uuid REFERENCES clinics(id) ON DELETE CASCADE,
  tier_key         text NOT NULL,  -- 'bronze','silver','gold','platinum'
  tier_name        text NOT NULL,
  min_points       int NOT NULL,
  max_points       int,            -- null = no upper limit
  color            text NOT NULL DEFAULT '#9CA3AF',
  benefits         jsonb DEFAULT '{}',  -- {discount_pct, points_multiplier, priority_booking}
  points_multiplier numeric DEFAULT 1.0,
  display_order    int DEFAULT 0,
  created_at       timestamptz DEFAULT now(),
  UNIQUE (clinic_id, tier_key)
);

-- ─── REFERRALS ───────────────────────────────────────────────────────────────

CREATE TABLE referral_codes (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id     uuid REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id    uuid REFERENCES patients(id) ON DELETE CASCADE,
  code          text UNIQUE NOT NULL,
  reward_type   text DEFAULT 'wallet' CHECK (reward_type IN ('wallet','points','discount')),
  reward_amount numeric NOT NULL DEFAULT 500,
  referee_reward_type   text DEFAULT 'wallet',
  referee_reward_amount numeric DEFAULT 200,
  used_count    int DEFAULT 0,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX ON referral_codes (clinic_id, patient_id);

CREATE TABLE referral_conversions (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_code_id    uuid REFERENCES referral_codes(id),
  referred_patient_id uuid REFERENCES patients(id),
  referrer_rewarded   boolean DEFAULT false,
  referee_rewarded    boolean DEFAULT false,
  invoice_id          uuid REFERENCES pending_invoices(id),
  created_at          timestamptz DEFAULT now()
);

-- ─── FEEDBACK & NPS ─────────────────────────────────────────────────────────

CREATE TABLE patient_feedback (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id           uuid REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id          uuid REFERENCES patients(id),
  appointment_id      uuid REFERENCES appointments(id),
  rating              int CHECK (rating BETWEEN 1 AND 5),
  comment             text,
  source              text DEFAULT 'post_visit'
    CHECK (source IN ('post_visit','nps_survey','manual','portal')),
  review_requested_at timestamptz,
  reviewed_at         timestamptz,
  reviewed_platform   text,
  review_url          text,
  created_at          timestamptz DEFAULT now()
);
CREATE INDEX ON patient_feedback (clinic_id, rating, created_at DESC);

CREATE TABLE nps_surveys (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id    uuid REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id   uuid REFERENCES patients(id),
  score        int CHECK (score BETWEEN 0 AND 10),
  comment      text,
  category     text GENERATED ALWAYS AS (
    CASE WHEN score >= 9 THEN 'promoter'
         WHEN score >= 7 THEN 'passive'
         ELSE 'detractor' END
  ) STORED,
  sent_at      timestamptz,
  responded_at timestamptz,
  created_at   timestamptz DEFAULT now()
);

-- ─── WHATSAPP ────────────────────────────────────────────────────────────────

CREATE TABLE whatsapp_conversations (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id        uuid REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id       uuid REFERENCES patients(id),
  lead_id          uuid REFERENCES crm_leads(id),
  phone            text NOT NULL,
  wa_thread_id     text,
  status           text DEFAULT 'open' CHECK (status IN ('open','resolved','bot')),
  assigned_to      uuid REFERENCES profiles(id),
  last_message_at  timestamptz,
  unread_count     int DEFAULT 0,
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX ON whatsapp_conversations (clinic_id, status, last_message_at DESC);
CREATE UNIQUE INDEX ON whatsapp_conversations (clinic_id, phone);

CREATE TABLE whatsapp_messages (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  direction       text NOT NULL CHECK (direction IN ('inbound','outbound')),
  content         text NOT NULL,
  template_key    text,
  wa_message_id   text,
  status          text DEFAULT 'sent'
    CHECK (status IN ('pending','sent','delivered','read','failed')),
  sent_by         uuid REFERENCES profiles(id),
  sent_at         timestamptz DEFAULT now()
);
CREATE INDEX ON whatsapp_messages (conversation_id, sent_at DESC);

CREATE TABLE whatsapp_templates (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id    uuid REFERENCES clinics(id),  -- null = global default
  template_key text NOT NULL,
  name         text NOT NULL,
  content      text NOT NULL,     -- supports {{name}}, {{service}}, {{date}}, {{link}}
  variables    text[] DEFAULT '{}',
  wa_template_id text,            -- WhatsApp Business API template ID
  is_approved  boolean DEFAULT false,
  language     text DEFAULT 'en',
  created_at   timestamptz DEFAULT now(),
  UNIQUE (clinic_id, template_key)
);

-- ─── PATIENT PORTAL ──────────────────────────────────────────────────────────

CREATE TABLE patient_portal_sessions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id    uuid REFERENCES patients(id) ON DELETE CASCADE,
  token_hash    text UNIQUE NOT NULL,
  otp_hash      text,
  otp_expires_at timestamptz,
  verified_at   timestamptz,
  expires_at    timestamptz NOT NULL,
  last_accessed_at timestamptz,
  ip_address    text,
  created_at    timestamptz DEFAULT now()
);

-- ─── INJECTABLE LOT TRACKING ─────────────────────────────────────────────────

CREATE TABLE encounter_injectables (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  encounter_id  uuid REFERENCES clinical_encounters(id) ON DELETE CASCADE,
  patient_id    uuid REFERENCES patients(id),
  clinic_id     uuid REFERENCES clinics(id),
  product_name  text NOT NULL,
  batch_id      uuid REFERENCES inventory_batches(id),
  lot_number    text,
  units_used    numeric,
  unit_type     text DEFAULT 'units' CHECK (unit_type IN ('units','ml','vials')),
  injection_zone text,
  notes         text,
  created_at    timestamptz DEFAULT now()
);

-- ─── VENDORS & PURCHASE ORDERS ───────────────────────────────────────────────

CREATE TABLE vendors (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id      uuid REFERENCES clinics(id) ON DELETE CASCADE,
  chain_id       uuid REFERENCES chains(id),
  name           text NOT NULL,
  contact_person text,
  phone          text,
  email          text,
  address        text,
  gstin          text,
  payment_terms  text DEFAULT 'net_30',
  lead_time_days int DEFAULT 7,
  notes          text,
  is_active      boolean DEFAULT true,
  created_at     timestamptz DEFAULT now()
);

CREATE TABLE purchase_orders (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id         uuid REFERENCES clinics(id) ON DELETE CASCADE,
  vendor_id         uuid REFERENCES vendors(id),
  po_number         text UNIQUE,
  status            text DEFAULT 'draft'
    CHECK (status IN ('draft','sent','confirmed','partially_received','received','invoiced','cancelled')),
  expected_delivery date,
  received_at       timestamptz,
  notes             text,
  total_value       numeric DEFAULT 0,
  gst_amount        numeric DEFAULT 0,
  created_by        uuid REFERENCES profiles(id),
  approved_by       uuid REFERENCES profiles(id),
  created_at        timestamptz DEFAULT now()
);

CREATE TABLE po_line_items (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id             uuid REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id        uuid,
  product_name      text NOT NULL,
  quantity_ordered  int NOT NULL,
  quantity_received int DEFAULT 0,
  unit_cost         numeric NOT NULL,
  gst_pct           numeric DEFAULT 0,
  lot_number        text,
  expiry_date       date
);

-- ─── INVENTORY BATCHES (lot tracking) ────────────────────────────────────────

CREATE TABLE inventory_batches (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id          uuid REFERENCES clinics(id) ON DELETE CASCADE,
  product_id         uuid NOT NULL,
  lot_number         text NOT NULL,
  expiry_date        date,
  quantity_received  int NOT NULL,
  quantity_remaining int NOT NULL,
  unit_cost          numeric,
  po_id              uuid REFERENCES purchase_orders(id),
  received_at        timestamptz DEFAULT now(),
  UNIQUE (clinic_id, product_id, lot_number)
);
CREATE INDEX ON inventory_batches (clinic_id, product_id, expiry_date);

-- ─── DRIP SEQUENCES ──────────────────────────────────────────────────────────

CREATE TABLE drip_sequence_templates (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id     uuid REFERENCES clinics(id),  -- null = global built-in
  name          text NOT NULL,
  trigger_event text NOT NULL,
  steps         jsonb NOT NULL DEFAULT '[]',
  -- step shape: [{delay_hours, channel, template_key, condition?}]
  stop_events   text[] DEFAULT '{}',  -- stop sequence if these events fire
  is_active     boolean DEFAULT true,
  is_builtin    boolean DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE drip_enrollments (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id    uuid REFERENCES drip_sequence_templates(id),
  clinic_id      uuid REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id     uuid REFERENCES patients(id),
  lead_id        uuid REFERENCES crm_leads(id),
  current_step   int DEFAULT 0,
  status         text DEFAULT 'active'
    CHECK (status IN ('active','paused','completed','cancelled')),
  started_at     timestamptz DEFAULT now(),
  next_step_at   timestamptz,
  completed_at   timestamptz
);
CREATE INDEX ON drip_enrollments (clinic_id, status, next_step_at);

-- ─── COLUMNS TO ADD to existing tables ───────────────────────────────────────

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS loyalty_points     int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_tier       text DEFAULT 'bronze',
  ADD COLUMN IF NOT EXISTS no_show_count      int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_cancel_count  int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visit_count        int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_visit_at      timestamptz,
  ADD COLUMN IF NOT EXISTS referral_code      text UNIQUE,
  ADD COLUMN IF NOT EXISTS portal_last_access timestamptz,
  ADD COLUMN IF NOT EXISTS photo_consent_type text DEFAULT 'clinical_only'
    CHECK (photo_consent_type IN ('clinical_only','patient_viewable','marketing_consented'));

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS recall_days        int,      -- recall schedule for this service
  ADD COLUMN IF NOT EXISTS recall_enabled     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS backbar_product_id uuid,     -- FK to inventory product for auto-deduction
  ADD COLUMN IF NOT EXISTS backbar_qty        numeric,  -- qty consumed per session
  ADD COLUMN IF NOT EXISTS product_type       text DEFAULT 'service',
  ADD COLUMN IF NOT EXISTS is_deleted         boolean DEFAULT false; -- soft delete

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS source             text DEFAULT 'staff'
    CHECK (source IN ('staff','online_booking','portal','whatsapp')),
  ADD COLUMN IF NOT EXISTS deposit_paid       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_amount     numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_score         int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS check_in_at        timestamptz,
  ADD COLUMN IF NOT EXISTS check_out_at       timestamptz;

ALTER TABLE pending_invoices
  ADD COLUMN IF NOT EXISTS source             text DEFAULT 'billing'
    CHECK (source IN ('billing','scheduler','inventory','counselling','portal')),
  ADD COLUMN IF NOT EXISTS loyalty_points_redeemed int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tip_amount         numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tip_split          jsonb DEFAULT '{}';

ALTER TABLE clinical_encounters
  ADD COLUMN IF NOT EXISTS appointment_id     uuid REFERENCES appointments(id);

ALTER TABLE counselling_sessions
  ADD COLUMN IF NOT EXISTS source_lead_id     uuid REFERENCES crm_leads(id),
  ADD COLUMN IF NOT EXISTS appointment_id     uuid REFERENCES appointments(id);

ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS referral_code_id   uuid REFERENCES referral_codes(id),
  ADD COLUMN IF NOT EXISTS drip_enrolled      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_detail      text;  -- e.g. 'instagram_reel_dec2025'
```

### 3.2 RPC Functions Required

```sql
-- Atomic wallet credit (replaces all direct UPDATE wallet_balance)
CREATE OR REPLACE FUNCTION credit_wallet(
  p_patient_id  uuid,
  p_amount      numeric,
  p_type        text,
  p_subtype     text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_note        text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_balance numeric;
BEGIN
  SELECT wallet_balance INTO v_balance FROM patients WHERE id = p_patient_id FOR UPDATE;
  UPDATE patients SET wallet_balance = wallet_balance + p_amount WHERE id = p_patient_id;
  INSERT INTO wallet_transactions (patient_id, clinic_id, type, amount, balance_after, reason, reference_id, reference_type)
    SELECT p_patient_id, clinic_id, p_type, p_amount, v_balance + p_amount, p_note, p_reference_id, p_reference_type
    FROM patients WHERE id = p_patient_id;
END;
$$;

-- Atomic loyalty points earn
CREATE OR REPLACE FUNCTION earn_loyalty_points(
  p_clinic_id      uuid,
  p_patient_id     uuid,
  p_points         int,
  p_type           text DEFAULT 'earn',
  p_subtype        text DEFAULT NULL,
  p_reference_id   uuid DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_note           text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_balance int;
  v_new_tier text;
BEGIN
  SELECT loyalty_points INTO v_balance FROM patients WHERE id = p_patient_id FOR UPDATE;
  UPDATE patients SET loyalty_points = loyalty_points + p_points WHERE id = p_patient_id;
  v_balance := v_balance + p_points;
  INSERT INTO loyalty_points_ledger (clinic_id, patient_id, points, type, subtype, reference_id, reference_type, balance_after, note)
    VALUES (p_clinic_id, p_patient_id, p_points, p_type, p_subtype, p_reference_id, p_reference_type, v_balance, p_note);
  -- Update tier
  SELECT tier_key INTO v_new_tier FROM loyalty_tiers
    WHERE clinic_id = p_clinic_id AND min_points <= v_balance
    ORDER BY min_points DESC LIMIT 1;
  IF v_new_tier IS NOT NULL THEN
    UPDATE patients SET loyalty_tier = v_new_tier WHERE id = p_patient_id;
  END IF;
END;
$$;

-- Atomic appointment completion (wraps all side effects)
CREATE OR REPLACE FUNCTION complete_appointment(
  p_appointment_id uuid,
  p_clinic_id      uuid,
  p_completed_by   uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_apt appointments%ROWTYPE;
  v_patient_id uuid;
  v_commission numeric;
BEGIN
  SELECT * INTO v_apt FROM appointments WHERE id = p_appointment_id FOR UPDATE;
  IF v_apt.status = 'completed' THEN RAISE EXCEPTION 'Already completed'; END IF;
  UPDATE appointments SET status = 'completed', check_out_at = now(),
    updated_at = now() WHERE id = p_appointment_id;
  UPDATE patients SET visit_count = visit_count + 1, last_visit_at = now()
    WHERE id = v_apt.patient_id;
  -- consume credit if reserved
  IF v_apt.credit_reserved AND v_apt.credit_id IS NOT NULL THEN
    PERFORM consume_session(v_apt.credit_id, p_clinic_id, v_apt.provider_id, v_apt.commission_pct);
  END IF;
  RETURN jsonb_build_object('success', true, 'appointment_id', p_appointment_id);
END;
$$;
```

---

## SECTION 4 — VISUAL CHARTING — COMPLETE REBUILD

### 4.1 What Changes

Current ChartingTab has basic SVG diagrams with click-to-place color pins.

**Full rebuild includes:**

**4.2 Diagram Types Available**
```
Face (Front view) — enhanced anatomical zones with named clickable regions
Face (3/4 Lateral) — new
Face (Profile/Side) — new
Scalp — for PRP/hair treatments
Body (Front) — full body anterior
Body (Back) — full body posterior
Upper Body — shoulders, arms, chest, upper back
Lower Body — abdomen, thighs, legs
Hands & Feet — for rejuvenation treatments
Custom — upload clinic's own SVG/image diagram
```

**4.3 Annotation Tools**
```
PIN        — circular marker with color + zone label (existing, enhanced)
ARROW      — directional arrow with text label (new)
TEXT       — free text annotation anywhere on diagram (new)
CIRCLE     — draw circle/oval over area to highlight zone (new)
FREEHAND   — draw freehand line over diagram (new, uses canvas layer)
DOSE BOX   — structured injectable data entry box (new):
              [ Zone: Forehead   ]
              [ Product: Botox   ]
              [ Units: 20        ]
              [ Lot #: ABC123    ]
              [ Depth: Superficial ]
              [ Notes: ...       ]
```

**4.4 Data Model**

All annotations stored as JSONB array in `patient_face_charts.annotations`:
```json
[
  {
    "id": "abc123",
    "tool": "dose_box",
    "x": 45.2,
    "y": 31.8,
    "zone": "Forehead",
    "product": "Botox 100U",
    "dose": "20",
    "dose_unit": "units",
    "lot_number": "ABC123XY",
    "depth": "Superficial",
    "color": "#C5A059",
    "notes": "Evenly distributed across 5 points"
  },
  {
    "id": "def456",
    "tool": "arrow",
    "x1": 50, "y1": 60, "x2": 65, "y2": 70,
    "label": "Filler volume here",
    "color": "#6366F1"
  },
  {
    "id": "ghi789",
    "tool": "text",
    "x": 30, "y": 80,
    "content": "Avoid this area — previous complication",
    "color": "#DC2626",
    "fontSize": 11
  }
]
```

**4.5 ChartingTab UX Layout**
```
┌──────────────────────────────────────────────────────────┐
│  [+ New Chart]  [Date picker]  Diagram: [Face ▼]        │
│  ─────────────────────────────────────────────────────── │
│  LEFT (40%):          │  RIGHT (60%):                    │
│  Diagram Viewer       │  Annotation Panel                │
│  ─────────────────    │  ─────────────────               │
│  [SVG diagram]        │  Tool: [PIN][ARROW][TEXT]        │
│                       │        [CIRCLE][DOSE BOX]        │
│  Click to annotate    │                                  │
│                       │  Selected annotation props:      │
│  Mini-map of          │  Zone: _______________          │
│  all annotation       │  Product: ____________          │
│  labels visible       │  Units: _______________         │
│  on diagram           │  Lot #: _______________         │
│                       │  Depth: [dropdown]              │
│                       │  Notes: [textarea]              │
│                       │                                  │
│                       │  [Save Annotation] [Delete]      │
│                       │  ─────────────────               │
│                       │  All Annotations List:           │
│                       │  • Forehead — Botox 20u         │
│                       │  • Lips — Juvederm 0.5ml        │
│                       │  [Edit] [Delete] each            │
├──────────────────────────────────────────────────────────┤
│  Past Charts Timeline:                                   │
│  [Jan 15] [Feb 12] [Mar 1] ← click to load past chart   │
│                                                          │
│  [Compare Mode] ← overlay 2 charts side by side         │
│  [Print Chart] [Export PDF]                              │
└──────────────────────────────────────────────────────────┘
```

**4.6 New Features**
- **Compare Mode**: select 2 chart dates → side-by-side SVG comparison
- **Print / PDF export**: chart + annotation list formatted for clinical records
- **Injectable auto-link**: when DOSE BOX annotation added → auto-creates `encounter_injectables` row
- **Lot number lookup**: typing in lot # → autocomplete from `inventory_batches` for current clinic
- **Zone warnings**: zones flagged in patient allergies → show red warning when annotating that zone

---

## SECTION 5 — FORM BUILDER — COMPLETE REBUILD

### 5.1 The Problem with Current Form Builder

1. Forms are created and saved to `form_definitions` ✅
2. A shareable link is generated (`/intake/[clinicId]?form=[id]`) ✅
3. **BUT the intake page has HARDCODED fields — it ignores the `form` param** ❌
4. **Form responses have nowhere to go** — `form_responses` table exists but is never populated by any UI ❌
5. **Consent forms are not linked to appointments** — created but never auto-sent ❌

### 5.2 Form Types and Their Destinations

| Form Type | Where Rendered | On Submit → Written To | Auto-Trigger |
|-----------|---------------|------------------------|--------------|
| `intake` | `/intake/[clinicId]?form=[id]` (public page) | `patients` table (new patient creation) + `patient_medical_history` + `form_responses` | When: clinic shares intake link |
| `consent` | Patient Portal + Pre-appointment link | `form_responses` (linked to appointment_id + patient_id) | When: appointment booked → auto-send if form linked to appointment type |
| `pre_appointment` | Patient Portal + Pre-appointment link | `form_responses` (linked to appointment_id) | T-24h before appointment → WhatsApp link |
| `feedback` | Post-visit WhatsApp link | `patient_feedback` + `form_responses` | T+4h after appointment |
| `survey` | Campaign link or portal | `form_responses` + optionally `nps_surveys` | Manual campaign send |
| `custom` | Manual share link | `form_responses` | Manual only |

### 5.3 Form-to-Appointment-Type Linking

New table:
```sql
CREATE TABLE appointment_type_forms (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id           uuid REFERENCES clinics(id) ON DELETE CASCADE,
  service_id          uuid REFERENCES services(id),  -- null = all services
  appointment_type    text,
  form_id             uuid REFERENCES form_definitions(id),
  send_timing         text DEFAULT 'pre_appointment'
    CHECK (send_timing IN ('on_booking','pre_24h','pre_2h','post_4h','post_48h')),
  is_required         boolean DEFAULT true,
  created_at          timestamptz DEFAULT now()
);
```

Flow: Appointment booked for service "Botox" → system checks `appointment_type_forms` for this service → sends linked consent form via WhatsApp T-24h before → patient fills and signs → response stored in `form_responses` with `appointment_id`.

### 5.4 Dynamic Form Renderer

New shared component: `components/FormRenderer.tsx`

```
Props:
  formDefinition: FormDefinition
  patientId?: string           -- pre-fill known patient
  appointmentId?: string       -- link response to appointment
  onSubmit: (responses) => void
  mode: 'intake' | 'consent' | 'feedback' | 'survey' | 'preview'

Renders all field types:
  text, number, date, dropdown, checkbox, textarea, signature, file, section_header

Special field types to ADD:
  rating        -- star rating 1-5 (for feedback forms)
  nps_scale     -- 0-10 NPS scale
  phone         -- phone with country code
  photo_upload  -- camera/upload (stored to Supabase Storage)
  yes_no        -- large Yes/No toggle (great for consent)
  consent_checkbox -- "I agree to..." with required tick + legal text block
  pain_scale    -- 0-10 visual pain scale

Conditional logic:
  Each field can have show_if: {field_id, operator, value}
  Hidden fields not submitted

Signature pad:
  Canvas-based finger/mouse draw
  Saved as base64 PNG to form_responses

Auto-fill from patient record:
  If patientId provided, pre-fill:
    name, dob, phone, email, primary_concern from patients table
  Read-only for pre-filled fields in intake mode
```

### 5.5 Template Library (Superadmin Managed)

Pre-built form templates that any clinic can copy-and-customize:

| Template Name | Type | Key Fields |
|---|---|---|
| Standard Intake Form | intake | Name, DOB, phone, email, chief complaint, medical history, allergies, medications, previous treatments, Fitzpatrick type, skin concerns |
| Botox Consent | consent | Procedure explanation, risks, contraindications, yes_no consent fields, signature |
| Dermal Filler Consent | consent | Same structure, filler-specific risks |
| Laser Treatment Consent | consent | Laser-specific, skin type, pregnancy check |
| Chemical Peel Consent | consent | Acid type, skin sensitivity |
| PRP Consent | consent | Blood draw consent |
| Post-Treatment Feedback | feedback | Rating 1-5, what went well, improvement suggestions, review consent |
| Monthly NPS Survey | survey | NPS 0-10 scale, open comment |
| Pre-Treatment Health Check | pre_appointment | Recent medications, pregnancy, antibiotics, recent sun exposure |
| Allergy Screening | pre_appointment | Known allergies, reactions, anaphylaxis history |
| Consultation Questionnaire | survey | Areas of concern, budget, previous treatments, how they heard about clinic |

**Rules for templates:**
- Stored in `form_templates` table (superadmin only can create/edit)
- Clinics see "Template Library" tab → clone any template into their `form_definitions`
- Cloned forms can be fully customized

```sql
CREATE TABLE form_templates (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL,
  form_type   text NOT NULL,
  description text,
  fields      jsonb NOT NULL DEFAULT '[]',
  category    text,  -- 'intake', 'consent', 'feedback', 'survey'
  is_featured boolean DEFAULT false,
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now()
);
```

### 5.6 Form Builder UI Redesign

```
Layout: 3-column builder (Mangomint style)

┌─────────────────────────────────────────────────────────────────┐
│ Form Builder           [Templates] [Preview] [Settings] [Save]  │
├─────────────┬───────────────────────────────┬───────────────────┤
│ FIELD       │       FORM CANVAS             │ FIELD PROPERTIES  │
│ PALETTE     │                               │                   │
│             │  [drag fields here]           │ Label: ______     │
│ ─ Basic ──  │                               │ Placeholder: __   │
│ Text        │  ┌─────────────────────────┐  │ Required: [x]     │
│ Number      │  │ Patient Name       [✎][✗]│  │                   │
│ Date        │  │ [text input]            │  │ Show If:          │
│ Dropdown    │  └─────────────────────────┘  │ Field: [▼]        │
│ Checkbox    │  ┌─────────────────────────┐  │ Is: [▼]           │
│ Textarea    │  │ Date of Birth      [✎][✗]│  │ Value: ____       │
│             │  │ [date picker]           │  │                   │
│ ─ Clinical  │  └─────────────────────────┘  │ Options (dropdown)│
│ Rating      │  ┌─────────────────────────┐  │ + Add option      │
│ NPS Scale   │  │ Chief Complaint    [✎][✗]│  │                   │
│ Pain Scale  │  │ [dropdown]              │  │ ────────────────  │
│ Yes/No      │  └─────────────────────────┘  │ Field ID:         │
│ Consent Box │  [+ Add Section Header]        │ form_field_abc123 │
│             │                               │                   │
│ ─ Special   │  ──────────────────────────── │                   │
│ Signature   │  Form Settings:               │                   │
│ Photo       │  Name: _________________      │                   │
│ File        │  Type: [intake ▼]             │                   │
│ Phone       │  Send via: [WhatsApp] [Email] │                   │
│ Section Hdr │  Link to: [service ▼]         │                   │
│             │  Timing: [T-24h ▼]            │                   │
│             │                               │                   │
└─────────────┴───────────────────────────────┴───────────────────┘

Bottom bar: [Template Library] [Copy Public Link] [QR Code] [Assign to Service]
```

---

## SECTION 6 — TEMPLATE MANAGEMENT (Separate from Form Templates)

Templates exist across multiple modules. One unified management surface.

### 6.1 WhatsApp Message Templates
- Managed at `/admin/templates`
- Variables: `{{name}}`, `{{service}}`, `{{date}}`, `{{time}}`, `{{clinic}}`, `{{link}}`, `{{amount}}`, `{{balance}}`, `{{code}}`
- Per-template: preview with sample data, WhatsApp approval status badge
- Clinic can create custom templates (submitted for WhatsApp approval)
- Superadmin-created templates are global defaults, clinics override per-clinic

### 6.2 Invoice Templates
- Clinic branding: logo, address, GST number, footer message, color
- Preview live as you edit
- Stored in `clinics.invoice_template JSONB`

### 6.3 Report Templates
- Pre-built reports available to all clinics (superadmin created)
- Clinics clone and customize
- Stored in `report_templates` table (new)

### 6.4 Rule Templates (already exists in Rule Builder)
- 25 built-in pre-built rules at `/admin/rules`
- Superadmin manages globally, clinics activate per-clinic

### 6.5 Template Management Page (`/admin/templates`)
Tabs:
1. **WhatsApp Messages** — list, edit, preview, approval status
2. **Invoice Templates** — branding + layout
3. **Consent & Forms** — link to Form Builder
4. **Report Templates** — link to Reports page
5. **Rule Templates** — link to Rule Builder

---

## SECTION 7 — COMPLETE MODULE SPEC (ALL MODULES)

### 7.1 Dashboard (Ground-Up Redesign)

**Goal**: Staff see their day. Owner sees the business health. 30-second morning check.

**Layout** (role-based):

For clinic_admin/owner:
```
Row 1 — KPI Hero Cards (4 across):
  • Today's Revenue (₹) — vs yesterday ↑↓%
  • Appointments Today (X/Y filled) — utilization bar
  • Active Members — vs last month
  • New Patients This Month — vs last month

Row 2 — Today's Timeline:
  • Visual day scroll showing all appointments (color by provider)
  • Status: confirmed (green), unconfirmed (amber), completed (strikethrough), no-show (red)
  • Hover card: patient name, tier badge, service, provider, phone (click to call)
  • [Check In] [Complete] [No Show] inline actions

Row 3 — Three columns:
  Left: Action Items
    • Pending discount approvals (N)
    • Low stock alerts (N)
    • New leads today (N)
    • Recalls due today (N)
    • Unsigned consent forms (N)
    • Failed membership renewals (N)

  Center: Revenue Trend (7-day bar chart — inline SVG, no lib needed)

  Right: Quick Actions
    • [New Patient] [Book Appointment] [New Invoice] [Check In Patient]

Row 4 — Lists:
  Left: Top Services This Month (table: service, sessions, revenue)
  Right: Provider Performance (table: provider, sessions, revenue, avg ticket)
```

For front_desk:
```
Row 1 — Today's Focus:
  • Total appointments today, checked-in count, pending count

Row 2 — Appointment List (sortable, filterable):
  • Patient | Service | Provider | Time | Status | Actions

Row 3 — Quick Actions only
```

### 7.2 Patient Records (Upgraded List Page)

**Changes from current:**
- HIPAA mask toggle in page header (not per-patient)
- Patient card shows: tier badge, loyalty points, membership tag, wallet balance, last visit date, no-show count (if >1)
- Filter chips: All / New (this month) / VIP / Members / Lapsed (90+ days) / High Risk (no-show flag)
- Search: name + phone + email
- Bulk actions: export CSV, send campaign, assign member plan
- [+ New Patient] → drawer (not page navigation) with intake form integration

**New Patient Drawer:**
```
Basic Info tab:
  Name, DOB, Phone, Email, Gender, Address
  Preferred Provider (dropdown → profiles)
  Primary Concern (multi-select from CONCERNS list)
  Referral Source + Referral Code field
  Fitzpatrick Type

Medical tab:
  Allergies (tag input)
  Current Medications (textarea)
  Medical Conditions (tag input)
  Previous Treatments (textarea)
  Prior Injections (Yes/No toggle)

On Save:
  → Create patients row
  → Create patient_medical_history row
  → Generate referral_code for patient
  → If referral_code provided → link to referral_conversions
  → If any recall source → enroll in new_patient_welcome drip
```

### 7.3 Scheduler (Full Upgrade)

**Calendar Views**: Day | 3-Day | Week | Month (switch via segmented control)

**Left Panel** (provider list):
```
Each provider row:
  [Avatar] Dr. Priya (Dermatologist)
  ████████░░ 78% utilized today
  3 appointments left
```

**Appointment Card** (redesigned):
```
┌─────────────────────────────────┐
│ 10:00 AM — 45 min               │
│ ● Priya Sharma          [GOLD]  │ ← tier badge
│ Botox — Forehead                │
│ Dr. Mehta                       │
│ ⚠ Deposit required              │ ← amber if risk_score high
└─────────────────────────────────┘
Hover expands:
  Phone: +91 9876...    [Call]
  Wallet: ₹2,500
  Last visit: Feb 12
  [✓ Check In] [✓ Complete] [✗ No Show] [Edit] [Cancel]
```

**New Booking Drawer** (3-step):
```
Step 1 — Patient
  Search or [+ New Patient]
  Shows: name, tier, membership, last visit, credit balance

Step 2 — Service & Provider
  Service picker (searchable list with price + duration)
  Provider picker (only shows providers who can do this service)
  Date/time picker (shows risk score if patient is high-risk)
  If risk_score > 60 → show "Deposit Required" warning + amount

Step 3 — Confirm
  Summary card
  Send confirmation WhatsApp: [Yes / No toggle]
  Send intake form: [Yes / No toggle, if not completed]
  [Confirm Booking]
```

**Waitlist Tab** (new tab in Scheduler):
```
List of waitlist entries for today + next 7 days
Columns: Patient | Service | Preferred Date | Time Pref | Days Waiting | Status
[Offer Slot] button → send WhatsApp with specific slot
[Book Directly] → skip notification, book immediately
```

**Recalls Tab** (new tab in Scheduler):
```
List of recall_tasks where recall_date <= TODAY + 7 days
Columns: Patient | Service | Due Date | Status | Last Visit
[Send Recall] → sends WhatsApp + marks sent_at
[Book Appointment] → opens booking drawer pre-filled
[Dismiss] → marks dismissed
```

### 7.4 Billing (Full Redesign)

**Two-Panel Invoice Builder:**
```
LEFT (60%) — Line Items
  Patient: [search picker]
  Appointment: [auto-populate if linked]

  ┌──────────────────────────────────────────────┐
  │ Service/Item          Qty  Price   Disc  GST  │
  │ Botox Forehead         1   ₹5,000   0%  18%   │
  │ [+ Add Line Item]                             │
  └──────────────────────────────────────────────┘

  Smart suggestions strip:
  "Patient has 2 Botox credits remaining — [Redeem]"
  "Member discount 15% applicable — [Apply]"
  "3,400 loyalty points available (= ₹340) — [Redeem]"
  "Upgrade to 6-session package and save ₹1,500 — [Add]"

RIGHT (40%) — Payment Panel (sticky)
  Subtotal:        ₹5,000
  Discount (-15%): -₹750
  GST (18%):       +₹756
  ──────────────────────
  Total:           ₹5,006

  Wallet available: ₹2,500 [Use]
  Points (3,400 pts = ₹340) [Use]
  ──────────────────────
  Amount Due:      ₹2,166

  Payment Mode:
  [Cash] [Card] [UPI] [Wallet] [Split]

  UPI: ₹_____  Card: ₹_____  Cash: ₹_____

  Tip: [None] [10%] [15%] [20%] [Custom]
  If multi-provider: tip auto-split by time proportion

  [Create Invoice]
```

**Post-Payment Confirmation:**
```
  ✓ Invoice #INV-2026-001234 created

  Patient: Priya Sharma
  Amount: ₹5,006 paid
  Points earned: +500 pts (new balance: 3,900 pts)

  [WhatsApp Receipt] [Print] [Email] [New Invoice]
```

**Invoice List Page:**
```
Filters: All | Pending | Partial | Paid | Overdue | Void
Quick filters: Today | This Week | This Month
Search: patient name, invoice number
Columns: Invoice # | Patient | Date | Services | Amount | Status | Actions
Row actions: View | Void | Print | Resend Receipt
```

### 7.5 Inventory (Full Rebuild)

**5 Tabs:**
1. **Products** — product catalog with current stock, type (retail/backbar/both)
2. **Batches** — lot/batch tracking with expiry dates and remaining quantities
3. **Movements** — full audit trail of every stock change
4. **Purchase Orders** — PO lifecycle from draft to invoiced
5. **Vendors** — supplier management

**Products Tab:**
```
Columns: Product | Category | Type | Stock | Reorder Level | Expiry Status | Actions
Type badges: [Retail] [Backbar] [Both]
Expiry status: Green (safe) / Amber (expiring <30d) / Red (expiring <7d) / Grey (expired)
Inline edit: reorder level, low stock threshold
[+ Add Product] drawer:
  Name, Category, SKU, Type (retail/backbar/both)
  Linked service (for backbar — auto-deduct on appointment complete)
  Reorder level, Preferred vendor
```

**Batches Tab:**
```
Columns: Product | Lot # | Expiry | Received | Remaining | Cost | PO #
Filter: expiring this month / all active / expired
[Receive Stock] → opens "receive against PO" or "standalone receive"
Lot detail row expands: full batch history of movements
```

**Purchase Orders Tab:**
```
Kanban or list: Draft | Sent | Confirmed | Received | Invoiced
PO card: vendor, expected delivery, total value, items count
[+ New PO] drawer:
  Vendor (dropdown from vendors)
  Line items: product + qty + unit cost + GST% + lot # + expiry
  Expected delivery date
  Notes
  [Save Draft] [Send to Vendor]
On Receive: enter actual quantities received → creates batch records
```

### 7.6 Membership (Enhanced)

**3 Tabs:**
1. **Plans** — plan builder (existing + milestone rewards)
2. **Members** — patient membership list with status, renewal date, dunning status
3. **Analytics** — MRR, churn rate, tier distribution, benefit utilization

**Plan Builder Additions:**
```
Milestone Rewards section:
  After 3 months → [reward picker: wallet credit / service / points]
  After 6 months → [reward picker]
  After 1 year → [reward picker]

Benefits section (existing + new):
  Monthly wallet credit: ₹_____
  Discount on services: ____%
  Included sessions: [service] × [N] sessions
  Priority booking: [Yes/No]
  Points multiplier: ___× (e.g. 1.5x points on all spend)
  Free add-on service: [service picker]

Auto-renewal settings:
  Retry on failure: [Yes/No]
  Grace period: [days]
  Freeze allowed: [Yes/No] — max [N] days/year
```

### 7.7 Counselling (Enhanced)

**Links to complete journey — no broken handoffs:**

```
Session creation:
  Patient linked: [patient picker]
  Source lead: [CRM lead picker] — auto-populated if from CRM
  Appointment linked: [appointment picker] — links to scheduler

Treatments Discussed section:
  Each row: Service | Quoted Price | MRP | Disc% | Recommended Sessions | Accept/Decline
  Add from service catalog (not freehand)
  Total auto-calculated

On Save (converted):
  → Create patient_treatments rows for accepted treatments
  → If lead linked → update lead.status = 'booked' or 'converted'
  → Suggest [Book Appointment] for accepted treatments (one-click)
  → Suggest [Create Invoice] for immediately accepted paid treatments

Reference Gallery:
  Shows before_after photos filtered by clinic_id + treatment area
  (Bug B10 fix: add clinic_id filter)

Proforma Invoice:
  Instead of just view → option to [Save as Draft Invoice]
  Creates pending_invoice with source='counselling', status='draft'
```

### 7.8 CRM & Leads (Kanban Redesign)

**View Toggle**: Kanban | Table | Calendar (follow-up dates)

**Kanban Board:**
```
[New] [Contacted] [Interested] [Qualified] [Booked] [Converted] [Lost/Junk]

Lead Card:
  ┌──────────────────────────┐
  │ Priya Sharma             │
  │ 📱 +91 9876543210        │
  │ Interest: Botox, Filler  │
  │ Source: Instagram        │
  │ Assigned: Dr. Sales      │
  │ Last contact: 2 days ago │ ← amber if > 3 days
  │ [WhatsApp] [Call] [Edit] │
  └──────────────────────────┘

Drag card to move stage.
On drop to "Converted": opens Convert Lead drawer:
  → Create new patient? [Yes, prefill from lead / No, link existing]
  → Referral code used? [field]
  → [Convert]
```

**Lead Detail Drawer:**
```
Timeline tab: all activities (WhatsApp sent, status change, notes)
Notes tab: staff notes on lead
Sequence tab: drip sequence status — which step, next message date, [Pause] [Cancel]
```

**Campaigns Tab:**
```
Segment builder:
  Filter patients by: last visit date, service history, tier, membership, spend range, DOB month
  Preview: "X patients match this segment"

Message: WhatsApp template picker (with preview)
Schedule: [Now] [Schedule: date + time]
[Send Campaign] → creates campaign record, enqueues sends
```

### 7.9 Staff HR (Enhanced)

**No changes to structure, additions:**
- Overtime flag visual in attendance grid
- Leave balance tracker (days taken vs allowed per type)
- Commission summary per staff member (pulls from `staff_commissions`)
- [Download Attendance Report] → CSV for selected month

### 7.10 Payroll (Enhanced)

**Fix: commission reversal when appointment cancelled**
- On payroll run creation: exclude commissions for `appointments` where `status IN ('cancelled','no_show')`
- Commission records linked via `appointment_id` → filter out

**Add: tip payout**
- `payslips.breakdown` includes `tip_total` from invoice_payments
- Separated in payslip view

### 7.11 Reports (Full Rebuild)

**Replace current sparse builder with:**

Pre-built report library (12 reports, always available):
1. Daily Revenue Summary
2. Provider Performance (by date range)
3. Service Mix Analysis (top services by revenue + sessions)
4. Patient Retention Cohort
5. Membership MRR & Churn
6. Inventory COGS & Margins
7. Credit Redemption Analysis
8. Campaign ROI Attribution
9. Recall Effectiveness (sent → booked rate)
10. No-Show & Cancellation Cost Analysis
11. Loyalty Points Issued vs Redeemed
12. Staff Commission Ledger

**Custom Report Builder (existing structure, enhanced):**
- Fix `inventory_items` → `inventory_products` bug
- Add new base entities: `recalls`, `loyalty`, `membership`, `credits`
- Add chart types: line chart, bar chart, pie chart (inline SVG)
- [Schedule Report] → daily/weekly/monthly email delivery
- Export: CSV, PDF

### 7.12 Form Builder (Full Rebuild per Section 5)

### 7.13 Rule Builder (Existing + 30 Pre-Built Rules)

See Section 4 of previous plan for the full 30 pre-built rules.

**UI Additions:**
- Rule list shows: trigger event, last fired date, total fires this month
- [Test Rule] button → run against test patient data
- Cooldown field: "Don't fire again for X days for same patient"
- Per-rule enable/disable toggle without deleting

---

## SECTION 8 — COMPLETE IMPLEMENTATION ROADMAP

> All work on `staging` branch. Test clinic validates each phase before next starts.

### PRE-PHASE — Bug Fixes (3 days, blocking everything else)

| # | Fix | File(s) |
|---|-----|---------|
| P1 | Fix Reports: `inventory_items` → `inventory_products` | `app/admin/reports/page.tsx` |
| P2 | Fix counselling: add `clinic_id` filter on before_after_photos | `app/counselling/page.tsx` |
| P3 | Fix wallet: all direct UPDATE wallet_balance → use `credit_wallet()`/`debit_wallet()` RPC | Billing, Membership, Credits |
| P4 | Fix commission reversal: no-show/cancel appointments excluded from commission | Scheduler |
| P5 | Fix intake page: read `?form=` param → render dynamic FormRenderer | `app/intake/[clinicId]/page.tsx` |
| P6 | Fix multi-line invoice: wrap in single RPC | Billing API route |
| P7 | Fix sidebar broken links: remove or stub `/admin/users`, `/admin/analytics`, etc. | `components/Sidebar.tsx` |
| P8 | Add soft-delete to services: `is_deleted=true` + filter in all queries | Services page |

---

### PHASE A — Design System + Navigation (Week 1)

*Foundation that all subsequent phases build on.*

| # | Task | Output |
|---|------|--------|
| A1 | Apply complete CSS token system (Section 1.1) to `globals.css` | New design tokens live |
| A2 | Rebuild Sidebar to Mangomint layout with live badges | New `Sidebar.tsx` |
| A3 | Rebuild TopBar with breadcrumbs + page actions slot | New `TopBar.tsx` |
| A4 | Create shared component library: Button, Input, Card, Badge, Drawer, Modal, Skeleton, Toast | `components/ui/` |
| A5 | Apply keyboard shortcuts globally (N/B/I/Esc/Ctrl+S) | `hooks/useKeyboardShortcuts.ts` |
| A6 | Dashboard full redesign (Section 7.1) | `app/page.tsx` |
| A7 | Skeleton screens on all async sections (replace all full-page spinners) | All pages |
| A8 | Apply new card/table/badge styles to Patient List page | `app/patients/page.tsx` |

**Test clinic validates:** Does the app feel faster, cleaner? Are all nav items working? Dashboard shows correct numbers?

---

### PHASE B — Patient Journey Foundation (Weeks 2–3)

*The core flow: patient created → appointment booked → treated → invoiced.*

| # | Task | DB | Output |
|---|------|----|--------|
| B1 | New Patient Drawer (Section 7.2) — tabs: Basic + Medical | None new | Replaces page navigation |
| B2 | Referral code auto-generated on patient creation | `referral_codes` table | Each patient gets a code |
| B3 | Appointment Risk Score calculation (rule-based, configurable) | `appointment_risk_scores` | Risk badge on scheduler card |
| B4 | New Booking Drawer (3-step, Section 7.3) with deposit gate on high risk | None new | Replaces current booking modal |
| B5 | Waitlist engine: join, notify on cancel, 15-min offer window | `scheduler_waitlist` | Waitlist tab in Scheduler |
| B6 | Recall Task creation on appointment complete (5 pre-built service rules) | `recall_tasks` | Recalls tab in Scheduler |
| B7 | Redesigned Appointment Card with hover expand + inline actions | None | New card component |
| B8 | Billing redesign: 2-panel layout with smart suggestions | None new | New `app/billing/page.tsx` |
| B9 | Tip at checkout + tip split between providers | `invoice_payments` (tip subtype) | Tip prompt in billing |
| B10 | Injectable lot tracking in SOAP Encounter drawer | `encounter_injectables` | Lot picker in EMR |

**Test clinic validates:** Book appointment → complete → auto recall created? Invoice with tip works? Deposit shown on high-risk patient?

---

### PHASE C — Loyalty & Retention Engine (Weeks 4–5)

| # | Task | DB | Output |
|---|------|----|--------|
| C1 | Loyalty points earn on every paid invoice (via RPC) | `loyalty_points_ledger` | Points credited post-payment |
| C2 | Loyalty tier system (Bronze/Silver/Gold/Platinum) | `loyalty_tiers` | Tier badge on patient header |
| C3 | Tier upgrade notification (in-app + WhatsApp) | Rule triggers | Auto-notification on upgrade |
| C4 | Redeem points at billing (100pts = ₹10 discount) | Discount line item | Points redemption in billing panel |
| C5 | Loyalty analytics in Membership page (3rd tab) | Aggregate queries | MRR, points chart |
| C6 | Referral conversion tracking + wallet reward | `referral_conversions` | Referrer credited on conversion |
| C7 | Referral nudge rule (after 3rd visit) | Rule | WhatsApp message |
| C8 | Patient Feedback form (post-visit, 1-5 rating) | `patient_feedback` | Post-visit WhatsApp survey |
| C9 | Review request routing (≥4 → Google link) | Rule + `patient_feedback` | Auto WhatsApp with review link |
| C10 | Negative feedback alert to clinic admin (≤3) | Rule | In-app notification |
| C11 | NPS survey (monthly, rule-driven) | `nps_surveys` | Monthly WhatsApp survey |
| C12 | Birthday campaign rule (daily scheduled) | Rule | Auto birthday WhatsApp |
| C13 | Win-back 90-day + 180-day rules (daily scheduled) | Rule | Re-engagement WhatsApp |
| C14 | Membership milestone rewards (3m/6m/1y) | `membership_plans.milestone_rewards` | Auto reward on milestone |
| C15 | Membership dunning sequence (failed payment) | Rule chain | 7-day dunning WhatsApp |

**Test clinic validates:** Complete appointment → points appear on patient? Reach tier → WhatsApp sent? Birthday campaign fires on correct date?

---

### PHASE D — Communications & Portal (Weeks 6–7)

| # | Task | DB | Output |
|---|------|----|--------|
| D1 | WhatsApp two-way inbox UI (staff view, conversation threads) | `whatsapp_conversations`, `whatsapp_messages` | New `/crm/inbox` page |
| D2 | Keyword routing (book/cancel/balance/confirm/yes/no) | Message handler | Auto-responses in inbox |
| D3 | WhatsApp template manager (`/admin/templates`) | `whatsapp_templates` | Template library with variables |
| D4 | Lead nurture drip sequences (5-step, auto-enroll on lead create) | `drip_enrollments` | CRM lead drip |
| D5 | Patient self-service portal (OTP login, no app) | `patient_portal_sessions` | `/portal/[token]` page |
| D6 | Portal: appointments view + cancel/reschedule (within policy) | None new | Portal appointments tab |
| D7 | Portal: invoices + receipts (PDF download) | None new | Portal billing tab |
| D8 | Portal: wallet balance + loyalty points + tier | None new | Portal wallet tab |
| D9 | Portal: before/after photos (patient_viewable consent only) | `photo_consent_type` | Portal gallery tab |
| D10 | Portal: fill pre-appointment forms (consent, health check) | `form_responses` | Portal forms tab |
| D11 | CRM Kanban redesign (drag stages, lead card, convert drawer) | None new | New `/crm/page.tsx` |

**Test clinic validates:** Patient texts "balance" → auto-reply works? Portal OTP login → can see appointments? Lead created → Day 0 message sent automatically?

---

### PHASE E — Form Builder + Template Management (Weeks 8–9)

| # | Task | DB | Output |
|---|------|----|--------|
| E1 | Dynamic FormRenderer component (all field types including new ones) | None | `components/FormRenderer.tsx` |
| E2 | Wire intake page to use FormRenderer with `?form=` param | None | Intake page uses dynamic form |
| E3 | Form submission routing by type (Section 5.2 — right destination) | `form_responses`, `patient_medical_history`, `patient_feedback` | Submissions go to correct table |
| E4 | Appointment type → form linking (auto-send pre-appointment) | `appointment_type_forms` | Consent auto-sent T-24h |
| E5 | Form template library (Section 5.5 — 11 built-in templates) | `form_templates` | Superadmin managed |
| E6 | Form Builder 3-column UI redesign (Section 5.6) | None | New `app/admin/forms/page.tsx` |
| E7 | Conditional field logic (show_if rules in field properties) | None | Field visibility logic |
| E8 | Signature pad (canvas-based) | None | Signature field type |
| E9 | QR code generation for form links | None | QR tab in form builder |
| E10 | Template Management page (`/admin/templates`) — all template types | `form_templates`, `whatsapp_templates` | New unified template hub |
| E11 | Clone template → customize → save as clinic form | None | Template clone flow |

**Test clinic validates:** Create Botox consent form → link to Botox service → book appointment → consent WhatsApp sent 24h before → patient signs → response appears on patient profile?

---

### PHASE F — Visual Charting Rebuild (Week 10)

| # | Task | DB | Output |
|---|------|----|--------|
| F1 | New diagram type selector: Face Front, Face 3/4, Scalp, Body Front, Body Back, Upper, Lower | None | Diagram picker |
| F2 | Annotation toolbar: Pin, Arrow, Text, Circle, Dose Box | None | Tool palette in ChartingTab |
| F3 | Dose Box annotation with injectable data (product, units, lot, depth) | None | Structured injectable form |
| F4 | Lot # autocomplete from `inventory_batches` for clinic | `inventory_batches` | Lot lookup |
| F5 | Auto-create `encounter_injectables` from Dose Box annotation | `encounter_injectables` | Cross-module link |
| F6 | Compare Mode (2 charts side by side) | None | Comparison view |
| F7 | Print / PDF export of chart + annotation list | None | Print button |
| F8 | Zone warning overlay (red if annotating allergic zone) | `patients.allergies` | Safety warning |
| F9 | Past charts timeline (horizontal scroll, click to load) | None | Timeline row |

**Test clinic validates:** Add Dose Box annotation → lot number autocompletes from inventory → save → encounter_injectables row created? Compare 2 charts?

---

### PHASE G — Inventory Upgrade (Week 11)

| # | Task | DB | Output |
|---|------|----|--------|
| G1 | Vendor management CRUD | `vendors` | Vendors tab in Inventory |
| G2 | Purchase Order full lifecycle (draft → send → receive → invoice) | `purchase_orders`, `po_line_items` | PO tab in Inventory |
| G3 | Receive against PO → auto-create `inventory_batches` | `inventory_batches` | Receive PO flow |
| G4 | Batch/lot list with expiry status colors | None | Batches tab |
| G5 | Low-stock → auto draft PO rule | Rule | Draft PO created automatically |
| G6 | Expiry alert rules (30-day, 7-day) | Rule | Alerts in sidebar badge + inbox |
| G7 | Backbar vs retail product type split | `services.backbar_product_id` | Type selector on product |
| G8 | Backbar auto-deduction on appointment complete | Rule → inventory update | Stock deducted after session |
| G9 | Service-to-backbar product mapping in Services page | `services.backbar_product_id` | Link on service edit drawer |
| G10 | Branch stock transfer flow | Transfer records | Transfer between clinics |

**Test clinic validates:** Create PO → receive → batches created? Botox appointment complete → Botox stock decremented? Low stock alert fires?

---

### PHASE H — Intelligence & Reporting (Weeks 12–13)

| # | Task | DB | Output |
|---|------|----|--------|
| H1 | Pre-built reports library (12 reports, Section 7.11) | Aggregate queries | Reports page new tab |
| H2 | Patient retention cohort report (monthly grid) | Cohort calculation | Cohort report |
| H3 | Provider performance scorecard | Provider aggregates | Provider report |
| H4 | Inventory COGS + margin report | backbar usage × cost | Inventory report |
| H5 | Campaign ROI attribution (send → book → revenue chain) | Attribution queries | Campaign report |
| H6 | Loyalty analytics (points, tier distribution, redemption rate) | `loyalty_points_ledger` | Loyalty report |
| H7 | Recall effectiveness report (sent → booked %) | `recall_tasks` | Recall report |
| H8 | Scheduler utilization heatmap (provider × hour) | `appointments` aggregated | Visual heatmap |
| H9 | Revenue forecast (4 weeks: booked × historical fill rate) | Booking data | Forecast widget on dashboard |
| H10 | Custom report builder enhancement: new entities + chart types | None | Enhanced builder |
| H11 | Scheduled report email delivery | `report_definitions.schedule` | Auto email reports |

**Test clinic validates:** All 12 pre-built reports load with real data? Revenue numbers match billing page?

---

### PHASE I — Operations Polish (Week 14)

| # | Task | DB | Output |
|---|------|----|--------|
| I1 | Smart slot suggestion on manual booking (gap-fill algorithm) | None | "Recommended" slot badges |
| I2 | Resource scheduling (rooms + equipment) | `scheduler_resources` (new) | Room picker in booking |
| I3 | Payroll: exclude cancelled/no-show commissions | Commission filter | Clean payroll runs |
| I4 | Payroll: add tip payout in payslip breakdown | `invoice_payments.tip` | Tip line in payslip |
| I5 | Staff leave balance tracker | Aggregate calculation | Balance display in HR |
| I6 | Commission download report per staff per month | `staff_commissions` | Commission report |
| I7 | Multi-currency display settings (for future expansion) | `clinics.currency` | Currency setting |
| I8 | ABHA ID field on patient profile | `patients.abha_id` (new col) | India regulatory field |
| I9 | GST HSN code on services | `services.hsn_code` (new col) | HSN on invoice line items |
| I10 | Tally-compatible export from Reports | CSV formatter | Tally export button |

---

## SECTION 9 — STAGING VALIDATION CHECKLIST (Per Phase)

**Before any phase is marked complete, test clinic signs off on:**

**Phase A:**
- [ ] All pages load without full-page spinners
- [ ] Sidebar badges show correct counts (appointments, leads, low stock)
- [ ] Keyboard shortcut N opens new patient drawer
- [ ] Dashboard numbers match manual count
- [ ] All nav items work (no 404s)

**Phase B:**
- [ ] New patient created → referral code assigned automatically
- [ ] Book appointment for 2-time no-show patient → deposit required shown
- [ ] Appointment completed → recall task appears in Recalls tab
- [ ] Invoice created → tip distributed to correct provider
- [ ] Injectable added to SOAP → lot tracking row created

**Phase C:**
- [ ] Pay invoice → loyalty points appear on patient profile
- [ ] Points cross tier threshold → tier badge updates + WhatsApp sent
- [ ] 3rd visit → referral nudge WhatsApp sent
- [ ] Birthdate patient → birthday WhatsApp arrives at 9 AM
- [ ] Patient not seen 90 days → win-back WhatsApp sent
- [ ] Membership payment fails → dunning sequence starts

**Phase D:**
- [ ] Patient texts "book" → auto-reply with booking link
- [ ] Staff sees WhatsApp thread in /crm/inbox
- [ ] Patient accesses portal via OTP → sees appointments and invoices
- [ ] Patient cancels appointment via portal → scheduler updates immediately
- [ ] Lead created → Day 0 WhatsApp sent → Day 2 on schedule

**Phase E:**
- [ ] Create consent form in builder → link to Botox service → book appointment → consent sent T-24h
- [ ] Patient signs consent via portal → response in form_responses with appointment_id
- [ ] Intake form with `?form=` param → renders dynamic form → submits → patient created + medical history saved
- [ ] Clone template → customize → save → form appears in builder list

**Phase F:**
- [ ] Switch diagram type → correct SVG loads
- [ ] Add Dose Box → fill product + lot → save → encounter_injectables row visible in EMR
- [ ] Lot # field autocompletes from inventory batches
- [ ] Compare mode: select 2 dates → side-by-side diagrams
- [ ] Print chart → PDF/print view correct

**Phase G:**
- [ ] Create PO → receive → batches appear in Batches tab with expiry dates
- [ ] Botox session completed → backbar Botox stock auto-decremented
- [ ] Stock falls below reorder → draft PO created + sidebar badge updates
- [ ] 30-day expiry → amber alert appears

**Phase H:**
- [ ] All 12 pre-built reports load with real clinic data
- [ ] Revenue in Daily Summary matches invoice totals
- [ ] Cohort report shows correct retention rates
- [ ] Scheduled report email arrives at configured time

---

## SECTION 10 — DEPLOYMENT PROTOCOL

```
For each phase:
  1. Create feature branch from staging: git checkout -b feat/phase-X
  2. Build feature(s)
  3. Run: npm run build → must be 0 errors
  4. Apply DB migrations via Supabase MCP (staging project only)
  5. Seed test data if new tables added
  6. Merge feature branch → staging
  7. Push to origin/staging → Vercel auto-deploys preview
  8. Share URL with test clinic for validation
  9. Fix any reported bugs on staging
 10. Once signed off → merge staging → main → production deploy

Staging URL: https://aesthetica-erp-staging.vercel.app
Supabase project: lvapwnyvtmmpmqrvtthj
Branch: staging
```

---

*This document is the single authoritative source for Aesthetica ERP v3.0.*
*Last updated: March 2026*
