import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// POST /api/counselling/claim
// Body: { session_id, action: "claim" | "unclaim" }
// Counsellors claim/unclaim a session to prevent double-handling
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: actor } = await supabase
      .from("profiles")
      .select("id, full_name, role, clinic_id")
      .eq("id", user.id)
      .single();

    if (!actor) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

    const body = await req.json() as { session_id: string; action: "claim" | "unclaim" };
    if (!body.session_id || !body.action) {
      return NextResponse.json({ error: "session_id and action required" }, { status: 400 });
    }

    // Fetch the session
    const { data: session } = await supabase
      .from("counselling_sessions")
      .select("id, clinic_id, claimed_by, claim_status")
      .eq("id", body.session_id)
      .single();

    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    if (body.action === "claim") {
      if (session.claim_status === "claimed" && session.claimed_by !== actor.id) {
        return NextResponse.json(
          { error: "Session already claimed by another counsellor" },
          { status: 409 }
        );
      }

      const { error } = await supabase
        .from("counselling_sessions")
        .update({
          claimed_by:   actor.id,
          claimed_at:   new Date().toISOString(),
          claim_status: "claimed",
        })
        .eq("id", body.session_id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, action: "claimed" });
    }

    if (body.action === "unclaim") {
      if (session.claimed_by !== actor.id) {
        const { data: profile } = await supabase
          .from("profiles").select("role").eq("id", actor.id).single();
        if (!["superadmin", "clinic_admin", "chain_admin"].includes(profile?.role ?? "")) {
          return NextResponse.json({ error: "Can only unclaim your own sessions" }, { status: 403 });
        }
      }

      const { error } = await supabase
        .from("counselling_sessions")
        .update({
          claimed_by:   null,
          claimed_at:   null,
          claim_status: "unclaimed",
        })
        .eq("id", body.session_id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, action: "unclaimed" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("[counselling/claim]", err);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
