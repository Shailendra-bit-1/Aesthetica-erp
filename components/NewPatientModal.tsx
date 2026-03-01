"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  X,
  Sparkles,
  User,
  Mail,
  Phone,
  Stethoscope,
  ChevronDown,
  Send,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface Specialist {
  id: string;
  full_name: string;
  role: string;
}

interface NewPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const concerns = [
  "Botox & Wrinkle Relaxers",
  "Dermal Fillers",
  "Skin Care & Facials",
  "Laser Treatments",
  "PRP Therapy",
  "Body Contouring",
  "Chemical Peels",
  "Acne & Scarring",
  "Pigmentation",
  "Other / Consultation",
];

type SubmitState = "idle" | "loading" | "success";

const emptyForm = {
  fullName: "",
  email: "",
  phone: "",
  provider: "",
  concern: "",
  notes: "",
  sendIntake: true,
};

export default function NewPatientModal({ isOpen, onClose }: NewPatientModalProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [dupPatient, setDupPatient] = useState<{ id: string; full_name: string; phone: string } | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Fetch real specialists from profiles table when modal opens
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("clinic_id")
        .eq("id", user.id)
        .single();
      if (!profile?.clinic_id) return;
      setClinicId(profile.clinic_id); // save for the patient insert
      const { data: docs } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("clinic_id", profile.clinic_id)
        .eq("role", "doctor")
        .eq("is_active", true)
        .order("full_name");
      setSpecialists(docs ?? []);
    })();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setVisible(false);
      const t = setTimeout(() => {
        setForm(emptyForm);
        setSubmitState("idle");
        setErrorMsg(null);
      }, 380);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  useEffect(() => {
    if (visible && firstInputRef.current) {
      const t = setTimeout(() => firstInputRef.current?.focus(), 360);
      return () => clearTimeout(t);
    }
  }, [visible]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const doInsert = async () => {
    setDupPatient(null);
    setSubmitState("loading");
    setErrorMsg(null);

    const { data: newPatient, error } = await supabase
      .from("patients")
      .insert({
        full_name:             form.fullName.trim(),
        email:                 form.email?.trim()  || null,
        phone:                 form.phone.trim(),
        preferred_provider_id: form.provider       || null,
        primary_concern:       form.concern ? [form.concern] : null,
        notes:                 form.notes?.trim()  || null,
        clinic_id:             clinicId,
      })
      .select("id")
      .single();

    if (error) {
      setSubmitState("idle");
      setErrorMsg(error.message);
      toast.error(`DB Error — ${error.message}`, {
        duration: 10000,
        style: {
          background: "#1C1917",
          border: "1px solid #C5A059",
          color: "#C5A059",
          fontFamily: "Georgia, serif",
          fontSize: 13,
        },
      });
      return;
    }

    setSubmitState("success");
    toast.success(`${form.fullName} registered`, {
      description: form.sendIntake
        ? "Patient added · Digital intake form sent."
        : "Patient added to records.",
      icon: <Sparkles size={15} color="#C5A059" />,
      duration: 4000,
    });
    setTimeout(() => {
      onClose();
      router.push(`/patients/${newPatient.id}`);
    }, 800);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitState("loading");
    setErrorMsg(null);

    // Duplicate phone check within this clinic
    if (clinicId && form.phone.trim()) {
      const { data: existing } = await supabase
        .from("patients")
        .select("id, full_name, phone")
        .eq("clinic_id", clinicId)
        .eq("phone", form.phone.trim())
        .limit(1)
        .maybeSingle();
      if (existing) {
        setSubmitState("idle");
        setDupPatient(existing);
        return;
      }
    }

    await doInsert();
  };

  const inputClass =
    "w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200";
  const inputStyle = {
    background: "#FDFCF9",
    border: "1px solid var(--border)",
    color: "var(--foreground)",
    fontFamily: "Georgia, serif",
  };
  const focusHandler = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = "var(--gold)";
    e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.12)";
  };
  const blurHandler = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = "var(--border)";
    e.target.style.boxShadow = "none";
  };

  // Email is optional — the patients table allows null email (for walk-in registrations)
  const isFormValid = !!form.fullName && !!form.phone && !!form.concern;

  if (!mounted) return null;

  return createPortal(
    <>
      {/* ── Duplicate patient warning dialog ── */}
      {dupPatient && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 400, width: "90vw", border: "1px solid rgba(197,160,89,0.3)", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <AlertCircle size={20} color="#D97706" />
              <p style={{ fontFamily: "Georgia, serif", fontWeight: 600, fontSize: 15, color: "#1C1917" }}>Patient Already Exists</p>
            </div>
            <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 18, lineHeight: 1.5 }}>
              A patient named <strong style={{ color: "#1C1917" }}>{dupPatient.full_name}</strong> is already registered with phone <strong style={{ color: "#1C1917" }}>{dupPatient.phone}</strong>.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setDupPatient(null); onClose(); router.push(`/patients/${dupPatient.id}`); }}
                style={{ flex: 1, padding: "9px 0", borderRadius: 10, background: "var(--gold)", color: "#fff", fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer", fontFamily: "Georgia, serif" }}>
                View Existing Patient
              </button>
              <button
                onClick={doInsert}
                style={{ flex: 1, padding: "9px 0", borderRadius: 10, background: "#fff", color: "#6B7280", fontWeight: 600, fontSize: 13, border: "1px solid rgba(197,160,89,0.3)", cursor: "pointer" }}>
                Create Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Backdrop ── */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 40,
          background: "rgba(14,12,10,0.55)",
          backdropFilter: "blur(3px)",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.35s cubic-bezier(0.4,0,0.2,1)",
          pointerEvents: isOpen ? "auto" : "none",
        }}
      />

      {/* ── Drawer ── */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="New Patient Registration"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          width: "100%",
          maxWidth: "480px",
          display: "flex",
          flexDirection: "column",
          background: "#FFFFFF",
          borderLeft: "2px solid var(--gold)",
          boxShadow: "-12px 0 60px rgba(0,0,0,0.18)",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.38s cubic-bezier(0.4,0,0.2,1)",
          pointerEvents: isOpen ? "auto" : "none",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: "24px 28px 20px",
            borderBottom: "1px solid var(--border)",
            background: "linear-gradient(135deg, #FFFDF8 0%, #FFFFFF 100%)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: "rgba(197,160,89,0.12)",
                  border: "1px solid rgba(197,160,89,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Sparkles size={18} color="var(--gold)" />
              </div>
              <div>
                <h2
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    fontFamily: "Georgia, serif",
                    color: "var(--foreground)",
                    margin: 0,
                    lineHeight: 1.2,
                  }}
                >
                  New Patient
                </h2>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {form.fullName
                    ? `Registering — ${form.fullName}`
                    : "Complete the details below"}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "1px solid var(--border)",
                background: "var(--surface-warm)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--text-muted)",
                transition: "all 0.15s",
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(197,160,89,0.12)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--gold)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--gold)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-warm)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
              }}
              aria-label="Close"
            >
              <X size={15} />
            </button>
          </div>

          {/* Step indicator */}
          <div style={{ display: "flex", gap: 6, marginTop: 18 }}>
            {["Personal Info", "Clinical", "Preferences"].map((step, i) => (
              <div key={step} style={{ flex: 1 }}>
                <div
                  style={{
                    height: 3,
                    borderRadius: 2,
                    background: i === 0 ? "var(--gold)" : "var(--border)",
                    transition: "background 0.3s",
                  }}
                />
                <p
                  style={{
                    fontSize: 10,
                    color: i === 0 ? "var(--gold)" : "var(--text-muted)",
                    marginTop: 4,
                    fontWeight: i === 0 ? 600 : 400,
                    letterSpacing: "0.04em",
                  }}
                >
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Form body (scrollable) ── */}
        <form
          onSubmit={handleSubmit}
          style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}
        >
          <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Full Name */}
            <div>
              <label style={labelStyle}>
                <User size={12} color="var(--gold)" />
                Full Name <Required />
              </label>
              <input
                ref={firstInputRef}
                type="text"
                required
                placeholder="e.g. Sophia Laurent"
                value={form.fullName}
                onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                className={inputClass}
                style={inputStyle}
                onFocus={focusHandler}
                onBlur={blurHandler}
              />
            </div>

            {/* Email + Phone row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={labelStyle}>
                  <Mail size={12} color="var(--gold)" />
                  Email
                </label>
                <input
                  type="email"
                  placeholder="client@email.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className={inputClass}
                  style={inputStyle}
                  onFocus={focusHandler}
                  onBlur={blurHandler}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  <Phone size={12} color="var(--gold)" />
                  Phone <Required />
                </label>
                <input
                  type="tel"
                  required
                  placeholder="(555) 000-0000"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))}
                  className={inputClass}
                  style={inputStyle}
                  onFocus={focusHandler}
                  onBlur={blurHandler}
                />
              </div>
            </div>

            {/* Divider */}
            <div
              style={{
                borderTop: "1px solid var(--border)",
                paddingTop: 4,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                Clinical Details
              </span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>

            {/* Preferred Provider */}
            <div>
              <label style={labelStyle}>
                <Stethoscope size={12} color="var(--gold)" />
                Preferred Provider
              </label>
              <div style={{ position: "relative" }}>
                <select
                  value={form.provider}
                  onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                  className={inputClass}
                  style={{
                    ...inputStyle,
                    appearance: "none",
                    paddingRight: "36px",
                    cursor: "pointer",
                  }}
                  onFocus={focusHandler}
                  onBlur={blurHandler}
                >
                  <option value="">
                    {specialists.length === 0 ? "No doctors found…" : "No preference"}
                  </option>
                  {specialists.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  color="var(--text-muted)"
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                  }}
                />
              </div>
            </div>

            {/* Primary Concern */}
            <div>
              <label style={labelStyle}>
                <Sparkles size={12} color="var(--gold)" />
                Primary Concern <Required />
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
                {concerns.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, concern: c }))}
                    style={{
                      padding: "6px 13px",
                      borderRadius: "999px",
                      fontSize: 12,
                      fontFamily: "Georgia, serif",
                      cursor: "pointer",
                      transition: "all 0.18s",
                      border: form.concern === c
                        ? "1.5px solid var(--gold)"
                        : "1.5px solid var(--border)",
                      background: form.concern === c
                        ? "rgba(197,160,89,0.12)"
                        : "var(--surface-warm)",
                      color: form.concern === c ? "var(--gold)" : "var(--text-muted)",
                      fontWeight: form.concern === c ? 600 : 400,
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
              {!form.concern && (
                <p style={{ fontSize: 11, color: "rgba(138,128,120,0.7)", marginTop: 6 }}>
                  Select one to continue
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label style={labelStyle}>Additional Notes</label>
              <textarea
                rows={3}
                placeholder="Allergies, previous treatments, special requests…"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                style={{
                  ...inputStyle,
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 12,
                  fontSize: 13,
                  resize: "none",
                  outline: "none",
                  transition: "all 0.2s",
                  display: "block",
                  boxSizing: "border-box",
                }}
                onFocus={e => {
                  e.target.style.borderColor = "var(--gold)";
                  e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.12)";
                }}
                onBlur={e => {
                  e.target.style.borderColor = "var(--border)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>
          </div>

          {/* ── Sticky footer ── */}
          <div
            style={{
              padding: "16px 28px 24px",
              borderTop: "1px solid var(--border)",
              background: "#FDFCF9",
              flexShrink: 0,
            }}
          >
            {/* Digital Intake Form toggle */}
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "14px 16px",
                borderRadius: 14,
                border: form.sendIntake
                  ? "1.5px solid rgba(197,160,89,0.45)"
                  : "1.5px solid var(--border)",
                background: form.sendIntake
                  ? "rgba(197,160,89,0.06)"
                  : "var(--surface-warm)",
                cursor: "pointer",
                transition: "all 0.2s",
                marginBottom: 16,
              }}
            >
              <div style={{ position: "relative", flexShrink: 0, marginTop: 1 }}>
                <input
                  type="checkbox"
                  checked={form.sendIntake}
                  onChange={e => setForm(f => ({ ...f, sendIntake: e.target.checked }))}
                  style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
                />
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    border: form.sendIntake
                      ? "2px solid var(--gold)"
                      : "2px solid var(--border)",
                    background: form.sendIntake ? "var(--gold)" : "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.18s",
                  }}
                >
                  {form.sendIntake && (
                    <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                      <path d="M1 4L4 7L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Send size={13} color={form.sendIntake ? "var(--gold)" : "var(--text-muted)"} />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: "Georgia, serif",
                      color: form.sendIntake ? "var(--foreground)" : "var(--text-muted)",
                    }}
                  >
                    Send Digital Intake Form
                  </span>
                </div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.5 }}>
                  Patient receives a secure link to complete health history, consent forms, and upload a photo ID before their visit.
                </p>
              </div>
            </label>

            {/* Inline error */}
            {errorMsg && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "rgba(180,60,60,0.07)",
                  border: "1px solid rgba(180,60,60,0.25)",
                  marginBottom: 12,
                }}
              >
                <AlertCircle size={15} color="#B43C3C" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: "#B43C3C", margin: 0, lineHeight: 1.5 }}>
                  {errorMsg}
                </p>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={submitState !== "idle" || !isFormValid}
              style={{
                width: "100%",
                padding: "13px 0",
                borderRadius: 14,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "Georgia, serif",
                border: "none",
                cursor: submitState !== "idle" || !isFormValid ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 0.25s",
                background:
                  submitState === "success"
                    ? "linear-gradient(135deg, #6B8A5A, #5A7A48)"
                    : "linear-gradient(135deg, #C5A059, #A8853A)",
                color: "white",
                opacity: submitState === "idle" && !isFormValid ? 0.5 : 1,
              }}
            >
              {submitState === "idle" && (
                <>
                  <Sparkles size={15} />
                  Register Patient
                  {form.sendIntake && (
                    <span style={{ opacity: 0.8, fontSize: 12 }}>· Send Intake</span>
                  )}
                </>
              )}
              {submitState === "loading" && (
                <>
                  <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                  Saving to Supabase…
                </>
              )}
              {submitState === "success" && (
                <>
                  <CheckCircle2 size={15} />
                  Patient Registered!
                </>
              )}
            </button>

            <p style={{ fontSize: 11, textAlign: "center", color: "var(--text-muted)", marginTop: 10 }}>
              Record will appear in Patient Records instantly.
            </p>
          </div>
        </form>
      </aside>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>,
    document.body
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--text-muted)",
  marginBottom: 7,
};

function Required() {
  return <span style={{ color: "var(--gold)", fontSize: 13, lineHeight: 1 }}>*</span>;
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
