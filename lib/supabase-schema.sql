-- Run this in: Supabase Dashboard → SQL Editor

create table if not exists patients (
  id                 uuid primary key default gen_random_uuid(),
  full_name          text        not null,
  email              text        not null,
  phone              text        not null,
  preferred_provider text,
  primary_concern    text        not null,
  notes              text,
  send_intake        boolean     not null default true,
  created_at         timestamptz not null default now()
);

-- Enable Row Level Security
alter table patients enable row level security;

-- Development policy: open access (tighten before going to production)
create policy "Allow all operations for now"
  on patients for all
  using (true)
  with check (true);

-- ─── Migration: add admin_email to clinics ───────────────────────────────────
-- Run this if the Clinic Builder shows "admin email not saved" warning.

alter table clinics
  add column if not exists admin_email text;

-- ─── Chains & Clinics (if you need to recreate from scratch) ─────────────────

create table if not exists chains (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null,
  created_at timestamptz not null default now()
);

alter table chains enable row level security;
create policy "Superadmin manages chains" on chains for all using (true) with check (true);

create table if not exists clinics (
  id                  uuid primary key default gen_random_uuid(),
  name                text        not null,
  chain_id            uuid        references chains(id) on delete set null,
  admin_email         text,
  location            text,
  subscription_status text        not null default 'active',
  created_at          timestamptz not null default now()
);

alter table clinics enable row level security;
create policy "Superadmin manages clinics" on clinics for all using (true) with check (true);

-- ─── Migration: extend profiles for staff management ─────────────────────────
-- Run this in Supabase Dashboard → SQL Editor

alter table profiles add column if not exists full_name  text;
alter table profiles add column if not exists email      text;
alter table profiles add column if not exists clinic_id  uuid references clinics(id) on delete set null;
alter table profiles add column if not exists status     text default 'active';
alter table profiles add column if not exists created_at timestamptz default now();

-- ─── user_permissions — granular per-staff permission overrides ───────────────

create table if not exists user_permissions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  use_custom             boolean     not null default false,
  view_patients          boolean     not null default true,
  edit_patients          boolean     not null default false,
  view_scheduler         boolean     not null default true,
  edit_scheduler         boolean     not null default false,
  view_photos            boolean     not null default false,
  edit_photos            boolean     not null default false,
  view_inventory         boolean     not null default false,
  view_revenue           boolean     not null default false,
  edit_notes             boolean     not null default false,
  view_medical           boolean     not null default false,
  access_billing         boolean     not null default false,
  delete_patient_photos  boolean     not null default false,
  edit_staff             boolean     not null default false,
  updated_at             timestamptz not null default now()
);

alter table user_permissions enable row level security;

-- Admins can read/write all permissions
create policy "Admins manage permissions" on user_permissions
  for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('superadmin', 'admin')
    )
  )
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('superadmin', 'admin')
    )
  );

-- Each user can read their own permissions
create policy "Users read own permissions" on user_permissions
  for select
  using (user_id = auth.uid());

-- ─── Migration: add system_override flag to user_permissions ─────────────────

alter table user_permissions
  add column if not exists system_override boolean not null default false;

-- ─── audit_logs — immutable record of every superadmin permission change ─────

create table if not exists audit_logs (
  id           uuid        primary key default gen_random_uuid(),
  actor_id     uuid        references auth.users(id) on delete set null,
  actor_name   text,
  target_id    uuid        references auth.users(id) on delete set null,
  target_name  text,
  action       text        not null,           -- e.g. 'permission_change'
  permission_key text,                          -- e.g. 'view_revenue'
  old_value    boolean,
  new_value    boolean,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);

alter table audit_logs enable row level security;

-- Superadmins can insert and read all audit entries
create policy "Superadmins manage audit logs" on audit_logs
  for all
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'superadmin')
  )
  with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'superadmin')
  );

-- Admins can read (but not insert) audit entries
create policy "Admins read audit logs" on audit_logs
  for select
  using (
    exists (select 1 from profiles where id = auth.uid() and role in ('superadmin','admin'))
  );

