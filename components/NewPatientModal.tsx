"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  X, Sparkles, User, Mail, Phone, Stethoscope, ChevronDown,
  Send, CheckCircle2, Loader2, AlertCircle, Heart, Link2,
  Tag, Calendar, MapPin, FlaskConical,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";

// ── Constants ─────────────────────────────────────────────────────────────────

const CONCERNS = [
  "Botox & Wrinkle Relaxers", "Dermal Fillers", "Skin Care & Facials",
  "Laser Treatments", "PRP Therapy", "Body Contouring",
  "Chemical Peels", "Acne & Scarring", "Pigmentation", "Other / Consultation",
];

const REFERRAL_SOURCES = [
  "Google Search", "Instagram", "Word of Mouth", "Facebook",
  "Walk-in", "Doctor Referral", "WhatsApp", "Other",
];

const FST_OPTIONS = [
  { value: 1, label: "Type I — Very fair, always burns" },
  { value: 2, label: "Type II — Fair, usually burns" },
  { value: 3, label: "Type III — Medium, sometimes burns" },
  { value: 4, label: "Type IV — Olive, rarely burns" },
  { value: 5, label: "Type V — Brown, very rarely burns" },
  { value: 6, label: "Type VI — Dark brown, never burns" },
];

type Tab = "basic" | "medical";
type SubmitState = "idle" | "loading" | "success";

const emptyBasic = {
  fullName: "", email: "", phone: "", dob: "", gender: "",
  address: "", provider: "", concerns: [] as string[],
  referralSource: "", referralCode: "", fitzpatrick: 0,
  sendIntake: true,
};

