import { supabase } from "./supabase";

/**
 * HIPAA Audit Logger
 * Writes an immutable entry to audit_logs every time a patient record
 * is accessed or a privileged action is performed.
 * Failures are silently swallowed — never block the UI.
 *
 * Demo suppression: if the acting user's clinic has is_demo=true, the
 * insert is skipped entirely to avoid polluting audit history.
 */
export async function logAction(opts: {
  action: string;
  targetId?: string;
  targetName?: string;
  permissionKey?: string;
  oldValue?: boolean;
  newValue?: boolean;
  clinicId?: string;
  metadata?: Record<string, unknown>;
  /** Passed when a superadmin is impersonating a clinic */
  impersonatedClinicId?: string;
  impersonatedClinicName?: string;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Demo suppression — skip audit insert for demo clinics
    if (opts.clinicId) {
      const { data: clinic } = await supabase
        .from("clinics")
        .select("is_demo")
        .eq("id", opts.clinicId)
        .single();
      if (clinic?.is_demo) return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    // Merge impersonation info into metadata
    const metadata: Record<string, unknown> = { ...(opts.metadata ?? {}) };
    if (opts.impersonatedClinicId)   metadata.impersonated_clinic_id   = opts.impersonatedClinicId;
    if (opts.impersonatedClinicName) metadata.impersonated_clinic_name = opts.impersonatedClinicName;

    await supabase.from("audit_logs").insert({
      actor_id:       user.id,
      actor_name:     profile?.full_name ?? user.email ?? "Unknown",
      clinic_id:      opts.clinicId      ?? null,
      target_id:      opts.targetId      ?? null,
      target_name:    opts.targetName    ?? null,
      action:         opts.action,
      permission_key: opts.permissionKey ?? null,
      old_value:      opts.oldValue      ?? null,
      new_value:      opts.newValue      ?? null,
      metadata:       Object.keys(metadata).length ? metadata : null,
    });
  } catch {
    // Audit failures are non-fatal — never interrupt clinical workflow
  }
}
