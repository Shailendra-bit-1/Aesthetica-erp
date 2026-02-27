"use client";

/**
 * useSchedulerV1
 * ──────────────────────────────────────────────────────────────────────────────
 * Version-stamped data hook for the Scheduler module.
 *
 * Schema-awareness rules enforced here:
 *  1. Always use an EXPLICIT column list (APPOINTMENT_COLUMNS) — never `*`.
 *     Adding new DB columns won't break this query.
 *  2. All DB results are normalized via a pure function (`normalize`) that
 *     safely handles absent joined rows, null fields, etc.
 *  3. If the appointments table schema changes (new columns), bump to v2 and
 *     keep v1 stable for any consumers still on the old contract.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Appointment,
  AppointmentStatus,
  APPOINTMENT_COLUMNS,
} from "../types";

export const HOOK_VERSION = "1.0.0" as const;

interface DateRange { start: Date; end: Date }

interface UseSchedulerV1Options {
  clinicId:  string | null;
  dateRange: DateRange;
}

interface UseSchedulerV1Return {
  appointments: Appointment[];
  loading:      boolean;
  error:        string | null;
  refetch:      () => void;
  updateStatus: (id: string, status: AppointmentStatus, patch?: Record<string, unknown>) => Promise<void>;
  reschedule:   (id: string, newStart: Date, newEnd: Date, providerId?: string) => Promise<void>;
  /** Version string — useful for debugging which hook is active */
  version:      typeof HOOK_VERSION;
}

function normalizeAppointment(raw: Record<string, unknown>): Appointment {
  return {
    ...raw,
    patient_name:  (raw.patients as { full_name: string } | null)?.full_name  ?? "Walk-in",
    patient_tier:  (raw.patients as { patient_tier: string } | null)?.patient_tier as Appointment["patient_tier"] ?? null,
    provider_name: (raw.profiles as { full_name: string } | null)?.full_name  ?? "—",
  } as Appointment;
}

export function useSchedulerV1({ clinicId, dateRange }: UseSchedulerV1Options): UseSchedulerV1Return {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from("appointments")
        .select(APPOINTMENT_COLUMNS)
        .eq("clinic_id", clinicId)
        .gte("start_time", dateRange.start.toISOString())
        .lte("start_time", dateRange.end.toISOString())
        .neq("status", "cancelled")
        .order("start_time");

      if (qErr) throw qErr;
      setAppointments((data ?? []).map(a => normalizeAppointment(a as unknown as Record<string, unknown>)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [clinicId, dateRange.start, dateRange.end]);

  useEffect(() => { refetch(); }, [refetch]);

  async function updateStatus(id: string, status: AppointmentStatus, patch: Record<string, unknown> = {}) {
    const { error: uErr } = await supabase
      .from("appointments")
      .update({ status, updated_at: new Date().toISOString(), ...patch })
      .eq("id", id);
    if (uErr) throw uErr;
    refetch();
  }

  async function reschedule(id: string, newStart: Date, newEnd: Date, providerId?: string) {
    const update: Record<string, unknown> = {
      start_time:  newStart.toISOString(),
      end_time:    newEnd.toISOString(),
      updated_at:  new Date().toISOString(),
    };
    if (providerId !== undefined) update.provider_id = providerId;
    const { error: uErr } = await supabase.from("appointments").update(update).eq("id", id);
    if (uErr) throw uErr;
    refetch();
  }

  return { appointments, loading, error, refetch, updateStatus, reschedule, version: HOOK_VERSION };
}
