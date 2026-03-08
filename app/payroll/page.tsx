"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import { Banknote, Plus, X, ChevronDown, Download, Check, Clock, FileText, Eye, Pencil, Mail } from "lucide-react";

type RunStatus = "draft" | "processing" | "approved" | "paid";

interface PayrollRun {
  id: string;
  period_start: string;
  period_end: string;
  status: RunStatus;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  created_at: string;
}

interface Payslip {
  id: string;
  run_id: string;
  staff_id: string;
  clinic_id: string;
  basic_salary: number;
  commission_total: number;
  allowances: number;
  deductions: number;
  tds: number;
  net_pay: number;
  attendance_days: number;
  breakdown: Record<string, unknown>;
  profiles: { full_name: string; role: string } | null;
}

interface StaffProfile {
  id: string;
  full_name: string;
  role: string;
  basic_salary: number;
}

const RUN_STATUS_CONFIG: Record<RunStatus, { bg: string; color: string; label: string }> = {
  draft:      { bg: "rgba(107,114,128,0.12)", color: "#6b7280", label: "Draft" },
  processing: { bg: "rgba(59,130,246,0.12)",  color: "#2563eb", label: "Processing" },
  approved:   { bg: "rgba(168,85,247,0.12)",  color: "#7c3aed", label: "Approved" },
  paid:       { bg: "rgba(34,197,94,0.12)",   color: "#16a34a", label: "Paid" },
};

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// GAP-32: Auto TDS calculation per India tax slabs (new regime)
function calcMonthlyTDS(annualGross: number): number {
  const afterStdDeduction = Math.max(0, annualGross - 50000);
  let annualTax = 0;
  if (afterStdDeduction <= 250000)       annualTax = 0;
  else if (afterStdDeduction <= 500000)  annualTax = (afterStdDeduction - 250000) * 0.05;
  else if (afterStdDeduction <= 1000000) annualTax = 12500 + (afterStdDeduction - 500000) * 0.20;
  else                                    annualTax = 112500 + (afterStdDeduction - 1000000) * 0.30;
  return Math.round(annualTax / 12);
}

