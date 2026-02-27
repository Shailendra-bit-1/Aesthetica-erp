"use client";
/**
 * useInventoryV1 — schema-aware inventory hook.
 * Explicit column list prevents SELECT * breakage when new columns (mrp, hsn_code) land.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const HOOK_VERSION = "1.0.0" as const;

const PRODUCT_COLUMNS =
  "id, clinic_id, supplier_id, product_name, sku, category, unit, reorder_level, " +
  "selling_price, is_active, created_at";

export interface InventoryProduct {
  id:            string;
  clinic_id?:    string | null;
  supplier_id?:  string | null;
  product_name:  string;
  sku?:          string | null;
  category?:     string | null;
  unit?:         string | null;
  reorder_level?: number;
  selling_price?: number | null;
  is_active?:    boolean;
  created_at?:   string;
  // aggregated in app layer — not in DB
  total_stock?:  number;
}

interface UseInventoryV1Options { clinicId: string | null; category?: string }
interface UseInventoryV1Return  {
  products: InventoryProduct[];
  loading:  boolean;
  error:    string | null;
  refetch:  () => void;
  version:  typeof HOOK_VERSION;
}

export function useInventoryV1({ clinicId, category }: UseInventoryV1Options): UseInventoryV1Return {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true); setError(null);
    try {
      let q = supabase.from("inventory_products").select(PRODUCT_COLUMNS).eq("clinic_id", clinicId).order("product_name");
      if (category) q = q.eq("category", category);
      const { data, error: qErr } = await q;
      if (qErr) throw qErr;
      setProducts((data ?? []) as unknown as InventoryProduct[]);
    } catch (e) { setError((e as Error).message); }
    finally    { setLoading(false); }
  }, [clinicId, category]);

  useEffect(() => { refetch(); }, [refetch]);
  return { products, loading, error, refetch, version: HOOK_VERSION };
}
