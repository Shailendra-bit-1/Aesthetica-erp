import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface EmailPayload {
  clinic_id: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const body: EmailPayload = await req.json();
    const { clinic_id, to, subject, html, text } = body;
    if (!clinic_id || !to || !subject || !html) {
      return NextResponse.json({ error: "clinic_id, to, subject, html required" }, { status: 400 });
    }

    // Fetch SendGrid config for this clinic
    const { data: config } = await supabaseAdmin
      .from("integration_configs")
      .select("config, is_active")
      .eq("clinic_id", clinic_id)
      .eq("integration", "sendgrid")
      .maybeSingle();

    // Also check SendGrid plugin config
    if (!config?.is_active) {
      const { data: pluginConfig } = await supabaseAdmin
        .from("clinic_plugins")
        .select("config, is_enabled")
        .eq("clinic_id", clinic_id)
        .eq("plugin_key", "sendgrid_email")
        .maybeSingle();
      if (!pluginConfig?.is_enabled) {
        return NextResponse.json({ error: "SendGrid not configured for this clinic" }, { status: 422 });
      }
      const pluginCfg = pluginConfig.config as Record<string, string>;
      return sendViaSendGrid(pluginCfg.api_key, pluginCfg.from_email ?? "noreply@aesthetica.app", to, subject, html, text);
    }

    const cfg = config.config as Record<string, string>;
    return sendViaSendGrid(cfg.api_key, cfg.from_email ?? "noreply@aesthetica.app", to, subject, html, text);
  } catch (e) {
    console.error("send-email error:", e);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

async function sendViaSendGrid(apiKey: string, from: string, to: string, subject: string, html: string, text?: string) {
  const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from },
      subject,
      content: [
        ...(text ? [{ type: "text/plain", value: text }] : []),
        { type: "text/html", value: html },
      ],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error("SendGrid error:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
