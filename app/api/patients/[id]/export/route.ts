import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Auth check
    const cookieStore = await cookies();
    const supabaseUser = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } },
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: patientId } = await params;

    // Fetch all patient data
    const [
      patientRes, historyRes, notesRes, encountersRes,
      treatmentsRes, invoicesRes, apptsRes, commsRes,
    ] = await Promise.all([
      supabaseAdmin.from("patients").select("*").eq("id", patientId).maybeSingle(),
      supabaseAdmin.from("patient_medical_history").select("*").eq("patient_id", patientId),
      supabaseAdmin.from("patient_notes").select("*").eq("patient_id", patientId),
      supabaseAdmin.from("clinical_encounters").select("*").eq("patient_id", patientId),
      supabaseAdmin.from("patient_treatments").select("*").eq("patient_id", patientId),
      supabaseAdmin.from("pending_invoices").select("*").eq("patient_id", patientId),
      supabaseAdmin.from("appointments").select("*").eq("patient_id", patientId),
      supabaseAdmin.from("patient_communications").select("*").eq("patient_id", patientId),
    ]);

    if (!patientRes.data) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

    const exportData = {
      exported_at: new Date().toISOString(),
      patient: patientRes.data,
      medical_history: historyRes.data ?? [],
      notes: notesRes.data ?? [],
      encounters: encountersRes.data ?? [],
      treatments: treatmentsRes.data ?? [],
      invoices: invoicesRes.data ?? [],
      appointments: apptsRes.data ?? [],
      communications: commsRes.data ?? [],
    };

    const patientName = (patientRes.data as Record<string, unknown>).full_name ?? "patient";
    const filename = `patient-export-${String(patientName).replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error("patient export error:", e);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
