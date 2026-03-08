import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

// GET /api/patients/duplicates?phone=...&name=...&clinic_id=...
// Returns potential duplicate patients matching phone or name
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const phone    = searchParams.get("phone")?.trim();
  const name     = searchParams.get("name")?.trim();
  const clinicId = searchParams.get("clinic_id")?.trim();
  const excludeId = searchParams.get("exclude_id")?.trim();

  if (!clinicId || (!phone && !name)) {
    return NextResponse.json({ duplicates: [] });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const conditions: string[] = [];
  if (phone) conditions.push(`phone.eq.${phone}`);
  if (name)  conditions.push(`full_name.ilike.${name}`);

  let query = supabase
    .from("patients")
    .select("id, full_name, phone, email, created_at")
    .eq("clinic_id", clinicId)
    .or(conditions.join(","))
    .limit(10);

  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ duplicates: [] });
  return NextResponse.json({ duplicates: data ?? [] });
}