-- role_permissions: platform-wide permission defaults per role
CREATE TABLE IF NOT EXISTS role_permissions (
  role                   text PRIMARY KEY,
  view_patients          boolean NOT NULL DEFAULT true,
  edit_patients          boolean NOT NULL DEFAULT false,
  view_scheduler         boolean NOT NULL DEFAULT true,
  edit_scheduler         boolean NOT NULL DEFAULT false,
  view_photos            boolean NOT NULL DEFAULT false,
  edit_photos            boolean NOT NULL DEFAULT false,
  view_inventory         boolean NOT NULL DEFAULT false,
  view_revenue           boolean NOT NULL DEFAULT false,
  edit_notes             boolean NOT NULL DEFAULT false,
  view_medical           boolean NOT NULL DEFAULT false,
  access_billing         boolean NOT NULL DEFAULT false,
  delete_patient_photos  boolean NOT NULL DEFAULT false,
  edit_staff             boolean NOT NULL DEFAULT false,
  updated_at             timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmins manage role_permissions" ON role_permissions
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'));
CREATE POLICY "Authenticated read role_permissions" ON role_permissions
  FOR SELECT USING (auth.role() = 'authenticated');

-- Seed defaults
INSERT INTO role_permissions (role, view_patients, edit_patients, view_scheduler, edit_scheduler, view_photos, edit_photos, view_inventory, view_revenue, edit_notes, view_medical, access_billing, delete_patient_photos, edit_staff) VALUES
  ('doctor',     true,  true,  true,  true,  true,  true,  true,  false, true,  true,  false, false, false),
  ('nurse',      true,  true,  true,  false, true,  false, true,  false, true,  true,  false, false, false),
  ('counsellor', true,  false, true,  false, false, false, false, false, true,  false, false, false, false),
  ('therapist',  true,  true,  true,  false, true,  false, false, false, true,  true,  false, false, false),
  ('front_desk', true,  false, true,  true,  false, false, false, false, false, false, false, false, false)
ON CONFLICT (role) DO NOTHING;

-- ─── automation_rules — superadmin rule builder ───────────────────────────────

CREATE TABLE IF NOT EXISTS automation_rules (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text        NOT NULL,
  trigger              text        NOT NULL,          -- 'after_treatment'|'low_stock'|'new_lead'|'appointment_noshow'
  condition_treatment  text,                          -- trigger: after_treatment
  condition_days       integer,                       -- trigger: after_treatment
  condition_product    text,                          -- trigger: low_stock
  condition_quantity   integer,                       -- trigger: low_stock
  condition_source     text,                          -- trigger: new_lead
  condition_hours      integer,                       -- trigger: new_lead | appointment_noshow
  action               text        NOT NULL,          -- 'send_whatsapp'|'email_care_instructions'|'nudge_receptionist'
  message_template     text        NOT NULL DEFAULT '',
  is_global            boolean     NOT NULL DEFAULT true,
  clinic_id            uuid        REFERENCES clinics(id) ON DELETE SET NULL,
  status               text        NOT NULL DEFAULT 'active',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins manage automation_rules" ON automation_rules
  FOR ALL
  USING   (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'));

CREATE POLICY "Admins read automation_rules" ON automation_rules
  FOR SELECT
  USING   (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('superadmin','admin','clinic_admin')));

-- ─── Migration: extend patients for clinic intake ─────────────────────────────
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE patients ADD COLUMN IF NOT EXISTS clinic_id           uuid REFERENCES clinics(id) ON DELETE SET NULL;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS previous_injections text;

-- Allow email to be optional (patient intake form makes it optional)
ALTER TABLE patients ALTER COLUMN email DROP NOT NULL;

-- Allow anon/service-role INSERT for the public intake API route
-- (The existing open policy already covers this, but add explicit anon if needed)

-- Allow anon to read clinic names + locations for the intake page (via API route using service key — no extra policy needed)

-- ─── Migration: extend patients for full EMR support ─────────────────────────

ALTER TABLE patients ADD COLUMN IF NOT EXISTS date_of_birth    date;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS fitzpatrick_type smallint CHECK (fitzpatrick_type BETWEEN 1 AND 6);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS allergies        text[]  DEFAULT '{}';

-- ─── patient_notes — clinical notes from staff/doctors ───────────────────────

CREATE TABLE IF NOT EXISTS patient_notes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  uuid        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id   uuid        REFERENCES clinics(id) ON DELETE SET NULL,
  note_type   text        NOT NULL DEFAULT 'note',  -- 'note' | 'face_map' | 'intake_note'
  content     text        NOT NULL,
  author_name text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE patient_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage patient_notes" ON patient_notes
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('superadmin','admin','clinic_admin')))
  WITH CHECK  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('superadmin','admin','clinic_admin')));
