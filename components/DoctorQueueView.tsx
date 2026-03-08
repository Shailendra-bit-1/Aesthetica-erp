"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Clock, CheckCircle2, AlertTriangle, User, Loader2, RefreshCw } from "lucide-react";

interface QueueEntry {
  id: string;
  patient_name: string | null;
  service_name: string | null;
  start_time: string;
  status: string;
  provider_name: string | null;
  room_id: string | null;
}

interface Props {
  clinicId: string;
  providerId?: string | null;   // filter to one provider if set
  date?: string;                // YYYY-MM-DD, defaults to today
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: "Waiting",    color: "#D97706", bg: "#FFFBEB" },
  arrived:   { label: "Arrived",    color: "#2563EB", bg: "#EFF6FF" },
  in_session:{ label: "In Session", color: "#7C3AED", bg: "#F5F3FF" },
  completed: { label: "Done",       color: "#16A34A", bg: "#F0FDF4" },
  cancelled: { label: "Cancelled",  color: "#6B7280", bg: "#F9FAFB" },
  no_show:   { label: "No Show",    color: "#DC2626", bg: "#FEF2F2" },
};

export default function DoctorQueueView({ clinicId, providerId, date }: Props) {
  const today = date ?? new Date().toISOString().slice(0, 10);
  const [queue,   setQueue]   = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("appointments")
      .select("id, patient_name, service_name, start_time, status, provider_name, room_id")
      .eq("clinic_id", clinicId)
      .gte("start_time", `${today}T00:00:00`)
      .lt("start_time",  `${today}T23:59:59`)
      .not("status", "in", '("cancelled","no_show")')
      .order("start_time");

    if (providerId) query = query.eq("provider_id", providerId);

    const { data } = await query;
    setQueue(data ?? []);
    setLoading(false);
  }, [clinicId, providerId, today]);

  useEffect(() => { load(); }, [load]);

  const waiting   = queue.filter(q => q.status === "scheduled");
  const active    = queue.filter(q => q.status === "arrived" || q.status === "in_session");
  const completed = queue.filter(q => q.status === "completed");

  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 18px", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>Today's Queue</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: 0 }}>
            {new Date(today).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { label: "Waiting",  count: waiting.length,   color: "#FDE68A" },
              { label: "Active",   count: active.length,    color: "#A5B4FC" },
              { label: "Done",     count: completed.length, color: "#86EFAC" },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <p style={{ fontSize: 18, fontWeight: 800, color: s.color, margin: 0, lineHeight: 1 }}>{s.count}</p>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", margin: 0 }}>{s.label}</p>
              </div>
            ))}
          </div>
          <button onClick={load} style={{ border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.1)", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "#fff", display: "flex", alignItems: "center" }}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Queue list */}
      <div style={{ maxHeight: 400, overflowY: "auto" }}>
        {loading ? (
          <div style={{ padding: 32, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text-muted)" }}>
            <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Loading queue…
          </div>
        ) : queue.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
            <Clock size={24} style={{ margin: "0 auto 8px", opacity: 0.3 }} />
            <p style={{ fontSize: 13 }}>No appointments today</p>
          </div>
        ) : (
          queue.map((entry, i) => {
            const cfg = STATUS_CFG[entry.status] ?? STATUS_CFG.scheduled;
            const time = new Date(entry.start_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
            return (
              <div key={entry.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 18px",
                borderBottom: i < queue.length - 1 ? "1px solid var(--border)" : "none",
                background: entry.status === "in_session" ? "rgba(124,58,237,0.03)" : "transparent",
              }}>
                {/* Position number */}
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", flexShrink: 0 }}>
                  {i + 1}
                </div>

                {/* Time */}
                <div style={{ textAlign: "center", minWidth: 48, flexShrink: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{time}</p>
                </div>

                {/* Patient + service */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {entry.patient_name ?? "Walk-in"}
                  </p>
                  {entry.service_name && (
                    <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.service_name}</p>
                  )}
                </div>

                {/* Provider */}
                {!providerId && entry.provider_name && (
                  <span style={{ fontSize: 11, color: "var(--text-secondary)", flexShrink: 0, display: "flex", alignItems: "center", gap: 3 }}>
                    <User size={10} /> {entry.provider_name}
                  </span>
                )}

                {/* Status */}
                <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: cfg.bg, color: cfg.color, flexShrink: 0 }}>
                  {cfg.label}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
