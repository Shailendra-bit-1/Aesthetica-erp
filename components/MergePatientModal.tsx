"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { X, Search, ArrowRight, AlertTriangle, Check, Loader2, Merge } from "lucide-react";
import { toast } from "sonner";

interface PatientOption {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
}

interface Props {
  clinicId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function MergePatientModal({ clinicId, onClose, onSuccess }: Props) {
  const [primaryQ,   setPrimaryQ]   = useState("");
  const [secondaryQ, setSecondaryQ] = useState("");
  const [primaryOpts,   setPrimaryOpts]   = useState<PatientOption[]>([]);
  const [secondaryOpts, setSecondaryOpts] = useState<PatientOption[]>([]);
  const [primary,   setPrimary]   = useState<PatientOption | null>(null);
  const [secondary, setSecondary] = useState<PatientOption | null>(null);
  const [merging,   setMerging]   = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  async function searchPatients(q: string, setPrimOpts: (opts: PatientOption[]) => void) {
    if (q.length < 2) { setPrimOpts([]); return; }
    const { data } = await supabase
      .from("patients")
      .select("id, full_name, phone, email, created_at")
      .eq("clinic_id", clinicId)
      .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(8);
    setPrimOpts(data ?? []);
  }

  useEffect(() => { searchPatients(primaryQ, setPrimaryOpts); }, [primaryQ]);
  useEffect(() => { searchPatients(secondaryQ, setSecondaryOpts); }, [secondaryQ]);

  async function doMerge() {
    if (!primary || !secondary || !confirmed) return;
    setMerging(true);
    const res = await fetch("/api/patients/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primary_id: primary.id, secondary_id: secondary.id, clinic_id: clinicId }),
    });
    const data = await res.json();
    setMerging(false);
    if (!res.ok) { toast.error(data.error ?? "Merge failed"); return; }
    toast.success(`Patient merged into ${primary.full_name}`);
    onSuccess();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--bg-overlay)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 560, overflow: "hidden", boxShadow: "var(--shadow-xl)" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", background: "var(--primary)", display: "flex", alignItems: "center", gap: 10 }}>
          <Merge size={16} style={{ color: "#fff" }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0 }}>Merge Patients</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: 0 }}>Secondary patient's records are merged into primary, then deleted.</p>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "rgba(255,255,255,0.15)", cursor: "pointer", borderRadius: 6, padding: 5, color: "#fff" }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Patient selectors */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "start" }}>
            <PatientPicker
              label="Primary (Keep)"
              query={primaryQ}
              setQuery={setPrimaryQ}
              options={primaryOpts}
              selected={primary}
              onSelect={setPrimary}
              exclude={secondary?.id}
              accent="var(--success)"
            />
            <div style={{ paddingTop: 28, color: "var(--text-muted)" }}>
              <ArrowRight size={18} />
            </div>
            <PatientPicker
              label="Secondary (Delete)"
              query={secondaryQ}
              setQuery={setSecondaryQ}
              options={secondaryOpts}
              selected={secondary}
              onSelect={setSecondary}
              exclude={primary?.id}
              accent="var(--danger)"
            />
          </div>

          {/* Preview */}
          {primary && secondary && (
            <div style={{ background: "var(--surface-muted)", borderRadius: 10, padding: 14, fontSize: 13 }}>
              <p style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>Merge Summary</p>
              <p style={{ color: "var(--text-secondary)", margin: 0 }}>
                All appointments, invoices, treatments, and clinical records from{" "}
                <strong style={{ color: "var(--danger)" }}>{secondary.full_name}</strong>{" "}
                will be moved to{" "}
                <strong style={{ color: "var(--success)" }}>{primary.full_name}</strong>.
                The secondary patient record will be soft-deleted.
              </p>
            </div>
          )}

          {/* Warning + Confirmation */}
          {primary && secondary && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: 12, background: "#FFFBEB", borderRadius: 10, border: "1px solid #FDE68A" }}>
              <AlertTriangle size={14} style={{ color: "#D97706", flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, color: "#92400E", margin: 0, fontWeight: 600 }}>This action is irreversible</p>
                <p style={{ fontSize: 11, color: "#B45309", margin: "3px 0 8px" }}>The secondary patient record cannot be recovered after merging.</p>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
                  <span style={{ fontSize: 12, color: "#92400E", fontWeight: 500 }}>
                    I confirm I want to merge {secondary.full_name} into {primary.full_name}
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "1px solid var(--border)", background: "none", cursor: "pointer", fontSize: 13, color: "var(--text-secondary)" }}>
              Cancel
            </button>
            <button
              onClick={doMerge}
              disabled={!primary || !secondary || !confirmed || merging}
              style={{ flex: 2, padding: "9px 0", borderRadius: 9, border: "none", background: "var(--primary)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, opacity: (!primary || !secondary || !confirmed || merging) ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              {merging ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Merging…</> : <><Merge size={13} /> Merge Patients</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PatientPicker({
  label, query, setQuery, options, selected, onSelect, exclude, accent,
}: {
  label: string;
  query: string;
  setQuery: (q: string) => void;
  options: PatientOption[];
  selected: PatientOption | null;
  onSelect: (p: PatientOption) => void;
  exclude?: string;
  accent: string;
}) {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: accent, marginBottom: 6 }}>{label}</p>
      {selected ? (
        <div style={{ padding: "10px 12px", borderRadius: 10, border: `2px solid ${accent}`, background: "#fff", position: "relative" }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{selected.full_name}</p>
          {selected.phone && <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0 }}>{selected.phone}</p>}
          <button onClick={() => onSelect(null as unknown as PatientOption)} style={{ position: "absolute", top: 8, right: 8, border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)" }}>
            <X size={12} />
          </button>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name or phone…"
            style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--border)", fontSize: 13, outline: "none" }}
          />
          {options.length > 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", borderRadius: 10, border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)", zIndex: 10, overflow: "hidden" }}>
              {options.filter(o => o.id !== exclude).map(p => (
                <button key={p.id} onClick={() => { onSelect(p); setQuery(""); }}
                  style={{ width: "100%", padding: "9px 12px", textAlign: "left", border: "none", background: "transparent", cursor: "pointer", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 1 }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "var(--primary-subtle)")}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{p.full_name}</span>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{p.phone ?? p.email ?? "—"}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
