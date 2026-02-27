"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  ArrowLeft, AlertTriangle, Phone, Mail, Pill, Calendar,
  FileText, DollarSign, Package, Plus, X, Clock, Sparkles,
  Clipboard, Camera, Stethoscope, Syringe, Star, ChevronDown,
  ChevronUp, Upload, Image, Loader2, User, ShieldCheck,
  CheckCircle2, TrendingUp, Activity, Zap, MapPin, ArrowUpCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { logAction } from "@/lib/audit";
import { toast } from "sonner";

// ─────────────────────────────────────── Types ───────────────────────────────

interface Patient {
  id: string; full_name: string; email: string | null; phone: string;
  preferred_provider: string | null; primary_concern: string[] | null;
  previous_injections: string | null; notes: string | null;
  clinic_id: string | null; created_at: string;
  date_of_birth: string | null; fitzpatrick_type: number | null;
  allergies: string[] | null;
}
interface MedicalHistory {
  id: string; primary_concerns: string[]; preferred_specialist: string | null;
  had_prior_injections: boolean | null; last_injection_date: string | null;
  injection_complications: string | null; patient_notes: string | null;
  recorded_at: string;
}
interface PatientNote {
  id: string; note_type: string; content: string;
  author_name: string | null; created_at: string;
}
interface Encounter {
  id: string; subjective: string | null; objective: string | null;
  assessment: string | null; plan: string | null;
  photos: { url: string; type: string; caption?: string }[];
  created_by_name: string | null; created_at: string;
}
interface Treatment {
  id: string; treatment_name: string; status: string;
  price: number | null; counselled_by: string | null;
  notes: string | null; created_at: string;
}
interface PatientPackage {
  id: string; package_name: string; total_sessions: number;
  used_sessions: number; price_per_session: number | null; created_at: string;
}
interface ServiceCredit {
  id: string; service_name: string; total_sessions: number; used_sessions: number;
  purchase_price: number; per_session_value: number;
  status: string; family_shared: boolean;
  purchase_clinic_id: string; current_clinic_id: string;
  purchase_clinic_name: string; current_clinic_name: string;
}
interface MedicalCode {
  code: string; description: string; category: string | null;
}
interface EMRData {
  patient: Patient; medicalHistory: MedicalHistory | null;
  notes: PatientNote[]; encounters: Encounter[];
  treatments: Treatment[]; packages: PatientPackage[];
}

// ─────────────────────────────────────── Constants ───────────────────────────

const FITZPATRICK = [
  null,
  { label: "I",   desc: "Very fair",  bg: "#FFF5EC", text: "#8B6914", border: "#E8C87A" },
  { label: "II",  desc: "Fair",       bg: "#FFE4C4", text: "#7A5518", border: "#D4A870" },
  { label: "III", desc: "Medium",     bg: "#C8956A", text: "#3D1C02", border: "#A87048" },
  { label: "IV",  desc: "Olive",      bg: "#9E6840", text: "#FFF0E0", border: "#7A4E28" },
  { label: "V",   desc: "Brown",      bg: "#6B3E20", text: "#FAECD8", border: "#4A2810" },
  { label: "VI",  desc: "Dark",       bg: "#2D1505", text: "#E8D4C0", border: "#1A0800" },
];

const SOAP_TABS = [
  { key: "subjective",  label: "S",  title: "Subjective",  desc: "Patient's chief complaint, history of present illness, and review of symptoms in their own words." },
  { key: "objective",   label: "O",  title: "Objective",   desc: "Provider's clinical observations, measurements, and physical examination findings." },
  { key: "assessment",  label: "A",  title: "Assessment",  desc: "Clinical diagnosis, differential diagnoses, and overall evaluation of the patient's condition." },
  { key: "plan",        label: "P",  title: "Plan",        desc: "Prescribed treatments, procedures performed, medications, follow-up instructions, and next steps." },
] as const;
type SOAPKey = typeof SOAP_TABS[number]["key"];

// ─────────────────────────────────────── Helpers ─────────────────────────────

function calcAge(dob: string | null): string {
  if (!dob) return "—";
  const d = new Date(dob); const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() - d.getMonth() < 0 || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return `${age} yrs`;
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function relDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 30)  return `${d} days ago`;
  return fmtDate(iso);
}

// ─────────────────────────────────────── Main Page ───────────────────────────