const emptyMedical = {
  allergies: [] as string[], allergyInput: "",
  conditions: [] as string[], conditionInput: "",
  medications: "", previousTreatments: "", priorInjections: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function genReferralCode(name: string): string {
  const prefix = name.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase().padEnd(3, "X");
  const chars   = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const suffix  = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${prefix}-${suffix}`;
}

const labelStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 5,
  fontSize: 11, fontWeight: 600, textTransform: "uppercase",
  letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 7,
};

function Required() {
  return <span style={{ color: "var(--gold)", fontSize: 13, lineHeight: 1 }}>*</span>;
}

const inputBase: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: "var(--radius-md)",
  border: "1px solid var(--border)", background: "var(--bg-elevated)",
  color: "var(--text-primary)", fontFamily: "var(--font-sans)", fontSize: 13,
  outline: "none", boxSizing: "border-box",
};

function AeInput({ value, onChange, type = "text", placeholder, id }: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string; id?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input id={id} type={type} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{ ...inputBase, borderColor: focused ? "var(--gold)" : "var(--border)", boxShadow: focused ? "0 0 0 3px rgba(197,160,89,0.12)" : "none" }}
    />
  );
}

function AeSelect({ value, onChange, children }: { value: string | number; onChange: (v: string) => void; children: React.ReactNode }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <select value={value} onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ ...inputBase, appearance: "none", paddingRight: 32, cursor: "pointer", borderColor: focused ? "var(--gold)" : "var(--border)", boxShadow: focused ? "0 0 0 3px rgba(197,160,89,0.12)" : "none" }}>
        {children}
      </select>
      <ChevronDown size={14} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-muted)" }} />
    </div>
  );
}

// ── Tag input (for allergies / conditions) ────────────────────────────────────

function TagInput({ tags, inputValue, onInput, onAdd, onRemove, placeholder, color = "#B43C3C", bg = "rgba(180,60,60,0.08)" }: {
  tags: string[]; inputValue: string; onInput: (v: string) => void;
  onAdd: () => void; onRemove: (i: number) => void;
  placeholder?: string; color?: string; bg?: string;
}) {
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: tags.length ? 8 : 0 }}>
        {tags.map((t, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: bg, color, border: `1px solid ${color}44` }}>
            {t}
            <button type="button" onClick={() => onRemove(i)} style={{ background: "none", border: "none", cursor: "pointer", color, lineHeight: 1, padding: 0, fontSize: 14, marginTop: -1 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={inputValue} onChange={e => onInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onAdd(); } }}
          placeholder={placeholder} style={{ ...inputBase, flex: 1 }} />
        <button type="button" onClick={onAdd}
          style={{ padding: "9px 14px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: "var(--bg-subtle)", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer" }}>
          Add
        </button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface Props { isOpen: boolean; onClose: () => void; }

export default function NewPatientModal({ isOpen, onClose }: Props) {
  const router = useRouter();
  const { profile, activeClinicId } = useClinic();
  const [visible,       setVisible]       = useState(false);
  const [mounted,       setMounted]       = useState(false);
  const [tab,           setTab]           = useState<Tab>("basic");
  const [basic,         setBasic]         = useState(emptyBasic);
  const [medical,       setMedical]       = useState(emptyMedical);
  const [submitState,   setSubmitState]   = useState<SubmitState>("idle");
  const [errorMsg,      setErrorMsg]      = useState<string | null>(null);
  const [providers,     setProviders]     = useState<{ id: string; full_name: string }[]>([]);
  const [dupPatient,    setDupPatient]    = useState<{ id: string; full_name: string; phone: string } | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  // Derive clinicId (use activeClinicId or profile.clinic_id)
  const clinicId = activeClinicId ?? profile?.clinic_id ?? null;

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isOpen || !clinicId) return;
    supabase.from("profiles")
      .select("id, full_name")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .in("role", ["doctor","therapist","counsellor"])
      .order("full_name")
      .then(({ data }) => setProviders(data ?? []));
  }, [isOpen, clinicId]);

  useEffect(() => {
    if (isOpen) {
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setVisible(false);
      const t = setTimeout(() => {
        setBasic(emptyBasic); setMedical(emptyMedical);
        setTab("basic"); setSubmitState("idle"); setErrorMsg(null); setDupPatient(null);
      }, 380);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  useEffect(() => {
    if (visible && firstRef.current) {
      const t = setTimeout(() => firstRef.current?.focus(), 360);
      return () => clearTimeout(t);
    }
  }, [visible]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const isBasicValid = !!basic.fullName.trim() && !!basic.phone.trim() && basic.concerns.length > 0;

  async function doInsert() {
    setSubmitState("loading"); setErrorMsg(null);

    // 1. Create patient
    const { data: patient, error: patErr } = await supabase
      .from("patients")
      .insert({
        full_name:             basic.fullName.trim(),
        email:                 basic.email?.trim()    || null,
        phone:                 basic.phone.trim(),
        date_of_birth:         basic.dob              || null,
        preferred_provider_id: basic.provider         || null,
        primary_concern:       basic.concerns.length  ? basic.concerns : null,
        notes:                 basic.address?.trim()  || null,
        fitzpatrick_type:      basic.fitzpatrick       || null,
        clinic_id:             clinicId,
      })
      .select("id")
      .single();

    if (patErr) {
      setSubmitState("idle");
      setErrorMsg(patErr.message);
      toast.error("Registration failed — " + patErr.message);
      return;
    }

    const patientId = patient.id;

    // 2. Create patient_medical_history (fire-and-forget)
    const hasMedical =
      medical.allergies.length > 0 || medical.conditions.length > 0 ||
      medical.medications.trim() || medical.previousTreatments.trim() ||
      medical.priorInjections;

    if (hasMedical) {
      supabase.from("patient_medical_history").insert({
        patient_id:           patientId,
        clinic_id:            clinicId,
        allergies:            medical.allergies.length ? medical.allergies : null,
        current_medications:  medical.medications.trim()          || null,
        past_procedures:      medical.previousTreatments.trim()   || null,
        primary_concerns:     medical.conditions.length ? medical.conditions : null,
        had_prior_injections: medical.priorInjections,
        recorded_at:          new Date().toISOString(),
      }).then(() => {});
    }

    // 3. Generate referral code (fire-and-forget)
    const code = genReferralCode(basic.fullName);
    supabase.from("referral_codes").insert({ patient_id: patientId, code }).then(() => {});

    // C6: Referral conversion tracking
    if (basic.referralCode.trim()) {
      supabase
        .from("referral_codes")
        .select("patient_id, id")
        .eq("code", basic.referralCode.trim().toUpperCase())
        .maybeSingle()
        .then(({ data: referrerCode }) => {
          if (!referrerCode) return;
          // Record conversion
          supabase.from("referral_conversions").insert({
            clinic_id:           clinicId,
            referral_code_id:    referrerCode.id,
            referrer_patient_id: referrerCode.patient_id,
            referred_patient_id: patientId,
            wallet_reward:       0,
            points_reward:       200,
            converted_at:        new Date().toISOString(),
          }).then(() => {});
          // Award 200 pts to referrer (p_amount=2000 → 200 pts at 1 pt/₹10)
          supabase.rpc("earn_loyalty_points", {
            p_patient_id: referrerCode.patient_id,
            p_clinic_id:  clinicId,
            p_amount:     2000,
            p_invoice_id: null,
          }).then(() => {});
        });
    }

    setSubmitState("success");
    toast.success(`${basic.fullName} registered`, {
      description: basic.sendIntake ? "Patient added · Intake form link ready." : "Patient added to records.",
      icon: <Sparkles size={15} color="#C5A059" />,
      duration: 4000,
    });
    setTimeout(() => { onClose(); router.push(`/patients/${patientId}`); }, 800);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isBasicValid) { setTab("basic"); return; }

    // Duplicate check
    if (clinicId && basic.phone.trim()) {
      const { data: existing } = await supabase
        .from("patients")
        .select("id, full_name, phone")
        .eq("clinic_id", clinicId)
        .eq("phone", basic.phone.trim())
        .limit(1).maybeSingle();
      if (existing) { setDupPatient(existing); return; }
    }
    await doInsert();
  }

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Duplicate warning */}
      {dupPatient && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 400, width: "90vw", border: "1px solid rgba(197,160,89,0.3)", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <AlertCircle size={20} color="#D97706" />
              <p style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>Patient Already Exists</p>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 18, lineHeight: 1.5 }}>
              <strong style={{ color: "var(--text-primary)" }}>{dupPatient.full_name}</strong> is already registered with phone <strong>{dupPatient.phone}</strong>.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setDupPatient(null); onClose(); router.push(`/patients/${dupPatient.id}`); }}
                style={{ flex: 1, padding: "9px 0", borderRadius: 10, background: "var(--gold)", color: "#fff", fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer", fontFamily: "var(--font-serif)" }}>
                View Existing
              </button>
              <button onClick={() => { setDupPatient(null); doInsert(); }}
                style={{ flex: 1, padding: "9px 0", borderRadius: 10, background: "#fff", color: "var(--text-secondary)", fontWeight: 600, fontSize: 13, border: "1px solid var(--border)", cursor: "pointer" }}>
                Create Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      <div onClick={onClose} aria-hidden="true" style={{
        position: "fixed", inset: 0, zIndex: 40,
        background: "rgba(14,12,10,0.55)", backdropFilter: "blur(3px)",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.35s cubic-bezier(0.4,0,0.2,1)",
        pointerEvents: isOpen ? "auto" : "none",
      }} />

      {/* Drawer */}
      <aside role="dialog" aria-modal="true" aria-label="New Patient Registration" style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50,
        width: "100%", maxWidth: 520,
        display: "flex", flexDirection: "column",
        background: "#FFFFFF",
        borderLeft: "2px solid var(--gold)",
        boxShadow: "-12px 0 60px rgba(0,0,0,0.18)",
        transform: visible ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.38s cubic-bezier(0.4,0,0.2,1)",
        pointerEvents: isOpen ? "auto" : "none",
      }}>

        {/* Header */}
        <div style={{ padding: "22px 28px 0", borderBottom: "1px solid var(--border)", background: "linear-gradient(135deg,#FFFDF8,#FFFFFF)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(197,160,89,0.12)", border: "1px solid rgba(197,160,89,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Sparkles size={18} color="var(--gold)" />
              </div>
              <div>
                <h2 style={{ fontSize: 19, fontWeight: 700, fontFamily: "var(--font-serif)", color: "var(--text-primary)", margin: 0 }}>New Patient</h2>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {basic.fullName ? `Registering — ${basic.fullName}` : "Complete the details below"}
                </p>
              </div>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-muted)" }}>
              <X size={15} />
            </button>
          </div>

          {/* Tab bar */}
          <div style={{ display: "flex", gap: 0, marginBottom: -1 }}>
            {([
              { key: "basic"   as Tab, label: "Basic Info",   icon: User   },
              { key: "medical" as Tab, label: "Medical",      icon: Heart  },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" onClick={() => setTab(key)} style={{
                padding: "8px 18px", border: "none", borderBottom: `2px solid ${tab === key ? "var(--gold)" : "transparent"}`,
                background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: tab === key ? 600 : 400,
                color: tab === key ? "var(--gold)" : "var(--text-muted)",
                display: "flex", alignItems: "center", gap: 6,
                transition: "all 0.15s",
              }}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>

          {/* ── Basic Info Tab ── */}
          {tab === "basic" && (
            <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>

              {/* Full Name */}
              <div>
                <label style={labelStyle}><User size={11} color="var(--gold)" />Full Name <Required /></label>
                <input ref={firstRef} type="text" value={basic.fullName} placeholder="e.g. Priya Sharma"
                  onChange={e => setBasic(b => ({ ...b, fullName: e.target.value }))}
                  style={inputBase}
                  onFocus={e => { e.target.style.borderColor = "var(--gold)"; e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.12)"; }}
                  onBlur={e  => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                />
              </div>

              {/* Phone + Email */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}><Phone size={11} color="var(--gold)" />Phone <Required /></label>
                  <AeInput value={basic.phone} onChange={v => setBasic(b => ({ ...b, phone: v }))} type="tel" placeholder="+91 98765 43210" />
                </div>
                <div>
                  <label style={labelStyle}><Mail size={11} color="var(--gold)" />Email</label>
                  <AeInput value={basic.email} onChange={v => setBasic(b => ({ ...b, email: v }))} type="email" placeholder="priya@email.com" />
                </div>
              </div>

              {/* DOB + Gender */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}><Calendar size={11} color="var(--gold)" />Date of Birth</label>
                  <AeInput value={basic.dob} onChange={v => setBasic(b => ({ ...b, dob: v }))} type="date" />
                </div>
                <div>
                  <label style={labelStyle}>Gender</label>
                  <AeSelect value={basic.gender} onChange={v => setBasic(b => ({ ...b, gender: v }))}>
                    <option value="">Prefer not to say</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="non_binary">Non-binary</option>
                  </AeSelect>
                </div>
              </div>

              {/* Address */}
              <div>
                <label style={labelStyle}><MapPin size={11} color="var(--gold)" />Address</label>
                <AeInput value={basic.address} onChange={v => setBasic(b => ({ ...b, address: v }))} placeholder="Area, City" />
              </div>

              <div style={{ height: 1, background: "var(--border)" }} />

              {/* Preferred Provider */}
              <div>
                <label style={labelStyle}><Stethoscope size={11} color="var(--gold)" />Preferred Provider</label>
                <AeSelect value={basic.provider} onChange={v => setBasic(b => ({ ...b, provider: v }))}>
                  <option value="">No preference</option>
                  {providers.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </AeSelect>
              </div>

              {/* Primary Concerns (multi-select chips) */}
              <div>
                <label style={labelStyle}><Sparkles size={11} color="var(--gold)" />Primary Concerns <Required /></label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {CONCERNS.map(c => {
                    const sel = basic.concerns.includes(c);
                    return (
                      <button key={c} type="button" onClick={() => setBasic(b => ({
                        ...b, concerns: sel ? b.concerns.filter(x => x !== c) : [...b.concerns, c],
                      }))} style={{
                        padding: "5px 12px", borderRadius: 999, fontSize: 12,
                        fontFamily: "var(--font-serif)", cursor: "pointer", transition: "all 0.15s",
                        border: sel ? "1.5px solid var(--gold)" : "1.5px solid var(--border)",
                        background: sel ? "rgba(197,160,89,0.12)" : "var(--bg-subtle)",
                        color: sel ? "var(--gold)" : "var(--text-muted)", fontWeight: sel ? 600 : 400,
                      }}>{c}</button>
                    );
                  })}
                </div>
              </div>

              {/* Fitzpatrick Type */}
              <div>
                <label style={labelStyle}><FlaskConical size={11} color="var(--gold)" />Fitzpatrick Skin Type</label>
                <AeSelect value={basic.fitzpatrick} onChange={v => setBasic(b => ({ ...b, fitzpatrick: Number(v) }))}>
                  <option value={0}>Not specified</option>
                  {FST_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </AeSelect>
              </div>

              {/* Referral Source + Code */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}><Link2 size={11} color="var(--gold)" />Referral Source</label>
                  <AeSelect value={basic.referralSource} onChange={v => setBasic(b => ({ ...b, referralSource: v }))}>
                    <option value="">Unknown</option>
                    {REFERRAL_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </AeSelect>
                </div>
                <div>
                  <label style={labelStyle}><Tag size={11} color="var(--gold)" />Referral Code</label>
                  <AeInput value={basic.referralCode} onChange={v => setBasic(b => ({ ...b, referralCode: v.toUpperCase() }))} placeholder="e.g. PRI-A7K2P" />
                </div>
              </div>
            </div>
          )}

          {/* ── Medical Tab ── */}
          {tab === "medical" && (
            <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Allergies */}
              <div>
                <label style={labelStyle}><AlertCircle size={11} color="#B43C3C" />Allergies</label>
                <TagInput
                  tags={medical.allergies}
                  inputValue={medical.allergyInput}
                  onInput={v => setMedical(m => ({ ...m, allergyInput: v }))}
                  onAdd={() => {
                    const v = medical.allergyInput.trim();
                    if (v && !medical.allergies.includes(v)) setMedical(m => ({ ...m, allergies: [...m.allergies, v], allergyInput: "" }));
                  }}
                  onRemove={i => setMedical(m => ({ ...m, allergies: m.allergies.filter((_, idx) => idx !== i) }))}
                  placeholder="e.g. Penicillin, Latex…"
                  color="#B43C3C" bg="rgba(180,60,60,0.08)"
                />
              </div>

              {/* Medical Conditions */}
              <div>
                <label style={labelStyle}><Heart size={11} color="var(--gold)" />Medical Conditions</label>
                <TagInput
                  tags={medical.conditions}
                  inputValue={medical.conditionInput}
                  onInput={v => setMedical(m => ({ ...m, conditionInput: v }))}
                  onAdd={() => {
                    const v = medical.conditionInput.trim();
                    if (v && !medical.conditions.includes(v)) setMedical(m => ({ ...m, conditions: [...m.conditions, v], conditionInput: "" }));
                  }}
                  onRemove={i => setMedical(m => ({ ...m, conditions: m.conditions.filter((_, idx) => idx !== i) }))}
                  placeholder="e.g. Hypertension, Diabetes…"
                  color="#D97706" bg="rgba(217,119,6,0.08)"
                />
              </div>

              {/* Current Medications */}
              <div>
                <label style={labelStyle}>Current Medications</label>
                <textarea value={medical.medications} onChange={e => setMedical(m => ({ ...m, medications: e.target.value }))}
                  rows={3} placeholder="List current medications, dosages…"
                  style={{ ...inputBase, resize: "none", lineHeight: 1.5 }} />
              </div>

              {/* Previous Treatments */}
              <div>
                <label style={labelStyle}>Previous Aesthetic Treatments</label>
                <textarea value={medical.previousTreatments} onChange={e => setMedical(m => ({ ...m, previousTreatments: e.target.value }))}
                  rows={3} placeholder="Previous procedures, clinics, outcomes…"
                  style={{ ...inputBase, resize: "none", lineHeight: 1.5 }} />
              </div>

              {/* Prior Injections toggle */}
              <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: "12px 14px", borderRadius: "var(--radius-lg)", border: `1px solid ${medical.priorInjections ? "rgba(197,160,89,0.4)" : "var(--border)"}`, background: medical.priorInjections ? "rgba(197,160,89,0.06)" : "var(--bg-subtle)" }}>
                <div style={{ position: "relative" }}>
                  <input type="checkbox" checked={medical.priorInjections} onChange={e => setMedical(m => ({ ...m, priorInjections: e.target.checked }))} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
                  <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${medical.priorInjections ? "var(--gold)" : "var(--border)"}`, background: medical.priorInjections ? "var(--gold)" : "white", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
                    {medical.priorInjections && <svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4L4 7L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-serif)", color: "var(--text-primary)", margin: 0 }}>Had Prior Injectable Treatments</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Botox, fillers, or other injectables</p>
                </div>
              </label>
            </div>
          )}

          {/* ── Footer ── */}
          <div style={{ padding: "16px 28px 24px", borderTop: "1px solid var(--border)", background: "#FDFCF9", flexShrink: 0 }}>

            {/* Send intake toggle */}
            <label style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderRadius: "var(--radius-lg)", border: `1px solid ${basic.sendIntake ? "rgba(197,160,89,0.4)" : "var(--border)"}`, background: basic.sendIntake ? "rgba(197,160,89,0.06)" : "var(--bg-subtle)", cursor: "pointer", marginBottom: 14, transition: "all 0.2s" }}>
              <div style={{ position: "relative", flexShrink: 0, marginTop: 1 }}>
                <input type="checkbox" checked={basic.sendIntake} onChange={e => setBasic(b => ({ ...b, sendIntake: e.target.checked }))} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
                <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${basic.sendIntake ? "var(--gold)" : "var(--border)"}`, background: basic.sendIntake ? "var(--gold)" : "white", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
                  {basic.sendIntake && <svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4L4 7L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </div>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Send size={13} color={basic.sendIntake ? "var(--gold)" : "var(--text-muted)"} />
                  <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-serif)", color: basic.sendIntake ? "var(--text-primary)" : "var(--text-muted)" }}>Send Digital Intake Form</span>
                </div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.5 }}>Patient receives a secure link to complete health history and consent forms.</p>
              </div>
            </label>

            {errorMsg && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 14px", borderRadius: 10, background: "rgba(180,60,60,0.07)", border: "1px solid rgba(180,60,60,0.25)", marginBottom: 12 }}>
                <AlertCircle size={15} color="#B43C3C" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: "#B43C3C", margin: 0, lineHeight: 1.5 }}>{errorMsg}</p>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              {tab === "medical" && (
                <button type="button" onClick={() => setTab("basic")} style={{ flex: "0 0 100px", padding: "11px 0", borderRadius: "var(--radius-lg)", fontSize: 13, fontWeight: 600, border: "1px solid var(--border)", background: "var(--bg-subtle)", color: "var(--text-secondary)", cursor: "pointer" }}>
                  ← Back
                </button>
              )}
              {tab === "basic" && (
                <button type="button" disabled={!isBasicValid} onClick={() => setTab("medical")} style={{ flex: "0 0 130px", padding: "11px 0", borderRadius: "var(--radius-lg)", fontSize: 13, fontWeight: 600, border: "1px solid rgba(197,160,89,0.4)", background: "rgba(197,160,89,0.08)", color: "var(--gold)", cursor: isBasicValid ? "pointer" : "not-allowed", opacity: isBasicValid ? 1 : 0.5 }}>
                  Medical Info →
                </button>
              )}
              <button type="submit" disabled={submitState !== "idle" || !isBasicValid} style={{
                flex: 1, padding: "11px 0", borderRadius: "var(--radius-lg)", fontSize: 14, fontWeight: 600,
                fontFamily: "var(--font-serif)", border: "none",
                cursor: submitState !== "idle" || !isBasicValid ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                background: submitState === "success" ? "linear-gradient(135deg,#6B8A5A,#5A7A48)" : "linear-gradient(135deg,#C5A059,#A8853A)",
                color: "white", opacity: submitState === "idle" && !isBasicValid ? 0.5 : 1,
                transition: "all 0.25s",
              }}>
                {submitState === "idle" && <><Sparkles size={14} /> Register Patient</>}
                {submitState === "loading" && <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Saving…</>}
                {submitState === "success" && <><CheckCircle2 size={14} /> Registered!</>}
              </button>
            </div>

            <p style={{ fontSize: 11, textAlign: "center", color: "var(--text-muted)", marginTop: 10 }}>
              A unique referral code is auto-generated for this patient.
            </p>
          </div>
        </form>
      </aside>
    </>,
    document.body
  );
}
