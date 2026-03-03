"use client";

import { useState, useEffect } from "react";
import { MessageCircle, Mail, Smartphone, Bell, Send, ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Patient, Communication, fmtDateTime } from "../types";

const CHANNEL_CFG: Record<string, { label: string; bg: string; text: string; border: string; icon: React.ElementType }> = {
  whatsapp: { label: "WhatsApp", bg: "rgba(37,211,102,0.08)",  text: "#15803D", border: "rgba(37,211,102,0.3)",  icon: MessageCircle },
  sms:      { label: "SMS",      bg: "rgba(59,130,246,0.08)",  text: "#1D4ED8", border: "rgba(59,130,246,0.3)",  icon: Smartphone },
  email:    { label: "Email",    bg: "rgba(139,92,246,0.08)",  text: "#6D28D9", border: "rgba(139,92,246,0.3)",  icon: Mail },
  in_app:   { label: "In-App",   bg: "rgba(107,114,128,0.08)", text: "#374151", border: "rgba(107,114,128,0.3)", icon: Bell },
};

const FILTERS = ["All", "WhatsApp", "SMS", "Email", "In-App"] as const;
type Filter = typeof FILTERS[number];

function filterKey(f: Filter): string | null {
  if (f === "All") return null;
  if (f === "WhatsApp") return "whatsapp";
  if (f === "SMS") return "sms";
  if (f === "Email") return "email";
  return "in_app";
}

interface Props {
  patient: Patient;
  clinicId: string;
}

export default function CommunicationsTab({ patient, clinicId }: Props) {
  const [comms, setComms]         = useState<Communication[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<Filter>("All");
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);

  // Form state
  const [fChannel, setFChannel]   = useState("sms");
  const [fDir, setFDir]           = useState("outbound");
  const [fSubject, setFSubject]   = useState("");
  const [fContent, setFContent]   = useState("");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("patient_communications")
      .select("id, channel, direction, subject, content, status, sent_by_name, sent_at")
      .eq("patient_id", patient.id)
      .eq("clinic_id", clinicId)
      .order("sent_at", { ascending: false });
    setComms((data ?? []) as Communication[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [patient.id, clinicId]);

  const filtered = comms.filter(c => {
    const key = filterKey(filter);
    return key === null || c.channel === key;
  });

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleLog() {
    if (!fContent.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/patients/${patient.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "log_communication",
        channel: fChannel,
        direction: fDir,
        subject: fSubject || null,
        content: fContent,
        clinic_id: clinicId,
      }),
    });
    if (res.ok) {
      toast.success("Communication logged");
      setFChannel("sms"); setFDir("outbound"); setFSubject(""); setFContent("");
      setShowForm(false);
      await load();
    } else {
      toast.error("Failed to log communication");
    }
    setSaving(false);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px", borderRadius: 8,
    border: "1px solid rgba(197,160,89,0.3)", fontSize: 13,
    outline: "none", background: "#FAFAF8", boxSizing: "border-box",
    fontFamily: "Georgia, serif", color: "#1C1917",
  };

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <MessageCircle size={13} color="#C5A059" />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280" }}>Communications</span>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.35)", background: showForm ? "rgba(197,160,89,0.12)" : "rgba(197,160,89,0.07)", color: "#C5A059", cursor: "pointer" }}
        >
          {showForm ? <><X size={12} /> Cancel</> : <><Plus size={12} /> Log Communication</>}
        </button>
      </div>

      {/* Inline log form */}
      {showForm && (
        <div style={{ padding: 16, borderRadius: 12, border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.04)", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Channel</label>
              <select value={fChannel} onChange={e => setFChannel(e.target.value)} style={inputStyle}>
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Direction</label>
              <select value={fDir} onChange={e => setFDir(e.target.value)} style={inputStyle}>
                <option value="outbound">Outbound</option>
                <option value="inbound">Inbound</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Subject (optional)</label>
            <input value={fSubject} onChange={e => setFSubject(e.target.value)} placeholder="e.g. Appointment reminder" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Content</label>
            <textarea
              rows={3}
              value={fContent}
              onChange={e => setFContent(e.target.value)}
              placeholder="Message content…"
              style={{ ...inputStyle, resize: "none" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={handleLog}
              disabled={saving || !fContent.trim()}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, padding: "8px 18px", borderRadius: 8, border: "none", background: saving || !fContent.trim() ? "rgba(197,160,89,0.4)" : "#C5A059", color: "#fff", cursor: saving || !fContent.trim() ? "not-allowed" : "pointer" }}
            >
              <Send size={13} /> {saving ? "Saving…" : "Log"}
            </button>
          </div>
        </div>
      )}

      {/* Filter chips */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 999, cursor: "pointer", border: filter === f ? "1px solid #C5A059" : "1px solid rgba(197,160,89,0.25)", background: filter === f ? "rgba(197,160,89,0.12)" : "transparent", color: filter === f ? "#C5A059" : "#6B7280" }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: "#9CA3AF", fontSize: 13 }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <MessageCircle size={32} color="rgba(197,160,89,0.3)" style={{ margin: "0 auto 10px" }} />
          <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>No communications found</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(c => {
            const cfg = CHANNEL_CFG[c.channel] ?? CHANNEL_CFG.sms;
            const Icon = cfg.icon;
            const isOut = c.direction === "outbound";
            const isExpanded = expanded.has(c.id);
            const TRUNC = 120;
            const truncated = c.content.length > TRUNC && !isExpanded;

            return (
              <div key={c.id} style={{ padding: "12px 14px", borderRadius: 12, background: "#fff", border: "1px solid rgba(197,160,89,0.12)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                {/* Top row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    {/* Channel badge */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                      <Icon size={10} color={cfg.text} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: cfg.text, textTransform: "uppercase", letterSpacing: "0.06em" }}>{cfg.label}</span>
                    </div>
                    {/* Direction badge */}
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 999, background: isOut ? "rgba(16,185,129,0.08)" : "rgba(107,114,128,0.08)", color: isOut ? "#065F46" : "#374151", border: `1px solid ${isOut ? "rgba(16,185,129,0.25)" : "rgba(107,114,128,0.25)"}`, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {isOut ? "↑ Out" : "↓ In"}
                    </span>
                    {c.subject && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#1C1917" }}>{c.subject}</span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: "#9CA3AF", flexShrink: 0 }}>{fmtDateTime(c.sent_at)}</span>
                </div>

                {/* Content */}
                <p style={{ fontSize: 13, color: "#374151", margin: "0 0 4px", lineHeight: 1.55, fontFamily: "Georgia, serif" }}>
                  {truncated ? c.content.slice(0, TRUNC) + "…" : c.content}
                </p>
                {c.content.length > TRUNC && (
                  <button
                    onClick={() => toggleExpand(c.id)}
                    style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "#C5A059", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}
                  >
                    {isExpanded ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show more</>}
                  </button>
                )}

                {/* Footer */}
                {c.sent_by_name && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "#9CA3AF" }}>Sent by {c.sent_by_name}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
