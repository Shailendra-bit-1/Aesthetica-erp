/**
 * POST /api/admin/magic-link
 * Generate a magic link (OTP) for a user so a superadmin can "login as" them.
 * Opens in a new tab as a real JWT session for that user.
 * Superadmin only.
 *
 * Body: { userId: string }
 * Returns: { url: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv, appEnv } from "@/src/lib/config/environment";

function adminClient() {
  return createClient(supabaseEnv.url, supabaseEnv.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: NextRequest) {
  try {
    // Verify superadmin
    const userClient = createServerClient(
      supabaseEnv.url,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await userClient.from("profiles")
      .select("role").eq("id", user.id).single();
    if (profile?.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden — superadmin only" }, { status: 403 });
    }

    const body = await req.json() as { userId?: string; clinicId?: string };
    let userId = body.userId;

    // If clinicId provided instead of userId, find best user for that clinic
    if (!userId && body.clinicId) {
      const admin = adminClient();
      const { data: profiles } = await admin.from("profiles")
        .select("id, role")
        .eq("clinic_id", body.clinicId)
        .eq("is_active", true)
        .limit(10);
      // Prefer clinic_admin, then chain_admin, then doctor, then any
      const priority = ["clinic_admin", "chain_admin", "doctor", "therapist", "counsellor", "front_desk"];
      const sorted = (profiles ?? []).sort((a, b) => {
        const ai = priority.indexOf(a.role);
        const bi = priority.indexOf(b.role);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
      userId = sorted[0]?.id;
    }

    if (!userId) {
      return NextResponse.json({
        error: "No users found for this clinic. Add a staff member first.",
      }, { status: 404 });
    }

    // Get the target user's email
    const admin = adminClient();
    const { data: targetUser, error: userErr } = await admin.auth.admin.getUserById(userId);
    if (userErr || !targetUser?.user?.email) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate a magic link for the target user
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type:       "magiclink",
      email:      targetUser.user.email,
      options:    { redirectTo: `${appEnv.baseUrl}/` },
    });

    if (linkErr || !linkData?.properties?.action_link) {
      console.error("[magic-link] generateLink error:", linkErr);
      return NextResponse.json({ error: "Failed to generate magic link" }, { status: 500 });
    }

    return NextResponse.json({ url: linkData.properties.action_link });
  } catch (err) {
    console.error("[magic-link] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
