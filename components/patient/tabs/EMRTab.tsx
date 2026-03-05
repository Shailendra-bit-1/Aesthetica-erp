"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Plus, X, Clipboard, FileText, Camera, Upload, Loader2,
  CheckCircle2, Stethoscope, DollarSign, ChevronDown, ChevronUp,
  AlertTriangle, Syringe, ShieldCheck, Activity, Star, Image,
  MessageCircle, Printer, Mail, Save, BookOpen,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import { toast } from "sonner";
import { Patient, MedicalHistory, Encounter, PatientNote, Treatment, fmtDate } from "../types";

// ─────────────────────── helpers ─────────────────────────────────────────────

function relDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 30) return `${d} days ago`;
  return fmtDate(iso);
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

// ─────────────────────── SOAP constants ──────────────────────────────────────

const SOAP_TABS = [
  { key: "subjective",  label: "S", title: "Subjective",  desc: "Patient's chief complaint, history of present illness, and review of symptoms in their own words." },
  { key: "objective",   label: "O", title: "Objective",   desc: "Provider's clinical observations, measurements, and physical examination findings." },
  { key: "assessment",  label: "A", title: "Assessment",  desc: "Clinical diagnosis, differential diagnoses, and overall evaluation of the patient's condition." },
  { key: "plan",        label: "P", title: "Plan",        desc: "Prescribed treatments, procedures performed, medications, follow-up instructions, and next steps." },
] as const;
type SOAPKey = typeof SOAP_TABS[number]["key"];

interface MedicalCode { code: string; description: string; category: string | null; }
interface Service { id: string; name: string; selling_price: number; mrp: number; }
interface Staff { id: string; full_name: string; role: string; }
type CounsTreatmentRow = {
  service_id: string; service_name: string;
  mrp: number; quoted_price: string; discount_pct: string; sessions: string; recommended: boolean;
};

// ─────────────────────── Props ────────────────────────────────────────────────

interface Props {
  patient: Patient;
  medicalHistory: MedicalHistory | null;
  notes: PatientNote[];
  encounters: Encounter[];
  clinicId: string;
  onRefresh: () => void;
}

// ─────────────────────── EMRTab ───────────────────────────────────────────────

