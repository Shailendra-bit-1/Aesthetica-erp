"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import TopBar from "@/components/TopBar";
import { Webhook, Plus, X, Eye, RefreshCw, Trash2, ToggleLeft, Check, AlertCircle, Clock, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

interface WebhookDelivery {
  id: string;
  endpoint_id: string;
  event: string;
  payload: Record<string, unknown>;
  status: "pending" | "delivered" | "failed";
  response_code: number | null;
  attempt_count: number;
  created_at: string;
  webhook_endpoints: { name: string } | null;
}

const WEBHOOK_EVENTS = [
  "patient.created", "patient.updated", "appointment.created", "appointment.confirmed",
  "appointment.cancelled", "appointment.no_show", "invoice.created", "invoice.paid",
  "invoice.overdue", "lead.created", "lead.converted", "membership.assigned",
  "membership.expired", "wallet.credit", "wallet.debit", "counselling.session_created",
  "staff.leave_requested", "staff.leave_approved", "payroll.run_approved", "payroll.run_paid",
];

const STATUS_CONFIG: Record<string, { bg: string; color: string; icon: React.ElementType }> = {
  pending:   { bg: "rgba(234,179,8,0.12)",  color: "#ca8a04", icon: Clock },
  delivered: { bg: "rgba(34,197,94,0.12)",  color: "#16a34a", icon: Check },
  failed:    { bg: "rgba(239,68,68,0.12)",  color: "#dc2626", icon: AlertCircle },
};

function maskUrl(url: string) {
  if (url.length <= 20) return url;
  return url.slice(0, 12) + "…" + url.slice(-8);
}

function genSecret() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** C-10 fix: show only last 8 chars of a secret */
function maskSecret(s: string) {
  if (!s || s.length <= 8) return "••••••••";
  return "••••••••" + s.slice(-8);
}

/** C-11 fix: reject private/loopback/SSRF-risk URLs */
function validateWebhookUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return "URL must use HTTPS";
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return "localhost URLs are not allowed";
    if (/^10\./.test(host)) return "Private IP ranges are not allowed";
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return "Private IP ranges are not allowed";
    if (/^192\.168\./.test(host)) return "Private IP ranges are not allowed";
    if (/^169\.254\./.test(host)) return "Link-local addresses are not allowed";
    return null;
  } catch {
    return "Invalid URL format";
  }
}

