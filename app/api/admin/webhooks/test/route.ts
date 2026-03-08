import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const cookieStore = await cookies();
    const supabaseUser = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } },
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { endpoint_id } = await req.json();
    if (!endpoint_id) return NextResponse.json({ error: "endpoint_id required" }, { status: 400 });

    const { data: endpoint } = await supabaseAdmin
      .from("webhook_endpoints")
      .select("url, secret, is_active")
      .eq("id", endpoint_id)
      .maybeSingle();

    if (!endpoint) return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
    if (!endpoint.is_active) return NextResponse.json({ error: "Endpoint is disabled" }, { status: 422 });

    const testPayload = {
      event: "test.ping",
      timestamp: new Date().toISOString(),
      data: { message: "This is a test delivery from Aesthetica." },
    };
    const body = JSON.stringify(testPayload);

    // Compute HMAC signature if secret is set
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Aesthetica-Webhooks/1.0",
    };
    if (endpoint.secret) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw", encoder.encode(endpoint.secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
      );
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
      const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
      headers["X-Aesthetica-Signature-256"] = `sha256=${hex}`;
    }

    const start = Date.now();
    let responseCode = 0;
    let responseBody = "";
    try {
      const resp = await fetch(endpoint.url, { method: "POST", headers, body, signal: AbortSignal.timeout(10000) });
      responseCode = resp.status;
      responseBody = await resp.text().catch(() => "");
    } catch (e) {
      responseBody = e instanceof Error ? e.message : "Connection failed";
    }
    const latencyMs = Date.now() - start;

    return NextResponse.json({ ok: responseCode >= 200 && responseCode < 300, status: responseCode, latency_ms: latencyMs, response: responseBody.slice(0, 500) });
  } catch (e) {
    console.error("webhook test error:", e);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
