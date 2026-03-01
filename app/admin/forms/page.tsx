"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import TopBar from "@/components/TopBar";
import { FormInput, Plus, X, GripVertical, Copy, Trash2, Eye, EyeOff, Link, Check } from "lucide-react";

type FieldType = "text" | "number" | "date" | "dropdown" | "checkbox" | "textarea" | "signature" | "file" | "section_header";
type FormType = "intake" | "consent" | "feedback" | "survey" | "custom";

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

interface FormDefinition {
  id: string;
  name: string;
  form_type: FormType;
  fields: FormField[];
  is_active: boolean;
  created_at: string;
}

const FIELD_PALETTE: Array<{ type: FieldType; label: string; icon: string }> = [
  { type: "text", label: "Text Input", icon: "T" },
  { type: "number", label: "Number", icon: "#" },
  { type: "date", label: "Date", icon: "📅" },
  { type: "dropdown", label: "Dropdown", icon: "▼" },
  { type: "checkbox", label: "Checkbox", icon: "☑" },
  { type: "textarea", label: "Text Area", icon: "¶" },
  { type: "signature", label: "Signature", icon: "✍" },
  { type: "file", label: "File Upload", icon: "📎" },
  { type: "section_header", label: "Section Header", icon: "H" },
];

const FORM_TYPE_LABELS: Record<FormType, string> = {
  intake: "Intake", consent: "Consent", feedback: "Feedback", survey: "Survey", custom: "Custom",
};

function genId() { return Math.random().toString(36).slice(2, 10); }

