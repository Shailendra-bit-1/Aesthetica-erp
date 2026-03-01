"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import TopBar from "@/components/TopBar";
import {
  Megaphone, Plus, X, Search, Phone, Mail, UserPlus,
  Calendar, MessageSquare, Send, CheckCircle, Clock,
} from "lucide-react";

type LeadStatus = "new" | "contacted" | "interested" | "converted" | "lost" | "junk";
type CampaignType = "whatsapp" | "sms" | "email";
type CampaignStatus = "draft" | "scheduled" | "running" | "completed";

interface Lead {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  interest: string[] | null;
  status: LeadStatus;
  assigned_to: string | null;
  patient_id: string | null;
  next_followup: string | null;
  notes: string | null;
  created_at: string;
  profiles: { full_name: string } | null;
}

interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  target_segment: Record<string, unknown> | null;
  message_template: string | null;
  status: CampaignStatus;
  scheduled_at: string | null;
  sent_count: number;
  delivered_count: number;
  created_at: string;
}

interface Staff {
  id: string;
  full_name: string;
}

const LEAD_STATUS_CONFIG: Record<LeadStatus, { bg: string; color: string; label: string }> = {
  new:        { bg: "rgba(59,130,246,0.12)",  color: "#2563eb", label: "New" },
  contacted:  { bg: "rgba(234,179,8,0.12)",  color: "#ca8a04", label: "Contacted" },
  interested: { bg: "rgba(168,85,247,0.12)", color: "#7c3aed", label: "Interested" },
  converted:  { bg: "rgba(34,197,94,0.12)",  color: "#16a34a", label: "Converted" },
  lost:       { bg: "rgba(239,68,68,0.12)",  color: "#dc2626", label: "Lost" },
  junk:       { bg: "rgba(107,114,128,0.12)",color: "#6b7280", label: "Junk" },
};

const CAMPAIGN_STATUS_CONFIG: Record<CampaignStatus, { bg: string; color: string; label: string }> = {
  draft:     { bg: "rgba(107,114,128,0.12)",color: "#6b7280", label: "Draft" },
  scheduled: { bg: "rgba(59,130,246,0.12)", color: "#2563eb", label: "Scheduled" },
  running:   { bg: "rgba(234,179,8,0.12)",  color: "#ca8a04", label: "Running" },
  completed: { bg: "rgba(34,197,94,0.12)",  color: "#16a34a", label: "Completed" },
};

const SOURCE_LABELS: Record<string, string> = {
  walk_in: "Walk In", instagram: "Instagram", referral: "Referral",
  website: "Website", other: "Other",
};

