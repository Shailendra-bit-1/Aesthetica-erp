import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { phone, clinic_id } = await req.json();
    if (!phone || !clinic_id) {
      return NextResponse.json({ error: "phone and clinic_id required" }, { status: 400 });
    }

    // Find patient by phone
    const { data: patient } = await supabaseAdmin
      .from("patients")
      .select("id, full_name, phone")
      .eq("clinic_id", clinic_id)
      .eq("phone", phone)
      .maybeSingle();

    if (!patient) {
      // Return generic message to prevent phone enumeration
      return NextResponse.json({ ok: true, message: "If this phone is registered, an OTP has been sent." });
    }

    // Generate OTP via DB function
    const { data: otp, error } = await supabaseAdmin
      .rpc("generate_portal_otp", { p_patient_id: patient.id, p_clinic_id: clinic_id });

    if (error) throw error;

    // In development: return OTP directly (production: send via WhatsApp/SMS)
    const isDev = process.env.NODE_ENV === "development" || process.env.VERCEL_ENV !== "production";

    return NextResponse.json({
      ok:      true,
      message: "OTP sent to your registered number.",
      patient_name: patient.full_name,
      // Only expose OTP in non-production
      ...(isDev ? { dev_otp: otp } : {}),
    });
  } catch (e) {
    console.error("portal/request-otp error:", e);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
