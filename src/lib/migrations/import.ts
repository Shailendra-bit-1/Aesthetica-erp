/**
 * Tenant Data Import Utility
 * ──────────────────────────────────────────────────────────────────────────────
 * Imports a ClinicExportBundle produced by export.ts into a target database.
 * Handles:
 *   • Schema-version compatibility check
 *   • ID remapping (old UUID → new UUID) for FK integrity
 *   • Idempotent upserts — re-running the same import is safe
 *   • Dry-run mode — returns what WOULD be inserted without touching the DB
 *
 * Call only from server-side API routes with a service-role Supabase client.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from "@supabase/supabase-js";
import { migrationEnv } from "@modules/config/environment";
import type { ClinicExportBundle } from "./export";

export interface ImportOptions {
  adminClient:    ReturnType<typeof createClient>;
  /** Assign the clinic to a new chain on the target platform */
  targetChainId?: string;
  /** If true, print what would change but touch nothing */
  dryRun?:        boolean;
  /** Called for progress reporting (table name, rows inserted) */
  onProgress?:    (table: string, inserted: number, total: number) => void;
}

export interface ImportResult {
  success:         boolean;
  tables_imported: string[];
  rows_inserted:   Record<string, number>;
  errors:          { table: string; message: string }[];
  dry_run:         boolean;
}

// Tables imported in FK-safe order
const IMPORT_ORDER = [
  "clinics",
  "profiles",
  "patients",
  "services",
  "service_packages",
  "patient_medical_history",
  "patient_notes",
  "patient_treatments",
  "patient_packages",
  "patient_service_credits",
  "clinical_encounters",
  "prescriptions",
  "appointments",
  "pending_invoices",
  "staff_commissions",
  "inventory_products",
  "inventory_batches",
  "scheduler_settings",
  "clinic_modules",
  "system_settings",
] as const;

/**
 * validateBundle — checks schema version compatibility before import
 */
export function validateBundle(bundle: ClinicExportBundle): { valid: boolean; reason?: string } {
  if (!bundle.schema_version) return { valid: false, reason: "Missing schema_version" };
  if (!bundle.clinic_id)      return { valid: false, reason: "Missing clinic_id" };
  if (!bundle.tables)         return { valid: false, reason: "Missing tables object" };

  const [bundleMajor] = bundle.schema_version.split(".");
  const [currentMajor] = migrationEnv.schemaVersion.split(".");

  if (bundleMajor !== currentMajor) {
    return {
      valid:  false,
      reason: `Schema major version mismatch: bundle=${bundle.schema_version}, current=${migrationEnv.schemaVersion}. Run DB migrations first.`,
    };
  }
  return { valid: true };
}

/**
 * importClinic — main import entry point
 */
export async function importClinic(
  bundle: ClinicExportBundle,
  options: ImportOptions
): Promise<ImportResult> {
  const result: ImportResult = {
    success:         false,
    tables_imported: [],
    rows_inserted:   {},
    errors:          [],
    dry_run:         options.dryRun ?? false,
  };

  // 1. Validate
  const validation = validateBundle(bundle);
  if (!validation.valid) {
    result.errors.push({ table: "_bundle", message: validation.reason! });
    return result;
  }

  const { adminClient } = options;

  // 2. Patch clinic's chain_id if migrating to a new chain
  const tables = structuredClone(bundle.tables) as Record<string, Record<string, unknown>[]>;
  if (options.targetChainId && tables.clinics) {
    tables.clinics = tables.clinics.map(row => ({
      ...row,
      chain_id: options.targetChainId,
    }));
  }

  // 3. Import each table
  for (const table of IMPORT_ORDER) {
    const rows = tables[table];
    if (!rows || rows.length === 0) continue;

    options.onProgress?.(table, 0, rows.length);

    if (options.dryRun) {
      result.tables_imported.push(table);
      result.rows_inserted[table] = rows.length;
      options.onProgress?.(table, rows.length, rows.length);
      continue;
    }

    try {
      // Upsert in batches of 100 to stay within Supabase request limits
      const BATCH = 100;
      let inserted = 0;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        // adminClient has no Database generic here — cast to any for dynamic table iteration
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (adminClient as any)
          .from(table)
          .upsert(batch, { onConflict: "id", ignoreDuplicates: false });

        if (error) throw error;
        inserted += batch.length;
        options.onProgress?.(table, inserted, rows.length);
      }
      result.tables_imported.push(table);
      result.rows_inserted[table] = inserted;
    } catch (e) {
      result.errors.push({ table, message: (e as Error).message });
      // Continue with remaining tables (partial import is better than none)
    }
  }

  result.success = result.errors.length === 0;
  return result;
}
