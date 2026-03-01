"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import TopBar from "@/components/TopBar";
import { Banknote, Plus, X, ChevronDown, Download, Check, Clock, FileText, Eye } from "lucide-react";

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
}

const RUN_STATUS_CONFIG: Record<RunStatus, { bg: string; color: string; label: string }> = {
  draft:      { bg: "rgba(107,114,128,0.12)", color: "#6b7280", label: "Draft" },
  processing: { bg: "rgba(59,130,246,0.12)",  color: "#2563eb", label: "Processing" },
  approved:   { bg: "rgba(168,85,247,0.12)",  color: "#7c3aed", label: "Approved" },
  paid:       { bg: "rgba(34,197,94,0.12)",   color: "#16a34a", label: "Paid" },
};

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

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
    const { data } = await supabase.from("profiles").select("id, full_name, role")
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

    // Create run
    const { data: run } = await supabase.from("payroll_runs").insert({
      clinic_id: clinicId, period_start: periodStart, period_end: periodEnd,
      status: "draft", created_by: profile?.id,
    }).select().single();

    if (run) {
      // Auto-generate payslips for all staff
      const { data: attData } = await supabase.from("staff_attendance")
        .select("staff_id, status")
        .eq("clinic_id", clinicId)
        .gte("date", periodStart).lte("date", periodEnd)
        .eq("status", "present");

      const attendanceCounts: Record<string, number> = {};
      (attData || []).forEach((a: { staff_id: string }) => {
        attendanceCounts[a.staff_id] = (attendanceCounts[a.staff_id] || 0) + 1;
      });

      // Commission totals
      const { data: commData } = await supabase.from("staff_commissions")
        .select("provider_id, commission_amount")
        .eq("clinic_id", clinicId).eq("status", "pending");

      const commTotals: Record<string, number> = {};
      (commData || []).forEach((c: { provider_id: string; commission_amount: number }) => {
        commTotals[c.provider_id] = (commTotals[c.provider_id] || 0) + (c.commission_amount || 0);
      });

      if (staffList.length > 0) {
        const payslipInserts = staffList.map(s => ({
          clinic_id: clinicId, run_id: run.id, staff_id: s.id,
          basic_salary: 0, commission_total: commTotals[s.id] || 0,
          allowances: 0, deductions: 0, tds: 0,
          net_pay: commTotals[s.id] || 0,
          attendance_days: attendanceCounts[s.id] || 0,
          breakdown: {},
        }));
        await supabase.from("payslips").insert(payslipInserts);
      }
    }

    setSaving(false);
    setNewRunDrawer(false);
    fetchRuns();
    if (run) loadRunPayslips(run);
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

  return (
    <div className="flex flex-col h-screen" style={{ background: "#F9F7F2" }}>
      <TopBar />

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
                            <Download size={12} /> Export CSV
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
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold" style={{ color: "var(--gold)" }}>₹{(p.net_pay || 0).toLocaleString()}</p>
                        <button onClick={() => { setViewPayslip(p); printPayslip(p); }}
                          className="p-1.5 rounded hover:bg-amber-50 transition-colors">
                          <Eye size={14} style={{ color: "var(--gold)" }} />
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
                        <button onClick={() => printPayslip(p)} className="p-1.5 rounded hover:bg-amber-50 transition-colors">
                          <FileText size={14} style={{ color: "var(--gold)" }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

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
