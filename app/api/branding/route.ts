import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// GET /api/branding?clinic_id=<id>
// Public — returns logo/app_name/colors for a clinic (used by portal, intake, invoice PDF)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clinicId = searchParams.get("clinic_id");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Fetch global platform branding from system_settings
  const { data: globalSettings } = await supabase
    .from("system_settings")
    .select("key, value")
    .eq("scope", "global")
    .in("key", ["app_name", "logo_url", "primary_color", "favicon_url", "support_email"]);

  const global: Record<string, string> = {};
  for (const row of (globalSettings ?? [])) {
    global[row.key] = String(row.value ?? "");
  }

  // If clinic_id provided, overlay clinic-specific branding
  let clinic: Record<string, string> = {};
  if (clinicId) {
    const { data: clinicRow } = await supabase
      .from("clinics")
      .select("name, brand_logo_url, brand_color, brand_name")
      .eq("id", clinicId)
      .single();

    if (clinicRow) {
      clinic = {
        app_name:      clinicRow.brand_name  ?? clinicRow.name ?? "",
        logo_url:      clinicRow.brand_logo_url ?? "",
        primary_color: clinicRow.brand_color    ?? "",
      };
    }
  }

  return NextResponse.json({
    app_name:      clinic.app_name      || global.app_name      || "Aesthetica",
    logo_url:      clinic.logo_url      || global.logo_url      || null,
    primary_color: clinic.primary_color || global.primary_color || "#0B2A4A",
    favicon_url:   global.favicon_url   || null,
    support_email: global.support_email || null,
  });
}
