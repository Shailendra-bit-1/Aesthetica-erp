import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withSupabaseRetry } from "@/lib/withRetry";

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { token, service_id, service_name, start_time, end_time, notes } = await req.json();
    if (!token || !service_id || !start_time || !end_time) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify portal token
    const { data: session } = await supabaseAdmin
      .from("portal_sessions")
      .select("patient_id, clinic_id, expires_at, is_active")
      .eq("token", token)
      .maybeSingle();

    if (!session || !session.is_active || new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ error: "Invalid or expired portal session" }, { status: 401 });
    }

    // Insert appointment with "planned" status (front desk will confirm)
    const { error } = await withSupabaseRetry(() =>
      supabaseAdmin.from("appointments").insert({
        clinic_id:    session.clinic_id,
        patient_id:   session.patient_id,
        service_id,
        service_name: service_name ?? "Appointment",
        start_time,
        end_time,
        status:       "planned",
        notes:        notes ? `[Patient-requested via portal] ${notes}` : "[Patient-requested via portal]",
      })
    );

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("portal book error:", e);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
