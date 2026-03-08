"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Sparkles,
  User,
  Phone,
  Mail,
  Stethoscope,
  Lock,
  ChevronDown,
  FileText,
  AlertCircle,
  Loader2,
  Syringe,
  Clock,
  AlertTriangle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Specialist {
  id: string;
  full_name: string;
  role: string;
}

interface ClinicInfo {
  id: string;
  name: string;
  location: string | null;
}

const CONCERNS = [
  "Botox & Wrinkle Relaxers",
  "Dermal Fillers",
  "Skin Rejuvenation",
  "Laser Treatment",
  "Chemical Peel",
  "Microneedling",
  "IV Therapy",
  "PRP Therapy",
  "Thread Lift",
  "Hair Restoration",
  "Acne & Scarring",
  "Consultation Only",
];

const ROLE_LABEL: Record<string, string> = {
  doctor:      "MD",
  nurse:       "RN",
  therapist:   "Therapist",
  counsellor:  "Counsellor",
};

// ── Dynamic form types ──────────────────────────────────────────────────────────
type FieldType = "text" | "number" | "date" | "dropdown" | "checkbox" | "textarea" | "section_header";
interface FormField {
  id: string; type: FieldType; label: string;
  required?: boolean; placeholder?: string; options?: string[];
}
interface FormDefinition {
  id: string; clinic_id: string; name: string; form_type: string; fields: FormField[];
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function IntakePage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <IntakePageInner />
    </Suspense>
  );
}

