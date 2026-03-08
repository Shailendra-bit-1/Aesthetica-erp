import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const clinicId = req.nextUrl.searchParams.get("clinic_id");
  if (!clinicId) return NextResponse.json({ error: "clinic_id required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("services")
    .select("id, name, duration_minutes")
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .order("name");

  if (error) return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 });
  return NextResponse.json({ services: data ?? [] });
}
