import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const token = req.nextUrl.searchParams.get("token");
    if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

    // Validate session
    const { data: session } = await supabaseAdmin
      .from("patient_portal_sessions")
      .select("patient_id, clinic_id, expires_at, is_active")
      .eq("token", token)
      .maybeSingle();

    if (!session || !session.is_active || new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ error: "Session expired or invalid" }, { status: 401 });
    }

    // Update last_accessed_at
    supabaseAdmin.from("patient_portal_sessions")
      .update({ last_accessed_at: new Date().toISOString() })
      .eq("token", token)
      .then(() => {});

    const { patient_id: patientId, clinic_id: clinicId } = session;

    // Fetch patient + appointments + invoices + wallet + loyalty + photos + referral code
    const [patientRes, apptRes, invoiceRes, walletRes, loyaltyRes, photosRes, refCodeRes] = await Promise.all([
      supabaseAdmin.from("patients").select("id, full_name, phone, email, date_of_birth, wallet_balance, referral_code").eq("id", patientId).single(),
      supabaseAdmin.from("appointments")
        .select("id, start_time, end_time, status, service_name, notes, profiles!provider_id(full_name)")
        .eq("patient_id", patientId)
        .eq("clinic_id", clinicId)
        .gte("start_time", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .order("start_time", { ascending: false })
        .limit(20),
      supabaseAdmin.from("pending_invoices")
        .select("id, invoice_number, service_name, total_amount, status, created_at, paid_at")
        .eq("patient_id", patientId)
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin.from("wallet_transactions")
        .select("id, type, amount, balance_after, reason, created_at")
        .eq("patient_id", patientId)
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin.rpc("get_patient_loyalty", { p_patient_id: patientId, p_clinic_id: clinicId }).single(),
      supabaseAdmin.from("clinical_encounters")
        .select("id, created_at, photos")
        .eq("patient_id", patientId)
        .eq("clinic_id", clinicId)
        .not("photos", "is", null)
        .order("created_at", { ascending: false })
        .limit(10),
      supabaseAdmin.from("referral_codes")
        .select("code, uses_count, reward_wallet_amount")
        .eq("patient_id", patientId)
        .eq("clinic_id", clinicId)
        .maybeSingle(),
    ]);

    // Auto-create referral code if none exists
    let referralCode = refCodeRes.data?.code ?? null;
    if (!referralCode) {
      const shortName = (patientRes.data?.full_name ?? "PAT").replace(/\s+/g,"").slice(0,4).toUpperCase();
      const newCode = `${shortName}${Math.random().toString(36).slice(2,6).toUpperCase()}`;
      const { data: newRef } = await supabaseAdmin.from("referral_codes").insert({
        clinic_id:            clinicId,
        patient_id:           patientId,
        code:                 newCode,
        reward_wallet_amount: 250,
      }).select("code").maybeSingle();
      referralCode = newRef?.code ?? null;
    }

    return NextResponse.json({
      clinic_id:    clinicId,
      patient:      patientRes.data,
      appointments: apptRes.data ?? [],
      invoices:     invoiceRes.data ?? [],
      wallet: {
        transactions: walletRes.data ?? [],
        balance:      patientRes.data?.wallet_balance ?? 0,
      },
      loyalty:      loyaltyRes.data ?? { balance: 0, tier: "Bronze", color: "#CD7F32" },
      photos:       photosRes.data ?? [],
      referral: {
        code:                referralCode,
        uses_count:          refCodeRes.data?.uses_count ?? 0,
        reward_wallet_amount: refCodeRes.data?.reward_wallet_amount ?? 250,
      },
    });
  } catch (e) {
    console.error("portal/data error:", e);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
