import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string;
}

/**
 * Fire a webhook event to all active endpoints subscribed to it.
 * Fire-and-forget — callers should `void fireWebhookEvent(...)`.
 */
export async function fireWebhookEvent(
  clinicId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: endpoints } = await supabase
    .from("webhook_endpoints")
    .select("id, url, secret")
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .contains("events", [event]);

  if (!endpoints?.length) return;

  const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });

  await Promise.allSettled(
    endpoints.map(async (endpoint: WebhookEndpoint) => {
      const signature = `sha256=${createHmac("sha256", endpoint.secret ?? "").update(body).digest("hex")}`;
      let status: "delivered" | "failed" = "failed";
      let response_code: number | null = null;

      try {
        const res = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Aesthetica-Signature": signature,
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });
        response_code = res.status;
        status = res.ok ? "delivered" : "failed";
      } catch {
        // Network error — status stays "failed"
      }

      await supabase.from("webhook_deliveries").insert({
        clinic_id: clinicId,
        endpoint_id: endpoint.id,
        event,
        payload: { event, data: payload },
        status,
        response_code,
        attempt_count: 1,
      });
    })
  );
}
