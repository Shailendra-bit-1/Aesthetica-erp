"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, FileText, ChevronDown, ChevronUp, CheckCircle2, Loader2, ExternalLink, File } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Patient, fmtDate } from "../types";

// ─────────────────────────────────────── Types ───────────────────────────────

interface FormResponse {
  id: string;
  form_id: string;
  submitted_at: string;
  responses: Record<string, unknown>;
  form: {
    form_type: string;
    fields: Array<{ key: string; label: string; field_type?: string }>;
  } | null;
}

interface DocumentNote {
  id: string;
  content: string;
  created_at: string;
  parsed: { url: string; filename: string; type: string } | null;
}

interface Props {
  patient: Patient;
  clinicId: string;
}

const GOLD = "#C5A059";

const FORM_TYPE_LABELS: Record<string, string> = {
  intake:   "Intake Form",
  consent:  "Consent Form",
  feedback: "Feedback",
  survey:   "Survey",
  custom:   "Custom Form",
};

const FORM_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  intake:   { bg: "rgba(59,130,246,0.1)",  text: "#1E3A8A", border: "rgba(59,130,246,0.25)" },
  consent:  { bg: "rgba(16,185,129,0.1)",  text: "#065F46", border: "rgba(16,185,129,0.25)" },
  feedback: { bg: "rgba(245,158,11,0.1)",  text: "#92400E", border: "rgba(245,158,11,0.25)" },
  survey:   { bg: "rgba(139,126,200,0.1)", text: "#4B3FA0", border: "rgba(139,126,200,0.25)" },
  custom:   { bg: "rgba(197,160,89,0.1)",  text: "#7A5518", border: "rgba(197,160,89,0.25)" },
};

function formTypeBadgeStyle(formType: string): React.CSSProperties {
  const c = FORM_TYPE_COLORS[formType] ?? FORM_TYPE_COLORS.custom;
  return {
    fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
    textTransform: "uppercase" as const, padding: "2px 8px", borderRadius: 20,
    background: c.bg, color: c.text, border: `1px solid ${c.border}`,
  };
}

function fileTypeBadgeStyle(mimeType: string): React.CSSProperties {
  const isPdf = mimeType?.includes("pdf");
  return {
    fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 6,
    background: isPdf ? "rgba(220,38,38,0.08)" : "rgba(59,130,246,0.08)",
    color: isPdf ? "#991B1B" : "#1E3A8A",
    border: `1px solid ${isPdf ? "rgba(220,38,38,0.2)" : "rgba(59,130,246,0.2)"}`,
  };
}

// ─────────────────────────────────────── Main Component ──────────────────────

