import { supabase } from "./supabase";

/**
 * HIPAA Audit Logger
 * Writes an immutable entry to audit_logs every time a patient record
 * is accessed or a privileged action is performed.
 * Failures are silently swallowed — never block the UI.
 */
export async function logAction(opts: {
  action: string;
  targetId?: string;
  targetName?: string;
  permissionKey?: string;
  oldValue?: boolean;
  newValue?: boolean;
  metadata?: Record<string, unknown>;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    await supabase.from("audit_logs").insert({
      actor_id:       user.id,
      actor_name:     profile?.full_name ?? user.email ?? "Unknown",
      target_id:      opts.targetId      ?? null,
      target_name:    opts.targetName    ?? null,
      action:         opts.action,
      permission_key: opts.permissionKey ?? null,
      old_value:      opts.oldValue      ?? null,
      new_value:      opts.newValue      ?? null,
      metadata:       opts.metadata      ?? null,
    });
  } catch {
    // Audit failures are non-fatal — never interrupt clinical workflow
  }
}
