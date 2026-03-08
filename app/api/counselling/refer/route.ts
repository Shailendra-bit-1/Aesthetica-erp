import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// POST /api/counselling/refer
// Doctor refers patient to counsellor — creates session + notification
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
    if (!["doctor", "clinic_admin", "chain_admin", "superadmin"].includes(actor.role ?? "")) {
      return NextResponse.json({ error: "Only doctors or admins can refer patients" }, { status: 403 });
    }

    const body = await req.json() as {
      patient_id:    string;
      clinic_id:     string;
      counsellor_id: string;
      chief_complaint?: string;
      notes?: string;
    };

    if (!body.patient_id || !body.clinic_id || !body.counsellor_id) {
      return NextResponse.json({ error: "patient_id, clinic_id, counsellor_id required" }, { status: 400 });
    }

    // Create counselling session with 'pending' status
    const { data: session, error: sessErr } = await supabase
      .from("counselling_sessions")
      .insert({
        clinic_id:        body.clinic_id,
        patient_id:       body.patient_id,
        counsellor_id:    body.counsellor_id,
        session_date:     new Date().toISOString().slice(0, 10),
        chief_complaint:  body.chief_complaint ?? null,
        notes:            body.notes ?? null,
        conversion_status: "pending",
      })
      .select("id")
      .single();

    if (sessErr || !session) {
      return NextResponse.json({ error: sessErr?.message ?? "Failed to create session" }, { status: 500 });
    }

    // Notify the counsellor
    await supabase.from("notifications").insert({
      clinic_id:   body.clinic_id,
      user_id:     body.counsellor_id,
      type:        "referral",
      title:       "New Counselling Referral",
      message:     `${actor.full_name ?? "Doctor"} referred a patient for counselling.`,
      reference_type: "counselling_session",
      reference_id:   session.id,
    });

    return NextResponse.json({ success: true, session_id: session.id });
  } catch (err) {
    console.error("[counselling/refer]", err);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
