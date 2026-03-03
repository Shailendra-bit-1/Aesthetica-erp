import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// POST /api/intake/form-submit
// Public — saves dynamic form responses. For intake forms, also creates patient record.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { formId, clinicId, responses } = body as {
      formId: string;
      clinicId: string;
      responses: Record<string, unknown>;
    };

    if (!formId || !clinicId || !responses) {
      return NextResponse.json({ error: "formId, clinicId, and responses are required" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch form definition to determine routing
    const { data: form, error: formErr } = await supabase
      .from("form_definitions")
      .select("form_type")
      .eq("id", formId)
      .single();

    if (formErr || !form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    let patientId: string | null = null;

    // For intake forms, create the patient record using standard fields
    if (form.form_type === "intake") {
      const fullName = String(responses["full_name"] ?? responses["name"] ?? "").trim();
      const phone    = String(responses["phone"] ?? "").trim();
      const email    = String(responses["email"] ?? "").trim() || null;
      const concerns = Array.isArray(responses["concerns"]) ? responses["concerns"] as string[] : [];
      const notes    = String(responses["notes"] ?? responses["additional_notes"] ?? "").trim() || null;

      if (!fullName || !phone) {
        return NextResponse.json({ error: "full_name and phone are required for intake forms" }, { status: 400 });
      }

      const { data: patient, error: patErr } = await supabase
        .from("patients")
        .insert({
          clinic_id:       clinicId,
          full_name:       fullName,
          phone,
          email,
          primary_concern: concerns.length ? concerns : null,
          notes,
          send_intake:     false,
        })
        .select("id")
        .single();

      if (patErr || !patient) {
        return NextResponse.json({ error: patErr?.message ?? "Failed to create patient" }, { status: 500 });
      }
      patientId = patient.id;

      // Write structured medical history if any clinical fields are present
      const hadInjections = responses["had_prior_injections"];
      if (concerns.length || hadInjections !== undefined) {
        await supabase.from("patient_medical_history").insert({
          patient_id:           patientId,
          clinic_id:            clinicId,
          primary_concerns:     concerns.length ? concerns : null,
          had_prior_injections: hadInjections != null ? Boolean(hadInjections) : null,
          patient_notes:        notes,
          intake_source:        "dynamic_form",
        });
      }
    }

    // Always write to form_responses
    const { error: respErr } = await supabase.from("form_responses").insert({
      clinic_id:    clinicId,
      form_id:      formId,
      patient_id:   patientId,
      responses,
    });

    if (respErr) {
      console.error("[form-submit] form_responses insert failed:", respErr.message);
    }

    return NextResponse.json({ success: true, patientId });
  } catch (err) {
    console.error("[intake/form-submit] unhandled error:", err);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
