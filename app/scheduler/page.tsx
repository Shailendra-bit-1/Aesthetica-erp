"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { logAction } from "@/lib/audit";
import {
  ChevronLeft, ChevronRight, Plus, Settings, Eye, EyeOff,
  Clock, User, Users, X, AlertCircle, Loader2, Zap,
  Star, RefreshCw, Bell, Shield, Search, Scissors,
  CheckCircle2, XCircle, UserCheck, PhoneOff, CalendarCheck,
  AlertTriangle, Package, Calendar, MapPin, Edit2, Trash2,
  ChevronDown, Send, Check, Receipt, IndianRupee, CreditCard, GripVertical, CalendarClock,
  Printer, Ban,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { withSupabaseRetry } from "@/lib/withRetry";
import { useClinic } from "@/contexts/ClinicContext";
import { toast } from "sonner";
import { ModuleGate } from "@flags/gate";
import CustomFieldsSection from "@/components/CustomFieldsSection";

// ── Types ─────────────────────────────────────────────────────────────────────

type AppointmentStatus =
  | "planned" | "confirmed" | "arrived"
  | "in_session" | "completed" | "cancelled" | "no_show";
type PatientTier = "vip" | "hni" | "standard";
type CalendarView = "day" | "week" | "month" | "list";

interface Appointment {
  id: string;
  clinic_id: string;
  patient_id: string | null;
  provider_id: string | null;
  service_id: string | null;
  credit_id: string | null;
  service_name: string;
  room: string | null;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  notes: string | null;
  credit_reserved: boolean;
  // joined
  patient_name: string;
  patient_tier: PatientTier | null;
  provider_name: string;
}

interface Provider {
  id: string;
  full_name: string;
  role: string;
}

interface Service {
  id: string;
  name: string;
  category: string;
  duration_minutes: number;
  selling_price: number;
}

interface SchedulerSettings {
  id: string;
  clinic_id: string;
  enable_double_booking: boolean;
  buffer_time_minutes: number;
  credit_lock: boolean;
  working_start: string;
  working_end: string;
  slot_duration_minutes: number;
}

interface PatientCredit {
  id: string;
  service_name: string;
  total_sessions: number;
  used_sessions: number;
  per_session_value: number;
  status: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const HOUR_HEIGHT = 68; // px per hour in time grid
const WORKING_START = 8;
const WORKING_END = 21;
const TOTAL_HOURS = WORKING_END - WORKING_START;
const GRID_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT;

const STATUS_CFG: Record<AppointmentStatus, {
  label: string; bg: string; border: string; text: string; dot: string; icon: React.ElementType;
}> = {
  planned:    { label: "Scheduled",   bg: "#FDF9F2", border: "#C5A059", text: "#1C1917", dot: "#C5A059",  icon: Calendar     },
  confirmed:  { label: "Confirmed",  bg: "#EFF6EF", border: "#4A8A4A", text: "#1C3A1C", dot: "#4A8A4A",  icon: CheckCircle2 },
  arrived:    { label: "Checked In", bg: "#EEF2FA", border: "#2A4A8A", text: "#1A2A5A", dot: "#2A4A8A",  icon: UserCheck    },
  in_session: { label: "In Session", bg: "#FFF8E8", border: "#D4A017", text: "#1C1917", dot: "#D4A017",  icon: Zap          },
  completed:  { label: "Completed",  bg: "#F5F5F3", border: "#9C9584", text: "#6B6358", dot: "#9C9584",  icon: CheckCircle2 },
  cancelled:  { label: "Cancelled",  bg: "#FEF2F2", border: "#B43C3C", text: "#7A1C1C", dot: "#B43C3C",  icon: XCircle      },
  no_show:    { label: "No Show",    bg: "#FEF2F2", border: "#B43C3C", text: "#7A1C1C", dot: "#EF4444",  icon: PhoneOff     },
};

// GAP-38: Provider color palette (10 distinct colors for provider-based coloring)
const PROVIDER_PALETTE = [
  { bg: "#EFF6FF", border: "#2563EB", text: "#1E3A8A" },
  { bg: "#F0FDF4", border: "#16A34A", text: "#14532D" },
  { bg: "#FDF4FF", border: "#9333EA", text: "#581C87" },
  { bg: "#FFF7ED", border: "#EA580C", text: "#7C2D12" },
  { bg: "#F0F9FF", border: "#0891B2", text: "#164E63" },
  { bg: "#FFF1F2", border: "#E11D48", text: "#881337" },
  { bg: "#F7FEE7", border: "#65A30D", text: "#3F6212" },
  { bg: "#FEF9C3", border: "#CA8A04", text: "#713F12" },
  { bg: "#F5F3FF", border: "#7C3AED", text: "#3B0764" },
  { bg: "#FFF5F5", border: "#DC2626", text: "#7F1D1D" },
];

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function fmtTime(d: Date) {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function isToday(d: Date) { return isSameDay(d, new Date()); }

function apptTop(startTime: string): number {
  const d = new Date(startTime);
  const mins = d.getHours() * 60 + d.getMinutes() - WORKING_START * 60;
  return Math.max(0, (mins / 60) * HOUR_HEIGHT);
}

function apptHeight(startTime: string, endTime: string): number {
  const ms = new Date(endTime).getTime() - new Date(startTime).getTime();
  return Math.max(26, (ms / 3600000) * HOUR_HEIGHT);
}

// B6: Recall interval by service name keywords
function calcRecallDays(serviceName: string): number {
  const s = (serviceName ?? "").toLowerCase();
  if (s.includes("botox") || s.includes("wrinkle") || s.includes("prp")) return 90;
  if (s.includes("filler") || s.includes("lip") || s.includes("cheek")) return 180;
  if (s.includes("laser") || s.includes("ipl") || s.includes("rf")) return 30;
  if (s.includes("peel") || s.includes("facial") || s.includes("hydra")) return 60;
  if (s.includes("body") || s.includes("contour") || s.includes("cavita")) return 120;
  return 90; // default
}

// WhatsApp placeholder — calls Edge Function
async function sendWhatsAppReminder(appointmentId: string) {
  try {
    const { error } = await supabase.functions.invoke("send-whatsapp-reminder", {
      body: { appointment_id: appointmentId },
    });
    if (error) throw error;
    toast.success("WhatsApp reminder queued ✓");
  } catch {
    toast.info("WhatsApp reminder queued (Edge Function active — integrate WhatsApp Business API)");
  }
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function SchedulerPageInner() {
  const { profile, activeClinicId, loading: profileLoading } = useClinic();
  const isAdmin = ["superadmin","chain_admin","clinic_admin"].includes(profile?.role ?? "");

  const [view, setView]             = useState<CalendarView>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [privacyMode, setPrivacyMode] = useState(false);

  const [appointments,  setAppointments]  = useState<Appointment[]>([]);
  const [providers,     setProviders]     = useState<Provider[]>([]);
  const [services,      setServices]      = useState<Service[]>([]);
  const [settings,      setSettings]      = useState<SchedulerSettings | null>(null);
  const [blockedSlots,  setBlockedSlots]  = useState<{ id: string; provider_id: string | null; start_time: string; end_time: string; reason: string | null }[]>([]);
  const [loading,      setLoading]      = useState(true);

  const [selectedAppt,  setSelectedAppt]  = useState<Appointment | null>(null);
  const [showNewAppt,   setShowNewAppt]   = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);
  // GAP-25: Block time
  const [showBlockTime, setShowBlockTime] = useState(false);
  const [prefillSlot,   setPrefillSlot]   = useState<{ date: Date; hour: number; providerId?: string } | null>(null);
  const [schedulerTab,  setSchedulerTab]  = useState<"calendar" | "waitlist" | "recalls">("calendar");

  // GAP-37: Calendar filter state
  const [filterProvider, setFilterProvider] = useState<string>("all");
  const [filterStatus,   setFilterStatus]   = useState<string>("all");
  // GAP-38: Color-by toggle
  const [colorBy, setColorBy] = useState<"status" | "provider">("status");

  // Date range for current view
  const viewRange = useMemo(() => {
    if (view === "day") {
      const s = new Date(currentDate); s.setHours(0,0,0,0);
      const e = new Date(currentDate); e.setHours(23,59,59,999);
      return { start: s, end: e };
    }
    if (view === "week") {
      const s = startOfWeek(currentDate); s.setHours(0,0,0,0);
      const e = addDays(s, 6);           e.setHours(23,59,59,999);
      return { start: s, end: e };
    }
    const s = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const e = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    e.setHours(23,59,59,999);
    return { start: s, end: e };
  }, [view, currentDate]);

  const fetchAll = useCallback(async () => {
    if (!activeClinicId) return;
    setLoading(true);
    const [apptRes, provRes, svcRes, settRes, blkRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("*, patients!patient_id(full_name,patient_tier), profiles!provider_id(full_name)")
        .eq("clinic_id", activeClinicId)
        .gte("start_time", viewRange.start.toISOString())
        .lte("start_time", viewRange.end.toISOString())
        .neq("status", "cancelled")
        .order("start_time"),
      supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("clinic_id", activeClinicId)
        .eq("is_active", true)
        .in("role", ["doctor","therapist","counsellor"])
        .order("full_name"),
      supabase
        .from("services")
        .select("id, name, category, duration_minutes, selling_price")
        .or(`clinic_id.eq.${activeClinicId},is_global_template.eq.true`)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("scheduler_settings")
        .select("*")
        .eq("clinic_id", activeClinicId)
        .maybeSingle(),
      // GAP-25: Fetch blocked slots for current view range
      supabase
        .from("blocked_slots")
        .select("id, provider_id, start_time, end_time, reason")
        .eq("clinic_id", activeClinicId)
        .gte("start_time", viewRange.start.toISOString())
        .lte("end_time", viewRange.end.toISOString()),
    ]);

    const normalised: Appointment[] = (apptRes.data ?? []).map((a: Record<string,unknown>) => ({
      ...a,
      patient_name: (a.patients as { full_name: string } | null)?.full_name ?? "Walk-in",
      patient_tier: (a.patients as { patient_tier: PatientTier } | null)?.patient_tier ?? "standard",
      provider_name: (a.profiles as { full_name: string } | null)?.full_name ?? "—",
    })) as Appointment[];

    setAppointments(normalised);
    setProviders((provRes.data ?? []) as Provider[]);
    setServices((svcRes.data ?? []) as Service[]);
    setSettings(settRes.data as SchedulerSettings | null);
    setBlockedSlots((blkRes.data ?? []) as { id: string; provider_id: string | null; start_time: string; end_time: string; reason: string | null }[]);
    setLoading(false);
  }, [activeClinicId, viewRange]);

  useEffect(() => { if (!profileLoading) fetchAll(); }, [profileLoading, fetchAll]);

  async function handleDragAppt(apptId: string, newStart: Date) {
    const appt = appointments.find(a => a.id === apptId);
    if (!appt) return;
    const duration = new Date(appt.end_time).getTime() - new Date(appt.start_time).getTime();
    const newEnd   = new Date(newStart.getTime() + duration);
    const { error } = await supabase.from("appointments").update({
      start_time: newStart.toISOString(),
      end_time:   newEnd.toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", apptId);
    if (error) toast.error("Could not move appointment");
    else { toast.success("Appointment moved"); fetchAll(); }
  }

  async function handleQuickAction(apptId: string, status: AppointmentStatus) {
    // M5: "completed" must go through full checkout modal (credit + commission)
    if (status === "completed") {
      const appt = appointments.find(a => a.id === apptId);
      if (appt) { setSelectedAppt(appt); return; }
    }

    // B17: write timing timestamps on status transitions
    const now = new Date().toISOString();
    const timingPatch: Record<string, string> = {};
    if (status === "arrived")    timingPatch.checked_in_at         = now;
    if (status === "in_session") timingPatch.consultation_start_at = now;

    const { error } = await supabase.from("appointments")
      .update({ status, updated_at: now, ...timingPatch })
      .eq("id", apptId);
    if (error) toast.error("Update failed");
    else {
      toast.success(`Marked as ${STATUS_CFG[status].label}`);

      // B12: insert patient_event for key transitions
      const appt = appointments.find(a => a.id === apptId);
      if (appt?.patient_id && activeClinicId) {
        if (status === "cancelled") {
          supabase.from("patient_events").insert({
            clinic_id:   activeClinicId,
            patient_id:  appt.patient_id,
            event_type:  "appointment_cancelled",
            entity_type: "appointment",
            entity_id:   apptId,
            summary:     `Appointment cancelled: ${appt.service_name ?? "Service"}`,
            actor_name:  profile?.full_name ?? null,
          }).then(() => {});
        }
        if (status === "no_show") {
          supabase.from("patient_events").insert({
            clinic_id:   activeClinicId,
            patient_id:  appt.patient_id,
            event_type:  "appointment_no_show",
            entity_type: "appointment",
            entity_id:   apptId,
            summary:     `No-show: ${appt.service_name ?? "Service"}`,
            actor_name:  profile?.full_name ?? null,
          }).then(() => {});
        }
      }

      fetchAll();
    }
  }

  function navigate(dir: -1 | 1) {
    if (view === "day")   setCurrentDate(d => addDays(d, dir));
    if (view === "week")  setCurrentDate(d => addDays(d, dir * 7));
    if (view === "month") setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + dir, 1));
  }

  const viewTitle = useMemo(() => {
    if (view === "day") return currentDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    if (view === "week") {
      const s = startOfWeek(currentDate);
      const e = addDays(s, 6);
      if (s.getMonth() === e.getMonth())
        return `${s.getDate()}–${e.getDate()} ${MONTHS[s.getMonth()]} ${s.getFullYear()}`;
      return `${s.getDate()} ${MONTHS[s.getMonth()].slice(0,3)} – ${e.getDate()} ${MONTHS[e.getMonth()].slice(0,3)} ${s.getFullYear()}`;
    }
    return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  }, [view, currentDate]);

  // GAP-37: Apply calendar filters
  const filteredAppointments = useMemo(() => appointments.filter(a => {
    if (filterProvider !== "all" && a.provider_id !== filterProvider) return false;
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    return true;
  }), [appointments, filterProvider, filterStatus]);

  // GAP-38: Build provider → palette color map (stable by sorted provider index)
  const providerColorMap = useMemo(() => {
    const sorted = [...providers].sort((a, b) => a.full_name.localeCompare(b.full_name));
    const map: Record<string, typeof PROVIDER_PALETTE[0]> = {};
    sorted.forEach((p, i) => { map[p.id] = PROVIDER_PALETTE[i % PROVIDER_PALETTE.length]; });
    return map;
  }, [providers]);

  if (profileLoading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--background)" }}>
      <Loader2 size={28} style={{ color: "rgba(197,160,89,0.5)", animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", display: "flex", flexDirection: "column" }}>


      {/* ── Calendar Header ─────────────────────────────────────────────────── */}
      <div style={{
        padding: "12px 24px", borderBottom: "1px solid var(--border)",
        background: "white", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        position: "sticky", top: 0, zIndex: 20,
        boxShadow: "0 2px 8px rgba(28,25,23,0.06)",
      }}>
        {/* Nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => navigate(-1)} style={navBtn}><ChevronLeft size={16} /></button>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 600, color: "var(--foreground)", minWidth: 220, textAlign: "center" }}>
            {viewTitle}
          </h2>
          <button onClick={() => navigate(1)} style={navBtn}><ChevronRight size={16} /></button>
          <button
            onClick={() => setCurrentDate(new Date())}
            style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, border: "1px solid rgba(197,160,89,0.4)", background: "rgba(197,160,89,0.08)", color: "#A8853A", cursor: "pointer", fontFamily: "Georgia, serif", fontWeight: 600 }}
          >Today</button>
        </div>

        <div style={{ flex: 1 }} />

        {/* View switcher */}
        <div style={{ display: "flex", borderRadius: 10, border: "1px solid var(--border)", overflow: "hidden" }}>
          {(["day","week","month","list"] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: "6px 14px", border: "none",
              background: view === v ? "#C5A059" : "var(--surface)",
              color: view === v ? "white" : "var(--text-muted)",
              fontSize: 13, fontFamily: "Georgia, serif",
              fontWeight: view === v ? 600 : 400, cursor: "pointer",
              transition: "all 0.15s",
            }}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        {/* Privacy toggle */}
        <button
          onClick={() => setPrivacyMode(m => !m)}
          style={{
            display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8,
            border: `1px solid ${privacyMode ? "rgba(197,160,89,0.5)" : "var(--border)"}`,
            background: privacyMode ? "rgba(197,160,89,0.1)" : "var(--surface)",
            color: privacyMode ? "#C5A059" : "var(--text-muted)",
            fontSize: 12, cursor: "pointer", fontFamily: "Georgia, serif",
          }}
        >
          {privacyMode ? <EyeOff size={14} /> : <Eye size={14} />}
          {privacyMode ? "Privacy ON" : "Privacy"}
        </button>

        {/* GAP-39: Print daily schedule */}
        <button
          onClick={() => {
            const today = filteredAppointments.filter(a => isSameDay(new Date(a.start_time), currentDate));
            const html = `<!DOCTYPE html><html><head><title>Schedule – ${viewTitle}</title>
<style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;color:#1C1917}
h1{font-size:20px;border-bottom:2px solid #C5A059;padding-bottom:8px}
table{width:100%;border-collapse:collapse;margin-top:20px}
th{text-align:left;padding:8px 12px;background:#F9F7F2;border:1px solid #e5e0d8;font-size:12px}
td{padding:8px 12px;border:1px solid #e5e0d8;font-size:12px}
.status{padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;text-transform:uppercase}
@media print{body{margin:0}}</style></head><body>
<h1>Daily Schedule — ${viewTitle}</h1>
<p style="color:#9C9584;margin-top:4px">${today.length} appointments</p>
<table><thead><tr><th>Time</th><th>Patient</th><th>Service</th><th>Provider</th><th>Status</th></tr></thead><tbody>
${today.sort((a,b) => a.start_time.localeCompare(b.start_time)).map(a => `<tr>
<td>${new Date(a.start_time).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</td>
<td>${a.patient_name ?? "—"}</td><td>${a.service_name ?? "—"}</td>
<td>${a.provider_name ?? "—"}</td><td>${a.status}</td>
</tr>`).join("")}
</tbody></table></body></html>`;
            const w = window.open("", "_blank");
            if (w) { w.document.write(html); w.document.close(); w.print(); }
          }}
          style={{ ...navBtn, color: "var(--text-muted)" }}
          title="Print Daily Schedule"
        >
          <Printer size={14} />
        </button>
        <button onClick={fetchAll} style={{ ...navBtn, color: "var(--text-muted)" }}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>

        {isAdmin && (
          <button onClick={() => setShowSettings(true)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", color: "var(--text-muted)", fontSize: 13 }}>
            <Settings size={14} /> Settings
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => setShowBlockTime(true)}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(220,38,38,0.3)", background: "rgba(220,38,38,0.06)", cursor: "pointer", color: "#DC2626", fontSize: 13 }}
          >
            <Ban size={13} /> Block Time
          </button>
        )}
        <button
          onClick={() => { setPrefillSlot(null); setShowNewAppt(true); }}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "7px 16px",
            borderRadius: 10, border: "none",
            background: "linear-gradient(135deg, #C5A059, #A8853A)",
            color: "white", fontSize: 13, fontWeight: 600,
            fontFamily: "Georgia, serif", cursor: "pointer",
            boxShadow: "0 4px 14px rgba(197,160,89,0.35)",
          }}
        >
          <Plus size={14} /> Book Appointment
        </button>
      </div>

      {/* ── Status legend + tier key + GAP-37 filters ───────────────────────── */}
      <div style={{ padding: "7px 24px", background: "rgba(249,247,242,0.9)", borderBottom: "1px solid rgba(197,160,89,0.1)", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        {colorBy === "provider"
          ? providers.slice(0, 8).map(p => {
              const c = providerColorMap[p.id];
              return c ? (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.border }} />
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "Georgia, serif" }}>{p.full_name}</span>
                </div>
              ) : null;
            })
          : (Object.entries(STATUS_CFG) as [AppointmentStatus, typeof STATUS_CFG[AppointmentStatus]][])
              .filter(([k]) => !["cancelled","no_show"].includes(k))
              .map(([key, cfg]) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.dot }} />
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "Georgia, serif" }}>{cfg.label}</span>
                </div>
              ))
        }
        <div style={{ width: 1, height: 16, background: "var(--border)", margin: "0 4px" }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: "#C5A059", background: "rgba(197,160,89,0.15)", padding: "2px 8px", borderRadius: 999, border: "1px solid rgba(197,160,89,0.35)" }}>VIP</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#2E7D6E", background: "rgba(46,125,110,0.12)", padding: "2px 8px", borderRadius: 999, border: "1px solid rgba(46,125,110,0.3)" }}>HNI</span>
        {/* GAP-37: Filters */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <select value={filterProvider} onChange={e => setFilterProvider(e.target.value)}
            style={{ fontSize: 11, padding: "3px 8px", borderRadius: 7, border: "1px solid rgba(197,160,89,0.3)", background: "white", color: "#5C5447", cursor: "pointer", outline: "none" }}>
            <option value="all">All Providers</option>
            {providers.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ fontSize: 11, padding: "3px 8px", borderRadius: 7, border: "1px solid rgba(197,160,89,0.3)", background: "white", color: "#5C5447", cursor: "pointer", outline: "none" }}>
            <option value="all">All Statuses</option>
            {(Object.keys(STATUS_CFG) as AppointmentStatus[]).map(s => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
          </select>
          {(filterProvider !== "all" || filterStatus !== "all") && (
            <button onClick={() => { setFilterProvider("all"); setFilterStatus("all"); }}
              style={{ fontSize: 11, color: "#DC2626", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
              Clear
            </button>
          )}
          {/* GAP-38: Color by toggle */}
          <button
            onClick={() => setColorBy(c => c === "status" ? "provider" : "status")}
            style={{ fontSize: 11, padding: "3px 8px", borderRadius: 7, border: `1px solid ${colorBy === "provider" ? "#7C3AED" : "rgba(197,160,89,0.3)"}`, background: colorBy === "provider" ? "rgba(124,58,237,0.08)" : "white", color: colorBy === "provider" ? "#7C3AED" : "#5C5447", cursor: "pointer" }}
          >
            Color: {colorBy === "status" ? "Status" : "Provider"}
          </button>
        </div>
        {privacyMode && (
          <span style={{ fontSize: 11, color: "#C5A059", fontFamily: "Georgia, serif" }}>
            <EyeOff size={11} style={{ display: "inline", marginRight: 4 }} />
            VIP/HNI names are blurred
          </span>
        )}
      </div>

      {/* ── Main tabs ────────────────────────────────────────────────────── */}
      <div style={{ background: "white", borderBottom: "1px solid var(--border)", display: "flex", paddingLeft: 16 }}>
        {([
          { key: "calendar" as const,  label: "Calendar",  icon: Calendar },
          { key: "waitlist" as const,  label: "Waitlist",  icon: Users },
          { key: "recalls"  as const,  label: "Recalls",   icon: CalendarClock },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSchedulerTab(key)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 18px", border: "none", background: "none", cursor: "pointer",
              fontSize: 13, fontFamily: "Georgia, serif",
              color: schedulerTab === key ? "#C5A059" : "var(--text-muted)",
              borderBottom: schedulerTab === key ? "2px solid #C5A059" : "2px solid transparent",
              fontWeight: schedulerTab === key ? 600 : 400,
              transition: "all 0.15s",
            }}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* ── Calendar body / Waitlist / Recalls ───────────────────────────── */}
      {schedulerTab === "calendar" ? (
        <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400 }}>
              <Loader2 size={28} style={{ color: "rgba(197,160,89,0.5)", animation: "spin 1s linear infinite" }} />
            </div>
          ) : view === "week" ? (
            <WeekView
              appointments={filteredAppointments}
              currentDate={currentDate}
              privacyMode={privacyMode}
              settings={settings}
              blockedSlots={blockedSlots}
              onSelectAppt={setSelectedAppt}
              onSlotClick={(date, hour) => { setPrefillSlot({ date, hour }); setShowNewAppt(true); }}
              onDragAppt={handleDragAppt}
              onActionAppt={handleQuickAction}
              colorBy={colorBy}
              providerColorMap={providerColorMap}
            />
          ) : view === "day" ? (
            <DayView
              appointments={filteredAppointments}
              currentDate={currentDate}
              providers={providers}
              privacyMode={privacyMode}
              settings={settings}
              blockedSlots={blockedSlots}
              onSelectAppt={setSelectedAppt}
              onSlotClick={(date, hour, pid) => { setPrefillSlot({ date, hour, providerId: pid }); setShowNewAppt(true); }}
              onDragAppt={handleDragAppt}
              onActionAppt={handleQuickAction}
              colorBy={colorBy}
              providerColorMap={providerColorMap}
            />
          ) : view === "list" ? (
            <AppointmentListView
              appointments={filteredAppointments}
              privacyMode={privacyMode}
              onSelectAppt={setSelectedAppt}
              onNewAppt={() => setShowNewAppt(true)}
            />
          ) : (
            <MonthView
              appointments={filteredAppointments}
              currentDate={currentDate}
              privacyMode={privacyMode}
              onDayClick={(d) => { setCurrentDate(d); setView("day"); }}
            />
          )}
        </div>
      ) : schedulerTab === "waitlist" ? (
        <div style={{ flex: 1, overflow: "auto" }}>
          <WaitlistTab activeClinicId={activeClinicId} onBook={() => setShowNewAppt(true)} />
        </div>
      ) : (
        <div style={{ flex: 1, overflow: "auto" }}>
          <RecallsTab activeClinicId={activeClinicId} onBook={() => setShowNewAppt(true)} />
        </div>
      )}

      {/* ── Modals / Drawers ─────────────────────────────────────────────────── */}
      {selectedAppt && (
        <AppointmentModal
          appointment={selectedAppt}
          privacyMode={privacyMode}
          activeClinicId={activeClinicId}
          onClose={() => setSelectedAppt(null)}
          onUpdated={() => { setSelectedAppt(null); fetchAll(); }}
        />
      )}

      {showNewAppt && (
        <NewAppointmentDrawer
          prefillSlot={prefillSlot}
          services={services}
          providers={providers}
          activeClinicId={activeClinicId}
          settings={settings}
          existingAppointments={appointments}
          onClose={() => { setShowNewAppt(false); setPrefillSlot(null); }}
          onSaved={() => { setShowNewAppt(false); setPrefillSlot(null); fetchAll(); }}
        />
      )}

      {showSettings && isAdmin && (
        <SettingsDrawer
          current={settings}
          activeClinicId={activeClinicId}
          onClose={() => setShowSettings(false)}
          onSaved={(s) => { setSettings(s); setShowSettings(false); }}
        />
      )}

      {/* GAP-25: Block Time drawer */}
      {showBlockTime && activeClinicId && (
        <BlockTimeDrawer
          clinicId={activeClinicId}
          providers={providers}
          profile={profile}
          currentDate={currentDate}
          onClose={() => setShowBlockTime(false)}
          onSaved={() => { setShowBlockTime(false); fetchAll(); toast.success("Time block created"); }}
        />
      )}

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse-gold { 0%,100%{ box-shadow:0 0 0 0 rgba(212,160,23,0.4) } 50%{ box-shadow:0 0 0 6px rgba(212,160,23,0) } }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}

