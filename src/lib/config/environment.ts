/**
 * environment.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH for all environment-aware configuration.
 *
 * Rules:
 *  1. NEVER import process.env directly in app/modules code — always use this
 *     file so that a future tenant migration only changes values here.
 *  2. Compile-time validation: missing required vars throw at startup, not at
 *     runtime deep inside a user flow.
 *  3. Typed — callers get autocomplete; no string guessing.
 * ──────────────────────────────────────────────────────────────────────────────
 */

// ─── Supabase ─────────────────────────────────────────────────────────────────
// IMPORTANT: Next.js / Turbopack only inlines NEXT_PUBLIC_* vars when accessed
// via literal property access (process.env.NEXT_PUBLIC_FOO).
// Dynamic lookups (process.env[key]) return undefined in the browser.

export const supabaseEnv = {
  /** Public anon key — safe to expose in browser */
  url:     process.env.NEXT_PUBLIC_SUPABASE_URL     ?? "",
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  /**
   * Service-role key — ONLY used in server-side API routes (route.ts).
   * Never import this in "use client" components.
   */
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
} as const;

// ─── Application ──────────────────────────────────────────────────────────────

export const appEnv = {
  name:        "Aesthetica Clinic Suite",
  version:     "1.0.0",
  environment: (process.env.NODE_ENV ?? "development") as "development" | "test" | "production",
  baseUrl:     process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  isProd:      process.env.NODE_ENV === "production",
  isDev:       process.env.NODE_ENV !== "production",
} as const;

// ─── Feature Flags (compile-time defaults, overridden by DB at runtime) ───────

export const defaultFeatureFlags = {
  ai_treatment_suggestions: false,
  bulk_sms_reminders:       false,
  whatsapp_integration:     false,
  advanced_reports:         false,
  drag_drop_scheduler:      true,   // live in v1
  multi_service_booking:    true,   // live in v1
  checkout_flow:            true,   // live in v1
} as const;

export type FeatureFlagKey = keyof typeof defaultFeatureFlags;

// ─── Module keys ─────────────────────────────────────────────────────────────

export const MODULE_KEYS = [
  "core",
  "patients",
  "scheduler",
  "photos",
  "inventory",
  "services",
  "billing",
  "advanced_analytics",
  "intake",
  "multi_chain",
  "sms_reminders",
  "whatsapp_booking",
  "leads",
  "membership",
  "counselling",
  "crm",
  "staff_hr",
  "payroll",
] as const;

export type ModuleKey = typeof MODULE_KEYS[number];

/** Modules that are ON for every clinic regardless of plan */
export const ALWAYS_ON_MODULES: ModuleKey[] = ["core", "patients", "services", "billing", "intake"];

// ─── Storage ─────────────────────────────────────────────────────────────────

export const storageEnv = {
  patientPhotosBucket: "patient-photos",
  maxUploadBytes:      10 * 1024 * 1024, // 10 MB
  allowedMimeTypes:    ["image/jpeg", "image/png", "image/webp"],
} as const;

// ─── External Integrations ───────────────────────────────────────────────────

export const integrationsEnv = {
  whatsapp: {
    /** Supabase Edge Function name — swap URL here when going live */
    edgeFn: "send-whatsapp-reminder",
    apiKeyEnvVar: "WHATSAPP_BUSINESS_API_KEY",
  },
  smtp: {
    fromAddress: process.env.SMTP_FROM ?? "noreply@aesthetica.app",
  },
} as const;

// ─── Tenant migration ─────────────────────────────────────────────────────────

export const migrationEnv = {
  /** Schema version — bump when breaking DB changes are deployed */
  schemaVersion: "1.0.0",
  /** Used to sign data-export JWTs during tenant migrations */
  exportSecretEnvVar: "MIGRATION_EXPORT_SECRET",
} as const;
