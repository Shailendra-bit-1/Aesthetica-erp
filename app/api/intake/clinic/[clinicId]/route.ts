import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// GET /api/intake/clinic/[clinicId]
// Public: returns clinic info + specialist list for the patient intake form.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clinicId: string }> }
) {
  const { clinicId } = await params;

  if (!clinicId) {
    return NextResponse.json({ error: "clinicId is required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const [clinicRes, specialistRes] = await Promise.all([
    supabase
      .from("clinics")
      .select("id, name, location, subscription_status")
      .eq("id", clinicId)
      .single(),
    supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .not("full_name", "is", null)
      .in("role", ["doctor", "nurse", "therapist", "counsellor"])
      .order("full_name"),
  ]);

  if (clinicRes.error || !clinicRes.data) {
    return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
  }

  return NextResponse.json({
    clinic: clinicRes.data,
    specialists: specialistRes.data ?? [],
  });
}