export default function PatientEMRPage() {
  const { id } = useParams() as { id: string };
  const router  = useRouter();

  const [data,       setData]       = useState<EMRData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [notFound,   setNotFound]   = useState(false);
  const [mounted,    setMounted]    = useState(false);
  const [fabOpen,    setFabOpen]    = useState(false);
  const [drawer,     setDrawer]     = useState<"soap" | "note" | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/patients/${id}`);
    if (!res.ok) { setNotFound(true); setLoading(false); return; }
    const json = await res.json();
    setData(json);
    setLoading(false);
    // HIPAA Audit: record every profile view in audit_logs (non-blocking)
    logAction({
      action:     "view_patient_profile",
      targetId:   id,
      targetName: json.patient?.full_name ?? id,
      metadata:   { page: "emr" },
    });
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <EMRSkeleton />;
  if (notFound || !data) return <NotFound onBack={() => router.push("/patients")} />;

  const { patient, medicalHistory, notes, encounters, treatments, packages } = data;

  const closeDrawer = () => { setDrawer(null); fetchData(); };

  return (
    <>
      <style>{`
        @keyframes pulseRing {
          0%   { transform: scale(1); opacity: 0.8; }
          50%  { transform: scale(1.4); opacity: 0.2; }
          100% { transform: scale(1); opacity: 0.8; }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .emr-col::-webkit-scrollbar { width: 4px; }
        .emr-col::-webkit-scrollbar-track { background: transparent; }
        .emr-col::-webkit-scrollbar-thumb { background: rgba(197,160,89,0.3); border-radius: 2px; }
        .soap-tab { transition: all 0.18s; cursor: pointer; }
        .soap-tab:hover { opacity: 0.85; }
        .fab-action { transition: all 0.22s cubic-bezier(0.34,1.56,0.64,1); }
      `}</style>

      {/* ── Full-height flex column ── */}
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F9F7F2" }}>

        {/* ── Pinned Header ── */}
        <PatientHeader patient={patient} onBack={() => router.push("/patients")} />

        {/* ── Three-column grid ── */}
        <div style={{
          flex: 1, minHeight: 0, display: "grid",
          gridTemplateColumns: "292px 1fr 308px", overflow: "hidden",
        }}>
          {/* Left */}
          <div className="emr-col" style={{ overflowY: "auto", borderRight: "1px solid rgba(197,160,89,0.13)", padding: "20px 16px 32px" }}>
            <MedicalColumn patient={patient} medicalHistory={medicalHistory} />
          </div>

          {/* Centre */}
          <div className="emr-col" style={{ overflowY: "auto", padding: "20px 20px 32px" }}>
            <TimelineColumn
              patient={patient}
              medicalHistory={medicalHistory}
              notes={notes}
              encounters={encounters}
            />
          </div>

          {/* Right */}
          <div className="emr-col" style={{ overflowY: "auto", borderLeft: "1px solid rgba(197,160,89,0.13)", padding: "20px 16px 32px" }}>
            <BusinessColumn treatments={treatments} packages={packages} patientId={id} />
          </div>
        </div>
      </div>

      {/* ── Floating Action Button ── */}
      {mounted && createPortal(
        <FAB
          open={fabOpen}
          onToggle={() => setFabOpen(o => !o)}
          onAction={(a) => { setFabOpen(false); setDrawer(a); }}
        />,
        document.body
      )}

      {/* ── SOAP Drawer ── */}
      {mounted && drawer === "soap" && createPortal(
        <SOAPDrawer patient={patient} onClose={closeDrawer} />,
        document.body
      )}

      {/* ── Quick Note Drawer ── */}
      {mounted && drawer === "note" && createPortal(
        <NoteDrawer patientId={id} onClose={closeDrawer} />,
        document.body
      )}
    </>
  );
}

// ─────────────────────────────────────── Patient Header ──────────────────────

function PatientHeader({ patient, onBack }: { patient: Patient; onBack: () => void }) {
  const fitz = patient.fitzpatrick_type ? FITZPATRICK[patient.fitzpatrick_type] : null;
  const allergies = patient.allergies?.filter(Boolean) ?? [];
  const hasAllergies = allergies.length > 0;

  return (
    <div style={{
      background: "white",
      borderBottom: "1px solid rgba(197,160,89,0.18)",
      padding: "0 24px",
      height: 72,
      display: "flex",
      alignItems: "center",
      gap: 20,
      flexShrink: 0,
      position: "sticky",
      top: 0,
      zIndex: 20,
      boxShadow: "0 1px 12px rgba(28,25,23,0.06)",
    }}>
      {/* Back */}
      <button onClick={onBack} style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid rgba(197,160,89,0.25)", background: "rgba(197,160,89,0.06)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
        <ArrowLeft size={15} style={{ color: "#9C9584" }} />
      </button>

      {/* Avatar */}
      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg, #C5A059, #A8853A)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 8px rgba(197,160,89,0.35)" }}>
        <span style={{ color: "white", fontWeight: 700, fontSize: 16, fontFamily: "Georgia, serif" }}>
          {patient.full_name.split(" ").map(n => n[0]).slice(0, 2).join("")}
        </span>
      </div>

      {/* Name + Meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, fontFamily: "Georgia, serif", color: "#1C1917", margin: 0, lineHeight: 1 }}>
            {patient.full_name}
          </h1>

          {/* Age */}
          <span style={{ fontSize: 12, color: "#9C9584", background: "rgba(249,247,242,0.9)", border: "1px solid rgba(197,160,89,0.2)", borderRadius: 8, padding: "2px 8px" }}>
            {calcAge(patient.date_of_birth)}
          </span>

          {/* Fitzpatrick */}
          {fitz && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 8,
              background: fitz.bg, color: fitz.text, border: `1px solid ${fitz.border}`,
              letterSpacing: "0.05em",
            }}>
              FST {fitz.label} · {fitz.desc}
            </span>
          )}

          {/* Allergy Badge */}
          {hasAllergies && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, position: "relative" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#E85555", display: "inline-block", position: "relative" }}>
                <span style={{
                  position: "absolute", inset: 0, borderRadius: "50%", background: "#E85555",
                  animation: "pulseRing 1.8s ease-in-out infinite",
                }} />
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#B43C3C", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                ALLERGIES
              </span>
              <span style={{ fontSize: 11, color: "#B43C3C" }}>
                — {allergies.slice(0, 2).join(", ")}{allergies.length > 2 ? ` +${allergies.length - 2}` : ""}
              </span>
            </div>
          )}
        </div>

        {/* Contacts */}
        <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#9C9584" }}>
            <Phone size={11} /> {patient.phone}
          </span>
          {patient.email && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#9C9584" }}>
              <Mail size={11} /> {patient.email}
            </span>
          )}
        </div>
      </div>

      {/* Status chip */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 10, background: "rgba(197,160,89,0.08)", border: "1px solid rgba(197,160,89,0.25)" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4A8A4A" }} />
          <span style={{ fontSize: 12, color: "#1C1917", fontWeight: 500 }}>Active Patient</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────── Left: Medical Column ────────────────

function MedicalColumn({ patient, medicalHistory }: { patient: Patient; medicalHistory: MedicalHistory | null }) {
  const allergies = patient.allergies?.filter(Boolean) ?? [];
  const concerns  = medicalHistory?.primary_concerns ?? patient.primary_concern ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionLabel icon={<Activity size={11} />} label="Medical Summary" />

      {/* Quick Stats */}
      <Card>
        <CardRow icon={<User size={12} />} label="Intake Date"    value={fmtDate(patient.created_at)} />
        {patient.date_of_birth && <CardRow icon={<Calendar size={12} />} label="Date of Birth" value={fmtDate(patient.date_of_birth)} />}
        {patient.preferred_provider && <CardRow icon={<Stethoscope size={12} />} label="Provider"    value={patient.preferred_provider} />}
      </Card>

      {/* Primary Concerns */}
      <Card title="Primary Concerns">
        {concerns.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {concerns.map((c) => (
              <span key={c} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.08)", color: "#5C5447", fontFamily: "Georgia, serif" }}>
                {c}
              </span>
            ))}
          </div>
        ) : (
          <EmptyMini label="No concerns recorded" />
        )}
      </Card>

      {/* Allergies */}
      <Card title="Medical Alerts">
        {allergies.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {allergies.map((a) => (
              <div key={a} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={11} style={{ color: "#B43C3C", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#B43C3C", fontFamily: "Georgia, serif" }}>{a}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ShieldCheck size={12} style={{ color: "#4A8A4A" }} />
            <span style={{ fontSize: 12, color: "#4A8A4A" }}>No known allergies</span>
          </div>
        )}
      </Card>

      {/* Injection History */}
      {(medicalHistory?.had_prior_injections != null || patient.previous_injections) && (
        <Card title="Injection History">
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Syringe size={12} style={{ color: medicalHistory?.had_prior_injections ? "#C5A059" : "#9C9584", flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "#5C5447", fontFamily: "Georgia, serif" }}>
              {medicalHistory?.had_prior_injections ? "Prior injections — Yes" : "No prior injections"}
            </span>
          </div>
          {medicalHistory?.last_injection_date && (
            <p style={{ fontSize: 11, color: "#9C9584", marginLeft: 18 }}>
              Last: {medicalHistory.last_injection_date}
            </p>
          )}
          {medicalHistory?.injection_complications && (
            <p style={{ fontSize: 11, color: "#B43C3C", marginLeft: 18, marginTop: 3 }}>
              ⚠ {medicalHistory.injection_complications}
            </p>
          )}
          {patient.previous_injections && !medicalHistory && (
            <p style={{ fontSize: 12, color: "#6B6358", fontFamily: "Georgia, serif" }}>{patient.previous_injections}</p>
          )}
        </Card>
      )}

      {/* Consent */}
      <Card title="Consent Status">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(74,138,74,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckCircle2 size={14} style={{ color: "#4A8A4A" }} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#1C1917" }}>Intake Form Complete</p>
            <p style={{ fontSize: 10, color: "#9C9584" }}>{fmtDate(patient.created_at)}</p>
          </div>
        </div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(197,160,89,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FileText size={14} style={{ color: "#C5A059" }} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, color: "#9C9584" }}>Treatment Consent</p>
            <p style={{ fontSize: 10, color: "#B8AE9C" }}>Pending — collect before first procedure</p>
          </div>
        </div>
      </Card>

      {/* Patient notes from intake */}
      {(medicalHistory?.patient_notes || patient.notes) && (
        <Card title="Patient Notes">
          <p style={{ fontSize: 12, color: "#5C5447", fontFamily: "Georgia, serif", lineHeight: 1.65 }}>
            {medicalHistory?.patient_notes ?? patient.notes}
          </p>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────── Centre: Timeline ────────────────────

function TimelineColumn({ patient, medicalHistory, notes, encounters }: {
  patient: Patient; medicalHistory: MedicalHistory | null;
  notes: PatientNote[]; encounters: Encounter[];
}) {
  // Merge all entries into a single timeline, newest first
  type TEntry = { id: string; kind: "intake" | "soap" | "note"; date: string; data: unknown };
  const entries: TEntry[] = [];

  // Synthesised intake entry (always first in history)
  entries.push({
    id: "intake",
    kind: "intake",
    date: patient.created_at,
    data: { patient, medicalHistory },
  });

  // SOAP encounters
  encounters.forEach(e => entries.push({ id: e.id, kind: "soap", date: e.created_at, data: e }));

  // Plain notes
  notes.forEach(n => entries.push({ id: n.id, kind: "note", date: n.created_at, data: n }));

  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div>
      <SectionLabel icon={<Clipboard size={11} />} label="Clinical Timeline" />

      {entries.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <Clipboard size={32} style={{ color: "rgba(197,160,89,0.3)", margin: "0 auto 12px" }} />
          <p style={{ fontSize: 14, color: "#9C9584", fontFamily: "Georgia, serif" }}>No clinical entries yet</p>
          <p style={{ fontSize: 12, color: "#B8AE9C", marginTop: 4 }}>Start a session to build the patient's timeline</p>
        </div>
      ) : (
        <div style={{ position: "relative", paddingLeft: 28 }}>
          {/* Vertical spine */}
          <div style={{ position: "absolute", left: 9, top: 8, bottom: 8, width: 1, background: "rgba(197,160,89,0.2)" }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {entries.map(e => (
              <TimelineEntry key={e.id} entry={e} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineEntry({ entry }: { entry: { id: string; kind: string; date: string; data: unknown } }) {
  const [expanded, setExpanded] = useState(true);

  const DOT_COLOR: Record<string, string> = {
    intake: "#C5A059",
    soap:   "#6366F1",
    note:   "#6B7280",
  };
  const BADGE_STYLE: Record<string, React.CSSProperties> = {
    intake: { background: "rgba(197,160,89,0.12)", color: "#8B6914", border: "1px solid rgba(197,160,89,0.3)" },
    soap:   { background: "rgba(99,102,241,0.1)",  color: "#4338CA", border: "1px solid rgba(99,102,241,0.25)" },
    note:   { background: "rgba(107,114,128,0.08)", color: "#4B5563", border: "1px solid rgba(107,114,128,0.2)" },
  };

  return (
    <div style={{ position: "relative", animation: "fadeIn 0.3s ease" }}>
      {/* Dot */}
      <div style={{
        position: "absolute", left: -22, top: 14,
        width: 10, height: 10, borderRadius: "50%",
        background: DOT_COLOR[entry.kind] ?? "#9C9584",
        border: "2px solid white",
        boxShadow: `0 0 0 2px ${DOT_COLOR[entry.kind] ?? "#9C9584"}40`,
      }} />

      {/* Card */}
      <div style={{
        background: "white",
        border: `1px solid rgba(197,160,89,0.14)`,
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 1px 4px rgba(28,25,23,0.05)",
      }}>
        {/* Header */}
        <div
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", cursor: "pointer", borderBottom: expanded ? "1px solid rgba(197,160,89,0.08)" : "none" }}
          onClick={() => setExpanded(e => !e)}
        >
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, letterSpacing: "0.06em", textTransform: "uppercase", ...BADGE_STYLE[entry.kind] }}>
            {entry.kind === "intake" ? "Intake" : entry.kind === "soap" ? "SOAP" : "Note"}
          </span>
          <span style={{ fontSize: 11, color: "#9C9584", flex: 1 }}>
            {relDate(entry.date)}{entry.kind === "soap" ? ` at ${fmtTime(entry.date)}` : ""}
          </span>
          {entry.kind === "soap" && (
            <span style={{ fontSize: 11, color: "#9C9584" }}>
              {(entry.data as Encounter).created_by_name ?? "Provider"}
            </span>
          )}
          {expanded ? <ChevronUp size={12} style={{ color: "#B8AE9C" }} /> : <ChevronDown size={12} style={{ color: "#B8AE9C" }} />}
        </div>

        {/* Body */}
        {expanded && (
          <div style={{ padding: "12px 14px" }}>
            {entry.kind === "intake" && <IntakeEntryBody data={entry.data as { patient: Patient; medicalHistory: MedicalHistory | null }} />}
            {entry.kind === "soap"   && <SOAPEntryBody   enc={entry.data as Encounter} />}
            {entry.kind === "note"   && <NoteEntryBody   note={entry.data as PatientNote} />}
          </div>
        )}
      </div>
    </div>
  );
}

function IntakeEntryBody({ data }: { data: { patient: Patient; medicalHistory: MedicalHistory | null } }) {
  const { patient, medicalHistory } = data;
  const concerns = medicalHistory?.primary_concerns ?? patient.primary_concern ?? [];
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {concerns.map(c => (
          <span key={c} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(197,160,89,0.1)", color: "#7A5C14", border: "1px solid rgba(197,160,89,0.25)" }}>
            {c}
          </span>
        ))}
      </div>
      {(medicalHistory?.patient_notes || patient.notes) && (
        <p style={{ fontSize: 12, color: "#6B6358", fontFamily: "Georgia, serif", lineHeight: 1.6, margin: 0 }}>
          {medicalHistory?.patient_notes ?? patient.notes}
        </p>
      )}
      <p style={{ fontSize: 10, color: "#B8AE9C", marginTop: 8 }}>
        Submitted via Digital Intake Form · {fmtDate(patient.created_at)}
      </p>
    </div>
  );
}

function SOAPEntryBody({ enc }: { enc: Encounter }) {
  const sections = [
    { label: "Subjective",  value: enc.subjective,  color: "#6366F1" },
    { label: "Objective",   value: enc.objective,   color: "#0891B2" },
    { label: "Assessment",  value: enc.assessment,  color: "#059669" },
    { label: "Plan",        value: enc.plan,        color: "#D97706" },
  ].filter(s => s.value);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {sections.map(s => (
        <div key={s.label} style={{ borderLeft: `2px solid ${s.color}30`, paddingLeft: 10 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: s.color, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>{s.label}</p>
          <p style={{ fontSize: 12, color: "#3D3530", fontFamily: "Georgia, serif", lineHeight: 1.65, whiteSpace: "pre-wrap", margin: 0 }}>{s.value}</p>
        </div>
      ))}
      {sections.length === 0 && <p style={{ fontSize: 12, color: "#9C9584", fontStyle: "italic" }}>No SOAP details recorded.</p>}

      {/* Photos */}
      {enc.photos?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: "#9C9584", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Before / After</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {enc.photos.map((ph, i) => (
              <div key={i} style={{ position: "relative" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ph.url} alt={ph.caption ?? `Photo ${i + 1}`} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid rgba(197,160,89,0.2)" }} />
                {ph.type && (
                  <span style={{ position: "absolute", bottom: 3, left: 3, fontSize: 8, fontWeight: 700, padding: "1px 4px", borderRadius: 4, background: ph.type === "before" ? "#1C1917CC" : "#4A8A4ACC", color: "white", textTransform: "uppercase" }}>
                    {ph.type}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NoteEntryBody({ note }: { note: PatientNote }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: "#3D3530", fontFamily: "Georgia, serif", lineHeight: 1.65, margin: 0, whiteSpace: "pre-wrap" }}>{note.content}</p>
      {note.author_name && (
        <p style={{ fontSize: 10, color: "#B8AE9C", marginTop: 8 }}>— {note.author_name}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────── Right: Business ─────────────────────

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function BusinessColumn({ treatments, packages, patientId }: { treatments: Treatment[]; packages: PatientPackage[]; patientId: string }) {
  const proposed   = treatments.filter(t => t.status === "proposed");
  const totalValue = proposed.reduce((s, t) => s + (t.price ?? 0), 0);
  const [credits, setCredits] = useState<ServiceCredit[]>([]);

  useEffect(() => {
    supabase
      .from("patient_service_credits")
      .select(`
        id, service_name, total_sessions, used_sessions, purchase_price, per_session_value,
        status, family_shared, purchase_clinic_id, current_clinic_id,
        purchase_clinic:clinics!purchase_clinic_id(name),
        current_clinic:clinics!current_clinic_id(name)
      `)
      .eq("patient_id", patientId)
      .in("status", ["active", "transferred"])
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setCredits((data ?? []).map((c: Record<string, unknown>) => ({
          ...c,
          purchase_clinic_name: (c.purchase_clinic as { name: string } | null)?.name ?? "—",
          current_clinic_name:  (c.current_clinic  as { name: string } | null)?.name ?? "—",
        })) as ServiceCredit[]);
      });
  }, [patientId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionLabel icon={<TrendingUp size={11} />} label="Business & Plans" />

      {/* Service Credits (new table) */}
      <Card title="Service Credits">
        {credits.length === 0 ? (
          <EmptyMini label="No active credits" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {credits.map(c => {
              const remaining = c.total_sessions - c.used_sessions;
              const pct = (c.used_sessions / c.total_sessions) * 100;
              const isCross = c.purchase_clinic_id !== c.current_clinic_id;
              return (
                <div key={c.id} style={{ padding: "10px 12px", borderRadius: 12, border: isCross ? "1px solid rgba(197,160,89,0.4)" : "1px solid rgba(197,160,89,0.15)", background: isCross ? "rgba(197,160,89,0.04)" : "transparent" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: 0 }}>{c.service_name}</p>
                        {isCross && (
                          <span title={`Purchased at ${c.purchase_clinic_name}`} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 999, background: "rgba(197,160,89,0.15)", color: "#A8853A", border: "1px solid rgba(197,160,89,0.3)" }}>
                            <MapPin size={8} /> {c.purchase_clinic_name}
                          </span>
                        )}
                        {c.family_shared && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 999, background: "rgba(107,99,133,0.1)", color: "#6B6385" }}>Shared</span>
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: "#9C9584", margin: 0 }}>
                        {remaining} of {c.total_sessions} sessions · {fmtINR(c.per_session_value)}/session
                      </p>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: remaining > 0 ? "rgba(197,160,89,0.12)" : "rgba(107,114,128,0.08)", color: remaining > 0 ? "#8B6914" : "#6B7280", border: `1px solid ${remaining > 0 ? "rgba(197,160,89,0.3)" : "rgba(107,114,128,0.2)"}`, marginLeft: 8, flexShrink: 0 }}>
                      {remaining > 0 ? `${remaining} left` : "Done"}
                    </span>
                  </div>
                  <div style={{ height: 5, borderRadius: 999, background: "rgba(197,160,89,0.1)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 999, background: c.status === "transferred" ? "linear-gradient(90deg, #C5A059, #E8CC8A)" : "linear-gradient(90deg, #C5A059, #A8853A)", width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                    <span style={{ fontSize: 10, color: "#B8AE9C" }}>{c.used_sessions} used</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#C5A059" }}>{fmtINR(c.purchase_price)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Legacy Packages (patient_packages table) */}
      {packages.length > 0 && (
        <Card title="Legacy Packages">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {packages.map(pkg => {
              const remaining = pkg.total_sessions - pkg.used_sessions;
              const pct = (pkg.used_sessions / pkg.total_sessions) * 100;
              return (
                <div key={pkg.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: 0 }}>{pkg.package_name}</p>
                      <p style={{ fontSize: 11, color: "#9C9584", margin: 0 }}>{remaining} of {pkg.total_sessions} sessions remaining</p>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: remaining > 0 ? "rgba(197,160,89,0.12)" : "rgba(107,114,128,0.08)", color: remaining > 0 ? "#8B6914" : "#6B7280", border: `1px solid ${remaining > 0 ? "rgba(197,160,89,0.3)" : "rgba(107,114,128,0.2)"}`, marginLeft: 8, flexShrink: 0 }}>
                      {remaining > 0 ? `${remaining} left` : "Complete"}
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: "rgba(197,160,89,0.12)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #C5A059, #A8853A)", width: `${pct}%`, transition: "width 0.6s ease" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                    <span style={{ fontSize: 10, color: "#B8AE9C" }}>{pkg.used_sessions} used</span>
                    <span style={{ fontSize: 10, color: "#B8AE9C" }}>{pkg.total_sessions} total</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Proposed Treatments */}
      <Card title="Proposed Treatments">
        {proposed.length === 0 ? (
          <EmptyMini label="No treatments proposed" />
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {proposed.map(t => {
                const isHighValue = (t.price ?? 0) > 500;
                return (
                  <div key={t.id} style={{
                    padding: "10px 12px", borderRadius: 10,
                    background: isHighValue ? "rgba(197,160,89,0.08)" : "rgba(249,247,242,0.7)",
                    border: isHighValue ? "1px solid rgba(197,160,89,0.4)" : "1px solid rgba(197,160,89,0.12)",
                    position: "relative",
                  }}>
                    {isHighValue && (
                      <span style={{
                        position: "absolute", top: 8, right: 8,
                        fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 6,
                        background: "rgba(197,160,89,0.2)", color: "#8B6914", textTransform: "uppercase", letterSpacing: "0.06em",
                      }}>
                        <Star size={8} style={{ display: "inline", verticalAlign: "middle", marginRight: 2 }} />High Value
                      </span>
                    )}
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: 0, paddingRight: isHighValue ? 60 : 0 }}>
                      {t.treatment_name}
                    </p>
                    {t.counselled_by && (
                      <p style={{ fontSize: 10, color: "#9C9584", margin: "2px 0 0" }}>Counselled by {t.counselled_by}</p>
                    )}
                    {t.price != null && (
                      <p style={{ fontSize: 14, fontWeight: 700, color: isHighValue ? "#C5A059" : "#1C1917", marginTop: 5, fontFamily: "Georgia, serif" }}>
                        ${t.price.toLocaleString("en-US", { minimumFractionDigits: 0 })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Total */}
            {totalValue > 0 && (
              <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "linear-gradient(135deg, rgba(197,160,89,0.1), rgba(168,133,58,0.06))", border: "1px solid rgba(197,160,89,0.25)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#9C9584", textTransform: "uppercase", letterSpacing: "0.08em" }}>Proposed Total</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "#C5A059", fontFamily: "Georgia, serif" }}>
                    ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Revenue summary */}
      <Card title="Treatment Summary">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { label: "Proposed",  count: treatments.filter(t => t.status === "proposed").length,  color: "#C5A059" },
            { label: "Completed", count: treatments.filter(t => t.status === "completed").length, color: "#4A8A4A" },
            { label: "Cancelled", count: treatments.filter(t => t.status === "cancelled").length, color: "#9C9584" },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#6B6358" }}>{r.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: r.color }}>{r.count}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────── FAB ─────────────────────────────────

function FAB({ open, onToggle, onAction }: { open: boolean; onToggle: () => void; onAction: (a: "soap" | "note") => void }) {
  const actions = [
    { key: "note" as const, label: "Quick Note",    icon: <FileText size={15} />, bg: "#4B5563" },
    { key: "soap" as const, label: "New Session",   icon: <Clipboard size={15} />, bg: "linear-gradient(135deg, #C5A059, #A8853A)" },
  ];

  return (
    <div style={{ position: "fixed", bottom: 28, right: 28, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, zIndex: 100 }}>
      {/* Actions */}
      {open && actions.map((a, i) => (
        <div key={a.key} className="fab-action" style={{ display: "flex", alignItems: "center", gap: 10, opacity: open ? 1 : 0, transform: open ? "none" : "translateY(10px)", transitionDelay: `${i * 0.05}s` }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: "#1C1917", background: "white", padding: "4px 10px", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.12)", border: "1px solid rgba(197,160,89,0.2)", fontFamily: "Georgia, serif", whiteSpace: "nowrap" }}>
            {a.label}
          </span>
          <button onClick={() => onAction(a.key)} style={{ width: 42, height: 42, borderRadius: "50%", background: a.bg, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white", boxShadow: "0 4px 14px rgba(0,0,0,0.2)", flexShrink: 0 }}>
            {a.icon}
          </button>
        </div>
      ))}

      {/* Main FAB */}
      <button
        onClick={onToggle}
        style={{
          width: 56, height: 56, borderRadius: "50%",
          background: open ? "#1C1917" : "linear-gradient(135deg, #C5A059, #A8853A)",
          border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          color: "white", boxShadow: "0 6px 24px rgba(197,160,89,0.45)",
          transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          transform: open ? "rotate(45deg)" : "none",
        }}
      >
        <Plus size={22} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────── SOAP Drawer ─────────────────────────

function SOAPDrawer({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const [activeTab,     setActiveTab]     = useState<SOAPKey>("subjective");
  const [soap,          setSoap]          = useState({ subjective: "", objective: "", assessment: "", plan: "" });
  const [photos,        setPhotos]        = useState<{ file: File; preview: string; type: "before" | "after" }[]>([]);
  const [saving,        setSaving]        = useState(false);
  const [cptQuery,      setCptQuery]      = useState("");
  const [cptResults,    setCptResults]    = useState<MedicalCode[]>([]);
  const [cptSearching,  setCptSearching]  = useState(false);
  const [attachedCodes, setAttachedCodes] = useState<MedicalCode[]>([]);
  const fileRef  = useRef<HTMLInputElement>(null);
  const cptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced CPT search against medical_codes table
  function onCptInput(val: string) {
    setCptQuery(val);
    if (cptTimer.current) clearTimeout(cptTimer.current);
    if (!val.trim()) { setCptResults([]); return; }
    cptTimer.current = setTimeout(async () => {
      setCptSearching(true);
      const { data } = await supabase
        .from("medical_codes")
        .select("code, description, category")
        .or(`code.ilike.%${val}%,description.ilike.%${val}%,category.ilike.%${val}%`)
        .order("code")
        .limit(12);
      setCptResults(data ?? []);
      setCptSearching(false);
    }, 300);
  }

  function attachCode(code: MedicalCode) {
    if (attachedCodes.find(c => c.code === code.code)) return;
    setAttachedCodes(prev => [...prev, code]);
    // Append to the plan text with a standard format
    setSoap(s => ({
      ...s,
      plan: s.plan
        ? `${s.plan}\nCPT ${code.code} — ${code.description}`
        : `CPT ${code.code} — ${code.description}`,
    }));
    setCptQuery("");
    setCptResults([]);
  }

  function removeCode(code: string) {
    setAttachedCodes(prev => prev.filter(c => c.code !== code));
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.forEach(file => {
      const preview = URL.createObjectURL(file);
      setPhotos(prev => [...prev, { file, preview, type: "before" }]);
    });
  }

  async function handleSave() {
    if (!soap.subjective && !soap.objective && !soap.assessment && !soap.plan) {
      toast.error("Please fill in at least one SOAP section.");
      return;
    }
    setSaving(true);

    // Upload photos to Supabase Storage
    const uploadedPhotos: { url: string; type: string }[] = [];
    for (const p of photos) {
      const ext  = p.file.name.split(".").pop();
      const path = `${patient.clinic_id ?? "unlinked"}/${patient.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data: up, error: upErr } = await supabase.storage
        .from("patient-photos")
        .upload(path, p.file, { contentType: p.file.type, upsert: false });
      if (!upErr && up) {
        const { data: { publicUrl } } = supabase.storage.from("patient-photos").getPublicUrl(up.path);
        uploadedPhotos.push({ url: publicUrl, type: p.type });
      }
    }

    const res = await fetch(`/api/patients/${patient.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_encounter", ...soap, photos: uploadedPhotos }),
    });
    const data = await res.json();
    setSaving(false);

    if (data.success) {
      toast.success("Session saved to clinical record.");
      onClose();
    } else {
      toast.error(data.error ?? "Failed to save session.");
    }
  }

  const currentTab = SOAP_TABS.find(t => t.key === activeTab)!;
  const hasContent = Object.values(soap).some(v => v.trim());

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(28,25,23,0.5)", backdropFilter: "blur(2px)" }} />

      {/* Drawer */}
      <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, zIndex: 50, width: 640, display: "flex", flexDirection: "column", background: "#F9F7F2", boxShadow: "-8px 0 40px rgba(28,25,23,0.18)", animation: "slideInRight 0.3s ease" }}>

        {/* Header */}
        <div style={{ padding: "20px 24px", background: "white", borderBottom: "1px solid rgba(197,160,89,0.18)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Clipboard size={16} style={{ color: "#6366F1" }} />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: 0 }}>New Clinical Session</p>
                <p style={{ fontSize: 12, color: "#9C9584", margin: 0 }}>{patient.full_name} · {fmtDate(new Date().toISOString())}</p>
              </div>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(197,160,89,0.2)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={15} style={{ color: "#9C9584" }} />
            </button>
          </div>

          {/* SOAP Tab Bar */}
          <div style={{ display: "flex", gap: 6, marginTop: 16 }}>
            {SOAP_TABS.map(tab => {
              const isActive = activeTab === tab.key;
              const filled   = !!soap[tab.key].trim();
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="soap-tab"
                  style={{
                    flex: 1, padding: "8px 4px", borderRadius: 10, border: "none",
                    background: isActive ? "rgba(99,102,241,0.1)" : "rgba(249,247,242,0.8)",
                    cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                    outline: isActive ? "2px solid rgba(99,102,241,0.4)" : "2px solid transparent",
                  }}
                >
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

        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {/* Section hint */}
          <p style={{ fontSize: 11, color: "#B8AE9C", fontStyle: "italic", marginBottom: 12, lineHeight: 1.5 }}>
            {currentTab.desc}
          </p>

          <textarea
            key={activeTab}
            value={soap[activeTab]}
            onChange={e => setSoap(s => ({ ...s, [activeTab]: e.target.value }))}
            placeholder={`Enter ${currentTab.title.toLowerCase()} notes…`}
            style={{
              width: "100%", minHeight: 220, padding: "14px 16px", borderRadius: 12,
              border: "1px solid rgba(197,160,89,0.25)", background: "white",
              fontSize: 13, fontFamily: "Georgia, serif", color: "#1C1917",
              lineHeight: 1.75, resize: "vertical", outline: "none",
              boxSizing: "border-box", transition: "border-color 0.2s",
            }}
            onFocus={e => (e.target.style.borderColor = "rgba(99,102,241,0.5)")}
            onBlur={e  => (e.target.style.borderColor = "rgba(197,160,89,0.25)")}
          />

          {/* CPT Procedure Search — only on Plan tab */}
          {activeTab === "plan" && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B6358", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                <Stethoscope size={11} style={{ color: "#C5A059" }} />
                Procedure Code Search (CPT)
              </p>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  value={cptQuery}
                  onChange={e => onCptInput(e.target.value)}
                  placeholder="e.g. Botox, laser, filler, 64612…"
                  style={{
                    width: "100%", padding: "9px 14px", borderRadius: 10, boxSizing: "border-box",
                    border: "1px solid rgba(197,160,89,0.3)", background: "white",
                    fontSize: 13, fontFamily: "Georgia, serif", color: "#1C1917", outline: "none",
                  }}
                  onFocus={e  => (e.target.style.borderColor = "rgba(197,160,89,0.6)")}
                  onBlur={e   => (e.target.style.borderColor = "rgba(197,160,89,0.3)")}
                />
                {cptSearching && (
                  <Loader2 size={13} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#C5A059", animation: "spin 1s linear infinite" }} />
                )}

                {cptResults.length > 0 && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                    background: "white", borderRadius: 12, border: "1px solid rgba(197,160,89,0.25)",
                    boxShadow: "0 10px 36px rgba(28,25,23,0.14)", zIndex: 200,
                    maxHeight: 240, overflowY: "auto",
                  }}>
                    {cptResults.map(code => (
                      <button
                        key={code.code}
                        onMouseDown={() => attachCode(code)}
                        style={{
                          width: "100%", padding: "9px 14px", textAlign: "left", border: "none",
                          background: "transparent", cursor: "pointer",
                          display: "flex", gap: 10, alignItems: "flex-start",
                          borderBottom: "1px solid rgba(197,160,89,0.07)",
                          transition: "background 0.12s",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(197,160,89,0.07)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#C5A059", minWidth: 52, flexShrink: 0, fontFamily: "monospace" }}>{code.code}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, color: "#1C1917", margin: 0, fontFamily: "Georgia, serif" }}>{code.description}</p>
                          {code.category && <p style={{ fontSize: 10, color: "#9C9584", margin: "1px 0 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>{code.category}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Attached codes */}
              {attachedCodes.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {attachedCodes.map(code => (
                    <span
                      key={code.code}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        fontSize: 11, padding: "3px 8px", borderRadius: 7,
                        background: "rgba(197,160,89,0.1)", border: "1px solid rgba(197,160,89,0.3)",
                        color: "#7A5C14", fontFamily: "Georgia, serif",
                      }}
                    >
                      <span style={{ fontWeight: 700, fontFamily: "monospace" }}>CPT {code.code}</span>
                      <span style={{ color: "#9C9584" }}>·</span>
                      <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{code.description}</span>
                      <button
                        onClick={() => removeCode(code.code)}
                        style={{ background: "transparent", border: "none", cursor: "pointer", color: "#9C9584", padding: "0 2px", lineHeight: 1, fontSize: 13 }}
                      >×</button>
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
              <button
                onClick={() => fileRef.current?.click()}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.06)", cursor: "pointer", fontSize: 12, color: "#8B6914" }}
              >
                <Upload size={12} /> Upload
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handlePhotoSelect} />
            </div>

            {photos.length === 0 ? (
              <div
                onClick={() => fileRef.current?.click()}
                style={{ border: "1.5px dashed rgba(197,160,89,0.3)", borderRadius: 12, padding: "24px", textAlign: "center", cursor: "pointer", background: "rgba(249,247,242,0.6)" }}
              >
                <Camera size={24} style={{ color: "rgba(197,160,89,0.5)", margin: "0 auto 8px" }} />
                <p style={{ fontSize: 12, color: "#9C9584" }}>Click to attach before/after photos</p>
                <p style={{ fontSize: 11, color: "#B8AE9C" }}>JPG, PNG up to 10MB</p>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {photos.map((p, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.preview} alt="" style={{ width: 88, height: 88, objectFit: "cover", borderRadius: 10, border: "1px solid rgba(197,160,89,0.25)" }} />
                    {/* Before/After toggle */}
                    <div style={{ display: "flex", gap: 2, marginTop: 4 }}>
                      {(["before", "after"] as const).map(t => (
                        <button key={t} onClick={() => setPhotos(prev => prev.map((ph, j) => j === i ? { ...ph, type: t } : ph))}
                          style={{ flex: 1, fontSize: 9, padding: "2px 0", borderRadius: 4, border: "none", cursor: "pointer", background: p.type === t ? (t === "before" ? "#1C1917" : "#4A8A4A") : "rgba(197,160,89,0.1)", color: p.type === t ? "white" : "#9C9584", fontWeight: 600, textTransform: "uppercase" }}>
                          {t}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                      style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#B43C3C", border: "2px solid white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <X size={9} color="white" />
                    </button>
                  </div>
                ))}
                <button onClick={() => fileRef.current?.click()}
                  style={{ width: 88, height: 88, borderRadius: 10, border: "1.5px dashed rgba(197,160,89,0.3)", background: "rgba(249,247,242,0.6)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <Plus size={16} style={{ color: "rgba(197,160,89,0.5)" }} />
                  <span style={{ fontSize: 10, color: "#B8AE9C" }}>Add</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(197,160,89,0.18)", background: "white", display: "flex", gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: "0 0 auto", padding: "10px 20px", borderRadius: 10, border: "1px solid rgba(197,160,89,0.2)", background: "transparent", cursor: "pointer", fontSize: 13, color: "#9C9584" }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasContent}
            style={{
              flex: 1, padding: "12px 0", borderRadius: 10, border: "none",
              background: saving || !hasContent ? "rgba(197,160,89,0.3)" : "linear-gradient(135deg, #C5A059, #A8853A)",
              cursor: saving || !hasContent ? "not-allowed" : "pointer",
              color: "white", fontSize: 14, fontWeight: 600, fontFamily: "Georgia, serif",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: saving || !hasContent ? "none" : "0 4px 16px rgba(197,160,89,0.35)",
            }}
          >
            {saving ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Saving…</> : <><CheckCircle2 size={15} /> Save Session</>}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

// ─────────────────────────────────────── Quick Note Drawer ───────────────────

function NoteDrawer({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const [content, setContent] = useState("");
  const [saving,  setSaving]  = useState(false);

  async function handleSave() {
    if (!content.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/patients/${patientId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_note", note_type: "note", content }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) { toast.success("Note added."); onClose(); }
    else toast.error(data.error ?? "Failed to save note.");
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(28,25,23,0.45)", backdropFilter: "blur(2px)" }} />
      <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, zIndex: 50, width: 440, display: "flex", flexDirection: "column", background: "#F9F7F2", boxShadow: "-8px 0 40px rgba(28,25,23,0.18)", animation: "slideInRight 0.25s ease" }}>
        <div style={{ padding: "20px 22px", background: "white", borderBottom: "1px solid rgba(197,160,89,0.18)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(107,114,128,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FileText size={15} style={{ color: "#6B7280" }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: 0 }}>Quick Note</p>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(197,160,89,0.2)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} style={{ color: "#9C9584" }} />
          </button>
        </div>
        <div style={{ flex: 1, padding: "20px 22px" }}>
          <textarea
            autoFocus
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Add a clinical note, observation, or reminder…"
            style={{ width: "100%", height: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(197,160,89,0.25)", background: "white", fontSize: 13, fontFamily: "Georgia, serif", color: "#1C1917", lineHeight: 1.75, resize: "none", outline: "none", boxSizing: "border-box" }}
            onFocus={e => (e.target.style.borderColor = "rgba(197,160,89,0.6)")}
            onBlur={e  => (e.target.style.borderColor = "rgba(197,160,89,0.25)")}
          />
        </div>
        <div style={{ padding: "14px 22px", borderTop: "1px solid rgba(197,160,89,0.18)", background: "white", display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid rgba(197,160,89,0.2)", background: "transparent", cursor: "pointer", fontSize: 13, color: "#9C9584" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !content.trim()} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: saving || !content.trim() ? "rgba(197,160,89,0.3)" : "linear-gradient(135deg, #C5A059, #A8853A)", cursor: saving || !content.trim() ? "not-allowed" : "pointer", color: "white", fontSize: 13, fontWeight: 600, fontFamily: "Georgia, serif" }}>
            {saving ? "Saving…" : "Add Note"}
          </button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────── Shared UI ───────────────────────────

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "white", border: "1px solid rgba(197,160,89,0.15)", borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 4px rgba(28,25,23,0.04)" }}>
      {title && (
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9C9584", marginBottom: 10 }}>
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

function CardRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 8, borderBottom: "1px solid rgba(197,160,89,0.07)", marginBottom: 8 }}>
      <span style={{ color: "#C5A059", flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 11, color: "#9C9584", flex: 1 }}>{label}</span>
      <span style={{ fontSize: 12, color: "#3D3530", fontFamily: "Georgia, serif", fontWeight: 500, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid rgba(197,160,89,0.12)" }}>
      <span style={{ color: "#C5A059" }}>{icon}</span>
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9C9584", margin: 0 }}>{label}</p>
    </div>
  );
}

function EmptyMini({ label }: { label: string }) {
  return <p style={{ fontSize: 12, color: "#B8AE9C", fontStyle: "italic", margin: 0 }}>{label}</p>;
}

// ─────────────────────────────────────── Loading / 404 ───────────────────────

function EMRSkeleton() {
  return (
    <div style={{ height: "100%", background: "#F9F7F2" }}>
      <div style={{ height: 72, background: "white", borderBottom: "1px solid rgba(197,160,89,0.15)" }} />
      <div style={{ display: "grid", gridTemplateColumns: "292px 1fr 308px", height: "calc(100% - 72px)" }}>
        {[1, 2, 3].map(n => (
          <div key={n} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, borderRight: n < 3 ? "1px solid rgba(197,160,89,0.12)" : "none" }}>
            {[80, 120, 100, 90].map((h, i) => (
              <div key={i} style={{ height: h, borderRadius: 14, background: "rgba(197,160,89,0.07)", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function NotFound({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ height: "100%", background: "#F9F7F2", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        <User size={40} style={{ color: "rgba(197,160,89,0.4)", margin: "0 auto 16px" }} />
        <h2 style={{ fontSize: 20, fontFamily: "Georgia, serif", color: "#1C1917", marginBottom: 8 }}>Patient Not Found</h2>
        <p style={{ fontSize: 13, color: "#9C9584", marginBottom: 20 }}>This patient record doesn't exist or you don't have access to it.</p>
        <button onClick={onBack} style={{ padding: "10px 24px", borderRadius: 10, background: "linear-gradient(135deg, #C5A059, #A8853A)", border: "none", color: "white", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "Georgia, serif" }}>
          Back to Patient Records
        </button>
      </div>
    </div>
  );
}
