"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import TopBar from "@/components/TopBar";
import {
  UserCheck2, ChevronLeft, ChevronRight, Download,
  Plus, X, Check, Clock, AlertCircle, BarChart3, TrendingUp, IndianRupee,
} from "lucide-react";

type AttendanceStatus = "present" | "absent" | "half_day" | "late" | "on_leave";
type LeaveType = "casual" | "sick" | "earned" | "unpaid" | "other";
type LeaveStatus = "pending" | "approved" | "rejected";

interface StaffProfile {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface AttendanceRecord {
  id: string;
  staff_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  hours_worked: number | null;
  status: AttendanceStatus;
}

interface LeaveRecord {
  id: string;
  staff_id: string;
  leave_type: LeaveType;
  from_date: string;
  to_date: string;
  days: number;
  reason: string | null;
  status: LeaveStatus;
  approved_by: string | null;
  profiles: { full_name: string } | null;
}

const ATTENDANCE_CONFIG: Record<AttendanceStatus, { bg: string; color: string; label: string; short: string }> = {
  present:   { bg: "rgba(34,197,94,0.15)",  color: "#16a34a", label: "Present",   short: "P" },
  absent:    { bg: "rgba(239,68,68,0.15)",  color: "#dc2626", label: "Absent",    short: "A" },
  half_day:  { bg: "rgba(234,179,8,0.15)",  color: "#ca8a04", label: "Half Day",  short: "H" },
  late:      { bg: "rgba(249,115,22,0.15)", color: "#ea580c", label: "Late",      short: "L" },
  on_leave:  { bg: "rgba(107,114,128,0.15)",color: "#6b7280", label: "On Leave",  short: "OL" },
};

const LEAVE_STATUS_CONFIG: Record<LeaveStatus, { bg: string; color: string; label: string }> = {
  pending:  { bg: "rgba(234,179,8,0.12)",  color: "#ca8a04", label: "Pending" },
  approved: { bg: "rgba(34,197,94,0.12)",  color: "#16a34a", label: "Approved" },
  rejected: { bg: "rgba(239,68,68,0.12)",  color: "#dc2626", label: "Rejected" },
};

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  doctor:       { bg: "rgba(59,130,246,0.12)",  color: "#2563eb" },
  therapist:    { bg: "rgba(168,85,247,0.12)",  color: "#7c3aed" },
  counsellor:   { bg: "rgba(34,197,94,0.12)",   color: "#16a34a" },
  front_desk:   { bg: "rgba(249,115,22,0.12)",  color: "#ea580c" },
  clinic_admin: { bg: "rgba(197,160,89,0.15)",  color: "#92400e" },
  chain_admin:  { bg: "rgba(197,160,89,0.15)",  color: "#78350f" },
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
}

