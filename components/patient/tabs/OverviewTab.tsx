"use client";

import { useState, useEffect } from "react";
import { Plus, X, AlertTriangle, Star, CreditCard, Users, TrendingUp, Calendar, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
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

export default function OverviewTab({ patient, medicalHistory, clinicId, privacyMode }: Props) {
  const [stickies, setStickies]     = useState<StickyNote[]>([]);
  const [addOpen, setAddOpen]       = useState(false);
  const [newText, setNewText]       = useState("");
  const [newColor, setNewColor]     = useState("gold");
  const [saving, setSaving]         = useState(false);
  const [kpi, setKpi]               = useState({ totalSpend: 0, totalVisits: 0, lastVisit: "" as string | null, activeCredits: 0, membership: "" as string | null });

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
      {(patient.allergies?.length || medicalHistory?.current_medications || medicalHistory?.had_prior_injections) && (
        <section>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280", display: "block", marginBottom: 8 }}>Critical Medical Flags</span>
          <div style={{ padding: 14, borderRadius: 12, background: "rgba(220,38,38,0.04)", border: "1px solid rgba(220,38,38,0.2)" }}>
            {patient.allergies?.map(a => (
              <div key={a} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <AlertTriangle size={12} color="#DC2626" />
                <span style={{ fontSize: 13, color: "#991B1B", fontFamily: "Georgia, serif" }}>Allergy: <strong>{a}</strong></span>
              </div>
            ))}
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
          </div>
        </section>
      )}
    </div>
  );
}
