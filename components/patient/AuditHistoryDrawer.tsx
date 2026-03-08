"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { X, History, Loader2, ArrowRight } from "lucide-react";

interface AuditEntry {
  id: string;
  record_type: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_by_name: string | null;
  change_reason: string | null;
  created_at: string;
}

interface Props {
  patientId: string;
  clinicId: string;
  recordType: string;
  recordId: string;
  recordLabel: string;
  onClose: () => void;
}

export default function AuditHistoryDrawer({ patientId, clinicId, recordType, recordId, recordLabel, onClose }: Props) {
  const [entries,  setEntries]  = useState<AuditEntry[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    supabase
      .from("clinical_audit_log")
      .select("id, record_type, field_name, old_value, new_value, changed_by_name, change_reason, created_at")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .eq("record_type", recordType)
      .eq("record_id", recordId)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setEntries(data ?? []); setLoading(false); });
  }, [patientId, clinicId, recordType, recordId]);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "var(--bg-overlay)",
      zIndex: "var(--z-modal)" as React.CSSProperties["zIndex"],
      display: "flex", justifyContent: "flex-end",
    }}>
      <div style={{
        width: 440, maxWidth: "95vw", height: "100vh",
        background: "#fff", display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 32px rgba(0,0,0,0.12)",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, background: "var(--primary)" }}>
          <History size={16} style={{ color: "#fff" }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>Edit History</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: 0 }}>{recordLabel}</p>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "rgba(255,255,255,0.15)", cursor: "pointer", borderRadius: 6, padding: 5, color: "#fff" }}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", padding: 24 }}>
              <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Loading…
            </div>
          )}

          {!loading && entries.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>
              <History size={28} style={{ margin: "0 auto 10px", opacity: 0.3 }} />
              <p style={{ fontSize: 13 }}>No edit history recorded yet.</p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {entries.map(entry => (
              <div key={entry.id} style={{ background: "var(--surface-muted)", borderRadius: 10, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div>
                    {entry.field_name && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)", background: "var(--primary-subtle)", padding: "2px 8px", borderRadius: 20 }}>
                        {entry.field_name.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
                      {new Date(entry.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      {" · "}
                      {new Date(entry.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {entry.changed_by_name && (
                      <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0 }}>by {entry.changed_by_name}</p>
                    )}
                  </div>
                </div>

                {(entry.old_value || entry.new_value) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                    {entry.old_value && (
                      <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", textDecoration: "line-through" }}>
                        {entry.old_value}
                      </span>
                    )}
                    {entry.old_value && entry.new_value && <ArrowRight size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
                    {entry.new_value && (
                      <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0" }}>
                        {entry.new_value}
                      </span>
                    )}
                  </div>
                )}

                {entry.change_reason && (
                  <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6, fontStyle: "italic" }}>
                    Reason: {entry.change_reason}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
