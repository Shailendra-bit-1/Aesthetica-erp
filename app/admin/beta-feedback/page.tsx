"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MessageCirclePlus, Bug, Lightbulb, HelpCircle, Heart,
  RefreshCw, CheckCircle2, Clock, Check,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface FeedbackRow {
  id: string;
  clinic_id: string | null;
  user_name: string | null;
  category: string;
  message: string;
  page_url: string | null;
  status: "new" | "reviewed" | "resolved";
  created_at: string;
  clinics: { name: string } | null;
}

/* ─── Config ─────────────────────────────────────────────────────────────────── */
const CAT_CFG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  bug:        { label: "Bug",        icon: <Bug size={12} />,         color: "#dc2626", bg: "rgba(220,38,38,0.08)"  },
  suggestion: { label: "Suggestion", icon: <Lightbulb size={12} />,   color: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
  confusion:  { label: "Confused",   icon: <HelpCircle size={12} />,  color: "#2563eb", bg: "rgba(37,99,235,0.08)"  },
  compliment: { label: "Compliment", icon: <Heart size={12} />,       color: "#16a34a", bg: "rgba(22,163,74,0.08)"  },
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  new:      { label: "New",      color: "#f59e0b", bg: "rgba(245,158,11,0.1)"  },
  reviewed: { label: "Reviewed", color: "#2563eb", bg: "rgba(37,99,235,0.1)"   },
  resolved: { label: "Resolved", color: "#16a34a", bg: "rgba(22,163,74,0.1)"   },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1)  return "Just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

