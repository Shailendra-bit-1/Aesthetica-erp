"use client";

/**
 * ImpersonationContext
 * ──────────────────────────────────────────────────────────────────────────────
 * Allows a superadmin to "view as" a clinic without changing their JWT.
 * State persists to sessionStorage (H-9 fix: not sessionStorage, so it is not
 * readable across tabs and is cleared when the browser session ends).
 *
 * Usage:
 *   const { isImpersonating, impersonated, startImpersonation, stopImpersonation, auditMeta } = useImpersonation();
 * ──────────────────────────────────────────────────────────────────────────────
 */

import React, { createContext, useContext, useEffect, useState } from "react";

interface ImpersonatedClinic {
  clinicId:   string;
  clinicName: string;
}

interface ImpersonationState {
  isImpersonating: boolean;
  impersonated:    ImpersonatedClinic | null;
  startImpersonation: (clinicId: string, clinicName: string) => void;
  stopImpersonation:  () => void;
  /** Returns metadata object to spread into logAction() calls */
  auditMeta: () => { impersonated_clinic_id?: string; impersonated_clinic_name?: string };
}

const STORAGE_KEY = "aesthetica_impersonation";

const ImpersonationContext = createContext<ImpersonationState | null>(null);

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const [impersonated, setImpersonated] = useState<ImpersonatedClinic | null>(null);

  // Restore from sessionStorage on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ImpersonatedClinic;
        if (parsed.clinicId && parsed.clinicName) {
          setImpersonated(parsed);
        }
      }
    } catch {
      // Corrupt storage — ignore
    }
  }, []);

  function startImpersonation(clinicId: string, clinicName: string) {
    const value: ImpersonatedClinic = { clinicId, clinicName };
    setImpersonated(value);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* noop */ }
  }

  function stopImpersonation() {
    setImpersonated(null);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }

  function auditMeta() {
    if (!impersonated) return {};
    return {
      impersonated_clinic_id:   impersonated.clinicId,
      impersonated_clinic_name: impersonated.clinicName,
    };
  }

  return (
    <ImpersonationContext.Provider
      value={{
        isImpersonating: impersonated !== null,
        impersonated,
        startImpersonation,
        stopImpersonation,
        auditMeta,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation(): ImpersonationState {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error("useImpersonation must be used inside <ImpersonationProvider>");
  return ctx;
}
