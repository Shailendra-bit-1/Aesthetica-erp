"use client";

import { useState, useEffect } from "react";
import { Calendar, Clock, User, CheckCircle2, XCircle, AlertCircle, MinusCircle, ExternalLink, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Patient, fmtDate, fmtDateTime } from "../types";

interface Appointment {
  id: string;
  start_time: string;
  end_time: string | null;
  service_name: string;
  status: string;
  notes: string | null;
  cancellation_reason: string | null;
  provider: { full_name: string } | null;
}

interface Props {
  patient: Patient;
  clinicId: string;
}

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; border: string; icon: React.ElementType }> = {
  scheduled:  { label: "Scheduled",  bg: "rgba(59,130,246,0.08)",  text: "#1D4ED8", border: "rgba(59,130,246,0.3)",  icon: Clock },
  confirmed:  { label: "Confirmed",  bg: "rgba(99,102,241,0.08)",  text: "#4338CA", border: "rgba(99,102,241,0.3)",  icon: CheckCircle2 },
  completed:  { label: "Completed",  bg: "rgba(16,185,129,0.08)",  text: "#065F46", border: "rgba(16,185,129,0.3)",  icon: CheckCircle2 },
  cancelled:  { label: "Cancelled",  bg: "rgba(107,114,128,0.08)", text: "#374151", border: "rgba(107,114,128,0.3)", icon: XCircle },
  no_show:    { label: "No Show",    bg: "rgba(220,38,38,0.08)",   text: "#991B1B", border: "rgba(220,38,38,0.3)",   icon: AlertCircle },
};

function relDay(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff < 0) return fmtDate(iso);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  return fmtDate(iso);
}

export default function AppointmentsTab({ patient, clinicId }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("appointments")
        .select("id, start_time, end_time, service_name, status, notes, cancellation_reason, provider:profiles!provider_id(full_name)")
        .eq("patient_id", patient.id)
        .eq("clinic_id", clinicId)
        .order("start_time", { ascending: false });
      setAppointments((data ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        provider: Array.isArray(r.provider) ? (r.provider[0] ?? null) : (r.provider ?? null),
      })) as unknown as Appointment[]);
      setLoading(false);
    }
    load();
  }, [patient.id, clinicId]);

  const total      = appointments.length;
  const completed  = appointments.filter(a => a.status === "completed").length;
  const noShow     = appointments.filter(a => a.status === "no_show").length;
  const cancelled  = appointments.filter(a => a.status === "cancelled").length;

  const kpis = [
    { label: "Total",      value: total,     color: "#C5A059" },
    { label: "Completed",  value: completed,  color: "#10B981" },
    { label: "No Shows",   value: noShow,     color: "#DC2626" },
    { label: "Cancelled",  value: cancelled,  color: "#6B7280" },
  ];

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Calendar size={13} color="#C5A059" />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280" }}>Appointment History</span>
        </div>
        <a
          href={`/scheduler?patient=${patient.id}`}
          style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.35)", background: "rgba(197,160,89,0.07)", color: "#C5A059", textDecoration: "none" }}
        >
          <ExternalLink size={12} /> Book New Appointment
        </a>
      </div>

      {/* KPI chips */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {kpis.map(({ label, value, color }) => (
          <div key={label} style={{ padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid rgba(197,160,89,0.15)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "Georgia, serif", color }}>{value}</div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9CA3AF", fontWeight: 600, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Timeline list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: "#9CA3AF", fontSize: 13 }}>Loading appointments…</div>
      ) : appointments.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <Calendar size={32} color="rgba(197,160,89,0.3)" style={{ margin: "0 auto 10px" }} />
          <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>No appointments on record</p>
          <p style={{ fontSize: 12, color: "#C5A059", marginTop: 4 }}>
            <a href={`/scheduler?patient=${patient.id}`} style={{ color: "#C5A059" }}>Book the first appointment →</a>
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {appointments.map(appt => {
            const cfg = STATUS_CFG[appt.status] ?? STATUS_CFG.scheduled;
            const Icon = cfg.icon;
            return (
              <div key={appt.id} style={{ padding: "14px 16px", borderRadius: 12, background: "#fff", border: "1px solid rgba(197,160,89,0.15)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Service name + date */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "Georgia, serif", color: "#1C1917" }}>{appt.service_name}</span>
                      <span style={{ fontSize: 11, color: "#9CA3AF" }}>·</span>
                      <span style={{ fontSize: 12, color: "#6B7280" }}>{relDay(appt.start_time)}</span>
                    </div>
                    {/* Time + provider */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 5, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={11} color="#9CA3AF" />
                        <span style={{ fontSize: 12, color: "#6B7280" }}>
                          {new Date(appt.start_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          {appt.end_time && ` – ${new Date(appt.end_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`}
                        </span>
                      </div>
                      {appt.provider?.full_name && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <User size={11} color="#9CA3AF" />
                          <span style={{ fontSize: 12, color: "#6B7280" }}>{appt.provider.full_name}</span>
                        </div>
                      )}
                    </div>
                    {/* Notes */}
                    {appt.notes && (
                      <p style={{ fontSize: 12, color: "#6B7280", margin: "6px 0 0", fontStyle: "italic" }}>{appt.notes}</p>
                    )}
                    {/* Cancellation reason */}
                    {appt.cancellation_reason && (
                      <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
                        <MinusCircle size={11} color="#DC2626" />
                        <span style={{ fontSize: 12, color: "#991B1B" }}>Reason: {appt.cancellation_reason}</span>
                      </div>
                    )}
                  </div>
                  {/* Status badge + follow-up */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                      <Icon size={11} color={cfg.text} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: cfg.text }}>{cfg.label}</span>
                    </div>
                    {appt.status === "completed" && (
                      <a
                        href={`/scheduler?patient=${patient.id}&service=${encodeURIComponent(appt.service_name)}`}
                        style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.06)", color: "#C5A059", textDecoration: "none" }}
                      >
                        <RefreshCw size={9} /> Follow-up
                      </a>
                    )}
                  </div>
                </div>
                {/* Full date line */}
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(197,160,89,0.1)", fontSize: 11, color: "#9CA3AF" }}>
                  {fmtDateTime(appt.start_time)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
