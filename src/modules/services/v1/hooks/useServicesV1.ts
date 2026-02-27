"use client";

/**
 * useServicesV1
 * ──────────────────────────────────────────────────────────────────────────────
 * Schema-aware data hook for the Services & Packages module.
 *
 * When the team adds `mrp` or `tax_percent` columns to the services table,
 * this hook DOES NOT need to change — those fields are optional in the type.
 * Callers that want the new fields bump to useServicesV2.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Service, ServicePackage, SERVICE_COLUMNS, PACKAGE_COLUMNS } from "../types";

export const HOOK_VERSION = "1.0.0" as const;

interface UseServicesV1Options {
  clinicId:     string | null;
  isSuperAdmin?: boolean;
}

interface UseServicesV1Return {
  services:  Service[];
  packages:  ServicePackage[];
  loading:   boolean;
  error:     string | null;
  refetch:   () => void;
  version:   typeof HOOK_VERSION;
}

export function useServicesV1({ clinicId, isSuperAdmin = false }: UseServicesV1Options): UseServicesV1Return {
  const [services, setServices] = useState<Service[]>([]);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!clinicId && !isSuperAdmin) return;
    setLoading(true);
    setError(null);
    try {
      // Build clinic-scoped OR global-template queries
      const scopeFilter = isSuperAdmin
        ? supabase.from("services").select(SERVICE_COLUMNS).eq("is_active", true)
        : supabase.from("services").select(SERVICE_COLUMNS).eq("is_active", true)
            .or(`clinic_id.eq.${clinicId},is_global_template.eq.true`);

      const pkgScopeFilter = isSuperAdmin
        ? supabase.from("service_packages").select(PACKAGE_COLUMNS).eq("is_active", true)
        : supabase.from("service_packages").select(PACKAGE_COLUMNS).eq("is_active", true)
            .or(`clinic_id.eq.${clinicId},is_global_template.eq.true`);

      const [svcRes, pkgRes] = await Promise.all([
        scopeFilter.order("name"),
        pkgScopeFilter.order("name"),
      ]);

      if (svcRes.error) throw svcRes.error;
      if (pkgRes.error) throw pkgRes.error;

      setServices((svcRes.data ?? []) as Service[]);
      setPackages((pkgRes.data ?? []) as ServicePackage[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [clinicId, isSuperAdmin]);

  useEffect(() => { refetch(); }, [refetch]);

  return { services, packages, loading, error, refetch, version: HOOK_VERSION };
}
