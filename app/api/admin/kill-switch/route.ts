/**
 * PATCH /api/admin/kill-switch
 * Toggle is_globally_killed on a module_registry row.
 * Superadmin only.
 *
 * Body: { moduleKey: string; kill: boolean; reason?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "@/src/lib/config/environment";

function adminClient() {
  return createServerClient(supabaseEnv.url, supabaseEnv.serviceRoleKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}

export async function PATCH(req: NextRequest) {
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

    const { moduleKey, kill, reason } = await req.json() as {
      moduleKey: string; kill: boolean; reason?: string;
    };

    if (!moduleKey) {
      return NextResponse.json({ error: "moduleKey is required" }, { status: 400 });
    }

    const update: Record<string, unknown> = { is_globally_killed: kill };
    if (kill) {
      update.killed_at     = new Date().toISOString();
      update.killed_reason = reason ?? null;
    } else {
      update.killed_at     = null;
      update.killed_reason = null;
    }

    const admin = adminClient();
    const { error } = await admin.from("module_registry")
      .update(update).eq("module_key", moduleKey);

    if (error) {
      console.error("[kill-switch] update error:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({ success: true, moduleKey, killed: kill });
  } catch (err) {
    console.error("[kill-switch] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
