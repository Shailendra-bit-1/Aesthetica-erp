import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { phone, otp, clinic_id } = await req.json();
    if (!phone || !otp || !clinic_id) {
      return NextResponse.json({ error: "phone, otp, and clinic_id required" }, { status: 400 });
    }

    // Find patient
    const { data: patient } = await supabaseAdmin
      .from("patients")
      .select("id")
      .eq("clinic_id", clinic_id)
      .eq("phone", phone)
      .maybeSingle();

    if (!patient) {
      return NextResponse.json({ error: "Invalid OTP" }, { status: 401 });
    }

    // Verify OTP via DB function
    const { data: token, error } = await supabaseAdmin
      .rpc("verify_portal_otp", {
        p_patient_id: patient.id,
        p_clinic_id:  clinic_id,
        p_otp:        otp,
      });

    if (error) {
      return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 401 });
    }

    return NextResponse.json({ ok: true, token });
  } catch (e) {
    console.error("portal/verify-otp error:", e);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
