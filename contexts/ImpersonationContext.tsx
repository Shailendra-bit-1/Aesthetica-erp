"use client";

/**
 * ImpersonationContext
 * ──────────────────────────────────────────────────────────────────────────────
 * Allows a superadmin to "view as clinic" — all data fetches use the
 * impersonated clinic's ID. Every action while impersonating is logged to
 * audit_logs with impersonated_clinic_id set.
 *
 * Usage:
 *   const { impersonating, startImpersonation, stopImpersonation } = useImpersonation();
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { logAction } from "@/lib/audit";

// ─────────────────────────────────────── Types ───────────────────────────────

export interface ImpersonationTarget {
  clinicId:   string;
  clinicName: string;
}

interface ImpersonationCtx {
  impersonating:      ImpersonationTarget | null;
  startImpersonation: (target: ImpersonationTarget) => void;
  stopImpersonation:  () => void;
}

// ─────────────────────────────────────── Context ─────────────────────────────

const ImpersonationContext = createContext<ImpersonationCtx>({
  impersonating:      null,
  startImpersonation: () => {},
  stopImpersonation:  () => {},
});

const STORAGE_KEY = "aesthetica_impersonation";

// ─────────────────────────────────────── Provider ────────────────────────────

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [impersonating, setImpersonating] = useState<ImpersonationTarget | null>(null);

  // Restore from sessionStorage on mount (persists across page navigations)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) setImpersonating(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const startImpersonation = useCallback(async (target: ImpersonationTarget) => {
    setImpersonating(target);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(target));

    // Audit: log that a superadmin started impersonating
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      logAction({
        action:     "impersonation_start",
        targetId:   target.clinicId,
        targetName: target.clinicName,
        metadata: {
          impersonating_clinic_id:   target.clinicId,
          impersonating_clinic_name: target.clinicName,
          superadmin_id:             user.id,
        },
      });
    }
  }, []);

  const stopImpersonation = useCallback(async () => {
    const prev = impersonating;
    setImpersonating(null);
    sessionStorage.removeItem(STORAGE_KEY);

    if (prev) {
      logAction({
        action:     "impersonation_stop",
        targetId:   prev.clinicId,
        targetName: prev.clinicName,
        metadata: {
          impersonating_clinic_id:   prev.clinicId,
          impersonating_clinic_name: prev.clinicName,
        },
      });
    }
  }, [impersonating]);

  return (
    <ImpersonationContext.Provider value={{ impersonating, startImpersonation, stopImpersonation }}>
      {children}
    </ImpersonationContext.Provider>
  );
}

// ─────────────────────────────────────── Hook ────────────────────────────────

export const useImpersonation = () => useContext(ImpersonationContext);
