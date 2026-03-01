/**
 * checkFeature — Server-side API route gate
 * ──────────────────────────────────────────────────────────────────────────────
 * Call this at the top of any API route handler to enforce feature access.
 * Uses the service-role client + check_clinic_access() Postgres RPC so it
 * cannot be spoofed by client-side manipulation.
 *
 * Returns null  → access granted, proceed with handler.
 * Returns NextResponse → 403 or 401, return it immediately.
 *
 * Usage:
 *   export async function GET(req: NextRequest) {
 *     const deny = await checkFeature(req, "scheduler");
 *     if (deny) return deny;
 *     // ... handler logic
 *   }
 * ──────────────────────────────────────────────────────────────────────────────
 * IMPORTANT: This file is server-only. Never import it in "use client" components.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "@/src/lib/config/environment";

/** Build a service-role Supabase client (bypasses RLS) */
function adminClient() {
  return createServerClient(supabaseEnv.url, supabaseEnv.serviceRoleKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}

export async function checkFeature(
  req: NextRequest,
  featureSlug: string
): Promise<NextResponse | null> {
  try {
    // Get the user session from the request cookies
    const supabase = createServerClient(
      supabaseEnv.url,
      // Use anon key to decode the cookie-based session
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll() { /* read-only in this context */ },
        },
      }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Look up this user's clinic_id from profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("clinic_id")
      .eq("id", user.id)
      .single();

    if (!profile?.clinic_id) {
      return NextResponse.json({ error: "No clinic associated" }, { status: 403 });
    }

    // Check access via the server-verified Postgres function
    const admin = adminClient();
    const { data: allowed, error: rpcErr } = await admin.rpc("check_clinic_access", {
      p_clinic_id:    profile.clinic_id,
      p_feature_name: featureSlug,
    });

    if (rpcErr) {
      console.error("[checkFeature] RPC error:", rpcErr.message);
      return NextResponse.json({ error: "Feature check failed" }, { status: 500 });
    }

    if (!allowed) {
      return NextResponse.json(
        { error: `Feature '${featureSlug}' is not enabled for your clinic` },
        { status: 403 }
      );
    }

    // Fire-and-forget: record usage (non-blocking)
    void admin.rpc("record_feature_usage", {
      p_clinic_id:  profile.clinic_id,
      p_module_key: featureSlug,
      p_actor_id:   user.id,
    });

    return null; // Access granted
  } catch (err) {
    console.error("[checkFeature] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
