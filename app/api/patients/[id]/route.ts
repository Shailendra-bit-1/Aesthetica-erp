import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { logAction } from "@/lib/audit";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Resolve caller's role + clinic_id from their session cookie
async function getCallerProfile(): Promise<{ id: string; full_name: string | null; role: string; clinic_id: string | null } | null> {
  try {
    const cookieStore = await cookies();
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (toSet) =>
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            ),
        },
      }
    );
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;

    const { data: profile } = await adminClient()
      .from("profiles")
      .select("id, full_name, role, clinic_id")
      .eq("id", user.id)
      .single();

    return profile ?? null;
  } catch {
    return null;
  }
}

// GET /api/patients/[id]  — full EMR bundle, scoped by clinic
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = adminClient();
  const caller = await getCallerProfile();

  // Build base patient query; join provider name from profiles
  let patientQuery = supabase
    .from("patients")
    .select("*, provider:profiles!preferred_provider_id(full_name)")
    .eq("id", id);
  if (caller && caller.role !== "superadmin" && caller.clinic_id) {
    patientQuery = patientQuery.eq("clinic_id", caller.clinic_id);
  }

  const { data: rawPatient, error: patientErr } = await patientQuery.single();
  if (patientErr || !rawPatient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  // Flatten provider name so frontend gets `preferred_provider: string | null`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { provider, ...rest } = rawPatient as any;
  const patient = {
    ...rest,
    preferred_provider: (provider as { full_name: string } | null)?.full_name ?? null,
  };

  // Parallel fetch — graceful null on missing tables
  const [historyRes, notesRes, encRes, treatRes, pkgRes] = await Promise.all([
    supabase
      .from("patient_medical_history")
      .select("*")
      .eq("patient_id", id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("patient_notes")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false }),

    supabase
      .from("clinical_encounters")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false }),

    supabase
      .from("patient_treatments")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false }),

    supabase
      .from("patient_packages")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    patient,
    medicalHistory:  historyRes.data  ?? null,
    notes:           notesRes.data    ?? [],
    encounters:      encRes.data      ?? [],
    treatments:      treatRes.data    ?? [],
    packages:        pkgRes.data      ?? [],
  });
}