export default function CRMPage() {
  const { profile, activeClinicId } = useClinic();

  const [tab, setTab] = useState<"leads" | "campaigns" | "log">("leads");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [leadDrawer, setLeadDrawer] = useState(false);
  const [campaignDrawer, setCampaignDrawer] = useState(false);
  const [saving, setSaving] = useState(false);

  const [leadForm, setLeadForm] = useState({
    full_name: "", phone: "", email: "", source: "walk_in", interest: "", notes: "",
    assigned_to: "", next_followup: "",
  });

  const [campaignForm, setCampaignForm] = useState({
    name: "", type: "whatsapp" as CampaignType, message_template: "", scheduled_at: "",
  });

  const clinicId = activeClinicId || profile?.clinic_id;

  const fetchLeads = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase.from("crm_leads")
      .select("*, profiles(full_name)")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false });
    setLeads((data as Lead[]) || []);
  }, [clinicId, supabase]);

  const fetchCampaigns = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase.from("crm_campaigns")
      .select("*").eq("clinic_id", clinicId).order("created_at", { ascending: false });
    setCampaigns(data || []);
  }, [clinicId, supabase]);

  const fetchStaff = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase.from("profiles").select("id, full_name")
      .eq("clinic_id", clinicId).eq("is_active", true);
    setStaff(data || []);
  }, [clinicId, supabase]);

  useEffect(() => {
    if (!clinicId) return;
    setLoading(true);
    Promise.all([fetchLeads(), fetchCampaigns(), fetchStaff()]).finally(() => setLoading(false));
  }, [clinicId, fetchLeads, fetchCampaigns, fetchStaff]);

  const saveLead = async () => {
    if (!clinicId || !leadForm.full_name) return;
    setSaving(true);
    await supabase.from("crm_leads").insert({
      clinic_id: clinicId, full_name: leadForm.full_name, phone: leadForm.phone || null,
      email: leadForm.email || null, source: leadForm.source,
      interest: leadForm.interest ? leadForm.interest.split(",").map(s => s.trim()).filter(Boolean) : [],
      notes: leadForm.notes || null, assigned_to: leadForm.assigned_to || null,
      next_followup: leadForm.next_followup || null, status: "new",
    });
    setSaving(false);
    setLeadDrawer(false);
    setLeadForm({ full_name: "", phone: "", email: "", source: "walk_in", interest: "", notes: "", assigned_to: "", next_followup: "" });
    fetchLeads();
  };

  const updateLeadStatus = async (id: string, status: LeadStatus) => {
    await supabase.from("crm_leads").update({ status }).eq("id", id);
    fetchLeads();
  };

  const convertLead = async (lead: Lead) => {
    if (!clinicId || lead.patient_id) return;
    try {
      // C-5 fix: atomic RPC — patient INSERT + lead UPDATE in single transaction
      const { error } = await supabase.rpc("convert_lead", {
        p_lead_id:   lead.id,
        p_clinic_id: clinicId,
        p_full_name: lead.full_name,
        p_phone:     lead.phone  || null,
        p_email:     lead.email  || null,
      });
      if (error) throw error;
      fetchLeads();
    } catch (e: unknown) {
      alert((e as Error).message ?? "Failed to convert lead");
    }
  };

  const saveCampaign = async () => {
    if (!clinicId || !campaignForm.name) return;
    setSaving(true);
    await supabase.from("crm_campaigns").insert({
      clinic_id: clinicId, name: campaignForm.name, type: campaignForm.type,
      message_template: campaignForm.message_template || null,
      scheduled_at: campaignForm.scheduled_at || null,
      status: campaignForm.scheduled_at ? "scheduled" : "draft",
      created_by: profile?.id,
    });
    setSaving(false);
    setCampaignDrawer(false);
    setCampaignForm({ name: "", type: "whatsapp", message_template: "", scheduled_at: "" });
    fetchCampaigns();
  };

  const filteredLeads = leads.filter(l =>
    !search || l.full_name.toLowerCase().includes(search.toLowerCase()) ||
    l.phone?.includes(search) || l.email?.toLowerCase().includes(search.toLowerCase())
  );

  // H-8 fix: CRM is admin + front_desk; block therapists/doctors from lead management
  const CRM_ROLES = ["superadmin", "chain_admin", "clinic_admin", "front_desk"];
  if (profile && !CRM_ROLES.includes(profile.role ?? "")) {
    return (
      <div className="flex flex-col h-screen" style={{ background: "#F9F7F2" }}>
        <TopBar />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#6b7280", fontFamily: "Georgia, serif" }}>You don&apos;t have permission to access CRM.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen" style={{ background: "#F9F7F2" }}>
      <TopBar />

      <div className="flex-1 overflow-auto p-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: "rgba(197,160,89,0.08)", border: "1px solid rgba(197,160,89,0.15)" }}>
          {(["leads", "campaigns", "log"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize"
              style={tab === t ? { background: "var(--gold)", color: "#fff", fontFamily: "Georgia, serif" } : { color: "rgba(197,160,89,0.7)" }}>
              {t === "leads" ? "Leads" : t === "campaigns" ? "Campaigns" : "Log"}
            </button>
          ))}
        </div>

        {/* LEADS TAB */}
        {tab === "leads" && (
          <div>
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Leads</h2>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9ca3af" }} />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search leads…" className="pl-8 pr-3 py-1.5 rounded-lg text-sm border bg-white outline-none"
                    style={{ borderColor: "rgba(197,160,89,0.2)", width: 200 }} />
                </div>
              </div>
              <button onClick={() => setLeadDrawer(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: "var(--gold)" }}>
                <Plus size={15} /> New Lead
              </button>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(197,160,89,0.1)", background: "rgba(197,160,89,0.04)" }}>
                    {["Name", "Phone", "Source", "Assigned", "Next Follow-up", "Status", "Actions"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: "rgba(197,160,89,0.7)", letterSpacing: "0.05em" }}>{h.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-sm" style={{ color: "#9ca3af" }}>Loading…</td></tr>
                  ) : filteredLeads.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-sm" style={{ color: "#9ca3af" }}>No leads yet</td></tr>
                  ) : filteredLeads.map(lead => {
                    const sc = LEAD_STATUS_CONFIG[lead.status];
                    return (
                      <tr key={lead.id} style={{ borderBottom: "1px solid rgba(197,160,89,0.06)" }}>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium" style={{ color: "#1a1714" }}>{lead.full_name}</p>
                          {lead.email && <p className="text-xs" style={{ color: "#9ca3af" }}>{lead.email}</p>}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>{lead.phone || "—"}</td>
                        <td className="px-4 py-3">
                          {lead.source && (
                            <span className="text-xs px-2 py-1 rounded-full" style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)" }}>
                              {SOURCE_LABELS[lead.source] || lead.source}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>{lead.profiles?.full_name || "—"}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>
                          {lead.next_followup ? new Date(lead.next_followup).toLocaleDateString("en-IN") : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <select value={lead.status}
                            onChange={e => updateLeadStatus(lead.id, e.target.value as LeadStatus)}
                            className="text-xs px-2 py-1.5 rounded-lg border bg-white font-medium"
                            style={{ borderColor: sc.color + "40", color: sc.color, background: sc.bg }}>
                            {Object.entries(LEAD_STATUS_CONFIG).map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          {!lead.patient_id && lead.status !== "junk" && lead.status !== "lost" && (
                            <button onClick={() => convertLead(lead)}
                              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                              style={{ background: "rgba(34,197,94,0.1)", color: "#16a34a" }}>
                              <UserPlus size={11} /> Convert
                            </button>
                          )}
                          {lead.patient_id && (
                            <span className="flex items-center gap-1 text-xs" style={{ color: "#16a34a" }}>
                              <CheckCircle size={11} /> Patient
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CAMPAIGNS TAB */}
        {tab === "campaigns" && (
          <div>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Campaigns</h2>
              <button onClick={() => setCampaignDrawer(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: "var(--gold)" }}>
                <Plus size={15} /> New Campaign
              </button>
            </div>
            {campaigns.length === 0 ? (
              <div className="text-center py-16" style={{ color: "rgba(197,160,89,0.5)" }}>
                <Megaphone size={40} className="mx-auto mb-3 opacity-30" />
                <p style={{ fontFamily: "Georgia, serif" }}>No campaigns yet — create your first outreach campaign</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {campaigns.map(c => {
                  const sc = CAMPAIGN_STATUS_CONFIG[c.status];
                  const typeColors: Record<CampaignType, string> = { whatsapp: "#16a34a", sms: "#2563eb", email: "#7c3aed" };
                  return (
                    <div key={c.id} className="rounded-xl p-5" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-semibold text-sm" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>{c.name}</p>
                          <span className="text-xs px-1.5 py-0.5 rounded mt-1 inline-block font-medium uppercase" style={{ background: typeColors[c.type] + "15", color: typeColors[c.type] }}>{c.type}</span>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                      </div>
                      {c.message_template && (
                        <p className="text-xs mb-3 line-clamp-2" style={{ color: "#6b7280" }}>{c.message_template}</p>
                      )}
                      <div className="flex justify-between text-xs" style={{ color: "#9ca3af" }}>
                        <span>Sent: {c.sent_count}</span>
                        <span>Delivered: {c.delivered_count}</span>
                      </div>
                      {c.scheduled_at && (
                        <div className="flex items-center gap-1 mt-2 text-xs" style={{ color: "#9ca3af" }}>
                          <Clock size={10} />
                          <span>{new Date(c.scheduled_at).toLocaleDateString("en-IN")}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* LOG TAB */}
        {tab === "log" && (
          <div>
            <h2 className="text-lg font-semibold mb-5" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Communication Log</h2>
            <div className="rounded-xl p-8 text-center" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
              <MessageSquare size={40} className="mx-auto mb-3 opacity-20" style={{ color: "var(--gold)" }} />
              <p className="text-sm" style={{ color: "#9ca3af" }}>Communication log will populate as campaigns are sent</p>
            </div>
          </div>
        )}
      </div>

      {/* NEW LEAD DRAWER */}
      {leadDrawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setLeadDrawer(false)} />
          <div className="w-[440px] h-full overflow-y-auto flex flex-col" style={{ background: "#fff" }}>
            <div className="flex justify-between items-center px-6 py-5" style={{ borderBottom: "1px solid rgba(197,160,89,0.15)" }}>
              <h3 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>New Lead</h3>
              <button onClick={() => setLeadDrawer(false)} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="flex-1 p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Full Name *</label>
                <input value={leadForm.full_name} onChange={e => setLeadForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="Lead name" className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Phone</label>
                  <input value={leadForm.phone} onChange={e => setLeadForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+91" className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                    style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Email</label>
                  <input type="email" value={leadForm.email} onChange={e => setLeadForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="email@example.com" className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                    style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Source</label>
                  <select value={leadForm.source} onChange={e => setLeadForm(f => ({ ...f, source: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border outline-none text-sm bg-white"
                    style={{ borderColor: "rgba(197,160,89,0.3)" }}>
                    {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Next Follow-up</label>
                  <input type="date" value={leadForm.next_followup} onChange={e => setLeadForm(f => ({ ...f, next_followup: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                    style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Interests (comma-separated)</label>
                <input value={leadForm.interest} onChange={e => setLeadForm(f => ({ ...f, interest: e.target.value }))}
                  placeholder="e.g. Botox, Laser, Facials" className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Assign To</label>
                <select value={leadForm.assigned_to} onChange={e => setLeadForm(f => ({ ...f, assigned_to: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border outline-none text-sm bg-white"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }}>
                  <option value="">Unassigned</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Notes</label>
                <textarea value={leadForm.notes} onChange={e => setLeadForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3} className="w-full px-3 py-2 rounded-lg border outline-none text-sm resize-none"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }} />
              </div>
            </div>
            <div className="px-6 py-4 flex gap-3" style={{ borderTop: "1px solid rgba(197,160,89,0.15)" }}>
              <button onClick={() => setLeadDrawer(false)} className="flex-1 px-4 py-2 rounded-lg text-sm border" style={{ borderColor: "rgba(197,160,89,0.2)", color: "#6b7280" }}>Cancel</button>
              <button onClick={saveLead} disabled={saving || !leadForm.full_name}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "var(--gold)" }}>{saving ? "Saving…" : "Save Lead"}</button>
            </div>
          </div>
        </div>
      )}

      {/* NEW CAMPAIGN DRAWER */}
      {campaignDrawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setCampaignDrawer(false)} />
          <div className="w-[440px] h-full overflow-y-auto flex flex-col" style={{ background: "#fff" }}>
            <div className="flex justify-between items-center px-6 py-5" style={{ borderBottom: "1px solid rgba(197,160,89,0.15)" }}>
              <h3 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>New Campaign</h3>
              <button onClick={() => setCampaignDrawer(false)} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="flex-1 p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Campaign Name *</label>
                <input value={campaignForm.name} onChange={e => setCampaignForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Diwali Offer 2026" className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Channel *</label>
                  <select value={campaignForm.type} onChange={e => setCampaignForm(f => ({ ...f, type: e.target.value as CampaignType }))}
                    className="w-full px-3 py-2 rounded-lg border outline-none text-sm bg-white"
                    style={{ borderColor: "rgba(197,160,89,0.3)" }}>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Schedule</label>
                  <input type="datetime-local" value={campaignForm.scheduled_at} onChange={e => setCampaignForm(f => ({ ...f, scheduled_at: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                    style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Message Template</label>
                <textarea value={campaignForm.message_template} onChange={e => setCampaignForm(f => ({ ...f, message_template: e.target.value }))}
                  rows={5} placeholder="Hi {patient_name}, we have an exclusive offer for you at {clinic_name}…"
                  className="w-full px-3 py-2 rounded-lg border outline-none text-sm resize-none"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                <p className="text-xs mt-1" style={{ color: "#9ca3af" }}>Use {"{patient_name}"}, {"{clinic_name}"} as placeholders</p>
              </div>
            </div>
            <div className="px-6 py-4 flex gap-3" style={{ borderTop: "1px solid rgba(197,160,89,0.15)" }}>
              <button onClick={() => setCampaignDrawer(false)} className="flex-1 px-4 py-2 rounded-lg text-sm border" style={{ borderColor: "rgba(197,160,89,0.2)", color: "#6b7280" }}>Cancel</button>
              <button onClick={saveCampaign} disabled={saving || !campaignForm.name}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "var(--gold)" }}>{saving ? "Saving…" : "Save Campaign"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
