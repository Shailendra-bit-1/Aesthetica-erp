"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import TopBar from "@/components/TopBar";
import { Plus, X, Edit2, Trash2, Eye, CheckCircle, Copy, MessageSquare } from "lucide-react";

interface WATemplate {
  id: string;
  clinic_id: string | null;
  name: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: string;
  header_text: string | null;
  body_text: string;
  footer_text: string | null;
  variables: Array<{ name: string }>;
  is_approved: boolean;
  is_active: boolean;
  created_at: string;
}

const CATEGORY_CFG = {
  UTILITY:        { bg: "rgba(59,130,246,0.1)",  color: "#2563eb",  label: "Utility"        },
  MARKETING:      { bg: "rgba(197,160,89,0.12)", color: "#8B6914",  label: "Marketing"      },
  AUTHENTICATION: { bg: "rgba(139,126,200,0.1)", color: "#6B5FAA",  label: "Authentication" },
};

function renderTemplate(body: string, vars: Array<{ name: string }>): string {
  let result = body;
  vars.forEach((v, i) => {
    result = result.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, "g"), `[${v.name || `var${i + 1}`}]`);
  });
  return result;
}

export default function TemplatesPage() {
  const { profile, activeClinicId } = useClinic();
  const clinicId = activeClinicId || profile?.clinic_id;

  const [templates,    setTemplates]    = useState<WATemplate[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [catFilter,    setCatFilter]    = useState<string>("all");
  const [drawer,       setDrawer]       = useState(false);
  const [editTpl,      setEditTpl]      = useState<WATemplate | null>(null);
  const [preview,      setPreview]      = useState<WATemplate | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [form, setForm] = useState({
    name: "", category: "UTILITY" as WATemplate["category"],
    header_text: "", body_text: "", footer_text: "", language: "en",
    variables: [] as Array<{ name: string }>,
  });

  const fetchTemplates = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase
      .from("whatsapp_templates")
      .select("*")
      .or(`clinic_id.is.null,clinic_id.eq.${clinicId}`)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    setTemplates((data ?? []) as WATemplate[]);
    setLoading(false);
  }, [clinicId]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const openNew = () => {
    setEditTpl(null);
    setForm({ name: "", category: "UTILITY", header_text: "", body_text: "", footer_text: "", language: "en", variables: [] });
    setDrawer(true);
  };
  const openEdit = (t: WATemplate) => {
    setEditTpl(t);
    setForm({ name: t.name, category: t.category, header_text: t.header_text || "", body_text: t.body_text, footer_text: t.footer_text || "", language: t.language, variables: t.variables || [] });
    setDrawer(true);
  };

  // Parse {{n}} from body_text to auto-detect variable count
  const parseVars = (body: string) => {
    const matches = body.match(/\{\{(\d+)\}\}/g) ?? [];
    const maxIdx = Math.max(0, ...matches.map(m => parseInt(m.replace(/[{}]/g, ""))));
    const newVars = Array.from({ length: maxIdx }, (_, i) => form.variables[i] || { name: "" });
    setForm(f => ({ ...f, variables: newVars }));
  };

  const save = async () => {
    if (!clinicId || !form.name || !form.body_text) return;
    setSaving(true);
    const payload = {
      clinic_id:   clinicId,
      name:        form.name,
      category:    form.category,
      language:    form.language,
      header_text: form.header_text || null,
      body_text:   form.body_text,
      footer_text: form.footer_text || null,
      variables:   form.variables,
    };
    if (editTpl) {
      await supabase.from("whatsapp_templates").update(payload).eq("id", editTpl.id);
    } else {
      await supabase.from("whatsapp_templates").insert(payload);
    }
    setSaving(false);
    setDrawer(false);
    fetchTemplates();
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    await supabase.from("whatsapp_templates").update({ is_active: false }).eq("id", id);
    fetchTemplates();
  };

  const copyBody = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const filtered = templates.filter(t => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.body_text.toLowerCase().includes(search.toLowerCase());
    const matchCat    = catFilter === "all" || t.category === catFilter;
    return matchSearch && matchCat;
  });

  if (profile && profile.role !== "superadmin" && profile.role !== "chain_admin" && profile.role !== "clinic_admin") {
    return (
      <div className="flex flex-col h-screen" style={{ background: "#F9F7F2" }}>
        <TopBar />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#6b7280", fontFamily: "Georgia, serif" }}>Admin access required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen" style={{ background: "#F9F7F2" }}>
      <TopBar />
      <div style={{ flex: 1, overflowY: "auto", padding: 24, maxWidth: 1280, margin: "0 auto", width: "100%" }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, fontFamily: "Georgia, serif", color: "#1a1714", margin: 0 }}>WhatsApp Templates</h1>
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Manage message templates for campaigns and automated messages</p>
          </div>
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: "var(--gold)" }}>
            <Plus size={15} /> New Template
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search templates…"
              className="pl-3 pr-3 py-2 rounded-lg text-sm border bg-white outline-none"
              style={{ borderColor: "rgba(197,160,89,0.2)", width: 220 }} />
          </div>
          <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: "rgba(197,160,89,0.08)", border: "1px solid rgba(197,160,89,0.15)" }}>
            {["all", "UTILITY", "MARKETING", "AUTHENTICATION"].map(cat => (
              <button key={cat} onClick={() => setCatFilter(cat)}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={catFilter === cat ? { background: "var(--gold)", color: "#fff" } : { color: "rgba(197,160,89,0.7)" }}>
                {cat === "all" ? "All" : CATEGORY_CFG[cat as WATemplate["category"]].label}
              </button>
            ))}
          </div>
          <span className="text-xs ml-auto" style={{ color: "#9ca3af" }}>{filtered.length} template{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Template grid */}
        {loading ? (
          <div className="grid grid-cols-3 gap-4">
            {[1,2,3].map(n => <div key={n} className="h-40 rounded-xl animate-pulse" style={{ background: "rgba(197,160,89,0.06)" }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16" style={{ color: "rgba(197,160,89,0.5)" }}>
            <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
            <p style={{ fontFamily: "Georgia, serif" }}>No templates found</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filtered.map(t => {
              const catCfg = CATEGORY_CFG[t.category];
              return (
                <div key={t.id} className="rounded-xl p-5 flex flex-col gap-3"
                  style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                  <div className="flex items-start justify-between gap-2">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="font-semibold text-sm" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>{t.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: catCfg.bg, color: catCfg.color }}>{catCfg.label}</span>
                        {t.is_approved ? (
                          <span className="flex items-center gap-1 text-xs" style={{ color: "#16a34a" }}><CheckCircle size={10} /> Approved</span>
                        ) : (
                          <span className="text-xs" style={{ color: "#9ca3af" }}>Pending</span>
                        )}
                        {!t.clinic_id && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(197,160,89,0.08)", color: "#8B6914" }}>Global</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setPreview(t)} className="p-1.5 rounded hover:bg-gray-50" title="Preview"><Eye size={13} style={{ color: "#6b7280" }} /></button>
                      <button onClick={() => copyBody(t.body_text)} className="p-1.5 rounded hover:bg-gray-50" title="Copy body"><Copy size={13} style={{ color: "#6b7280" }} /></button>
                      {t.clinic_id && <button onClick={() => openEdit(t)} className="p-1.5 rounded hover:bg-gray-50"><Edit2 size={13} style={{ color: "#6b7280" }} /></button>}
                      {t.clinic_id && <button onClick={() => deleteTemplate(t.id)} className="p-1.5 rounded hover:bg-red-50"><Trash2 size={13} style={{ color: "#ef4444" }} /></button>}
                    </div>
                  </div>

                  {t.header_text && (
                    <p className="text-xs font-bold" style={{ color: "#374151" }}>{t.header_text}</p>
                  )}
                  <p className="text-xs leading-relaxed" style={{ color: "#4b5563" }}>{renderTemplate(t.body_text, t.variables).slice(0, 120)}{t.body_text.length > 120 ? "…" : ""}</p>
                  {t.footer_text && (
                    <p className="text-xs" style={{ color: "#9ca3af" }}>{t.footer_text}</p>
                  )}
                  {t.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {t.variables.map((v, i) => (
                        <span key={i} className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(197,160,89,0.08)", color: "#8B6914" }}>
                          {`{{${i+1}}}`} {v.name && `→ ${v.name}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setPreview(null)}>
          <div className="rounded-2xl p-6 max-w-sm w-full mx-4" style={{ background: "#fff" }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 style={{ fontFamily: "Georgia, serif", fontWeight: 700, color: "#1a1714" }}>{preview.name}</h3>
              <button onClick={() => setPreview(null)} className="p-1 rounded hover:bg-gray-100"><X size={16} /></button>
            </div>
            <div style={{ background: "#DCF8C6", borderRadius: 12, padding: "12px 14px", fontFamily: "inherit" }}>
              {preview.header_text && <p style={{ fontSize: 13, fontWeight: 700, color: "#1a1714", marginBottom: 6 }}>{preview.header_text}</p>}
              <p style={{ fontSize: 13, color: "#1a1714", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{renderTemplate(preview.body_text, preview.variables)}</p>
              {preview.footer_text && <p style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>{preview.footer_text}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Edit/New drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setDrawer(false)} />
          <div className="w-[520px] h-full overflow-y-auto flex flex-col" style={{ background: "#fff" }}>
            <div className="flex justify-between items-center px-6 py-5" style={{ borderBottom: "1px solid rgba(197,160,89,0.15)" }}>
              <h3 style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 700, color: "#1a1714" }}>
                {editTpl ? "Edit Template" : "New Template"}
              </h3>
              <button onClick={() => setDrawer(false)} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="flex-1 p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Template Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Appointment Reminder" className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as WATemplate["category"] }))}
                    className="w-full px-3 py-2 rounded-lg border outline-none text-sm bg-white"
                    style={{ borderColor: "rgba(197,160,89,0.3)" }}>
                    <option value="UTILITY">Utility</option>
                    <option value="MARKETING">Marketing</option>
                    <option value="AUTHENTICATION">Authentication</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Language</label>
                  <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border outline-none text-sm bg-white"
                    style={{ borderColor: "rgba(197,160,89,0.3)" }}>
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="mr">Marathi</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Header (optional)</label>
                <input value={form.header_text} onChange={e => setForm(f => ({ ...f, header_text: e.target.value }))}
                  placeholder="Bold header text" className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Body Text * <span style={{ fontWeight: 400, color: "#9ca3af" }}>— use {"{{1}}"} {"{{2}}"} for variables</span></label>
                <textarea value={form.body_text}
                  onChange={e => { setForm(f => ({ ...f, body_text: e.target.value })); parseVars(e.target.value); }}
                  rows={5} placeholder="Hi {{1}}, your appointment is on {{2}}…"
                  className="w-full px-3 py-2 rounded-lg border outline-none text-sm resize-none"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }} />
              </div>
              {form.variables.length > 0 && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Variable Labels</label>
                  <div className="space-y-2">
                    {form.variables.map((v, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs font-mono px-2 py-1 rounded" style={{ background: "rgba(197,160,89,0.08)", color: "#8B6914", flexShrink: 0 }}>{`{{${i+1}}}`}</span>
                        <input value={v.name} onChange={e => { const nv = [...form.variables]; nv[i].name = e.target.value; setForm(f => ({ ...f, variables: nv })); }}
                          placeholder={`Variable ${i+1} name (e.g. patient_name)`}
                          className="flex-1 px-2 py-1.5 rounded border text-xs outline-none"
                          style={{ borderColor: "rgba(197,160,89,0.25)" }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Footer (optional)</label>
                <input value={form.footer_text} onChange={e => setForm(f => ({ ...f, footer_text: e.target.value }))}
                  placeholder="Reply STOP to unsubscribe" className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }} />
              </div>
              {/* Live preview */}
              {form.body_text && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Preview</label>
                  <div style={{ background: "#DCF8C6", borderRadius: 12, padding: "10px 14px" }}>
                    {form.header_text && <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{form.header_text}</p>}
                    <p style={{ fontSize: 12, lineHeight: 1.6, color: "#1a1714", whiteSpace: "pre-wrap" }}>{renderTemplate(form.body_text, form.variables)}</p>
                    {form.footer_text && <p style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{form.footer_text}</p>}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 flex gap-3" style={{ borderTop: "1px solid rgba(197,160,89,0.15)" }}>
              <button onClick={() => setDrawer(false)} className="flex-1 px-4 py-2 rounded-lg text-sm border" style={{ borderColor: "rgba(197,160,89,0.2)", color: "#6b7280" }}>Cancel</button>
              <button onClick={save} disabled={saving || !form.name || !form.body_text}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "var(--gold)" }}>{saving ? "Saving…" : "Save Template"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