function IntakePageInner() {
  const params       = useParams();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const clinicId     = params.clinicId as string;
  const formId       = searchParams.get("form");
  const refCode      = searchParams.get("ref");
  // B14: UTM tracking from URL
  const utmSource    = searchParams.get("utm_source")   ?? undefined;
  const utmMedium    = searchParams.get("utm_medium")   ?? undefined;
  const utmCampaign  = searchParams.get("utm_campaign") ?? undefined;

  // Remote data
  const [clinic,     setClinic]     = useState<ClinicInfo | null>(null);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [notFound,    setNotFound]    = useState(false);

  // Form state
  const [fullName,   setFullName]   = useState("");
  const [phone,      setPhone]      = useState("");
  const [email,      setEmail]      = useState("");
  const [specialist, setSpecialist] = useState("");
  const [concerns,   setConcerns]   = useState<string[]>([]);
  const [notes,      setNotes]      = useState("");

  // Injection history conditional (shown for Botox OR Fillers)
  const [hadBotoxBefore,         setHadBotoxBefore]         = useState<boolean | null>(null);
  const [lastInjectionDate,      setLastInjectionDate]      = useState("");
  const [injectionComplications, setInjectionComplications] = useState("");

  // Dynamic form state (B2/B3 fix)
  const [formDef,       setFormDef]       = useState<FormDefinition | null>(null);
  const [dynamicValues, setDynamicValues] = useState<Record<string, string | string[] | boolean>>({});

  // N12: Custom field definitions
  const [customFieldDefs, setCustomFieldDefs] = useState<Array<{ id: string; field_key: string; field_label: string; field_type: string; options: string[] | null; validation: { required?: boolean } | null }>>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  // C8: Clinic branding
  const [brandColor, setBrandColor] = useState("#0B2A4A");
  const [brandLogo, setBrandLogo]   = useState<string | null>(null);
  const [brandName, setBrandName]   = useState<string | null>(null);

  useEffect(() => {
    if (!clinicId) return;
    fetch(`/api/branding?clinic_id=${clinicId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.primary_color) setBrandColor(d.primary_color);
        if (d?.logo_url)      setBrandLogo(d.logo_url);
        if (d?.app_name)      setBrandName(d.app_name);
      })
      .catch(() => {});
  }, [clinicId]);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const showInjectionHistory =
    concerns.includes("Botox & Wrinkle Relaxers") ||
    concerns.includes("Dermal Fillers");

  // ── Fetch clinic data ──────────────────────────────────────────────────────
  const fetchClinic = useCallback(async () => {
    try {
      const res = await fetch(`/api/intake/clinic/${clinicId}`);
      if (!res.ok) { setNotFound(true); return; }
      const data = await res.json();
      setClinic(data.clinic);
      setSpecialists(data.specialists ?? []);
    } catch {
      setNotFound(true);
    } finally {
      setLoadingPage(false);
    }
  }, [clinicId]);

  useEffect(() => { fetchClinic(); }, [fetchClinic]);

  // N12: Fetch clinic's custom field definitions for patients
  useEffect(() => {
    if (!clinicId) return;
    fetch(`/api/intake/clinic/${clinicId}`)
      .then(() => {}) // already handled by fetchClinic
      .catch(() => {});
    // Fetch custom fields directly from public API
    fetch(`/api/intake/custom-fields?clinicId=${clinicId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (Array.isArray(data?.fields)) setCustomFieldDefs(data.fields); })
      .catch(() => {});
  }, [clinicId]);

  // Fetch dynamic form definition if ?form= param present (B2/B3 fix)
  useEffect(() => {
    if (!formId) return;
    fetch(`/api/intake/form/${formId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.fields) setFormDef(data); })
      .catch(() => {});
  }, [formId]);

  // Reset injection history fields when the trigger concerns are removed
  useEffect(() => {
    if (!showInjectionHistory) {
      setHadBotoxBefore(null);
      setLastInjectionDate("");
      setInjectionComplications("");
    }
  }, [showInjectionHistory]);

  // ── Concern toggle ─────────────────────────────────────────────────────────
  function toggleConcern(c: string) {
    setConcerns((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }

  // ── Phone formatter ────────────────────────────────────────────────────────
  function handlePhone(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 10);
    if (!digits) { setPhone(""); return; }
    if (digits.length < 4) { setPhone(`(${digits}`); return; }
    if (digits.length < 7) { setPhone(`(${digits.slice(0, 3)}) ${digits.slice(3)}`); return; }
    setPhone(`(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`);
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setSubmitting(true);
    setSubmitError(null);

    try {
      let endpoint: string;
      let payload: Record<string, unknown>;

      if (formDef) {
        // Dynamic form submission (B2/B3 fix)
        const requiredMissing = formDef.fields
          .filter(f => f.required && f.type !== "section_header")
          .some(f => !dynamicValues[f.id]);
        if (requiredMissing) {
          setSubmitError("Please fill in all required fields.");
          setSubmitting(false);
          return;
        }
        endpoint = "/api/intake/form-submit";
        payload  = { formId: formDef.id, clinicId, responses: dynamicValues };
      } else {
        // Default hardcoded form submission
        if (!fullName.trim() || !phone.trim() || concerns.length === 0) {
          setSubmitting(false); return;
        }
        endpoint = "/api/intake/submit";
        payload  = {
          clinicId,
          fullName: fullName.trim(),
          phone:    phone.trim(),
          email:    email.trim() || undefined,
          preferredSpecialist: specialist || undefined,
          concerns,
          hadPriorInjections:     showInjectionHistory ? hadBotoxBefore : null,
          lastInjectionDate:      showInjectionHistory && hadBotoxBefore ? lastInjectionDate      : undefined,
          injectionComplications: showInjectionHistory && hadBotoxBefore ? injectionComplications : undefined,
          notes: notes.trim() || undefined,
          customFieldAnswers: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
          referralCode: refCode || undefined,
          // B14: UTM params
          utmSource,
          utmMedium,
          utmCampaign,
        };
      }

      const res  = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setSubmitError(data.error || "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      const displayName = formDef
        ? String(dynamicValues["full_name"] ?? dynamicValues["name"] ?? "")
        : fullName.trim();
      router.push(`/intake/${clinicId}/welcome?name=${encodeURIComponent(displayName)}`);
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
      setSubmitting(false);
    }
  }

  const isValid = formDef
    ? formDef.fields.filter(f => f.required && f.type !== "section_header").every(f => !!dynamicValues[f.id])
    : !!fullName.trim() && !!phone.trim() && concerns.length > 0;

  // ── Loading / 404 states ───────────────────────────────────────────────────
  if (loadingPage) return <LoadingScreen />;
  if (notFound)    return <NotFoundScreen />;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideDown {
          from { opacity: 0; max-height: 0; transform: translateY(-8px); }
          to   { opacity: 1; max-height: 600px; transform: translateY(0); }
        }
        @keyframes pulse-brand {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--brand) 35%, transparent); }
          50%       { box-shadow: 0 0 0 8px transparent; }
        }
        .intake-input:focus {
          outline: none;
          border-color: var(--brand) !important;
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 12%, transparent) !important;
        }
        .concern-pill:hover {
          border-color: color-mix(in srgb, var(--brand) 50%, transparent) !important;
          background: color-mix(in srgb, var(--brand) 6%, transparent) !important;
        }
        .submit-btn:not(:disabled):hover {
          opacity: 0.92;
          transform: translateY(-1px);
          box-shadow: 0 6px 24px color-mix(in srgb, var(--brand) 45%, transparent) !important;
        }
        .submit-btn { transition: all 0.2s ease; }
      `}</style>

      {/* ── Full-page background — brand-aware ── */}
      <div
        className="min-h-screen flex flex-col items-center justify-start py-12 px-4"
        style={{
          ["--brand" as string]: brandColor,
          background: "#F7F9FC",
          backgroundImage: `
            repeating-linear-gradient(
              45deg,
              transparent,
              transparent 20px,
              rgba(197,160,89,0.025) 20px,
              rgba(197,160,89,0.025) 21px
            )
          `,
        }}
      >
        {/* ── Card ── */}
        <div
          className="w-full"
          style={{
            maxWidth: 580,
            background: "white",
            border: "1px solid rgba(197,160,89,0.45)",
            borderRadius: 20,
            boxShadow: "0 8px 48px rgba(28,25,23,0.10), 0 2px 8px rgba(28,25,23,0.06)",
            animation: "fadeUp 0.5s ease forwards",
          }}
        >
          {/* ── Gold top bar ── */}
          <div
            style={{
              height: 4,
              borderRadius: "20px 20px 0 0",
              background: "linear-gradient(90deg, #C5A059, #A8853A, #C5A059)",
            }}
          />

          {/* ── Clinic Header ── */}
          <div className="px-8 pt-8 pb-6" style={{ borderBottom: "1px solid rgba(197,160,89,0.12)" }}>
            <div className="flex items-center gap-3 mb-1">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(197,160,89,0.12)", border: "1px solid rgba(197,160,89,0.3)" }}
              >
                <Sparkles size={18} style={{ color: "var(--gold, #C5A059)" }} />
              </div>
              <div>
                <h1
                  className="text-xl font-semibold leading-tight"
                  style={{ color: "#1C1917", fontFamily: "Georgia, serif" }}
                >
                  {clinic?.name ?? "Aesthetica Clinic"}
                </h1>
                <p className="text-xs mt-0.5" style={{ color: "#9C9584" }}>
                  Digital Patient Intake
                </p>
              </div>
            </div>
          </div>

          {/* ── Form ── */}
          <form onSubmit={handleSubmit} noValidate>
            <div className="px-8 py-7 space-y-7">

              {/* ─── DYNAMIC FORM (B2/B3 fix: renders when ?form= param is present) ─── */}
              {formDef ? (
                <>
                  {formDef.fields.map(field => {
                    if (field.type === "section_header") {
                      return <SectionHeader key={field.id} label={field.label} />;
                    }
                    const val = dynamicValues[field.id];
                    const setVal = (v: string | string[] | boolean) =>
                      setDynamicValues(prev => ({ ...prev, [field.id]: v }));
                    return (
                      <div key={field.id}>
                        <label style={{ ...labelStyle, display: "flex", gap: 4, marginBottom: 7 }}>
                          {field.label}
                          {field.required && <span style={{ color: "#C5A059" }}>*</span>}
                        </label>
                        {field.type === "textarea" ? (
                          <textarea rows={3} placeholder={field.placeholder} value={String(val ?? "")}
                            onChange={e => setVal(e.target.value)} className="intake-input"
                            style={{ ...inputStyle, resize: "none", display: "block", padding: "10px 14px", lineHeight: 1.6, boxSizing: "border-box" }} />
                        ) : field.type === "dropdown" ? (
                          <select value={String(val ?? "")} onChange={e => setVal(e.target.value)}
                            className="intake-input" style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
                            <option value="">Select…</option>
                            {(field.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : field.type === "checkbox" ? (
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={!!val} onChange={e => setVal(e.target.checked)}
                              style={{ width: 18, height: 18, accentColor: "#C5A059", cursor: "pointer" }} />
                            <span style={{ fontSize: 13, color: "#1C1917" }}>{field.placeholder || field.label}</span>
                          </label>
                        ) : (
                          <input type={field.type} placeholder={field.placeholder}
                            value={String(val ?? "")} onChange={e => setVal(e.target.value)}
                            className="intake-input" style={inputStyle} />
                        )}
                      </div>
                    );
                  })}
                </>
              ) : (
              <>
              {/* ─── SECTION 1: Identity ─── */}
              <SectionHeader label="Your Details" />

              {/* Full Name */}
              <FieldGroup icon={<User size={13} color="#C5A059" />} label="Full Name" required>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sophia Laurent"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="intake-input"
                  style={inputStyle}
                />
              </FieldGroup>

              {/* Phone */}
              <FieldGroup icon={<Phone size={13} color="#C5A059" />} label="Phone Number" required>
                <input
                  type="tel"
                  required
                  placeholder="(555) 000-0000"
                  value={phone}
                  onChange={(e) => handlePhone(e.target.value)}
                  className="intake-input"
                  style={inputStyle}
                />
              </FieldGroup>

              {/* Email (optional) */}
              <FieldGroup
                icon={<Mail size={13} color="#C5A059" />}
                label="Email Address"
                badge={
                  <span
                    className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(197,160,89,0.08)", color: "#9C9584", border: "1px solid rgba(197,160,89,0.2)" }}
                  >
                    <Lock size={9} />
                    Privacy Guaranteed
                  </span>
                }
                hint="Optional — used only for your care follow-up"
              >
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="intake-input"
                  style={inputStyle}
                />
              </FieldGroup>

              {/* ─── SECTION 2: Specialist ─── */}
              <SectionDivider />
              <SectionHeader label="Your Specialist" />

              <FieldGroup icon={<Stethoscope size={13} color="#C5A059" />} label="Preferred Specialist">
                <div className="relative">
                  <select
                    value={specialist}
                    onChange={(e) => setSpecialist(e.target.value)}
                    className="intake-input"
                    style={{ ...inputStyle, appearance: "none", paddingRight: 36, cursor: "pointer" }}
                  >
                    <option value="">No preference — any available specialist</option>
                    {specialists.length > 0 ? (
                      specialists.map((s) => (
                        <option key={s.id} value={s.full_name}>
                          {s.full_name}{ROLE_LABEL[s.role] ? ` — ${ROLE_LABEL[s.role]}` : ""}
                        </option>
                      ))
                    ) : (
                      <option disabled value="">No specialists on record</option>
                    )}
                  </select>
                  <ChevronDown
                    size={14}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#9C9584" }}
                  />
                </div>
              </FieldGroup>

              {/* ─── SECTION 3: Medical Intent ─── */}
              <SectionDivider />
              <SectionHeader label="Medical Intent" />

              <div>
                <label style={labelStyle}>
                  <Sparkles size={13} color="#C5A059" />
                  Primary Concern{" "}
                  <span style={{ color: "#C5A059" }}>*</span>
                  <span className="ml-auto text-xs font-normal" style={{ color: "#B8AE9C", letterSpacing: 0, textTransform: "none" }}>
                    Select all that apply
                  </span>
                </label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {CONCERNS.map((c) => {
                    const sel = concerns.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleConcern(c)}
                        className="concern-pill"
                        style={{
                          padding: "7px 14px",
                          borderRadius: 999,
                          fontSize: 13,
                          fontFamily: "Georgia, serif",
                          cursor: "pointer",
                          transition: "all 0.18s",
                          border: sel ? "1.5px solid rgba(197,160,89,0.7)" : "1.5px solid rgba(197,160,89,0.2)",
                          background: sel ? "rgba(197,160,89,0.12)" : "rgba(249,247,242,0.8)",
                          color: sel ? "#1C1917" : "#6B6358",
                          fontWeight: sel ? 600 : 400,
                        }}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
                {concerns.length === 0 && (
                  <p className="text-xs mt-2" style={{ color: "rgba(156,149,132,0.7)" }}>
                    Please select at least one concern to continue
                  </p>
                )}
              </div>

              {/* ─── SECTION 4: Botox Conditional ─── */}
              {showInjectionHistory && (
                <div
                  style={{
                    animation: "slideDown 0.35s ease forwards",
                    overflow: "hidden",
                    borderRadius: 16,
                    border: "1px solid rgba(197,160,89,0.3)",
                    background: "rgba(249,247,242,0.7)",
                    padding: "20px 22px",
                  }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(197,160,89,0.15)" }}
                    >
                      <Syringe size={13} style={{ color: "#C5A059" }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#1C1917", fontFamily: "Georgia, serif" }}>
                        Previous Injection History
                      </p>
                      <p className="text-xs" style={{ color: "#9C9584" }}>
                        This helps your specialist personalise your treatment safely
                      </p>
                    </div>
                  </div>

                  {/* Yes / No toggle */}
                  <div className="mb-4">
                    <label style={{ ...labelStyle, marginBottom: 8 }}>
                      Have you had Botox or fillers before?
                    </label>
                    <div className="flex gap-2">
                      {[
                        { val: true,  text: "Yes, I have" },
                        { val: false, text: "No, first time" },
                      ].map((opt) => (
                        <button
                          key={String(opt.val)}
                          type="button"
                          onClick={() => setHadBotoxBefore(opt.val)}
                          style={{
                            flex: 1,
                            padding: "9px 0",
                            borderRadius: 10,
                            fontSize: 13,
                            fontFamily: "Georgia, serif",
                            fontWeight: hadBotoxBefore === opt.val ? 600 : 400,
                            cursor: "pointer",
                            transition: "all 0.18s",
                            border: hadBotoxBefore === opt.val ? "1.5px solid rgba(197,160,89,0.7)" : "1.5px solid rgba(197,160,89,0.2)",
                            background: hadBotoxBefore === opt.val ? "rgba(197,160,89,0.12)" : "white",
                            color: hadBotoxBefore === opt.val ? "#1C1917" : "#6B6358",
                          }}
                        >
                          {opt.text}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Expanded detail fields when "Yes" */}
                  {hadBotoxBefore === true && (
                    <div className="space-y-4">
                      <div>
                        <label style={labelStyle}>
                          <Clock size={11} color="#C5A059" />
                          When was your last treatment?
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 6 months ago, January 2025…"
                          value={lastInjectionDate}
                          onChange={(e) => setLastInjectionDate(e.target.value)}
                          className="intake-input"
                          style={{ ...inputStyle, background: "white" }}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>
                          <AlertTriangle size={11} color="#C5A059" />
                          Any previous complications or reactions?
                        </label>
                        <textarea
                          rows={2}
                          placeholder="e.g. Bruising at site, asymmetry, allergic reaction — or leave blank if none"
                          value={injectionComplications}
                          onChange={(e) => setInjectionComplications(e.target.value)}
                          className="intake-input"
                          style={{
                            ...inputStyle,
                            background: "white",
                            padding: "10px 14px",
                            resize: "none",
                            lineHeight: 1.6,
                            display: "block",
                            width: "100%",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─── SECTION 5: Notes ─── */}
              <SectionDivider />
              <SectionHeader label="Notes for Your Doctor" />

              <FieldGroup
                icon={<FileText size={13} color="#C5A059" />}
                label="Specific Requests"
                hint="Anything you'd like the doctor to know before your consultation"
              >
                <textarea
                  rows={3}
                  placeholder="Allergies, sensitivities, desired outcomes, questions for the doctor…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="intake-input"
                  style={{
                    ...inputStyle,
                    padding: "10px 14px",
                    resize: "none",
                    lineHeight: 1.65,
                    display: "block",
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                />
              </FieldGroup>

              </> /* end default form else */
              )} {/* end formDef ternary */}

              {/* N12: Custom fields from clinic config */}
              {!formDef && customFieldDefs.length > 0 && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(197,160,89,0.12)" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9CA3AF", marginBottom: 12 }}>
                    Additional Information
                  </p>
                  {customFieldDefs.map(cf => (
                    <div key={cf.id} style={{ marginBottom: 14 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#4b5563", marginBottom: 6 }}>
                        {cf.field_label}{cf.validation?.required ? " *" : ""}
                      </label>
                      {cf.field_type === "select" && cf.options ? (
                        <select value={customFieldValues[cf.field_key] ?? ""}
                          onChange={e => setCustomFieldValues(v => ({ ...v, [cf.field_key]: e.target.value }))}
                          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(197,160,89,0.25)", fontSize: 14, background: "#fff", color: "#1a1714", outline: "none" }}>
                          <option value="">Select…</option>
                          {cf.options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : cf.field_type === "textarea" ? (
                        <textarea rows={3} value={customFieldValues[cf.field_key] ?? ""}
                          onChange={e => setCustomFieldValues(v => ({ ...v, [cf.field_key]: e.target.value }))}
                          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(197,160,89,0.25)", fontSize: 14, background: "#fff", color: "#1a1714", outline: "none", resize: "none", boxSizing: "border-box" }} />
                      ) : (
                        <input type={cf.field_type === "number" ? "number" : "text"}
                          value={customFieldValues[cf.field_key] ?? ""}
                          onChange={e => setCustomFieldValues(v => ({ ...v, [cf.field_key]: e.target.value }))}
                          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(197,160,89,0.25)", fontSize: 14, background: "#fff", color: "#1a1714", outline: "none", boxSizing: "border-box" }} />
                      )}
                    </div>
                  ))}
                </div>
              )}

            </div>

            {/* ── Sticky footer ── */}
            <div
              className="px-8 pt-5 pb-8"
              style={{ borderTop: "1px solid rgba(197,160,89,0.12)" }}
            >
              {/* Error */}
              {submitError && (
                <div
                  className="flex items-start gap-3 p-3.5 rounded-xl mb-4"
                  style={{ background: "rgba(180,60,60,0.06)", border: "1px solid rgba(180,60,60,0.2)" }}
                >
                  <AlertCircle size={15} style={{ color: "#B43C3C", flexShrink: 0, marginTop: 1 }} />
                  <p className="text-xs" style={{ color: "#B43C3C", lineHeight: 1.5 }}>{submitError}</p>
                </div>
              )}

              {/* CTA */}
              <button
                type="submit"
                disabled={!isValid || submitting}
                className="submit-btn w-full"
                style={{
                  padding: "15px 0",
                  borderRadius: 14,
                  fontSize: 15,
                  fontWeight: 600,
                  fontFamily: "Georgia, serif",
                  border: "none",
                  cursor: !isValid || submitting ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  background: !isValid || submitting
                    ? "rgba(197,160,89,0.35)"
                    : "linear-gradient(135deg, #C5A059 0%, #A8853A 50%, #C5A059 100%)",
                  backgroundSize: "200% 100%",
                  color: "white",
                  letterSpacing: "0.02em",
                  boxShadow: !isValid || submitting ? "none" : "0 4px 18px rgba(197,160,89,0.35)",
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Enter the Clinic
                  </>
                )}
              </button>

              <p className="text-xs text-center mt-3" style={{ color: "#B8AE9C" }}>
                Your information is encrypted and only visible to your care team.
              </p>
            </div>
          </form>
        </div>

        {/* ── Footer watermark ── */}
        <p className="text-xs mt-6" style={{ color: "rgba(156,149,132,0.5)", letterSpacing: "0.05em" }}>
          Powered by Aesthetica Clinic Suite · 2026
        </p>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <p
        className="text-xs uppercase tracking-widest font-semibold"
        style={{ color: "#9C9584", letterSpacing: "0.12em" }}
      >
        {label}
      </p>
      <div className="flex-1 h-px" style={{ background: "rgba(197,160,89,0.15)" }} />
    </div>
  );
}

function SectionDivider() {
  return <div className="h-px" style={{ background: "rgba(197,160,89,0.1)", margin: "0 -2px" }} />;
}

function FieldGroup({
  icon,
  label,
  required,
  hint,
  badge,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  required?: boolean;
  hint?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          marginBottom: 7,
          flexWrap: "wrap",
        }}
      >
        {icon}
        <span style={labelStyle}>
          {label}
          {required && <span style={{ color: "#C5A059", marginLeft: 2 }}>*</span>}
        </span>
        {badge && <span style={{ marginLeft: "auto" }}>{badge}</span>}
      </label>
      {hint && (
        <p className="text-xs mb-2" style={{ color: "#B8AE9C" }}>{hint}</p>
      )}
      {children}
    </div>
  );
}

function LoadingScreen() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#F9F7F2" }}
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(197,160,89,0.15)", border: "1px solid rgba(197,160,89,0.3)" }}
        >
          <Sparkles size={20} style={{ color: "#C5A059" }} />
        </div>
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "rgba(197,160,89,0.5)", borderTopColor: "transparent" }} />
        <p className="text-sm" style={{ color: "#9C9584", fontFamily: "Georgia, serif" }}>
          Preparing your intake form…
        </p>
      </div>
    </div>
  );
}

function NotFoundScreen() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#F9F7F2" }}
    >
      <div
        className="text-center p-12 rounded-2xl"
        style={{
          background: "white",
          border: "1px solid rgba(197,160,89,0.2)",
          maxWidth: 400,
        }}
      >
        <AlertCircle size={40} style={{ color: "rgba(197,160,89,0.5)", margin: "0 auto 16px" }} />
        <h2 className="text-lg font-semibold mb-2" style={{ color: "#1C1917", fontFamily: "Georgia, serif" }}>
          Clinic Not Found
        </h2>
        <p className="text-sm" style={{ color: "#9C9584" }}>
          This intake link may have expired or is invalid. Please ask the clinic for a new link.
        </p>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 12,
  fontSize: 14,
  fontFamily: "Georgia, serif",
  background: "#FDFCF9",
  border: "1px solid rgba(197,160,89,0.25)",
  color: "#1C1917",
  transition: "border-color 0.2s, box-shadow 0.2s",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontFamily: "Georgia, serif",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.09em",
  color: "#6B6358",
};
