/**
 * POST /api/simulate/lead
 * Creates a test CRM lead and fires webhook event.
 * Session-authenticated — any logged-in admin can use the simulator.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/src/lib/config/environment";
import { fireWebhookEvent } from "@/lib/fireWebhookEvent";

function adminClient() {
  return createClient(supabaseEnv.url, supabaseEnv.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const userClient = createServerClient(
      supabaseEnv.url,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: callerProfile } = await userClient
      .from("profiles")
      .select("clinic_id, role")
      .eq("id", user.id)
      .single();

    if (!callerProfile?.clinic_id) {
      return NextResponse.json({ error: "No clinic associated with your profile" }, { status: 403 });
    }

    const clinicId = callerProfile.clinic_id;

    // ── Body ──────────────────────────────────────────────────────────────────
    const body = await req.json() as {
      source: string;
      full_name: string;
      phone: string;
      email?: string;
      interest?: string;
      campaign?: string;
    };

    if (!body.full_name?.trim() || !body.phone?.trim()) {
      return NextResponse.json({ error: "full_name and phone are required" }, { status: 400 });
    }

    // ── Insert lead (service role bypasses RLS) ───────────────────────────────
    const admin = adminClient();
    const { data: lead, error } = await admin
      .from("crm_leads")
      .insert({
        clinic_id: clinicId,
        full_name: body.full_name.trim(),
        phone: body.phone.trim(),
        email: body.email?.trim() ?? null,
        source: body.source ?? "simulator",
        interest: body.interest ? [body.interest] : [],
        status: "new",
      })
      .select("id")
      .single();

    if (error) {
      console.error("[simulate/lead] insert error:", error.message);
      return NextResponse.json({ error: "An error occurred" }, { status: 500 });
    }

    // ── Fire webhook (fire-and-forget) ────────────────────────────────────────
    void fireWebhookEvent(clinicId, "lead.created", {
      lead_id: lead.id,
      source: body.source,
      simulated: true,
      campaign: body.campaign ?? null,
    });

    return NextResponse.json({ success: true, lead_id: lead.id, source: body.source });
  } catch {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
