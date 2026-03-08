import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    // Auth check — must be clinic_admin or superadmin
    const cookieStore = await cookies();
    const supabaseUser = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } },
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!profile || !["superadmin", "clinic_admin"].includes(profile.role ?? "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: patientId } = await params;
    const { hard } = await req.json().catch(() => ({ hard: false }));

    if (hard && profile.role === "superadmin") {
      // Hard delete — superadmin only
      await supabaseAdmin.from("patients").delete().eq("id", patientId);
    } else {
      // Soft delete: anonymize PHI, set is_deleted flag
      await supabaseAdmin.from("patients").update({
        is_deleted:  true,
        deleted_at:  new Date().toISOString(),
        full_name:   "Deleted Patient",
        phone:       null,
        email:       null,
        date_of_birth: null,
        intake_notes: null,
        notes:       null,
        allergies:   null,
        primary_concern: null,
      }).eq("id", patientId);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("patient delete error:", e);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