export default function PayrollPage() {
  const { profile, activeClinicId } = useClinic();

  const [tab, setTab] = useState<"runs" | "payslips">("runs");
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [runPayslips, setRunPayslips] = useState<Payslip[]>([]);
  const [viewPayslip, setViewPayslip] = useState<Payslip | null>(null);
  const [editPayslip, setEditPayslip] = useState<Payslip | null>(null);
  const [editForm, setEditForm] = useState({ allowances: "0", deductions: "0", tds: "0" });
  const [editSaving, setEditSaving] = useState(false);
  // GAP-42: Ad-hoc adjustments per payslip
  const [adjustments, setAdjustments] = useState<{ uid: string; description: string; type: "bonus" | "deduction"; amount: string }[]>([]);

  const [newRunDrawer, setNewRunDrawer] = useState(false);
  const [saving, setSaving] = useState(false);
  const now = new Date();
  const [runForm, setRunForm] = useState({
    year: String(now.getFullYear()),
    month: String(now.getMonth()),
  });

  const [payslipFilter, setPayslipFilter] = useState({ staff_id: "", month: "" });

  const clinicId = activeClinicId || profile?.clinic_id;

  const fetchRuns = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase.from("payroll_runs").select("*")
      .eq("clinic_id", clinicId).order("period_start", { ascending: false });
    setRuns(data || []);
  }, [clinicId, supabase]);

  const fetchPayslips = useCallback(async () => {
    if (!clinicId) return;
    let query = supabase.from("payslips")
      .select("*, profiles!payslips_staff_id_fkey(full_name, role)")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false });
    if (payslipFilter.staff_id) query = query.eq("staff_id", payslipFilter.staff_id);
    const { data } = await query;
    setPayslips((data as Payslip[]) || []);
  }, [clinicId, supabase, payslipFilter]);

  const fetchStaff = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase.from("profiles").select("id, full_name, role, basic_salary")
      .eq("clinic_id", clinicId).eq("is_active", true).order("full_name");
    setStaffList(data || []);
  }, [clinicId, supabase]);

  useEffect(() => {
    if (!clinicId) return;
    setLoading(true);
    Promise.all([fetchRuns(), fetchPayslips(), fetchStaff()]).finally(() => setLoading(false));
  }, [clinicId, fetchRuns, fetchPayslips, fetchStaff]);

  const loadRunPayslips = async (run: PayrollRun) => {
    setSelectedRun(run);
    const { data } = await supabase.from("payslips")
      .select("*, profiles!payslips_staff_id_fkey(full_name, role)")
      .eq("run_id", run.id);
    setRunPayslips((data as Payslip[]) || []);
  };

  const createRun = async () => {
    if (!clinicId) return;
    setSaving(true);
    const month = parseInt(runForm.month);
    const year = parseInt(runForm.year);
    const periodStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const periodEnd = `${year}-${String(month + 1).padStart(2, "0")}-${lastDay}`;

    try {
      // C-6 fix: idempotency check — block duplicate runs for same period
      const { data: existing } = await supabase.from("payroll_runs")
        .select("id").eq("clinic_id", clinicId)
        .eq("period_start", periodStart).eq("period_end", periodEnd).maybeSingle();
      if (existing) {
        alert(`A payroll run already exists for ${year}-${String(month + 1).padStart(2, "0")}. Delete or modify the existing run first.`);
        setSaving(false);
        return;
      }

      // Create run
      const { data: run, error: runErr } = await supabase.from("payroll_runs").insert({
        clinic_id: clinicId, period_start: periodStart, period_end: periodEnd,
        status: "draft", created_by: profile?.id,
      }).select().single();
      if (runErr) throw runErr;

      if (run) {
        // Attendance counts
        const { data: attData } = await supabase.from("staff_attendance")
          .select("staff_id, status")
          .eq("clinic_id", clinicId)
          .gte("date", periodStart).lte("date", periodEnd)
          .eq("status", "present");

        const attendanceCounts: Record<string, number> = {};
        (attData || []).forEach((a: { staff_id: string }) => {
          attendanceCounts[a.staff_id] = (attendanceCounts[a.staff_id] || 0) + 1;
        });

        // C-7 fix: only include unprocessed commissions
        const { data: commData } = await supabase.from("staff_commissions")
          .select("id, provider_id, commission_amount")
          .eq("clinic_id", clinicId)
          .eq("status", "pending")
          .eq("is_processed", false);

        const commTotals: Record<string, number> = {};
        const commIds: string[] = [];
        (commData || []).forEach((c: { id: string; provider_id: string; commission_amount: number }) => {
          commTotals[c.provider_id] = (commTotals[c.provider_id] || 0) + (c.commission_amount || 0);
          commIds.push(c.id);
        });

        if (staffList.length > 0) {
          // H-7 fix: use basic_salary from staff profile
          // GAP-32: auto TDS; GAP-33: attendance-based deduction
          const WORKING_DAYS = 26;
          const payslipInserts = staffList.map(s => {
            const basic = s.basic_salary ?? 0;
            const commission = commTotals[s.id] || 0;
            const presentDays = attendanceCounts[s.id] || 0;
            const absentDays = Math.max(0, WORKING_DAYS - presentDays);
            const attendanceDeduction = basic > 0 && absentDays > 0 ? Math.round((basic / WORKING_DAYS) * absentDays) : 0;
            const annualGross = (basic + commission) * 12;
            const autoTds = calcMonthlyTDS(annualGross);
            const net = basic + commission - attendanceDeduction - autoTds;
            return {
              clinic_id: clinicId, run_id: run.id, staff_id: s.id,
              basic_salary: basic,
              commission_total: commission,
              allowances: 0,
              deductions: attendanceDeduction,
              tds: autoTds,
              net_pay: Math.max(0, net),
              attendance_days: presentDays,
              breakdown: { absent_days: absentDays, attendance_deduction: attendanceDeduction, auto_tds: autoTds },
            };
          });
          await supabase.from("payslips").insert(payslipInserts);
        }

        // C-7 fix: mark included commissions as processed so they are not double-counted
        if (commIds.length > 0) {
          await supabase.from("staff_commissions")
            .update({ is_processed: true, processed_run_id: run.id })
            .in("id", commIds);
        }
      }

      setNewRunDrawer(false);
      fetchRuns();
      if (run) loadRunPayslips(run);
    } catch (e: unknown) {
      alert((e as Error).message ?? "Failed to create payroll run");
    } finally {
      setSaving(false);
    }
  };

  const approveRun = async (runId: string) => {
    await supabase.from("payroll_runs").update({ status: "approved" }).eq("id", runId);
    fetchRuns();
    if (selectedRun?.id === runId) setSelectedRun(prev => prev ? { ...prev, status: "approved" } : null);
  };

  const markPaid = async (runId: string) => {
    await supabase.from("payroll_runs").update({ status: "paid" }).eq("id", runId);
    fetchRuns();
    if (selectedRun?.id === runId) setSelectedRun(prev => prev ? { ...prev, status: "paid" } : null);
  };

  const openEditPayslip = (p: Payslip) => {
    setEditPayslip(p);
    setEditForm({
      allowances: String(p.allowances || 0),
      deductions: String(p.deductions || 0),
      tds:        String(p.tds || 0),
    });
    // GAP-42: Restore saved adjustments from breakdown JSONB
    const saved = (p.breakdown as { adjustments?: { uid: string; description: string; type: "bonus" | "deduction"; amount: string }[] } | null)?.adjustments ?? [];
    setAdjustments(saved.map(a => ({ ...a, uid: a.uid ?? crypto.randomUUID() })));
  };

  const savePayslipEdits = async () => {
    if (!editPayslip) return;
    setEditSaving(true);
    const allowances  = parseFloat(editForm.allowances) || 0;
    const deductions  = parseFloat(editForm.deductions) || 0;
    const tds         = parseFloat(editForm.tds)        || 0;
    const adjBonus    = adjustments.filter(a => a.type === "bonus").reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
    const adjDeduct   = adjustments.filter(a => a.type === "deduction").reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
    const net_pay     = (editPayslip.basic_salary || 0) + (editPayslip.commission_total || 0) + allowances + adjBonus - deductions - adjDeduct - tds;
    const breakdown   = { ...((editPayslip.breakdown as object) ?? {}), adjustments: adjustments.map(({ uid, description, type, amount }) => ({ uid, description, type, amount })) };

    await supabase.from("payslips").update({ allowances, deductions, tds, net_pay, breakdown }).eq("id", editPayslip.id);

    // Recalculate run totals from all payslips
    const { data: allSlips } = await supabase.from("payslips")
      .select("basic_salary, commission_total, allowances, deductions, tds, net_pay")
      .eq("run_id", editPayslip.run_id);

    if (allSlips && allSlips.length > 0) {
      const total_gross      = allSlips.reduce((s, x) => s + (x.basic_salary || 0) + (x.commission_total || 0) + (x.allowances || 0), 0);
      const total_deductions = allSlips.reduce((s, x) => s + (x.deductions || 0) + (x.tds || 0), 0);
      const total_net        = allSlips.reduce((s, x) => s + (x.net_pay || 0), 0);
      await supabase.from("payroll_runs").update({ total_gross, total_deductions, total_net }).eq("id", editPayslip.run_id);
    }

    setEditPayslip(null);
    setEditSaving(false);
    // Refresh payslips for the current run and global list
    if (selectedRun?.id === editPayslip.run_id) loadRunPayslips(selectedRun);
    fetchPayslips();
    fetchRuns();
  };

  const downloadCommissionReport = async (run: PayrollRun) => {
    if (!clinicId) return;
    const { data } = await supabase
      .from("staff_commissions")
      .select("provider_id, service_name, commission_amount, status, created_at, patient_id, profiles!staff_commissions_provider_id_fkey(full_name), patients!staff_commissions_patient_id_fkey(full_name)")
      .eq("clinic_id", clinicId)
      .gte("created_at", run.period_start)
      .lte("created_at", run.period_end + "T23:59:59")
      .order("created_at", { ascending: false });

    const headers = "Staff Name,Patient,Service,Amount,Date,Status";
    const rows = (data || []).map((r: {
      service_name: string; commission_amount: number; status: string; created_at: string;
      profiles: { full_name: string } | { full_name: string }[] | null;
      patients: { full_name: string } | { full_name: string }[] | null;
    }) => {
      const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      const pat = Array.isArray(r.patients) ? r.patients[0] : r.patients;
      return [
        prof?.full_name ?? "—",
        pat?.full_name ?? "—",
        r.service_name ?? "—",
        r.commission_amount ?? 0,
        r.created_at.slice(0, 10),
        r.status,
      ].map(v => JSON.stringify(v)).join(",");
    }).join("\n");

    const blob = new Blob([headers + "\n" + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const month = MONTH_NAMES[new Date(run.period_start).getMonth()];
    const year = new Date(run.period_start).getFullYear();
    const a = document.createElement("a");
    a.href = url;
    a.download = `commissions_${month}_${year}.csv`;
    a.click();
  };

  const exportCSV = (slips: Payslip[]) => {
    const headers = "Staff,Role,Attendance Days,Basic,Commission,Allowances,Deductions,TDS,Net Pay";
    const rows = slips.map(s =>
      `${s.profiles?.full_name},${s.profiles?.role},${s.attendance_days},${s.basic_salary},${s.commission_total},${s.allowances},${s.deductions},${s.tds},${s.net_pay}`
    ).join("\n");
    const blob = new Blob([headers + "\n" + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "payslips.csv"; a.click();
  };

  const printPayslip = (p: Payslip) => {
    const content = `
      <html><body style="font-family:Georgia,serif;padding:40px;max-width:600px">
        <h1 style="color:#C5A059">Payslip</h1>
        <h2>${p.profiles?.full_name}</h2>
        <p>${p.profiles?.role}</p>
        <hr/>
        <table style="width:100%;border-collapse:collapse">
          <tr><td>Attendance Days</td><td style="text-align:right">${p.attendance_days}</td></tr>
          <tr><td>Basic Salary</td><td style="text-align:right">₹${p.basic_salary}</td></tr>
          <tr><td>Commission</td><td style="text-align:right">₹${p.commission_total}</td></tr>
          <tr><td>Allowances</td><td style="text-align:right">₹${p.allowances}</td></tr>
          <tr><td>Deductions</td><td style="text-align:right">₹${p.deductions}</td></tr>
          <tr><td>TDS</td><td style="text-align:right">₹${p.tds}</td></tr>
          <tr style="font-weight:bold;font-size:1.2em"><td>Net Pay</td><td style="text-align:right;color:#C5A059">₹${p.net_pay}</td></tr>
        </table>
      </body></html>`;
    const w = window.open("", "_blank");
    w?.document.write(content);
    w?.print();
  };

  // H-8 fix: payroll is admin-only — front_desk / therapists cannot access payroll
  const PAYROLL_ROLES = ["superadmin", "chain_admin", "clinic_admin"];
  if (profile && !PAYROLL_ROLES.includes(profile.role ?? "")) {
    return (
      <div className="flex flex-col h-screen" style={{ background: "#F9F7F2" }}>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#6b7280", fontFamily: "Georgia, serif" }}>You don&apos;t have permission to access payroll.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen" style={{ background: "#F9F7F2" }}>


      <div className="flex-1 overflow-auto p-6">
        <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: "rgba(197,160,89,0.08)", border: "1px solid rgba(197,160,89,0.15)" }}>
          {(["runs", "payslips"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize"
              style={tab === t ? { background: "var(--gold)", color: "#fff", fontFamily: "Georgia, serif" } : { color: "rgba(197,160,89,0.7)" }}>
              {t === "runs" ? "Payroll Runs" : "Payslips"}
            </button>
          ))}
        </div>

        {/* RUNS TAB */}
        {tab === "runs" && (
          <div className="flex gap-5">
            {/* Runs list */}
            <div className="flex-1">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Payroll Runs</h2>
                <button onClick={() => setNewRunDrawer(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
                  style={{ background: "var(--gold)" }}>
                  <Plus size={15} /> New Run
                </button>
              </div>

              <div className="space-y-3">
                {loading ? (
                  [1,2,3].map(n => <div key={n} className="h-20 rounded-xl animate-pulse" style={{ background: "rgba(197,160,89,0.06)" }} />)
                ) : runs.length === 0 ? (
                  <div className="rounded-xl p-12 text-center" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
                    <Banknote size={40} className="mx-auto mb-3 opacity-20" style={{ color: "var(--gold)" }} />
                    <p style={{ color: "#9ca3af" }}>No payroll runs yet</p>
                  </div>
                ) : runs.map(run => {
                  const sc = RUN_STATUS_CONFIG[run.status];
                  const startD = new Date(run.period_start);
                  return (
                    <div key={run.id} onClick={() => loadRunPayslips(run)}
                      className="rounded-xl p-4 cursor-pointer transition-all"
                      style={{
                        background: "#fff", border: `1px solid ${selectedRun?.id === run.id ? "rgba(197,160,89,0.4)" : "rgba(197,160,89,0.15)"}`,
                        boxShadow: selectedRun?.id === run.id ? "0 0 0 2px rgba(197,160,89,0.1)" : "0 2px 8px rgba(0,0,0,0.04)",
                      }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>
                            {MONTH_NAMES[startD.getMonth()]} {startD.getFullYear()}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>
                            {new Date(run.period_start).toLocaleDateString("en-IN")} — {new Date(run.period_end).toLocaleDateString("en-IN")}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-bold" style={{ color: "var(--gold)", fontFamily: "Georgia, serif" }}>₹{(run.total_net || 0).toLocaleString()}</p>
                            <p className="text-xs" style={{ color: "#9ca3af" }}>Net Payroll</p>
                          </div>
                          <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                        </div>
                      </div>
                      {selectedRun?.id === run.id && (
                        <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: "1px solid rgba(197,160,89,0.1)" }}>
                          {run.status === "draft" && (
                            <button onClick={e => { e.stopPropagation(); approveRun(run.id); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                              style={{ background: "rgba(168,85,247,0.1)", color: "#7c3aed" }}>
                              <Check size={12} /> Approve
                            </button>
                          )}
                          {run.status === "approved" && (
                            <button onClick={e => { e.stopPropagation(); markPaid(run.id); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                              style={{ background: "rgba(34,197,94,0.1)", color: "#16a34a" }}>
                              <Check size={12} /> Mark Paid
                            </button>
                          )}
                          <button onClick={e => { e.stopPropagation(); exportCSV(runPayslips); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                            style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)" }}>
                            <Download size={12} /> Payslips CSV
                          </button>
                          <button onClick={e => { e.stopPropagation(); downloadCommissionReport(run); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                            style={{ background: "rgba(168,85,247,0.1)", color: "#7c3aed" }}>
                            <Download size={12} /> Commission Report
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payslips for selected run */}
            {selectedRun && (
              <div className="w-96 rounded-xl overflow-hidden flex flex-col" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)", height: "fit-content" }}>
                <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(197,160,89,0.1)", background: "rgba(197,160,89,0.04)" }}>
                  <p className="font-semibold text-sm" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>
                    Payslips — {MONTH_NAMES[new Date(selectedRun.period_start).getMonth()]}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>{runPayslips.length} staff</p>
                </div>
                <div className="divide-y" style={{ borderColor: "rgba(197,160,89,0.06)" }}>
                  {runPayslips.map(p => (
                    <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium" style={{ color: "#1a1714" }}>{p.profiles?.full_name}</p>
                        <p className="text-xs capitalize" style={{ color: "#9ca3af" }}>{p.profiles?.role?.replace("_", " ")} · {p.attendance_days}d</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-bold mr-1" style={{ color: "var(--gold)" }}>₹{(p.net_pay || 0).toLocaleString()}</p>
                        <button onClick={() => openEditPayslip(p)} title="Edit adjustments"
                          className="p-1.5 rounded hover:bg-amber-50 transition-colors">
                          <Pencil size={13} style={{ color: "#9ca3af" }} />
                        </button>
                        <button onClick={() => { setViewPayslip(p); printPayslip(p); }}
                          className="p-1.5 rounded hover:bg-amber-50 transition-colors" title="Print payslip">
                          <Eye size={14} style={{ color: "var(--gold)" }} />
                        </button>
                        {/* GAP-43: Email payslip to staff */}
                        <button
                          title="Email payslip to staff"
                          className="p-1.5 rounded hover:bg-blue-50 transition-colors"
                          onClick={async () => {
                            const res = await fetch("/api/payroll/email-payslip", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ payslip_id: p.id, clinic_id: p.clinic_id }),
                            });
                            const data = await res.json();
                            if (res.ok) {
                              const { toast } = await import("sonner");
                              toast.success(`Payslip emailed to ${data.sent_to}`);
                            } else {
                              const { toast } = await import("sonner");
                              toast.error(data.error ?? "Failed to send email");
                            }
                          }}>
                          <Mail size={13} style={{ color: "#3B82F6" }} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {runPayslips.length === 0 && (
                    <div className="px-4 py-8 text-center text-sm" style={{ color: "#9ca3af" }}>No payslips generated</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PAYSLIPS TAB */}
        {tab === "payslips" && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Payslip History</h2>
              <select value={payslipFilter.staff_id} onChange={e => setPayslipFilter(f => ({ ...f, staff_id: e.target.value }))}
                className="text-sm px-3 py-1.5 rounded-lg border bg-white outline-none"
                style={{ borderColor: "rgba(197,160,89,0.3)" }}>
                <option value="">All Staff</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(197,160,89,0.1)", background: "rgba(197,160,89,0.04)" }}>
                    {["Staff", "Role", "Attendance", "Basic", "Commission", "Allowances", "Deductions", "TDS", "Net Pay", "Actions"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: "rgba(197,160,89,0.7)", letterSpacing: "0.05em" }}>{h.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payslips.length === 0 ? (
                    <tr><td colSpan={10} className="px-4 py-12 text-center text-sm" style={{ color: "#9ca3af" }}>No payslips found</td></tr>
                  ) : payslips.map(p => (
                    <tr key={p.id} style={{ borderBottom: "1px solid rgba(197,160,89,0.06)" }}>
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: "#1a1714" }}>{p.profiles?.full_name}</td>
                      <td className="px-4 py-3 text-xs capitalize" style={{ color: "#4b5563" }}>{p.profiles?.role?.replace("_", " ")}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>{p.attendance_days}d</td>
                      <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>₹{(p.basic_salary || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>₹{(p.commission_total || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>₹{(p.allowances || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: "#dc2626" }}>-₹{(p.deductions || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: "#dc2626" }}>-₹{(p.tds || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm font-bold" style={{ color: "var(--gold)" }}>₹{(p.net_pay || 0).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditPayslip(p)} title="Edit adjustments" className="p-1.5 rounded hover:bg-amber-50 transition-colors">
                            <Pencil size={13} style={{ color: "#9ca3af" }} />
                          </button>
                          <button onClick={() => printPayslip(p)} className="p-1.5 rounded hover:bg-amber-50 transition-colors">
                            <FileText size={14} style={{ color: "var(--gold)" }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* EDIT PAYSLIP MODAL */}
      {editPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}>
          <div className="w-[420px] rounded-2xl overflow-hidden flex flex-col" style={{ background: "#fff" }}>
            <div className="flex justify-between items-center px-6 py-4" style={{ borderBottom: "1px solid rgba(197,160,89,0.15)" }}>
              <div>
                <h3 className="text-base font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>
                  Edit Payslip — {editPayslip.profiles?.full_name}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>
                  Basic ₹{(editPayslip.basic_salary || 0).toLocaleString()} + Commission ₹{(editPayslip.commission_total || 0).toLocaleString()}
                </p>
              </div>
              <button onClick={() => setEditPayslip(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { key: "allowances", label: "Allowances (₹)", hint: "HRA, travel, meals, etc.", color: "#16a34a" },
                { key: "deductions", label: "Deductions (₹)", hint: "PF, ESI, advance recovery", color: "#dc2626" },
                { key: "tds",        label: "TDS (₹)",        hint: `Auto-calc: ₹${calcMonthlyTDS(((editPayslip?.basic_salary ?? 0) + (editPayslip?.commission_total ?? 0)) * 12).toLocaleString()} — override if needed`, color: "#dc2626" },
              ].map(({ key, label, hint, color }) => (
                <div key={key}>
                  <label className="block text-xs font-medium mb-1" style={{ color: "#4b5563" }}>{label}</label>
                  <input
                    type="number" min="0" step="1"
                    value={editForm[key as keyof typeof editForm]}
                    onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                    style={{ borderColor: "rgba(197,160,89,0.3)", color }}
                  />
                  <p className="text-xs mt-1" style={{ color: "#9ca3af" }}>{hint}</p>
                </div>
              ))}
              {/* GAP-42: Ad-hoc Adjustments */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: "#4b5563" }}>Ad-hoc Adjustments</span>
                  <button onClick={() => setAdjustments(prev => [...prev, { uid: crypto.randomUUID(), description: "", type: "bonus", amount: "" }])}
                    className="text-xs px-2 py-1 rounded-lg flex items-center gap-1"
                    style={{ background: "rgba(197,160,89,0.08)", color: "#A8853A", border: "1px solid rgba(197,160,89,0.25)" }}>
                    <Plus size={11} /> Add
                  </button>
                </div>
                {adjustments.map(adj => (
                  <div key={adj.uid} className="flex items-center gap-2 mb-2">
                    <input value={adj.description} onChange={e => setAdjustments(prev => prev.map(x => x.uid === adj.uid ? { ...x, description: e.target.value } : x))}
                      placeholder="Description (e.g. Diwali bonus)"
                      className="flex-1 px-2 py-1.5 rounded-lg border outline-none text-xs"
                      style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                    <select value={adj.type} onChange={e => setAdjustments(prev => prev.map(x => x.uid === adj.uid ? { ...x, type: e.target.value as "bonus"|"deduction" } : x))}
                      className="px-2 py-1.5 rounded-lg border outline-none text-xs bg-white"
                      style={{ borderColor: "rgba(197,160,89,0.3)", color: adj.type === "bonus" ? "#16a34a" : "#dc2626" }}>
                      <option value="bonus">Bonus</option>
                      <option value="deduction">Deduction</option>
                    </select>
                    <input type="number" value={adj.amount} onChange={e => setAdjustments(prev => prev.map(x => x.uid === adj.uid ? { ...x, amount: e.target.value } : x))}
                      placeholder="₹"
                      className="w-20 px-2 py-1.5 rounded-lg border outline-none text-xs"
                      style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                    <button onClick={() => setAdjustments(prev => prev.filter(x => x.uid !== adj.uid))} className="p-1 rounded hover:bg-red-50 text-red-400">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Preview net pay */}
              <div className="rounded-lg p-3 flex justify-between items-center" style={{ background: "rgba(197,160,89,0.06)", border: "1px solid rgba(197,160,89,0.15)" }}>
                <span className="text-xs font-medium" style={{ color: "#4b5563" }}>Calculated Net Pay</span>
                <span className="text-base font-bold" style={{ color: "var(--gold)", fontFamily: "Georgia, serif" }}>
                  ₹{(
                    (editPayslip.basic_salary || 0) +
                    (editPayslip.commission_total || 0) +
                    (parseFloat(editForm.allowances) || 0) +
                    adjustments.filter(a => a.type === "bonus").reduce((s, a) => s + (parseFloat(a.amount) || 0), 0) -
                    (parseFloat(editForm.deductions) || 0) -
                    adjustments.filter(a => a.type === "deduction").reduce((s, a) => s + (parseFloat(a.amount) || 0), 0) -
                    (parseFloat(editForm.tds) || 0)
                  ).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="px-6 py-4 flex gap-3" style={{ borderTop: "1px solid rgba(197,160,89,0.15)" }}>
              <button onClick={() => setEditPayslip(null)} className="flex-1 px-4 py-2 rounded-lg text-sm border" style={{ borderColor: "rgba(197,160,89,0.2)", color: "#6b7280" }}>Cancel</button>
              <button onClick={savePayslipEdits} disabled={editSaving}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "var(--gold)" }}>{editSaving ? "Saving…" : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}

      {/* NEW RUN DRAWER */}
      {newRunDrawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setNewRunDrawer(false)} />
          <div className="w-[380px] h-full overflow-y-auto flex flex-col" style={{ background: "#fff" }}>
            <div className="flex justify-between items-center px-6 py-5" style={{ borderBottom: "1px solid rgba(197,160,89,0.15)" }}>
              <h3 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>New Payroll Run</h3>
              <button onClick={() => setNewRunDrawer(false)} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="flex-1 p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Month</label>
                <select value={runForm.month} onChange={e => setRunForm(f => ({ ...f, month: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border outline-none text-sm bg-white"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }}>
                  {MONTH_NAMES.map((m, i) => <option key={i} value={String(i)}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Year</label>
                <input type="number" value={runForm.year} onChange={e => setRunForm(f => ({ ...f, year: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }} />
              </div>
              <div className="rounded-lg p-3" style={{ background: "rgba(197,160,89,0.06)", border: "1px solid rgba(197,160,89,0.15)" }}>
                <p className="text-xs" style={{ color: "#6b7280" }}>
                  Auto-calculates attendance from staff_attendance records and pending commissions from staff_commissions. You can edit individual payslips after creation.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 flex gap-3" style={{ borderTop: "1px solid rgba(197,160,89,0.15)" }}>
              <button onClick={() => setNewRunDrawer(false)} className="flex-1 px-4 py-2 rounded-lg text-sm border" style={{ borderColor: "rgba(197,160,89,0.2)", color: "#6b7280" }}>Cancel</button>
              <button onClick={createRun} disabled={saving}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "var(--gold)" }}>{saving ? "Creating…" : "Create Run"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
