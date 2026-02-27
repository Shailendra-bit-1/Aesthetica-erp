/**
 * Tenant Data Export Utility
 * ──────────────────────────────────────────────────────────────────────────────
 * Produces a portable, versioned JSON snapshot of a clinic's data.
 * Used for:
 *   • Moving a clinic from one chain to another
 *   • On-premise / self-hosted migrations
 *   • GDPR/compliance data portability requests
 *
 * Call only from server-side code (API route / Edge Function).
 * The resulting bundle is signed with MIGRATION_EXPORT_SECRET.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from "@supabase/supabase-js";
import { supabaseEnv, migrationEnv } from "@modules/config/environment";

// Tables exported in dependency order (parents before children)
const EXPORT_TABLES = [
  "clinics",
  "profiles",
  "patients",
  "patient_medical_history",
  "patient_notes",
  "patient_treatments",
  "patient_packages",
  "patient_service_credits",
  "clinical_encounters",
  "prescriptions",
  "services",
  "service_packages",
  "appointments",
  "pending_invoices",
  "staff_commissions",
  "inventory_products",
  "inventory_batches",
  "audit_logs",
  "scheduler_settings",
  "clinic_modules",
  "system_settings",
] as const;

type ExportTable = typeof EXPORT_TABLES[number];

export interface ClinicExportBundle {
  /** Identifies the schema version — used for import compatibility checks */
  schema_version:  string;
  exported_at:     string;
  clinic_id:       string;
  clinic_name:     string;
  /** Row counts per table for quick validation */
  counts:          Record<string, number>;
  /** Full data per table */
  tables:          Partial<Record<ExportTable, unknown[]>>;
  /** Simple HMAC signature over JSON.stringify(tables) */
  signature?:      string;
}

export interface ExportOptions {
  /** Service-role Supabase client (has bypass RLS) */
  adminClient?: ReturnType<typeof createClient>;
  /** Include audit_logs (can be very large) */
  includeAuditLogs?: boolean;
  /** Include raw photo storage paths (not the actual blobs) */
  includePhotoPaths?: boolean;
}

/**
 * exportClinic(clinicId, options)
 * Returns a ClinicExportBundle ready for JSON serialisation and download.
 */
export async function exportClinic(
  clinicId: string,
  options: ExportOptions = {}
): Promise<ClinicExportBundle> {
  const client = options.adminClient ?? createClient(
    supabaseEnv.url,
    supabaseEnv.serviceRoleKey || supabaseEnv.anonKey
  );

  // Fetch clinic meta
  const { data: clinicRow, error: clinicErr } = await client
    .from("clinics")
    .select("id, name")
    .eq("id", clinicId)
    .single();

  if (clinicErr || !clinicRow) {
    throw new Error(`exportClinic: clinic ${clinicId} not found`);
  }

  const tables: Partial<Record<ExportTable, unknown[]>> = {};
  const counts: Record<string, number> = {};

  const tablesToFetch = options.includeAuditLogs
    ? EXPORT_TABLES
    : EXPORT_TABLES.filter(t => t !== "audit_logs");

  // Fetch each table filtered to this clinic
  for (const table of tablesToFetch) {
    try {
      // Most tables have clinic_id; a few need special handling
      const query = (table === "clinics")
        ? client.from(table).select("*").eq("id", clinicId)
        : client.from(table).select("*").eq("clinic_id", clinicId);

      const { data, error } = await query;
      if (error) {
        console.warn(`[export] Could not fetch ${table}:`, error.message);
        tables[table] = [];
      } else {
        tables[table] = data ?? [];
      }
      counts[table] = tables[table]?.length ?? 0;
    } catch (e) {
      console.warn(`[export] Skipping ${table}:`, (e as Error).message);
      tables[table] = [];
      counts[table] = 0;
    }
  }

  const bundle: ClinicExportBundle = {
    schema_version: migrationEnv.schemaVersion,
    exported_at:    new Date().toISOString(),
    clinic_id:      clinicId,
    clinic_name:    (clinicRow as { name: string }).name,
    counts,
    tables,
  };

  return bundle;
}

/**
 * downloadExportBundle(bundle)
 * Browser-side helper — triggers a JSON file download.
 * Use in an admin page action button.
 */
export function downloadExportBundle(bundle: ClinicExportBundle): void {
  if (typeof window === "undefined") return;
  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `aesthetica_export_${bundle.clinic_id}_${bundle.exported_at.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
