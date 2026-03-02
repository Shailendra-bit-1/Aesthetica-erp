import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fireWebhookEvent } from "@/lib/fireWebhookEvent";

interface IntegrationConfig {
  clinic_id: string;
  config: Record<string, string>;
}

interface ColumnData {
  column_name: string;
  string_value: string;
}

interface GoogleLeadPayload {
  google_key?: string;
  lead_id?: string;
  user_column_data?: ColumnData[];
}

// POST /api/webhooks/inbound/google — Google Ads lead form extension
// Public — auth via payload.google_key matched against integration_configs where integration='google_ads'
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as GoogleLeadPayload;

    if (!body.google_key) {
      return NextResponse.json({ error: "Missing google_key" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: configs } = await supabase
      .from("integration_configs")
      .select("clinic_id, config")
      .eq("integration", "google_ads")
      .eq("is_active", true);

    const matched = (configs as IntegrationConfig[] | null)?.find(
      c => c.config?.webhook_key === body.google_key
    );

    if (!matched) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clinicId = matched.clinic_id;
    const columns  = body.user_column_data ?? [];

    // ── Map columns to lead fields ─────────────────────────────────────────
    let fullName    = "";
    let phone: string | null = null;
    let email: string | null = null;
    const noteLines: string[] = [];

    for (const { column_name, string_value } of columns) {
      if (!string_value) continue;
      switch (column_name.toUpperCase()) {
        case "FULL_NAME":    fullName = string_value; break;
        case "PHONE_NUMBER": phone    = string_value; break;
        case "EMAIL":        email    = string_value; break;
        default:
          noteLines.push(`${column_name}: ${string_value}`);
          break;
      }
    }

    const { data: lead, error } = await supabase
      .from("crm_leads")
      .insert({
        clinic_id: clinicId,
        full_name: fullName || "Unknown",
        phone,
        email,
        interest:  [],
        notes:     noteLines.length ? noteLines.join("\n") : null,
        source:    "google_ads",
        status:    "new",
      })
      .select("id")
      .single();

    if (error || !lead) {
      console.error("[webhooks/google] lead insert error:", error?.message);
      return NextResponse.json({ error: "Failed to process lead" }, { status: 500 });
    }

    void fireWebhookEvent(clinicId, "lead.created", {
      lead_id: lead.id,
      source:  "google_ads",
    });

    // Google requires a 200 response within 2 seconds
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[webhooks/google] unhandled error:", err);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
