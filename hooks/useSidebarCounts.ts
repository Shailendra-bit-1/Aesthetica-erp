"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";

export interface SidebarCounts {
  scheduler: number;
  billing: number;
  crm: number;
  inventory: number;
}

const EMPTY: SidebarCounts = { scheduler: 0, billing: 0, crm: 0, inventory: 0 };

export function useSidebarCounts(): SidebarCounts {
  const { activeClinicId: clinicId } = useClinic();
  const [counts, setCounts] = useState<SidebarCounts>(EMPTY);
  const clinicRef = useRef(clinicId);
  clinicRef.current = clinicId;

  useEffect(() => {
    if (!clinicId) return;

    async function fetchCounts() {
      const cid = clinicRef.current;
      if (!cid) return;

      const today    = new Date();
      const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const dayEnd   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

      const [
        { count: appts },
        { count: bills },
        { count: leads },
        invResult,
      ] = await Promise.all([
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", cid)
          .eq("status", "scheduled")
          .gte("start_time", dayStart)
          .lte("start_time", dayEnd),
        supabase
          .from("pending_invoices")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", cid)
          .in("status", ["pending", "overdue"]),
        supabase
          .from("crm_leads")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", cid)
          .eq("status", "new"),
        supabase
          .from("inventory_products")
          .select("current_stock, low_stock_threshold")
          .eq("clinic_id", cid),
      ]);

      const lowStock = (invResult.data ?? []).filter(
        (p) => (p.current_stock ?? 0) <= (p.low_stock_threshold ?? 0)
      ).length;

      setCounts({
        scheduler: appts    ?? 0,
        billing:   bills    ?? 0,
        crm:       leads    ?? 0,
        inventory: lowStock,
      });
    }

    fetchCounts();

    const channel = supabase
      .channel(`sidebar-counts-${clinicId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments",       filter: `clinic_id=eq.${clinicId}` }, fetchCounts)
      .on("postgres_changes", { event: "*", schema: "public", table: "pending_invoices",   filter: `clinic_id=eq.${clinicId}` }, fetchCounts)
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_leads",          filter: `clinic_id=eq.${clinicId}` }, fetchCounts)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_products", filter: `clinic_id=eq.${clinicId}` }, fetchCounts)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [clinicId]);

  return counts;
}