// ── Gated export ──────────────────────────────────────────────────────────────
// ModuleGate checks clinic_modules — if "scheduler" is disabled for this clinic
// the upgrade banner is shown instead of the full page.

export default function SchedulerPage() {
  return (
    <ModuleGate module="scheduler">
      <SchedulerPageInner />
    </ModuleGate>
  );
}

const navBtn: React.CSSProperties = {
  padding: 6, borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--surface)", cursor: "pointer", display: "flex", alignItems: "center",
};

// ── Week View ─────────────────────────────────────────────────────────────────

function WeekView({ appointments, currentDate, privacyMode, settings, blockedSlots, onSelectAppt, onSlotClick, onDragAppt, onActionAppt, colorBy, providerColorMap }: {
  appointments: Appointment[];
  currentDate: Date;
  privacyMode: boolean;
  settings: SchedulerSettings | null;
  blockedSlots?: { id: string; provider_id: string | null; start_time: string; end_time: string; reason: string | null }[];
  onSelectAppt: (a: Appointment) => void;
  onSlotClick: (date: Date, hour: number) => void;
  onDragAppt: (apptId: string, newStart: Date) => void;
  onActionAppt: (apptId: string, status: AppointmentStatus) => void;
  colorBy?: "status" | "provider";
  providerColorMap?: Record<string, typeof PROVIDER_PALETTE[0]>;
}) {
  const weekStart = startOfWeek(currentDate);
  const days  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => WORKING_START + i);

  function getApptsByDay(day: Date) {
    return appointments.filter(a => isSameDay(new Date(a.start_time), day));
  }
  function getBlocksByDay(day: Date) {
    return (blockedSlots ?? []).filter(b => isSameDay(new Date(b.start_time), day));
  }

  return (
    <div style={{ display: "flex", minHeight: GRID_HEIGHT + 56 }}>
      {/* Time gutter */}
      <div style={{ width: 68, flexShrink: 0, borderRight: "1px solid var(--border)", paddingTop: 56, background: "white" }}>
        {hours.map(h => (
          <div key={h} style={{
            height: HOUR_HEIGHT, display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
            paddingRight: 10, paddingTop: 5,
            fontSize: 11, color: "#9C9584", fontFamily: "Georgia, serif",
            borderBottom: "1px solid rgba(0,0,0,0.04)",
          }}>
            {h === 12 ? "12 PM" : h > 12 ? `${h-12} PM` : `${h} AM`}
          </div>
        ))}
      </div>

      {/* Day columns */}
      <div style={{ flex: 1, display: "flex", overflowX: "auto" }}>
        {days.map(day => {
          const dayAppts  = getApptsByDay(day);
          const dayBlocks = getBlocksByDay(day);
          const today = isToday(day);
          return (
            <div key={day.toISOString()} style={{ flex: 1, minWidth: 120, borderRight: "1px solid var(--border)" }}>
              {/* Day header */}
              <div style={{
                height: 56, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 10,
                background: today ? "rgba(197,160,89,0.07)" : "white",
              }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  {DAY_LABELS[day.getDay()]}
                </span>
                <span style={{
                  fontSize: 20, fontWeight: today ? 700 : 400, fontFamily: "Georgia, serif",
                  color: today ? "#C5A059" : "var(--foreground)",
                  width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: "50%", background: today ? "rgba(197,160,89,0.14)" : "transparent",
                }}>
                  {day.getDate()}
                </span>
              </div>

              {/* Time grid */}
              <div style={{ position: "relative", height: GRID_HEIGHT, background: today ? "rgba(197,160,89,0.015)" : "transparent" }}>
                {hours.map(h => (
                  <div
                    key={h}
                    onClick={() => onSlotClick(day, h)}
                    onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; (e.currentTarget as HTMLDivElement).style.background = "rgba(197,160,89,0.12)"; }}
                    onDragLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                    onDrop={e => {
                      e.preventDefault();
                      (e.currentTarget as HTMLDivElement).style.background = "transparent";
                      const apptId = e.dataTransfer.getData("apptId");
                      if (apptId) {
                        const ns = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, 0, 0);
                        onDragAppt(apptId, ns);
                      }
                    }}
                    style={{
                      position: "absolute", top: (h - WORKING_START) * HOUR_HEIGHT,
                      left: 0, right: 0, height: HOUR_HEIGHT,
                      borderBottom: "1px solid rgba(0,0,0,0.045)", cursor: "pointer",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(197,160,89,0.04)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                  />
                ))}

                {/* Double booking highlight */}
                {settings?.enable_double_booking && (() => {
                  const groups = dayAppts.filter(a => !["completed","cancelled","no_show"].includes(a.status));
                  const overlapping = groups.filter(a => groups.some(b =>
                    b.id !== a.id &&
                    new Date(a.start_time) < new Date(b.end_time) &&
                    new Date(a.end_time)   > new Date(b.start_time)
                  ));
                  return overlapping.map(a => (
                    <div key={`ov-${a.id}`} style={{
                      position: "absolute",
                      top: apptTop(a.start_time),
                      height: apptHeight(a.start_time, a.end_time),
                      left: 0, right: 0,
                      background: "rgba(180,60,60,0.06)",
                      border: "1px solid rgba(180,60,60,0.3)",
                      borderRadius: 6, pointerEvents: "none",
                    }} />
                  ));
                })()}

                {/* GAP-25: Blocked slots — gray striped overlay */}
                {dayBlocks.map(blk => (
                  <div key={blk.id} style={{
                    position: "absolute",
                    top: apptTop(blk.start_time),
                    height: Math.max(22, apptHeight(blk.start_time, blk.end_time)),
                    left: 0, right: 0,
                    background: "repeating-linear-gradient(45deg, rgba(107,114,128,0.08) 0px, rgba(107,114,128,0.08) 4px, transparent 4px, transparent 10px)",
                    border: "1px solid rgba(107,114,128,0.3)",
                    borderRadius: 4, pointerEvents: "none", zIndex: 3,
                    display: "flex", alignItems: "flex-start", padding: "2px 4px",
                  }}>
                    <span style={{ fontSize: 9, color: "#6B7280", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {blk.reason ?? "Blocked"}
                    </span>
                  </div>
                ))}

                {/* Appointments */}
                {dayAppts.map((appt, i) => {
                  const overlaps = dayAppts.filter(b =>
                    b.id !== appt.id &&
                    new Date(appt.start_time) < new Date(b.end_time) &&
                    new Date(appt.end_time)   > new Date(b.start_time)
                  );
                  const col = overlaps.filter(b => b.id < appt.id).length;
                  const total = overlaps.length + 1;
                  return (
                    <ApptCard
                      key={appt.id}
                      appt={appt}
                      top={apptTop(appt.start_time)}
                      height={apptHeight(appt.start_time, appt.end_time)}
                      privacyMode={privacyMode}
                      col={col}
                      totalCols={total}
                      onClick={() => onSelectAppt(appt)}
                      onActionAppt={onActionAppt}
                      colorBy={colorBy}
                      providerColorMap={providerColorMap}
                    />
                  );
                })}

                {/* Now indicator */}
                {today && (() => {
                  const now = new Date();
                  const top = ((now.getHours() * 60 + now.getMinutes() - WORKING_START * 60) / 60) * HOUR_HEIGHT;
                  if (top < 0 || top > GRID_HEIGHT) return null;
                  return (
                    <div style={{ position: "absolute", left: 0, right: 0, top, zIndex: 6, pointerEvents: "none" }}>
                      <div style={{ height: 2, background: "#C5A059", boxShadow: "0 0 6px rgba(197,160,89,0.5)" }} />
                      <div style={{ position: "absolute", left: -5, top: -4, width: 10, height: 10, borderRadius: "50%", background: "#C5A059" }} />
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Day View (providers as columns) ──────────────────────────────────────────

function DayView({ appointments, currentDate, providers, privacyMode, settings, blockedSlots, onSelectAppt, onSlotClick, onDragAppt, onActionAppt, colorBy, providerColorMap }: {
  appointments: Appointment[];
  currentDate: Date;
  providers: Provider[];
  privacyMode: boolean;
  settings: SchedulerSettings | null;
  blockedSlots?: { id: string; provider_id: string | null; start_time: string; end_time: string; reason: string | null }[];
  onSelectAppt: (a: Appointment) => void;
  onSlotClick: (date: Date, hour: number, providerId?: string) => void;
  onDragAppt: (apptId: string, newStart: Date) => void;
  onActionAppt: (apptId: string, status: AppointmentStatus) => void;
  colorBy?: "status" | "provider";
  providerColorMap?: Record<string, typeof PROVIDER_PALETTE[0]>;
}) {
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => WORKING_START + i);
  // Columns: one per provider, plus an "Unassigned" column
  const cols = [
    { id: "unassigned", full_name: "Unassigned", role: "" },
    ...providers,
  ];

  function getApptsByProvider(providerId: string) {
    const dayAppts = appointments.filter(a => isSameDay(new Date(a.start_time), currentDate));
    if (providerId === "unassigned") return dayAppts.filter(a => !a.provider_id);
    return dayAppts.filter(a => a.provider_id === providerId);
  }

  function getBlocksByProvider(providerId: string) {
    const dayBlocks = (blockedSlots ?? []).filter(b => isSameDay(new Date(b.start_time), currentDate));
    if (providerId === "unassigned") return dayBlocks.filter(b => !b.provider_id);
    return dayBlocks.filter(b => !b.provider_id || b.provider_id === providerId);
  }

  return (
    <div style={{ display: "flex", minHeight: GRID_HEIGHT + 56 }}>
      {/* Time gutter */}
      <div style={{ width: 68, flexShrink: 0, borderRight: "1px solid var(--border)", paddingTop: 56, background: "white" }}>
        {hours.map(h => (
          <div key={h} style={{
            height: HOUR_HEIGHT, display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
            paddingRight: 10, paddingTop: 5,
            fontSize: 11, color: "#9C9584", fontFamily: "Georgia, serif",
            borderBottom: "1px solid rgba(0,0,0,0.04)",
          }}>
            {h === 12 ? "12 PM" : h > 12 ? `${h-12} PM` : `${h} AM`}
          </div>
        ))}
      </div>

      {/* Provider columns */}
      <div style={{ flex: 1, display: "flex", overflowX: "auto" }}>
        {cols.map(col => {
          const colAppts   = getApptsByProvider(col.id);
          const colBlocks  = getBlocksByProvider(col.id);
          return (
            <div key={col.id} style={{ flex: 1, minWidth: 160, borderRight: "1px solid var(--border)" }}>
              {/* Provider header */}
              <div style={{
                height: 56, padding: "0 12px", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 10,
                background: "rgba(249,247,242,0.95)",
              }}>
                <span style={{ fontFamily: "Georgia, serif", fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                  {col.full_name}
                </span>
                {col.role && (
                  <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "capitalize" }}>{col.role}</span>
                )}
              </div>

              <div style={{ position: "relative", height: GRID_HEIGHT, background: "white" }}>
                {hours.map(h => (
                  <div
                    key={h}
                    onClick={() => onSlotClick(currentDate, h, col.id === "unassigned" ? undefined : col.id)}
                    onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; (e.currentTarget as HTMLDivElement).style.background = "rgba(197,160,89,0.12)"; }}
                    onDragLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                    onDrop={e => {
                      e.preventDefault();
                      (e.currentTarget as HTMLDivElement).style.background = "transparent";
                      const apptId = e.dataTransfer.getData("apptId");
                      if (apptId) {
                        const ns = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), h, 0, 0);
                        onDragAppt(apptId, ns);
                      }
                    }}
                    style={{
                      position: "absolute", top: (h - WORKING_START) * HOUR_HEIGHT,
                      left: 0, right: 0, height: HOUR_HEIGHT,
                      borderBottom: "1px solid rgba(0,0,0,0.045)", cursor: "pointer",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(197,160,89,0.04)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                  />
                ))}

                {/* GAP-25: Blocked slots in day view */}
                {colBlocks.map(blk => (
                  <div key={blk.id} style={{
                    position: "absolute",
                    top: apptTop(blk.start_time),
                    height: Math.max(22, apptHeight(blk.start_time, blk.end_time)),
                    left: 0, right: 0,
                    background: "repeating-linear-gradient(45deg, rgba(107,114,128,0.08) 0px, rgba(107,114,128,0.08) 4px, transparent 4px, transparent 10px)",
                    border: "1px solid rgba(107,114,128,0.3)",
                    borderRadius: 4, pointerEvents: "none", zIndex: 3,
                    display: "flex", alignItems: "flex-start", padding: "2px 4px",
                  }}>
                    <span style={{ fontSize: 9, color: "#6B7280", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {blk.reason ?? "Blocked"}
                    </span>
                  </div>
                ))}

                {colAppts.map(appt => (
                  <ApptCard
                    key={appt.id}
                    appt={appt}
                    top={apptTop(appt.start_time)}
                    height={apptHeight(appt.start_time, appt.end_time)}
                    privacyMode={privacyMode}
                    col={0}
                    totalCols={1}
                    onClick={() => onSelectAppt(appt)}
                    onActionAppt={onActionAppt}
                    colorBy={colorBy}
                    providerColorMap={providerColorMap}
                  />
                ))}

                {isToday(currentDate) && (() => {
                  const now = new Date();
                  const top = ((now.getHours() * 60 + now.getMinutes() - WORKING_START * 60) / 60) * HOUR_HEIGHT;
                  if (top < 0 || top > GRID_HEIGHT) return null;
                  return (
                    <div style={{ position: "absolute", left: 0, right: 0, top, zIndex: 6, pointerEvents: "none" }}>
                      <div style={{ height: 2, background: "#C5A059", boxShadow: "0 0 6px rgba(197,160,89,0.5)" }} />
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Month View ────────────────────────────────────────────────────────────────

function MonthView({ appointments, currentDate, privacyMode, onDayClick }: {
  appointments: Appointment[];
  currentDate: Date;
  privacyMode: boolean;
  onDayClick: (d: Date) => void;
}) {
  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startCol = firstDay.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [
    ...Array(startCol).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  // Pad to complete rows
  while (cells.length % 7 !== 0) cells.push(null);

  function getApptsByDay(d: Date) {
    return appointments.filter(a => isSameDay(new Date(a.start_time), d));
  }

  return (
    <div style={{ padding: "16px 24px" }}>
      {/* Day labels header */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
        {DAY_LABELS.map(l => (
          <div key={l} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9C9584", padding: "4px 0" }}>{l}</div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const dayAppts = getApptsByDay(day);
          const today = isToday(day);
          const isCurrentMonth = day.getMonth() === month;
          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              style={{
                minHeight: 100, padding: "6px 8px",
                borderRadius: 12, cursor: "pointer",
                border: today ? "1px solid rgba(197,160,89,0.5)" : "1px solid var(--border)",
                background: today ? "rgba(197,160,89,0.06)" : "white",
                opacity: isCurrentMonth ? 1 : 0.4,
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 12px rgba(197,160,89,0.12)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
            >
              <div style={{
                fontSize: 14, fontWeight: today ? 700 : 400, fontFamily: "Georgia, serif",
                color: today ? "#C5A059" : "var(--foreground)",
                width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: "50%", background: today ? "rgba(197,160,89,0.15)" : "transparent",
                marginBottom: 4,
              }}>
                {day.getDate()}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {dayAppts.slice(0, 3).map(appt => {
                  const cfg = STATUS_CFG[appt.status];
                  const isVip = appt.patient_tier === "vip";
                  const isHni = appt.patient_tier === "hni";
                  const name = (isVip || isHni) && privacyMode
                    ? (isVip ? "VIP" : "HNI")
                    : appt.patient_name.split(" ")[0];
                  return (
                    <div
                      key={appt.id}
                      onClick={e => { e.stopPropagation(); /* open modal */ }}
                      style={{
                        fontSize: 10, padding: "2px 6px", borderRadius: 4,
                        background: cfg.bg, borderLeft: `2px solid ${cfg.dot}`,
                        color: cfg.text, fontFamily: "Georgia, serif",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}
                    >
                      {new Date(appt.start_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })} {name}
                    </div>
                  );
                })}
                {dayAppts.length > 3 && (
                  <div style={{ fontSize: 10, color: "#C5A059", fontWeight: 600, paddingLeft: 6 }}>
                    +{dayAppts.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Appointment Card (in time grid) ──────────────────────────────────────────

// ── B7: Appointment Card with hover-expand + inline quick actions ─────────────

function ApptCard({ appt: a, top, height, privacyMode, col, totalCols, onClick, onActionAppt, colorBy, providerColorMap }: {
  appt: Appointment;
  top: number;
  height: number;
  privacyMode: boolean;
  col: number;
  totalCols: number;
  onClick: () => void;
  onActionAppt: (apptId: string, status: AppointmentStatus) => void;
  colorBy?: "status" | "provider";
  providerColorMap?: Record<string, typeof PROVIDER_PALETTE[0]>;
}) {
  const [hovered, setHovered] = useState(false);
  const statusCfg = STATUS_CFG[a.status];
  // GAP-38: Override colors when colorBy === "provider"
  const providerPalette = colorBy === "provider" && a.provider_id && providerColorMap
    ? (providerColorMap[a.provider_id] ?? null)
    : null;
  const cfg = providerPalette
    ? { ...statusCfg, bg: providerPalette.bg, border: providerPalette.border, text: providerPalette.text, dot: providerPalette.border }
    : statusCfg;
  const isVip = a.patient_tier === "vip";
  const isHni = a.patient_tier === "hni";
  const masked = (isVip || isHni) && privacyMode;

  const colWidth = totalCols > 1 ? `${100 / totalCols}%` : undefined;
  const colLeft  = totalCols > 1 ? `${(col * 100) / totalCols}%` : undefined;

  // Quick actions available per status (B7)
  const quickActions: { status: AppointmentStatus; label: string; color: string }[] = [];
  if (a.status === "planned" || a.status === "confirmed")
    quickActions.push({ status: "arrived", label: "Check In", color: "#2A4A8A" });
  if (a.status === "arrived" || a.status === "in_session")
    quickActions.push({ status: "completed", label: "Complete", color: "#4A8A4A" });
  if (["planned","confirmed","arrived"].includes(a.status))
    quickActions.push({ status: "no_show", label: "No Show", color: "#B43C3C" });

  const displayHeight = hovered && height >= 44 ? Math.max(height, 80) : Math.max(height, 26);

  return (
    <div
      draggable
      onDragStart={e => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("apptId", a.id);
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "absolute",
        top,
        height: displayHeight,
        left: colLeft ? `calc(${colLeft} + 2px)` : 2,
        width: colWidth ? `calc(${colWidth} - 4px)` : undefined,
        right: totalCols === 1 ? 2 : undefined,
        background: cfg.bg,
        borderRadius: 7,
        border: isVip
          ? `1px solid rgba(197,160,89,0.55)`
          : isHni
            ? `1px solid rgba(46,125,110,0.45)`
            : `1px solid rgba(0,0,0,0.07)`,
        borderLeftWidth: 3,
        borderLeftColor: cfg.border,
        cursor: "pointer", overflow: "hidden",
        padding: height > 38 ? "4px 8px" : "2px 6px",
        boxShadow: hovered
          ? "0 6px 20px rgba(0,0,0,0.15)"
          : a.status === "in_session"
            ? "0 0 0 0 rgba(212,160,23,0.4)"
            : isVip ? "0 2px 8px rgba(197,160,89,0.2)"
              : "0 1px 4px rgba(0,0,0,0.05)",
        animation: a.status === "in_session" ? "pulse-gold 2s infinite" : "none",
        zIndex: hovered ? 8 : 3,
        transition: "box-shadow 0.15s, height 0.15s, z-index 0s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: height > 44 ? 2 : 0 }}>
        {isVip && <span style={{ fontSize: 8, fontWeight: 700, color: "#C5A059", background: "rgba(197,160,89,0.2)", padding: "1px 5px", borderRadius: 999 }}>VIP</span>}
        {isHni && <span style={{ fontSize: 8, fontWeight: 700, color: "#2E7D6E", background: "rgba(46,125,110,0.15)", padding: "1px 5px", borderRadius: 999 }}>HNI</span>}
        <span style={{
          fontSize: 12, fontWeight: 600, fontFamily: "Georgia, serif", color: cfg.text,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          filter: masked ? "blur(4px)" : "none", userSelect: masked ? "none" : "auto",
          flex: 1,
        }}>
          {masked ? (isVip ? "VIP Patient" : "HNI Patient") : a.patient_name}
        </span>
      </div>
      {(height > 44 || hovered) && (
        <p style={{ fontSize: 10, color: cfg.text, opacity: 0.7, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "Georgia, serif" }}>
          {a.service_name}
        </p>
      )}
      {(height > 58 || hovered) && (
        <p style={{ fontSize: 9, color: cfg.text, opacity: 0.5, margin: "1px 0 0" }}>
          {fmtTime(new Date(a.start_time))} – {fmtTime(new Date(a.end_time))}
        </p>
      )}
      {/* B7: Inline quick actions on hover */}
      {hovered && quickActions.length > 0 && (
        <div
          style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}
          onClick={e => e.stopPropagation()}
        >
          {quickActions.map(qa => (
            <button
              key={qa.status}
              onClick={e => { e.stopPropagation(); onActionAppt(a.id, qa.status); }}
              style={{
                fontSize: 9, padding: "2px 7px", borderRadius: 5, border: "none",
                background: qa.color, color: "white", cursor: "pointer",
                fontFamily: "Georgia, serif", fontWeight: 600,
                opacity: 0.92,
              }}
            >
              {qa.label}
            </button>
          ))}
          <button
            onClick={e => { e.stopPropagation(); onClick(); }}
            style={{ fontSize: 9, padding: "2px 7px", borderRadius: 5, border: `1px solid ${cfg.border}`, background: "white", color: cfg.text, cursor: "pointer", fontFamily: "Georgia, serif" }}
          >
            Details
          </button>
        </div>
      )}
    </div>
  );
}

// ── Appointment Detail Modal ──────────────────────────────────────────────────

function AppointmentModal({ appointment: a, privacyMode, activeClinicId, onClose, onUpdated }: {
  appointment: Appointment;
  privacyMode: boolean;
  activeClinicId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { profile } = useClinic();
  const cfg   = STATUS_CFG[a.status];
  const isVip = a.patient_tier === "vip";
  const isHni = a.patient_tier === "hni";
  const masked = (isVip || isHni) && privacyMode;
  const displayName = masked ? (isVip ? "VIP Patient" : "HNI Patient") : a.patient_name;

  const [updating,      setUpdating]     = useState(false);
  const [credits,       setCredits]      = useState<PatientCredit[]>([]);
  const [loadingCreds,  setLoadingCreds] = useState(false);
  const [selectedCred,  setSelectedCred] = useState<string | "none">("none");
  const [patientPhone,  setPatientPhone] = useState<string | null>(null);
  const [showConsume,  setShowConsume]  = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel,   setShowCancel]   = useState(false);
  const [showCheckout,         setShowCheckout]         = useState(false);
  const [showReschedule,       setShowReschedule]       = useState(false);
  const [rescheduleDate,       setRescheduleDate]       = useState(new Date().toISOString().slice(0,10));
  const [rescheduleTime,       setRescheduleTime]       = useState("10:00");
  const [rescheduleProviderId, setRescheduleProviderId] = useState(a.provider_id ?? "");
  const [rescheduleProviders,  setRescheduleProviders]  = useState<Provider[]>([]);
  const [rescheduling,         setRescheduling]         = useState(false);

  // GAP-17: Counselling history for this patient
  const [counsellingHistory, setCounsellingHistory] = useState<{ id: string; session_date: string; treatments_discussed: { service_name: string; quoted_price: number }[]; total_proposed: number; total_accepted: number; conversion_status: string }[]>([]);
  const [showCounselling, setShowCounselling] = useState(false);
  useEffect(() => {
    if (!a.patient_id) return;
    supabase.from("counselling_sessions")
      .select("id, session_date, treatments_discussed, total_proposed, total_accepted, conversion_status")
      .eq("patient_id", a.patient_id)
      .order("session_date", { ascending: false })
      .limit(3)
      .then(({ data }) => setCounsellingHistory((data as typeof counsellingHistory) ?? []));
  }, [a.patient_id]);

  // Fetch providers when reschedule panel opens
  useEffect(() => {
    if (!showReschedule || rescheduleProviders.length > 0 || !activeClinicId) return;
    supabase.from("profiles").select("id, full_name, role")
      .eq("clinic_id", activeClinicId)
      .eq("is_active", true)
      .in("role", ["doctor","therapist","counsellor"])
      .order("full_name")
      .then(({ data }) => setRescheduleProviders((data ?? []) as Provider[]));
  }, [showReschedule, activeClinicId]);

  async function handleReschedule() {
    if (!rescheduleDate || !rescheduleTime) { toast.error("Set date and time"); return; }
    setRescheduling(true);
    try {
      const start   = new Date(`${rescheduleDate}T${rescheduleTime}`);
      const durMins = Math.round((new Date(a.end_time).getTime() - new Date(a.start_time).getTime()) / 60000);
      const end     = new Date(start.getTime() + durMins * 60000);
      const { error } = await supabase.from("appointments").insert({
        clinic_id:       activeClinicId,
        patient_id:      a.patient_id,
        provider_id:     rescheduleProviderId || null,
        service_id:      a.service_id,
        credit_id:       null,
        service_name:    a.service_name,
        room:            a.room,
        start_time:      start.toISOString(),
        end_time:        end.toISOString(),
        status:          "planned",
        notes:           `Rescheduled from ${new Date(a.start_time).toLocaleDateString("en-IN")}`,
        credit_reserved: false,
      });
      if (error) throw error;
      toast.success("Appointment rescheduled");
      onUpdated();
    } catch {
      toast.error("Reschedule failed");
    } finally {
      setRescheduling(false);
    }
  }

  // Fetch patient phone on mount
  useEffect(() => {
    if (!a.patient_id) return;
    supabase.from("patients").select("phone").eq("id", a.patient_id).maybeSingle()
      .then(({ data }) => setPatientPhone(data?.phone ?? null));
  }, [a.patient_id]);

  // Fetch patient credits on mount
  useEffect(() => {
    if (!a.patient_id) return;
    setLoadingCreds(true);
    supabase
      .from("patient_service_credits")
      .select("id, service_name, total_sessions, used_sessions, per_session_value, status")
      .eq("patient_id", a.patient_id)
      .eq("status", "active")
      .then(({ data }) => {
        setCredits((data ?? []) as PatientCredit[]);
        // Auto-select a credit that matches the service
        const match = (data ?? []).find((c: PatientCredit) =>
          c.service_name.toLowerCase().includes(a.service_name.toLowerCase()) ||
          a.service_name.toLowerCase().includes(c.service_name.toLowerCase())
        );
        if (match) setSelectedCred(match.id);
        setLoadingCreds(false);
      });
  }, [a.patient_id, a.service_name]);

  const VALID_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
    planned:    ["confirmed", "cancelled", "no_show"],
    confirmed:  ["arrived",   "cancelled", "no_show"],
    arrived:    ["in_session","cancelled"],
    in_session: ["completed"],
    completed:  [],
    cancelled:  [],
    no_show:    [],
  };

  async function updateStatus(status: AppointmentStatus, extra?: Record<string, unknown>) {
    const allowed = VALID_TRANSITIONS[a.status] ?? [];
    if (!allowed.includes(status)) {
      toast.error(`Cannot move from "${a.status}" to "${status}"`);
      return;
    }
    setUpdating(true);
    try {
      if (status === "no_show") {
        const { error: nsErr } = await supabase.rpc("increment_no_show", {
          p_appointment_id: a.id,
          p_credit_id:      a.credit_id ?? null,
          p_patient_id:     a.patient_id ?? null,
          p_clinic_id:      activeClinicId,
        });
        if (nsErr) throw nsErr;
        await supabase.from("staff_commissions")
          .update({ status: "voided" })
          .eq("appointment_id", a.id).eq("status", "pending");
      } else {
        const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString(), ...extra };
        const { error } = await supabase.from("appointments").update(patch).eq("id", a.id);
        if (error) throw error;
        if (status === "cancelled") {
          await supabase.from("staff_commissions")
            .update({ status: "voided" })
            .eq("appointment_id", a.id).eq("status", "pending");
        }
        // B6: Auto-create recall task on completion
        if (status === "completed" && a.patient_id && activeClinicId) {
          const recallDays = calcRecallDays(a.service_name);
          const recallDate = new Date();
          recallDate.setDate(recallDate.getDate() + recallDays);
          supabase.from("recall_tasks").insert({
            clinic_id:      activeClinicId,
            patient_id:     a.patient_id,
            appointment_id: a.id,
            service_name:   a.service_name,
            recall_date:    recallDate.toISOString().slice(0, 10),
            status:         "pending",
          }).then(() => {});
        }
      }
      toast.success(`Marked as ${STATUS_CFG[status].label}`);
      onUpdated();
    } catch {
      toast.error("Update failed");
    } finally {
      setUpdating(false);
    }
  }

  async function handleConsume() {
    setUpdating(true);
    try {
      const creditId = selectedCred !== "none" ? selectedCred : null;
      const credit   = creditId ? credits.find(c => c.id === creditId) : null;

      if (credit) {
        // Resolve commission rate from provider_commission_rates table (GAP-14)
        // Falls back to 10% if no rate configured (via get_commission_pct DB function)
        const { data: commPctRow } = await supabase
          .rpc("get_commission_pct", {
            p_clinic_id:   activeClinicId,
            p_provider_id: a.provider_id ?? "",
            p_service_id:  a.service_id  ?? null,
          });
        const rawCommPct = commPctRow as number | null;
        if (rawCommPct === null && a.provider_id) {
          toast.error("No commission rate configured for this provider. Please set one in Staff settings before consuming.");
          setUpdating(false);
          return;
        }
        const commissionPct = rawCommPct ?? 0;

        // Single atomic RPC — all 5 writes or none (GAP-3)
        const { data: result, error } = await supabase.rpc("consume_session", {
          p_credit_id:      credit.id,
          p_appointment_id: a.id,
          p_provider_id:    a.provider_id ?? null,
          p_clinic_id:      activeClinicId,
          p_patient_id:     a.patient_id,
          p_session_date:   a.start_time,
          p_commission_pct: commissionPct,
        });
        if (error) throw error;

        // B17: write treatment timing + B12: patient_event
        await supabase.from("appointments").update({
          treatment_complete_at: new Date().toISOString(),
        }).eq("id", a.id);

        if (a.patient_id) {
          supabase.from("patient_events").insert({
            clinic_id:   activeClinicId,
            patient_id:  a.patient_id,
            event_type:  "treatment_done",
            entity_type: "appointment",
            entity_id:   a.id,
            summary:     `Session consumed: ${credit.service_name ?? a.service_name ?? "Service"}`,
            actor_name:  a.provider_name ?? null,
          }).then(() => {});
        }

        toast.success(`Session consumed — invoice created (${fmt(credit.per_session_value)})`);
      } else {
        // No credit — direct charge: create invoice then commission atomically
        const { data: svc } = await supabase
          .from("services").select("selling_price").eq("id", a.service_id ?? "").maybeSingle();
        const amount = svc?.selling_price ?? 0;

        const { data: commPctRow } = await supabase
          .rpc("get_commission_pct", {
            p_clinic_id:   activeClinicId,
            p_provider_id: a.provider_id ?? "",
            p_service_id:  a.service_id  ?? null,
          });
        const rawCommPct2 = commPctRow as number | null;
        if (rawCommPct2 === null && a.provider_id) {
          toast.error("No commission rate configured for this provider. Please set one in Staff settings before consuming.");
          setUpdating(false);
          return;
        }
        const commissionPct = rawCommPct2 ?? 0;

        // B9: resolve service_id from name if null
        let resolvedServiceId = a.service_id ?? null;
        if (!resolvedServiceId && a.service_name) {
          const { data: svcByName } = await supabase
            .from("services").select("id").eq("clinic_id", activeClinicId)
            .ilike("name", a.service_name).limit(1).maybeSingle();
          resolvedServiceId = svcByName?.id ?? null;
        }

        // Invoice creation (GAP-10) — B9: service_id guaranteed non-null when available
        const { error: invErr } = await supabase.rpc("create_invoice_with_items", {
          p_clinic_id:    activeClinicId,
          p_patient_id:   a.patient_id,
          p_patient_name: a.patient_name ?? "",
          p_provider_id:  a.provider_id  ?? null,
          p_provider_name: "",
          p_due_date:     null,
          p_gst_pct:      0,
          p_invoice_type: "session",
          p_notes:        a.service_name ?? "",
          p_items: JSON.stringify([{
            service_id:   resolvedServiceId,
            description:  a.service_name,
            quantity:     1,
            unit_price:   amount,
            discount_pct: 0,
            gst_pct:      0,
          }]),
        });
        if (invErr) throw invErr;

        // Commission (GAP-14: dynamic rate, commission_type='delivery')
        if (a.provider_id && amount > 0) {
          const commAmt = Math.round(amount * commissionPct / 100 * 100) / 100;
          const { error: cErr } = await supabase.from("staff_commissions").insert({
            provider_id:       a.provider_id,
            appointment_id:    a.id,
            service_name:      a.service_name,
            session_date:      a.start_time,
            sale_amount:       amount,
            commission_pct:    commissionPct,
            commission_amount: commAmt,
            commission_type:   "delivery",
            clinic_id:         activeClinicId,
            patient_id:        a.patient_id,
            status:            "pending",
          });
          if (cErr) throw cErr;
        }

        // B17: write treatment timing + B12: patient_event treatment_done
        const nowTs = new Date().toISOString();
        const { error: aptErr } = await supabase.from("appointments").update({
          status:                  "completed",
          treatment_complete_at:   nowTs,
          credit_reserved:         false,
          updated_at:              nowTs,
        }).eq("id", a.id);
        if (aptErr) throw aptErr;

        // B12: patient_event on treatment_done
        if (a.patient_id) {
          supabase.from("patient_events").insert({
            clinic_id:   activeClinicId,
            patient_id:  a.patient_id,
            event_type:  "treatment_done",
            entity_type: "appointment",
            entity_id:   a.id,
            summary:     `Treatment done: ${a.service_name ?? "Service"} (direct charge)`,
            actor_name:  a.provider_name ?? null,
          }).then(() => {});
        }

        toast.success("Session consumed — invoice created");
      }
      onUpdated();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Consume failed";
      toast.error(msg);
      logAction({ action: "consume_session.failed", targetId: a.id, metadata: { error: String(e) }, clinicId: activeClinicId ?? undefined });
    } finally {
      setUpdating(false);
    }
  }

  const start = new Date(a.start_time);
  const end   = new Date(a.end_time);
  const durMins = Math.round((end.getTime() - start.getTime()) / 60000);

  const NEXT_STATUS: Partial<Record<AppointmentStatus, AppointmentStatus>> = {
    planned:    "confirmed",
    confirmed:  "arrived",
    arrived:    "in_session",
  };
  const nextStatus = NEXT_STATUS[a.status];

  const STATUS_ACTION_LABELS: Partial<Record<AppointmentStatus, { icon: React.ElementType; label: string; color: string }>> = {
    confirmed:  { icon: CheckCircle2, label: "Confirm",      color: "#4A8A4A" },
    arrived:    { icon: UserCheck,    label: "Check In Patient", color: "#2A4A8A" },
    in_session: { icon: Zap,          label: "Start Session",color: "#D4A017" },
  };
  const nextAction = nextStatus ? STATUS_ACTION_LABELS[nextStatus] : null;

  return (
  <>
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(28,25,23,0.5)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "white", borderRadius: 20, width: "100%", maxWidth: 520,
        border: "1px solid rgba(197,160,89,0.2)",
        boxShadow: "0 24px 72px rgba(28,25,23,0.22)",
        overflow: "hidden", animation: "fadeIn 0.2s ease",
      }}>
        {/* Status bar */}
        <div style={{ height: 4, background: `linear-gradient(90deg, ${cfg.border}, ${cfg.dot})` }} />

        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              {isVip && <span style={{ fontSize: 10, fontWeight: 700, color: "#C5A059", background: "rgba(197,160,89,0.15)", padding: "2px 8px", borderRadius: 999, border: "1px solid rgba(197,160,89,0.3)" }}>VIP</span>}
              {isHni && <span style={{ fontSize: 10, fontWeight: 700, color: "#2E7D6E", background: "rgba(46,125,110,0.1)",  padding: "2px 8px", borderRadius: 999, border: "1px solid rgba(46,125,110,0.25)" }}>HNI</span>}
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600,
                color: cfg.dot, background: `${cfg.bg}`, padding: "3px 10px",
                borderRadius: 999, border: `1px solid ${cfg.border}`,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
                {cfg.label}
              </span>
            </div>
            <h3 style={{
              fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 600,
              color: "var(--foreground)", margin: 0,
              filter: masked ? "blur(5px)" : "none", userSelect: masked ? "none" : "auto",
            }}>
              {displayName}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", flexShrink: 0 }}>
            <X size={20} />
          </button>
        </div>

        {/* Details */}
        <div style={{ padding: "18px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            <DetailRow icon={<Scissors size={14} />} label="Service"  value={a.service_name} />
            <DetailRow icon={<User size={14} />}     label="Provider" value={a.provider_name} />
            <DetailRow icon={<Clock size={14} />}    label="Time"
              value={`${fmtTime(start)} – ${fmtTime(end)} (${durMins} min)`} />
            {a.room && <DetailRow icon={<MapPin size={14} />} label="Room" value={a.room} />}
            {patientPhone && !masked && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <DetailRow icon={<Send size={14} />} label="Phone" value={patientPhone} />
                <a
                  href={`https://wa.me/91${patientPhone.replace(/\D/g,"")}`}
                  target="_blank" rel="noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: "rgba(37,211,102,0.1)", color: "#128C7E", border: "1px solid rgba(37,211,102,0.3)", textDecoration: "none", whiteSpace: "nowrap" }}
                >
                  WA
                </a>
              </div>
            )}
          </div>
          {a.notes && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(197,160,89,0.05)", border: "1px solid rgba(197,160,89,0.15)", marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>{a.notes}</p>
            </div>
          )}

          {/* ── Active Credits ── */}
          {(a.status === "in_session" || a.status === "arrived") && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9C9584", marginBottom: 10 }}>
                Patient Packages / Credits
              </p>
              {loadingCreds ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0" }}>
                  <Loader2 size={14} style={{ color: "rgba(197,160,89,0.5)", animation: "spin 1s linear infinite" }} />
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Checking credits…</span>
                </div>
              ) : credits.length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "rgba(0,0,0,0.03)", border: "1px solid var(--border)" }}>
                  <AlertCircle size={14} style={{ color: "#9C9584" }} />
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>No active package — will bill directly</span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div
                    onClick={() => setSelectedCred("none")}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                      borderRadius: 9, cursor: "pointer",
                      border: selectedCred === "none" ? "1px solid rgba(180,60,60,0.4)" : "1px solid var(--border)",
                      background: selectedCred === "none" ? "rgba(180,60,60,0.04)" : "var(--surface)",
                    }}
                  >
                    {selectedCred === "none" && <Check size={12} style={{ color: "#B43C3C" }} />}
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>No package — charge directly</span>
                  </div>
                  {credits.map(cr => {
                    const remaining = cr.total_sessions - cr.used_sessions;
                    return (
                      <div
                        key={cr.id}
                        onClick={() => setSelectedCred(cr.id)}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                          padding: "10px 12px", borderRadius: 9, cursor: "pointer",
                          border: selectedCred === cr.id ? "1px solid rgba(197,160,89,0.5)" : "1px solid var(--border)",
                          background: selectedCred === cr.id ? "rgba(197,160,89,0.07)" : "var(--surface)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {selectedCred === cr.id && <Check size={12} style={{ color: "#C5A059" }} />}
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, fontFamily: "Georgia, serif", color: "var(--foreground)", margin: 0 }}>{cr.service_name}</p>
                            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>{remaining} of {cr.total_sessions} sessions left</p>
                          </div>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#C5A059" }}>{fmt(cr.per_session_value)}/session</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Cancel reason ── */}
          {showCancel && (
            <div style={{ marginBottom: 14 }}>
              <textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation (optional)…"
                rows={2}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>
          )}

          {/* ── Reschedule panel ── */}
          {(a.status === "cancelled" || a.status === "no_show") && (
            <div style={{ marginTop: 8 }}>
              {!showReschedule ? (
                <button
                  onClick={() => setShowReschedule(true)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "10px 0", borderRadius: 12,
                    border: "1px solid rgba(197,160,89,0.4)",
                    background: "rgba(197,160,89,0.06)",
                    color: "#A8853A", fontSize: 13, fontWeight: 600,
                    fontFamily: "Georgia, serif", cursor: "pointer",
                  }}
                >
                  <CalendarClock size={15} /> Reschedule Appointment
                </button>
              ) : (
                <div style={{ padding: 16, borderRadius: 12, background: "rgba(197,160,89,0.04)", border: "1px solid rgba(197,160,89,0.2)" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9C9584", marginBottom: 12 }}>
                    Book New Slot
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9C9584", display: "block", marginBottom: 5 }}>Date</label>
                      <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9C9584", display: "block", marginBottom: 5 }}>Time</label>
                      <input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9C9584", display: "block", marginBottom: 5 }}>Provider</label>
                    <select value={rescheduleProviderId} onChange={e => setRescheduleProviderId(e.target.value)} style={inputStyle}>
                      <option value="">— Same as original —</option>
                      {rescheduleProviders.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setShowReschedule(false)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>
                      Back
                    </button>
                    <button
                      onClick={handleReschedule}
                      disabled={rescheduling}
                      style={{
                        flex: 2, padding: "9px 0", borderRadius: 10, border: "none",
                        background: rescheduling ? "rgba(197,160,89,0.5)" : "linear-gradient(135deg, #C5A059, #A8853A)",
                        color: "white", fontSize: 13, fontWeight: 600,
                        fontFamily: "Georgia, serif", cursor: rescheduling ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      }}
                    >
                      {rescheduling && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
                      <CalendarCheck size={14} /> Book Rescheduled Slot
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* GAP-17: Counselling History */}
        {counsellingHistory.length > 0 && (
          <div style={{ padding: "12px 24px 0", borderTop: "1px solid var(--border)" }}>
            <button onClick={() => setShowCounselling(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: showCounselling ? 10 : 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.08em" }}>Counselling History ({counsellingHistory.length})</span>
              <ChevronDown size={12} color="#059669" style={{ transform: showCounselling ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
            </button>
            {showCounselling && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {counsellingHistory.map(cs => {
                  const STATUS_COLOR: Record<string, string> = { converted: "#059669", pending: "#D97706", partial: "#0891B2", declined: "#DC2626" };
                  return (
                    <div key={cs.id} style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(5,150,105,0.04)", border: "1px solid rgba(5,150,105,0.15)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: "#6B7280" }}>{new Date(cs.session_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: `${STATUS_COLOR[cs.conversion_status] ?? "#9C9584"}18`, color: STATUS_COLOR[cs.conversion_status] ?? "#9C9584", textTransform: "capitalize" }}>{cs.conversion_status}</span>
                      </div>
                      {(cs.treatments_discussed ?? []).slice(0, 2).map((t, i) => (
                        <p key={i} style={{ fontSize: 11, color: "#1C1917", margin: "1px 0", fontFamily: "Georgia, serif" }}>{t.service_name} — ₹{t.quoted_price?.toLocaleString("en-IN")}</p>
                      ))}
                      <p style={{ fontSize: 10, color: "#6B7280", marginTop: 3 }}>Proposed: ₹{cs.total_proposed?.toLocaleString("en-IN")} · Accepted: ₹{cs.total_accepted?.toLocaleString("en-IN")}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Custom Fields */}
        <div style={{ padding: "14px 24px 0", borderTop: "1px solid var(--border)" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9C9584", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>Custom Fields</p>
          <CustomFieldsSection entityType="appointments" entityId={a.id} clinicId={activeClinicId ?? ""} />
        </div>

        {/* Action buttons */}
        <div style={{ padding: "14px 24px 20px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Primary next-step button */}
          {nextAction && nextStatus && (
            <button
              onClick={() => updateStatus(nextStatus)}
              disabled={updating}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "11px 0", borderRadius: 12, border: "none",
                background: `linear-gradient(135deg, ${nextAction.color}, ${nextAction.color}CC)`,
                color: "white", fontSize: 14, fontWeight: 600,
                fontFamily: "Georgia, serif", cursor: "pointer",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
            >
              {updating ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <nextAction.icon size={16} />}
              {nextAction.label}
            </button>
          )}

          {/* Checkout — opens invoice + payment flow */}
          {(a.status === "in_session" || a.status === "arrived") && (
            <button
              onClick={() => setShowCheckout(true)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "11px 0", borderRadius: 12, border: "none",
                background: "linear-gradient(135deg, #C5A059, #A8853A)",
                color: "white", fontSize: 14, fontWeight: 600,
                fontFamily: "Georgia, serif", cursor: "pointer",
                boxShadow: "0 4px 14px rgba(197,160,89,0.35)",
              }}
            >
              <Receipt size={16} />
              Checkout / Complete Session
            </button>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            {/* WhatsApp reminder */}
            <button
              onClick={() => sendWhatsAppReminder(a.id)}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "9px 0", borderRadius: 10,
                border: "1px solid rgba(74,138,74,0.35)",
                background: "rgba(74,138,74,0.06)",
                color: "#4A8A4A", fontSize: 13, cursor: "pointer", fontFamily: "Georgia, serif",
              }}
            >
              <Bell size={14} /> WhatsApp Reminder
            </button>

            {/* No show */}
            {!["completed","cancelled","no_show"].includes(a.status) && (
              <button
                onClick={() => updateStatus("no_show")}
                disabled={updating}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "9px 0", borderRadius: 10,
                  border: "1px solid rgba(180,60,60,0.3)",
                  background: "rgba(180,60,60,0.05)",
                  color: "#B43C3C", fontSize: 13, cursor: "pointer", fontFamily: "Georgia, serif",
                }}
              >
                <PhoneOff size={14} /> No Show
              </button>
            )}

            {/* Cancel */}
            {!["completed","cancelled","no_show"].includes(a.status) && !showCancel && (
              <button
                onClick={() => setShowCancel(true)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "9px 0", borderRadius: 10,
                  border: "1px solid var(--border)", background: "var(--surface)",
                  color: "var(--text-muted)", fontSize: 13, cursor: "pointer",
                }}
              >
                <XCircle size={14} /> Cancel
              </button>
            )}
            {showCancel && (
              <>
                <button
                  onClick={() => updateStatus("cancelled", { cancellation_reason: cancelReason })}
                  disabled={updating}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "9px 0", borderRadius: 10,
                    border: "none", background: "#B43C3C",
                    color: "white", fontSize: 13, cursor: "pointer", fontWeight: 600,
                  }}
                >
                  Confirm Cancel
                </button>
                <button
                  onClick={() => setShowCancel(false)}
                  style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", color: "var(--text-muted)", fontSize: 13 }}
                >
                  Back
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Checkout modal — sits on top of appointment modal */}
    {showCheckout && (
      <CheckoutModal
        appointment={a}
        credit={selectedCred !== "none" ? (credits.find(c => c.id === selectedCred) ?? null) : null}
        activeClinicId={activeClinicId}
        onClose={() => setShowCheckout(false)}
        onCompleted={() => { setShowCheckout(false); onUpdated(); }}
      />
    )}
  </>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <div style={{ color: "#C5A059", marginTop: 2, flexShrink: 0 }}>{icon}</div>
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9C9584", margin: 0 }}>{label}</p>
        <p style={{ fontSize: 13, fontFamily: "Georgia, serif", color: "var(--foreground)", margin: 0 }}>{value}</p>
      </div>
    </div>
  );
}

// ── GAP-25: Block Time Drawer ─────────────────────────────────────────────────

function BlockTimeDrawer({ clinicId, providers, profile, currentDate, onClose, onSaved }: {
  clinicId: string;
  providers: { id: string; full_name: string }[];
  profile: { id: string; full_name: string | null } | null;
  currentDate: Date;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dateStr = currentDate.toISOString().slice(0, 10);
  const [providerId, setProviderId] = useState<string>("");
  const [startDate,  setStartDate]  = useState(dateStr);
  const [startTime,  setStartTime]  = useState("09:00");
  const [endTime,    setEndTime]    = useState("10:00");
  const [reason,     setReason]     = useState("");
  const [saving,     setSaving]     = useState(false);

  async function handleSave() {
    if (!startDate || !startTime || !endTime) return;
    setSaving(true);
    const start = new Date(`${startDate}T${startTime}:00`).toISOString();
    const end   = new Date(`${startDate}T${endTime}:00`).toISOString();
    const { error } = await supabase.from("blocked_slots").insert({
      clinic_id:   clinicId,
      provider_id: providerId || null,
      start_time:  start,
      end_time:    end,
      reason:      reason.trim() || null,
      created_by:  profile?.id ?? null,
    });
    setSaving(false);
    if (error) { toast.error("Failed to create time block"); return; }
    onSaved();
  }

  const inputSt: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid rgba(197,160,89,0.25)", fontSize: 13, fontFamily: "Georgia, serif", color: "#1C1917", background: "white", outline: "none" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "flex-start", justifyContent: "flex-end" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} onClick={onClose} />
      <div style={{ position: "relative", width: 400, height: "100vh", background: "white", boxShadow: "-8px 0 32px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(220,38,38,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Ban size={18} style={{ color: "#DC2626" }} />
            <span style={{ fontSize: 16, fontWeight: 600, fontFamily: "Georgia, serif", color: "#1C1917" }}>Block Time</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9C9584" }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#5C5447", display: "block", marginBottom: 6 }}>Provider (optional — leave blank to block all)</label>
            <select value={providerId} onChange={e => setProviderId(e.target.value)} style={inputSt}>
              <option value="">All Providers / Clinic-wide</option>
              {providers.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#5C5447", display: "block", marginBottom: 6 }}>Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputSt} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#5C5447", display: "block", marginBottom: 6 }}>Start Time</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#5C5447", display: "block", marginBottom: 6 }}>End Time</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={inputSt} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#5C5447", display: "block", marginBottom: 6 }}>Reason (optional)</label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Doctor on leave, Staff training, Holiday" style={inputSt} />
          </div>
          <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(220,38,38,0.04)", border: "1px solid rgba(220,38,38,0.15)" }}>
            <p style={{ fontSize: 12, color: "#DC2626", margin: 0 }}>Blocked slots will appear as unavailable on the calendar. New bookings cannot be made in the blocked timeframe.</p>
          </div>
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(197,160,89,0.15)" }}>
          <button onClick={handleSave} disabled={saving || !startDate || !startTime || !endTime}
            style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: saving ? "rgba(220,38,38,0.3)" : "#DC2626", color: "white", fontSize: 14, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: "Georgia, serif" }}>
            {saving ? "Saving…" : "Block Time Slot"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── New Appointment Drawer ────────────────────────────────────────────────────

interface ExtraServiceRow {
  uid: string;
  serviceId: string;
  durationMins: number;
  providerId: string;
}

function NewAppointmentDrawer({ prefillSlot, services, providers, activeClinicId, settings, existingAppointments, onClose, onSaved }: {
  prefillSlot: { date: Date; hour: number; providerId?: string } | null;
  services: Service[];
  providers: Provider[];
  activeClinicId: string | null;
  settings: SchedulerSettings | null;
  existingAppointments: Appointment[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { profile } = useClinic();

  // Pre-fill date from slot
  const initDate = prefillSlot
    ? `${prefillSlot.date.getFullYear()}-${String(prefillSlot.date.getMonth()+1).padStart(2,"0")}-${String(prefillSlot.date.getDate()).padStart(2,"0")}`
    : new Date().toISOString().slice(0,10);
  const initHour = prefillSlot?.hour ?? 10;
  const initTime = `${String(initHour).padStart(2,"0")}:00`;

  // B4: 3-step wizard state
  const [step,           setStep]           = useState<1 | 2 | 3>(1);
  // B3: Risk score
  const [riskScore,      setRiskScore]      = useState<number | null>(null);
  // B4 Step 3 toggles
  const [sendWhatsApp,   setSendWhatsApp]   = useState(false);
  const [sendIntake,     setSendIntake]     = useState(false);

  const [patientSearch,  setPatientSearch]  = useState("");
  const [patientResults, setPatientResults] = useState<{ id: string; full_name: string; patient_tier: PatientTier | null; phone: string | null }[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; full_name: string; patient_tier: PatientTier | null } | null>(null);
  const [serviceId,      setServiceId]      = useState(services[0]?.id ?? "");
  const [providerId,     setProviderId]     = useState(prefillSlot?.providerId ?? providers[0]?.id ?? "");
  const [date,           setDate]           = useState(initDate);
  const [startTime,      setStartTime]      = useState(initTime);
  const [durationMins,   setDurationMins]   = useState(services[0]?.duration_minutes ?? 60);
  const [room,           setRoom]           = useState("");
  const [notes,          setNotes]          = useState("");
  const [useCredit,      setUseCredit]      = useState(false);
  const [patientCredits, setPatientCredits] = useState<PatientCredit[]>([]);
  const [selectedCreditId, setSelectedCreditId] = useState("");
  const [saving,         setSaving]         = useState(false);
  const [conflict,       setConflict]       = useState<string | null>(null);
  const [roomConflict,   setRoomConflict]   = useState<string | null>(null);
  const [extraRows,      setExtraRows]      = useState<ExtraServiceRow[]>([]);
  const [isRecurring,    setIsRecurring]    = useState(false);
  const [recurringFreq,  setRecurringFreq]  = useState<"weekly" | "biweekly" | "monthly">("weekly");
  const [recurringCount, setRecurringCount] = useState(4);

  // Update duration when service changes
  useEffect(() => {
    const svc = services.find(s => s.id === serviceId);
    if (svc) setDurationMins(svc.duration_minutes);
  }, [serviceId, services]);

  // Patient search
  useEffect(() => {
    if (patientSearch.length < 2) { setPatientResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("patients")
        .select("id, full_name, patient_tier, phone")
        .or(`full_name.ilike.%${patientSearch}%,phone.ilike.%${patientSearch}%`)
        .limit(6);
      setPatientResults((data ?? []) as typeof patientResults);
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  // B3: Fetch risk score when patient selected
  useEffect(() => {
    if (!selectedPatient) { setRiskScore(null); return; }
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    supabase.from("appointments")
      .select("status")
      .eq("patient_id", selectedPatient.id)
      .in("status", ["no_show", "cancelled"])
      .gte("start_time", sixMonthsAgo.toISOString())
      .then(({ data }) => {
        const noShows = (data ?? []).filter(a => a.status === "no_show").length;
        const cancels = (data ?? []).filter(a => a.status === "cancelled").length;
        setRiskScore(Math.min(100, noShows * 25 + cancels * 10));
      });
  }, [selectedPatient?.id]);

  // Fetch patient credits when patient + service changes
  useEffect(() => {
    if (!selectedPatient) return;
    supabase.from("patient_service_credits")
      .select("id, service_name, total_sessions, used_sessions, per_session_value, status")
      .eq("patient_id", selectedPatient.id)
      .eq("status", "active")
      .then(({ data }) => {
        const creds = (data ?? []) as PatientCredit[];
        setPatientCredits(creds);
        const svc = services.find(s => s.id === serviceId);
        const match = creds.find(c =>
          svc && (c.service_name.toLowerCase().includes(svc.name.toLowerCase()) ||
                  svc.name.toLowerCase().includes(c.service_name.toLowerCase()))
        );
        if (match) { setUseCredit(true); setSelectedCreditId(match.id); }
      });
  }, [selectedPatient?.id, serviceId]);

  // Double booking + room conflict check (F2)
  useEffect(() => {
    if (!providerId || !date || !startTime) { setConflict(null); setRoomConflict(null); return; }
    const start = new Date(`${date}T${startTime}`);
    const end   = new Date(start.getTime() + durationMins * 60000);
    const buffer = (settings?.buffer_time_minutes ?? 15) * 60000;

    const active = existingAppointments.filter(a => !["cancelled","no_show","completed"].includes(a.status));

    // Provider conflict
    const overlap = active.find(a =>
      a.provider_id === providerId &&
      new Date(a.start_time).getTime() < end.getTime()   + buffer &&
      new Date(a.end_time).getTime()   > start.getTime() - buffer
    );
    if (overlap) {
      const bufferMsg = settings?.buffer_time_minutes ? ` (including ${settings.buffer_time_minutes}min buffer)` : "";
      setConflict(`Overlaps with "${overlap.service_name}" for ${overlap.patient_name}${bufferMsg}`);
    } else {
      setConflict(null);
    }

    // F2: Room conflict
    if (room.trim()) {
      const roomOverlap = active.find(a =>
        a.room === room.trim() &&
        new Date(a.start_time).getTime() < end.getTime() &&
        new Date(a.end_time).getTime()   > start.getTime()
      );
      if (roomOverlap) {
        setRoomConflict(`Room "${room}" is booked for "${roomOverlap.service_name}" (${roomOverlap.patient_name}) at this time`);
      } else {
        setRoomConflict(null);
      }
    } else {
      setRoomConflict(null);
    }
  }, [providerId, room, date, startTime, durationMins, existingAppointments, settings]);

  async function handleSave() {
    if (!selectedPatient) { toast.error("Select a patient"); return; }
    if (!serviceId)        { toast.error("Select a service");  return; }
    if (conflict && !settings?.enable_double_booking) {
      toast.error("Double booking is disabled. Resolve the conflict first.");
      return;
    }

    setSaving(true);
    try {
      const creatorId = (await supabase.auth.getUser()).data.user?.id;
      const svc = services.find(s => s.id === serviceId);

      // Build list of start/end times — 1 if not recurring, N if recurring
      const freqDays = recurringFreq === "weekly" ? 7 : recurringFreq === "biweekly" ? 14 : 28;
      const recurrenceGroupId = isRecurring ? crypto.randomUUID() : null;
      const sessionCount = isRecurring ? recurringCount : 1;

      const slots: { start: Date; end: Date }[] = [];
      for (let i = 0; i < sessionCount; i++) {
        const base = new Date(`${date}T${startTime}`);
        base.setDate(base.getDate() + i * freqDays);
        const end = new Date(base.getTime() + durationMins * 60000);
        slots.push({ start: base, end });
      }

      const firstSlot = slots[0];
      // GAP-28: use server-side RPC with conflict check
      const { data: safeResult, error } = await withSupabaseRetry(() =>
        supabase.rpc("create_appointment_safe", {
          p_clinic_id:            activeClinicId,
          p_patient_id:           selectedPatient.id,
          p_provider_id:          providerId || null,
          p_service_id:           serviceId,
          p_service_name:         svc?.name ?? "Service",
          p_start_time:           firstSlot.start.toISOString(),
          p_end_time:             firstSlot.end.toISOString(),
          p_notes:                notes || null,
          p_room:                 room || null,
          p_credit_id:            useCredit && selectedCreditId ? selectedCreditId : null,
          p_credit_reserved:      useCredit && selectedCreditId && settings?.credit_lock ? true : false,
          p_recurrence_group_id:  recurrenceGroupId,
          p_created_by:           creatorId,
          p_allow_double_booking: settings?.enable_double_booking ?? false,
        })
      );

      if (error) throw error;
      const rpcResult = safeResult as { conflict: boolean; id?: string; conflict_patient?: string; conflict_service?: string };
      if (rpcResult?.conflict) {
        toast.error(`Booking conflict: "${rpcResult.conflict_service}" for ${rpcResult.conflict_patient} already in this slot`);
        setSaving(false);
        return;
      }
      const appt = rpcResult?.id ? { id: rpcResult.id } : null;

      // Insert remaining recurring slots (skip first — already inserted)
      if (isRecurring && slots.length > 1) {
        const recurringRows = slots.slice(1).map(slot => ({
          clinic_id:            activeClinicId,
          patient_id:           selectedPatient.id,
          provider_id:          providerId || null,
          service_id:           serviceId,
          credit_id:            null,
          service_name:         svc?.name ?? "Service",
          room:                 room || null,
          start_time:           slot.start.toISOString(),
          end_time:             slot.end.toISOString(),
          status:               "planned",
          notes:                notes || null,
          credit_reserved:      false,
          recurrence_group_id:  recurrenceGroupId,
          created_by:           creatorId,
        }));
        const { error: recurErr } = await supabase.from("appointments").insert(recurringRows);
        if (recurErr) throw recurErr;
      }

      // If credit_lock is on and using a credit, mark credit as reserved in log
      if (useCredit && selectedCreditId && settings?.credit_lock && appt) {
        await supabase.from("credit_consumption_log").insert({
          credit_id:      selectedCreditId,
          appointment_id: appt.id,
          session_date:   firstSlot.start.toISOString(),
          provider_id:    providerId || null,
          clinic_id:      activeClinicId,
          notes:          `Session reserved (not yet consumed) — credit lock active`,
        });
      }

      // Create extra service appointments chained after the main one
      let chainEnd = firstSlot.end;
      for (const row of extraRows) {
        if (!row.serviceId) continue;
        const xSvc   = services.find(s => s.id === row.serviceId);
        const xStart = chainEnd;
        const xEnd   = new Date(xStart.getTime() + row.durationMins * 60000);
        await supabase.from("appointments").insert({
          clinic_id:       activeClinicId,
          patient_id:      selectedPatient.id,
          provider_id:     row.providerId || providerId || null,
          service_id:      row.serviceId,
          credit_id:       null,
          service_name:    xSvc?.name ?? "Service",
          room:            room || null,
          start_time:      xStart.toISOString(),
          end_time:        xEnd.toISOString(),
          status:          "planned",
          notes:           `Part of multi-service booking — ${notes || ""}`.trim(),
          credit_reserved: false,
          created_by:      creatorId,
        });
        chainEnd = xEnd;
      }

      // B12: patient_event for appointment_booked
      supabase.from("patient_events").insert({
        clinic_id:   activeClinicId,
        patient_id:  selectedPatient.id,
        event_type:  "appointment_booked",
        entity_type: "appointment",
        entity_id:   appt?.id ?? null,
        summary:     `Appointment booked: ${svc?.name ?? "Service"}`,
        actor_name:  profile?.full_name ?? null,
      }).then(() => {});

      const extraMsg = extraRows.length > 0 ? ` + ${extraRows.length} extra service${extraRows.length > 1 ? "s" : ""}` : "";
      const recurringMsg = isRecurring ? ` (${recurringCount} sessions)` : "";
      toast.success(`Appointment booked for ${selectedPatient.full_name}${recurringMsg}${extraMsg}`);
      // N6: send intake form link
      if (sendIntake && selectedPatient) {
        const intakeUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/intake/${activeClinicId}`;
        const phone = (selectedPatient as { phone?: string | null }).phone?.replace(/\D/g, "") ?? "";
        if (phone) {
          window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(`Hi! Please fill your intake form before your visit: ${intakeUrl}`)}`, "_blank");
        } else {
          toast.info(`Intake link: ${intakeUrl}`, { duration: 8000 });
        }
      }
      onSaved();
    } catch (e) {
      toast.error("Failed to book appointment");
    } finally {
      setSaving(false);
    }
  }

  const selectedSvc = services.find(s => s.id === serviceId);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 150,
      background: "rgba(28,25,23,0.45)", backdropFilter: "blur(8px)",
      display: "flex", justifyContent: "flex-end",
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: "min(520px, 96vw)", height: "100%", background: "white",
        boxShadow: "-12px 0 60px rgba(28,25,23,0.18)",
        borderLeft: "1px solid rgba(197,160,89,0.2)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "20px 28px 14px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>Book Appointment</h2>
            <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={20} /></button>
          </div>
          {/* B4: Step progress bar */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {([
              { n: 1, label: "Patient" },
              { n: 2, label: "Details" },
              { n: 3, label: "Confirm" },
            ] as const).map(({ n, label }, i) => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 6, flex: n === 2 ? 1 : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    background: step >= n ? "#C5A059" : "var(--border)",
                    color: step >= n ? "white" : "var(--text-muted)",
                    fontSize: 11, fontWeight: 700, flexShrink: 0,
                  }}>
                    {step > n ? <Check size={11} /> : n}
                  </div>
                  <span style={{ fontSize: 11, color: step >= n ? "#C5A059" : "var(--text-muted)", fontFamily: "Georgia, serif", fontWeight: step === n ? 600 : 400 }}>
                    {label}
                  </span>
                </div>
                {i < 2 && <div style={{ flex: 1, height: 1, background: step > n ? "#C5A059" : "var(--border)", minWidth: 20 }} />}
              </div>
            ))}
          </div>
        </div>
        <div style={{ height: 1, background: "linear-gradient(to right, #C5A059, transparent)" }} />

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          {/* ── Step 1: Patient Selection ─────────────────────────────────── */}
          {step === 1 && <>
            {/* Patient */}
            <DLabel label="Patient" required>
              {selectedPatient ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(197,160,89,0.06)", border: "1px solid rgba(197,160,89,0.25)" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(197,160,89,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <User size={14} style={{ color: "#C5A059" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "Georgia, serif", fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>{selectedPatient.full_name}</p>
                    {selectedPatient.patient_tier && selectedPatient.patient_tier !== "standard" && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: selectedPatient.patient_tier === "vip" ? "#C5A059" : "#2E7D6E", background: selectedPatient.patient_tier === "vip" ? "rgba(197,160,89,0.15)" : "rgba(46,125,110,0.1)", padding: "1px 7px", borderRadius: 999 }}>
                        {selectedPatient.patient_tier.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <button onClick={() => { setSelectedPatient(null); setPatientSearch(""); setPatientCredits([]); }} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div style={{ position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 13px", borderRadius: 10, border: "1px solid #E8E2D4", background: "#FDFCF9" }}>
                    <Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    <input
                      value={patientSearch}
                      onChange={e => setPatientSearch(e.target.value)}
                      placeholder="Search by name or phone…"
                      style={{ background: "transparent", border: "none", outline: "none", fontSize: 14, flex: 1, fontFamily: "Georgia, serif", color: "var(--foreground)" }}
                      autoFocus
                    />
                  </div>
                  {patientResults.length > 0 && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "white", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", marginTop: 4, overflow: "hidden" }}>
                      {patientResults.map(p => (
                        <div
                          key={p.id}
                          onClick={() => { setSelectedPatient(p); setPatientSearch(""); setPatientResults([]); }}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid rgba(0,0,0,0.04)" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(197,160,89,0.05)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "white"; }}
                        >
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(197,160,89,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <User size={12} style={{ color: "#C5A059" }} />
                          </div>
                          <div>
                            <p style={{ fontFamily: "Georgia, serif", fontSize: 13, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>{p.full_name}</p>
                            {p.phone && <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>{p.phone}</p>}
                          </div>
                          {p.patient_tier && p.patient_tier !== "standard" && (
                            <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: p.patient_tier === "vip" ? "#C5A059" : "#2E7D6E", background: p.patient_tier === "vip" ? "rgba(197,160,89,0.15)" : "rgba(46,125,110,0.1)", padding: "2px 8px", borderRadius: 999 }}>
                              {p.patient_tier.toUpperCase()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </DLabel>

            {/* B3: Risk Score badge */}
            {selectedPatient && riskScore !== null && riskScore > 40 && (
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px",
                borderRadius: 10,
                background: riskScore > 60 ? "rgba(180,60,60,0.07)" : "rgba(212,160,23,0.07)",
                border: `1px solid ${riskScore > 60 ? "rgba(180,60,60,0.3)" : "rgba(212,160,23,0.35)"}`,
              }}>
                <AlertTriangle size={15} style={{ color: riskScore > 60 ? "#B43C3C" : "#D4A017", flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: riskScore > 60 ? "#B43C3C" : "#D4A017", margin: 0 }}>
                    {riskScore > 60 ? "⚠ High-Risk Patient — Deposit Recommended" : "Moderate Risk Patient"}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>
                    Risk score: {riskScore}/100 — based on recent no-shows & cancellations
                  </p>
                </div>
              </div>
            )}

            {/* Patient's active credits summary */}
            {selectedPatient && patientCredits.length > 0 && (
              <div style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(197,160,89,0.05)", border: "1px solid rgba(197,160,89,0.2)" }}>
                <p style={{ fontSize: 11, color: "#C5A059", fontWeight: 600, margin: 0 }}>
                  <CreditCard size={11} style={{ display: "inline", marginRight: 4 }} />
                  {patientCredits.length} active package{patientCredits.length > 1 ? "s" : ""} — assignable on next step
                </p>
              </div>
            )}
          </>}

          {/* ── Step 2: Service Details ───────────────────────────────────── */}
          {step === 2 && <>
            {/* Service */}
            <DLabel label="Service" required>
              <select value={serviceId} onChange={e => setServiceId(e.target.value)} style={inputStyle}>
                {services.map(s => <option key={s.id} value={s.id}>{s.name} — {s.category} ({s.duration_minutes} min)</option>)}
              </select>
            </DLabel>

            {/* Provider */}
            <DLabel label="Provider">
              <select value={providerId} onChange={e => setProviderId(e.target.value)} style={inputStyle}>
                <option value="">— Unassigned —</option>
                {providers.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>)}
              </select>
            </DLabel>

            {/* Date + Start Time */}
            <div style={{ display: "flex", gap: 14 }}>
              <DLabel label="Date" required style={{ flex: 1 }}>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
              </DLabel>
              <DLabel label="Start Time" required style={{ flex: 1 }}>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={inputStyle} />
              </DLabel>
            </div>

            {/* Duration */}
            <DLabel label="Duration (minutes)">
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {[30, 45, 60, 90, 120].map(d => (
                  <button key={d} onClick={() => setDurationMins(d)} style={{
                    padding: "5px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12,
                    fontFamily: "Georgia, serif",
                    border: durationMins === d ? "1px solid #C5A059" : "1px solid var(--border)",
                    background: durationMins === d ? "rgba(197,160,89,0.1)" : "var(--surface)",
                    color: durationMins === d ? "#A8853A" : "var(--text-muted)",
                    fontWeight: durationMins === d ? 600 : 400,
                  }}>
                    {d < 60 ? `${d}m` : `${d/60}h`}
                  </button>
                ))}
                <input
                  type="number" value={durationMins} min={5} max={480}
                  onChange={e => setDurationMins(Number(e.target.value))}
                  style={{ ...inputStyle, width: 70 }}
                />
              </div>
              {selectedSvc && (
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  Standard duration for {selectedSvc.name}: {selectedSvc.duration_minutes} min
                </p>
              )}
            </DLabel>

            {/* Room */}
            <DLabel label="Room / Cabin (optional)">
              <input value={room} onChange={e => setRoom(e.target.value)} placeholder="e.g. Room 2, Laser Suite…" style={inputStyle} />
            </DLabel>

            {/* Notes */}
            <DLabel label="Notes">
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Any special instructions…" style={{ ...inputStyle, resize: "vertical" }} />
            </DLabel>

            {/* Package Credit */}
            {patientCredits.length > 0 && (
              <div style={{ padding: 16, borderRadius: 12, background: "rgba(197,160,89,0.05)", border: "1px solid rgba(197,160,89,0.2)" }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9C9584", marginBottom: 12 }}>
                  Patient has active packages
                </p>
                {patientCredits.map(cr => (
                  <div
                    key={cr.id}
                    onClick={() => { setUseCredit(true); setSelectedCreditId(cr.id); }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "8px 12px", borderRadius: 9, marginBottom: 6, cursor: "pointer",
                      border: selectedCreditId === cr.id && useCredit ? "1px solid rgba(197,160,89,0.5)" : "1px solid var(--border)",
                      background: selectedCreditId === cr.id && useCredit ? "rgba(197,160,89,0.08)" : "white",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {selectedCreditId === cr.id && useCredit && <Check size={12} style={{ color: "#C5A059" }} />}
                      <div>
                        <p style={{ fontFamily: "Georgia, serif", fontSize: 13, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>{cr.service_name}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>{cr.total_sessions - cr.used_sessions} sessions left</p>
                      </div>
                    </div>
                    <span style={{ fontSize: 12, color: "#C5A059", fontWeight: 700 }}>{fmt(cr.per_session_value)}/session</span>
                  </div>
                ))}
                {settings?.credit_lock && useCredit && (
                  <p style={{ fontSize: 11, color: "#9C9584", marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}>
                    <Shield size={11} /> Credit will be <strong>reserved</strong> (not deducted) until session is completed
                  </p>
                )}
              </div>
            )}

            {/* Additional Services (Multi-service booking) */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9C9584", margin: 0 }}>
                  Additional Services (Same Visit)
                </p>
                <button
                  onClick={() => setExtraRows(r => [...r, { uid: crypto.randomUUID(), serviceId: services[0]?.id ?? "", durationMins: services[0]?.duration_minutes ?? 60, providerId: "" }])}
                  style={{ fontSize: 12, color: "#C5A059", background: "rgba(197,160,89,0.08)", border: "1px solid rgba(197,160,89,0.25)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                >
                  <Plus size={11} /> Add Service
                </button>
              </div>
              {extraRows.map((row, idx) => {
                const xSvc = services.find(s => s.id === row.serviceId);
                return (
                  <div key={row.uid} style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(197,160,89,0.04)", border: "1px solid rgba(197,160,89,0.15)", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <GripVertical size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#9C9584", textTransform: "uppercase", letterSpacing: "0.08em" }}>Service {idx + 2}</span>
                      <button onClick={() => setExtraRows(r => r.filter(x => x.uid !== row.uid))} style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer", color: "#B43C3C" }}><X size={13} /></button>
                    </div>
                    <select
                      value={row.serviceId}
                      onChange={e => {
                        const svc = services.find(s => s.id === e.target.value);
                        setExtraRows(r => r.map(x => x.uid === row.uid ? { ...x, serviceId: e.target.value, durationMins: svc?.duration_minutes ?? 60 } : x));
                      }}
                      style={{ ...inputStyle, marginBottom: 8 }}
                    >
                      {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes} min)</option>)}
                    </select>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <select
                        value={row.providerId}
                        onChange={e => setExtraRows(r => r.map(x => x.uid === row.uid ? { ...x, providerId: e.target.value } : x))}
                        style={{ ...inputStyle, flex: 1 }}
                      >
                        <option value="">— Same provider —</option>
                        {providers.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                      </select>
                      {xSvc && <span style={{ fontSize: 11, color: "#C5A059", whiteSpace: "nowrap" }}>will follow at {row.durationMins} min</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Recurring Appointments */}
            <div style={{ padding: 16, borderRadius: 12, background: "rgba(197,160,89,0.04)", border: "1px solid var(--border)" }}>
              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: isRecurring ? 14 : 0 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, fontFamily: "Georgia, serif", margin: 0 }}>Recurring Appointment</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>Create multiple sessions automatically</p>
                </div>
                <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} style={{ accentColor: "#C5A059", width: 16, height: 16 }} />
              </label>
              {isRecurring && (
                <div style={{ display: "flex", gap: 14 }}>
                  <div style={{ flex: 2 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "#9C9584", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Frequency</p>
                    <select
                      value={recurringFreq}
                      onChange={e => setRecurringFreq(e.target.value as "weekly" | "biweekly" | "monthly")}
                      style={inputStyle}
                    >
                      <option value="weekly">Weekly (every 7 days)</option>
                      <option value="biweekly">Bi-weekly (every 14 days)</option>
                      <option value="monthly">Monthly (every 4 weeks)</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "#9C9584", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Sessions</p>
                    <input
                      type="number" min={2} max={24} value={recurringCount}
                      onChange={e => setRecurringCount(Math.max(2, Math.min(24, Number(e.target.value))))}
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}
              {isRecurring && (
                <p style={{ fontSize: 11, color: "#C5A059", marginTop: 10 }}>
                  Will create {recurringCount} appointments — first on {date}, then every {recurringFreq === "weekly" ? "7" : recurringFreq === "biweekly" ? "14" : "28"} days
                </p>
              )}
            </div>

            {/* Conflict warning */}
            {conflict && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", borderRadius: 10, background: settings?.enable_double_booking ? "rgba(212,160,23,0.08)" : "rgba(180,60,60,0.07)", border: `1px solid ${settings?.enable_double_booking ? "rgba(212,160,23,0.35)" : "rgba(180,60,60,0.3)"}` }}>
                <AlertTriangle size={14} style={{ color: settings?.enable_double_booking ? "#D4A017" : "#B43C3C", flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: settings?.enable_double_booking ? "#D4A017" : "#B43C3C", margin: 0 }}>
                    {settings?.enable_double_booking ? "Warning: Double Booking" : "Booking Conflict"}
                  </p>
                  <p style={{ fontSize: 11, color: settings?.enable_double_booking ? "#D4A017" : "#B43C3C", margin: 0, opacity: 0.8 }}>{conflict}</p>
                  {!settings?.enable_double_booking && (
                    <>
                      <p style={{ fontSize: 11, color: "#9C9584", margin: "4px 0 0" }}>Double booking is OFF. Add patient to the waitlist instead.</p>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!selectedPatient || !activeClinicId) return;
                          const { error } = await supabase.from("scheduler_waitlist").insert({
                            clinic_id:      activeClinicId,
                            patient_id:     selectedPatient.id,
                            service_id:     serviceId || null,
                            preferred_date: date || null,
                            notes:          notes || null,
                            status:         "waiting",
                            added_by:       profile?.id ?? null,
                          });
                          if (error) { toast.error("Could not add to waitlist"); }
                          else { toast.success(`${selectedPatient.full_name} added to waitlist`); onClose(); }
                        }}
                        style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, border: "1px solid rgba(180,60,60,0.35)", background: "rgba(180,60,60,0.08)", color: "#B43C3C", cursor: "pointer" }}
                      >
                        Add to Waitlist
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* F2: Room conflict warning */}
            {roomConflict && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(234,88,12,0.07)", border: "1px solid rgba(234,88,12,0.3)" }}>
                <AlertTriangle size={14} style={{ color: "#ea580c", flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#ea580c", margin: 0 }}>Room Conflict</p>
                  <p style={{ fontSize: 11, color: "#ea580c", margin: 0, opacity: 0.85 }}>{roomConflict}</p>
                </div>
              </div>
            )}
          </>}

          {/* ── Step 3: Confirm ───────────────────────────────────────────── */}
          {step === 3 && <>
            {/* Summary card */}
            <div style={{ padding: 16, borderRadius: 12, background: "rgba(197,160,89,0.05)", border: "1px solid rgba(197,160,89,0.2)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9C9584", marginBottom: 12 }}>Booking Summary</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Patient</span>
                  <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "Georgia, serif" }}>{selectedPatient?.full_name}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Service</span>
                  <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "Georgia, serif" }}>{selectedSvc?.name}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Provider</span>
                  <span style={{ fontSize: 13, fontFamily: "Georgia, serif" }}>{providers.find(p => p.id === providerId)?.full_name ?? "Unassigned"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Date & Time</span>
                  <span style={{ fontSize: 13, fontFamily: "Georgia, serif" }}>{date} at {startTime}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Duration</span>
                  <span style={{ fontSize: 13, fontFamily: "Georgia, serif" }}>{durationMins} min</span>
                </div>
                {isRecurring && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "#C5A059" }}>Recurring</span>
                    <span style={{ fontSize: 12, color: "#C5A059", fontWeight: 600 }}>
                      {recurringCount} sessions · {recurringFreq === "weekly" ? "Weekly" : recurringFreq === "biweekly" ? "Bi-weekly" : "Monthly"}
                    </span>
                  </div>
                )}
                {useCredit && selectedCreditId && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "#C5A059" }}>Using Credit</span>
                    <span style={{ fontSize: 12, color: "#C5A059" }}>{patientCredits.find(c => c.id === selectedCreditId)?.service_name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* B4: Toggles */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 10, border: "1px solid var(--border)", cursor: "pointer" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, fontFamily: "Georgia, serif", margin: 0 }}>Send WhatsApp Reminder</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>24-hour reminder before appointment</p>
                </div>
                <input type="checkbox" checked={sendWhatsApp} onChange={e => setSendWhatsApp(e.target.checked)} style={{ accentColor: "#C5A059", width: 16, height: 16 }} />
              </label>
              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 10, border: "1px solid var(--border)", cursor: "pointer" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, fontFamily: "Georgia, serif", margin: 0 }}>Send Intake Form</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>Pre-visit health questionnaire</p>
                </div>
                <input type="checkbox" checked={sendIntake} onChange={e => setSendIntake(e.target.checked)} style={{ accentColor: "#C5A059", width: 16, height: 16 }} />
              </label>
            </div>

            {/* High-risk deposit reminder */}
            {riskScore !== null && riskScore > 60 && (
              <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(180,60,60,0.07)", border: "1px solid rgba(180,60,60,0.3)" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#B43C3C", margin: 0 }}>
                  <AlertTriangle size={12} style={{ display: "inline", marginRight: 4 }} />
                  High-Risk: Consider collecting a deposit before confirming
                </p>
              </div>
            )}
          </>}

          </div>
        </div>

        {/* Footer — step-aware */}
        <div style={{ padding: "16px 28px", borderTop: "1px solid var(--border)", display: "flex", gap: 12 }}>
          {step === 1 && (
            <>
              <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: 14, fontFamily: "Georgia, serif", cursor: "pointer" }}>
                Cancel
              </button>
              <button
                onClick={() => { if (!selectedPatient) { toast.error("Select a patient first"); return; } setStep(2); }}
                style={{ flex: 2, padding: "11px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #C5A059, #A8853A)", color: "white", fontSize: 14, fontWeight: 600, fontFamily: "Georgia, serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: "0 4px 14px rgba(197,160,89,0.3)" }}
              >
                Next: Service Details <ChevronRight size={15} />
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: 14, fontFamily: "Georgia, serif", cursor: "pointer" }}>
                ← Back
              </button>
              <button
                onClick={() => { if (!serviceId) { toast.error("Select a service"); return; } if (conflict && !settings?.enable_double_booking) { toast.error("Resolve conflict first"); return; } setStep(3); }}
                style={{ flex: 2, padding: "11px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #C5A059, #A8853A)", color: "white", fontSize: 14, fontWeight: 600, fontFamily: "Georgia, serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: "0 4px 14px rgba(197,160,89,0.3)" }}
              >
                Next: Confirm <ChevronRight size={15} />
              </button>
            </>
          )}
          {step === 3 && (
            <>
              <button onClick={() => setStep(2)} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: 14, fontFamily: "Georgia, serif", cursor: "pointer" }}>
                ← Back
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  flex: 2, padding: "11px 0", borderRadius: 12, border: "none",
                  background: saving ? "rgba(197,160,89,0.5)" : "linear-gradient(135deg, #C5A059, #A8853A)",
                  color: "white", fontSize: 14, fontWeight: 600,
                  fontFamily: "Georgia, serif", cursor: saving ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  boxShadow: "0 4px 14px rgba(197,160,89,0.3)",
                }}
              >
                {saving && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
                <CalendarCheck size={15} /> Confirm Booking
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── B5: Waitlist Tab ──────────────────────────────────────────────────────────

interface WaitlistEntry {
  id: string;
  patient_id: string;
  preferred_date: string | null;
  time_preference: string | null;
  notes: string | null;
  created_at: string;
  status: string;
  patients: { full_name: string } | null;
  services: { name: string } | null;
}

function WaitlistTab({ activeClinicId, onBook }: { activeClinicId: string | null; onBook: () => void }) {
  const [list, setList]       = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeClinicId) return;
    supabase.from("scheduler_waitlist")
      .select("*, patients!patient_id(full_name), services!service_id(name)")
      .eq("clinic_id", activeClinicId)
      .eq("status", "waiting")
      .order("created_at")
      .then(({ data }) => { setList((data ?? []) as WaitlistEntry[]); setLoading(false); });
  }, [activeClinicId]);

  async function offerSlot(id: string) {
    await supabase.from("scheduler_waitlist")
      .update({ status: "offered", offered_at: new Date().toISOString() })
      .eq("id", id);
    toast.success("Slot offered — patient notified via WhatsApp (when enabled)");
    setList(l => l.filter(x => x.id !== id));
  }

  async function removeEntry(id: string) {
    await supabase.from("scheduler_waitlist").update({ status: "cancelled" }).eq("id", id);
    setList(l => l.filter(x => x.id !== id));
    toast.success("Removed from waitlist");
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60 }}>
      <Loader2 size={24} style={{ color: "rgba(197,160,89,0.5)", animation: "spin 1s linear infinite" }} />
    </div>
  );

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h3 style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 600, margin: 0 }}>Waitlist</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0" }}>{list.length} patient{list.length !== 1 ? "s" : ""} waiting</p>
        </div>
        <button
          onClick={onBook}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #C5A059, #A8853A)", color: "white", fontSize: 13, fontWeight: 600, fontFamily: "Georgia, serif", cursor: "pointer" }}
        >
          <Plus size={13} /> Book Appointment
        </button>
      </div>

      {list.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
          <Users size={40} style={{ color: "rgba(197,160,89,0.3)", marginBottom: 12 }} />
          <p style={{ fontFamily: "Georgia, serif", fontSize: 16 }}>No patients on the waitlist</p>
          <p style={{ fontSize: 13 }}>Patients are added when they request a slot outside availability</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "rgba(249,247,242,0.8)" }}>
                {["Patient", "Service", "Preferred Date", "Time Preference", "On Waitlist Since", "Actions"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9C9584" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map(entry => (
                <tr key={entry.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                  <td style={{ padding: "12px 16px", fontFamily: "Georgia, serif", fontSize: 14, fontWeight: 600 }}>
                    {(entry.patients as { full_name: string } | null)?.full_name ?? "—"}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-muted)" }}>
                    {(entry.services as { name: string } | null)?.name ?? "Any"}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>{entry.preferred_date ?? "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-muted)" }}>{entry.time_preference ?? "Flexible"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-muted)" }}>
                    {new Date(entry.created_at).toLocaleDateString("en-IN")}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => offerSlot(entry.id)}
                        style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, border: "none", background: "#4A8A4A", color: "white", cursor: "pointer", fontFamily: "Georgia, serif" }}
                      >
                        Offer Slot
                      </button>
                      <button
                        onClick={onBook}
                        style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.4)", background: "rgba(197,160,89,0.08)", color: "#A8853A", cursor: "pointer", fontFamily: "Georgia, serif" }}
                      >
                        Book
                      </button>
                      <button
                        onClick={() => removeEntry(entry.id)}
                        style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, border: "none", background: "rgba(180,60,60,0.07)", color: "#B43C3C", cursor: "pointer" }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── B6: Recalls Tab ───────────────────────────────────────────────────────────

interface RecallTask {
  id: string;
  patient_id: string;
  service_name: string;
  recall_date: string;
  status: string;
  notes: string | null;
  created_at: string;
  patients: { full_name: string; phone: string | null } | null;
}

function RecallsTab({ activeClinicId, onBook }: { activeClinicId: string | null; onBook: () => void }) {
  const [tasks, setTasks]     = useState<RecallTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeClinicId) return;
    supabase.from("recall_tasks")
      .select("*, patients!patient_id(full_name, phone)")
      .eq("clinic_id", activeClinicId)
      .in("status", ["pending", "sent"])
      .order("recall_date")
      .then(({ data }) => { setTasks((data ?? []) as RecallTask[]); setLoading(false); });
  }, [activeClinicId]);

  // GAP-34: Use wa.me deeplink instead of placeholder Edge Function
  async function sendRecall(task: RecallTask) {
    await supabase.from("recall_tasks").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", task.id);
    setTasks(t => t.map(x => x.id === task.id ? { ...x, status: "sent" } : x));
    const phone = task.patients?.phone?.replace(/\D/g, "") ?? "";
    const msg = `Hi ${task.patients?.full_name ?? ""},\n\nIt's time for your ${task.service_name} follow-up! Please call us or reply here to schedule your appointment.\n\nThank you!`;
    if (phone) {
      window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, "_blank");
    } else {
      toast.success("Recall marked as sent");
    }
  }

  async function dismissRecall(id: string) {
    await supabase.from("recall_tasks").update({ status: "dismissed" }).eq("id", id);
    setTasks(t => t.filter(x => x.id !== id));
    toast.success("Recall dismissed");
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60 }}>
      <Loader2 size={24} style={{ color: "rgba(197,160,89,0.5)", animation: "spin 1s linear infinite" }} />
    </div>
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h3 style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 600, margin: 0 }}>Recall Tasks</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0" }}>Patients due for follow-up treatment</p>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
          <CalendarClock size={40} style={{ color: "rgba(197,160,89,0.3)", marginBottom: 12 }} />
          <p style={{ fontFamily: "Georgia, serif", fontSize: 16 }}>No pending recalls</p>
          <p style={{ fontSize: 13 }}>Recalls are auto-created when appointments are completed</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "rgba(249,247,242,0.8)" }}>
                {["Patient", "Treatment", "Recall Date", "Status", "Actions"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9C9584" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => {
                const isOverdue = task.recall_date < today;
                const isDueToday = task.recall_date === today;
                return (
                  <tr key={task.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)", background: isOverdue ? "rgba(180,60,60,0.03)" : isDueToday ? "rgba(212,160,23,0.04)" : "transparent" }}>
                    <td style={{ padding: "12px 16px", fontFamily: "Georgia, serif", fontSize: 14, fontWeight: 600 }}>
                      {task.patients?.full_name ?? "—"}
                      {task.notes && <p style={{ fontSize: 11, color: "#9C9584", margin: "2px 0 0", fontWeight: 400, fontFamily: "inherit" }}>{task.notes}</p>}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13 }}>{task.service_name}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13 }}>
                      <span style={{ color: isOverdue ? "#B43C3C" : isDueToday ? "#D4A017" : "var(--foreground)", fontWeight: isOverdue || isDueToday ? 600 : 400 }}>
                        {task.recall_date}
                        {isOverdue && " (Overdue)"}
                        {isDueToday && " (Today)"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        fontSize: 11, padding: "2px 8px", borderRadius: 999, fontWeight: 600,
                        background: task.status === "sent" ? "rgba(74,138,74,0.1)" : "rgba(197,160,89,0.1)",
                        color: task.status === "sent" ? "#4A8A4A" : "#C5A059",
                      }}>
                        {task.status === "sent" ? "Notified" : "Pending"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {task.status === "pending" && (
                          <button
                            onClick={() => sendRecall(task)}
                            style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, border: "none", background: "#C5A059", color: "white", cursor: "pointer", fontFamily: "Georgia, serif", display: "flex", alignItems: "center", gap: 4 }}
                          >
                            <Bell size={11} /> Send Recall
                          </button>
                        )}
                        <button
                          onClick={onBook}
                          style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.4)", background: "rgba(197,160,89,0.08)", color: "#A8853A", cursor: "pointer", fontFamily: "Georgia, serif" }}
                        >
                          Book
                        </button>
                        <button
                          onClick={() => dismissRecall(task.id)}
                          style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, border: "none", background: "rgba(180,60,60,0.07)", color: "#B43C3C", cursor: "pointer" }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Settings Drawer ───────────────────────────────────────────────────────────

function SettingsDrawer({ current, activeClinicId, onClose, onSaved }: {
  current: SchedulerSettings | null;
  activeClinicId: string | null;
  onClose: () => void;
  onSaved: (s: SchedulerSettings) => void;
}) {
  const [doubleBook, setDoubleBook] = useState(current?.enable_double_booking ?? false);
  const [buffer,     setBuffer]     = useState(current?.buffer_time_minutes ?? 15);
  const [creditLock, setCreditLock] = useState(current?.credit_lock ?? true);
  const [wStart,     setWStart]     = useState(current?.working_start ?? "09:00");
  const [wEnd,       setWEnd]       = useState(current?.working_end ?? "21:00");
  const [slotDur,    setSlotDur]    = useState(current?.slot_duration_minutes ?? 30);
  const [saving,     setSaving]     = useState(false);

  async function handleSave() {
    if (!activeClinicId) return;
    setSaving(true);
    const payload = {
      clinic_id:            activeClinicId,
      enable_double_booking: doubleBook,
      buffer_time_minutes:  buffer,
      credit_lock:          creditLock,
      working_start:        wStart,
      working_end:          wEnd,
      slot_duration_minutes: slotDur,
      updated_at:           new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("scheduler_settings")
      .upsert(payload, { onConflict: "clinic_id" })
      .select("*")
      .single();
    if (error) { toast.error("Save failed"); setSaving(false); return; }
    toast.success("Scheduler settings saved");
    onSaved(data as SchedulerSettings);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 150,
      background: "rgba(28,25,23,0.45)", backdropFilter: "blur(8px)",
      display: "flex", justifyContent: "flex-end",
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: "min(440px, 96vw)", height: "100%", background: "white",
        boxShadow: "-12px 0 60px rgba(28,25,23,0.18)",
        borderLeft: "1px solid rgba(197,160,89,0.2)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: "24px 28px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>Scheduler Settings</h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Admin-controlled clinic scheduling rules</p>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={20} /></button>
        </div>
        <div style={{ height: 1, background: "linear-gradient(to right, #C5A059, transparent)" }} />

        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Double booking */}
            <SettingCard
              icon={<AlertTriangle size={16} style={{ color: "#D4A017" }} />}
              title="Double Booking"
              sub={doubleBook
                ? "ON — Overlaps are allowed and highlighted with a red border"
                : "OFF — Overlapping slots are blocked for the same provider"}
            >
              <Toggle checked={doubleBook} onChange={setDoubleBook} />
            </SettingCard>

            {/* Buffer time */}
            <SettingCard
              icon={<Clock size={16} style={{ color: "#C5A059" }} />}
              title="Linen Change Buffer"
              sub="Gap between appointments for room setup and changeover"
            >
              <div style={{ display: "flex", gap: 8 }}>
                {[0, 15, 30, 45, 60].map(b => (
                  <button key={b} onClick={() => setBuffer(b)} style={{
                    padding: "5px 11px", borderRadius: 8, cursor: "pointer", fontSize: 12,
                    fontFamily: "Georgia, serif",
                    border: buffer === b ? "1px solid #C5A059" : "1px solid var(--border)",
                    background: buffer === b ? "rgba(197,160,89,0.1)" : "var(--surface)",
                    color: buffer === b ? "#A8853A" : "var(--text-muted)",
                    fontWeight: buffer === b ? 600 : 400,
                  }}>
                    {b === 0 ? "None" : `${b}m`}
                  </button>
                ))}
              </div>
            </SettingCard>

            {/* Credit Lock */}
            <SettingCard
              icon={<Shield size={16} style={{ color: "#2A4A8A" }} />}
              title="Credit Lock"
              sub={creditLock
                ? "ON — Session credits are Reserved at booking, deducted only on Completion"
                : "OFF — Sessions deducted immediately at booking (not recommended for Indian market)"}
            >
              <Toggle checked={creditLock} onChange={setCreditLock} />
            </SettingCard>

            {/* Working hours */}
            <SettingCard
              icon={<Calendar size={16} style={{ color: "#4A8A4A" }} />}
              title="Working Hours"
              sub="Define the time range shown in the calendar grid"
            >
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <input type="time" value={wStart} onChange={e => setWStart(e.target.value)} style={{ ...inputStyle, width: 130 }} />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>to</span>
                <input type="time" value={wEnd} onChange={e => setWEnd(e.target.value)} style={{ ...inputStyle, width: 130 }} />
              </div>
            </SettingCard>

            {/* Slot duration */}
            <SettingCard
              icon={<Clock size={16} style={{ color: "#9C9584" }} />}
              title="Default Slot Duration"
              sub="Minimum booking interval for new appointments"
            >
              <div style={{ display: "flex", gap: 8 }}>
                {[15, 30, 45, 60].map(d => (
                  <button key={d} onClick={() => setSlotDur(d)} style={{
                    padding: "5px 11px", borderRadius: 8, cursor: "pointer", fontSize: 12,
                    fontFamily: "Georgia, serif",
                    border: slotDur === d ? "1px solid #C5A059" : "1px solid var(--border)",
                    background: slotDur === d ? "rgba(197,160,89,0.1)" : "var(--surface)",
                    color: slotDur === d ? "#A8853A" : "var(--text-muted)",
                    fontWeight: slotDur === d ? 600 : 400,
                  }}>
                    {d}m
                  </button>
                ))}
              </div>
            </SettingCard>

          </div>
        </div>

        <div style={{ padding: "16px 28px", borderTop: "1px solid var(--border)", display: "flex", gap: 12 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: 14, fontFamily: "Georgia, serif", cursor: "pointer" }}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 2, padding: "11px 0", borderRadius: 12, border: "none",
              background: saving ? "rgba(197,160,89,0.5)" : "linear-gradient(135deg, #C5A059, #A8853A)",
              color: "white", fontSize: 14, fontWeight: 600, fontFamily: "Georgia, serif",
              cursor: saving ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              boxShadow: "0 4px 14px rgba(197,160,89,0.3)",
            }}
          >
            {saving && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingCard({ icon, title, sub, children }: { icon: React.ReactNode; title: string; sub: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "16px 20px", borderRadius: 14, background: "rgba(249,247,242,0.7)", border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {icon}
          <div>
            <p style={{ fontFamily: "Georgia, serif", fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>{title}</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, marginTop: 2 }}>{sub}</p>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 999, border: "none", cursor: "pointer",
        background: checked ? "#C5A059" : "#E0D9D0", position: "relative",
        flexShrink: 0, transition: "background 0.2s",
      }}
    >
      <span style={{
        position: "absolute", top: 2, left: checked ? 22 : 2,
        width: 20, height: 20, borderRadius: "50%", background: "white",
        transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}

function DLabel({ label, required, children, style }: {
  label: string; required?: boolean; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9C9584", marginBottom: 7 }}>
        {label}{required && <span style={{ color: "#C5A059", marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 13px", borderRadius: 10,
  border: "1px solid #E8E2D4", background: "#FDFCF9",
  fontSize: 14, fontFamily: "Georgia, serif", color: "var(--foreground)",
  outline: "none", boxSizing: "border-box",
};

// ── Checkout Modal ────────────────────────────────────────────────────────────

interface CheckoutLineItem {
  uid: string;
  type: "base" | "service" | "product";
  name: string;
  qty: number;
  unitPrice: number;
}

type PaymentMethod = "cash" | "card" | "upi" | "package";

function CheckoutModal({ appointment: a, credit, activeClinicId, onClose, onCompleted }: {
  appointment: Appointment;
  credit: PatientCredit | null;
  activeClinicId: string | null;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const [step, setStep]           = useState<"invoice" | "payment">("invoice");
  const [lineItems, setLineItems] = useState<CheckoutLineItem[]>([]);
  const [allServices,  setAllServices]  = useState<Service[]>([]);
  const [allProducts,  setAllProducts]  = useState<{ id: string; product_name: string; selling_price: number | null }[]>([]);
  const [loadingData,  setLoadingData]  = useState(true);
  const [addingType,   setAddingType]   = useState<"service" | "product" | null>(null);
  const [addServiceId, setAddServiceId] = useState("");
  const [addProductId, setAddProductId] = useState("");
  const [payMethod,    setPayMethod]    = useState<PaymentMethod>("cash");
  const [amountPaid,   setAmountPaid]   = useState(0);
  const [processing,   setProcessing]   = useState(false);
  const [gstPct,       setGstPct]       = useState(18);

  // Fetch services, products, and base price
  useEffect(() => {
    Promise.all([
      supabase.from("services")
        .select("id, name, category, duration_minutes, selling_price")
        .or(`clinic_id.eq.${activeClinicId},is_global_template.eq.true`)
        .eq("is_active", true).order("name"),
      supabase.from("inventory_products")
        .select("id, product_name, selling_price")
        .eq("clinic_id", activeClinicId ?? "")
        .eq("category", "retail")
        .limit(100),
    ]).then(([svcRes, prodRes]) => {
      const svcs = (svcRes.data ?? []) as Service[];
      setAllServices(svcs);
      setAllProducts(prodRes.data ?? []);

      // Set up base line item
      let basePrice = 0;
      if (credit) {
        basePrice = credit.per_session_value;
      } else {
        const svc = svcs.find(s => s.id === a.service_id);
        basePrice = svc?.selling_price ?? 0;
      }
      setLineItems([{ uid: "base", type: "base", name: a.service_name, qty: 1, unitPrice: basePrice }]);
      setAmountPaid(basePrice > 0 && !credit ? Math.round(basePrice * 1.18) : 0);
      setLoadingData(false);
    });
  }, [activeClinicId, a.service_id, a.service_name, credit]);

  const subtotal = lineItems.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const gst      = credit && lineItems.filter(i => i.type !== "base").length === 0
    ? 0 // No GST on package-covered session with no extras
    : Math.round(subtotal * gstPct / 100);
  const total    = subtotal + gst;
  const covered  = credit ? (credit.per_session_value ?? 0) : 0;
  const balanceDue = Math.max(0, total - covered);

  function addExtraService() {
    if (!addServiceId) return;
    const svc = allServices.find(s => s.id === addServiceId);
    if (!svc) return;
    setLineItems(prev => [...prev, { uid: crypto.randomUUID(), type: "service", name: svc.name, qty: 1, unitPrice: svc.selling_price }]);
    setAddServiceId(""); setAddingType(null);
  }

  function addExtraProduct() {
    if (!addProductId) return;
    const prod = allProducts.find(p => p.id === addProductId);
    if (!prod) return;
    setLineItems(prev => [...prev, { uid: crypto.randomUUID(), type: "product", name: prod.product_name, qty: 1, unitPrice: prod.selling_price ?? 0 }]);
    setAddProductId(""); setAddingType(null);
  }

  async function handleCheckout() {
    setProcessing(true);
    try {
      // 1. Resolve commission rate (H-1 fix: error on missing rate)
      const { data: commPctRow } = await supabase.rpc("get_commission_pct", {
        p_clinic_id:   activeClinicId,
        p_provider_id: a.provider_id ?? "",
        p_service_id:  a.service_id  ?? null,
      });
      const rawCheckoutCommPct = commPctRow as number | null;
      if (rawCheckoutCommPct === null && a.provider_id) {
        toast.error("No commission rate configured for this provider. Please set one in Staff settings before checking out.");
        setProcessing(false);
        return;
      }
      const commissionPct = rawCheckoutCommPct ?? 0;

      // 2. Consume credit session atomically (GAP-3)
      if (credit) {
        const { error: consumeErr } = await supabase.rpc("consume_session", {
          p_credit_id:      credit.id,
          p_appointment_id: a.id,
          p_provider_id:    a.provider_id ?? null,
          p_clinic_id:      activeClinicId,
          p_patient_id:     a.patient_id,
          p_session_date:   a.start_time,
          p_commission_pct: commissionPct,
        });
        if (consumeErr) throw consumeErr;
      }

      // 3. Create invoice atomically (GAP-10)
      const invoiceStatus = payMethod === "package" || amountPaid >= total ? "paid" : "pending";
      const { error: invErr } = await supabase.rpc("create_invoice_with_items", {
        p_clinic_id:     activeClinicId,
        p_patient_id:    a.patient_id,
        p_patient_name:  a.patient_name ?? "",
        p_provider_id:   a.provider_id  ?? null,
        p_provider_name: "",
        p_due_date:      null,
        p_gst_pct:       gst > 0 ? Math.round(gst / subtotal * 100) : 0,
        p_invoice_type:  "session",
        p_notes:         lineItems.map(i => i.name).join(", "),
        p_items: JSON.stringify(lineItems.map(i => ({
          service_id:   null,
          description:  i.name,
          quantity:     i.qty,
          unit_price:   i.unitPrice,
          discount_pct: 0,
          gst_pct:      0,
        }))),
      });
      if (invErr) throw invErr;

      // 4. Commission for direct billing (no credit)
      if (!credit && a.provider_id && subtotal > 0) {
        const commAmt = Math.round(subtotal * commissionPct / 100 * 100) / 100;
        await supabase.from("staff_commissions").insert({
          provider_id:       a.provider_id,
          appointment_id:    a.id,
          service_name:      a.service_name,
          session_date:      a.start_time,
          sale_amount:       subtotal,
          commission_pct:    commissionPct,
          commission_amount: commAmt,
          clinic_id:         activeClinicId,
          patient_id:        a.patient_id,
          status:            "pending",
        });
      }

      // 5. Mark appointment completed
      await supabase.from("appointments").update({
        status: "completed", credit_reserved: false, updated_at: new Date().toISOString(),
      }).eq("id", a.id);

      const payMsg = invoiceStatus === "paid" ? ` — ₹${total.toLocaleString("en-IN")} collected` : " — invoice pending";
      toast.success(`Checkout complete${payMsg}`);
      onCompleted();
    } catch {
      toast.error("Checkout failed");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 250,
      background: "rgba(28,25,23,0.65)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "white", borderRadius: 22, width: "100%", maxWidth: 560,
        border: "1px solid rgba(197,160,89,0.2)",
        boxShadow: "0 28px 80px rgba(28,25,23,0.28)",
        overflow: "hidden", animation: "fadeIn 0.2s ease",
        maxHeight: "92vh", display: "flex", flexDirection: "column",
      }}>
        {/* Gold top bar */}
        <div style={{ height: 4, background: "linear-gradient(90deg, #C5A059, #E8CC8A, #A8853A)" }} />

        {/* Header */}
        <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Receipt size={16} style={{ color: "#C5A059" }} />
              <h3 style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
                {step === "invoice" ? "Session Checkout — Invoice" : "Payment Collection"}
              </h3>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
              {a.patient_name} · {a.service_name}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={20} /></button>
        </div>

        {/* Step tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
          {(["invoice", "payment"] as const).map((s, idx) => (
            <button key={s} onClick={() => idx === 0 || lineItems.length > 0 ? setStep(s) : null} style={{
              flex: 1, padding: "10px 0", border: "none",
              background: step === s ? "rgba(197,160,89,0.08)" : "white",
              borderBottom: step === s ? "2px solid #C5A059" : "2px solid transparent",
              color: step === s ? "#C5A059" : "var(--text-muted)",
              fontSize: 13, fontWeight: step === s ? 600 : 400,
              fontFamily: "Georgia, serif", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              {idx === 0 ? <Receipt size={13} /> : <CreditCard size={13} />}
              {idx === 0 ? "Invoice" : "Payment"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {loadingData ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 120 }}>
              <Loader2 size={22} style={{ color: "rgba(197,160,89,0.5)", animation: "spin 1s linear infinite" }} />
            </div>
          ) : step === "invoice" ? (
            <>
              {/* Credit badge */}
              {credit && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: "rgba(74,138,74,0.07)", border: "1px solid rgba(74,138,74,0.25)", marginBottom: 16 }}>
                  <Package size={13} style={{ color: "#4A8A4A" }} />
                  <span style={{ fontSize: 12, color: "#4A8A4A", fontWeight: 600 }}>
                    Package: {credit.service_name} — {credit.total_sessions - credit.used_sessions} sessions remaining
                  </span>
                </div>
              )}

              {/* Line items */}
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9C9584", marginBottom: 10 }}>Line Items</p>
                {lineItems.map(item => (
                  <div key={item.uid} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, background: item.type === "base" ? "rgba(197,160,89,0.04)" : "rgba(0,0,0,0.02)", border: "1px solid var(--border)", marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: "Georgia, serif", fontSize: 13, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>{item.name}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, textTransform: "capitalize" }}>{item.type === "base" ? "Session" : item.type}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="number" value={item.qty} min={1} max={10}
                        onChange={e => setLineItems(prev => prev.map(x => x.uid === item.uid ? { ...x, qty: Math.max(1, Number(e.target.value)) } : x))}
                        style={{ width: 52, padding: "5px 8px", borderRadius: 7, border: "1px solid #E8E2D4", background: "#FDFCF9", fontSize: 13, textAlign: "center", outline: "none" }}
                      />
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>×</span>
                      <input
                        type="number" value={item.unitPrice} min={0}
                        onChange={e => setLineItems(prev => prev.map(x => x.uid === item.uid ? { ...x, unitPrice: Number(e.target.value) } : x))}
                        style={{ width: 90, padding: "5px 8px", borderRadius: 7, border: "1px solid #E8E2D4", background: "#FDFCF9", fontSize: 13, outline: "none" }}
                      />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", minWidth: 72, textAlign: "right" }}>
                        ₹{(item.qty * item.unitPrice).toLocaleString("en-IN")}
                      </span>
                    </div>
                    {item.type !== "base" && (
                      <button onClick={() => setLineItems(prev => prev.filter(x => x.uid !== item.uid))} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#B43C3C", padding: 2 }}><X size={13} /></button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add extra items */}
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9C9584", marginBottom: 8 }}>Add Extra Items</p>
                {addingType === null ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { setAddingType("service"); setAddServiceId(allServices[0]?.id ?? ""); }} style={{ flex: 1, padding: "8px 0", borderRadius: 9, border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.06)", color: "#A8853A", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                      <Scissors size={12} /> Add Service
                    </button>
                    <button onClick={() => { setAddingType("product"); setAddProductId(allProducts[0]?.id ?? ""); }} style={{ flex: 1, padding: "8px 0", borderRadius: 9, border: "1px solid rgba(42,74,138,0.3)", background: "rgba(42,74,138,0.06)", color: "#2A4A8A", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                      <Package size={12} /> Add Product
                    </button>
                  </div>
                ) : addingType === "service" ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select value={addServiceId} onChange={e => setAddServiceId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                      {allServices.map(s => <option key={s.id} value={s.id}>{s.name} — ₹{s.selling_price?.toLocaleString("en-IN")}</option>)}
                    </select>
                    <button onClick={addExtraService} style={{ padding: "10px 14px", borderRadius: 9, border: "none", background: "#C5A059", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Add</button>
                    <button onClick={() => setAddingType(null)} style={{ padding: "10px 10px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}><X size={13} /></button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select value={addProductId} onChange={e => setAddProductId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                      {allProducts.map(p => <option key={p.id} value={p.id}>{p.product_name} — ₹{p.selling_price?.toLocaleString("en-IN") ?? "0"}</option>)}
                    </select>
                    <button onClick={addExtraProduct} style={{ padding: "10px 14px", borderRadius: 9, border: "none", background: "#2A4A8A", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Add</button>
                    <button onClick={() => setAddingType(null)} style={{ padding: "10px 10px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}><X size={13} /></button>
                  </div>
                )}
              </div>

              {/* GST selector */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>GST:</p>
                {[0, 5, 12, 18].map(g => (
                  <button key={g} onClick={() => setGstPct(g)} style={{ padding: "4px 10px", borderRadius: 7, fontSize: 12, cursor: "pointer", border: gstPct === g ? "1px solid #C5A059" : "1px solid var(--border)", background: gstPct === g ? "rgba(197,160,89,0.1)" : "var(--surface)", color: gstPct === g ? "#A8853A" : "var(--text-muted)", fontWeight: gstPct === g ? 600 : 400 }}>
                    {g}%
                  </button>
                ))}
              </div>

              {/* Totals */}
              <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(249,247,242,0.8)", border: "1px solid rgba(197,160,89,0.2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Subtotal</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>₹{subtotal.toLocaleString("en-IN")}</span>
                </div>
                {gst > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>GST ({gstPct}%)</span>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>₹{gst.toLocaleString("en-IN")}</span>
                  </div>
                )}
                {credit && covered > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: "#4A8A4A" }}>Covered by package</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#4A8A4A" }}>−₹{covered.toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid rgba(197,160,89,0.2)" }}>
                  <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "Georgia, serif", color: "var(--foreground)" }}>Balance Due</span>
                  <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "Georgia, serif", color: balanceDue === 0 ? "#4A8A4A" : "#C5A059" }}>
                    {balanceDue === 0 ? "₹0 (Covered)" : `₹${balanceDue.toLocaleString("en-IN")}`}
                  </span>
                </div>
              </div>
            </>
          ) : (
            /* Payment step */
            <>
              <div style={{ padding: "16px 18px", borderRadius: 14, background: "rgba(197,160,89,0.04)", border: "1px solid rgba(197,160,89,0.2)", marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Total Bill</span>
                  <span style={{ fontSize: 22, fontWeight: 700, fontFamily: "Georgia, serif", color: "var(--foreground)" }}>₹{total.toLocaleString("en-IN")}</span>
                </div>
                {credit && covered > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                    <span style={{ fontSize: 12, color: "#4A8A4A" }}>Package covers</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#4A8A4A" }}>₹{covered.toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, paddingTop: 8, borderTop: "1px solid rgba(197,160,89,0.15)" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>Amount Due</span>
                  <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "Georgia, serif", color: balanceDue === 0 ? "#4A8A4A" : "#C5A059" }}>
                    ₹{balanceDue.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {balanceDue > 0 && (
                <>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9C9584", marginBottom: 10 }}>Payment Method</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                    {([
                      { key: "cash",    label: "Cash",    Icon: IndianRupee },
                      { key: "card",    label: "Card",    Icon: CreditCard  },
                      { key: "upi",     label: "UPI",     Icon: Zap         },
                      { key: "package", label: "Package / Wallet", Icon: Package },
                    ] as const).map(({ key, label, Icon }) => (
                      <button key={key} onClick={() => setPayMethod(key)} style={{
                        padding: "11px 14px", borderRadius: 11,
                        border: payMethod === key ? "2px solid #C5A059" : "1px solid var(--border)",
                        background: payMethod === key ? "rgba(197,160,89,0.08)" : "var(--surface)",
                        color: payMethod === key ? "#A8853A" : "var(--foreground)",
                        fontFamily: "Georgia, serif", fontSize: 13, fontWeight: payMethod === key ? 700 : 400,
                        cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
                        transition: "all 0.15s",
                      }}>
                        <Icon size={14} /> {label}
                      </button>
                    ))}
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9C9584", display: "block", marginBottom: 7 }}>Amount Received (₹)</label>
                    <input
                      type="number"
                      value={amountPaid}
                      onChange={e => setAmountPaid(Number(e.target.value))}
                      min={0}
                      style={{ ...inputStyle, fontSize: 20, fontFamily: "Georgia, serif", fontWeight: 700, color: "#C5A059" }}
                    />
                    {amountPaid > 0 && amountPaid < balanceDue && (
                      <p style={{ fontSize: 12, color: "#D4A017", marginTop: 5 }}>
                        Change due: ₹{(amountPaid - balanceDue).toLocaleString("en-IN")} (partial payment — invoice will remain pending)
                      </p>
                    )}
                    {amountPaid >= balanceDue && balanceDue > 0 && (
                      <p style={{ fontSize: 12, color: "#4A8A4A", marginTop: 5 }}>
                        {amountPaid > balanceDue ? `Change to return: ₹${(amountPaid - balanceDue).toLocaleString("en-IN")}` : "Exact payment ✓"}
                      </p>
                    )}
                  </div>
                </>
              )}

              {balanceDue === 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderRadius: 12, background: "rgba(74,138,74,0.07)", border: "1px solid rgba(74,138,74,0.25)" }}>
                  <CheckCircle2 size={18} style={{ color: "#4A8A4A", flexShrink: 0 }} />
                  <p style={{ fontSize: 13, color: "#4A8A4A", fontWeight: 600, margin: 0 }}>
                    Session fully covered by package. No payment required.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 10 }}>
          {step === "invoice" ? (
            <>
              <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: 14, fontFamily: "Georgia, serif", cursor: "pointer" }}>
                Cancel
              </button>
              {balanceDue === 0 && lineItems.filter(i => i.type !== "base").length === 0 ? (
                <button
                  onClick={handleCheckout}
                  disabled={processing}
                  style={{ flex: 2, padding: "11px 0", borderRadius: 12, border: "none", background: processing ? "rgba(74,138,74,0.5)" : "#4A8A4A", color: "white", fontSize: 14, fontWeight: 600, fontFamily: "Georgia, serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: "0 4px 14px rgba(74,138,74,0.3)" }}>
                  {processing && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
                  <CheckCircle2 size={15} /> Complete Session (No Payment Due)
                </button>
              ) : (
                <button
                  onClick={() => setStep("payment")}
                  style={{ flex: 2, padding: "11px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #C5A059, #A8853A)", color: "white", fontSize: 14, fontWeight: 600, fontFamily: "Georgia, serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: "0 4px 14px rgba(197,160,89,0.35)" }}>
                  Proceed to Payment <ChevronRight size={15} />
                </button>
              )}
            </>
          ) : (
            <>
              <button onClick={() => setStep("invoice")} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: 14, fontFamily: "Georgia, serif", cursor: "pointer" }}>
                ← Back
              </button>
              <button
                onClick={handleCheckout}
                disabled={processing}
                style={{ flex: 2, padding: "11px 0", borderRadius: 12, border: "none", background: processing ? "rgba(197,160,89,0.5)" : "linear-gradient(135deg, #C5A059, #A8853A)", color: "white", fontSize: 14, fontWeight: 600, fontFamily: "Georgia, serif", cursor: processing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: "0 4px 14px rgba(197,160,89,0.35)" }}>
                {processing && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
                <IndianRupee size={15} /> Collect & Complete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// E5 — Appointment List View (Reception Call List)
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_LIST_CFG: Record<string, { label: string; color: string; bg: string }> = {
  planned:     { label: "Planned",     color: "#6B7280", bg: "#F9FAFB"  },
  confirmed:   { label: "Confirmed",   color: "#2563EB", bg: "#EFF6FF"  },
  arrived:     { label: "Arrived",     color: "#7C3AED", bg: "#F5F3FF"  },
  in_session:  { label: "In Session",  color: "#7C3AED", bg: "#F5F3FF"  },
  completed:   { label: "Done",        color: "#16A34A", bg: "#F0FDF4"  },
  cancelled:   { label: "Cancelled",   color: "#6B7280", bg: "#F9FAFB"  },
  no_show:     { label: "No Show",     color: "#DC2626", bg: "#FEF2F2"  },
};

function AppointmentListView({
  appointments, privacyMode, onSelectAppt, onNewAppt,
}: {
  appointments: Appointment[];
  privacyMode: boolean;
  onSelectAppt: (a: Appointment) => void;
  onNewAppt: () => void;
}) {
  const [sortKey,  setSortKey]  = useState<"time" | "patient" | "provider" | "status">("time");
  const [sortAsc,  setSortAsc]  = useState(true);
  const [filterSt, setFilterSt] = useState<string>("all");
  const [search,   setSearch]   = useState("");

  const statusOptions = Array.from(new Set(appointments.map(a => a.status)));

  const filtered = appointments
    .filter(a => filterSt === "all" || a.status === filterSt)
    .filter(a => {
      if (!search) return true;
      const q = search.toLowerCase();
      return a.patient_name.toLowerCase().includes(q) || a.service_name.toLowerCase().includes(q) || a.provider_name.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      let av = "", bv = "";
      if (sortKey === "time")     { av = a.start_time;     bv = b.start_time;     }
      if (sortKey === "patient")  { av = a.patient_name;   bv = b.patient_name;   }
      if (sortKey === "provider") { av = a.provider_name;  bv = b.provider_name;  }
      if (sortKey === "status")   { av = a.status;         bv = b.status;         }
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortAsc(x => !x);
    else { setSortKey(key); setSortAsc(true); }
  }

  const ColHeader = ({ k, label }: { k: typeof sortKey; label: string }) => (
    <th onClick={() => toggleSort(k)} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#9C9584", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
      {label} {sortKey === k ? (sortAsc ? "↑" : "↓") : ""}
    </th>
  );

  return (
    <div style={{ padding: 20 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9C9584", pointerEvents: "none" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient, service…"
            style={{ width: "100%", padding: "7px 10px 7px 30px", borderRadius: 9, border: "1px solid var(--border)", fontSize: 12, outline: "none", background: "var(--surface)", boxSizing: "border-box" }} />
        </div>
        <select value={filterSt} onChange={e => setFilterSt(e.target.value)}
          style={{ padding: "7px 10px", borderRadius: 9, border: "1px solid var(--border)", fontSize: 12, outline: "none", background: "var(--surface)", cursor: "pointer" }}>
          <option value="all">All Statuses</option>
          {statusOptions.map(s => (
            <option key={s} value={s}>{STATUS_LIST_CFG[s]?.label ?? s}</option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>{filtered.length} appointment{filtered.length !== 1 ? "s" : ""}</span>
        <button onClick={onNewAppt} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 9, border: "none", background: "#C5A059", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          <Plus size={13} /> New
        </button>
      </div>

      {/* Table */}
      <div style={{ background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-muted)" }}>
            <tr>
              <ColHeader k="time"     label="Time"     />
              <ColHeader k="patient"  label="Patient"  />
              <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#9C9584" }}>Service</th>
              <ColHeader k="provider" label="Provider" />
              <ColHeader k="status"   label="Status"   />
              <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#9C9584" }}>Room</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: "40px 20px", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>No appointments match the filter</td></tr>
            ) : filtered.map((a, i) => {
              const cfg = STATUS_LIST_CFG[a.status] ?? STATUS_LIST_CFG.planned;
              const time = new Date(a.start_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
              const date = new Date(a.start_time).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
              return (
                <tr key={a.id} onClick={() => onSelectAppt(a)}
                  style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer", transition: "background 0.1s" }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "var(--surface-muted)")}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                >
                  <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{time}</p>
                    <p style={{ margin: 0, fontSize: 10, color: "var(--text-muted)" }}>{date}</p>
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                      {privacyMode ? "●●●●●" : a.patient_name}
                    </p>
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.service_name}</p>
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>{a.provider_name}</p>
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>{a.room ?? "—"}</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
