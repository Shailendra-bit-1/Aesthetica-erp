import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// POST /api/intake/submit
// Public — inserts into `patients` then writes full medical history
// to `patient_medical_history`.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      clinicId,
      fullName,
      phone,
      email,
      preferredSpecialist,
      concerns,
      hadPriorInjections,
      lastInjectionDate,
      injectionComplications,
      notes,
    } = body as {
      clinicId: string;
      fullName: string;
      phone: string;
      email?: string;
      preferredSpecialist?: string;
      concerns: string[];
      hadPriorInjections?: boolean | null;
      lastInjectionDate?: string;
      injectionComplications?: string;
      notes?: string;
    };

    if (!clinicId || !fullName || !phone || !concerns?.length) {
      return NextResponse.json(
        { error: "clinicId, fullName, phone, and at least one concern are required" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── Step 1: Build a human-readable injection summary for the patients table ──
    let previousInjections: string | null = null;
    if (hadPriorInjections === true) {
      const parts: string[] = [];
      if (lastInjectionDate)      parts.push(`Last treatment: ${lastInjectionDate}`);
      if (injectionComplications) parts.push(`Complications: ${injectionComplications}`);
      previousInjections = parts.length
        ? parts.join(" · ")
        : "Yes — no additional details provided";
    } else if (hadPriorInjections === false) {
      previousInjections = "No prior injections";
    }

    // ── Step 2: Insert patient row and return the new id ──────────────────────
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .insert({
        clinic_id:          clinicId,
        full_name:          fullName,
        phone,
        email:              email || null,
        primary_concern:    concerns.join(", "),
        previous_injections: previousInjections,
        notes:              notes || null,
        send_intake:        false,
      })
      .select("id")
      .single();

    if (patientError || !patient) {
      return NextResponse.json(
        { error: patientError?.message ?? "Failed to create patient record" },
        { status: 500 }
      );
    }

    // ── Step 3: Write structured medical history row ──────────────────────────
    const { error: historyError } = await supabase
      .from("patient_medical_history")
      .insert({
        patient_id:              patient.id,
        clinic_id:               clinicId,
        primary_concerns:        concerns,          // text[] — all selected concerns
        preferred_specialist:    preferredSpecialist || null,
        had_prior_injections:    hadPriorInjections ?? null,
        last_injection_date:     hadPriorInjections ? (lastInjectionDate || null) : null,
        injection_complications: hadPriorInjections ? (injectionComplications || null) : null,
        patient_notes:           notes || null,
        intake_source:           "intake_form",
      });

    // Medical history failure is non-fatal — patient row already committed.
    // Log server-side but still return success to the patient.
    if (historyError) {
      console.error("[intake/submit] patient_medical_history insert failed:", historyError.message);
    }

    return NextResponse.json({ success: true, patientId: patient.id });
  } catch (err) {
    console.error("[intake/submit] unhandled error:", err);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