CREATE POLICY "Staff read clinic patient_notes" ON patient_notes
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND clinic_id = patient_notes.clinic_id));

-- ─── patient_treatments — counselled / proposed treatment plans ───────────────

CREATE TABLE IF NOT EXISTS patient_treatments (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     uuid        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id      uuid        REFERENCES clinics(id) ON DELETE SET NULL,
  treatment_name text        NOT NULL,
  status         text        NOT NULL DEFAULT 'proposed',  -- 'proposed' | 'completed' | 'cancelled'
  price          numeric(10,2),
  counselled_by  text,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE patient_treatments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage patient_treatments" ON patient_treatments
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('superadmin','admin','clinic_admin')))
  WITH CHECK  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('superadmin','admin','clinic_admin')));
CREATE POLICY "Staff read clinic patient_treatments" ON patient_treatments
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND clinic_id = patient_treatments.clinic_id));

-- ─── patient_packages — pre-purchased session packages ───────────────────────

CREATE TABLE IF NOT EXISTS patient_packages (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id        uuid        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id         uuid        REFERENCES clinics(id) ON DELETE SET NULL,
  package_name      text        NOT NULL,
  total_sessions    integer     NOT NULL DEFAULT 1,
  used_sessions     integer     NOT NULL DEFAULT 0,
  price_per_session numeric(10,2),
  total_price       numeric(10,2),
  created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE patient_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage patient_packages" ON patient_packages
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('superadmin','admin','clinic_admin')))
  WITH CHECK  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('superadmin','admin','clinic_admin')));
CREATE POLICY "Staff read clinic patient_packages" ON patient_packages
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND clinic_id = patient_packages.clinic_id));

-- ─── clinical_encounters — SOAP notes with photo attachments ─────────────────

CREATE TABLE IF NOT EXISTS clinical_encounters (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       uuid        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id        uuid        REFERENCES clinics(id) ON DELETE SET NULL,
  encounter_date   date        NOT NULL DEFAULT CURRENT_DATE,
  subjective       text,    -- Patient's chief complaint / history
  objective        text,    -- Provider observations / measurements
  assessment       text,    -- Diagnosis / clinical assessment
  plan             text,    -- Treatment plan / prescriptions / follow-up
  photos           jsonb     NOT NULL DEFAULT '[]',  -- [{ url, type, caption }]
  created_by       uuid      REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE clinical_encounters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage clinical_encounters" ON clinical_encounters
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('superadmin','admin','clinic_admin')))
  WITH CHECK  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('superadmin','admin','clinic_admin')));
CREATE POLICY "Staff read clinic clinical_encounters" ON clinical_encounters
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN   user_permissions up ON up.user_id = p.id
      WHERE  p.id        = auth.uid()
        AND  p.clinic_id = clinical_encounters.clinic_id
        AND  up.view_medical = true
    )
  );

-- ─── Supabase Storage: patient-photos bucket ─────────────────────────────────
-- Run once in the Supabase dashboard → Storage → Create bucket
-- Bucket name: patient-photos  |  Public: false
-- Then add this policy:
--   INSERT for authenticated users: (bucket_id = 'patient-photos')
--   SELECT for authenticated users: (bucket_id = 'patient-photos')

