-- =============================================================================
-- Phase J Migration — DB Activation
-- Activates: B5 Waitlist, B6 Recall, B9 Tip, B10 Injectables,
--            C1/C2/C4 Loyalty, C5 Membership Loyalty, C8 Feedback
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- B5: Scheduler Waitlist
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scheduler_waitlist (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id       uuid REFERENCES public.clinics(id)   ON DELETE CASCADE NOT NULL,
  patient_id      uuid REFERENCES public.patients(id)  ON DELETE CASCADE NOT NULL,
  service_id      uuid REFERENCES public.services(id)  ON DELETE SET NULL,
  provider_id     uuid REFERENCES public.profiles(id)  ON DELETE SET NULL,
  preferred_date  date,
  time_preference text,
  notes           text,
  status          text NOT NULL DEFAULT 'waiting'
                  CHECK (status IN ('waiting','offered','booked','cancelled')),
  offered_at      timestamptz,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.scheduler_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scheduler_waitlist_select" ON public.scheduler_waitlist
  FOR SELECT USING (clinic_id = get_viewer_clinic_id()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('superadmin','chain_admin')));

CREATE POLICY "scheduler_waitlist_insert" ON public.scheduler_waitlist
  FOR INSERT WITH CHECK (clinic_id = get_viewer_clinic_id()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('superadmin','chain_admin')));

CREATE POLICY "scheduler_waitlist_update" ON public.scheduler_waitlist
  FOR UPDATE USING (clinic_id = get_viewer_clinic_id()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('superadmin','chain_admin')));

CREATE INDEX IF NOT EXISTS idx_scheduler_waitlist_clinic  ON public.scheduler_waitlist (clinic_id);
CREATE INDEX IF NOT EXISTS idx_scheduler_waitlist_patient ON public.scheduler_waitlist (patient_id, clinic_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- B6: Recall Tasks
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recall_tasks (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id      uuid REFERENCES public.clinics(id)      ON DELETE CASCADE NOT NULL,
  patient_id     uuid REFERENCES public.patients(id)     ON DELETE CASCADE NOT NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  service_name   text,
  recall_date    date,
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','sent','dismissed')),
  notes          text,
  sent_at        timestamptz,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE public.recall_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recall_tasks_select" ON public.recall_tasks
  FOR SELECT USING (clinic_id = get_viewer_clinic_id()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('superadmin','chain_admin')));

CREATE POLICY "recall_tasks_insert" ON public.recall_tasks
  FOR INSERT WITH CHECK (clinic_id = get_viewer_clinic_id()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('superadmin','chain_admin')));

CREATE POLICY "recall_tasks_update" ON public.recall_tasks
  FOR UPDATE USING (clinic_id = get_viewer_clinic_id()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('superadmin','chain_admin')));

CREATE INDEX IF NOT EXISTS idx_recall_tasks_clinic  ON public.recall_tasks (clinic_id);
CREATE INDEX IF NOT EXISTS idx_recall_tasks_patient ON public.recall_tasks (patient_id, clinic_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- B9: Tip amount on invoices
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.pending_invoices
  ADD COLUMN IF NOT EXISTS tip_amount numeric(12,2) NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- B10: Injectable lot tracking per SOAP encounter
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.encounter_injectables (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  encounter_id   uuid REFERENCES public.clinical_encounters(id) ON DELETE CASCADE NOT NULL,
  clinic_id      uuid REFERENCES public.clinics(id)             ON DELETE CASCADE NOT NULL,
  product_name   text NOT NULL,
  lot_number     text,
  expiry_date    date,
  units_used     numeric(10,2),
  injection_site text,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE public.encounter_injectables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "encounter_injectables_select" ON public.encounter_injectables
  FOR SELECT USING (clinic_id = get_viewer_clinic_id()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('superadmin','chain_admin')));

CREATE POLICY "encounter_injectables_insert" ON public.encounter_injectables
  FOR INSERT WITH CHECK (clinic_id = get_viewer_clinic_id()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('superadmin','chain_admin')));

