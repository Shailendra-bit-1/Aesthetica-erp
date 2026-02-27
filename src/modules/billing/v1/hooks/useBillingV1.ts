"use client";
/**
 * useBillingV1 — schema-aware billing hook.
 * Adding tax_percent, hsn_code, or discount_amount to pending_invoices will
 * not break this hook because those fields are not in the explicit column list.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const HOOK_VERSION = "1.0.0" as const;

/** v1 columns — extend in v2 when new billing fields land */
const INVOICE_COLUMNS =
  "id, clinic_id, patient_id, appointment_id, credit_id, " +
  "service_name, amount, tax_amount, total_amount, status, created_at";

export interface Invoice {
  id:             string;
  clinic_id?:     string | null;
  patient_id?:    string | null;
  appointment_id?: string | null;
  credit_id?:     string | null;
  service_name:   string;
  amount:         number;
  tax_amount?:    number | null;
  total_amount?:  number | null;
  status:         "pending" | "paid" | "cancelled";
  created_at?:    string;
}

interface UseBillingV1Options { clinicId: string | null; status?: string }
interface UseBillingV1Return  { invoices: Invoice[]; loading: boolean; error: string | null; refetch: () => void; version: typeof HOOK_VERSION }

export function useBillingV1({ clinicId, status }: UseBillingV1Options): UseBillingV1Return {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true); setError(null);
    try {
      let q = supabase.from("pending_invoices").select(INVOICE_COLUMNS).eq("clinic_id", clinicId).order("created_at", { ascending: false });
      if (status) q = q.eq("status", status);
      const { data, error: qErr } = await q;
      if (qErr) throw qErr;
      setInvoices((data ?? []) as unknown as Invoice[]);
    } catch (e) { setError((e as Error).message); }
    finally    { setLoading(false); }
  }, [clinicId, status]);

  useEffect(() => { refetch(); }, [refetch]);
  return { invoices, loading, error, refetch, version: HOOK_VERSION };
}
