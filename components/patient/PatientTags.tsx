"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Tag, X, Plus, Check } from "lucide-react";
import { toast } from "sonner";

interface PatientTag {
  id: string;
  name: string;
  color: string;
}

interface Props {
  patientId: string;
  clinicId: string;
  readOnly?: boolean;
}

export default function PatientTags({ patientId, clinicId, readOnly = false }: Props) {
  const [assigned, setAssigned]   = useState<PatientTag[]>([]);
  const [allTags,  setAllTags]    = useState<PatientTag[]>([]);
  const [open,     setOpen]       = useState(false);
  const [newName,  setNewName]    = useState("");
  const [newColor, setNewColor]   = useState("#0B2A4A");
  const [creating, setCreating]   = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const loadAssigned = async () => {
    const { data } = await supabase
      .from("patient_tag_assignments")
      .select("tag_id, patient_tags(id, name, color)")
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId);
    setAssigned((data ?? []).map((r: any) => r.patient_tags).filter(Boolean));
  };

  const loadAll = async () => {
    const { data } = await supabase.from("patient_tags").select("id, name, color").eq("clinic_id", clinicId).order("name");
    setAllTags(data ?? []);
  };

  useEffect(() => {
    loadAssigned();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, clinicId]);

  useEffect(() => {
    if (open) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, []);

  async function toggleTag(tag: PatientTag) {
    const isAssigned = assigned.some(a => a.id === tag.id);
    if (isAssigned) {
      await supabase.from("patient_tag_assignments").delete().eq("patient_id", patientId).eq("tag_id", tag.id);
    } else {
      await supabase.from("patient_tag_assignments").insert({ clinic_id: clinicId, patient_id: patientId, tag_id: tag.id });
    }
    await loadAssigned();
  }

  async function createTag() {
    if (!newName.trim()) return;
    setCreating(true);
    const { data, error } = await supabase.from("patient_tags")
      .insert({ clinic_id: clinicId, name: newName.trim(), color: newColor })
      .select("id, name, color").single();
    setCreating(false);
    if (error) { toast.error("Tag already exists or error: " + error.message); return; }
    setNewName("");
    await loadAll();
    // Auto-assign the new tag
    await supabase.from("patient_tag_assignments").insert({ clinic_id: clinicId, patient_id: patientId, tag_id: data.id });
    await loadAssigned();
  }

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {assigned.map(tag => (
          <span key={tag.id} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "2px 8px", borderRadius: 20,
            background: tag.color + "22", color: tag.color,
            fontSize: 11, fontWeight: 600, border: `1px solid ${tag.color}44`,
          }}>
            {tag.name}
            {!readOnly && (
              <button onClick={() => toggleTag(tag)} style={{ border: "none", background: "none", cursor: "pointer", color: tag.color, padding: 0, lineHeight: 1 }}>
                <X size={10} />
              </button>
            )}
          </span>
        ))}

        {!readOnly && (
          <button
            onClick={() => setOpen(o => !o)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              padding: "2px 8px", borderRadius: 20, fontSize: 11,
              border: "1px dashed var(--border-strong)", background: "none",
              cursor: "pointer", color: "var(--text-secondary)",
            }}
          >
            <Plus size={10} /> Tag
          </button>
        )}
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200,
          minWidth: 220, background: "#fff", borderRadius: 12,
          border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)", overflow: "hidden",
        }}>
          <div style={{ padding: "8px 12px 6px", borderBottom: "1px solid var(--border)" }}>
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", margin: 0 }}>Tags</p>
          </div>
          <div style={{ maxHeight: 180, overflowY: "auto" }}>
            {allTags.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "10px 12px", textAlign: "center" }}>No tags yet</p>
            )}
            {allTags.map(tag => {
              const isOn = assigned.some(a => a.id === tag.id);
              return (
                <button key={tag.id} onClick={() => toggleTag(tag)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", border: "none", background: isOn ? tag.color + "11" : "transparent", cursor: "pointer" }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: tag.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12, color: "var(--text-primary)", textAlign: "left" }}>{tag.name}</span>
                  {isOn && <Check size={11} style={{ color: tag.color }} />}
                </button>
              );
            })}
          </div>
          <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border)", display: "flex", gap: 6 }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createTag()}
              placeholder="New tag name"
              style={{ flex: 1, fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", outline: "none" }}
            />
            <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
              style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border)", padding: 2, cursor: "pointer" }} />
            <button onClick={createTag} disabled={creating || !newName.trim()}
              style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: "var(--primary)", color: "#fff", fontSize: 11, cursor: "pointer", opacity: creating || !newName.trim() ? 0.5 : 1 }}>
              {creating ? "…" : "Add"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