// POST /api/patients/[id]  — write operations
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body     = await req.json();
  const supabase = adminClient();
  const caller   = await getCallerProfile();

  // ── Save SOAP encounter ──────────────────────────────────────────────────
  if (body.action === "save_encounter") {
    const { subjective, objective, assessment, plan, photos, created_by_name, cpt_codes } = body as {
      subjective?: string;
      objective?: string;
      assessment?: string;
      plan?: string;
      photos?: { url: string; type: string; caption?: string }[];
      created_by_name?: string;
      cpt_codes?: string[];
    };

    const { data, error } = await supabase
      .from("clinical_encounters")
      .insert({
        patient_id:       id,
        clinic_id:        caller?.clinic_id ?? null,
        subjective:       subjective?.trim()  || null,
        objective:        objective?.trim()   || null,
        assessment:       assessment?.trim()  || null,
        plan:             plan?.trim()        || null,
        photos:           photos ?? [],
        cpt_codes:        cpt_codes ?? [],
        created_by_name:  created_by_name?.trim() || "Provider",
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    logAction({
      clinicId:   caller?.clinic_id ?? undefined,
      action:     "encounter.create",
      targetId:   id,
      targetName: `SOAP by ${created_by_name ?? "Provider"}`,
    });
    return NextResponse.json({ success: true, encounterId: data?.id });
  }

  // ── Add plain note ───────────────────────────────────────────────────────
  if (body.action === "add_note") {
    const { note_type, content, author_name } = body as {
      note_type: string; content: string; author_name?: string;
    };
    if (!note_type || !content?.trim()) {
      return NextResponse.json({ error: "note_type and content required" }, { status: 400 });
    }
    const { error } = await supabase.from("patient_notes").insert({
      patient_id:  id,
      note_type,
      content:     content.trim(),
      author_name: author_name?.trim() || "Staff",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    logAction({
      clinicId:   caller?.clinic_id ?? undefined,
      action:     "note.create",
      targetId:   id,
      targetName: `${note_type} note`,
    });
    return NextResponse.json({ success: true });
  }

  // ── Add proposed treatment ───────────────────────────────────────────────
  if (body.action === "add_treatment") {
    const { treatment_name, price, quoted_price, mrp, discount_pct,
            package_type, counselled_by, counselling_session_id, notes,
            recommended_sessions } = body;
    const { error } = await supabase.from("patient_treatments").insert({
      patient_id:              id,
      clinic_id:               caller?.clinic_id ?? null,
      treatment_name,
      status:                  "proposed",
      price:                   price         ? parseFloat(price)         : null,
      quoted_price:            quoted_price  ? parseFloat(quoted_price)  : null,
      mrp:                     mrp           ? parseFloat(mrp)           : null,
      discount_pct:            discount_pct  ? parseFloat(discount_pct)  : null,
      package_type:            package_type  || null,
      counselled_by:           counselled_by || null,
      counselling_session_id:  counselling_session_id || null,
      notes:                   notes         || null,
      recommended_sessions:    recommended_sessions ? parseInt(recommended_sessions) : null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    logAction({
      clinicId:   caller?.clinic_id ?? undefined,
      action:     "treatment.propose",
      targetId:   id,
      targetName: treatment_name,
    });
    return NextResponse.json({ success: true });
  }

  // ── Add sticky note ─────────────────────────────────────────────────────
  if (body.action === "add_sticky_note") {
    const { content, color } = body as { content: string; color?: string };
    if (!content?.trim()) return NextResponse.json({ error: "content required" }, { status: 400 });
    const { data, error } = await supabase.from("patient_sticky_notes").insert({
      patient_id: id,
      clinic_id:  caller?.clinic_id ?? null,
      content:    content.trim(),
      color:      color ?? "gold",
      created_by: caller?.id ?? null,
    }).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    logAction({ clinicId: caller?.clinic_id ?? undefined, action: "note.create", targetId: id, targetName: "Sticky note" });
    return NextResponse.json({ success: true, id: data?.id });
  }

  // ── Dismiss sticky note ──────────────────────────────────────────────────
  if (body.action === "dismiss_sticky_note") {
    const { noteId } = body as { noteId: string };
    if (!noteId) return NextResponse.json({ error: "noteId required" }, { status: 400 });
    const { error } = await supabase.from("patient_sticky_notes").update({ is_active: false }).eq("id", noteId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ── Save face / body chart ───────────────────────────────────────────────
  if (body.action === "save_face_chart") {
    const { visit_date, diagram_type, annotations, encounter_id, created_by_name } = body as {
      visit_date: string; diagram_type: string;
      annotations: unknown[]; encounter_id?: string; created_by_name?: string;
    };
    const { data, error } = await supabase.from("patient_face_charts").insert({
      patient_id:      id,
      clinic_id:       caller?.clinic_id ?? null,
      encounter_id:    encounter_id ?? null,
      visit_date:      visit_date ?? new Date().toISOString().split("T")[0],
      diagram_type:    diagram_type ?? "face",
      annotations:     annotations ?? [],
      created_by_name: created_by_name ?? caller?.full_name ?? "Provider",
    }).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    logAction({ clinicId: caller?.clinic_id ?? undefined, action: "note.create", targetId: id, targetName: `Face chart — ${diagram_type}` });
    return NextResponse.json({ success: true, id: data?.id });
  }

  // ── Update face chart annotations ────────────────────────────────────────
  if (body.action === "update_face_chart") {
    const { chartId, annotations } = body as { chartId: string; annotations: unknown[] };
    if (!chartId) return NextResponse.json({ error: "chartId required" }, { status: 400 });
    const { error } = await supabase.from("patient_face_charts").update({ annotations }).eq("id", chartId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ── Log a patient communication ──────────────────────────────────────────
  if (body.action === "log_communication") {
    const { channel, direction, subject, content, status } = body as {
      channel: string; direction?: string; subject?: string; content: string; status?: string;
    };
    if (!channel || !content?.trim()) return NextResponse.json({ error: "channel and content required" }, { status: 400 });
    const { error } = await supabase.from("patient_communications").insert({
      patient_id:   id,
      clinic_id:    caller?.clinic_id ?? null,
      channel,
      direction:    direction ?? "outbound",
      subject:      subject ?? null,
      content:      content.trim(),
      status:       status ?? "sent",
      sent_by:      caller?.id ?? null,
      sent_by_name: caller?.full_name ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