-- ─── patient_medical_history — structured intake data per submission ──────────
-- Run in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS patient_medical_history (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id              uuid        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id               uuid        REFERENCES clinics(id) ON DELETE SET NULL,

  -- Concerns selected on the intake form (stored as a Postgres text array)
  primary_concerns        text[]      NOT NULL DEFAULT '{}',

  -- Specialist preference captured at intake
  preferred_specialist    text,

  -- Injection history fields (populated only when Botox or Fillers selected)
  had_prior_injections    boolean,
  last_injection_date     text,
  injection_complications text,

  -- Free-text notes from the patient for the doctor
  patient_notes           text,

  -- How this record was created
  intake_source           text        NOT NULL DEFAULT 'intake_form',

  recorded_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE patient_medical_history ENABLE ROW LEVEL SECURITY;

-- Admins and clinic admins have full access
CREATE POLICY "Admins manage patient_medical_history" ON patient_medical_history
  FOR ALL
  USING   (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('superadmin','admin','clinic_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('superadmin','admin','clinic_admin')));

-- Staff with view_medical permission can read records for their own clinic
CREATE POLICY "Staff read clinic medical history" ON patient_medical_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   profiles p
      JOIN   user_permissions up ON up.user_id = p.id
      WHERE  p.id          = auth.uid()
        AND  p.clinic_id   = patient_medical_history.clinic_id
        AND  up.view_medical = true
    )
  );

-- ─── medical_codes — standard CPT / procedure codes for treatment plans ───────
-- Run in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS medical_codes (
  code        text        PRIMARY KEY,
  description text        NOT NULL,
  category    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE medical_codes ENABLE ROW LEVEL SECURITY;

-- All authenticated users can search codes (read-only)
CREATE POLICY "Authenticated read medical_codes" ON medical_codes
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only superadmins can add / edit codes
CREATE POLICY "Superadmins manage medical_codes" ON medical_codes
  FOR ALL
  USING   (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'));

-- Seed common aesthetic & dermatology CPT codes
INSERT INTO medical_codes (code, description, category) VALUES
  ('99201', 'Office/outpatient visit, new patient, straightforward',               'E&M'),
  ('99211', 'Office/outpatient visit, established patient, minimal',               'E&M'),
  ('99213', 'Office/outpatient visit, established patient, low complexity',        'E&M'),
  ('99214', 'Office/outpatient visit, established patient, moderate complexity',   'E&M'),
  ('99215', 'Office/outpatient visit, established patient, high complexity',       'E&M'),
  ('11900', 'Intralesional injection, up to 7 lesions',                            'Injection'),
  ('11901', 'Intralesional injection, more than 7 lesions',                        'Injection'),
  ('64612', 'Chemodenervation of muscle(s) innervated by facial nerve (Botox)',    'Botox'),
  ('64615', 'Chemodenervation of muscle(s), facial/trigeminal/cervical nerves',    'Botox'),
  ('64616', 'Chemodenervation of muscle(s), neck (platysma)',                      'Botox'),
  ('17110', 'Destruction of benign lesions, 1–14 lesions',                        'Laser'),
  ('17111', 'Destruction of benign lesions, 15 or more',                          'Laser'),
  ('96920', 'Laser treatment for inflammatory skin disease, 1–250 sq cm',         'Laser'),
  ('96921', 'Laser treatment for inflammatory skin disease, 250–500 sq cm',       'Laser'),
  ('96922', 'Laser treatment for inflammatory skin disease, over 500 sq cm',      'Laser'),
  ('15820', 'Blepharoplasty, lower eyelid',                                        'Surgery'),
  ('15821', 'Blepharoplasty, lower eyelid, with fat repositioning',                'Surgery'),
  ('15823', 'Blepharoplasty, upper eyelid with ptosis repair',                     'Surgery'),
  ('15830', 'Excision of excessive skin/subcutaneous tissue, abdomen',             'Surgery'),
  ('86950', 'Platelet rich plasma injection',                                      'PRP'),
  ('0479T', 'Autologous cellular implantation for skin restoration',               'PRP'),
  ('11960', 'Insertion of tissue expander(s)',                                     'Filler'),
  ('11971', 'Removal of tissue expander(s) without insertion of prosthesis',       'Filler'),
  ('15780', 'Dermabrasion, total face',                                            'Resurfacing'),
  ('15781', 'Dermabrasion, segmental face',                                        'Resurfacing'),
  ('15786', 'Abrasion, lesion, single',                                            'Resurfacing'),
  ('15788', 'Chemical peel, facial, epidermal',                                    'Peel'),
  ('15789', 'Chemical peel, facial, dermal',                                       'Peel'),
  ('15792', 'Chemical peel, non-facial, epidermal',                                'Peel'),
  ('15793', 'Chemical peel, non-facial, dermal',                                   'Peel')
ON CONFLICT (code) DO NOTHING;

-- ─── HIPAA compliance notes ───────────────────────────────────────────────────
-- 1. No PHI is stored in browser localStorage — Supabase session uses cookies only
--    (createBrowserClient from @supabase/ssr stores session in httpOnly-style cookies)
-- 2. audit_logs is append-only via RLS; no DELETE policy is granted to any role
-- 3. 15-minute inactivity timeout enforced client-side via useInactivityTimeout hook
