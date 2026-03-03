import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// GET /api/intake/form/[formId]
// Public — returns form definition for dynamic intake rendering.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params;
  if (!formId) return NextResponse.json({ error: "formId required" }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await supabase
    .from("form_definitions")
    .select("id, clinic_id, name, form_type, fields, branding, submit_action")
    .eq("id", formId)
    .eq("is_active", true)
    .single();

  if (error || !data) return NextResponse.json({ error: "Form not found" }, { status: 404 });
  return NextResponse.json(data);
}
