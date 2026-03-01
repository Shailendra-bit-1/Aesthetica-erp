/**
 * DELETE /api/admin/demo/clear
 * Removes all data for a demo clinic (patients, modules, encounters, etc.)
 * then deletes the clinic record itself.
 * Superadmin only. Uses service role.
 *
 * Body: { clinicId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/src/lib/config/environment";

function adminClient() {
  return createClient(supabaseEnv.url, supabaseEnv.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function DELETE(req: NextRequest) {
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

    const { clinicId } = await req.json() as { clinicId: string };
    if (!clinicId) {
      return NextResponse.json({ error: "clinicId is required" }, { status: 400 });
    }

    const admin = adminClient();

    // Safety check: only allow deleting demo clinics
    const { data: clinic } = await admin.from("clinics")
      .select("id, is_demo").eq("id", clinicId).single();
    if (!clinic?.is_demo) {
      return NextResponse.json({ error: "Can only clear demo clinics" }, { status: 403 });
    }

    // Delete all clinic-scoped data (cascade handles most via FK ON DELETE CASCADE)
    // Explicitly clear tables that may not cascade
    await Promise.all([
      admin.from("patients").delete().eq("clinic_id", clinicId),
      admin.from("clinic_modules").delete().eq("clinic_id", clinicId),
      admin.from("feature_usage_log").delete().eq("clinic_id", clinicId),
      admin.from("profiles").delete().eq("clinic_id", clinicId),
      admin.from("audit_logs").delete().eq("clinic_id", clinicId),
    ]);

    // Finally delete the clinic itself
    const { error } = await admin.from("clinics").delete().eq("id", clinicId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, clinicId });
  } catch (err) {
    console.error("[demo/clear] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
