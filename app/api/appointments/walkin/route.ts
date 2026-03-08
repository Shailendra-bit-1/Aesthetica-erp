import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// POST /api/appointments/walkin
// Creates a walk-in appointment bypassing the conflict check
// Body: { clinic_id, patient_id, patient_name?, provider_id?, service_id?, service_name, start_time, end_time, notes? }
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

    const body = await req.json() as {
      clinic_id:    string;
      patient_id?:  string | null;
      patient_name?: string | null;
      provider_id?: string | null;
      service_id?:  string | null;
      service_name: string;
      start_time:   string;
      end_time:     string;
      notes?:       string | null;
    };

    if (!body.clinic_id || !body.service_name || !body.start_time || !body.end_time) {
      return NextResponse.json(
        { error: "clinic_id, service_name, start_time, end_time required" },
        { status: 400 }
      );
    }

    // Direct insert — bypass create_appointment_safe conflict check (walk-in policy)
    const { data: appt, error } = await supabase
      .from("appointments")
      .insert({
        clinic_id:       body.clinic_id,
        patient_id:      body.patient_id ?? null,
        patient_name:    body.patient_name ?? "Walk-in",
        provider_id:     body.provider_id ?? null,
        service_id:      body.service_id ?? null,
        service_name:    body.service_name,
        start_time:      body.start_time,
        end_time:        body.end_time,
        status:          "arrived",        // walk-ins are immediately arrived
        is_walkin:       true,
        notes:           body.notes ?? null,
        credit_reserved: false,
        created_by:      user.id,
      })
      .select("id")
      .single();

    if (error || !appt) {
      return NextResponse.json({ error: error?.message ?? "Failed to create walk-in" }, { status: 500 });
    }

    return NextResponse.json({ success: true, appointment_id: appt.id });
  } catch (err) {
    console.error("[appointments/walkin]", err);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
