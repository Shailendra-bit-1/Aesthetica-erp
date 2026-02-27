"use client";
/**
 * usePatientsV1  — schema-aware patient list hook.
 * EXPLICIT column select: adding date_of_birth, fitzpatrick_type, allergies etc.
 * to the DB will never break this query because we never SELECT *.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const HOOK_VERSION = "1.0.0" as const;

/** Core patient columns fetched in the list view */
const PATIENT_LIST_COLUMNS =
  "id, clinic_id, full_name, email, phone, patient_tier, no_show_count, primary_concern, created_at";

export interface PatientListItem {
  id:              string;
  clinic_id:       string;
  full_name:       string;
  email?:          string | null;
  phone?:          string | null;
  patient_tier?:   "vip" | "hni" | "standard" | null;
  no_show_count?:  number;
  primary_concern?: string[] | null;
  created_at?:     string;
}

interface UsePatientsV1Options {
  clinicId: string | null;
  search?:  string;
  limit?:   number;
}

interface UsePatientsV1Return {
  patients: PatientListItem[];
  loading:  boolean;
  error:    string | null;
  refetch:  () => void;
  version:  typeof HOOK_VERSION;
}

export function usePatientsV1({ clinicId, search = "", limit = 50 }: UsePatientsV1Options): UsePatientsV1Return {
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true); setError(null);
    try {
      let q = supabase.from("patients").select(PATIENT_LIST_COLUMNS).eq("clinic_id", clinicId).order("full_name").limit(limit);
      if (search.trim().length >= 2) {
        q = q.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
      }
      const { data, error: qErr } = await q;
      if (qErr) throw qErr;
      setPatients((data ?? []) as PatientListItem[]);
    } catch (e) { setError((e as Error).message); }
    finally    { setLoading(false); }
  }, [clinicId, search, limit]);

  useEffect(() => { refetch(); }, [refetch]);
  return { patients, loading, error, refetch, version: HOOK_VERSION };
}
