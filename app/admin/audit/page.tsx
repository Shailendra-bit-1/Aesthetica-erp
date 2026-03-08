"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  ScrollText,
  Search,
  RefreshCw,
  Crown,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { PERMISSION_LABELS, type StaffPermissions } from "@/lib/permissions";
import { useClinic } from "@/contexts/ClinicContext";

// ── Types ─────────────────────────────────────────────────────────────────────

type AuditEntry = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  target_id: string | null;
  target_name: string | null;
  action: string;
  permission_key: string | null;
  old_value: boolean | null;
  new_value: boolean | null;
  created_at: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function permLabel(key: string | null): string {
  if (!key) return "—";
  return (
    PERMISSION_LABELS[key as keyof StaffPermissions]?.label ?? key
  );
}

function ValuePill({ value }: { value: boolean | null }) {
  if (value === null) return <span style={{ color: "#8A8078" }}>—</span>;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        background: value ? "rgba(126,200,138,0.15)" : "rgba(200,138,126,0.15)",
        color: value ? "#4E9A5A" : "#9A4E4E",
        border: `1px solid ${value ? "rgba(126,200,138,0.35)" : "rgba(200,138,126,0.35)"}`,
      }}
    >
      {value ? "ON" : "OFF"}
    </span>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60_000);
  const hrs = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const { profile } = useClinic();

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500);
      if (dateFrom) q = q.gte("created_at", dateFrom);
      if (dateTo)   q = q.lte("created_at", dateTo + "T23:59:59");
      // Non-superadmin users only see their own clinic's audit log
      if (profile?.role !== "superadmin" && profile?.clinic_id) {
        q = q.eq("clinic_id", profile.clinic_id);
      }
      const { data } = await q;
      setEntries(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, profile?.role, profile?.clinic_id]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filtered = entries.filter((e) => {
    if (search) {
      const q = search.toLowerCase();
      if (!e.actor_name?.toLowerCase().includes(q) &&
          !e.target_name?.toLowerCase().includes(q) &&
          !(e.permission_key && permLabel(e.permission_key).toLowerCase().includes(q)) &&
          !e.action?.toLowerCase().includes(q)) return false;
    }
    if (actionFilter && e.action !== actionFilter) return false;
    return true;
  });

  const uniqueActions = Array.from(new Set(entries.map(e => e.action))).sort();

  return (
    <div className="min-h-full" style={{ background: "var(--background)" }}>


      <div className="px-8 pb-12">
        {/* Hero */}
        <div
          className="rounded-2xl px-8 py-8 mb-8 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #1C1917 0%, #2C2520 100%)",
            border: "1px solid rgba(197,160,89,0.2)",
          }}
        >
          <div style={{ position: "absolute", top: -50, right: -50, width: 160, height: 160, borderRadius: "50%", border: "1px solid rgba(197,160,89,0.07)" }} />
          <div style={{ position: "absolute", top: -20, right: -20, width: 110, height: 110, borderRadius: "50%", border: "1px solid rgba(197,160,89,0.1)" }} />

          <div className="flex items-center gap-4 relative">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(197,160,89,0.15)", border: "1px solid rgba(197,160,89,0.3)" }}
            >
              <ScrollText size={20} color="#C5A059" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest font-semibold mb-0.5" style={{ color: "rgba(197,160,89,0.6)" }}>
                Superadmin Console
              </p>
              <h1 className="text-2xl font-semibold" style={{ color: "#F9F7F2", fontFamily: "Georgia, serif" }}>
                Audit Trail
              </h1>
            </div>
          </div>
          <p className="text-sm mt-3 relative" style={{ color: "rgba(232,226,212,0.5)", maxWidth: 400 }}>
            Every permission change made via System Override is recorded here, permanently.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Total Events",   value: entries.length                                              },
            { label: "Unique Staff",   value: new Set(entries.map(e => e.target_id)).size                 },
            { label: "Last 24h",       value: entries.filter(e => Date.now() - new Date(e.created_at).getTime() < 86_400_000).length },
          ].map(({ label, value }) => (
            <div key={label} className="luxury-card rounded-2xl p-5" style={{ background: "var(--surface)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
                {label}
              </p>
              <p className="text-3xl font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
                {loading ? "—" : value}
              </p>
            </div>
          ))}
        </div>

        {/* Log table */}
        <div
          className="luxury-card rounded-2xl overflow-hidden"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          {/* Toolbar */}
          <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                <Search size={14} />
                <input type="text" placeholder="Search actor, action, target…" value={search} onChange={e => setSearch(e.target.value)}
                  style={{ border: "none", background: "transparent", outline: "none", fontSize: 13, color: "var(--foreground)", width: 220, fontFamily: "Georgia, serif" }} />
              </div>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, background: "var(--surface)", color: "var(--foreground)" }} />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>to</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, background: "var(--surface)", color: "var(--foreground)" }} />
              <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
                style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, background: "var(--surface)", color: "var(--foreground)" }}>
                <option value="">All actions</option>
                {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              {profile?.role !== "superadmin" && (
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "rgba(197,160,89,0.1)", color: "#8B6914" }}>Clinic-scoped view</span>
              )}
            </div>
          </div>
          <div className="flex justify-end px-6 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <button onClick={fetchLogs}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          {/* Table */}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#FDFCF8" }}>
                {["Time", "Actor", "Staff Member", "Permission", "Change", ""].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "12px 20px",
                      textAlign: "left",
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase" as const,
                      letterSpacing: "0.1em",
                      color: "#8A8078",
                      borderBottom: "1px solid #F0EBE2",
                      whiteSpace: "nowrap" as const,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F5F2EC" }}>
                    {[...Array(6)].map((__, j) => (
                      <td key={j} style={{ padding: "14px 20px" }}>
                        <div
                          className="animate-pulse rounded"
                          style={{ height: 13, background: "rgba(197,160,89,0.07)", width: j === 0 ? 70 : 120 }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "56px 20px", textAlign: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 14,
                          background: "rgba(197,160,89,0.07)",
                          border: "1px solid rgba(197,160,89,0.18)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <ShieldCheck size={22} color="#C5A059" />
                      </div>
                      <p style={{ fontFamily: "Georgia, serif", color: "#1A1A1A", fontSize: 15, fontWeight: 600 }}>
                        {search ? "No matching events" : "No audit events yet"}
                      </p>
                      <p style={{ fontSize: 12, color: "#8A8078", maxWidth: 300, textAlign: "center" }}>
                        {search
                          ? "Try a different search term."
                          : "Audit entries appear here whenever you use System Override to change staff permissions."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((entry, i) => (
                  <tr
                    key={entry.id}
                    style={{
                      borderBottom: i < filtered.length - 1 ? "1px solid #F5F2EC" : "none",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLTableRowElement).style.background = "#FDFCF8")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")
                    }
                  >
                    {/* Time */}
                    <td style={{ padding: "13px 20px", whiteSpace: "nowrap" }}>
                      <p style={{ fontSize: 12, color: "#8A8078" }}>
                        {formatRelative(entry.created_at)}
                      </p>
                      <p style={{ fontSize: 10, color: "#A89E94", marginTop: 1 }}>
                        {new Date(entry.created_at).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </td>

                    {/* Actor */}
                    <td style={{ padding: "13px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: "50%",
                            background: "rgba(197,160,89,0.15)",
                            border: "1px solid rgba(197,160,89,0.3)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Crown size={12} color="#C5A059" />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A", fontFamily: "Georgia, serif" }}>
                          {entry.actor_name ?? "Superadmin"}
                        </span>
                      </div>
                    </td>

                    {/* Target */}
                    <td style={{ padding: "13px 20px" }}>
                      <span style={{ fontSize: 13, color: "#1A1A1A", fontFamily: "Georgia, serif" }}>
                        {entry.target_name ?? "—"}
                      </span>
                    </td>

                    {/* Permission */}
                    <td style={{ padding: "13px 20px" }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#6A5A48",
                          background: "rgba(197,160,89,0.08)",
                          border: "1px solid rgba(197,160,89,0.18)",
                          borderRadius: 6,
                          padding: "3px 8px",
                          fontFamily: "Georgia, serif",
                        }}
                      >
                        {permLabel(entry.permission_key)}
                      </span>
                    </td>

                    {/* Change */}
                    <td style={{ padding: "13px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <ValuePill value={entry.old_value} />
                        <ArrowRight size={12} color="#8A8078" />
                        <ValuePill value={entry.new_value} />
                      </div>
                    </td>

                    {/* Action label */}
                    <td style={{ padding: "13px 20px" }}>
                      <span style={{ fontSize: 10, color: "#A89E94", fontFamily: "Georgia, serif", fontStyle: "italic" }}>
                        {entry.action?.replace(/_/g, " ")}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {!loading && filtered.length > 0 && (
            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid #F0EBE2",
                background: "#FDFCF8",
                fontSize: 11,
                color: "#A89E94",
                fontFamily: "Georgia, serif",
                fontStyle: "italic",
              }}
            >
              {filtered.length} event{filtered.length !== 1 ? "s" : ""}
              {search && ` matching "${search}"`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
