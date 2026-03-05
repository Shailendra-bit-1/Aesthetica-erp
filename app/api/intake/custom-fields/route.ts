import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  const clinicId = request.nextUrl.searchParams.get("clinicId");
  if (!clinicId) {
    return NextResponse.json({ fields: [] });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("custom_field_definitions")
    .select("id, field_key, field_label, field_type, options, validation, display_order")
    .eq("clinic_id", clinicId)
    .eq("entity_type", "patient")
    .order("display_order", { ascending: true });

  if (error) {
    return NextResponse.json({ fields: [] });
  }

  return NextResponse.json({ fields: data ?? [] });
}
