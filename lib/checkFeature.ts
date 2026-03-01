/**
 * checkFeature — Server-side feature gate middleware
 * ──────────────────────────────────────────────────────────────────────────────
 * Calls the Supabase `is_feature_enabled(clinic_id, feature_slug)` Postgres
 * function. Returns a 403 NextResponse if the feature is disabled or expired.
 *
 * Usage in an API route:
 *   const gate = await checkFeature(req, "inventory");
 *   if (gate) return gate;           // 403 if locked
 *   // ... proceed with handler
 *
 * Rules (from CLAUDE.md):
 *   All new modules MUST call checkFeature at the top of their API route.
 *   No feature is active by default unless explicitly enabled in God Mode.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient }        from "@supabase/ssr";
import { cookies }                   from "next/headers";

// ── Admin roles that bypass feature gates ─────────────────────────────────────
const BYPASS_ROLES = new Set(["superadmin", "chain_admin", "clinic_admin"]);

// ─────────────────────────────────────────────────────────────────────────────

export async function checkFeature(
  _req: NextRequest,
  featureSlug: string
): Promise<NextResponse | null> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch { /* server component — ignore */ }
        },
      },
    }
  );

  // ── Get authenticated user ──────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Fetch profile (role + clinic_id) ───────────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, clinic_id")
    .eq("id", user.id)
    .maybeSingle();

  // Admins bypass all feature gates
  if (profile?.role && BYPASS_ROLES.has(profile.role)) return null;

  const clinicId = profile?.clinic_id;
  if (!clinicId) {
    return NextResponse.json(
      { error: "No clinic associated with this account" },
      { status: 403 }
    );
  }

  // ── Call the Postgres is_feature_enabled function ──────────────────────────
  const { data: enabled, error } = await supabase
    .rpc("is_feature_enabled", { p_clinic_id: clinicId, p_feature_slug: featureSlug });

  if (error) {
    console.error("[checkFeature] RPC error:", error.message);
    // Fail open on RPC errors — don't block users due to DB issues
    return null;
  }

  if (!enabled) {
    return NextResponse.json(
      {
        error:   "Feature not enabled",
        feature: featureSlug,
        message: `The '${featureSlug}' feature is not enabled for your clinic. Contact your admin to enable it in God Mode.`,
      },
      { status: 403 }
    );
  }

  return null; // Feature is enabled — proceed
}
