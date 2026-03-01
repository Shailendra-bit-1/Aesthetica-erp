"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import TopBar from "@/components/TopBar";
import {
  MessageCircle, Plus, X, ChevronDown, Calendar,
  User, TrendingUp, Clock, Check, AlertCircle,
} from "lucide-react";

type ConversionStatus = "pending" | "converted" | "partial" | "declined";

interface CounsellingSession {
  id: string;
  patient_id: string;
  counsellor_id: string | null;
  session_date: string;
  chief_complaint: string | null;
  treatments_discussed: Array<{ service_id?: string; service_name: string; price: number; recommended: boolean }>;
  total_proposed: number;
  total_accepted: number;
  conversion_status: ConversionStatus;
  followup_date: string | null;
  notes: string | null;
  created_at: string;
  patients: { full_name: string };
  profiles: { full_name: string } | null;
}

interface Service {
  id: string;
  name: string;
  selling_price: number;
}

interface Staff {
  id: string;
  full_name: string;
  role: string;
}

const STATUS_CONFIG: Record<ConversionStatus, { bg: string; color: string; label: string; icon: React.ElementType }> = {
  pending:   { bg: "rgba(234,179,8,0.12)",  color: "#ca8a04", label: "Pending",   icon: Clock },
  converted: { bg: "rgba(34,197,94,0.12)",  color: "#16a34a", label: "Converted", icon: Check },
  partial:   { bg: "rgba(59,130,246,0.12)", color: "#2563eb", label: "Partial",   icon: TrendingUp },
  declined:  { bg: "rgba(239,68,68,0.12)",  color: "#dc2626", label: "Declined",  icon: X },
};

