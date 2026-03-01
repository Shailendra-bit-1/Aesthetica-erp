"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import TopBar from "@/components/TopBar";
import {
  Plus, X, Calendar, TrendingUp, Clock, Check,
} from "lucide-react";

type PackageType = "single_service" | "custom_package" | "fixed_package";
type ConversionStatus = "pending" | "converted" | "partial" | "declined";

interface CounsellingSession {
  id: string;
  patient_id: string;
  counsellor_id: string | null;
  session_date: string;
  chief_complaint: string | null;
  treatments_discussed: Array<{
    service_id?: string; service_name: string;
    mrp: number; price: number; quoted_price: number;
    discount_pct: number; recommended: boolean;
  }>;
  total_proposed: number;
  total_accepted: number;
  conversion_status: ConversionStatus;
  package_type: PackageType | null;
  followup_date: string | null;
  notes: string | null;
  created_at: string;
  patients: { full_name: string };
  profiles: { full_name: string } | null;
}

interface Service { id: string; name: string; selling_price: number; mrp: number; }
interface Staff  { id: string; full_name: string; role: string; }

type TreatmentRow = {
  service_id: string; service_name: string;
  mrp: number; quoted_price: string; discount_pct: string; recommended: boolean;
};

interface DoctorTreatment {
  id: string; treatment_name: string; price: number | null;
  counselled_by: string | null; created_at: string;
}

const STATUS_CONFIG: Record<ConversionStatus, { bg: string; color: string; label: string; icon: React.ElementType }> = {
  pending:   { bg: "rgba(234,179,8,0.12)",  color: "#ca8a04", label: "Pending",   icon: Clock },
  converted: { bg: "rgba(34,197,94,0.12)",  color: "#16a34a", label: "Converted", icon: Check },
  partial:   { bg: "rgba(59,130,246,0.12)", color: "#2563eb", label: "Partial",   icon: TrendingUp },
  declined:  { bg: "rgba(239,68,68,0.12)",  color: "#dc2626", label: "Declined",  icon: X },
};

const PKG_OPTIONS: { key: PackageType; label: string }[] = [
  { key: "single_service", label: "Single Service" },
  { key: "custom_package", label: "Custom Package" },
  { key: "fixed_package",  label: "Fixed Package"  },
];

const PKG_BADGE: Record<PackageType, { label: string; color: string; bg: string }> = {
  single_service: { label: "Single",     color: "#2563eb", bg: "rgba(59,130,246,0.1)"  },
  custom_package: { label: "Custom Pkg", color: "#7c3aed", bg: "rgba(124,58,237,0.1)" },
  fixed_package:  { label: "Fixed Pkg",  color: "#059669", bg: "rgba(5,150,105,0.1)"  },
};

const makeEmptyForm = () => ({
  patient_search: "", patient_id: "", counsellor_id: "",
  session_date: new Date().toISOString().split("T")[0],
  chief_complaint: "", notes: "", followup_date: "",
  package_type: "single_service" as PackageType,
  treatments: [] as TreatmentRow[],
});

