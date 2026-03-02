import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";
import { fireWebhookEvent } from "@/lib/fireWebhookEvent";

interface IntegrationConfig {
  clinic_id: string;
  config: Record<string, string>;
}

interface FieldData {
  name: string;
  values: string[];
}

interface GraphApiResponse {
  field_data?: FieldData[];
}

interface MetaLeadgenValue {
  leadgen_id?: string;
  page_id?: string;
}

interface MetaEntry {
  changes?: Array<{
    field?: string;
    value?: MetaLeadgenValue;
  }>;
}

interface MetaWebhookBody {
  object?: string;
  entry?: MetaEntry[];
}

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// GET /api/webhooks/inbound/meta — Meta webhook verification challenge
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !token || !challenge) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const supabase = makeSupabase();
  const { data: configs } = await supabase
    .from("integration_configs")
    .select("clinic_id, config")
    .eq("integration", "meta_ads")
    .eq("is_active", true);

  const matched = (configs as IntegrationConfig[] | null)?.find(
    c => c.config?.verify_token === token
  );

  if (!matched) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return new NextResponse(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

// POST /api/webhooks/inbound/meta — Meta Lead Ads lead notification
export async function POST(req: NextRequest) {
  // Always return 200 EVENT_RECEIVED to Meta even on error
  try {
    // Read raw body BEFORE parsing — needed for HMAC verification
    const rawBody = await req.text();

    let body: MetaWebhookBody;
    try {
      body = JSON.parse(rawBody) as MetaWebhookBody;
    } catch {
      return new NextResponse("EVENT_RECEIVED", { status: 200 });
    }

    // Collect leadgen entries grouped by page_id
    const leadgenEntries: Array<{ leadgen_id: string; page_id: string }> = [];
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (
          change.field === "leadgen" &&
          change.value?.leadgen_id &&
          change.value?.page_id
        ) {
          leadgenEntries.push({
            leadgen_id: change.value.leadgen_id,
            page_id:    change.value.page_id,
          });
        }
      }
    }

    if (!leadgenEntries.length) {
      return new NextResponse("EVENT_RECEIVED", { status: 200 });
    }

    const supabase = makeSupabase();
    const { data: configs } = await supabase
      .from("integration_configs")
      .select("clinic_id, config")
      .eq("integration", "meta_ads")
      .eq("is_active", true);

    const sigHeader = req.headers.get("x-hub-signature-256") ?? "";

    for (const { leadgen_id, page_id } of leadgenEntries) {
      const matched = (configs as IntegrationConfig[] | null)?.find(
        c => c.config?.page_id === page_id
      );
      if (!matched) continue;

      const cfg       = matched.config;
      const clinicId  = matched.clinic_id;

      // ── HMAC verification ─────────────────────────────────────────────────
      const expectedSig = `sha256=${createHmac("sha256", cfg.app_secret ?? "").update(rawBody).digest("hex")}`;
      const sigValid = (() => {
        try {
          return (
            sigHeader.length === expectedSig.length &&
            timingSafeEqual(Buffer.from(sigHeader), Buffer.from(expectedSig))
          );
        } catch {
          return false;
        }
      })();

      if (!sigValid) {
        return new NextResponse("Forbidden", { status: 403 });
      }

      // ── Fetch lead fields from Meta Graph API ─────────────────────────────
      let fieldData: FieldData[] = [];
      try {
        const graphUrl = `https://graph.facebook.com/v19.0/${leadgen_id}?fields=field_data&access_token=${cfg.page_access_token}`;
        const graphRes = await fetch(graphUrl);
        const graphJson = await graphRes.json() as GraphApiResponse;
        fieldData = graphJson.field_data ?? [];
      } catch {
        // Graph API failure is non-fatal — insert with partial data
      }

      // ── Map field_data to lead fields ─────────────────────────────────────
      let fullName    = "";
      let firstName   = "";
      let lastName    = "";
      let phone: string | null = null;
      let email: string | null = null;
      const noteLines: string[] = [];

      for (const { name, values } of fieldData) {
        const val = values[0] ?? "";
        switch (name.toLowerCase()) {
          case "full_name":    fullName  = val;  break;
          case "first_name":   firstName = val;  break;
          case "last_name":    lastName  = val;  break;
          case "phone_number": phone     = val;  break;
          case "email":        email     = val;  break;
          default:             if (val) noteLines.push(`${name}: ${val}`); break;
        }
      }

      if (!fullName) {
        fullName = [firstName, lastName].filter(Boolean).join(" ") || "Unknown";
      }

      const { data: lead } = await supabase
        .from("crm_leads")
        .insert({
          clinic_id: clinicId,
          full_name: fullName,
          phone,
          email,
          interest:  [],
          notes:     noteLines.length ? noteLines.join("\n") : null,
          source:    "meta_ads",
          status:    "new",
        })
        .select("id")
        .single();

      if (lead) {
        void fireWebhookEvent(clinicId, "lead.created", {
          lead_id: lead.id,
          source:  "meta_ads",
        });
      }
    }

    return new NextResponse("EVENT_RECEIVED", { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[meta/webhook POST]", message);
    // Always 200 so Meta doesn't disable the webhook
    return new NextResponse("EVENT_RECEIVED", { status: 200 });
  }
}
