"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, AlertTriangle, Star, CreditCard, TrendingUp, Calendar, Sparkles, Pencil, Check, MessageCircle, FileText, Send, Stethoscope, ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Patient, MedicalHistory, StickyNote, FITZPATRICK, TIER_CONFIG, fmtDate } from "../types";

const STICKY_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  gold:  { bg: "rgba(197,160,89,0.1)",  border: "rgba(197,160,89,0.4)",  text: "#7A5518", dot: "#C5A059" },
  red:   { bg: "rgba(220,38,38,0.08)",  border: "rgba(220,38,38,0.35)",  text: "#991B1B", dot: "#DC2626" },
  blue:  { bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.35)", text: "#1E3A8A", dot: "#3B82F6" },
  green: { bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.35)", text: "#065F46", dot: "#10B981" },
};

interface Props {
  patient: Patient;
  medicalHistory: MedicalHistory | null;
  clinicId: string;
  privacyMode: boolean;
}

interface GlobalCondition { id: string; name: string; category: string | null; icd10_code: string | null; }
interface PatientConditionRow { id: string; condition_id: string; severity: string | null; notes: string | null; diagnosed_at: string | null; conditions: GlobalCondition | null; }

export default function OverviewTab({ patient, medicalHistory, clinicId, privacyMode }: Props) {
  const [stickies, setStickies]     = useState<StickyNote[]>([]);
  const [addOpen, setAddOpen]       = useState(false);
  const [newText, setNewText]       = useState("");
  const [newColor, setNewColor]     = useState("gold");
  const [saving, setSaving]         = useState(false);
  const [kpi, setKpi]               = useState({ totalSpend: 0, totalVisits: 0, lastVisit: "" as string | null, activeCredits: 0, membership: "" as string | null });
  // Allergy editing
  const [allergyEdit, setAllergyEdit] = useState(false);
  const [allergyText, setAllergyText] = useState("");
  const [allergyMedId, setAllergyMedId] = useState<string | null>(null);
  const [savingAllergy, setSavingAllergy] = useState(false);
  // Patient conditions (O1)
  const [patConditions, setPatConditions] = useState<PatientConditionRow[]>([]);
  const [allConditions, setAllConditions] = useState<GlobalCondition[]>([]);
  const [showAddCond,   setShowAddCond]   = useState(false);
  const [selCondId,     setSelCondId]     = useState("");
  const [condSeverity,  setCondSeverity]  = useState<"mild"|"moderate"|"severe"|"">("");
  const [condNotes,     setCondNotes]     = useState("");
  const [savingCond,    setSavingCond]    = useState(false);

  useEffect(() => {
    // Init allergy edit text
    setAllergyText((patient.allergies ?? []).join(", "));
    // Load medical history id for upsert
    supabase.from("patient_medical_history").select("id").eq("patient_id", patient.id).maybeSingle()
      .then(({ data }) => setAllergyMedId(data?.id ?? null));
  }, [patient.id, patient.allergies]);

  const fetchConditions = useCallback(async () => {
    const [patRes, allRes] = await Promise.all([
      supabase.from("patient_conditions")
        .select("id, condition_id, severity, notes, diagnosed_at, conditions(id, name, category, icd10_code)")
        .eq("patient_id", patient.id).eq("clinic_id", clinicId),
      supabase.from("conditions").select("id, name, category, icd10_code").eq("is_active", true).order("category").order("name"),
    ]);
    setPatConditions((patRes.data ?? []).map((r: any) => ({
      ...r,
      conditions: Array.isArray(r.conditions) ? r.conditions[0] ?? null : r.conditions,
    })));
    setAllConditions(allRes.data ?? []);
  }, [patient.id, clinicId]);

  useEffect(() => { fetchConditions(); }, [fetchConditions]);

  const addPatientCondition = async () => {
    if (!selCondId) { toast.error("Select a condition"); return; }
    setSavingCond(true);
    try {
      const { error } = await supabase.from("patient_conditions").insert({
        patient_id:   patient.id,
        clinic_id:    clinicId,
        condition_id: selCondId,
        severity:     condSeverity || null,
        notes:        condNotes || null,
        diagnosed_at: new Date().toISOString().split("T")[0],
      });
      if (error) throw error;
      toast.success("Condition added");
      setShowAddCond(false); setSelCondId(""); setCondSeverity(""); setCondNotes("");
      fetchConditions();
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingCond(false); }
  };

  const removePatientCondition = async (id: string) => {
    await supabase.from("patient_conditions").delete().eq("id", id);
    fetchConditions();
  };

  async function saveAllergies() {
    setSavingAllergy(true);
    const arr = allergyText.split(",").map(s => s.trim()).filter(Boolean);
    try {
      if (allergyMedId) {
        await supabase.from("patient_medical_history").update({ allergies: arr }).eq("id", allergyMedId);
      } else {
        const { data } = await supabase.from("patient_medical_history").insert({
          patient_id: patient.id, clinic_id: clinicId, allergies: arr, recorded_at: new Date().toISOString(),
        }).select("id").single();
        if (data) setAllergyMedId(data.id);
      }
      // Also update patients.allergies for instant display
      await supabase.from("patients").update({ allergies: arr }).eq("id", patient.id);
      toast.success("Allergies updated");
      setAllergyEdit(false);
    } catch { toast.error("Failed to save allergies"); }
    finally { setSavingAllergy(false); }
  }

  useEffect(() => {
    async function load() {
      const [snRes, invoiceRes, apptRes, credRes, memRes] = await Promise.all([
        supabase.from("patient_sticky_notes").select("id,content,color,created_at").eq("patient_id", patient.id).eq("is_active", true).order("created_at", { ascending: false }),
        supabase.from("pending_invoices").select("total_amount").eq("patient_id", patient.id).eq("status", "paid"),
        supabase.from("appointments").select("start_time").eq("patient_id", patient.id).order("start_time", { ascending: false }).limit(1),
        supabase.from("patient_service_credits").select("id").eq("patient_id", patient.id).eq("status", "active"),
        supabase.from("patient_memberships").select("plan:membership_plans!plan_id(name)").eq("patient_id", patient.id).eq("status", "active").limit(1).maybeSingle(),
      ]);
      const totalSpend = (invoiceRes.data ?? []).reduce((s, r) => s + (r.total_amount ?? 0), 0);
      const visits = await supabase.from("appointments").select("id", { count: "exact", head: true }).eq("patient_id", patient.id).eq("status", "completed");
      const planData = memRes.data?.plan as { name?: string } | null;
      setStickies((snRes.data ?? []) as StickyNote[]);
      setKpi({
        totalSpend,
        totalVisits:   visits.count ?? 0,
        lastVisit:     apptRes.data?.[0]?.start_time ?? null,
        activeCredits: (credRes.data ?? []).length,
        membership:    planData?.name ?? null,
      });
    }
    load();
  }, [patient.id]);

  async function addSticky() {
    if (!newText.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/patients/${patient.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_sticky_note", content: newText, color: newColor }),
    });
    const json = await res.json();
    if (res.ok) {
      setStickies(prev => [{ id: json.id, content: newText, color: newColor, created_at: new Date().toISOString() }, ...prev]);
      setNewText(""); setAddOpen(false);
    }
    setSaving(false);
  }

  async function dismissSticky(id: string) {
    await fetch(`/api/patients/${patient.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss_sticky_note", noteId: id }),
    });
    setStickies(prev => prev.filter(s => s.id !== id));
  }

  const fitz = FITZPATRICK[patient.fitzpatrick_type ?? 0];
  const tier = TIER_CONFIG[patient.patient_tier ?? "standard"] ?? TIER_CONFIG.standard;

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Sticky Alerts */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle size={13} color="#C5A059" />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280" }}>Alert Notes</span>
          </div>
          <button onClick={() => setAddOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.06)", color: "#C5A059", cursor: "pointer" }}>
            <Plus size={11} /> Add Note
          </button>
        </div>

        {addOpen && (
          <div style={{ padding: 14, borderRadius: 12, border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.04)", marginBottom: 10 }}>
            <textarea
              rows={2}
              placeholder="e.g. Allergic to lidocaine — use alternative anaesthetic"
              value={newText}
              onChange={e => setNewText(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, resize: "none", outline: "none", fontFamily: "Georgia, serif", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
              <div style={{ display: "flex", gap: 6 }}>
                {Object.entries(STICKY_COLORS).map(([c, cfg]) => (
                  <button key={c} onClick={() => setNewColor(c)}
                    style={{ width: 20, height: 20, borderRadius: "50%", background: cfg.dot, border: newColor === c ? "2px solid #1C1917" : "2px solid transparent", cursor: "pointer" }} />
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setAddOpen(false)} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "#fff", cursor: "pointer", color: "#6B7280" }}>Cancel</button>
                <button onClick={addSticky} disabled={saving || !newText.trim()}
                  style={{ fontSize: 12, padding: "4px 12px", borderRadius: 8, border: "none", background: saving ? "rgba(197,160,89,0.5)" : "var(--gold)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}

        {stickies.length === 0 && !addOpen && (
          <p style={{ fontSize: 12, color: "rgba(107,114,128,0.6)", fontStyle: "italic" }}>No active alerts — add a note to flag important information</p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {stickies.map(s => {
            const cfg = STICKY_COLORS[s.color] ?? STICKY_COLORS.gold;
            return (
              <div key={s.id} style={{ padding: "10px 14px", borderRadius: 10, background: cfg.bg, border: `1px solid ${cfg.border}`, display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, flexShrink: 0, marginTop: 5 }} />
                <p style={{ flex: 1, fontSize: 13, color: cfg.text, fontFamily: "Georgia, serif", margin: 0, lineHeight: 1.5 }}>{s.content}</p>
                <button onClick={() => dismissSticky(s.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, flexShrink: 0 }}>
                  <X size={12} color={cfg.dot} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* KPI row */}
      <section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            { label: "Total Spend",    value: privacyMode ? "₹ ••••" : `₹${kpi.totalSpend.toLocaleString("en-IN")}`, icon: TrendingUp, color: "#C5A059" },
            { label: "Completed Visits", value: kpi.totalVisits,   icon: Calendar, color: "#8B7EC8" },
            { label: "Active Credits",  value: kpi.activeCredits,  icon: CreditCard, color: "#7A9E8E" },
            { label: "Wallet Balance",  value: privacyMode ? "₹ ••••" : `₹${(patient.wallet_balance ?? 0).toLocaleString("en-IN")}`, icon: Sparkles, color: "#C5A059" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} style={{ padding: "14px 16px", borderRadius: 12, background: "#fff", border: "1px solid rgba(197,160,89,0.15)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Icon size={13} color={color} />
                <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280", fontWeight: 600 }}>{label}</span>
              </div>
              <p style={{ fontSize: 20, fontWeight: 700, fontFamily: "Georgia, serif", color: "#1C1917", margin: 0 }}>{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {[
            { label: "Book Appointment", icon: Calendar, color: "#C5A059", href: `/scheduler?patient=${patient.id}` },
            { label: "New Invoice",      icon: FileText,  color: "#2563EB", href: `/billing?patient=${patient.id}` },
            { label: "Send WhatsApp",    icon: MessageCircle, color: "#16a34a",
              onClick: () => { const p = patient.phone?.replace(/\D/g,""); if (p) window.open(`https://wa.me/91${p}`, "_blank"); } },
            { label: "Copy Portal Link", icon: Send, color: "#7C3AED",
              onClick: () => { navigator.clipboard.writeText(`${window.location.origin}/portal?phone=${patient.phone ?? ""}`); toast.success("Portal link copied"); } },
          ].map(({ label, icon: Icon, color, href, onClick }) => (
            href ? (
              <a key={label} href={href} style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: "12px 8px", borderRadius: 10, background: "#fff",
                border: "1px solid rgba(197,160,89,0.15)", textDecoration: "none", gap: 6,
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)", transition: "box-shadow 0.15s",
              }}>
                <Icon size={18} color={color} />
                <span style={{ fontSize: 10, fontWeight: 600, color: "#3C3830", textAlign: "center", lineHeight: 1.3 }}>{label}</span>
              </a>
            ) : (
              <button key={label} onClick={onClick} style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: "12px 8px", borderRadius: 10, background: "#fff",
                border: "1px solid rgba(197,160,89,0.15)", cursor: "pointer", gap: 6,
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}>
                <Icon size={18} color={color} />
                <span style={{ fontSize: 10, fontWeight: 600, color: "#3C3830", textAlign: "center", lineHeight: 1.3 }}>{label}</span>
              </button>
            )
          ))}
        </div>
      </section>

      {/* Clinical snapshot */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Skin profile */}
        <div style={{ padding: 16, borderRadius: 12, background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280" }}>Skin Profile</span>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            {fitz && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "#6B7280" }}>Fitzpatrick</span>
                <span style={{ fontSize: 12, fontWeight: 700, padding: "1px 8px", borderRadius: 999, background: fitz.bg, color: fitz.text }}>{fitz.label} — {fitz.desc}</span>
              </div>
            )}
            {medicalHistory?.skin_type && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "#6B7280" }}>Skin Type</span>
                <span style={{ fontSize: 12, color: "#1C1917", fontWeight: 600 }}>{medicalHistory.skin_type}</span>
              </div>
            )}
            {(patient.primary_concern ?? []).map(c => (
              <div key={c} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 999, background: "rgba(197,160,89,0.08)", color: "#C5A059", display: "inline-block", width: "fit-content" }}>{c}</div>
            ))}
          </div>
        </div>

        {/* Loyalty & Membership */}
        <div style={{ padding: 16, borderRadius: 12, background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280" }}>Loyalty</span>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#6B7280" }}>Tier</span>
              <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 999, background: tier.bg, color: tier.text, border: `1px solid ${tier.border}` }}>{tier.label}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#6B7280" }}>Membership</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: kpi.membership ? "#C5A059" : "#9CA3AF" }}>
                {kpi.membership ?? "None"}
              </span>
            </div>
            {kpi.lastVisit && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "#6B7280" }}>Last Visit</span>
                <span style={{ fontSize: 12, color: "#1C1917" }}>{fmtDate(kpi.lastVisit)}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Critical medical flags */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280" }}>Critical Medical Flags</span>
          {!allergyEdit ? (
            <button onClick={() => { setAllergyText((patient.allergies ?? []).join(", ")); setAllergyEdit(true); }}
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.06)", color: "#C5A059", cursor: "pointer" }}>
              <Pencil size={10} /> Edit Allergies
            </button>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setAllergyEdit(false)} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#fff", color: "#6B7280", cursor: "pointer" }}>Cancel</button>
              <button onClick={saveAllergies} disabled={savingAllergy} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "none", background: "#C5A059", color: "#fff", cursor: "pointer" }}>
                {savingAllergy ? "Saving…" : <><Check size={10} /> Save</>}
              </button>
            </div>
          )}
        </div>
        <div style={{ padding: 14, borderRadius: 12, background: "rgba(220,38,38,0.04)", border: "1px solid rgba(220,38,38,0.2)" }}>
          {allergyEdit ? (
            <div>
              <p style={{ fontSize: 11, color: "#6B7280", marginBottom: 6 }}>Enter allergies separated by commas</p>
              <textarea
                rows={2} value={allergyText}
                onChange={e => setAllergyText(e.target.value)}
                placeholder="e.g. Lidocaine, Penicillin, Latex"
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(220,38,38,0.35)", fontSize: 13, resize: "none", outline: "none", background: "rgba(220,38,38,0.02)", boxSizing: "border-box" }}
              />
            </div>
          ) : (
            <>
              {(patient.allergies?.length ?? 0) > 0 ? patient.allergies!.map(a => (
                <div key={a} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <AlertTriangle size={12} color="#DC2626" />
                  <span style={{ fontSize: 13, color: "#991B1B", fontFamily: "Georgia, serif" }}>Allergy: <strong>{a}</strong></span>
                </div>
              )) : (
                <p style={{ fontSize: 12, color: "rgba(107,114,128,0.6)", fontStyle: "italic", margin: 0 }}>No allergies recorded — click Edit to add</p>
              )}
              {medicalHistory?.current_medications && (
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                  <strong>Medications:</strong> {medicalHistory.current_medications}
                </div>
              )}
              {medicalHistory?.had_prior_injections && (
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                  <strong>Prior injections:</strong> {medicalHistory.last_injection_date ? `Last: ${fmtDate(medicalHistory.last_injection_date)}` : "Yes"}{medicalHistory.injection_complications ? ` — Complications: ${medicalHistory.injection_complications}` : ""}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* O1: Patient Conditions */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Stethoscope size={13} style={{ color: "#6B7280" }} />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280" }}>Conditions</span>
          </div>
          <button onClick={() => setShowAddCond(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.06)", color: "#C5A059", cursor: "pointer" }}>
            <Plus size={10} /> Add
          </button>
        </div>

        {showAddCond && (
          <div style={{ padding: 12, borderRadius: 10, background: "rgba(197,160,89,0.04)", border: "1px solid rgba(197,160,89,0.15)", marginBottom: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 8 }}>
              <select value={selCondId} onChange={e => setSelCondId(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.3)", fontSize: 13, outline: "none", background: "#fff", color: "#1a1714" }}>
                <option value="">— Select condition —</option>
                {allConditions.map(c => <option key={c.id} value={c.id}>{c.name}{c.icd10_code ? ` (${c.icd10_code})` : ""}</option>)}
              </select>
              <select value={condSeverity} onChange={e => setCondSeverity(e.target.value as any)}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.3)", fontSize: 13, outline: "none", background: "#fff", color: "#1a1714" }}>
                <option value="">Severity</option>
                <option value="mild">Mild</option>
                <option value="moderate">Moderate</option>
                <option value="severe">Severe</option>
              </select>
            </div>
            <textarea value={condNotes} onChange={e => setCondNotes(e.target.value)} rows={1} placeholder="Notes (optional)"
              style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.3)", fontSize: 12, resize: "none", outline: "none", marginBottom: 8, boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setShowAddCond(false)} style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", color: "#6B7280", fontSize: 12, cursor: "pointer" }}>Cancel</button>
              <button onClick={addPatientCondition} disabled={savingCond} style={{ flex: 2, padding: "6px 0", borderRadius: 8, border: "none", background: "#C5A059", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                {savingCond ? "Saving…" : <><Check size={11} /> Add Condition</>}
              </button>
            </div>
          </div>
        )}

        {patConditions.length === 0 ? (
          <p style={{ fontSize: 12, color: "rgba(107,114,128,0.6)", fontStyle: "italic", padding: "10px 14px", borderRadius: 10, background: "rgba(0,0,0,0.02)", border: "1px solid #F3F4F6" }}>
            No conditions recorded
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {patConditions.map(pc => {
              const severityColor: Record<string, string> = { mild: "#16a34a", moderate: "#f59e0b", severe: "#DC2626" };
              return (
                <div key={pc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 10, background: "#faf9f7", border: "1px solid #F3F4F6" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1714" }}>{pc.conditions?.name ?? "—"}</span>
                      {pc.severity && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: `${severityColor[pc.severity]}18`, color: severityColor[pc.severity], textTransform: "capitalize" }}>
                          {pc.severity}
                        </span>
                      )}
                      {pc.conditions?.icd10_code && (
                        <span style={{ fontSize: 10, fontFamily: "monospace", color: "#2563eb" }}>{pc.conditions.icd10_code}</span>
                      )}
                    </div>
                    {pc.notes && <p style={{ fontSize: 11, color: "#6B7280", margin: "2px 0 0" }}>{pc.notes}</p>}
                  </div>
                  <button onClick={() => removePatientCondition(pc.id)} style={{ padding: 4, borderRadius: 6, border: "none", background: "none", cursor: "pointer", color: "#DC2626", opacity: 0.6 }}>
                    <X size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