export default function StaffHRPage() {
  const { profile, activeClinicId } = useClinic();

  const [tab, setTab] = useState<"directory" | "attendance" | "leaves" | "scorecards">("directory");
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth()); // 0-indexed

  // E3: Scorecards state
  const [scorecards, setScorecards] = useState<{
    providerId: string; providerName: string; role: string;
    totalAppts: number; completed: number; noShow: number; cancelled: number; revenue: number;
  }[]>([]);
  const [scorecardsLoading, setScorecardsLoading] = useState(false);

  const [leaveDrawer, setLeaveDrawer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    staff_id: "", leave_type: "casual" as LeaveType, from_date: "", to_date: "", reason: "",
  });
  const [clockModal, setClockModal] = useState<{ staffId: string; staffName: string; date: string; clock_in: string; clock_out: string } | null>(null);

  const clinicId = activeClinicId || profile?.clinic_id;
  const isAdmin = profile?.role === "clinic_admin" || profile?.role === "chain_admin" || profile?.role === "superadmin";

  const fetchStaff = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase.from("profiles").select("id, full_name, role, is_active, created_at")
      .eq("clinic_id", clinicId).eq("is_active", true).order("full_name");
    setStaffList(data || []);
  }, [clinicId, supabase]);

  const fetchAttendance = useCallback(async () => {
    if (!clinicId) return;
    const startDate = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
    const endDate = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${lastDay}`;
    const { data } = await supabase.from("staff_attendance").select("*")
      .eq("clinic_id", clinicId).gte("date", startDate).lte("date", endDate);
    setAttendance(data || []);
  }, [clinicId, supabase, viewYear, viewMonth]);

  const fetchLeaves = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase.from("staff_leaves")
      .select("*, profiles!staff_leaves_staff_id_fkey(full_name)")
      .eq("clinic_id", clinicId).order("created_at", { ascending: false });
    setLeaves((data as LeaveRecord[]) || []);
  }, [clinicId, supabase]);

  // E3: fetch scorecards for current month
  const fetchScorecards = useCallback(async () => {
    if (!clinicId) return;
    setScorecardsLoading(true);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const [apptsRes, invRes] = await Promise.all([
      supabase.from("appointments")
        .select("provider_id, status, profiles!appointments_provider_id_fkey(full_name, role)")
        .eq("clinic_id", clinicId)
        .gte("start_time", monthStart.toISOString()),
      supabase.from("pending_invoices")
        .select("provider_id, provider_name, total_amount")
        .eq("clinic_id", clinicId)
        .in("status", ["paid", "partial"])
        .gte("paid_at", monthStart.toISOString()),
    ]);
    const map: Record<string, { providerId: string; providerName: string; role: string; totalAppts: number; completed: number; noShow: number; cancelled: number; revenue: number }> = {};
    (apptsRes.data ?? []).forEach((a: { provider_id: string | null; status: string; profiles: { full_name: string; role: string } | { full_name: string; role: string }[] | null }) => {
      if (!a.provider_id) return;
      const prof = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
      const name = prof?.full_name ?? "Unassigned";
      const role = prof?.role ?? "";
      if (!map[a.provider_id]) map[a.provider_id] = { providerId: a.provider_id, providerName: name, role, totalAppts: 0, completed: 0, noShow: 0, cancelled: 0, revenue: 0 };
      map[a.provider_id].totalAppts++;
      if (a.status === "completed") map[a.provider_id].completed++;
      if (a.status === "no_show")   map[a.provider_id].noShow++;
      if (a.status === "cancelled") map[a.provider_id].cancelled++;
    });
    (invRes.data ?? []).forEach((inv: { provider_id: string | null; provider_name: string | null; total_amount: number }) => {
      if (!inv.provider_id) return;
      if (map[inv.provider_id]) map[inv.provider_id].revenue += inv.total_amount ?? 0;
    });
    setScorecards(Object.values(map).sort((a, b) => b.revenue - a.revenue));
    setScorecardsLoading(false);
  }, [clinicId, supabase]);

  useEffect(() => {
    if (!clinicId) return;
    setLoading(true);
    Promise.all([fetchStaff(), fetchAttendance(), fetchLeaves()]).finally(() => setLoading(false));
  }, [clinicId, fetchStaff, fetchAttendance, fetchLeaves]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const getAttendanceCell = (staffId: string, day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return attendance.find(a => a.staff_id === staffId && a.date === dateStr);
  };

  const setAttendanceStatus = async (staffId: string, day: number, status: AttendanceStatus) => {
    if (!clinicId) return;
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    await supabase.from("staff_attendance").upsert({
      clinic_id: clinicId, staff_id: staffId, date: dateStr, status,
    }, { onConflict: "clinic_id,staff_id,date" });
    fetchAttendance();
  };

  const openClockModal = (staffId: string, staffName: string, day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const rec = attendance.find(a => a.staff_id === staffId && a.date === dateStr);
    setClockModal({
      staffId, staffName, date: dateStr,
      clock_in:  rec?.clock_in  ? rec.clock_in.slice(11, 16)  : "",
      clock_out: rec?.clock_out ? rec.clock_out.slice(11, 16) : "",
    });
  };

  const saveClockTime = async () => {
    if (!clockModal || !clinicId) return;
    const { staffId, date, clock_in, clock_out } = clockModal;
    await supabase.from("staff_attendance").upsert({
      clinic_id: clinicId, staff_id: staffId, date,
      ...(clock_in  ? { clock_in:  `${date}T${clock_in}:00`  } : {}),
      ...(clock_out ? { clock_out: `${date}T${clock_out}:00` } : {}),
    }, { onConflict: "clinic_id,staff_id,date" });
    setClockModal(null);
    fetchAttendance();
  };

  const approveLeave = async (id: string, approved: boolean) => {
    await supabase.from("staff_leaves").update({
      status: approved ? "approved" : "rejected",
      approved_by: profile?.id,
      approved_at: new Date().toISOString(),
    }).eq("id", id);
    fetchLeaves();
  };

  const saveLeave = async () => {
    if (!clinicId || !leaveForm.staff_id || !leaveForm.from_date || !leaveForm.to_date) return;
    setSaving(true);
    await supabase.from("staff_leaves").insert({
      clinic_id: clinicId, staff_id: leaveForm.staff_id, leave_type: leaveForm.leave_type,
      from_date: leaveForm.from_date, to_date: leaveForm.to_date,
      reason: leaveForm.reason || null, status: "pending",
    });
    setSaving(false);
    setLeaveDrawer(false);
    setLeaveForm({ staff_id: "", leave_type: "casual", from_date: "", to_date: "", reason: "" });
    fetchLeaves();
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // H-8 fix: HR features are admin-only
  const HR_ROLES = ["superadmin", "chain_admin", "clinic_admin"];
  if (profile && !HR_ROLES.includes(profile.role ?? "")) {
    return (
      <div className="flex flex-col h-screen" style={{ background: "#F9F7F2" }}>
        <TopBar />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#6b7280", fontFamily: "Georgia, serif" }}>You don&apos;t have permission to access Staff HR.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen" style={{ background: "#F9F7F2" }}>
      <TopBar />

      <div className="flex-1 overflow-auto p-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: "rgba(197,160,89,0.08)", border: "1px solid rgba(197,160,89,0.15)" }}>
          {(["directory", "attendance", "leaves", "scorecards"] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); if (t === "scorecards") fetchScorecards(); }}
              className="px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize"
              style={tab === t ? { background: "var(--gold)", color: "#fff", fontFamily: "Georgia, serif" } : { color: "rgba(197,160,89,0.7)" }}>
              {t === "directory" ? "Directory" : t === "attendance" ? "Attendance" : t === "leaves" ? "Leaves" : "Scorecards"}
            </button>
          ))}
        </div>

        {/* DIRECTORY TAB */}
        {tab === "directory" && (
          <div>
            <h2 className="text-lg font-semibold mb-5" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Staff Directory</h2>
            {loading ? (
              <div className="grid grid-cols-4 gap-4">
                {[1,2,3,4].map(n => <div key={n} className="h-40 rounded-xl animate-pulse" style={{ background: "rgba(197,160,89,0.06)" }} />)}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-4">
                {staffList.map(s => {
                  const rc = ROLE_COLORS[s.role] || { bg: "rgba(197,160,89,0.1)", color: "var(--gold)" };
                  return (
                    <div key={s.id} className="rounded-xl p-5 flex flex-col items-center text-center"
                      style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold mb-3"
                        style={{ background: "rgba(197,160,89,0.12)", color: "var(--gold)", fontFamily: "Georgia, serif" }}>
                        {getInitials(s.full_name)}
                      </div>
                      <p className="font-semibold text-sm mb-1" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>{s.full_name}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full capitalize font-medium mb-2" style={{ background: rc.bg, color: rc.color }}>
                        {s.role.replace("_", " ")}
                      </span>
                      <p className="text-xs" style={{ color: "#9ca3af" }}>Since {new Date(s.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "short" })}</p>
                    </div>
                  );
                })}
                {staffList.length === 0 && (
                  <div className="col-span-4 text-center py-16" style={{ color: "#9ca3af" }}>
                    <UserCheck2 size={40} className="mx-auto mb-3 opacity-30" />
                    <p>No active staff found</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ATTENDANCE TAB */}
        {tab === "attendance" && (
          <div>
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Attendance</h2>
                <div className="flex items-center gap-1 rounded-lg overflow-hidden" style={{ border: "1px solid rgba(197,160,89,0.2)" }}>
                  <button onClick={prevMonth} className="p-2 hover:bg-amber-50 transition-colors"><ChevronLeft size={14} style={{ color: "var(--gold)" }} /></button>
                  <span className="px-3 text-sm font-medium" style={{ color: "#1a1714", minWidth: 100, textAlign: "center" }}>{MONTHS[viewMonth]} {viewYear}</span>
                  <button onClick={nextMonth} className="p-2 hover:bg-amber-50 transition-colors"><ChevronRight size={14} style={{ color: "var(--gold)" }} /></button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-2">
                  {Object.entries(ATTENDANCE_CONFIG).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-1">
                      <div className="w-5 h-5 rounded text-xs flex items-center justify-center font-bold" style={{ background: v.bg, color: v.color }}>{v.short}</div>
                      <span className="text-xs" style={{ color: "#6b7280" }}>{v.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl overflow-auto" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(197,160,89,0.1)", background: "rgba(197,160,89,0.04)" }}>
                    <th className="px-4 py-3 text-left font-medium sticky left-0 bg-white" style={{ color: "rgba(197,160,89,0.7)", minWidth: 160 }}>STAFF</th>
                    {days.map(d => {
                      const dayDate = new Date(viewYear, viewMonth, d);
                      const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
                      return (
                        <th key={d} className="py-3 text-center font-medium" style={{ color: isWeekend ? "rgba(239,68,68,0.5)" : "rgba(197,160,89,0.7)", minWidth: 32 }}>
                          {d}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {staffList.map(s => (
                    <tr key={s.id} style={{ borderBottom: "1px solid rgba(197,160,89,0.06)" }}>
                      <td className="px-4 py-2 sticky left-0 bg-white font-medium" style={{ color: "#1a1714" }}>{s.full_name}</td>
                      {days.map(d => {
                        const rec = getAttendanceCell(s.id, d);
                        const dayDate = new Date(viewYear, viewMonth, d);
                        const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
                        const isFuture = dayDate > new Date();
                        if (isFuture) return <td key={d} className="py-2 text-center" />;
                        const cfg = rec ? ATTENDANCE_CONFIG[rec.status] : null;
                        return (
                          <td key={d} className="py-2 text-center" style={{ position: "relative" }}>
                            {isAdmin ? (
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                                <select
                                  value={rec?.status || ""}
                                  onChange={e => e.target.value && setAttendanceStatus(s.id, d, e.target.value as AttendanceStatus)}
                                  className="w-7 h-7 rounded text-center text-xs font-bold cursor-pointer border-none outline-none"
                                  style={{
                                    background: cfg ? cfg.bg : isWeekend ? "rgba(107,114,128,0.06)" : "rgba(197,160,89,0.04)",
                                    color: cfg ? cfg.color : "#d1d5db",
                                    appearance: "none", WebkitAppearance: "none",
                                  }}>
                                  <option value="">—</option>
                                  {Object.entries(ATTENDANCE_CONFIG).map(([k, v]) => (
                                    <option key={k} value={k}>{v.short}</option>
                                  ))}
                                </select>
                                {rec && (rec.status === "present" || rec.status === "late") && (
                                  <button
                                    onClick={() => openClockModal(s.id, s.full_name, d)}
                                    title={rec.clock_in ? `${rec.clock_in.slice(11,16)} – ${rec.clock_out?.slice(11,16) ?? "?"}` : "Set times"}
                                    style={{ width: 14, height: 14, borderRadius: 3, border: "none", background: rec.clock_in ? "rgba(34,197,94,0.2)" : "rgba(197,160,89,0.12)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                                    <Clock size={8} style={{ color: rec.clock_in ? "#16a34a" : "#C5A059" }} />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="w-7 h-7 rounded text-xs flex items-center justify-center font-bold mx-auto"
                                style={{ background: cfg ? cfg.bg : "transparent", color: cfg ? cfg.color : "#d1d5db" }}>
                                {cfg ? cfg.short : "—"}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* LEAVES TAB */}
        {tab === "leaves" && (
          <div>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Leave Management</h2>
              <button onClick={() => setLeaveDrawer(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: "var(--gold)" }}>
                <Plus size={15} /> Request Leave
              </button>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(197,160,89,0.1)", background: "rgba(197,160,89,0.04)" }}>
                    {["Staff", "Type", "From", "To", "Days", "Reason", "Status", isAdmin ? "Actions" : ""].filter(Boolean).map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: "rgba(197,160,89,0.7)", letterSpacing: "0.05em" }}>{h.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leaves.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: "#9ca3af" }}>No leave requests</td></tr>
                  ) : leaves.map(leave => {
                    const lsc = LEAVE_STATUS_CONFIG[leave.status];
                    return (
                      <tr key={leave.id} style={{ borderBottom: "1px solid rgba(197,160,89,0.06)" }}>
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: "#1a1714" }}>{leave.profiles?.full_name}</td>
                        <td className="px-4 py-3 text-sm capitalize" style={{ color: "#4b5563" }}>{leave.leave_type}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>{new Date(leave.from_date).toLocaleDateString("en-IN")}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>{new Date(leave.to_date).toLocaleDateString("en-IN")}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: "#1a1714" }}>{leave.days}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: "#6b7280" }}>{leave.reason || "—"}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: lsc.bg, color: lsc.color }}>{lsc.label}</span>
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            {leave.status === "pending" && (
                              <div className="flex gap-1">
                                <button onClick={() => approveLeave(leave.id, true)}
                                  className="p-1.5 rounded-lg hover:bg-green-50 transition-colors" title="Approve">
                                  <Check size={13} style={{ color: "#16a34a" }} />
                                </button>
                                <button onClick={() => approveLeave(leave.id, false)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Reject">
                                  <X size={13} style={{ color: "#ef4444" }} />
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SCORECARDS TAB */}
        {tab === "scorecards" && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Provider Scorecards</h2>
                <p className="text-sm mt-1" style={{ color: "#6b7280" }}>This month's performance — appointments, revenue, and rates</p>
              </div>
            </div>

            {scorecardsLoading ? (
              <div className="grid grid-cols-3 gap-4">
                {[1,2,3].map(n => <div key={n} className="h-52 rounded-xl animate-pulse" style={{ background: "rgba(197,160,89,0.06)" }} />)}
              </div>
            ) : scorecards.length === 0 ? (
              <div className="rounded-xl p-12 text-center" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
                <BarChart3 size={36} className="mx-auto mb-3 opacity-20" style={{ color: "var(--gold)" }} />
                <p className="text-sm" style={{ color: "#9ca3af" }}>No appointment data this month yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {scorecards.map((s) => {
                  const completionPct = s.totalAppts > 0 ? Math.round((s.completed / s.totalAppts) * 100) : 0;
                  const noShowPct = s.totalAppts > 0 ? Math.round((s.noShow / s.totalAppts) * 100) : 0;
                  const rc = ROLE_COLORS[s.role] ?? { bg: "rgba(197,160,89,0.1)", color: "var(--gold)" };
                  return (
                    <div key={s.providerId} className="rounded-xl p-5"
                      style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-base"
                          style={{ background: "rgba(197,160,89,0.12)", color: "var(--gold)", fontFamily: "Georgia, serif" }}>
                          {getInitials(s.providerName)}
                        </div>
                        <div>
                          <p className="font-semibold text-sm" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>{s.providerName}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full capitalize font-medium" style={{ background: rc.bg, color: rc.color }}>
                            {s.role.replace("_", " ")}
                          </span>
                        </div>
                      </div>

                      {/* Revenue */}
                      <div className="rounded-lg p-3 mb-3" style={{ background: "rgba(197,160,89,0.06)", border: "1px solid rgba(197,160,89,0.12)" }}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <IndianRupee size={11} style={{ color: "var(--gold)" }} />
                          <span className="text-xs font-medium" style={{ color: "#9ca3af" }}>Revenue this month</span>
                        </div>
                        <p className="text-xl font-bold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>
                          {s.revenue >= 100000 ? `₹${(s.revenue / 100000).toFixed(1)}L` : s.revenue >= 1000 ? `₹${(s.revenue / 1000).toFixed(1)}K` : `₹${s.revenue.toFixed(0)}`}
                        </p>
                      </div>

                      {/* Appointment counts */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {[
                          { label: "Total",   value: s.totalAppts, color: "#1a1714" },
                          { label: "Done",    value: s.completed,  color: "#16a34a" },
                          { label: "No-Show", value: s.noShow,     color: "#f59e0b" },
                        ].map(stat => (
                          <div key={stat.label} className="text-center rounded-lg p-2" style={{ background: "#f9f7f2" }}>
                            <p className="font-bold text-base" style={{ color: stat.color }}>{stat.value}</p>
                            <p className="text-xs" style={{ color: "#9ca3af" }}>{stat.label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Completion rate bar */}
                      <div className="mb-1.5">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs" style={{ color: "#6b7280" }}>Completion rate</span>
                          <span className="text-xs font-bold" style={{ color: completionPct >= 70 ? "#16a34a" : completionPct >= 40 ? "#f59e0b" : "#dc2626" }}>{completionPct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full" style={{ background: "#f3f4f6" }}>
                          <div className="h-full rounded-full transition-all" style={{
                            width: `${completionPct}%`,
                            background: completionPct >= 70 ? "#16a34a" : completionPct >= 40 ? "#f59e0b" : "#dc2626",
                          }} />
                        </div>
                      </div>
                      {noShowPct > 0 && (
                        <p className="text-xs mt-2" style={{ color: "#f59e0b" }}>
                          <TrendingUp size={10} style={{ display: "inline", marginRight: 3 }} />
                          {noShowPct}% no-show rate
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CLOCK IN/OUT MODAL */}
      {clockModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: 320, border: "1px solid rgba(197,160,89,0.25)", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <p style={{ fontFamily: "Georgia, serif", fontWeight: 600, fontSize: 14, color: "#1C1917" }}>Set Times</p>
                <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{clockModal.staffName} · {clockModal.date}</p>
              </div>
              <button onClick={() => setClockModal(null)} style={{ border: "none", background: "none", cursor: "pointer", color: "#9ca3af" }}><X size={16} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Clock In</label>
                <input type="time" value={clockModal.clock_in}
                  onChange={e => setClockModal(m => m ? { ...m, clock_in: e.target.value } : m)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.3)", fontSize: 13, outline: "none" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Clock Out</label>
                <input type="time" value={clockModal.clock_out}
                  onChange={e => setClockModal(m => m ? { ...m, clock_out: e.target.value } : m)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.3)", fontSize: 13, outline: "none" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setClockModal(null)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, background: "#f9f7f2", color: "#6b7280", border: "1px solid rgba(197,160,89,0.2)", cursor: "pointer", fontSize: 13 }}>Cancel</button>
              <button onClick={saveClockTime} style={{ flex: 1, padding: "9px 0", borderRadius: 10, background: "var(--gold)", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* LEAVE REQUEST DRAWER */}
      {leaveDrawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setLeaveDrawer(false)} />
          <div className="w-[400px] h-full overflow-y-auto flex flex-col" style={{ background: "#fff" }}>
            <div className="flex justify-between items-center px-6 py-5" style={{ borderBottom: "1px solid rgba(197,160,89,0.15)" }}>
              <h3 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Request Leave</h3>
              <button onClick={() => setLeaveDrawer(false)} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="flex-1 p-6 space-y-4">
              {isAdmin && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Staff Member *</label>
                  <select value={leaveForm.staff_id} onChange={e => setLeaveForm(f => ({ ...f, staff_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border outline-none text-sm bg-white"
                    style={{ borderColor: "rgba(197,160,89,0.3)" }}>
                    <option value="">Select staff</option>
                    {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Leave Type *</label>
                <select value={leaveForm.leave_type} onChange={e => setLeaveForm(f => ({ ...f, leave_type: e.target.value as LeaveType }))}
                  className="w-full px-3 py-2 rounded-lg border outline-none text-sm bg-white"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }}>
                  <option value="casual">Casual Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="earned">Earned Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>From Date *</label>
                  <input type="date" value={leaveForm.from_date} onChange={e => setLeaveForm(f => ({ ...f, from_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                    style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>To Date *</label>
                  <input type="date" value={leaveForm.to_date} onChange={e => setLeaveForm(f => ({ ...f, to_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                    style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Reason</label>
                <textarea value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
                  rows={3} className="w-full px-3 py-2 rounded-lg border outline-none text-sm resize-none"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }} />
              </div>
            </div>
            <div className="px-6 py-4 flex gap-3" style={{ borderTop: "1px solid rgba(197,160,89,0.15)" }}>
              <button onClick={() => setLeaveDrawer(false)} className="flex-1 px-4 py-2 rounded-lg text-sm border" style={{ borderColor: "rgba(197,160,89,0.2)", color: "#6b7280" }}>Cancel</button>
              <button onClick={saveLeave} disabled={saving || (!isAdmin && !leaveForm.staff_id) || !leaveForm.from_date || !leaveForm.to_date}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "var(--gold)" }}>{saving ? "Submitting…" : "Submit Request"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