export default function CounsellingPage() {
  const { profile, activeClinicId } = useClinic();

  const [tab, setTab] = useState<"sessions" | "pipeline">("sessions");
  const [sessions, setSessions] = useState<CounsellingSession[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<CounsellingSession | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    patient_search: "", patient_id: "", counsellor_id: "", session_date: new Date().toISOString().split("T")[0],
    chief_complaint: "", notes: "", followup_date: "",
    treatments: [] as Array<{ service_id: string; service_name: string; price: string; recommended: boolean }>,
  });
  const [patientResults, setPatientResults] = useState<Array<{ id: string; full_name: string }>>([]);

  const clinicId = activeClinicId || profile?.clinic_id;

  const fetchSessions = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase
      .from("counselling_sessions")
      .select("*, patients(full_name), profiles(full_name)")
      .eq("clinic_id", clinicId)
      .order("session_date", { ascending: false });
    setSessions((data as CounsellingSession[]) || []);
  }, [clinicId, supabase]);

  const fetchServices = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase.from("services").select("id, name, selling_price")
      .eq("clinic_id", clinicId).eq("is_active", true).order("name");
    setServices(data || []);
  }, [clinicId, supabase]);

  const fetchStaff = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase.from("profiles").select("id, full_name, role")
      .eq("clinic_id", clinicId).eq("is_active", true)
      .in("role", ["counsellor", "doctor"]);
    setStaff(data || []);
  }, [clinicId, supabase]);

  useEffect(() => {
    if (!clinicId) return;
    setLoading(true);
    Promise.all([fetchSessions(), fetchServices(), fetchStaff()]).finally(() => setLoading(false));
  }, [clinicId, fetchSessions, fetchServices, fetchStaff]);

  const searchPatients = async (q: string) => {
    if (!clinicId || q.length < 2) { setPatientResults([]); return; }
    const { data } = await supabase.from("patients").select("id, full_name")
      .eq("clinic_id", clinicId).ilike("full_name", `%${q}%`).limit(5);
    setPatientResults(data || []);
  };

  const saveSession = async () => {
    if (!clinicId || !form.patient_id) return;
    setSaving(true);
    const treatments = form.treatments.map(t => ({
      service_id: t.service_id || undefined, service_name: t.service_name,
      price: parseFloat(t.price) || 0, recommended: t.recommended,
    }));
    const total_proposed = treatments.reduce((s, t) => s + t.price, 0);
    const total_accepted = treatments.filter(t => t.recommended).reduce((s, t) => s + t.price, 0);
    await supabase.from("counselling_sessions").insert({
      clinic_id: clinicId, patient_id: form.patient_id,
      counsellor_id: form.counsellor_id || null,
      session_date: form.session_date, chief_complaint: form.chief_complaint || null,
      treatments_discussed: treatments, total_proposed, total_accepted,
      conversion_status: "pending", followup_date: form.followup_date || null,
      notes: form.notes || null,
    });
    setSaving(false);
    setDrawerOpen(false);
    setForm({ patient_search: "", patient_id: "", counsellor_id: "", session_date: new Date().toISOString().split("T")[0], chief_complaint: "", notes: "", followup_date: "", treatments: [] });
    fetchSessions();
  };

  const updateStatus = async (id: string, status: ConversionStatus) => {
    await supabase.from("counselling_sessions").update({ conversion_status: status }).eq("id", id);
    fetchSessions();
    if (selectedSession?.id === id) setSelectedSession(prev => prev ? { ...prev, conversion_status: status } : null);
  };

  const addTreatmentRow = () => setForm(f => ({ ...f, treatments: [...f.treatments, { service_id: "", service_name: "", price: "", recommended: false }] }));

  const selectService = (idx: number, serviceId: string) => {
    const svc = services.find(s => s.id === serviceId);
    const newT = [...form.treatments];
    newT[idx] = { service_id: serviceId, service_name: svc?.name || "", price: String(svc?.selling_price || ""), recommended: newT[idx].recommended };
    setForm(f => ({ ...f, treatments: newT }));
  };

  const kanbanCols: ConversionStatus[] = ["pending", "converted", "partial", "declined"];

  // H-8 fix: counselling is for counsellors, doctors, and admins
  const COUNSELLING_ROLES = ["superadmin", "chain_admin", "clinic_admin", "doctor", "counsellor"];
  if (profile && !COUNSELLING_ROLES.includes(profile.role ?? "")) {
    return (
      <div className="flex flex-col h-screen" style={{ background: "#F9F7F2" }}>
        <TopBar />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#6b7280", fontFamily: "Georgia, serif" }}>You don&apos;t have permission to access Counselling.</p>
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
          {(["sessions", "pipeline"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize"
              style={tab === t ? { background: "var(--gold)", color: "#fff", fontFamily: "Georgia, serif" } : { color: "rgba(197,160,89,0.7)" }}>
              {t === "sessions" ? "Sessions" : "Pipeline"}
            </button>
          ))}
        </div>

        {/* SESSIONS TAB */}
        {tab === "sessions" && (
          <div>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Counselling Sessions</h2>
              <button onClick={() => setDrawerOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: "var(--gold)" }}>
                <Plus size={15} /> New Session
              </button>
            </div>

            <div className="flex gap-5">
              {/* Sessions table */}
              <div className="flex-1 rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(197,160,89,0.1)", background: "rgba(197,160,89,0.04)" }}>
                      {["Date", "Patient", "Counsellor", "Treatments", "Proposed ₹", "Status", "Follow-up"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: "rgba(197,160,89,0.7)", letterSpacing: "0.05em" }}>{h.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-sm" style={{ color: "#9ca3af" }}>Loading…</td></tr>
                    ) : sessions.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-sm" style={{ color: "#9ca3af" }}>No sessions yet</td></tr>
                    ) : sessions.map(s => {
                      const sc = STATUS_CONFIG[s.conversion_status];
                      return (
                        <tr key={s.id} className="cursor-pointer hover:bg-amber-50/30 transition-colors" onClick={() => setSelectedSession(s)}
                          style={{ borderBottom: "1px solid rgba(197,160,89,0.06)" }}>
                          <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>{new Date(s.session_date).toLocaleDateString("en-IN")}</td>
                          <td className="px-4 py-3 text-sm font-medium" style={{ color: "#1a1714" }}>{s.patients?.full_name}</td>
                          <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>{s.profiles?.full_name || "—"}</td>
                          <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>{s.treatments_discussed?.length || 0}</td>
                          <td className="px-4 py-3 text-sm font-medium" style={{ color: "#1a1714" }}>₹{(s.total_proposed || 0).toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>
                            {s.followup_date ? new Date(s.followup_date).toLocaleDateString("en-IN") : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Detail panel */}
              {selectedSession && (
                <div className="w-80 rounded-xl flex flex-col" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
                  <div className="flex justify-between items-center px-4 py-4" style={{ borderBottom: "1px solid rgba(197,160,89,0.1)" }}>
                    <h3 className="font-semibold text-sm" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Session Detail</h3>
                    <button onClick={() => setSelectedSession(null)}><X size={15} style={{ color: "#9ca3af" }} /></button>
                  </div>
                  <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    <div>
                      <p className="text-xs font-medium mb-0.5" style={{ color: "rgba(197,160,89,0.8)" }}>PATIENT</p>
                      <p className="text-sm font-medium" style={{ color: "#1a1714" }}>{selectedSession.patients?.full_name}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-0.5" style={{ color: "rgba(197,160,89,0.8)" }}>COMPLAINT</p>
                      <p className="text-sm" style={{ color: "#4b5563" }}>{selectedSession.chief_complaint || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-2" style={{ color: "rgba(197,160,89,0.8)" }}>TREATMENTS DISCUSSED</p>
                      {selectedSession.treatments_discussed?.map((t, i) => (
                        <div key={i} className="flex justify-between items-center py-1.5 border-b" style={{ borderColor: "rgba(197,160,89,0.08)" }}>
                          <span className="text-xs" style={{ color: "#4b5563" }}>{t.service_name}</span>
                          <span className="text-xs font-medium" style={{ color: "#1a1714" }}>₹{t.price.toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="flex justify-between pt-2">
                        <span className="text-xs font-medium" style={{ color: "#6b7280" }}>Total Proposed</span>
                        <span className="text-sm font-bold" style={{ color: "var(--gold)" }}>₹{(selectedSession.total_proposed || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-2" style={{ color: "rgba(197,160,89,0.8)" }}>UPDATE STATUS</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {kanbanCols.map(s => {
                          const sc = STATUS_CONFIG[s];
                          return (
                            <button key={s} onClick={() => updateStatus(selectedSession.id, s)}
                              className="text-xs px-2 py-1.5 rounded-lg font-medium transition-all"
                              style={{
                                background: selectedSession.conversion_status === s ? sc.bg : "transparent",
                                color: sc.color, border: `1px solid ${sc.color}30`,
                              }}>{sc.label}</button>
                          );
                        })}
                      </div>
                    </div>
                    {selectedSession.notes && (
                      <div>
                        <p className="text-xs font-medium mb-0.5" style={{ color: "rgba(197,160,89,0.8)" }}>NOTES</p>
                        <p className="text-sm" style={{ color: "#4b5563" }}>{selectedSession.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PIPELINE TAB */}
        {tab === "pipeline" && (
          <div>
            <h2 className="text-lg font-semibold mb-5" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Conversion Pipeline</h2>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {kanbanCols.map(status => {
                const sc = STATUS_CONFIG[status];
                const StatusIcon = sc.icon;
                const colSessions = sessions.filter(s => s.conversion_status === status);
                return (
                  <div key={status} className="flex-shrink-0 w-72">
                    <div className="flex items-center gap-2 mb-3 px-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: sc.bg }}>
                        <StatusIcon size={12} style={{ color: sc.color }} />
                      </div>
                      <span className="text-sm font-semibold" style={{ color: "#1a1714", fontFamily: "Georgia, serif" }}>{sc.label}</span>
                      <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: sc.bg, color: sc.color }}>{colSessions.length}</span>
                    </div>
                    <div className="space-y-2">
                      {colSessions.map(s => (
                        <div key={s.id} className="p-3 rounded-xl" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.12)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                          <p className="text-sm font-medium mb-1" style={{ color: "#1a1714", fontFamily: "Georgia, serif" }}>{s.patients?.full_name}</p>
                          <p className="text-xs mb-2" style={{ color: "#6b7280" }}>{s.profiles?.full_name || "Unassigned"}</p>
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold" style={{ color: "var(--gold)" }}>₹{(s.total_proposed || 0).toLocaleString()}</span>
                            {s.followup_date && (
                              <div className="flex items-center gap-1">
                                <Calendar size={10} style={{ color: "#9ca3af" }} />
                                <span className="text-xs" style={{ color: "#9ca3af" }}>{new Date(s.followup_date).toLocaleDateString("en-IN")}</span>
                              </div>
                            )}
                          </div>
                          <select className="w-full mt-2 text-xs px-2 py-1 rounded-lg border bg-white"
                            style={{ borderColor: "rgba(197,160,89,0.2)", color: sc.color }}
                            value={s.conversion_status}
                            onChange={e => updateStatus(s.id, e.target.value as ConversionStatus)}>
                            {kanbanCols.map(st => <option key={st} value={st}>{STATUS_CONFIG[st].label}</option>)}
                          </select>
                        </div>
                      ))}
                      {colSessions.length === 0 && (
                        <div className="p-4 rounded-xl text-center text-xs" style={{ background: "rgba(197,160,89,0.04)", color: "#9ca3af", border: "1px dashed rgba(197,160,89,0.15)" }}>No sessions</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* NEW SESSION DRAWER */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setDrawerOpen(false)} />
          <div className="w-[520px] h-full overflow-y-auto flex flex-col" style={{ background: "#fff" }}>
            <div className="flex justify-between items-center px-6 py-5" style={{ borderBottom: "1px solid rgba(197,160,89,0.15)" }}>
              <h3 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>New Session</h3>
              <button onClick={() => setDrawerOpen(false)} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="flex-1 p-6 space-y-4">
              {/* Patient */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Patient *</label>
                <input value={form.patient_search}
                  onChange={e => { setForm(f => ({ ...f, patient_search: e.target.value, patient_id: "" })); searchPatients(e.target.value); }}
                  placeholder="Search patient name…" className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                {patientResults.length > 0 && !form.patient_id && (
                  <div className="mt-1 border rounded-lg overflow-hidden" style={{ borderColor: "rgba(197,160,89,0.2)" }}>
                    {patientResults.map(p => (
                      <button key={p.id} className="w-full px-3 py-2 text-sm text-left hover:bg-gray-50"
                        onClick={() => { setForm(f => ({ ...f, patient_id: p.id, patient_search: p.full_name })); setPatientResults([]); }}>
                        {p.full_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Counsellor</label>
                  <select value={form.counsellor_id} onChange={e => setForm(f => ({ ...f, counsellor_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border outline-none text-sm bg-white"
                    style={{ borderColor: "rgba(197,160,89,0.3)" }}>
                    <option value="">Select counsellor</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Session Date</label>
                  <input type="date" value={form.session_date} onChange={e => setForm(f => ({ ...f, session_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                    style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Chief Complaint</label>
                <input value={form.chief_complaint} onChange={e => setForm(f => ({ ...f, chief_complaint: e.target.value }))}
                  placeholder="e.g. Pigmentation on cheeks, wants skin brightening" className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }} />
              </div>

              {/* Treatments Builder */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-medium" style={{ color: "#4b5563" }}>Treatments Discussed</label>
                  <button onClick={addTreatmentRow}
                    className="text-xs px-2 py-1 rounded flex items-center gap-1" style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)" }}>
                    <Plus size={11} /> Add Treatment
                  </button>
                </div>
                <div className="space-y-2">
                  {form.treatments.map((t, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <select value={t.service_id} onChange={e => selectService(i, e.target.value)}
                        className="flex-1 text-xs px-2 py-1.5 rounded border bg-white" style={{ borderColor: "rgba(197,160,89,0.3)" }}>
                        <option value="">Select service</option>
                        {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <input value={t.price} onChange={e => { const nt = [...form.treatments]; nt[i].price = e.target.value; setForm(f => ({ ...f, treatments: nt })); }}
                        placeholder="₹" className="w-20 text-xs px-2 py-1.5 rounded border" style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                      <label className="flex items-center gap-1 text-xs flex-shrink-0" style={{ color: "#4b5563" }}>
                        <input type="checkbox" checked={t.recommended} onChange={e => { const nt = [...form.treatments]; nt[i].recommended = e.target.checked; setForm(f => ({ ...f, treatments: nt })); }} />
                        Rec.
                      </label>
                      <button onClick={() => setForm(f => ({ ...f, treatments: f.treatments.filter((_, j) => j !== i) }))} className="p-1 hover:bg-red-50 rounded"><X size={12} style={{ color: "#ef4444" }} /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Follow-up Date</label>
                  <input type="date" value={form.followup_date} onChange={e => setForm(f => ({ ...f, followup_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                    style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3} placeholder="Additional notes…" className="w-full px-3 py-2 rounded-lg border outline-none text-sm resize-none"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }} />
              </div>
            </div>
            <div className="px-6 py-4 flex gap-3" style={{ borderTop: "1px solid rgba(197,160,89,0.15)" }}>
              <button onClick={() => setDrawerOpen(false)} className="flex-1 px-4 py-2 rounded-lg text-sm border" style={{ borderColor: "rgba(197,160,89,0.2)", color: "#6b7280" }}>Cancel</button>
              <button onClick={saveSession} disabled={saving || !form.patient_id}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "var(--gold)" }}>{saving ? "Saving…" : "Save Session"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
