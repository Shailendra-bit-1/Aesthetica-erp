import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function validateSession(token: string) {
  const { data: session } = await supabaseAdmin
    .from("patient_portal_sessions")
    .select("patient_id, clinic_id, expires_at, is_active")
    .eq("token", token)
    .maybeSingle();
  if (!session || !session.is_active || new Date(session.expires_at) < new Date()) return null;
  return session;
}

// GET /api/portal/forms?token=...
// Returns { forms: FormDef[], responses: FormResponse[] }
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

    const session = await validateSession(token);
    if (!session) return NextResponse.json({ error: "Session expired or invalid" }, { status: 401 });

    const { patient_id: patientId, clinic_id: clinicId } = session;

    const [formsRes, responsesRes] = await Promise.all([
      supabaseAdmin.from("form_definitions")
        .select("id, name, form_type, fields, branding")
        .eq("clinic_id", clinicId)
        .in("form_type", ["consent", "survey", "feedback"])
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("form_responses")
        .select("id, form_id, responses, submitted_at")
        .eq("clinic_id", clinicId)
        .eq("patient_id", patientId),
    ]);

    return NextResponse.json({
      forms:     formsRes.data ?? [],
      responses: responsesRes.data ?? [],
    });
  } catch (e) {
    console.error("portal/forms GET error:", e);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

// POST /api/portal/forms — submit a form response
export async function POST(req: NextRequest) {
  try {
    const { token, form_id, responses } = await req.json();
    if (!token || !form_id || !responses) {
      return NextResponse.json({ error: "token, form_id, and responses required" }, { status: 400 });
    }

    const session = await validateSession(token);
    if (!session) return NextResponse.json({ error: "Session expired or invalid" }, { status: 401 });

    const { patient_id: patientId, clinic_id: clinicId } = session;

    const { error } = await supabaseAdmin.from("form_responses").insert({
      clinic_id:    clinicId,
      form_id,
      patient_id:   patientId,
      responses,
      submitted_at: new Date().toISOString(),
    });

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("portal/forms POST error:", e);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