export default function WebhooksPage() {
  const { profile, activeClinicId } = useClinic();

  const [section, setSection] = useState<"endpoints" | "log">("endpoints");
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);

  const [endpointDrawer, setEndpointDrawer] = useState(false);
  const [payloadModal, setPayloadModal] = useState<WebhookDelivery | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "", url: "", events: [] as string[], secret: genSecret(),
  });

  const clinicId = activeClinicId || profile?.clinic_id;

  const fetchEndpoints = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase.from("webhook_endpoints").select("*")
      .eq("clinic_id", clinicId).order("created_at", { ascending: false });
    setEndpoints(data || []);
  }, [clinicId, supabase]);

  const fetchDeliveries = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase.from("webhook_deliveries")
      .select("*, webhook_endpoints(name)")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(100);
    setDeliveries((data as WebhookDelivery[]) || []);
  }, [clinicId, supabase]);

  useEffect(() => {
    if (!clinicId) return;
    setLoading(true);
    Promise.all([fetchEndpoints(), fetchDeliveries()]).finally(() => setLoading(false));
  }, [clinicId, fetchEndpoints, fetchDeliveries]);

  const saveEndpoint = async () => {
    if (!clinicId || !form.name || !form.url || form.events.length === 0) return;
    const urlError = validateWebhookUrl(form.url);
    if (urlError) { alert(urlError); return; }
    setSaving(true);
    await supabase.from("webhook_endpoints").insert({
      clinic_id: clinicId, name: form.name, url: form.url,
      events: form.events, secret: form.secret, is_active: true,
      created_by: profile?.id,
    });
    setSaving(false);
    setEndpointDrawer(false);
    setForm({ name: "", url: "", events: [], secret: genSecret() });
    fetchEndpoints();
  };

  const toggleEndpoint = async (id: string, is_active: boolean) => {
    await supabase.from("webhook_endpoints").update({ is_active: !is_active }).eq("id", id);
    fetchEndpoints();
  };

  const deleteEndpoint = async (id: string) => {
    if (!confirm("Delete this endpoint?")) return;
    await supabase.from("webhook_endpoints").delete().eq("id", id);
    fetchEndpoints();
  };

  const [testing, setTesting] = useState<string | null>(null);

  const testEndpoint = async (id: string) => {
    setTesting(id);
    const res = await fetch("/api/admin/webhooks/test", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint_id: id }),
    });
    const json = await res.json();
    setTesting(null);
    if (json.ok) toast.success(`Test delivered — HTTP ${json.status} in ${json.latency_ms}ms`);
    else toast.error(`Test failed — HTTP ${json.status ?? "error"} (${json.latency_ms ?? 0}ms): ${json.error ?? json.response ?? ""}`);
  };

  const retryDelivery = async (d: WebhookDelivery) => {
    await supabase.from("webhook_deliveries").update({ status: "pending", attempt_count: d.attempt_count + 1 }).eq("id", d.id);
    fetchDeliveries();
  };

  const toggleEvent = (event: string) => {
    setForm(f => ({
      ...f,
      events: f.events.includes(event) ? f.events.filter(e => e !== event) : [...f.events, event],
    }));
  };

  return (
    <div className="flex flex-col h-screen" style={{ background: "#F9F7F2" }}>
      <TopBar />

      <div className="flex-1 overflow-auto p-6">
        <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: "rgba(197,160,89,0.08)", border: "1px solid rgba(197,160,89,0.15)" }}>
          {(["endpoints", "log"] as const).map(t => (
            <button key={t} onClick={() => setSection(t)}
              className="px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize"
              style={section === t ? { background: "var(--gold)", color: "#fff", fontFamily: "Georgia, serif" } : { color: "rgba(197,160,89,0.7)" }}>
              {t === "endpoints" ? "Endpoints" : "Delivery Log"}
            </button>
          ))}
        </div>

        {/* ENDPOINTS */}
        {section === "endpoints" && (
          <div>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Webhook Endpoints</h2>
              <button onClick={() => setEndpointDrawer(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: "var(--gold)" }}>
                <Plus size={15} /> New Endpoint
              </button>
            </div>
            {loading ? (
              <div className="space-y-3">{[1,2,3].map(n => <div key={n} className="h-24 rounded-xl animate-pulse" style={{ background: "rgba(197,160,89,0.06)" }} />)}</div>
            ) : endpoints.length === 0 ? (
              <div className="rounded-xl p-12 text-center" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
                <Webhook size={40} className="mx-auto mb-3 opacity-20" style={{ color: "var(--gold)" }} />
                <p style={{ color: "#9ca3af" }}>No webhook endpoints configured</p>
              </div>
            ) : (
              <div className="space-y-3">
                {endpoints.map(ep => (
                  <div key={ep.id} className="rounded-xl p-4" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <p className="font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>{ep.name}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: ep.is_active ? "rgba(34,197,94,0.12)" : "rgba(107,114,128,0.12)", color: ep.is_active ? "#16a34a" : "#6b7280" }}>
                            {ep.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <p className="text-xs mt-1 font-mono" style={{ color: "#6b7280" }}>{maskUrl(ep.url)}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {ep.events.slice(0, 4).map(e => (
                            <span key={e} className="text-xs px-1.5 py-0.5 rounded font-mono"
                              style={{ background: "rgba(197,160,89,0.08)", color: "var(--gold)", fontSize: 10 }}>{e}</span>
                          ))}
                          {ep.events.length > 4 && <span className="text-xs" style={{ color: "#9ca3af" }}>+{ep.events.length - 4} more</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button onClick={() => testEndpoint(ep.id)} disabled={testing === ep.id} title="Test endpoint"
                          className="p-2 rounded-lg hover:bg-amber-50 transition-colors">
                          {testing === ep.id ? <Loader2 size={15} className="animate-spin" style={{ color: "#C5A059" }} /> : <Send size={15} style={{ color: "#C5A059" }} />}
                        </button>
                        <button onClick={() => toggleEndpoint(ep.id, ep.is_active)}
                          className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title={ep.is_active ? "Disable" : "Enable"}>
                          <ToggleLeft size={16} style={{ color: ep.is_active ? "#16a34a" : "#9ca3af" }} />
                        </button>
                        <button onClick={() => deleteEndpoint(ep.id)}
                          className="p-2 rounded-lg hover:bg-red-50 transition-colors">
                          <Trash2 size={16} style={{ color: "#ef4444" }} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DELIVERY LOG */}
        {section === "log" && (
          <div>
            <h2 className="text-lg font-semibold mb-5" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Delivery Log</h2>
            <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(197,160,89,0.1)", background: "rgba(197,160,89,0.04)" }}>
                    {["Endpoint", "Event", "Status", "Response", "Attempts", "Date", "Actions"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: "rgba(197,160,89,0.7)", letterSpacing: "0.05em" }}>{h.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deliveries.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-sm" style={{ color: "#9ca3af" }}>No deliveries yet</td></tr>
                  ) : deliveries.map(d => {
                    const sc = STATUS_CONFIG[d.status];
                    const StatusIcon = sc.icon;
                    return (
                      <tr key={d.id} style={{ borderBottom: "1px solid rgba(197,160,89,0.06)" }}>
                        <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>{d.webhook_endpoints?.name || "—"}</td>
                        <td className="px-4 py-3 text-xs font-mono" style={{ color: "#1a1714" }}>{d.event}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-xs font-medium w-fit px-2 py-1 rounded-full" style={{ background: sc.bg, color: sc.color }}>
                            <StatusIcon size={10} /> {d.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>{d.response_code || "—"}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>{d.attempt_count}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>{new Date(d.created_at).toLocaleDateString("en-IN")}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => setPayloadModal(d)} className="p-1.5 rounded hover:bg-amber-50 transition-colors" title="View payload">
                              <Eye size={13} style={{ color: "var(--gold)" }} />
                            </button>
                            {d.status === "failed" && (
                              <button onClick={() => retryDelivery(d)} className="p-1.5 rounded hover:bg-blue-50 transition-colors" title="Retry">
                                <RefreshCw size={13} style={{ color: "#2563eb" }} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* NEW ENDPOINT DRAWER */}
      {endpointDrawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setEndpointDrawer(false)} />
          <div className="w-[480px] h-full overflow-y-auto flex flex-col" style={{ background: "#fff" }}>
            <div className="flex justify-between items-center px-6 py-5" style={{ borderBottom: "1px solid rgba(197,160,89,0.15)" }}>
              <h3 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>New Endpoint</h3>
              <button onClick={() => setEndpointDrawer(false)} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="flex-1 p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Slack Notification" className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>URL *</label>
                <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://hooks.example.com/..." className="w-full px-3 py-2 rounded-lg border outline-none text-sm font-mono"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }} />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-medium" style={{ color: "#4b5563" }}>Secret (auto-generated)</label>
                  <button onClick={() => setForm(f => ({ ...f, secret: genSecret() }))} className="text-xs" style={{ color: "var(--gold)" }}>Regenerate</button>
                </div>
                <input value={form.secret} readOnly className="w-full px-3 py-2 rounded-lg border text-xs font-mono bg-gray-50"
                  style={{ borderColor: "rgba(197,160,89,0.2)", color: "#6b7280" }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: "#4b5563" }}>Events * ({form.events.length} selected)</label>
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                  {WEBHOOK_EVENTS.map(event => (
                    <label key={event} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors"
                      style={{ background: form.events.includes(event) ? "rgba(197,160,89,0.08)" : "transparent" }}>
                      <input type="checkbox" checked={form.events.includes(event)} onChange={() => toggleEvent(event)} className="rounded" />
                      <span className="text-xs font-mono" style={{ color: "#4b5563" }}>{event}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 flex gap-3" style={{ borderTop: "1px solid rgba(197,160,89,0.15)" }}>
              <button onClick={() => setEndpointDrawer(false)} className="flex-1 px-4 py-2 rounded-lg text-sm border" style={{ borderColor: "rgba(197,160,89,0.2)", color: "#6b7280" }}>Cancel</button>
              <button onClick={saveEndpoint} disabled={saving || !form.name || !form.url || form.events.length === 0}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "var(--gold)" }}>{saving ? "Saving…" : "Create Endpoint"}</button>
            </div>
          </div>
        </div>
      )}

      {/* PAYLOAD MODAL */}
      {payloadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="rounded-xl w-[560px] max-h-[70vh] flex flex-col" style={{ background: "#fff" }}>
            <div className="flex justify-between items-center px-5 py-4" style={{ borderBottom: "1px solid rgba(197,160,89,0.15)" }}>
              <h3 className="font-semibold text-sm" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Payload — {payloadModal.event}</h3>
              <button onClick={() => setPayloadModal(null)} className="p-1.5 rounded hover:bg-gray-100"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              <pre className="text-xs rounded-lg p-4 overflow-auto" style={{ background: "#f8f7f4", color: "#374151", fontFamily: "monospace" }}>
                {JSON.stringify(payloadModal.payload, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