/* ─── Page ───────────────────────────────────────────────────────────────────── */
export default function BetaFeedbackPage() {
  const { profile, activeClinicId } = useClinic();
  const isSuperAdmin = profile?.role === "superadmin";
  const clinicId     = activeClinicId || profile?.clinic_id;

  const [rows,       setRows]       = useState<FeedbackRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState<"all" | "new" | "bug" | "suggestion" | "confusion" | "compliment">("all");
  const [updating,   setUpdating]   = useState<string | null>(null);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("beta_feedback")
      .select("*, clinics(name)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (!isSuperAdmin && clinicId) {
      q = q.eq("clinic_id", clinicId);
    }

    const { data } = await q;
    setRows((data ?? []) as FeedbackRow[]);
    setLoading(false);
  }, [isSuperAdmin, clinicId]);

  useEffect(() => { fetchFeedback(); }, [fetchFeedback]);

  const updateStatus = async (id: string, status: FeedbackRow["status"]) => {
    setUpdating(id);
    await supabase.from("beta_feedback").update({ status }).eq("id", id);
    setRows(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    setUpdating(null);
  };

  const filtered = rows.filter(r => {
    if (filter === "all") return true;
    if (filter === "new") return r.status === "new";
    return r.category === filter;
  });

  /* ── Stats ── */
  const total     = rows.length;
  const newCount  = rows.filter(r => r.status === "new").length;
  const bugCount  = rows.filter(r => r.category === "bug").length;
  const byCategory = Object.fromEntries(
    Object.keys(CAT_CFG).map(k => [k, rows.filter(r => r.category === k).length])
  );

  return (
    <div className="min-h-screen" style={{ background: "#F9F7F2" }}>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(197,160,89,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MessageCirclePlus size={20} color="#C5A059" />
            </div>
            <div>
              <h1 style={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 700, color: "#1a1714", margin: 0 }}>Beta Feedback</h1>
              <p style={{ fontSize: 12, color: "#9ca3af", margin: "2px 0 0" }}>
                {total} total · {newCount} unreviewed
                {isSuperAdmin ? " · All clinics" : ""}
              </p>
            </div>
          </div>
          <button onClick={fetchFeedback} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(197,160,89,0.2)", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RefreshCw size={14} color="#9ca3af" />
          </button>
        </div>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          {Object.entries(CAT_CFG).map(([key, cfg]) => (
            <div key={key} style={{ background: "white", borderRadius: 14, padding: "14px 16px", border: "1px solid #f3f4f6", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ color: cfg.color }}>{cfg.icon}</span>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>{cfg.label}</p>
              </div>
              <p style={{ fontSize: 26, fontWeight: 800, color: "#1a1714", margin: 0, lineHeight: 1 }}>{byCategory[key] ?? 0}</p>
            </div>
          ))}
        </div>

        {/* Filter chips */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {([
            { key: "all",        label: `All (${total})` },
            { key: "new",        label: `Unreviewed (${newCount})` },
            { key: "bug",        label: `Bugs (${bugCount})` },
            { key: "suggestion", label: "Suggestions" },
            { key: "confusion",  label: "Confusion" },
            { key: "compliment", label: "Compliments" },
          ] as const).map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              style={{
                padding: "5px 14px", borderRadius: 20, border: "1px solid rgba(197,160,89,0.2)",
                background: filter === f.key ? "rgba(197,160,89,0.12)" : "white",
                fontSize: 12, fontWeight: filter === f.key ? 700 : 500,
                color: filter === f.key ? "#92702A" : "#6b7280", cursor: "pointer",
                borderColor: filter === f.key ? "rgba(197,160,89,0.4)" : "rgba(197,160,89,0.2)",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Feedback list */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ height: 88, borderRadius: 14, background: "rgba(197,160,89,0.06)", animation: "pulse 1.4s infinite" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "white", borderRadius: 14, padding: "48px 24px", textAlign: "center", border: "1px solid #f3f4f6" }}>
            <MessageCirclePlus size={28} color="#d1d5db" style={{ margin: "0 auto 10px" }} />
            <p style={{ fontSize: 14, color: "#9ca3af" }}>No feedback yet</p>
            <p style={{ fontSize: 12, color: "#d1d5db", marginTop: 4 }}>Feedback submitted by clinic staff will appear here.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map(row => {
              const cat = CAT_CFG[row.category] ?? CAT_CFG.suggestion;
              const st  = STATUS_CFG[row.status] ?? STATUS_CFG.new;
              return (
                <div key={row.id} style={{
                  background: "white", borderRadius: 14, padding: "14px 16px",
                  border: "1px solid #f3f4f6", boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
                  display: "flex", alignItems: "flex-start", gap: 12,
                  opacity: row.status === "resolved" ? 0.6 : 1, transition: "opacity 0.15s",
                }}>
                  {/* Category icon */}
                  <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: cat.bg, display: "flex", alignItems: "center", justifyContent: "center", color: cat.color }}>
                    {cat.icon}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: cat.color, background: cat.bg, padding: "2px 8px", borderRadius: 10 }}>{cat.label}</span>
                      {row.page_url && (
                        <span style={{ fontSize: 10, color: "#9ca3af", background: "#f9f7f2", padding: "2px 8px", borderRadius: 10 }}>{row.page_url}</span>
                      )}
                      {isSuperAdmin && row.clinics?.name && (
                        <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 600 }}>{row.clinics.name}</span>
                      )}
                      <span style={{ fontSize: 10, color: "#d1d5db", marginLeft: "auto" }}>
                        <Clock size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: 2 }} />
                        {timeAgo(row.created_at)}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: "#1a1714", margin: "0 0 4px", lineHeight: 1.5 }}>{row.message}</p>
                    <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>
                      from <strong>{row.user_name ?? "Unknown"}</strong>
                    </p>
                  </div>

                  {/* Status control */}
                  <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: st.color, background: st.bg, padding: "3px 10px", borderRadius: 10 }}>{st.label}</span>
                    {row.status !== "resolved" && (
                      <button
                        onClick={() => updateStatus(row.id, row.status === "new" ? "reviewed" : "resolved")}
                        disabled={updating === row.id}
                        style={{
                          display: "flex", alignItems: "center", gap: 4, padding: "4px 10px",
                          borderRadius: 8, border: "1px solid rgba(197,160,89,0.2)", background: "none",
                          cursor: "pointer", fontSize: 10, fontWeight: 600, color: "#92702A",
                        }}
                      >
                        {updating === row.id
                          ? <span style={{ width: 10, height: 10, border: "1.5px solid rgba(197,160,89,0.4)", borderTopColor: "#C5A059", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                          : row.status === "new"
                            ? <><Check size={10} /> Mark reviewed</>
                            : <><CheckCircle2 size={10} /> Resolve</>
                        }
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