export default function EMRTab({ patient, medicalHistory, notes, encounters, clinicId, onRefresh }: Props) {
  const [drawer, setDrawer]   = useState<"soap" | "note" | "treatment" | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const closeDrawer = () => { setDrawer(null); onRefresh(); };

  // Merged timeline entries
  type TEntry = { id: string; kind: "intake" | "soap" | "note"; date: string; data: unknown };
  const entries: TEntry[] = [];
  entries.push({ id: "intake", kind: "intake", date: patient.created_at, data: { patient, medicalHistory } });
  encounters.forEach(e => entries.push({ id: e.id, kind: "soap", date: e.created_at, data: e }));
  notes.forEach(n => entries.push({ id: n.id, kind: "note", date: n.created_at, data: n }));
  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <>
      <style>{`
        @keyframes emrSlideIn { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes emrFadeIn  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes emrSpin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Medical Summary panel */}
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <MedSummaryLeft patient={patient} medicalHistory={medicalHistory} />
          <MedSummaryRight medicalHistory={medicalHistory} />
        </section>

        {/* Action bar */}
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { key: "soap" as const,      label: "New Session",    icon: Clipboard,    bg: "linear-gradient(135deg,#C5A059,#A8853A)", color: "#fff" },
            { key: "note" as const,      label: "Quick Note",     icon: FileText,     bg: "rgba(107,114,128,0.08)", color: "#374151" },
            { key: "treatment" as const, label: "Add Counselling",icon: DollarSign,   bg: "rgba(5,150,105,0.08)",   color: "#059669" },
          ].map(({ key, label, icon: Icon, bg, color }) => (
            <button key={key} onClick={() => setDrawer(key)}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: "1px solid rgba(197,160,89,0.2)", background: bg, color, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              <Icon size={13} />{label}
            </button>
          ))}
        </div>

        {/* Clinical Timeline */}
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
            <Activity size={13} color="#C5A059" />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280" }}>Clinical Timeline</span>
            <span style={{ fontSize: 11, color: "#9CA3AF" }}>({entries.length} entries)</span>
          </div>

          {entries.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <Clipboard size={28} color="rgba(197,160,89,0.3)" style={{ margin: "0 auto 10px", display: "block" }} />
              <p style={{ fontSize: 13, color: "#9C9584", fontFamily: "Georgia, serif" }}>No clinical entries yet</p>
            </div>
          ) : (
            <div style={{ position: "relative", paddingLeft: 26 }}>
              <div style={{ position: "absolute", left: 8, top: 8, bottom: 8, width: 1, background: "rgba(197,160,89,0.18)" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {entries.map(e => <TimelineEntry key={e.id} entry={e} patient={patient} medicalHistory={medicalHistory} />)}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Drawers rendered in portal */}
      {mounted && drawer === "soap" && createPortal(
        <SOAPDrawer patient={patient} clinicId={clinicId} onClose={closeDrawer} />, document.body
      )}
      {mounted && drawer === "note" && createPortal(
        <NoteDrawer patientId={patient.id} onClose={closeDrawer} />, document.body
      )}
      {mounted && drawer === "treatment" && createPortal(
        <TreatmentDrawer patient={patient} onClose={closeDrawer} />, document.body
      )}
    </>
  );
}

// ─────────────────────── Medical Summary sub-panels ──────────────────────────

function MedSummaryLeft({ patient, medicalHistory }: { patient: Patient; medicalHistory: MedicalHistory | null }) {
  const allergies = patient.allergies?.filter(Boolean) ?? [];
  const concerns  = medicalHistory?.primary_concerns ?? patient.primary_concern ?? [];

  return (
    <div style={{ padding: 16, borderRadius: 12, background: "#fff", border: "1px solid rgba(197,160,89,0.15)", display: "flex", flexDirection: "column", gap: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280" }}>Medical Summary</span>

      {/* Allergies */}
      <div>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 5 }}>Allergies</p>
        {allergies.length > 0 ? allergies.map(a => (
          <div key={a} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <AlertTriangle size={11} color="#DC2626" />
            <span style={{ fontSize: 12, color: "#991B1B", fontFamily: "Georgia, serif" }}>{a}</span>
          </div>
        )) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ShieldCheck size={11} color="#059669" />
            <span style={{ fontSize: 12, color: "#059669" }}>No known allergies</span>
          </div>
        )}
      </div>

      {/* Primary Concerns */}
      {concerns.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 5 }}>Primary Concerns</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {concerns.map(c => (
              <span key={c} style={{ fontSize: 11, padding: "2px 9px", borderRadius: 999, background: "rgba(197,160,89,0.08)", border: "1px solid rgba(197,160,89,0.25)", color: "#7A5C14", fontFamily: "Georgia, serif" }}>{c}</span>
            ))}
          </div>
        </div>
      )}

      {/* Injection history */}
      {medicalHistory?.had_prior_injections != null && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 5 }}>Injection History</p>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Syringe size={11} color={medicalHistory.had_prior_injections ? "#C5A059" : "#9CA3AF"} />
            <span style={{ fontSize: 12, color: "#5C5447" }}>{medicalHistory.had_prior_injections ? "Prior injections — Yes" : "No prior injections"}</span>
          </div>
          {medicalHistory.last_injection_date && <p style={{ fontSize: 11, color: "#9C9584", marginLeft: 17, marginTop: 2 }}>Last: {medicalHistory.last_injection_date}</p>}
          {medicalHistory.injection_complications && <p style={{ fontSize: 11, color: "#B43C3C", marginLeft: 17, marginTop: 2 }}>⚠ {medicalHistory.injection_complications}</p>}
        </div>
      )}
    </div>
  );
}

function MedSummaryRight({ medicalHistory }: { medicalHistory: MedicalHistory | null }) {
  return (
    <div style={{ padding: 16, borderRadius: 12, background: "#fff", border: "1px solid rgba(197,160,89,0.15)", display: "flex", flexDirection: "column", gap: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280" }}>Clinical Details</span>

      {medicalHistory?.current_medications && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>Current Medications</p>
          <p style={{ fontSize: 12, color: "#3D3530", fontFamily: "Georgia, serif", lineHeight: 1.65, margin: 0, whiteSpace: "pre-wrap" }}>{medicalHistory.current_medications}</p>
        </div>
      )}

      {medicalHistory?.past_procedures && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>Past Procedures</p>
          <p style={{ fontSize: 12, color: "#3D3530", fontFamily: "Georgia, serif", lineHeight: 1.65, margin: 0, whiteSpace: "pre-wrap" }}>{medicalHistory.past_procedures}</p>
        </div>
      )}

      {medicalHistory?.skin_type && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>Skin Type</p>
          <p style={{ fontSize: 12, color: "#5C5447", fontFamily: "Georgia, serif", margin: 0 }}>{medicalHistory.skin_type}</p>
        </div>
      )}

      {medicalHistory?.patient_notes && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>Patient Notes</p>
          <p style={{ fontSize: 12, color: "#5C5447", fontFamily: "Georgia, serif", lineHeight: 1.65, margin: 0 }}>{medicalHistory.patient_notes}</p>
        </div>
      )}

      {!medicalHistory && (
        <p style={{ fontSize: 12, color: "#9CA3AF", fontStyle: "italic" }}>No detailed medical history recorded yet.</p>
      )}
    </div>
  );
}

// ─────────────────────── Timeline Entry ──────────────────────────────────────

function TimelineEntry({ entry, patient, medicalHistory }: {
  entry: { id: string; kind: string; date: string; data: unknown };
  patient: Patient;
  medicalHistory: MedicalHistory | null;
}) {
  const [expanded, setExpanded] = useState(true);

  const DOT: Record<string, string> = { intake: "#C5A059", soap: "#6366F1", note: "#6B7280" };
  const BADGE: Record<string, React.CSSProperties> = {
    intake: { background: "rgba(197,160,89,0.12)", color: "#8B6914", border: "1px solid rgba(197,160,89,0.3)" },
    soap:   { background: "rgba(99,102,241,0.1)",  color: "#4338CA", border: "1px solid rgba(99,102,241,0.25)" },
    note:   { background: "rgba(107,114,128,0.08)", color: "#4B5563", border: "1px solid rgba(107,114,128,0.2)" },
  };

  return (
    <div style={{ position: "relative", animation: "emrFadeIn 0.3s ease" }}>
      <div style={{ position: "absolute", left: -20, top: 14, width: 9, height: 9, borderRadius: "50%", background: DOT[entry.kind] ?? "#9C9584", border: "2px solid white", boxShadow: `0 0 0 2px ${DOT[entry.kind] ?? "#9C9584"}40` }} />
      <div style={{ background: "white", border: "1px solid rgba(197,160,89,0.14)", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(28,25,23,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", cursor: "pointer", borderBottom: expanded ? "1px solid rgba(197,160,89,0.08)" : "none" }}
          onClick={() => setExpanded(e => !e)}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, letterSpacing: "0.06em", textTransform: "uppercase", ...BADGE[entry.kind] }}>
            {entry.kind === "intake" ? "Intake" : entry.kind === "soap" ? "SOAP" : "Note"}
          </span>
          <span style={{ fontSize: 11, color: "#9C9584", flex: 1 }}>
            {relDate(entry.date)}{entry.kind === "soap" ? ` at ${fmtTime(entry.date)}` : ""}
          </span>
          {entry.kind === "soap" && <span style={{ fontSize: 11, color: "#9C9584" }}>{(entry.data as Encounter).created_by_name ?? "Provider"}</span>}
          {expanded ? <ChevronUp size={12} color="#B8AE9C" /> : <ChevronDown size={12} color="#B8AE9C" />}
        </div>
        {expanded && (
          <div style={{ padding: "12px 14px" }}>
            {entry.kind === "intake" && <IntakeBody data={{ patient, medicalHistory }} />}
            {entry.kind === "soap"   && <SOAPBody enc={entry.data as Encounter} />}
            {entry.kind === "note"   && <NoteBody note={entry.data as PatientNote} />}
          </div>
        )}
      </div>
    </div>
  );
}

function IntakeBody({ data }: { data: { patient: Patient; medicalHistory: MedicalHistory | null } }) {
  const { patient, medicalHistory } = data;
  const concerns = medicalHistory?.primary_concerns ?? patient.primary_concern ?? [];
  return (
    <div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
        {concerns.map(c => <span key={c} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(197,160,89,0.1)", color: "#7A5C14", border: "1px solid rgba(197,160,89,0.25)" }}>{c}</span>)}
      </div>
      {(medicalHistory?.patient_notes || patient.notes) && (
        <p style={{ fontSize: 12, color: "#6B6358", fontFamily: "Georgia, serif", lineHeight: 1.6, margin: 0 }}>{medicalHistory?.patient_notes ?? patient.notes}</p>
      )}
      <p style={{ fontSize: 10, color: "#B8AE9C", marginTop: 8 }}>Submitted via Digital Intake Form · {fmtDate(patient.created_at)}</p>
    </div>
  );
}

function SOAPBody({ enc }: { enc: Encounter }) {
  const sections = [
    { label: "Subjective", value: enc.subjective, color: "#6366F1" },
    { label: "Objective",  value: enc.objective,  color: "#0891B2" },
    { label: "Assessment", value: enc.assessment, color: "#059669" },
    { label: "Plan",       value: enc.plan,       color: "#D97706" },
  ].filter(s => s.value);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {sections.map(s => (
        <div key={s.label} style={{ borderLeft: `2px solid ${s.color}30`, paddingLeft: 10 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: s.color, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>{s.label}</p>
          <p style={{ fontSize: 12, color: "#3D3530", fontFamily: "Georgia, serif", lineHeight: 1.65, whiteSpace: "pre-wrap", margin: 0 }}>{s.value}</p>
        </div>
      ))}
      {sections.length === 0 && <p style={{ fontSize: 12, color: "#9C9584", fontStyle: "italic" }}>No SOAP details recorded.</p>}
      {enc.photos?.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: "#9C9584", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Photos</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {enc.photos.map((ph, i) => (
              <div key={i} style={{ position: "relative" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ph.url} alt={ph.caption ?? `Photo ${i + 1}`} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid rgba(197,160,89,0.2)" }} />
                {ph.type && <span style={{ position: "absolute", bottom: 3, left: 3, fontSize: 8, fontWeight: 700, padding: "1px 4px", borderRadius: 4, background: ph.type === "before" ? "#1C1917CC" : "#4A8A4ACC", color: "white", textTransform: "uppercase" }}>{ph.type}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NoteBody({ note }: { note: PatientNote }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: "#3D3530", fontFamily: "Georgia, serif", lineHeight: 1.65, margin: 0, whiteSpace: "pre-wrap" }}>{note.content}</p>
      {note.author_name && <p style={{ fontSize: 10, color: "#B8AE9C", marginTop: 6 }}>— {note.author_name}</p>}
    </div>
  );
}

// ─────────────────────── SOAP Drawer ─────────────────────────────────────────

function SOAPDrawer({ patient, clinicId, onClose }: { patient: Patient; clinicId: string; onClose: () => void }) {
  const [activeTab,     setActiveTab]     = useState<SOAPKey>("subjective");
  const [soap,          setSoap]          = useState({ subjective: "", objective: "", assessment: "", plan: "" });
  const [photos,        setPhotos]        = useState<{ file: File; preview: string; type: "before" | "after" }[]>([]);
  const [saving,        setSaving]        = useState(false);
  const [cptQuery,      setCptQuery]      = useState("");
  const [cptResults,    setCptResults]    = useState<MedicalCode[]>([]);
  const [cptSearching,  setCptSearching]  = useState(false);
  const [attachedCodes, setAttachedCodes] = useState<MedicalCode[]>([]);
  // B10: Injectable lot tracking
  const [injectables, setInjectables] = useState<{
    uid: string; productName: string; lotNumber: string;
    expiryDate: string; unitsUsed: string; injectionSite: string;
  }[]>([]);
  const [showTemplates,  setShowTemplates]  = useState(false);
  const [templates,      setTemplates]      = useState<{ id: string; name: string; fields: Record<string, string> }[]>([]);
  const fileRef  = useRef<HTMLInputElement>(null);
  const cptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadTemplates = useCallback(async () => {
    if (templates.length > 0) return; // already loaded
    const { data } = await supabase.from("form_definitions")
      .select("id, name: name, fields")
      .eq("form_type", "soap")
      .eq("is_active", true)
      .order("name");
    setTemplates(
      (data ?? []).map((t: any) => ({
        id: t.id,
        name: t.name,
        fields: t.fields as Record<string, string>,
      }))
    );
  }, [templates.length]);

  function applyTemplate(tpl: { fields: Record<string, string> }) {
    setSoap(s => ({
      subjective: tpl.fields.subjective ? (s.subjective ? `${s.subjective}\n${tpl.fields.subjective}` : tpl.fields.subjective) : s.subjective,
      objective:  tpl.fields.objective  ? (s.objective  ? `${s.objective}\n${tpl.fields.objective}`  : tpl.fields.objective)  : s.objective,
      assessment: tpl.fields.assessment ? (s.assessment ? `${s.assessment}\n${tpl.fields.assessment}` : tpl.fields.assessment) : s.assessment,
      plan:       tpl.fields.plan       ? (s.plan       ? `${s.plan}\n${tpl.fields.plan}`             : tpl.fields.plan)       : s.plan,
    }));
    setShowTemplates(false);
    toast.success("Template loaded");
  }

  function onCptInput(val: string) {
    setCptQuery(val);
    if (cptTimer.current) clearTimeout(cptTimer.current);
    if (!val.trim()) { setCptResults([]); return; }
    cptTimer.current = setTimeout(async () => {
      setCptSearching(true);
      const { data } = await supabase.from("medical_codes").select("code, description, category").or(`code.ilike.%${val}%,description.ilike.%${val}%`).order("code").limit(12);
      setCptResults(data ?? []);
      setCptSearching(false);
    }, 300);
  }

  function attachCode(code: MedicalCode) {
    if (attachedCodes.find(c => c.code === code.code)) return;
    setAttachedCodes(prev => [...prev, code]);
    setSoap(s => ({ ...s, plan: s.plan ? `${s.plan}\nCPT ${code.code} — ${code.description}` : `CPT ${code.code} — ${code.description}` }));
    setCptQuery(""); setCptResults([]);
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    Array.from(e.target.files ?? []).forEach(file => {
      setPhotos(prev => [...prev, { file, preview: URL.createObjectURL(file), type: "before" }]);
    });
  }

  async function handleSave() {
    if (!soap.subjective && !soap.objective && !soap.assessment && !soap.plan) {
      toast.error("Fill in at least one SOAP section."); return;
    }
    setSaving(true);
    const uploadedPhotos: { url: string; type: string }[] = [];
    for (const p of photos) {
      const ext = p.file.name.split(".").pop();
      const path = `${clinicId}/${patient.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data: up, error } = await supabase.storage.from("patient-photos").upload(path, p.file, { contentType: p.file.type, upsert: false });
      if (!error && up) {
        const { data: { publicUrl } } = supabase.storage.from("patient-photos").getPublicUrl(up.path);
        uploadedPhotos.push({ url: publicUrl, type: p.type });
      }
    }
    const res = await fetch(`/api/patients/${patient.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_encounter", ...soap, photos: uploadedPhotos, cpt_codes: attachedCodes.map(c => c.code) }),
    });
    const json = await res.json();
    // B10: Save injectables to encounter_injectables table
    if (json.success && json.encounterId && injectables.length > 0) {
      const rows = injectables
        .filter(inj => inj.productName.trim())
        .map(inj => ({
          encounter_id:   json.encounterId,
          clinic_id:      clinicId,
          product_name:   inj.productName.trim(),
          lot_number:     inj.lotNumber.trim() || null,
          expiry_date:    inj.expiryDate || null,
          units_used:     parseFloat(inj.unitsUsed) || null,
          injection_site: inj.injectionSite.trim() || null,
        }));
      if (rows.length > 0) {
        await supabase.from("encounter_injectables").insert(rows);
      }
    }
    setSaving(false);
    if (json.success) { toast.success("Session saved."); onClose(); }
    else toast.error(json.error ?? "Failed to save.");
  }

  const currentTab = SOAP_TABS.find(t => t.key === activeTab)!;
  const hasContent = Object.values(soap).some(v => v.trim());

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(28,25,23,0.5)", backdropFilter: "blur(2px)" }} />
      <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, zIndex: 50, width: 640, display: "flex", flexDirection: "column", background: "#F9F7F2", boxShadow: "-8px 0 40px rgba(28,25,23,0.18)", animation: "emrSlideIn 0.3s ease" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", background: "white", borderBottom: "1px solid rgba(197,160,89,0.18)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Clipboard size={16} color="#6366F1" />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: 0 }}>New Clinical Session</p>
                <p style={{ fontSize: 12, color: "#9C9584", margin: 0 }}>{patient.full_name} · {fmtDate(new Date().toISOString())}</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
              <button
                onClick={() => { setShowTemplates(v => !v); loadTemplates(); }}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.06)", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#7A5C14" }}
              >
                <BookOpen size={13} color="#C5A059" /> Load Template
              </button>
              {showTemplates && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "white", borderRadius: 12, border: "1px solid rgba(197,160,89,0.2)", boxShadow: "0 10px 36px rgba(28,25,23,0.14)", zIndex: 300, minWidth: 220, maxHeight: 280, overflowY: "auto" }}>
                  {templates.length === 0 ? (
                    <p style={{ padding: "14px 16px", fontSize: 12, color: "#9C9584", margin: 0 }}>No SOAP templates found</p>
                  ) : templates.map(t => (
                    <button key={t.id} onClick={() => applyTemplate(t)}
                      style={{ width: "100%", textAlign: "left", padding: "10px 16px", border: "none", borderBottom: "1px solid rgba(197,160,89,0.07)", background: "transparent", cursor: "pointer", fontSize: 13, color: "#1C1917", fontFamily: "Georgia, serif" }}>
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(197,160,89,0.2)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={15} color="#9C9584" />
              </button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 16 }}>
            {SOAP_TABS.map(tab => {
              const isActive = activeTab === tab.key;
              const filled = !!soap[tab.key].trim();
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  style={{ flex: 1, padding: "8px 4px", borderRadius: 10, border: "none", background: isActive ? "rgba(99,102,241,0.1)" : "rgba(249,247,242,0.8)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, outline: isActive ? "2px solid rgba(99,102,241,0.4)" : "2px solid transparent" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: isActive ? "#4338CA" : "#9C9584", fontFamily: "Georgia, serif" }}>{tab.label}</span>
                    {filled && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#4A8A4A" }} />}
                  </div>
                  <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em", color: isActive ? "#6366F1" : "#B8AE9C" }}>{tab.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          <p style={{ fontSize: 11, color: "#B8AE9C", fontStyle: "italic", marginBottom: 12, lineHeight: 1.5 }}>{currentTab.desc}</p>
          <textarea
            key={activeTab}
            value={soap[activeTab]}
            onChange={e => setSoap(s => ({ ...s, [activeTab]: e.target.value }))}
            placeholder={`Enter ${currentTab.title.toLowerCase()} notes…`}
            style={{ width: "100%", minHeight: 220, padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(197,160,89,0.25)", background: "white", fontSize: 13, fontFamily: "Georgia, serif", color: "#1C1917", lineHeight: 1.75, resize: "vertical", outline: "none", boxSizing: "border-box" }}
          />

          {activeTab === "plan" && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B6358", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                <Stethoscope size={11} color="#C5A059" /> Procedure Code Search (CPT)
              </p>
              <div style={{ position: "relative" }}>
                <input value={cptQuery} onChange={e => onCptInput(e.target.value)} placeholder="e.g. Botox, laser, filler, 64612…"
                  style={{ width: "100%", padding: "9px 14px", borderRadius: 10, boxSizing: "border-box", border: "1px solid rgba(197,160,89,0.3)", background: "white", fontSize: 13, fontFamily: "Georgia, serif", color: "#1C1917", outline: "none" }} />
                {cptSearching && <Loader2 size={13} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#C5A059", animation: "emrSpin 1s linear infinite" }} />}
                {cptResults.length > 0 && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "white", borderRadius: 12, border: "1px solid rgba(197,160,89,0.25)", boxShadow: "0 10px 36px rgba(28,25,23,0.14)", zIndex: 200, maxHeight: 240, overflowY: "auto" }}>
                    {cptResults.map(code => (
                      <button key={code.code} onMouseDown={() => attachCode(code)}
                        style={{ width: "100%", padding: "9px 14px", textAlign: "left", border: "none", background: "transparent", cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start", borderBottom: "1px solid rgba(197,160,89,0.07)" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#C5A059", minWidth: 52, flexShrink: 0, fontFamily: "monospace" }}>{code.code}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, color: "#1C1917", margin: 0, fontFamily: "Georgia, serif" }}>{code.description}</p>
                          {code.category && <p style={{ fontSize: 10, color: "#9C9584", margin: "1px 0 0", textTransform: "uppercase" }}>{code.category}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {attachedCodes.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {attachedCodes.map(code => (
                    <span key={code.code} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, padding: "3px 8px", borderRadius: 7, background: "rgba(197,160,89,0.1)", border: "1px solid rgba(197,160,89,0.3)", color: "#7A5C14", fontFamily: "Georgia, serif" }}>
                      <span style={{ fontWeight: 700, fontFamily: "monospace" }}>CPT {code.code}</span>
                      <span style={{ color: "#9C9584" }}>·</span>
                      <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{code.description}</span>
                      <button onClick={() => setAttachedCodes(prev => prev.filter(c => c.code !== code.code))} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#9C9584", padding: "0 2px", fontSize: 13 }}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Photo Upload */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#6B6358", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Before & After Photos</p>
              <button onClick={() => fileRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.06)", cursor: "pointer", fontSize: 12, color: "#8B6914" }}>
                <Upload size={12} /> Upload
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handlePhotoSelect} />
            </div>
            {photos.length === 0 ? (
              <div onClick={() => fileRef.current?.click()} style={{ border: "1.5px dashed rgba(197,160,89,0.3)", borderRadius: 12, padding: 24, textAlign: "center", cursor: "pointer", background: "rgba(249,247,242,0.6)" }}>
                <Camera size={24} color="rgba(197,160,89,0.5)" style={{ margin: "0 auto 8px", display: "block" }} />
                <p style={{ fontSize: 12, color: "#9C9584" }}>Click to attach before/after photos</p>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {photos.map((p, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.preview} alt="" style={{ width: 88, height: 88, objectFit: "cover", borderRadius: 10, border: "1px solid rgba(197,160,89,0.25)" }} />
                    <div style={{ display: "flex", gap: 2, marginTop: 4 }}>
                      {(["before", "after"] as const).map(t => (
                        <button key={t} onClick={() => setPhotos(prev => prev.map((ph, j) => j === i ? { ...ph, type: t } : ph))}
                          style={{ flex: 1, fontSize: 9, padding: "2px 0", borderRadius: 4, border: "none", cursor: "pointer", background: p.type === t ? (t === "before" ? "#1C1917" : "#4A8A4A") : "rgba(197,160,89,0.1)", color: p.type === t ? "white" : "#9C9584", fontWeight: 600, textTransform: "uppercase" }}>{t}</button>
                      ))}
                    </div>
                    <button onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))} style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#B43C3C", border: "2px solid white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <X size={9} color="white" />
                    </button>
                  </div>
                ))}
                <button onClick={() => fileRef.current?.click()} style={{ width: 88, height: 88, borderRadius: 10, border: "1.5px dashed rgba(197,160,89,0.3)", background: "rgba(249,247,242,0.6)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <Plus size={16} color="rgba(197,160,89,0.5)" />
                  <span style={{ fontSize: 10, color: "#B8AE9C" }}>Add</span>
                </button>
              </div>
            )}
          </div>

          {/* B10: Injectable Lot Tracking */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#6B6358", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0, display: "flex", alignItems: "center", gap: 5 }}>
                <Syringe size={12} color="#C5A059" /> Injectables Used (Lot Tracking)
              </p>
              <button
                onClick={() => setInjectables(prev => [...prev, { uid: crypto.randomUUID(), productName: "", lotNumber: "", expiryDate: "", unitsUsed: "", injectionSite: "" }])}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.06)", cursor: "pointer", fontSize: 11, color: "#8B6914" }}
              >
                <Plus size={11} /> Add Injectable
              </button>
            </div>
            {injectables.length === 0 ? (
              <div style={{ border: "1.5px dashed rgba(197,160,89,0.25)", borderRadius: 10, padding: "12px 16px", textAlign: "center" }}>
                <p style={{ fontSize: 11, color: "#B8AE9C", margin: 0 }}>No injectables recorded — add if any were used</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {injectables.map((inj, idx) => (
                  <div key={inj.uid} style={{ padding: "12px 14px", borderRadius: 10, background: "white", border: "1px solid rgba(197,160,89,0.2)", position: "relative" }}>
                    <button onClick={() => setInjectables(prev => prev.filter(x => x.uid !== inj.uid))} style={{ position: "absolute", top: 8, right: 8, background: "transparent", border: "none", cursor: "pointer", color: "#9C9584" }}>
                      <X size={13} />
                    </button>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#9C9584", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>Injectable #{idx + 1}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 10, color: "#9C9584", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 4 }}>Product Name *</label>
                        <input value={inj.productName} onChange={e => setInjectables(prev => prev.map(x => x.uid === inj.uid ? { ...x, productName: e.target.value } : x))}
                          placeholder="e.g. Botox, Juvederm"
                          style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: "1px solid rgba(197,160,89,0.25)", background: "#FDFCF9", fontSize: 12, fontFamily: "Georgia, serif", color: "#1C1917", outline: "none", boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: "#9C9584", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 4 }}>Lot Number</label>
                        <input value={inj.lotNumber} onChange={e => setInjectables(prev => prev.map(x => x.uid === inj.uid ? { ...x, lotNumber: e.target.value } : x))}
                          placeholder="e.g. LOT-2024-001"
                          style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: "1px solid rgba(197,160,89,0.25)", background: "#FDFCF9", fontSize: 12, fontFamily: "Georgia, serif", color: "#1C1917", outline: "none", boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: "#9C9584", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 4 }}>Expiry Date</label>
                        <input type="date" value={inj.expiryDate} onChange={e => setInjectables(prev => prev.map(x => x.uid === inj.uid ? { ...x, expiryDate: e.target.value } : x))}
                          style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: "1px solid rgba(197,160,89,0.25)", background: "#FDFCF9", fontSize: 12, color: "#1C1917", outline: "none", boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: "#9C9584", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 4 }}>Units Used</label>
                        <input type="number" value={inj.unitsUsed} onChange={e => setInjectables(prev => prev.map(x => x.uid === inj.uid ? { ...x, unitsUsed: e.target.value } : x))}
                          placeholder="e.g. 20"
                          style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: "1px solid rgba(197,160,89,0.25)", background: "#FDFCF9", fontSize: 12, color: "#1C1917", outline: "none", boxSizing: "border-box" }} />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ fontSize: 10, color: "#9C9584", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 4 }}>Injection Site</label>
                        <input value={inj.injectionSite} onChange={e => setInjectables(prev => prev.map(x => x.uid === inj.uid ? { ...x, injectionSite: e.target.value } : x))}
                          placeholder="e.g. Forehead, Glabella, Crow's feet"
                          style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: "1px solid rgba(197,160,89,0.25)", background: "#FDFCF9", fontSize: 12, fontFamily: "Georgia, serif", color: "#1C1917", outline: "none", boxSizing: "border-box" }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(197,160,89,0.18)", background: "white", display: "flex", gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid rgba(197,160,89,0.2)", background: "transparent", cursor: "pointer", fontSize: 13, color: "#9C9584" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !hasContent}
            style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "none", background: saving || !hasContent ? "rgba(197,160,89,0.3)" : "linear-gradient(135deg,#C5A059,#A8853A)", cursor: saving || !hasContent ? "not-allowed" : "pointer", color: "white", fontSize: 14, fontWeight: 600, fontFamily: "Georgia, serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {saving ? <><Loader2 size={15} style={{ animation: "emrSpin 1s linear infinite" }} /> Saving…</> : <><CheckCircle2 size={15} /> Save Session</>}
          </button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────── Note Drawer ─────────────────────────────────────────

function NoteDrawer({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const [content, setContent] = useState("");
  const [saving,  setSaving]  = useState(false);

  async function handleSave() {
    if (!content.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/patients/${patientId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_note", note_type: "note", content }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.success) { toast.success("Note added."); onClose(); }
    else toast.error(json.error ?? "Failed.");
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(28,25,23,0.45)", backdropFilter: "blur(2px)" }} />
      <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, zIndex: 50, width: 440, display: "flex", flexDirection: "column", background: "#F9F7F2", boxShadow: "-8px 0 40px rgba(28,25,23,0.18)", animation: "emrSlideIn 0.25s ease" }}>
        <div style={{ padding: "20px 22px", background: "white", borderBottom: "1px solid rgba(197,160,89,0.18)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(107,114,128,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FileText size={15} color="#6B7280" />
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: 0 }}>Quick Note</p>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(197,160,89,0.2)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} color="#9C9584" />
          </button>
        </div>
        <div style={{ flex: 1, padding: "20px 22px" }}>
          <textarea autoFocus value={content} onChange={e => setContent(e.target.value)} placeholder="Add a clinical note, observation, or reminder…"
            style={{ width: "100%", height: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(197,160,89,0.25)", background: "white", fontSize: 13, fontFamily: "Georgia, serif", color: "#1C1917", lineHeight: 1.75, resize: "none", outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ padding: "14px 22px", borderTop: "1px solid rgba(197,160,89,0.18)", background: "white", display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid rgba(197,160,89,0.2)", background: "transparent", cursor: "pointer", fontSize: 13, color: "#9C9584" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !content.trim()}
            style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: saving || !content.trim() ? "rgba(197,160,89,0.3)" : "linear-gradient(135deg,#C5A059,#A8853A)", cursor: saving || !content.trim() ? "not-allowed" : "pointer", color: "white", fontSize: 13, fontWeight: 600 }}>
            {saving ? "Saving…" : "Add Note"}
          </button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────── Treatment / Counselling Drawer ──────────────────────

const INPUT_ST: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 8,
  border: "1px solid rgba(197,160,89,0.25)", background: "white",
  fontSize: 12, fontFamily: "Georgia, serif", color: "#1C1917",
  outline: "none", boxSizing: "border-box",
};

function TreatmentDrawer({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const { profile, activeClinicId: clinicId } = useClinic();
  const [services, setServices] = useState<Service[]>([]);
  const [staff,    setStaff]    = useState<Staff[]>([]);
  const [counsellorId,   setCounsellorId]   = useState(profile?.id ?? "");
  const [sessionDate,    setSessionDate]    = useState(new Date().toISOString().split("T")[0]);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [pkgType,        setPkgType]        = useState<"single_service" | "custom_package">("single_service");
  const [notes,          setNotes]          = useState("");
  const [followupDate,   setFollowupDate]   = useState("");
  const [treatments, setTreatments] = useState<CounsTreatmentRow[]>([
    { service_id: "", service_name: "", mrp: 0, quoted_price: "", discount_pct: "0", sessions: "1", recommended: false },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clinicId) return;
    Promise.all([
      supabase.from("services").select("id, name, selling_price, mrp").eq("clinic_id", clinicId).eq("is_active", true).order("name"),
      supabase.from("profiles").select("id, full_name, role").eq("clinic_id", clinicId).eq("is_active", true),
    ]).then(([sRes, stRes]) => { setServices(sRes.data ?? []); setStaff(stRes.data ?? []); });
  }, [clinicId]);

  const selectService = (idx: number, serviceId: string) => {
    const svc = services.find(s => s.id === serviceId);
    if (!svc) return;
    const effectiveMrp = svc.mrp || svc.selling_price;
    const disc = effectiveMrp > 0 ? ((effectiveMrp - svc.selling_price) / effectiveMrp * 100).toFixed(1) : "0";
    const newT = [...treatments];
    newT[idx] = { ...newT[idx], service_id: svc.id, service_name: svc.name, mrp: effectiveMrp, quoted_price: String(svc.selling_price), discount_pct: disc };
    setTreatments(newT);
  };

  const updateRow = (idx: number, field: keyof CounsTreatmentRow, raw: string | boolean | number) => {
    const newT = [...treatments];
    const mrp  = newT[idx].mrp;
    if (field === "quoted_price") {
      const q = parseFloat(raw as string) || 0;
      newT[idx] = { ...newT[idx], quoted_price: raw as string, discount_pct: mrp > 0 ? ((mrp - q) / mrp * 100).toFixed(1) : "0" };
    } else if (field === "discount_pct") {
      const d = parseFloat(raw as string) || 0;
      newT[idx] = { ...newT[idx], discount_pct: raw as string, quoted_price: mrp > 0 ? (mrp * (1 - d / 100)).toFixed(0) : "0" };
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (newT[idx] as any)[field] = raw;
    }
    setTreatments(newT);
  };

  const totalQuoted = treatments.reduce((s, t) => s + (parseFloat(t.quoted_price) || 0), 0);

  async function handleSave() {
    if (!treatments.some(t => t.service_name.trim())) { toast.error("Add at least one treatment."); return; }
    if (!clinicId) { toast.error("Clinic not found."); return; }
    setSaving(true);
    const counsellorName = staff.find(s => s.id === counsellorId)?.full_name || profile?.full_name || null;
    const validRows = treatments.filter(t => t.service_name.trim());
    const treatmentData = validRows.map(t => ({
      service_id: t.service_id || undefined,
      service_name: t.service_name.trim(),
      mrp: t.mrp || 0, price: parseFloat(t.quoted_price) || 0,
      quoted_price: parseFloat(t.quoted_price) || 0,
      discount_pct: parseFloat(t.discount_pct) || 0,
      recommended: t.recommended, sessions: parseInt(t.sessions) || 1,
    }));
    const { data: session, error } = await supabase.from("counselling_sessions").insert({
      clinic_id: clinicId, patient_id: patient.id,
      counsellor_id: counsellorId || null, session_date: sessionDate,
      chief_complaint: chiefComplaint.trim() || null,
      treatments_discussed: treatmentData,
      total_proposed: treatmentData.reduce((s, t) => s + t.quoted_price, 0),
      total_accepted: treatmentData.filter(t => t.recommended).reduce((s, t) => s + t.quoted_price, 0),
      conversion_status: "pending", package_type: pkgType,
      followup_date: followupDate || null, notes: notes.trim() || null,
    }).select("id").single();
    if (!error && session) {
      await supabase.from("patient_treatments").insert(treatmentData.map(t => ({
        patient_id: patient.id, clinic_id: clinicId,
        treatment_name: t.service_name, status: "proposed",
        price: t.quoted_price || null, quoted_price: t.quoted_price || null,
        mrp: t.mrp || null, discount_pct: t.discount_pct || null,
        package_type: pkgType, counselled_by: counsellorName,
        counselling_session_id: session.id, notes: notes.trim() || null,
        recommended_sessions: t.sessions || null,
      })));
      toast.success(`Session saved — ${treatmentData.length} treatment${treatmentData.length > 1 ? "s" : ""} added.`);
      onClose();
    } else {
      toast.error(error?.message ?? "Failed.");
    }
    setSaving(false);
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(28,25,23,0.45)", backdropFilter: "blur(2px)" }} />
      <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, zIndex: 50, width: 640, display: "flex", flexDirection: "column", background: "#F9F7F2", boxShadow: "-8px 0 40px rgba(28,25,23,0.18)", animation: "emrSlideIn 0.25s ease" }}>
        <div style={{ padding: "18px 22px", background: "white", borderBottom: "1px solid rgba(197,160,89,0.18)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(197,160,89,0.1)", border: "1px solid rgba(197,160,89,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <DollarSign size={16} color="var(--gold)" />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: 0 }}>Counselling Session</p>
              <p style={{ fontSize: 11, color: "#9C9584", margin: 0 }}>{patient.full_name}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(197,160,89,0.2)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} color="#9C9584" />
          </button>
        </div>

        <div style={{ flex: 1, padding: "18px 22px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B6358", display: "block", marginBottom: 5 }}>Provider / Counsellor</label>
              <select value={counsellorId} onChange={e => setCounsellorId(e.target.value)} style={{ ...INPUT_ST }}>
                {profile?.id && profile?.full_name && !staff.find(s => s.id === profile.id) && (
                  <option value={profile.id}>{profile.full_name} (you)</option>
                )}
                {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}{s.id === profile?.id ? " ✓" : ""} — {s.role}</option>)}
                <option value="">— Unassigned —</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B6358", display: "block", marginBottom: 5 }}>Session Date</label>
              <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} style={{ ...INPUT_ST }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B6358", display: "block", marginBottom: 5 }}>Chief Complaint</label>
            <input value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)} placeholder="Primary concern discussed…" style={{ ...INPUT_ST }} />
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B6358", display: "block", marginBottom: 8 }}>Package Type</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[{ key: "single_service" as const, label: "Single Service" }, { key: "custom_package" as const, label: "Custom Package" }].map(o => (
                <button key={o.key} onClick={() => setPkgType(o.key)}
                  style={{ flex: 1, padding: "8px", borderRadius: 8, border: pkgType === o.key ? "1.5px solid rgba(197,160,89,0.5)" : "1px solid rgba(197,160,89,0.2)", background: pkgType === o.key ? "rgba(197,160,89,0.1)" : "white", cursor: "pointer", fontSize: 12, fontWeight: pkgType === o.key ? 700 : 400, color: pkgType === o.key ? "#8B6914" : "#6B7280" }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Treatment rows */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B6358" }}>Treatments Discussed</label>
              <button onClick={() => setTreatments(prev => [...prev, { service_id: "", service_name: "", mrp: 0, quoted_price: "", discount_pct: "0", sessions: "1", recommended: false }])}
                style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.06)", cursor: "pointer", color: "#8B6914" }}>
                <Plus size={10} /> Add Row
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {treatments.map((t, idx) => (
                <div key={idx} style={{ padding: "10px 12px", borderRadius: 10, background: "white", border: "1px solid rgba(197,160,89,0.15)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 60px 36px", gap: 6, alignItems: "center" }}>
                    <select value={t.service_id} onChange={e => selectService(idx, e.target.value)} style={{ ...INPUT_ST, fontSize: 11 }}>
                      <option value="">Select service…</option>
                      {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <input value={t.quoted_price} onChange={e => updateRow(idx, "quoted_price", e.target.value)} placeholder="Quoted ₹" style={{ ...INPUT_ST, fontSize: 11 }} />
                    <input value={t.sessions} onChange={e => updateRow(idx, "sessions", e.target.value)} placeholder="Sessions" type="number" min="1" style={{ ...INPUT_ST, fontSize: 11 }} />
                    <input value={t.discount_pct} onChange={e => updateRow(idx, "discount_pct", e.target.value)} placeholder="Disc%" style={{ ...INPUT_ST, fontSize: 11 }} />
                    <button onClick={() => setTreatments(prev => prev.filter((_, i) => i !== idx))} style={{ width: 32, height: 32, borderRadius: 7, border: "1px solid rgba(220,38,38,0.2)", background: "rgba(220,38,38,0.06)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <X size={12} color="#DC2626" />
                    </button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                    <input type="checkbox" checked={t.recommended} onChange={e => updateRow(idx, "recommended", e.target.checked)} id={`rec-${idx}`} />
                    <label htmlFor={`rec-${idx}`} style={{ fontSize: 11, color: "#6B7280", cursor: "pointer" }}>Patient accepted</label>
                  </div>
                </div>
              ))}
            </div>
            {totalQuoted > 0 && (
              <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(197,160,89,0.08)", border: "1px solid rgba(197,160,89,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#6B7280" }}>Total Quoted</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#C5A059", fontFamily: "Georgia, serif" }}>{fmtINR(totalQuoted)}</span>
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B6358", display: "block", marginBottom: 5 }}>Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Session notes…" style={{ ...INPUT_ST, resize: "none" }} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B6358", display: "block", marginBottom: 5 }}>Follow-up Date</label>
              <input type="date" value={followupDate} onChange={e => setFollowupDate(e.target.value)} style={{ ...INPUT_ST }} />
            </div>
          </div>
        </div>

        <div style={{ padding: "14px 22px", borderTop: "1px solid rgba(197,160,89,0.18)", background: "white", display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid rgba(197,160,89,0.2)", background: "transparent", cursor: "pointer", fontSize: 13, color: "#9C9584" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: saving ? "rgba(197,160,89,0.3)" : "linear-gradient(135deg,#C5A059,#A8853A)", cursor: saving ? "not-allowed" : "pointer", color: "white", fontSize: 13, fontWeight: 600 }}>
            {saving ? "Saving…" : "Save Session"}
          </button>
        </div>
      </div>
    </>
  );
}
