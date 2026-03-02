import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fireWebhookEvent } from "@/lib/fireWebhookEvent";

interface IntegrationConfig {
  clinic_id: string;
  config: Record<string, string>;
}

// POST /api/leads
// Public — auth via Bearer <api_key> matched against integration_configs where integration='lead_api'
export async function POST(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    if (!token) {
      return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: configs } = await supabase
      .from("integration_configs")
      .select("clinic_id, config")
      .eq("integration", "lead_api")
      .eq("is_active", true);

    const matched = (configs as IntegrationConfig[] | null)?.find(
      c => c.config?.api_key === token
    );

    if (!matched) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clinicId = matched.clinic_id;

    // ── Parse body ─────────────────────────────────────────────────────────
    const body = await req.json() as {
      full_name: string;
      phone?: string;
      email?: string;
      interest?: string[];
      notes?: string;
      source?: string;
    };

    if (!body.full_name) {
      return NextResponse.json({ error: "full_name is required" }, { status: 400 });
    }

    // ── Insert lead ────────────────────────────────────────────────────────
    const { data: lead, error } = await supabase
      .from("crm_leads")
      .insert({
        clinic_id: clinicId,
        full_name: body.full_name,
        phone:     body.phone    ?? null,
        email:     body.email    ?? null,
        interest:  body.interest ?? [],
        notes:     body.notes    ?? null,
        source:    body.source   ?? "api",
        status:    "new",
      })
      .select("id")
      .single();

    if (error || !lead) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to create lead" },
        { status: 500 }
      );
    }

    void fireWebhookEvent(clinicId, "lead.created", {
      lead_id: lead.id,
      full_name: body.full_name,
      source: body.source ?? "api",
    });

    return NextResponse.json({ success: true, lead_id: lead.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