export default function CounsellingPage() {
  const { profile, activeClinicId } = useClinic();
  const clinicId = activeClinicId || profile?.clinic_id;

  const [tab, setTab]               = useState<"sessions" | "pipeline">("sessions");
  const [sessions, setSessions]     = useState<CounsellingSession[]>([]);
  const [services, setServices]     = useState<Service[]>([]);
  const [staff, setStaff]           = useState<Staff[]>([]);
  const [loading, setLoading]       = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<CounsellingSession | null>(null);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState(makeEmptyForm);
  const [patientResults, setPatientResults] = useState<Array<{ id: string; full_name: string }>>([]);
  const [doctorTreatments, setDoctorTreatments]   = useState<DoctorTreatment[]>([]);
  const [doctorPanelOpen, setDoctorPanelOpen]     = useState(false);

  const fetchSessions = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase
      .from("counselling_sessions")
      .select("*, patients(full_name), profiles(full_name)")
      .eq("clinic_id", clinicId)
      .order("session_date", { ascending: false });
    setSessions((data as CounsellingSession[]) || []);
  }, [clinicId]);

  const fetchServices = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase.from("services")
      .select("id, name, selling_price, mrp")
      .eq("clinic_id", clinicId).eq("is_active", true).order("name");
    setServices(data || []);
  }, [clinicId]);

  const fetchStaff = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase.from("profiles")
      .select("id, full_name, role")
      .eq("clinic_id", clinicId).eq("is_active", true)
      .in("role", ["counsellor", "doctor"]);
    setStaff(data || []);
  }, [clinicId]);

  const fetchDoctorTreatments = useCallback(async (patientId: string) => {
    const { data } = await supabase
      .from("patient_treatments")
      .select("id, treatment_name, price, counselled_by, created_at")
      .eq("patient_id", patientId)
      .eq("status", "proposed")
      .is("counselling_session_id", null);
    setDoctorTreatments(data || []);
  }, []);

  useEffect(() => {
    if (!clinicId) return;
    setLoading(true);
    Promise.all([fetchSessions(), fetchServices(), fetchStaff()]).finally(() => setLoading(false));
  }, [clinicId, fetchSessions, fetchServices, fetchStaff]);

  useEffect(() => {
    if (selectedSession) {
      fetchDoctorTreatments(selectedSession.patient_id);
      setDoctorPanelOpen(false);
    } else {
      setDoctorTreatments([]);
    }
  }, [selectedSession, fetchDoctorTreatments]);

  const searchPatients = async (q: string) => {
    if (!clinicId || q.length < 2) { setPatientResults([]); return; }
    const { data } = await supabase.from("patients").select("id, full_name")
      .eq("clinic_id", clinicId).ilike("full_name", `%${q}%`).limit(5);
    setPatientResults(data || []);
  };

  const addTreatmentRow = () => setForm(f => ({
    ...f,
    treatments: [...f.treatments, { service_id: "", service_name: "", mrp: 0, quoted_price: "", discount_pct: "", recommended: false }],
  }));

  const selectService = (idx: number, serviceId: string) => {
    const svc = services.find(s => s.id === serviceId);
    if (!svc) return;
    const effectiveMrp = svc.mrp || svc.selling_price;
    const disc = effectiveMrp > 0
      ? ((effectiveMrp - svc.selling_price) / effectiveMrp * 100).toFixed(1)
      : "0";
    const newT = [...form.treatments];
    newT[idx] = { ...newT[idx], service_id: svc.id, service_name: svc.name, mrp: effectiveMrp, quoted_price: String(svc.selling_price), discount_pct: disc };
    setForm(f => ({ ...f, treatments: newT }));
  };

  const updateRow = (idx: number, field: "quoted_price" | "discount_pct" | "recommended", value: string | boolean) => {
    const newT = [...form.treatments];
    const mrp  = newT[idx].mrp;
    if (field === "quoted_price") {
      const quoted = parseFloat(value as string) || 0;
      const disc   = mrp > 0 ? ((mrp - quoted) / mrp * 100).toFixed(1) : "0";
      newT[idx] = { ...newT[idx], quoted_price: value as string, discount_pct: disc };
    } else if (field === "discount_pct") {
      const disc   = parseFloat(value as string) || 0;
      const quoted = mrp > 0 ? (mrp * (1 - disc / 100)).toFixed(0) : "0";
      newT[idx] = { ...newT[idx], discount_pct: value as string, quoted_price: quoted };
    } else {
      newT[idx] = { ...newT[idx], recommended: value as boolean };
    }
    setForm(f => ({ ...f, treatments: newT }));
  };

  const saveSession = async () => {
    if (!clinicId || !form.patient_id) return;
    setSaving(true);

    const treatments = form.treatments.map(t => ({
      service_id:    t.service_id || undefined,
      service_name:  t.service_name,
      mrp:           t.mrp || 0,
      price:         parseFloat(t.quoted_price) || 0,
      quoted_price:  parseFloat(t.quoted_price) || 0,
      discount_pct:  parseFloat(t.discount_pct) || 0,
      recommended:   t.recommended,
    }));

    const total_proposed = treatments.reduce((s, t) => s + t.quoted_price, 0);
    const total_accepted  = treatments.filter(t => t.recommended).reduce((s, t) => s + t.quoted_price, 0);

    const { data: session, error } = await supabase
      .from("counselling_sessions")
      .insert({
        clinic_id:         clinicId,
        patient_id:        form.patient_id,
        counsellor_id:     form.counsellor_id || null,
        session_date:      form.session_date,
        chief_complaint:   form.chief_complaint || null,
        treatments_discussed: treatments,
        total_proposed,
        total_accepted,
        conversion_status: "pending",
        package_type:      form.package_type,
        followup_date:     form.followup_date || null,
        notes:             form.notes || null,
      })
      .select("id")
      .single();

    if (!error && session) {
      const counsellorName = staff.find(s => s.id === form.counsellor_id)?.full_name || null;
      const ptInserts = treatments.map(t => ({
        patient_id:              form.patient_id,
        clinic_id:               clinicId,
        treatment_name:          t.service_name,
        status:                  "proposed",
        price:                   t.quoted_price || null,
        quoted_price:            t.quoted_price || null,
        mrp:                     t.mrp || null,
        discount_pct:            t.discount_pct || null,
        package_type:            form.package_type,
        counselled_by:           counsellorName,
        counselling_session_id:  session.id,
        notes:                   form.notes || null,
      }));
      if (ptInserts.length > 0) {
        await supabase.from("patient_treatments").insert(ptInserts);
      }
    }

    setSaving(false);
    setDrawerOpen(false);
    setForm(makeEmptyForm());
    fetchSessions();
  };

  const updateStatus = async (id: string, status: ConversionStatus) => {
    await supabase.from("counselling_sessions").update({ conversion_status: status }).eq("id", id);
    fetchSessions();
    if (selectedSession?.id === id) setSelectedSession(prev => prev ? { ...prev, conversion_status: status } : null);
  };

  const includeInSession = (dt: DoctorTreatment) => {
    if (!selectedSession) return;
    setForm(f => ({
      ...f,
      patient_id:     selectedSession.patient_id,
      patient_search: selectedSession.patients.full_name,
      treatments: [...f.treatments, {
        service_id:    "",
        service_name:  dt.treatment_name,
        mrp:           dt.price || 0,
        quoted_price:  String(dt.price || ""),
        discount_pct:  "0",
        recommended:   false,
      }],
    }));
    setDrawerOpen(true);
  };

  // Drawer summary
  const summaryTotalMrp    = form.treatments.reduce((s, t) => s + (t.mrp || 0), 0);
  const summaryTotalQuoted = form.treatments.reduce((s, t) => s + (parseFloat(t.quoted_price) || 0), 0);
  const summaryAvgDisc     = form.treatments.length > 0
    ? form.treatments.reduce((s, t) => s + (parseFloat(t.discount_pct) || 0), 0) / form.treatments.length
    : 0;
  const summaryRec = form.treatments.filter(t => t.recommended).length;

  const kanbanCols: ConversionStatus[] = ["pending", "converted", "partial", "declined"];

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
                      {["Date", "Patient", "Counsellor", "Treatments", "Type", "Quoted ₹", "Status", "Follow-up"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: "rgba(197,160,89,0.7)", letterSpacing: "0.05em" }}>{h.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: "#9ca3af" }}>Loading…</td></tr>
                    ) : sessions.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: "#9ca3af" }}>No sessions yet</td></tr>
                    ) : sessions.map(s => {
                      const sc  = STATUS_CONFIG[s.conversion_status];
                      const pkg = s.package_type ? PKG_BADGE[s.package_type] : null;
                      return (
                        <tr key={s.id} className="cursor-pointer hover:bg-amber-50/30 transition-colors"
                          onClick={() => setSelectedSession(s)}
                          style={{ borderBottom: "1px solid rgba(197,160,89,0.06)" }}>
                          <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>{new Date(s.session_date).toLocaleDateString("en-IN")}</td>
                          <td className="px-4 py-3 text-sm font-medium" style={{ color: "#1a1714" }}>{s.patients?.full_name}</td>
                          <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>{s.profiles?.full_name || "—"}</td>
                          <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>{s.treatments_discussed?.length || 0}</td>
                          <td className="px-4 py-3">
                            {pkg ? (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: pkg.bg, color: pkg.color }}>{pkg.label}</span>
                            ) : <span style={{ color: "#9ca3af" }}>—</span>}
                          </td>
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
                <div className="w-96 rounded-xl flex flex-col" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
                  <div className="flex justify-between items-center px-4 py-4" style={{ borderBottom: "1px solid rgba(197,160,89,0.1)" }}>
                    <h3 className="font-semibold text-sm" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Session Detail</h3>
                    <button onClick={() => setSelectedSession(null)}><X size={15} style={{ color: "#9ca3af" }} /></button>
                  </div>

                  <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    <div>
                      <p className="text-xs font-medium mb-0.5" style={{ color: "rgba(197,160,89,0.8)" }}>PATIENT</p>
                      <p className="text-sm font-medium" style={{ color: "#1a1714" }}>{selectedSession.patients?.full_name}</p>
                    </div>

                    {selectedSession.package_type && (() => {
                      const pkg = PKG_BADGE[selectedSession.package_type!];
                      return (
                        <div>
                          <p className="text-xs font-medium mb-1" style={{ color: "rgba(197,160,89,0.8)" }}>PACKAGE TYPE</p>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: pkg.bg, color: pkg.color }}>{pkg.label}</span>
                        </div>
                      );
                    })()}

                    <div>
                      <p className="text-xs font-medium mb-0.5" style={{ color: "rgba(197,160,89,0.8)" }}>COMPLAINT</p>
                      <p className="text-sm" style={{ color: "#4b5563" }}>{selectedSession.chief_complaint || "—"}</p>
                    </div>

                    <div>
                      <p className="text-xs font-medium mb-2" style={{ color: "rgba(197,160,89,0.8)" }}>TREATMENTS DISCUSSED</p>
                      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(197,160,89,0.12)" }}>
                        <table className="w-full text-xs">
                          <thead>
                            <tr style={{ background: "rgba(197,160,89,0.06)" }}>
                              <th className="px-2 py-1.5 text-left font-medium" style={{ color: "#9ca3af" }}>Service</th>
                              <th className="px-2 py-1.5 text-right font-medium" style={{ color: "#9ca3af" }}>MRP</th>
                              <th className="px-2 py-1.5 text-right font-medium" style={{ color: "#9ca3af" }}>Quoted</th>
                              <th className="px-2 py-1.5 text-right font-medium" style={{ color: "#9ca3af" }}>Disc</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedSession.treatments_discussed?.map((t, i) => (
                              <tr key={i} style={{ borderTop: "1px solid rgba(197,160,89,0.08)" }}>
                                <td className="px-2 py-1.5" style={{ color: "#4b5563" }}>
                                  {t.service_name}
                                  {t.recommended && <span className="ml-1" style={{ color: "#16a34a" }}>✓</span>}
                                </td>
                                <td className="px-2 py-1.5 text-right" style={{ color: "#9ca3af" }}>₹{(t.mrp || 0).toLocaleString()}</td>
                                <td className="px-2 py-1.5 text-right font-medium" style={{ color: "#1a1714" }}>₹{(t.quoted_price || t.price || 0).toLocaleString()}</td>
                                <td className="px-2 py-1.5 text-right" style={{ color: t.discount_pct > 0 ? "#16a34a" : "#9ca3af" }}>
                                  {t.discount_pct > 0 ? `${Number(t.discount_pct).toFixed(1)}%` : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ borderTop: "1px solid rgba(197,160,89,0.15)", background: "rgba(197,160,89,0.04)" }}>
                              <td className="px-2 py-1.5 font-medium text-xs" style={{ color: "#6b7280" }}>Total</td>
                              <td className="px-2 py-1.5 text-right font-medium text-xs" style={{ color: "#9ca3af" }}>
                                ₹{(selectedSession.treatments_discussed?.reduce((s, t) => s + (t.mrp || 0), 0) || 0).toLocaleString()}
                              </td>
                              <td className="px-2 py-1.5 text-right font-bold text-xs" style={{ color: "var(--gold)" }}>
                                ₹{(selectedSession.total_proposed || 0).toLocaleString()}
                              </td>
                              <td />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    {/* Doctor-Proposed Treatments Panel */}
                    <div>
                      <button
                        className="flex items-center gap-2 w-full text-left py-1"
                        onClick={() => setDoctorPanelOpen(p => !p)}
                      >
                        <span className="text-xs font-medium" style={{ color: "rgba(197,160,89,0.8)" }}>DOCTOR&apos;S PROPOSED TREATMENTS</span>
                        {doctorTreatments.length > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: "rgba(59,130,246,0.1)", color: "#2563eb" }}>{doctorTreatments.length}</span>
                        )}
                        <span className="ml-auto text-xs" style={{ color: "#9ca3af" }}>{doctorPanelOpen ? "▲" : "▼"}</span>
                      </button>
                      {doctorPanelOpen && (
                        <div className="mt-2 space-y-1.5">
                          {doctorTreatments.length === 0 ? (
                            <p className="text-xs py-2 text-center" style={{ color: "#9ca3af" }}>No doctor-proposed treatments</p>
                          ) : doctorTreatments.map(dt => (
                            <div key={dt.id} className="flex items-center justify-between p-2 rounded-lg"
                              style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.12)" }}>
                              <div>
                                <p className="text-xs font-medium" style={{ color: "#1a1714" }}>{dt.treatment_name}</p>
                                {dt.price != null && <p className="text-xs" style={{ color: "#6b7280" }}>₹{dt.price.toLocaleString()}</p>}
                              </div>
                              <button onClick={() => includeInSession(dt)}
                                className="text-xs px-2 py-1 rounded-lg font-medium"
                                style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)" }}>
                                Include
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
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
                      {colSessions.map(s => {
                        const pkg = s.package_type ? PKG_BADGE[s.package_type] : null;
                        return (
                          <div key={s.id} className="p-3 rounded-xl" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.12)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                            <p className="text-sm font-medium mb-1" style={{ color: "#1a1714", fontFamily: "Georgia, serif" }}>{s.patients?.full_name}</p>
                            <p className="text-xs mb-1" style={{ color: "#6b7280" }}>{s.profiles?.full_name || "Unassigned"}</p>
                            {pkg && (
                              <span className="inline-block text-xs px-1.5 py-0.5 rounded-full mb-2 font-medium" style={{ background: pkg.bg, color: pkg.color }}>{pkg.label}</span>
                            )}
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
                        );
                      })}
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
          <div className="w-[700px] h-full overflow-y-auto flex flex-col" style={{ background: "#fff" }}>
            <div className="flex justify-between items-center px-6 py-5" style={{ borderBottom: "1px solid rgba(197,160,89,0.15)" }}>
              <h3 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>New Session</h3>
              <button onClick={() => setDrawerOpen(false)} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>

            <div className="flex-1 p-6 space-y-5">
              {/* Patient search */}
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
                  placeholder="e.g. Pigmentation on cheeks, wants skin brightening"
                  className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }} />
              </div>

              {/* Package Type toggle */}
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: "#4b5563" }}>Package Type</label>
                <div className="flex gap-2">
                  {PKG_OPTIONS.map(opt => (
                    <button key={opt.key}
                      onClick={() => setForm(f => ({ ...f, package_type: opt.key }))}
                      className="flex-1 py-2 text-xs font-medium rounded-lg border transition-all"
                      style={form.package_type === opt.key
                        ? { background: "var(--gold)", color: "#fff", border: "1px solid var(--gold)" }
                        : { background: "transparent", color: "#6b7280", border: "1px solid rgba(197,160,89,0.25)" }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Treatments builder */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-medium" style={{ color: "#4b5563" }}>Treatments Discussed</label>
                  <button onClick={addTreatmentRow}
                    className="text-xs px-2 py-1 rounded flex items-center gap-1"
                    style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)" }}>
                    <Plus size={11} /> Add Treatment
                  </button>
                </div>

                {form.treatments.length === 0 ? (
                  <div className="text-center py-4 rounded-lg text-xs" style={{ color: "#9ca3af", border: "1px dashed rgba(197,160,89,0.2)" }}>
                    Click &quot;Add Treatment&quot; to add services discussed
                  </div>
                ) : (
                  <>
                    {/* Column headers */}
                    <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: "1fr 75px 85px 68px 40px 24px" }}>
                      {["Service", "MRP ₹", "Quoted ₹", "Disc %", "Rec.", ""].map(h => (
                        <span key={h} className="text-xs font-medium px-1" style={{ color: "#9ca3af" }}>{h}</span>
                      ))}
                    </div>

                    {/* Treatment rows */}
                    <div className="space-y-1.5">
                      {form.treatments.map((t, i) => (
                        <div key={i} className="grid gap-1 items-center" style={{ gridTemplateColumns: "1fr 75px 85px 68px 40px 24px" }}>
                          <select value={t.service_id} onChange={e => selectService(i, e.target.value)}
                            className="text-xs px-2 py-1.5 rounded border bg-white"
                            style={{ borderColor: "rgba(197,160,89,0.3)" }}>
                            <option value="">Select service</option>
                            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                          <input readOnly
                            value={t.mrp ? `₹${t.mrp.toLocaleString()}` : "—"}
                            className="text-xs px-2 py-1.5 rounded border text-center"
                            style={{ borderColor: "rgba(197,160,89,0.12)", background: "rgba(249,247,242,0.8)", color: "#9ca3af" }} />
                          <input type="number" value={t.quoted_price}
                            onChange={e => updateRow(i, "quoted_price", e.target.value)}
                            placeholder="0"
                            className="text-xs px-2 py-1.5 rounded border"
                            style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                          <input type="number" value={t.discount_pct}
                            onChange={e => updateRow(i, "discount_pct", e.target.value)}
                            placeholder="0"
                            className="text-xs px-2 py-1.5 rounded border"
                            style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                          <label className="flex items-center justify-center cursor-pointer">
                            <input type="checkbox" checked={t.recommended}
                              onChange={e => updateRow(i, "recommended", e.target.checked)}
                              className="w-3.5 h-3.5" />
                          </label>
                          <button onClick={() => setForm(f => ({ ...f, treatments: f.treatments.filter((_, j) => j !== i) }))}
                            className="p-1 hover:bg-red-50 rounded flex items-center justify-center">
                            <X size={12} style={{ color: "#ef4444" }} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Summary table */}
                    {form.treatments.some(t => t.service_name) && (
                      <div className="mt-4 rounded-lg overflow-hidden" style={{ border: "1px solid rgba(197,160,89,0.15)" }}>
                        <table className="w-full text-xs">
                          <thead>
                            <tr style={{ background: "rgba(197,160,89,0.06)" }}>
                              <th className="px-3 py-2 text-left font-medium" style={{ color: "#9ca3af" }}>Service</th>
                              <th className="px-3 py-2 text-right font-medium" style={{ color: "#9ca3af" }}>MRP</th>
                              <th className="px-3 py-2 text-right font-medium" style={{ color: "#9ca3af" }}>Quoted</th>
                              <th className="px-3 py-2 text-right font-medium" style={{ color: "#9ca3af" }}>Discount</th>
                              <th className="px-3 py-2 text-center font-medium" style={{ color: "#9ca3af" }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {form.treatments.filter(t => t.service_name).map((t, i) => (
                              <tr key={i} style={{ borderTop: "1px solid rgba(197,160,89,0.08)" }}>
                                <td className="px-3 py-2" style={{ color: "#1a1714" }}>{t.service_name}</td>
                                <td className="px-3 py-2 text-right" style={{ color: "#9ca3af" }}>
                                  {t.mrp ? `₹${t.mrp.toLocaleString()}` : "—"}
                                </td>
                                <td className="px-3 py-2 text-right font-medium" style={{ color: "#1a1714" }}>
                                  {t.quoted_price ? `₹${parseFloat(t.quoted_price).toLocaleString()}` : "—"}
                                </td>
                                <td className="px-3 py-2 text-right" style={{ color: parseFloat(t.discount_pct) > 0 ? "#16a34a" : "#9ca3af" }}>
                                  {parseFloat(t.discount_pct) > 0 ? `${parseFloat(t.discount_pct).toFixed(1)}%` : "—"}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {t.recommended
                                    ? <span style={{ color: "#16a34a" }}>✓ Rec.</span>
                                    : <span style={{ color: "#9ca3af" }}>Not rec.</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ borderTop: "2px solid rgba(197,160,89,0.2)", background: "rgba(197,160,89,0.04)" }}>
                              <td className="px-3 py-2 font-semibold text-xs" style={{ color: "#6b7280" }}>TOTAL</td>
                              <td className="px-3 py-2 text-right font-semibold" style={{ color: "#9ca3af" }}>
                                {summaryTotalMrp > 0 ? `₹${summaryTotalMrp.toLocaleString()}` : "—"}
                              </td>
                              <td className="px-3 py-2 text-right font-bold" style={{ color: "var(--gold)" }}>
                                ₹{summaryTotalQuoted.toLocaleString()}
                              </td>
                              <td className="px-3 py-2 text-right" style={{ color: "#6b7280" }}>
                                {summaryAvgDisc > 0 ? `Avg ${summaryAvgDisc.toFixed(1)}%` : "—"}
                              </td>
                              <td className="px-3 py-2 text-center text-xs" style={{ color: "#6b7280" }}>
                                {summaryRec} accepted
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </>
                )}
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
                  rows={3} placeholder="Additional notes…"
                  className="w-full px-3 py-2 rounded-lg border outline-none text-sm resize-none"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }} />
              </div>
            </div>

            <div className="px-6 py-4 flex gap-3" style={{ borderTop: "1px solid rgba(197,160,89,0.15)" }}>
              <button onClick={() => setDrawerOpen(false)}
                className="flex-1 px-4 py-2 rounded-lg text-sm border"
                style={{ borderColor: "rgba(197,160,89,0.2)", color: "#6b7280" }}>Cancel</button>
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