export default function FormsPage() {
  const { profile, activeClinicId } = useClinic();

  const [forms, setForms] = useState<FormDefinition[]>([]);
  const [selected, setSelected] = useState<FormDefinition | null>(null);
  const [creating, setCreating] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    name: "", form_type: "intake" as FormType, fields: [] as FormField[],
  });
  const [selectedFieldIdx, setSelectedFieldIdx] = useState<number | null>(null);

  const clinicId = activeClinicId || profile?.clinic_id;

  const fetchForms = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase.from("form_definitions").select("*")
      .eq("clinic_id", clinicId).order("created_at", { ascending: false });
    setForms((data as FormDefinition[]) || []);
  }, [clinicId, supabase]);

  useEffect(() => {
    if (!clinicId) return;
    setLoading(true);
    fetchForms().finally(() => setLoading(false));
  }, [clinicId, fetchForms]);

  const startNew = () => {
    setSelected(null);
    setForm({ name: "", form_type: "intake", fields: [] });
    setSelectedFieldIdx(null);
    setCreating(true);
    setPreviewMode(false);
  };

  const loadForm = (f: FormDefinition) => {
    setSelected(f);
    setForm({ name: f.name, form_type: f.form_type, fields: [...f.fields] });
    setSelectedFieldIdx(null);
    setCreating(true);
    setPreviewMode(false);
  };

  const saveForm = async () => {
    if (!clinicId || !form.name) return;
    setSaving(true);
    const payload = {
      clinic_id: clinicId, name: form.name, form_type: form.form_type, fields: form.fields, created_by: profile?.id,
    };
    if (selected?.id) {
      await supabase.from("form_definitions").update(payload).eq("id", selected.id);
    } else {
      await supabase.from("form_definitions").insert(payload);
    }
    setSaving(false);
    fetchForms();
  };

  const deleteForm = async (id: string) => {
    if (!confirm("Delete this form?")) return;
    await supabase.from("form_definitions").delete().eq("id", id);
    if (selected?.id === id) { setSelected(null); setCreating(false); }
    fetchForms();
  };

  const addField = (type: FieldType) => {
    const newField: FormField = { id: genId(), type, label: type === "section_header" ? "Section" : `New ${type}`, required: false };
    if (type === "dropdown") newField.options = ["Option 1", "Option 2"];
    setForm(f => ({ ...f, fields: [...f.fields, newField] }));
    setSelectedFieldIdx(form.fields.length);
  };

  const updateField = (idx: number, updates: Partial<FormField>) => {
    setForm(f => { const fields = [...f.fields]; fields[idx] = { ...fields[idx], ...updates }; return { ...f, fields }; });
  };

  const removeField = (idx: number) => {
    setForm(f => ({ ...f, fields: f.fields.filter((_, i) => i !== idx) }));
    setSelectedFieldIdx(null);
  };

  const copyLink = () => {
    if (!selected?.id || !clinicId) return;
    const url = `${window.location.origin}/intake/${clinicId}?form=${selected.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedField = selectedFieldIdx !== null ? form.fields[selectedFieldIdx] : null;

  return (
    <div className="flex flex-col h-screen" style={{ background: "#F9F7F2" }}>
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL */}
        <div className="w-64 flex-shrink-0 flex flex-col" style={{ background: "#fff", borderRight: "1px solid rgba(197,160,89,0.15)" }}>
          <div className="flex justify-between items-center px-4 py-4" style={{ borderBottom: "1px solid rgba(197,160,89,0.1)" }}>
            <h3 className="font-semibold text-sm" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Forms</h3>
            <button onClick={startNew} className="p-1.5 rounded-lg hover:bg-amber-50"><Plus size={16} style={{ color: "var(--gold)" }} /></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-3 space-y-2 animate-pulse">{[1,2,3].map(n => <div key={n} className="h-14 rounded-lg" style={{ background: "rgba(197,160,89,0.06)" }} />)}</div>
            ) : forms.length === 0 ? (
              <div className="p-6 text-center"><FormInput size={28} className="mx-auto mb-2 opacity-20" style={{ color: "var(--gold)" }} /><p className="text-sm" style={{ color: "#9ca3af" }}>No forms yet</p></div>
            ) : forms.map(f => (
              <button key={f.id} onClick={() => loadForm(f)}
                className="w-full text-left px-4 py-3 flex items-start justify-between hover:bg-amber-50/50 transition-colors"
                style={{ borderBottom: "1px solid rgba(197,160,89,0.06)", background: selected?.id === f.id ? "rgba(197,160,89,0.06)" : "transparent" }}>
                <div className="flex-1 min-w-0 mr-2">
                  <p className="text-sm font-medium truncate" style={{ color: "#1a1714", fontFamily: "Georgia, serif" }}>{f.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>{FORM_TYPE_LABELS[f.form_type]} · {f.fields?.length || 0} fields</p>
                </div>
                <button onClick={e => { e.stopPropagation(); deleteForm(f.id); }} className="p-1 hover:bg-red-50 rounded mt-0.5">
                  <Trash2 size={12} style={{ color: "#ef4444" }} />
                </button>
              </button>
            ))}
          </div>
        </div>

        {/* CENTER — Canvas */}
        {!creating ? (
          <div className="flex-1 flex items-center justify-center" style={{ color: "rgba(197,160,89,0.4)" }}>
            <div className="text-center">
              <FormInput size={48} className="mx-auto mb-3 opacity-30" />
              <p style={{ fontFamily: "Georgia, serif" }}>Select a form or create a new one</p>
              <button onClick={startNew} className="mt-4 px-6 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "var(--gold)" }}>New Form</button>
            </div>
          </div>
        ) : (
          <>
            {/* Field palette + canvas */}
            <div className="flex flex-1 overflow-hidden">
              {/* Palette */}
              {!previewMode && (
                <div className="w-48 flex-shrink-0 p-3 overflow-y-auto" style={{ borderRight: "1px solid rgba(197,160,89,0.1)", background: "#faf9f6" }}>
                  <p className="text-xs font-medium mb-2 px-1" style={{ color: "rgba(197,160,89,0.7)", letterSpacing: "0.05em" }}>FIELDS</p>
                  {FIELD_PALETTE.map(fp => (
                    <button key={fp.type} onClick={() => addField(fp.type)}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm mb-1 flex items-center gap-2 hover:bg-amber-50 transition-colors"
                      style={{ color: "#4b5563" }}>
                      <span className="text-base w-5 text-center">{fp.icon}</span>
                      <span className="text-xs">{fp.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Canvas */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid rgba(197,160,89,0.1)", background: "#fff" }}>
                  <div className="flex items-center gap-3">
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Form Name" className="font-semibold border-b outline-none bg-transparent text-sm"
                      style={{ color: "#1a1714", fontFamily: "Georgia, serif", borderColor: "rgba(197,160,89,0.3)", paddingBottom: 2 }} />
                    <select value={form.form_type} onChange={e => setForm(f => ({ ...f, form_type: e.target.value as FormType }))}
                      className="text-xs px-2 py-1 rounded border bg-white outline-none"
                      style={{ borderColor: "rgba(197,160,89,0.3)" }}>
                      {Object.entries(FORM_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    {selected?.id && (
                      <button onClick={copyLink} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border"
                        style={{ borderColor: "rgba(197,160,89,0.3)", color: copied ? "#16a34a" : "var(--gold)" }}>
                        {copied ? <><Check size={12} /> Copied!</> : <><Link size={12} /> Get Link</>}
                      </button>
                    )}
                    <button onClick={() => setPreviewMode(p => !p)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border"
                      style={{ borderColor: "rgba(197,160,89,0.3)", color: "var(--gold)" }}>
                      {previewMode ? <><EyeOff size={12} /> Edit</> : <><Eye size={12} /> Preview</>}
                    </button>
                    <button onClick={saveForm} disabled={saving || !form.name}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                      style={{ background: "var(--gold)" }}>
                      {saving ? "Saving…" : "Save Form"}
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  {previewMode ? (
                    <div className="max-w-lg mx-auto rounded-xl p-6" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
                      <h2 className="text-xl font-semibold mb-6" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>{form.name || "Untitled Form"}</h2>
                      <div className="space-y-5">
                        {form.fields.map(field => (
                          <div key={field.id}>
                            {field.type === "section_header" ? (
                              <div className="border-b pb-2" style={{ borderColor: "rgba(197,160,89,0.2)" }}>
                                <h3 className="font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>{field.label}</h3>
                              </div>
                            ) : (
                              <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>
                                  {field.label} {field.required && <span style={{ color: "#ef4444" }}>*</span>}
                                </label>
                                {field.type === "textarea" ? (
                                  <textarea rows={3} placeholder={field.placeholder} className="w-full px-3 py-2 rounded-lg border text-sm resize-none" style={{ borderColor: "#d1d5db" }} disabled />
                                ) : field.type === "dropdown" ? (
                                  <select className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: "#d1d5db" }} disabled>
                                    <option>Select…</option>
                                    {field.options?.map(o => <option key={o}>{o}</option>)}
                                  </select>
                                ) : field.type === "checkbox" ? (
                                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" disabled /><span className="text-sm">{field.label}</span></label>
                                ) : field.type === "signature" ? (
                                  <div className="h-20 rounded-lg border flex items-center justify-center text-sm" style={{ borderColor: "#d1d5db", color: "#9ca3af" }}>Signature pad</div>
                                ) : field.type === "file" ? (
                                  <div className="h-16 rounded-lg border-2 border-dashed flex items-center justify-center text-sm" style={{ borderColor: "#d1d5db", color: "#9ca3af" }}>Click to upload</div>
                                ) : (
                                  <input type={field.type} placeholder={field.placeholder} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "#d1d5db" }} disabled />
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        {form.fields.length === 0 && <p className="text-center text-sm" style={{ color: "#9ca3af" }}>No fields yet</p>}
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-lg mx-auto">
                      <div className="space-y-2">
                        {form.fields.map((field, idx) => (
                          <div key={field.id}
                            onClick={() => setSelectedFieldIdx(idx)}
                            className="rounded-xl p-3 cursor-pointer transition-all"
                            style={{
                              background: selectedFieldIdx === idx ? "rgba(197,160,89,0.06)" : "#fff",
                              border: `1px solid ${selectedFieldIdx === idx ? "rgba(197,160,89,0.4)" : "rgba(197,160,89,0.12)"}`,
                            }}>
                            <div className="flex items-center gap-2">
                              <GripVertical size={14} style={{ color: "#9ca3af" }} />
                              <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)", fontSize: 10 }}>{field.type}</span>
                              <span className="text-sm flex-1" style={{ color: "#1a1714" }}>{field.label}</span>
                              {field.required && <span className="text-xs" style={{ color: "#ef4444" }}>*</span>}
                              <button onClick={e => { e.stopPropagation(); removeField(idx); }} className="p-1 hover:bg-red-50 rounded">
                                <X size={12} style={{ color: "#ef4444" }} />
                              </button>
                            </div>
                          </div>
                        ))}
                        {form.fields.length === 0 && (
                          <div className="rounded-xl p-8 text-center" style={{ border: "1px dashed rgba(197,160,89,0.2)", background: "rgba(197,160,89,0.02)" }}>
                            <p className="text-sm" style={{ color: "#9ca3af" }}>Click a field type from the palette to add fields</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Field Editor Panel */}
              {!previewMode && selectedField !== null && selectedFieldIdx !== null && (
                <div className="w-56 flex-shrink-0 p-4 overflow-y-auto" style={{ borderLeft: "1px solid rgba(197,160,89,0.1)", background: "#faf9f6" }}>
                  <p className="text-xs font-medium mb-3" style={{ color: "rgba(197,160,89,0.7)", letterSpacing: "0.05em" }}>FIELD SETTINGS</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: "#4b5563" }}>Label</label>
                      <input value={selectedField.label} onChange={e => updateField(selectedFieldIdx, { label: e.target.value })}
                        className="w-full px-2 py-1.5 rounded-lg border outline-none text-sm"
                        style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                    </div>
                    {selectedField.type !== "section_header" && selectedField.type !== "checkbox" && selectedField.type !== "signature" && selectedField.type !== "file" && (
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: "#4b5563" }}>Placeholder</label>
                        <input value={selectedField.placeholder || ""} onChange={e => updateField(selectedFieldIdx, { placeholder: e.target.value })}
                          className="w-full px-2 py-1.5 rounded-lg border outline-none text-sm"
                          style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                      </div>
                    )}
                    {selectedField.type !== "section_header" && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={selectedField.required || false}
                          onChange={e => updateField(selectedFieldIdx, { required: e.target.checked })} />
                        <span className="text-xs" style={{ color: "#4b5563" }}>Required</span>
                      </label>
                    )}
                    {selectedField.type === "dropdown" && (
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: "#4b5563" }}>Options (one per line)</label>
                        <textarea value={(selectedField.options || []).join("\n")}
                          onChange={e => updateField(selectedFieldIdx, { options: e.target.value.split("\n").filter(Boolean) })}
                          rows={4} className="w-full px-2 py-1.5 rounded-lg border outline-none text-xs resize-none"
                          style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