CREATE POLICY "encounter_injectables_update" ON public.encounter_injectables
  FOR UPDATE USING (clinic_id = get_viewer_clinic_id()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('superadmin','chain_admin')));

CREATE POLICY "encounter_injectables_delete" ON public.encounter_injectables
  FOR DELETE USING (clinic_id = get_viewer_clinic_id()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('superadmin','chain_admin')));

CREATE INDEX IF NOT EXISTS idx_encounter_injectables_encounter ON public.encounter_injectables (encounter_id);
CREATE INDEX IF NOT EXISTS idx_encounter_injectables_clinic    ON public.encounter_injectables (clinic_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- C2: Loyalty Tier Definitions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loyalty_tiers (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id  uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  name       text NOT NULL,
  min_points integer NOT NULL DEFAULT 0,
  color      text,
  is_global  boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.loyalty_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_tiers_select" ON public.loyalty_tiers
  FOR SELECT USING (
    is_global = true
    OR clinic_id = get_viewer_clinic_id()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('superadmin','chain_admin'))
  );

CREATE POLICY "loyalty_tiers_insert" ON public.loyalty_tiers
  FOR INSERT WITH CHECK (
    clinic_id = get_viewer_clinic_id()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('superadmin','chain_admin'))
  );

CREATE POLICY "loyalty_tiers_update" ON public.loyalty_tiers
  FOR UPDATE USING (
    clinic_id = get_viewer_clinic_id()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('superadmin','chain_admin'))
  );

CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_clinic ON public.loyalty_tiers (clinic_id);

-- Seed global tiers (safe to re-run — ON CONFLICT DO NOTHING)
INSERT INTO public.loyalty_tiers (name, min_points, color, is_global)
SELECT name, min_points, color, true FROM (VALUES
  ('Bronze',   0,    '#CD7F32'),
  ('Silver',   500,  '#94A3B8'),
  ('Gold',     2000, '#C5A059'),
  ('Platinum', 5000, '#8B7EC8')
) AS v(name, min_points, color)
WHERE NOT EXISTS (
  SELECT 1 FROM public.loyalty_tiers WHERE is_global = true AND name = v.name
);

-- ─────────────────────────────────────────────────────────────────────────────
-- C1: Loyalty Points Ledger
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loyalty_points_ledger (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id      uuid REFERENCES public.clinics(id)  ON DELETE CASCADE NOT NULL,
  patient_id     uuid REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  type           text NOT NULL CHECK (type IN ('earn','redeem','expire','referral','bonus')),
  points         integer NOT NULL,
  balance_after  integer NOT NULL,
  reference_id   uuid,
  reference_type text,
  reason         text,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE public.loyalty_points_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_points_ledger_select" ON public.loyalty_points_ledger
  FOR SELECT USING (clinic_id = get_viewer_clinic_id()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('superadmin','chain_admin')));

CREATE POLICY "loyalty_points_ledger_insert" ON public.loyalty_points_ledger
  FOR INSERT WITH CHECK (clinic_id = get_viewer_clinic_id()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('superadmin','chain_admin')));

CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_clinic  ON public.loyalty_points_ledger (clinic_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_patient ON public.loyalty_points_ledger (patient_id, clinic_id);

-- patient_tier column for quick display
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS patient_tier text NOT NULL DEFAULT 'standard';

-- ─────────────────────────────────────────────────────────────────────────────
-- C8: Patient Feedback
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.patient_feedback (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id      uuid REFERENCES public.clinics(id)      ON DELETE CASCADE NOT NULL,
  patient_id     uuid REFERENCES public.patients(id)     ON DELETE CASCADE NOT NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  rating         smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        text,
  nps_score      smallint CHECK (nps_score BETWEEN 0 AND 10),
  source         text DEFAULT 'staff' CHECK (source IN ('staff','portal')),
  submitted_at   timestamptz DEFAULT now()
);

ALTER TABLE public.patient_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_feedback_select" ON public.patient_feedback
  FOR SELECT USING (clinic_id = get_viewer_clinic_id()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('superadmin','chain_admin')));

