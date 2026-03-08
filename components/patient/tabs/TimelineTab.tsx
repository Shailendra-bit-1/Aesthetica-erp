"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Calendar, Stethoscope, Receipt, User, Package, MessageSquare,
  Target, AlertTriangle, CheckCircle2, Clock, Loader2,
} from "lucide-react";
import { Patient, fmtDate } from "../types";

interface Props {
  patient: Patient;
  clinicId: string;
}

interface TimelineEvent {
  id: string;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  summary: string | null;
  actor_name: string | null;
  created_at: string;
}

const EVENT_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; color: string; bg: string }> = {
  appointment_booked:    { label: "Appointment Booked",    icon: Calendar,      color: "#2563EB", bg: "#EFF6FF" },
  appointment_cancelled: { label: "Appointment Cancelled", icon: AlertTriangle, color: "#DC2626", bg: "#FEF2F2" },
  appointment_arrived:   { label: "Patient Arrived",       icon: CheckCircle2,  color: "#16A34A", bg: "#F0FDF4" },
  appointment_no_show:   { label: "No Show",               icon: AlertTriangle, color: "#D97706", bg: "#FFFBEB" },
  treatment_done:        { label: "Treatment Completed",   icon: Stethoscope,   color: "#7C3AED", bg: "#F5F3FF" },
  invoice_paid:          { label: "Invoice Paid",          icon: Receipt,       color: "#16A34A", bg: "#F0FDF4" },
  patient_created:       { label: "Patient Registered",    icon: User,          color: "#0B2A4A", bg: "#EFF4FB" },
  package_purchased:     { label: "Package Purchased",     icon: Package,       color: "#0891B2", bg: "#ECFEFF" },
  consultation_started:  { label: "Consultation Started",  icon: Stethoscope,   color: "#6366F1", bg: "#EEF2FF" },
  counselling_created:   { label: "Counselling Session",   icon: MessageSquare, color: "#D97706", bg: "#FFFBEB" },
  lead_converted:        { label: "Lead Converted",        icon: Target,        color: "#16A34A", bg: "#F0FDF4" },
};

function getConfig(eventType: string) {
  return EVENT_CONFIG[eventType] ?? {
    label: eventType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    icon: Clock, color: "#64748B", bg: "#F9FAFB",
  };
}

export default function TimelineTab({ patient, clinicId }: Props) {
  const [events,  setEvents]  = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("patient_events")
      .select("id, event_type, entity_type, entity_id, summary, actor_name, created_at")
      .eq("patient_id", patient.id)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => { setEvents(data ?? []); setLoading(false); });
  }, [patient.id, clinicId]);

  if (loading) return (
    <div style={{ padding: 40, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text-muted)" }}>
      <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Loading timeline…
    </div>
  );

  if (events.length === 0) return (
    <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
      <Clock size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
      <p style={{ fontSize: 14, fontWeight: 500 }}>No activity recorded yet</p>
      <p style={{ fontSize: 12, marginTop: 4 }}>Events will appear here as the patient's journey progresses.</p>
    </div>
  );

  // Group by date
  const grouped: Record<string, TimelineEvent[]> = {};
  for (const e of events) {
    const day = new Date(e.created_at).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(e);
  }

  return (
    <div style={{ padding: "20px 24px", maxWidth: 720 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Activity Timeline</h3>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{events.length} events recorded</p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {Object.entries(grouped).map(([day, dayEvents]) => (
          <div key={day}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-secondary)" }}>{day}</span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 8 }}>
              {dayEvents.map((evt, i) => {
                const cfg = getConfig(evt.event_type);
                const Icon = cfg.icon;
                return (
                  <div key={evt.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    {/* Timeline line */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, paddingTop: 2 }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", border: `1.5px solid ${cfg.color}22` }}>
                        <Icon size={13} style={{ color: cfg.color }} />
                      </div>
                      {i < dayEvents.length - 1 && <div style={{ width: 1, height: 20, background: "var(--border)", marginTop: 4 }} />}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, paddingBottom: i < dayEvents.length - 1 ? 8 : 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{cfg.label}</span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          {new Date(evt.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {evt.actor_name && (
                          <span style={{ fontSize: 11, color: "var(--text-secondary)", background: "var(--surface-muted)", padding: "1px 8px", borderRadius: 20 }}>
                            by {evt.actor_name}
                          </span>
                        )}
                      </div>
                      {evt.summary && (
                        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "3px 0 0", lineHeight: 1.5 }}>{evt.summary}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
