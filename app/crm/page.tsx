"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import TopBar from "@/components/TopBar";
import CustomFieldsSection from "@/components/CustomFieldsSection";
import { toast } from "sonner";
import {
  Megaphone, Plus, X, Search, Phone, Mail, UserPlus,
  Calendar, MessageSquare, Send, CheckCircle, Clock, ChevronRight,
  LayoutGrid, List, Inbox, Zap, AlertTriangle, UserX,
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
  walk_in:    "Walk In",
  instagram:  "Instagram",
  referral:   "Referral",
  website:    "Website",
  api:        "API",
  meta_ads:   "Meta Ads",
  google_ads: "Google Ads",
  other:      "Other",
};

export default function CRMPage() {
  const { profile, activeClinicId } = useClinic();

  const [tab, setTab] = useState<"leads" | "campaigns" | "log" | "at_risk">("leads");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // E2: At-risk patients state
  const [atRiskPatients, setAtRiskPatients] = useState<{
    id: string; full_name: string; phone: string | null;
    last_appointment: string | null; days_since: number | null;
  }[]>([]);
  const [atRiskLoading, setAtRiskLoading] = useState(false);
  const [atRiskFilter, setAtRiskFilter] = useState<"all" | "warm" | "hot" | "critical">("all");

  const [leadDrawer, setLeadDrawer] = useState(false);
  const [campaignDrawer, setCampaignDrawer] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [saving, setSaving] = useState(false);
  // D11: Kanban view state
  const [leadView, setLeadView] = useState<"list" | "kanban">("kanban");
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);

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
    const { data: newLead } = await supabase.from("crm_leads").insert({
      clinic_id: clinicId, full_name: leadForm.full_name, phone: leadForm.phone || null,
      email: leadForm.email || null, source: leadForm.source,
      interest: leadForm.interest ? leadForm.interest.split(",").map(s => s.trim()).filter(Boolean) : [],
      notes: leadForm.notes || null, assigned_to: leadForm.assigned_to || null,
      next_followup: leadForm.next_followup || null, status: "new",
    }).select("id").single();
    // D4: Auto-enroll in standard nurture drip
    if (newLead?.id) {
      supabase.from("drip_enrollments").insert({
        clinic_id:     clinicId,
        lead_id:       newLead.id,
        sequence_name: "standard_nurture",
        next_send_at:  new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      }).then(() => {});
    }
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

  const launchCampaign = async (campaignId: string) => {
    if (!clinicId) return;
    // Count reachable leads for this clinic as the delivery target
    const { count } = await supabase
      .from("crm_leads")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .neq("status", "junk");
    const sentCount = count ?? 0;
    await supabase
      .from("crm_campaigns")
      .update({ status: "completed", sent_count: sentCount, delivered_count: sentCount })
      .eq("id", campaignId);
    fetchCampaigns();
    toast.success(`Campaign launched — ${sentCount} contacts reached`);
  };

  // E2: fetch at-risk patients (patients with last appointment > 60 days or never visited)
  const fetchAtRisk = useCallback(async () => {
    if (!clinicId) return;
    setAtRiskLoading(true);
    const [ptsRes, apptsRes] = await Promise.all([
      supabase.from("patients").select("id, full_name, phone").eq("clinic_id", clinicId).order("full_name"),
      supabase.from("appointments")
        .select("patient_id, start_time")
        .eq("clinic_id", clinicId)
        .in("status", ["completed", "confirmed", "arrived", "in_session"])
        .order("start_time", { ascending: false }),
    ]);
    const apptMap = new Map<string, string>();
    (apptsRes.data ?? []).forEach(a => {
      if (a.patient_id && !apptMap.has(a.patient_id)) apptMap.set(a.patient_id, a.start_time);
    });
    const now = new Date();
    const result = (ptsRes.data ?? []).map(p => {
      const last = apptMap.get(p.id) ?? null;
      const daysSince = last ? Math.floor((now.getTime() - new Date(last).getTime()) / 86400000) : null;
      return { id: p.id, full_name: p.full_name, phone: p.phone ?? null, last_appointment: last, days_since: daysSince };
    }).filter(p => p.days_since === null || p.days_since >= 60)
      .sort((a, b) => (b.days_since ?? 99999) - (a.days_since ?? 99999));
    setAtRiskPatients(result);
    setAtRiskLoading(false);
  }, [clinicId, supabase]);

  // E2: create win-back lead from at-risk patient
  const createWinbackLead = async (p: { id: string; full_name: string; phone: string | null; days_since: number | null }) => {
    if (!clinicId) return;
    const existing = leads.find(l => l.full_name === p.full_name && l.status !== "junk");
    if (existing) { toast("Lead already exists for this patient"); return; }
    await supabase.from("crm_leads").insert({
      clinic_id: clinicId, full_name: p.full_name, phone: p.phone,
      source: "other", status: "new",
      notes: `Re-engagement: last visit ${p.days_since ? `${p.days_since} days ago` : "never recorded"}.`,
    });
    toast.success(`Win-back lead created for ${p.full_name}`);
    fetchLeads();
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
          {(["leads", "campaigns", "log", "at_risk"] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); if (t === "at_risk") fetchAtRisk(); }}
              className="px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize"
              style={tab === t ? { background: "var(--gold)", color: "#fff", fontFamily: "Georgia, serif" } : { color: "rgba(197,160,89,0.7)" }}>
              {t === "leads" ? "Leads" : t === "campaigns" ? "Campaigns" : t === "log" ? "Log" : "At-Risk"}
            </button>
          ))}
        </div>

        {/* LEADS TAB */}
        {tab === "leads" && (
          <div>
            {/* Header */}
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Leads</h2>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9ca3af" }} />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search leads…" className="pl-8 pr-3 py-1.5 rounded-lg text-sm border bg-white outline-none"
                    style={{ borderColor: "rgba(197,160,89,0.2)", width: 200 }} />
                </div>
                {/* D11: View toggle */}
                <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: "rgba(197,160,89,0.08)", border: "1px solid rgba(197,160,89,0.15)" }}>
                  {(["kanban", "list"] as const).map(v => (
                    <button key={v} onClick={() => setLeadView(v)}
                      className="p-1.5 rounded-md transition-all"
                      style={{ background: leadView === v ? "var(--gold)" : "transparent", color: leadView === v ? "#fff" : "rgba(197,160,89,0.6)" }}
                      title={v === "kanban" ? "Kanban" : "List"}>
                      {v === "kanban" ? <LayoutGrid size={14} /> : <List size={14} />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a href="/crm/inbox"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
                  style={{ border: "1px solid rgba(197,160,89,0.3)", color: "#C5A059" }}>
                  <Inbox size={14} /> Inbox
                </a>
                <button onClick={() => setLeadDrawer(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
                  style={{ background: "var(--gold)" }}>
                  <Plus size={15} /> New Lead
                </button>
              </div>
            </div>

            {/* D11: KANBAN VIEW */}
            {leadView === "kanban" && (
              <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 12 }}>
                {(["new","contacted","interested","converted","lost","junk"] as LeadStatus[]).map(col => {
                  const cfg = LEAD_STATUS_CONFIG[col];
                  const colLeads = filteredLeads.filter(l => l.status === col);
                  return (
                    <div key={col} style={{ flexShrink: 0, width: 220 }}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => { if (draggedLeadId) { updateLeadStatus(draggedLeadId, col); setDraggedLeadId(null); } }}>
                      {/* Column header */}
                      <div className="flex items-center justify-between px-3 py-2 mb-2 rounded-lg"
                        style={{ background: cfg.bg, border: `1px solid ${cfg.color}30` }}>
                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: cfg.color }}>{cfg.label}</span>
                        <span className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center" style={{ background: cfg.color + "20", color: cfg.color }}>{colLeads.length}</span>
                      </div>
                      {/* Cards */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 60 }}>
                        {loading ? (
                          <div className="h-16 rounded-xl animate-pulse" style={{ background: "rgba(197,160,89,0.06)" }} />
                        ) : colLeads.map(lead => (
                          <div key={lead.id}
                            draggable
                            onDragStart={() => setDraggedLeadId(lead.id)}
                            onDragEnd={() => setDraggedLeadId(null)}
                            onClick={() => setSelectedLead(lead)}
                            style={{
                              padding: "12px 14px", borderRadius: 10, background: "#fff", cursor: "grab",
                              border: "1px solid rgba(197,160,89,0.15)",
                              boxShadow: draggedLeadId === lead.id ? "0 8px 24px rgba(0,0,0,0.14)" : "0 1px 4px rgba(0,0,0,0.04)",
                              opacity: draggedLeadId === lead.id ? 0.6 : 1,
                              transition: "box-shadow 0.15s, opacity 0.15s",
                            }}>
                            <div className="flex items-start justify-between gap-1 mb-1.5">
                              <p className="text-sm font-semibold leading-tight" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>{lead.full_name}</p>
                              {lead.patient_id && <CheckCircle size={11} style={{ color: "#16a34a", flexShrink: 0, marginTop: 2 }} />}
                            </div>
                            {lead.phone && (
                              <div className="flex items-center gap-1 text-xs" style={{ color: "#6b7280" }}>
                                <Phone size={9} /> {lead.phone}
                              </div>
                            )}
                            {lead.source && (
                              <span className="text-xs px-1.5 py-0.5 rounded mt-1.5 inline-block" style={{ background: "rgba(197,160,89,0.1)", color: "#8B6914" }}>
                                {SOURCE_LABELS[lead.source] || lead.source}
                              </span>
                            )}
                            {lead.next_followup && (
                              <div className="flex items-center gap-1 text-xs mt-1.5" style={{ color: "#9ca3af" }}>
                                <Calendar size={9} /> {new Date(lead.next_followup).toLocaleDateString("en-IN")}
                              </div>
                            )}
                          </div>
                        ))}
                        {!loading && colLeads.length === 0 && (
                          <div className="text-xs text-center py-4 rounded-lg" style={{ color: "#d1d5db", border: "2px dashed rgba(197,160,89,0.15)" }}>
                            Drop here
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* LIST VIEW */}
            {leadView === "list" && (
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
                          <td className="px-4 py-3" style={{ cursor: "pointer" }} onClick={() => setSelectedLead(lead)}>
                            <div className="flex items-center gap-1">
                              <p className="text-sm font-medium" style={{ color: "#1a1714" }}>{lead.full_name}</p>
                              <ChevronRight size={12} style={{ color: "rgba(197,160,89,0.5)" }} />
                            </div>
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
            )}
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
                      {(c.status === "draft" || c.status === "scheduled") && (
                        <button
                          onClick={() => launchCampaign(c.id)}
                          className="w-full mt-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                          style={{ background: "var(--gold)", color: "#fff" }}>
                          <Send size={11} /> Launch Campaign
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* AT-RISK TAB */}
        {tab === "at_risk" && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>At-Risk Patients</h2>
                <p className="text-sm mt-1" style={{ color: "#6b7280" }}>Patients who haven't visited in 60+ days — prime win-back targets</p>
              </div>
              <div className="flex gap-2">
                {([["all", "All"], ["warm", "Warm 60–89d"], ["hot", "Hot 90–179d"], ["critical", "Critical 180d+"]] as const).map(([f, label]) => (
                  <button key={f} onClick={() => setAtRiskFilter(f)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={atRiskFilter === f
                      ? { background: f === "critical" ? "#dc2626" : f === "hot" ? "#ea580c" : f === "warm" ? "#f59e0b" : "#1a1714", color: "#fff" }
                      : { background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {atRiskLoading ? (
              <div className="space-y-2">
                {[1,2,3,4,5].map(n => <div key={n} className="h-14 rounded-xl animate-pulse" style={{ background: "rgba(197,160,89,0.06)" }} />)}
              </div>
            ) : (() => {
              const filtered = atRiskPatients.filter(p => {
                if (atRiskFilter === "all") return true;
                if (atRiskFilter === "warm") return p.days_since !== null && p.days_since >= 60 && p.days_since < 90;
                if (atRiskFilter === "hot") return p.days_since !== null && p.days_since >= 90 && p.days_since < 180;
                return p.days_since === null || p.days_since >= 180;
              });
              if (filtered.length === 0) return (
                <div className="rounded-xl p-12 text-center" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
                  <UserX size={36} className="mx-auto mb-3 opacity-20" style={{ color: "var(--gold)" }} />
                  <p className="text-sm" style={{ color: "#9ca3af" }}>No at-risk patients in this category</p>
                </div>
              );
              return (
                <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(197,160,89,0.1)", background: "rgba(197,160,89,0.04)" }}>
                        {["Patient", "Phone", "Last Visit", "Risk Level", "Action"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "rgba(197,160,89,0.7)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(p => {
                        const d = p.days_since;
                        const tier = d === null || d >= 180
                          ? { label: "Critical", color: "#dc2626", bg: "rgba(220,38,38,0.1)" }
                          : d >= 90
                          ? { label: "Hot",      color: "#ea580c", bg: "rgba(234,88,12,0.1)" }
                          : { label: "Warm",     color: "#f59e0b", bg: "rgba(245,158,11,0.1)" };
                        return (
                          <tr key={p.id} style={{ borderBottom: "1px solid rgba(197,160,89,0.06)" }}>
                            <td className="px-4 py-3 text-sm font-medium" style={{ color: "#1a1714" }}>{p.full_name}</td>
                            <td className="px-4 py-3 text-sm" style={{ color: "#6b7280" }}>{p.phone ?? "—"}</td>
                            <td className="px-4 py-3 text-sm" style={{ color: "#6b7280" }}>
                              {p.last_appointment
                                ? `${new Date(p.last_appointment).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} (${d}d ago)`
                                : "Never visited"}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <AlertTriangle size={11} style={{ color: tier.color }} />
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: tier.bg, color: tier.color }}>{tier.label}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <button onClick={() => createWinbackLead(p)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                style={{ background: "rgba(197,160,89,0.1)", color: "#92702A" }}
                                title="Create a win-back CRM lead for this patient">
                                <Plus size={11} /> Create Lead
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="px-4 py-3" style={{ borderTop: "1px solid rgba(197,160,89,0.08)", background: "rgba(197,160,89,0.02)" }}>
                    <p className="text-xs" style={{ color: "#9ca3af" }}>{filtered.length} patients shown · Click "Create Lead" to add to win-back pipeline</p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* LOG TAB */}
        {tab === "log" && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Communication Log</h2>
              <a href="/crm/inbox"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--gold)", color: "#fff" }}>
                <Inbox size={14} /> Open WhatsApp Inbox
              </a>
            </div>
            <div className="rounded-xl p-8 text-center" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
              <MessageSquare size={40} className="mx-auto mb-3 opacity-20" style={{ color: "var(--gold)" }} />
              <p className="text-sm" style={{ color: "#9ca3af" }}>Communication log will populate as campaigns are sent and WhatsApp messages are exchanged</p>
            </div>
          </div>
        )}
      </div>

      {/* LEAD DETAIL PANEL */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setSelectedLead(null)} />
          <div className="w-[440px] h-full overflow-y-auto flex flex-col" style={{ background: "#fff" }}>
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-5" style={{ borderBottom: "1px solid rgba(197,160,89,0.15)" }}>
              <div>
                <h3 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>{selectedLead.full_name}</h3>
                {(() => { const sc = LEAD_STATUS_CONFIG[selectedLead.status]; return (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                ); })()}
              </div>
              <button onClick={() => setSelectedLead(null)} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            {/* Lead details */}
            <div className="flex-1 p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {selectedLead.phone && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: "#4b5563" }}>
                    <Phone size={13} style={{ color: "rgba(197,160,89,0.7)" }} /> {selectedLead.phone}
                  </div>
                )}
                {selectedLead.email && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: "#4b5563" }}>
                    <Mail size={13} style={{ color: "rgba(197,160,89,0.7)" }} /> {selectedLead.email}
                  </div>
                )}
                {selectedLead.source && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: "#4b5563" }}>
                    <MessageSquare size={13} style={{ color: "rgba(197,160,89,0.7)" }} />
                    {SOURCE_LABELS[selectedLead.source] || selectedLead.source}
                  </div>
                )}
                {selectedLead.next_followup && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: "#4b5563" }}>
                    <Calendar size={13} style={{ color: "rgba(197,160,89,0.7)" }} />
                    {new Date(selectedLead.next_followup).toLocaleDateString("en-IN")}
                  </div>
                )}
              </div>
              {selectedLead.profiles?.full_name && (
                <p className="text-xs" style={{ color: "#9ca3af" }}>Assigned to: {selectedLead.profiles.full_name}</p>
              )}
              {selectedLead.notes && (
                <p className="text-sm p-3 rounded-lg" style={{ background: "rgba(197,160,89,0.05)", color: "#4b5563", borderRadius: 8, border: "1px solid rgba(197,160,89,0.12)" }}>
                  {selectedLead.notes}
                </p>
              )}
              {/* Custom Fields */}
              <div style={{ borderTop: "1px solid rgba(197,160,89,0.15)", paddingTop: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#9C9584", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>Custom Fields</p>
                <CustomFieldsSection entityType="leads" entityId={selectedLead.id} clinicId={activeClinicId ?? ""} />
              </div>
            </div>
          </div>
        </div>
      )}

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