CREATE POLICY "patient_feedback_insert" ON public.patient_feedback
  FOR INSERT WITH CHECK (clinic_id = get_viewer_clinic_id()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('superadmin','chain_admin')));

CREATE INDEX IF NOT EXISTS idx_patient_feedback_clinic  ON public.patient_feedback (clinic_id);
CREATE INDEX IF NOT EXISTS idx_patient_feedback_patient ON public.patient_feedback (patient_id, clinic_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: get_patient_loyalty(p_patient_id, p_clinic_id)
-- Returns { balance, tier, color }
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_patient_loyalty(
  p_patient_id uuid,
  p_clinic_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_balance integer;
  v_tier    text;
  v_color   text;
BEGIN
  -- Sum all points from ledger
  SELECT COALESCE(SUM(points), 0)
    INTO v_balance
    FROM loyalty_points_ledger
   WHERE patient_id = p_patient_id
     AND clinic_id  = p_clinic_id;

  -- Find highest tier whose min_points <= balance
  -- prefer clinic-specific tier, fall back to global
  SELECT name, color
    INTO v_tier, v_color
    FROM loyalty_tiers
   WHERE (clinic_id = p_clinic_id OR is_global = true)
     AND min_points <= v_balance
   ORDER BY min_points DESC
   LIMIT 1;

  -- Default to Bronze if no tier found
  IF v_tier IS NULL THEN
    v_tier  := 'Bronze';
    v_color := '#CD7F32';
  END IF;

  RETURN jsonb_build_object(
    'balance', v_balance,
    'tier',    v_tier,
    'color',   v_color
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: earn_loyalty_points(...)
-- Earns 1 point per ₹10 spent; returns new balance
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.earn_loyalty_points(
  p_patient_id     uuid,
  p_clinic_id      uuid,
  p_amount         numeric,
  p_reference_id   uuid    DEFAULT NULL,
  p_reference_type text    DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_pts         integer;
  v_current_bal integer;
  v_new_bal     integer;
BEGIN
  v_pts := FLOOR(p_amount / 10);
  IF v_pts <= 0 THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(points), 0)
    INTO v_current_bal
    FROM loyalty_points_ledger
   WHERE patient_id = p_patient_id
     AND clinic_id  = p_clinic_id;

  v_new_bal := v_current_bal + v_pts;

  INSERT INTO loyalty_points_ledger
    (clinic_id, patient_id, type, points, balance_after, reference_id, reference_type, reason)
  VALUES
    (p_clinic_id, p_patient_id, 'earn', v_pts, v_new_bal,
     p_reference_id, p_reference_type,
     'Earned on purchase of ₹' || p_amount::text);

  RETURN v_new_bal;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: redeem_loyalty_points(...)
-- Redeems points; returns ₹ discount amount (100 pts = ₹10)
-- Raises exception if insufficient balance
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.redeem_loyalty_points(
  p_patient_id   uuid,
  p_clinic_id    uuid,
  p_points       integer,
  p_reference_id uuid DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_current_bal integer;
  v_new_bal     integer;
  v_discount    numeric;
BEGIN
  SELECT COALESCE(SUM(points), 0)
    INTO v_current_bal
    FROM loyalty_points_ledger
   WHERE patient_id = p_patient_id
     AND clinic_id  = p_clinic_id;

  IF v_current_bal < p_points THEN
    RAISE EXCEPTION 'Insufficient loyalty points. Balance: %, Requested: %', v_current_bal, p_points;
  END IF;

  v_new_bal  := v_current_bal - p_points;
  v_discount := (p_points::numeric / 100) * 10;  -- 100 pts = ₹10

  INSERT INTO loyalty_points_ledger
    (clinic_id, patient_id, type, points, balance_after, reference_id, reason)
  VALUES
    (p_clinic_id, p_patient_id, 'redeem', -p_points, v_new_bal,
     p_reference_id,
     'Redeemed ' || p_points::text || ' points for ₹' || v_discount::text || ' discount');

  RETURN v_discount;
END;
$$;