export default function DocumentsTab({ patient, clinicId }: Props) {
  const [forms, setForms]         = useState<FormResponse[]>([]);
  const [docs, setDocs]           = useState<DocumentNote[]>([]);
  const [loadingForms, setLoadingForms] = useState(true);
  const [loadingDocs, setLoadingDocs]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadForms() {
    setLoadingForms(true);
    const { data, error } = await supabase
      .from("form_responses")
      .select("id, form_id, submitted_at, responses, form:form_definitions!form_id(form_type, fields)")
      .eq("patient_id", patient.id)
      .eq("clinic_id", clinicId)
      .order("submitted_at", { ascending: false });
    if (error) console.error(error);
    const rows = (data ?? []).map((r: unknown) => {
      const row = r as Record<string, unknown>;
      const formRaw = row.form;
      const form = Array.isArray(formRaw) ? (formRaw[0] ?? null) : (formRaw ?? null);
      return { ...row, form } as FormResponse;
    });
    setForms(rows);
    setLoadingForms(false);
  }

  async function loadDocs() {
    setLoadingDocs(true);
    const { data, error } = await supabase
      .from("patient_notes")
      .select("id, content, created_at")
      .eq("patient_id", patient.id)
      .eq("note_type", "document")
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    const rows: DocumentNote[] = (data ?? []).map((r: { id: string; content: string; created_at: string }) => {
      let parsed: DocumentNote["parsed"] = null;
      try { parsed = JSON.parse(r.content); } catch { /* malformed */ }
      return { ...r, parsed };
    });
    setDocs(rows);
    setLoadingDocs(false);
  }

  useEffect(() => {
    loadForms();
    loadDocs();
  }, [patient.id, clinicId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "pdf";
      const path = `${clinicId}/docs/${patient.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("patient-photos")
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage
        .from("patient-photos")
        .getPublicUrl(path);

      const { error: dbErr } = await supabase
        .from("patient_notes")
        .insert({
          patient_id: patient.id,
          note_type:  "document",
          content:    JSON.stringify({ url: urlData.publicUrl, filename: file.name, type: file.type }),
        });
      if (dbErr) throw dbErr;

      toast.success("Document uploaded");
      loadDocs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const loading = loadingForms && loadingDocs;

  return (
    <div style={{ padding: "4px 0" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(197,160,89,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FileText size={14} style={{ color: GOLD }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#2C2A26", fontFamily: "Georgia, serif" }}>
              Documents & Consents
            </h3>
            <p style={{ margin: 0, fontSize: 11, color: "#9C9584" }}>
              {forms.length} form{forms.length !== 1 ? "s" : ""} · {docs.length} document{docs.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 8,
            background: uploading ? "rgba(197,160,89,0.4)" : GOLD,
            color: "white", border: "none", cursor: uploading ? "not-allowed" : "pointer",
            fontSize: 12, fontWeight: 600,
            boxShadow: "0 1px 4px rgba(197,160,89,0.35)",
          }}
        >
          {uploading ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={13} />}
          {uploading ? "Uploading…" : "Upload Document"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          style={{ display: "none" }}
          onChange={handleUpload}
        />
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{ height: 68, borderRadius: 10, background: "rgba(197,160,89,0.07)", animation: "pulse 1.5s infinite" }} />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Submitted Forms */}
          {forms.length > 0 && (
            <section>
              <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9C9584" }}>
                Submitted Forms
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {forms.map(fr => <FormCard key={fr.id} fr={fr} />)}
              </div>
            </section>
          )}

          {/* Uploaded Documents */}
          {docs.length > 0 && (
            <section>
              <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9C9584" }}>
                Uploaded Files
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {docs.map(doc => <DocCard key={doc.id} doc={doc} />)}
              </div>
            </section>
          )}

          {forms.length === 0 && docs.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px", background: "rgba(197,160,89,0.04)", borderRadius: 12, border: "1px dashed rgba(197,160,89,0.25)" }}>
              <FileText size={28} style={{ color: "rgba(197,160,89,0.4)", marginBottom: 10 }} />
              <p style={{ margin: 0, fontSize: 13, color: "#9C9584", fontFamily: "Georgia, serif" }}>No documents on file</p>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "#BDB6A8" }}>Submitted intake/consent forms and uploaded documents will appear here</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────── Form Card ───────────────────────────

function FormCard({ fr }: { fr: FormResponse }) {
  const [expanded, setExpanded] = useState(false);
  const formType = fr.form?.form_type ?? "custom";
  const label    = FORM_TYPE_LABELS[formType] ?? "Form";
  const fields   = fr.form?.fields ?? [];

  const responseEntries = Object.entries(fr.responses ?? {}).filter(([, v]) => v !== null && v !== "" && v !== undefined);

  return (
    <div style={{ background: "white", borderRadius: 10, border: "1px solid rgba(197,160,89,0.15)", overflow: "hidden" }}>
      <div
        onClick={() => setExpanded(x => !x)}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer", userSelect: "none" }}
      >
        <CheckCircle2 size={15} style={{ color: "#10B981", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#2C2A26", fontFamily: "Georgia, serif" }}>{label}</span>
            <span style={formTypeBadgeStyle(formType)}>{label}</span>
          </div>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9C9584" }}>
            Submitted {fmtDate(fr.submitted_at)} · {responseEntries.length} field{responseEntries.length !== 1 ? "s" : ""}
          </p>
        </div>
        {expanded ? <ChevronUp size={14} style={{ color: "#9C9584", flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: "#9C9584", flexShrink: 0 }} />}
      </div>

      {expanded && responseEntries.length > 0 && (
        <div style={{ padding: "0 14px 14px", borderTop: "1px solid rgba(197,160,89,0.1)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "10px 16px", paddingTop: 12 }}>
            {responseEntries.map(([key, value]) => {
              const fieldDef = fields.find(f => f.key === key);
              const label = fieldDef?.label ?? key.replace(/_/g, " ");
              const displayVal = Array.isArray(value) ? value.join(", ") : String(value ?? "—");
              return (
                <div key={key}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9C9584" }}>{label}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#3C3830", fontFamily: "Georgia, serif" }}>{displayVal}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────── Doc Card ────────────────────────────

function DocCard({ doc }: { doc: DocumentNote }) {
  if (!doc.parsed) return null;
  const { url, filename, type: mimeType } = doc.parsed;
  const shortName = filename.length > 40 ? filename.slice(0, 37) + "…" : filename;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "white", borderRadius: 10, border: "1px solid rgba(197,160,89,0.15)" }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(197,160,89,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <File size={16} style={{ color: GOLD }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#2C2A26", fontFamily: "Georgia, serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {shortName}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
          <span style={fileTypeBadgeStyle(mimeType)}>{mimeType?.split("/")[1]?.toUpperCase() ?? "FILE"}</span>
          <span style={{ fontSize: 10, color: "#BDB6A8" }}>{fmtDate(doc.created_at)}</span>
        </div>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 7, border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.06)", color: GOLD, fontSize: 11, fontWeight: 600, textDecoration: "none", flexShrink: 0 }}
      >
        <ExternalLink size={11} />
        Open
      </a>
    </div>
  );
}
