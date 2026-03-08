import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

// POST /api/patients/merge
// Body: { primary_id, secondary_id, clinic_id }
// Merges secondary patient into primary:
//   - Reassigns all records (appointments, invoices, credits, encounters, etc.) to primary_id
//   - Logs to patient_merge_log
//   - Soft-deletes secondary patient
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supa = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    );
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: actor } = await supa.from("profiles").select("role, clinic_id, full_name").eq("id", user.id).single();
    if (!actor || !["superadmin", "chain_admin", "clinic_admin"].includes(actor.role ?? "")) {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }

    const body = await req.json() as { primary_id: string; secondary_id: string; clinic_id: string };
    const { primary_id, secondary_id, clinic_id } = body;
    if (!primary_id || !secondary_id || !clinic_id) {
      return NextResponse.json({ error: "primary_id, secondary_id and clinic_id are required" }, { status: 400 });
    }
    if (primary_id === secondary_id) {
      return NextResponse.json({ error: "Cannot merge a patient with themselves" }, { status: 400 });
    }

    // Use service role for the actual merge operations
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify both patients belong to this clinic
    const { data: patients } = await admin.from("patients")
      .select("id, full_name, phone")
      .eq("clinic_id", clinic_id)
      .in("id", [primary_id, secondary_id]);

    if (!patients || patients.length < 2) {
      return NextResponse.json({ error: "One or both patients not found in this clinic" }, { status: 404 });
    }

    const secondary = patients.find(p => p.id === secondary_id);
    const primary   = patients.find(p => p.id === primary_id);

    // Tables that reference patient_id — reassign to primary
    const TABLES = [
      "appointments", "clinical_encounters", "patient_notes",
      "patient_treatments", "patient_packages", "patient_service_credits",
      "pending_invoices", "patient_medical_history", "counselling_sessions",
      "before_after_photos", "patient_events", "patient_tag_assignments",
      "patient_documents", "form_responses", "wallet_transactions",
      "patient_memberships", "prescriptions", "patient_sticky_notes",
      "patient_face_charts", "patient_communications",
    ];

    for (const table of TABLES) {
      await admin.from(table).update({ patient_id: primary_id }).eq("patient_id", secondary_id);
    }

    // Log the merge
    await admin.from("patient_merge_log").insert({
      clinic_id,
      primary_patient_id:   primary_id,
      secondary_patient_id: secondary_id,
      merged_by:            user.id,
      merged_by_name:       actor.full_name ?? null,
      secondary_snapshot:   secondary,
    });

    // Soft-delete the secondary patient
    await admin.from("patients").update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq("id", secondary_id);

    return NextResponse.json({ success: true, primary_id, secondary_id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
