"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Search, X, ChevronDown, Stethoscope, Layers,
  Loader2, Pencil, Trash2, Check, BookOpen,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import TopBar from "@/components/TopBar";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Condition {
  id: string;
  name: string;
  icd10_code: string | null;
  category: string | null;
  description: string | null;
  is_active: boolean;
  is_global: boolean;
  clinic_id: string | null;
}

interface Protocol {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_global: boolean;
  clinic_id: string | null;
}

const CATEGORIES = ["Skin", "Aging", "Pigmentation", "Scarring", "Vascular", "Hair", "Other"];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ConditionsPage() {
  const { profile, activeClinicId: clinicId } = useClinic();
  const isSuperAdmin = profile?.role === "superadmin";
  const [tab, setTab] = useState<"conditions" | "protocols">("conditions");

  return (
    <div className="min-h-screen" style={{ background: "#F9F7F2" }}>
      <TopBar />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(197,160,89,0.12)" }}>
            <Stethoscope size={20} style={{ color: "var(--gold)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
              Conditions & Protocols
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              Manage skin & aesthetic condition library and clinical protocols
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(["conditions", "protocols"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all"
              style={{
                background: tab === t ? "var(--gold)" : "var(--surface)",
                color:      tab === t ? "#fff"        : "var(--text-muted)",
                border:     tab === t ? "none"        : "1px solid var(--border)",
              }}>
              {t}
            </button>
          ))}
        </div>

        {tab === "conditions" && <ConditionsTab clinicId={clinicId} isSuperAdmin={isSuperAdmin} />}
        {tab === "protocols"  && <ProtocolsTab  clinicId={clinicId} isSuperAdmin={isSuperAdmin} />}
      </div>
    </div>
  );
}

// ── Conditions Tab ────────────────────────────────────────────────────────────

function ConditionsTab({ clinicId, isSuperAdmin }: { clinicId: string | null; isSuperAdmin: boolean }) {
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [catFilter,  setCatFilter]  = useState("all");
  const [showAdd,    setShowAdd]    = useState(false);
  const [editing,    setEditing]    = useState<Condition | null>(null);

  const [name,     setName]     = useState("");
  const [icd10,    setIcd10]    = useState("");
  const [category, setCategory] = useState("");
  const [desc,     setDesc]     = useState("");
  const [saving,   setSaving]   = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("conditions")
      .select("*")
      .or(clinicId ? `is_global.eq.true,clinic_id.eq.${clinicId}` : "is_global.eq.true")
      .order("category").order("name");
    setConditions(data ?? []);
    setLoading(false);
  }, [clinicId]);

  useEffect(() => { fetch(); }, [fetch]);

  const openAdd = () => { setEditing(null); setName(""); setIcd10(""); setCategory(""); setDesc(""); setShowAdd(true); };
  const openEdit = (c: Condition) => { setEditing(c); setName(c.name); setIcd10(c.icd10_code ?? ""); setCategory(c.category ?? ""); setDesc(c.description ?? ""); setShowAdd(true); };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from("conditions").update({
          name: name.trim(), icd10_code: icd10 || null, category: category || null, description: desc || null,
        }).eq("id", editing.id);
        if (error) throw error;
        toast.success("Condition updated");
      } else {
        const { error } = await supabase.from("conditions").insert({
          clinic_id: isSuperAdmin ? null : clinicId,
          name: name.trim(), icd10_code: icd10 || null, category: category || null, description: desc || null,
          is_global: isSuperAdmin,
        });
        if (error) throw error;
        toast.success("Condition added");
      }
      setShowAdd(false);
      fetch();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const toggleActive = async (c: Condition) => {
    await supabase.from("conditions").update({ is_active: !c.is_active }).eq("id", c.id);
    fetch();
  };

  const filtered = conditions.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.icd10_code ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCat    = catFilter === "all" || c.category === catFilter;
    return matchSearch && matchCat;
  });

  const grouped = CATEGORIES.reduce<Record<string, Condition[]>>((acc, cat) => {
    const items = filtered.filter(c => c.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});
  const uncategorized = filtered.filter(c => !c.category || !CATEGORIES.includes(c.category));
  if (uncategorized.length > 0) grouped["Other"] = uncategorized;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conditions or ICD-10…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "var(--gold)", color: "#fff" }}>
          <Plus size={15} /> Add Condition
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total",    value: conditions.length,                          color: "#C5A059" },
          { label: "Active",   value: conditions.filter(c => c.is_active).length, color: "#16a34a" },
          { label: "Global",   value: conditions.filter(c => c.is_global).length, color: "#2563eb" },
          { label: "Clinic",   value: conditions.filter(c => !c.is_global).length, color: "#7c3aed" },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p className="text-2xl font-bold" style={{ color: s.color, fontFamily: "Georgia, serif" }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Grouped list */}
      {loading ? (
        <div className="text-center py-12 text-sm" style={{ color: "var(--text-muted)" }}>
          <Loader2 size={20} className="animate-spin mx-auto mb-2" />Loading…
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 text-sm" style={{ color: "var(--text-muted)" }}>No conditions found.</div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>{cat}</h3>
              <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                {items.map((c, i) => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3"
                    style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none", background: c.is_active ? "var(--surface)" : "rgba(0,0,0,0.02)", opacity: c.is_active ? 1 : 0.6 }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{c.name}</span>
                        {c.icd10_code && (
                          <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(37,99,235,0.08)", color: "#2563eb" }}>{c.icd10_code}</span>
                        )}
                        {c.is_global && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)" }}>Global</span>
                        )}
                      </div>
                      {c.description && (
                        <p className="text-xs mt-0.5 truncate max-w-lg" style={{ color: "var(--text-muted)" }}>{c.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {(!c.is_global || isSuperAdmin) && (
                        <>
                          <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-gold/10 transition-colors" title="Edit">
                            <Pencil size={13} style={{ color: "var(--text-muted)" }} />
                          </button>
                          <button onClick={() => toggleActive(c)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium"
                            style={{ background: c.is_active ? "rgba(22,163,74,0.1)" : "rgba(156,148,132,0.1)", color: c.is_active ? "#16a34a" : "#9C9584" }}>
                            {c.is_active ? "Active" : "Inactive"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid rgba(197,160,89,0.2)" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
                {editing ? "Edit Condition" : "Add Condition"}
              </h3>
              <button onClick={() => setShowAdd(false)} style={{ color: "var(--text-muted)" }}><X size={16} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>Condition Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Melasma"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: "var(--surface-warm)", border: "1px solid rgba(197,160,89,0.3)", color: "var(--foreground)" }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>ICD-10 Code</label>
                  <input value={icd10} onChange={e => setIcd10(e.target.value)} placeholder="e.g. L81.1"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                    style={{ background: "var(--surface-warm)", border: "1px solid rgba(197,160,89,0.3)", color: "var(--foreground)" }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: "var(--surface-warm)", border: "1px solid rgba(197,160,89,0.3)", color: "var(--foreground)" }}>
                    <option value="">— Select —</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>Description</label>
                <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="Brief clinical description…"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                  style={{ background: "var(--surface-warm)", border: "1px solid rgba(197,160,89,0.3)", color: "var(--foreground)" }} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl text-sm"
                style={{ background: "var(--surface-warm)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: "var(--gold)", color: "#fff" }}>
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Protocols Tab ─────────────────────────────────────────────────────────────

function ProtocolsTab({ clinicId, isSuperAdmin }: { clinicId: string | null; isSuperAdmin: boolean }) {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [showAdd,   setShowAdd]   = useState(false);
  const [editing,   setEditing]   = useState<Protocol | null>(null);
  const [name,      setName]      = useState("");
  const [desc,      setDesc]      = useState("");
  const [saving,    setSaving]    = useState(false);

  const fetchProtocols = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("protocols")
      .select("*")
      .or(clinicId ? `is_global.eq.true,clinic_id.eq.${clinicId}` : "is_global.eq.true")
      .order("name");
    setProtocols(data ?? []);
    setLoading(false);
  }, [clinicId]);

  useEffect(() => { fetchProtocols(); }, [fetchProtocols]);

  const openAdd = () => { setEditing(null); setName(""); setDesc(""); setShowAdd(true); };
  const openEdit = (p: Protocol) => { setEditing(p); setName(p.name); setDesc(p.description ?? ""); setShowAdd(true); };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      if (editing) {
        await supabase.from("protocols").update({ name: name.trim(), description: desc || null }).eq("id", editing.id);
        toast.success("Protocol updated");
      } else {
        await supabase.from("protocols").insert({
          clinic_id: isSuperAdmin ? null : clinicId,
          name: name.trim(), description: desc || null, is_global: isSuperAdmin,
        });
        toast.success("Protocol added");
      }
      setShowAdd(false);
      fetchProtocols();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const filtered = protocols.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search protocols…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "var(--gold)", color: "#fff" }}>
          <Plus size={15} /> Add Protocol
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm" style={{ color: "var(--text-muted)" }}>
          <Loader2 size={20} className="animate-spin mx-auto mb-2" />Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>
          <BookOpen size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No protocols yet. Add your first clinical protocol.</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {filtered.map((p, i) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-4"
              style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none", background: "var(--surface)" }}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{p.name}</span>
                  {p.is_global && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)" }}>Global</span>
                  )}
                </div>
                {p.description && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{p.description}</p>
                )}
              </div>
              {(!p.is_global || isSuperAdmin) && (
                <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-gold/10 transition-colors">
                  <Pencil size={13} style={{ color: "var(--text-muted)" }} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid rgba(197,160,89,0.2)" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
                {editing ? "Edit Protocol" : "Add Protocol"}
              </h3>
              <button onClick={() => setShowAdd(false)} style={{ color: "var(--text-muted)" }}><X size={16} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>Protocol Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Acne Management Protocol"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: "var(--surface-warm)", border: "1px solid rgba(197,160,89,0.3)", color: "var(--foreground)" }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>Description</label>
                <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} placeholder="Describe this protocol…"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                  style={{ background: "var(--surface-warm)", border: "1px solid rgba(197,160,89,0.3)", color: "var(--foreground)" }} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl text-sm"
                style={{ background: "var(--surface-warm)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: "var(--gold)", color: "#fff" }}>
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
