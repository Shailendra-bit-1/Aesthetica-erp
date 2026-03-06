"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import TopBar from "@/components/TopBar";
import {
  BarChart2, Download, Save, X, Plus, Trash2, ChevronRight,
  IndianRupee, Users, TrendingUp, Package, Calendar,
  ShoppingCart, MessageSquare, Star, UserCheck, Clock,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type BaseEntity = "patients" | "appointments" | "invoices" | "staff" | "inventory" | "membership" | "credits" | "commissions" | "counselling";
type TabKey = "library" | "builder" | "heatmap";

interface ReportDefinition {
  id: string;
  name: string;
  base_entity: BaseEntity;
  columns: Array<{ field: string; label: string }>;
  filters: Array<{ field: string; operator: string; value: unknown }>;
  default_sort: { field: string; direction: "asc" | "desc" } | null;
  chart_config: { type: string; x_field: string; y_field: string } | null;
  is_active: boolean;
  created_at: string;
}

interface LibraryReport {
  id: string;
  title: string;
  category: string;
  description: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  comingSoon?: boolean;
  chartType?: "bar" | "line";
  chartX?: string;
  chartY?: string;
  queryFn?: (clinicId: string, from: string, to: string) => Promise<Record<string, unknown>[]>;
  columns?: Array<{ key: string; label: string; numeric?: boolean }>;
}

// ─── Entity Field Definitions ─────────────────────────────────────────────────

const ENTITY_FIELDS: Record<BaseEntity, Array<{ field: string; label: string }>> = {
  patients: [
    { field: "full_name", label: "Full Name" }, { field: "phone", label: "Phone" },
    { field: "email", label: "Email" }, { field: "date_of_birth", label: "Date of Birth" },
    { field: "fitzpatrick_type", label: "Fitzpatrick Type" }, { field: "wallet_balance", label: "Wallet Balance" },
    { field: "created_at", label: "Created Date" },
  ],
  appointments: [
    { field: "start_time", label: "Start Time" }, { field: "end_time", label: "End Time" },
    { field: "status", label: "Status" }, { field: "notes", label: "Notes" },
  ],
  invoices: [
    { field: "invoice_number", label: "Invoice #" }, { field: "patient_name", label: "Patient" },
    { field: "total_amount", label: "Total" }, { field: "status", label: "Status" },
    { field: "payment_mode", label: "Payment Mode" }, { field: "created_at", label: "Date" },
  ],
  staff: [
    { field: "full_name", label: "Full Name" }, { field: "role", label: "Role" },
    { field: "is_active", label: "Active" }, { field: "created_at", label: "Joined" },
  ],
  inventory: [
    { field: "name", label: "Item Name" }, { field: "category", label: "Category" },
    { field: "quantity", label: "Quantity" }, { field: "unit", label: "Unit" },
  ],
  membership: [
    { field: "status", label: "Status" }, { field: "started_at", label: "Start Date" },
    { field: "expires_at", label: "Expiry Date" }, { field: "auto_renew", label: "Auto Renew" },
  ],
  credits: [
    { field: "service_name", label: "Service" }, { field: "total_sessions", label: "Total Sessions" },
    { field: "used_sessions", label: "Used Sessions" }, { field: "status", label: "Status" },
    { field: "purchase_price", label: "Purchase Price" }, { field: "expires_at", label: "Expires At" },
  ],
  commissions: [
    { field: "service_name", label: "Service" }, { field: "sale_amount", label: "Sale Amount" },
    { field: "commission_pct", label: "Commission %" }, { field: "commission_amount", label: "Commission Amount" },
    { field: "status", label: "Status" }, { field: "paid_at", label: "Paid At" },
  ],
  counselling: [
    { field: "session_date", label: "Session Date" }, { field: "chief_complaint", label: "Chief Complaint" },
    { field: "total_proposed", label: "Total Proposed" }, { field: "total_accepted", label: "Total Accepted" },
    { field: "conversion_status", label: "Conversion Status" },
  ],
};

const ENTITY_LABELS: Record<BaseEntity, string> = {
  patients: "Patients", appointments: "Appointments", invoices: "Invoices",
  staff: "Staff", inventory: "Inventory", membership: "Memberships",
  credits: "Service Credits", commissions: "Commissions", counselling: "Counselling",
};

const TABLE_MAP: Record<BaseEntity, string> = {
  patients: "patients", appointments: "appointments",
  invoices: "pending_invoices", staff: "profiles", inventory: "inventory_products",
  membership: "patient_memberships", credits: "patient_service_credits",
  commissions: "staff_commissions", counselling: "counselling_sessions",
};

// ─── Inline SVG Bar Chart ─────────────────────────────────────────────────────

function SVGBarChart({ data, xKey, yKey, gold = "#C5A059" }: {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  gold?: string;
}) {
  if (!data.length) return null;
  const sliced = data.slice(0, 20);
  const values = sliced.map(d => Number(d[yKey]) || 0);
  const maxVal = Math.max(...values, 1);
  const barW = 32;
  const gap = 8;
  const chartH = 120;
  const totalW = sliced.length * (barW + gap);

  return (
    <div className="overflow-x-auto mt-4 rounded-xl p-4" style={{ background: "rgba(197,160,89,0.04)", border: "1px solid rgba(197,160,89,0.12)" }}>
      <svg width={totalW} height={chartH + 40} style={{ minWidth: totalW }}>
        {sliced.map((d, i) => {
          const val = Number(d[yKey]) || 0;
          const barH = Math.max(2, Math.round((val / maxVal) * chartH));
          const x = i * (barW + gap);
          const y = chartH - barH;
          const label = String(d[xKey] || "").slice(0, 8);
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH} rx={4} fill={gold} fillOpacity={0.85} />
              <text x={x + barW / 2} y={chartH + 14} textAnchor="middle" fontSize={9} fill="#9ca3af">{label}</text>
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={9} fill={gold} fontWeight="600">
                {val >= 1000 ? `${(val / 1000).toFixed(1)}K` : String(val)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Library Report Definitions ───────────────────────────────────────────────

function buildLibraryReports(): LibraryReport[] {
  return [
    {
      id: "daily_revenue",
      title: "Daily Revenue Summary",
      category: "Financial",
      description: "Revenue grouped by date. Identify peak billing days.",
      icon: IndianRupee,
      chartType: "bar",
      chartX: "date",
      chartY: "total",
      columns: [{ key: "date", label: "Date" }, { key: "count", label: "Invoices" }, { key: "total", label: "Revenue (₹)", numeric: true }],
      queryFn: async (clinicId, from, to) => {
        const { data } = await supabase
          .from("pending_invoices")
          .select("created_at, total_amount")
          .eq("clinic_id", clinicId)
          .in("status", ["paid", "partial"])
          .gte("created_at", from)
          .lte("created_at", to)
          .order("created_at");
        const map: Record<string, { date: string; count: number; total: number }> = {};
        (data || []).forEach((r: { created_at: string; total_amount: number }) => {
          const date = r.created_at.slice(0, 10);
          if (!map[date]) map[date] = { date, count: 0, total: 0 };
          map[date].count++;
          map[date].total += r.total_amount || 0;
        });
        return Object.values(map).map(r => ({ ...r, total: Math.round(r.total) }));
      },
    },
    {
      id: "provider_performance",
      title: "Provider Performance",
      category: "Financial",
      description: "Commission totals per provider. Track who drives revenue.",
      icon: TrendingUp,
      chartType: "bar",
      chartX: "provider",
      chartY: "total",
      columns: [{ key: "provider", label: "Provider" }, { key: "services", label: "Services" }, { key: "total", label: "Commission (₹)", numeric: true }],
      queryFn: async (clinicId, from, to) => {
        const { data } = await supabase
          .from("staff_commissions")
          .select("provider_id, service_name, commission_amount, profiles!staff_commissions_provider_id_fkey(full_name)")
          .eq("clinic_id", clinicId)
          .gte("created_at", from)
          .lte("created_at", to);
        const map: Record<string, { provider: string; services: number; total: number }> = {};
        (data || []).forEach((r: { provider_id: string; commission_amount: number; profiles: { full_name: string } | { full_name: string }[] | null }) => {
          const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
          const name = prof?.full_name ?? r.provider_id;
          if (!map[r.provider_id]) map[r.provider_id] = { provider: name, services: 0, total: 0 };
          map[r.provider_id].services++;
          map[r.provider_id].total += r.commission_amount || 0;
        });
        return Object.values(map).map(r => ({ ...r, total: Math.round(r.total) })).sort((a, b) => b.total - a.total);
      },
    },
    {
      id: "service_mix",
      title: "Service Mix Analysis",
      category: "Clinical",
      description: "Revenue contribution per service. See what sells most.",
      icon: BarChart2,
      chartType: "bar",
      chartX: "service",
      chartY: "revenue",
      columns: [{ key: "service", label: "Service" }, { key: "count", label: "Qty" }, { key: "revenue", label: "Revenue (₹)", numeric: true }],
      queryFn: async (clinicId, from, to) => {
        const { data } = await supabase
          .from("invoice_line_items")
          .select("description, quantity, line_total, created_at")
          .eq("clinic_id", clinicId)
          .gte("created_at", from)
          .lte("created_at", to);
        const map: Record<string, { service: string; count: number; revenue: number }> = {};
        (data || []).forEach((r: { description: string; quantity: number; line_total: number }) => {
          const svc = r.description || "Unknown";
          if (!map[svc]) map[svc] = { service: svc, count: 0, revenue: 0 };
          map[svc].count += r.quantity || 1;
          map[svc].revenue += r.line_total || 0;
        });
        return Object.values(map).map(r => ({ ...r, revenue: Math.round(r.revenue) })).sort((a, b) => b.revenue - a.revenue);
      },
    },
    {
      id: "patient_retention",
      title: "Patient Retention Cohort",
      category: "Patients",
      description: "Distinct active patients per month. Track retention trends.",
      icon: Users,
      chartType: "bar",
      chartX: "month",
      chartY: "patients",
      columns: [{ key: "month", label: "Month" }, { key: "patients", label: "Active Patients", numeric: true }],
      queryFn: async (clinicId, from, to) => {
        const { data } = await supabase
          .from("appointments")
          .select("patient_id, start_time")
          .eq("clinic_id", clinicId)
          .eq("status", "completed")
          .gte("start_time", from)
          .lte("start_time", to);
        const map: Record<string, Set<string>> = {};
        (data || []).forEach((r: { patient_id: string; start_time: string }) => {
          const mo = r.start_time.slice(0, 7);
          if (!map[mo]) map[mo] = new Set();
          map[mo].add(r.patient_id);
        });
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([month, set]) => ({ month, patients: set.size }));
      },
    },
    {
      id: "membership_mrr",
      title: "Membership MRR & Churn",
      category: "Financial",
      description: "Active members per plan. Monitor subscription health.",
      icon: Star,
      chartType: "bar",
      chartX: "plan",
      chartY: "members",
      columns: [{ key: "plan", label: "Plan" }, { key: "members", label: "Members", numeric: true }, { key: "active", label: "Active", numeric: true }],
      queryFn: async (clinicId) => {
        const { data } = await supabase
          .from("patient_memberships")
          .select("status, membership_plans!patient_memberships_plan_id_fkey(name)")
          .eq("clinic_id", clinicId);
        const map: Record<string, { plan: string; members: number; active: number }> = {};
        (data || []).forEach((r: { status: string; membership_plans: { name: string } | { name: string }[] | null }) => {
          const plan = Array.isArray(r.membership_plans) ? r.membership_plans[0] : r.membership_plans;
          const name = plan?.name ?? "Unknown";
          if (!map[name]) map[name] = { plan: name, members: 0, active: 0 };
          map[name].members++;
          if (r.status === "active") map[name].active++;
        });
        return Object.values(map).sort((a, b) => b.members - a.members);
      },
    },
    {
      id: "inventory_stock",
      title: "Inventory Stock Levels",
      category: "Operations",
      description: "Current stock vs reorder threshold for all products.",
      icon: Package,
      columns: [
        { key: "name", label: "Product" }, { key: "category", label: "Category" },
        { key: "quantity", label: "Stock", numeric: true }, { key: "reorder_level", label: "Reorder At", numeric: true },
        { key: "status", label: "Status" },
      ],
      queryFn: async (clinicId) => {
        const { data } = await supabase
          .from("inventory_products")
          .select("name, category, quantity, reorder_level")
          .eq("clinic_id", clinicId)
          .order("quantity");
        return (data || []).map((r: { name: string; category: string; quantity: number; reorder_level: number }) => ({
          ...r,
          status: r.quantity <= 0 ? "Out of Stock" : r.quantity <= (r.reorder_level || 0) ? "Low Stock" : "OK",
        }));
      },
    },
    {
      id: "credit_redemption",
      title: "Credit Redemption Analysis",
      category: "Clinical",
      description: "Sessions consumed per service. Track package utilisation.",
      icon: ShoppingCart,
      chartType: "bar",
      chartX: "service",
      chartY: "sessions",
      columns: [{ key: "service", label: "Service" }, { key: "sessions", label: "Sessions Used", numeric: true }],
      queryFn: async (clinicId, from, to) => {
        const { data } = await supabase
          .from("credit_consumption_log")
          .select("session_date, patient_service_credits!credit_consumption_log_credit_id_fkey(service_name)")
          .eq("consumed_at_clinic_id", clinicId)
          .gte("session_date", from.slice(0, 10))
          .lte("session_date", to.slice(0, 10));
        const map: Record<string, { service: string; sessions: number }> = {};
        (data || []).forEach((r: { patient_service_credits: { service_name: string } | { service_name: string }[] | null }) => {
          const cred = Array.isArray(r.patient_service_credits) ? r.patient_service_credits[0] : r.patient_service_credits;
          const svc = cred?.service_name ?? "Unknown";
          if (!map[svc]) map[svc] = { service: svc, sessions: 0 };
          map[svc].sessions++;
        });
        return Object.values(map).sort((a, b) => b.sessions - a.sessions);
      },
    },
    {
      id: "campaign_performance",
      title: "Campaign Performance",
      category: "Marketing",
      description: "Sent vs delivered counts per campaign.",
      icon: MessageSquare,
      chartType: "bar",
      chartX: "name",
      chartY: "delivered_count",
      columns: [
        { key: "name", label: "Campaign" }, { key: "type", label: "Type" },
        { key: "sent_count", label: "Sent", numeric: true }, { key: "delivered_count", label: "Delivered", numeric: true },
      ],
      queryFn: async (clinicId) => {
        const { data } = await supabase
          .from("crm_campaigns")
          .select("name, type, sent_count, delivered_count")
          .eq("clinic_id", clinicId)
          .eq("status", "completed")
          .order("sent_count", { ascending: false });
        return (data || []) as Record<string, unknown>[];
      },
    },
    {
      id: "recall_effectiveness",
      title: "Recall Effectiveness",
      category: "Clinical",
      description: "Patient recall conversion rates. (Requires recall_tasks table)",
      icon: Calendar,
      comingSoon: true,
    },
    {
      id: "no_show",
      title: "No-Show & Cancellation Cost",
      category: "Operations",
      description: "Revenue lost due to no-shows and cancellations.",
      icon: Clock,
      columns: [
        { key: "date", label: "Date" }, { key: "patient_name", label: "Patient" },
        { key: "provider_name", label: "Provider" }, { key: "status", label: "Status" },
      ],
      queryFn: async (clinicId, from, to) => {
        const { data } = await supabase
          .from("appointments")
          .select("start_time, status, patient_id, provider_id, patients!appointments_patient_id_fkey(full_name), profiles!appointments_provider_id_fkey(full_name)")
          .eq("clinic_id", clinicId)
          .in("status", ["no_show", "cancelled"])
          .gte("start_time", from)
          .lte("start_time", to)
          .order("start_time", { ascending: false });
        return (data || []).map((r: {
          start_time: string; status: string;
          patients: { full_name: string } | { full_name: string }[] | null;
          profiles: { full_name: string } | { full_name: string }[] | null;
        }) => {
          const pat = Array.isArray(r.patients) ? r.patients[0] : r.patients;
          const prov = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
          return {
            date: r.start_time.slice(0, 10),
            patient_name: pat?.full_name ?? "—",
            provider_name: prov?.full_name ?? "—",
            status: r.status,
          };
        });
      },
    },
    {
      id: "loyalty_points",
      title: "Loyalty Points",
      category: "Financial",
      description: "Patient loyalty point ledger. (Requires loyalty_points_ledger table)",
      icon: Star,
      comingSoon: true,
    },
    {
      id: "commission_ledger",
      title: "Staff Commission Ledger",
      category: "Financial",
      description: "Per-provider commission breakdown with payment status.",
      icon: UserCheck,
      columns: [
        { key: "provider", label: "Staff" }, { key: "service", label: "Service" },
        { key: "amount", label: "Commission (₹)", numeric: true }, { key: "status", label: "Status" },
      ],
      queryFn: async (clinicId, from, to) => {
        const { data } = await supabase
          .from("staff_commissions")
          .select("provider_id, service_name, commission_amount, status, created_at, profiles!staff_commissions_provider_id_fkey(full_name)")
          .eq("clinic_id", clinicId)
          .gte("created_at", from)
          .lte("created_at", to)
          .order("created_at", { ascending: false });
        return (data || []).map((r: {
          service_name: string; commission_amount: number; status: string;
          profiles: { full_name: string } | { full_name: string }[] | null;
        }) => {
          const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
          return { provider: prof?.full_name ?? "—", service: r.service_name, amount: Math.round(r.commission_amount || 0), status: r.status };
        });
      },
    },
  ];
}

// ─── Library Tab ─────────────────────────────────────────────────────────────

function LibraryTab({ clinicId, dateFrom, dateTo }: { clinicId: string; dateFrom: string; dateTo: string }) {
  const REPORTS = buildLibraryReports();
  const [activeReport, setActiveReport] = useState<LibraryReport | null>(null);
  const [reportData, setReportData] = useState<Record<string, unknown>[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);

  const openReport = async (r: LibraryReport) => {
    if (r.comingSoon || !r.queryFn) { setActiveReport(r); setReportData([]); return; }
    setActiveReport(r);
    setLoadingReport(true);
    setReportData([]);
    try {
      const rows = await r.queryFn(clinicId, dateFrom + "T00:00:00", dateTo + "T23:59:59");
      setReportData(rows);
    } catch { setReportData([]); }
    setLoadingReport(false);
  };

  const exportCSV = () => {
    if (!activeReport || !reportData.length || !activeReport.columns) return;
    const headers = activeReport.columns.map(c => c.label).join(",");
    const rows = reportData.map(row => activeReport.columns!.map(c => JSON.stringify(row[c.key] ?? "")).join(",")).join("\n");
    const blob = new Blob([headers + "\n" + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${activeReport.id}.csv`; a.click();
  };

  const CATEGORIES = [...new Set(REPORTS.map(r => r.category))];

  if (activeReport) {
    const cols = activeReport.columns || [];
    return (
      <div>
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => { setActiveReport(null); setReportData([]); }}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border"
            style={{ borderColor: "rgba(197,160,89,0.2)", color: "#6b7280" }}>
            ← Back
          </button>
          <h2 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>{activeReport.title}</h2>
          {!activeReport.comingSoon && (
            <button onClick={exportCSV} disabled={!reportData.length}
              className="flex items-center gap-1.5 ml-auto px-3 py-1.5 rounded-lg text-sm border disabled:opacity-40"
              style={{ borderColor: "rgba(197,160,89,0.3)", color: "var(--gold)" }}>
              <Download size={14} /> Export CSV
            </button>
          )}
        </div>

        {activeReport.comingSoon ? (
          <div className="rounded-xl p-16 text-center" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
            <p className="text-2xl mb-3" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Coming Soon</p>
            <p className="text-sm" style={{ color: "#9ca3af" }}>{activeReport.description}</p>
          </div>
        ) : (
          <>
            {activeReport.chartType && activeReport.chartX && activeReport.chartY && reportData.length > 0 && (
              <SVGBarChart data={reportData} xKey={activeReport.chartX} yKey={activeReport.chartY} />
            )}
            <div className="rounded-xl overflow-hidden mt-4" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(197,160,89,0.1)", background: "rgba(197,160,89,0.04)" }}>
                    {cols.map(c => (
                      <th key={c.key} className="px-4 py-3 text-left text-xs font-medium"
                        style={{ color: "rgba(197,160,89,0.7)", letterSpacing: "0.05em" }}>{c.label.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingReport ? (
                    <tr><td colSpan={cols.length} className="px-4 py-12 text-center text-sm" style={{ color: "#9ca3af" }}>Loading…</td></tr>
                  ) : reportData.length === 0 ? (
                    <tr><td colSpan={cols.length} className="px-4 py-12 text-center text-sm" style={{ color: "#9ca3af" }}>No data for this period</td></tr>
                  ) : reportData.map((row, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(197,160,89,0.06)" }}>
                      {cols.map(c => (
                        <td key={c.key} className="px-4 py-2.5 text-sm" style={{ color: c.numeric ? "var(--gold)" : "#4b5563", fontWeight: c.numeric ? 600 : 400 }}>
                          {c.numeric ? Number(row[c.key] || 0).toLocaleString() : String(row[c.key] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      {CATEGORIES.map(cat => (
        <div key={cat} className="mb-8">
          <p className="text-xs font-medium mb-3" style={{ color: "rgba(197,160,89,0.7)", letterSpacing: "0.08em" }}>{cat.toUpperCase()}</p>
          <div className="grid grid-cols-3 gap-4">
            {REPORTS.filter(r => r.category === cat).map(r => {
              const Icon = r.icon;
              return (
                <button key={r.id} onClick={() => openReport(r)}
                  className="rounded-xl p-5 text-left transition-all hover:shadow-md group"
                  style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(197,160,89,0.1)" }}>
                      <Icon size={18} style={{ color: "var(--gold)" }} />
                    </div>
                    {r.comingSoon && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(107,114,128,0.1)", color: "#6b7280" }}>Soon</span>
                    )}
                    {!r.comingSoon && (
                      <ChevronRight size={14} style={{ color: "#d1d5db" }} className="group-hover:text-gold transition-colors" />
                    )}
                  </div>
                  <p className="font-semibold text-sm mb-1" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>{r.title}</p>
                  <p className="text-xs" style={{ color: "#9ca3af" }}>{r.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Builder Tab ─────────────────────────────────────────────────────────────

function BuilderTab({ clinicId, profile }: { clinicId: string; profile: { id: string } | null }) {
  const [reports, setReports] = useState<ReportDefinition[]>([]);
  const [selected, setSelected] = useState<ReportDefinition | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewData, setPreviewData] = useState<Record<string, unknown>[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [form, setForm] = useState({
    name: "", base_entity: "patients" as BaseEntity,
    columns: [] as Array<{ field: string; label: string }>,
    filters: [] as Array<{ field: string; operator: string; value: string }>,
  });

  const fetchReports = useCallback(async () => {
    const { data } = await supabase.from("report_definitions").select("*")
      .eq("clinic_id", clinicId).order("created_at", { ascending: false });
    setReports((data as ReportDefinition[]) || []);
  }, [clinicId]);

  useEffect(() => {
    fetchReports().finally(() => setLoading(false));
  }, [fetchReports]);

  const runPreview = useCallback(async () => {
    if (form.columns.length === 0) return;
    setPreviewLoading(true);
    const table = TABLE_MAP[form.base_entity];
    const fields = form.columns.map(c => c.field).join(",");
    try {
      // GAP-47: Apply filters to query
      let q = supabase.from(table).select(fields).eq("clinic_id", clinicId).limit(20);
      for (const f of form.filters) {
        if (!f.field || !f.value) continue;
        if (f.operator === "eq")   q = q.eq(f.field, f.value);
        else if (f.operator === "neq")  q = q.neq(f.field, f.value);
        else if (f.operator === "gt")   q = q.gt(f.field, f.value);
        else if (f.operator === "lt")   q = q.lt(f.field, f.value);
        else if (f.operator === "like") q = q.ilike(f.field, `%${f.value}%`);
      }
      const { data } = await q;
      setPreviewData((data as Record<string, unknown>[] | null) || []);
    } catch { setPreviewData([]); }
    setPreviewLoading(false);
  }, [clinicId, form.columns, form.base_entity, form.filters]);

  const saveReport = async () => {
    if (!form.name || form.columns.length === 0) return;
    setSaving(true);
    const payload = { clinic_id: clinicId, name: form.name, base_entity: form.base_entity, columns: form.columns, filters: form.filters, created_by: profile?.id };
    if (selected?.id) await supabase.from("report_definitions").update(payload).eq("id", selected.id);
    else await supabase.from("report_definitions").insert(payload);
    setSaving(false);
    setCreating(false);
    setSelected(null);
    fetchReports();
  };

  const deleteReport = async (id: string) => {
    if (!confirm("Delete this report?")) return;
    await supabase.from("report_definitions").delete().eq("id", id);
    if (selected?.id === id) setSelected(null);
    fetchReports();
  };

  const startNew = () => {
    setSelected(null);
    setForm({ name: "", base_entity: "patients", columns: [], filters: [] });
    setPreviewData([]);
    setCreating(true);
  };

  const loadReport = (r: ReportDefinition) => {
    setSelected(r);
    setForm({ name: r.name, base_entity: r.base_entity, columns: r.columns, filters: r.filters.map(f => ({ ...f, value: String(f.value) })) });
    setCreating(true);
    setPreviewData([]);
  };

  const addColumn = (field: string, label: string) => {
    if (form.columns.find(c => c.field === field)) return;
    setForm(f => ({ ...f, columns: [...f.columns, { field, label }] }));
  };
  const removeColumn = (field: string) => setForm(f => ({ ...f, columns: f.columns.filter(c => c.field !== field) }));

  const exportCSV = () => {
    if (!previewData.length) return;
    const headers = form.columns.map(c => c.label).join(",");
    const rows = previewData.map(row => form.columns.map(c => JSON.stringify(row[c.field] ?? "")).join(",")).join("\n");
    const blob = new Blob([headers + "\n" + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${form.name || "report"}.csv`; a.click();
  };

  const exportTally = () => {
    if (!previewData.length) return;
    const headers = "Date,Ledger Name,Voucher Type,Dr/Cr,Amount,Narration";
    const rows = previewData.map(row => {
      const date = String(row["created_at"] ?? row["date"] ?? new Date().toISOString()).slice(0, 10);
      const ledger = String(row["patient_name"] ?? row["full_name"] ?? "Clinic");
      const amount = Number(row["total_amount"] ?? row["net_pay"] ?? row["commission_amount"] ?? 0);
      return [date, ledger, "Sales", "Dr", amount, form.name].map(v => JSON.stringify(v)).join(",");
    }).join("\n");
    const blob = new Blob([headers + "\n" + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `tally_${form.name || "export"}.csv`; a.click();
  };

  const numericField = form.columns.find(c => ["total_amount", "net_pay", "commission_amount", "line_total", "wallet_balance"].includes(c.field));
  const labelField = form.columns.find(c => ["full_name", "name", "patient_name", "description", "service_name"].includes(c.field));

  const availableFields = ENTITY_FIELDS[form.base_entity] || [];

  return (
    <div className="flex h-full overflow-hidden">
      {/* LEFT PANEL */}
      <div className="w-64 flex-shrink-0 flex flex-col" style={{ background: "#fff", borderRight: "1px solid rgba(197,160,89,0.15)" }}>
        <div className="flex justify-between items-center px-4 py-4" style={{ borderBottom: "1px solid rgba(197,160,89,0.1)" }}>
          <h3 className="font-semibold text-sm" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Saved Reports</h3>
          <button onClick={startNew} className="p-1.5 rounded-lg hover:bg-amber-50 transition-colors">
            <Plus size={16} style={{ color: "var(--gold)" }} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-2 animate-pulse">
              {[1,2,3].map(n => <div key={n} className="h-14 rounded-lg" style={{ background: "rgba(197,160,89,0.06)" }} />)}
            </div>
          ) : reports.length === 0 ? (
            <div className="p-6 text-center" style={{ color: "#9ca3af" }}>
              <BarChart2 size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No reports yet</p>
            </div>
          ) : reports.map(r => (
            <button key={r.id} onClick={() => loadReport(r)}
              className="w-full text-left px-4 py-3 flex items-center justify-between transition-colors hover:bg-amber-50/50"
              style={{ borderBottom: "1px solid rgba(197,160,89,0.06)", background: selected?.id === r.id ? "rgba(197,160,89,0.06)" : "transparent" }}>
              <div className="flex-1 min-w-0 mr-2">
                <p className="text-sm font-medium truncate" style={{ color: "#1a1714", fontFamily: "Georgia, serif" }}>{r.name}</p>
                <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>{ENTITY_LABELS[r.base_entity]} · {r.columns.length} cols</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={e => { e.stopPropagation(); deleteReport(r.id); }} className="p-1 hover:bg-red-50 rounded transition-colors">
                  <Trash2 size={12} style={{ color: "#ef4444" }} />
                </button>
                <ChevronRight size={14} style={{ color: "#9ca3af" }} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!creating ? (
          <div className="flex-1 flex items-center justify-center" style={{ color: "rgba(197,160,89,0.4)" }}>
            <div className="text-center">
              <BarChart2 size={48} className="mx-auto mb-3 opacity-30" />
              <p style={{ fontFamily: "Georgia, serif" }}>Select a report or create a new one</p>
              <button onClick={startNew} className="mt-4 px-6 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: "var(--gold)" }}>New Report</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(197,160,89,0.1)", background: "#fff" }}>
              <div className="flex items-center gap-4">
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Report Name" className="text-lg font-semibold border-b outline-none bg-transparent"
                  style={{ color: "#1a1714", fontFamily: "Georgia, serif", borderColor: "rgba(197,160,89,0.3)", paddingBottom: 2 }} />
                <select value={form.base_entity} onChange={e => setForm(f => ({ ...f, base_entity: e.target.value as BaseEntity, columns: [] }))}
                  className="text-sm px-3 py-1.5 rounded-lg border bg-white outline-none"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }}>
                  {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={exportTally} disabled={!previewData.length}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border disabled:opacity-40"
                  style={{ borderColor: "rgba(197,160,89,0.3)", color: "#7c3aed" }}>
                  <Download size={12} /> Tally
                </button>
                <button onClick={exportCSV} disabled={!previewData.length}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border disabled:opacity-40"
                  style={{ borderColor: "rgba(197,160,89,0.3)", color: "var(--gold)" }}>
                  <Download size={14} /> CSV
                </button>
                <button onClick={saveReport} disabled={saving || !form.name || form.columns.length === 0}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: "var(--gold)" }}>
                  <Save size={14} /> {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              <div className="w-52 flex-shrink-0 overflow-y-auto p-4" style={{ borderRight: "1px solid rgba(197,160,89,0.1)", background: "#faf9f6" }}>
                <p className="text-xs font-medium mb-3" style={{ color: "rgba(197,160,89,0.8)", letterSpacing: "0.05em" }}>AVAILABLE FIELDS</p>
                {availableFields.map(f => {
                  const isAdded = form.columns.find(c => c.field === f.field);
                  return (
                    <button key={f.field} onClick={() => isAdded ? removeColumn(f.field) : addColumn(f.field, f.label)}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm mb-1 flex items-center justify-between transition-all"
                      style={{
                        background: isAdded ? "rgba(197,160,89,0.12)" : "transparent",
                        color: isAdded ? "var(--gold)" : "#4b5563",
                        border: isAdded ? "1px solid rgba(197,160,89,0.2)" : "1px solid transparent",
                      }}>
                      <span>{f.label}</span>
                      {isAdded && <X size={12} />}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 flex flex-col overflow-hidden p-4">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-xs font-medium" style={{ color: "rgba(197,160,89,0.8)", letterSpacing: "0.05em" }}>
                    SELECTED: {form.columns.length} columns
                  </p>
                  <button onClick={runPreview} disabled={form.columns.length === 0 || previewLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                    style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)" }}>
                    {previewLoading ? "Running…" : "▶ Run Preview"}
                  </button>
                </div>

                {numericField && labelField && previewData.length > 0 && (
                  <SVGBarChart data={previewData} xKey={labelField.field} yKey={numericField.field} />
                )}

                {/* GAP-47: Filter UI */}
                {form.columns.length > 0 && (
                  <div style={{ marginBottom: 8, border: "1px solid rgba(197,160,89,0.15)", borderRadius: 10, padding: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <p className="text-xs font-medium" style={{ color: "rgba(197,160,89,0.8)", letterSpacing: "0.05em", margin: 0 }}>
                        FILTERS ({form.filters.length})
                      </p>
                      <button
                        onClick={() => setForm(f => ({ ...f, filters: [...f.filters, { field: availableFields[0]?.field ?? "", operator: "eq", value: "" }] }))}
                        className="text-xs px-2 py-1 rounded"
                        style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)", border: "none", cursor: "pointer" }}
                      >
                        + Add Filter
                      </button>
                    </div>
                    {form.filters.map((filter, fi) => (
                      <div key={fi} style={{ display: "flex", gap: 6, marginBottom: 4, alignItems: "center" }}>
                        <select
                          value={filter.field}
                          onChange={e => setForm(f => { const filters = [...f.filters]; filters[fi] = { ...filters[fi], field: e.target.value }; return { ...f, filters }; })}
                          style={{ fontSize: 11, padding: "4px 6px", borderRadius: 6, border: "1px solid rgba(197,160,89,0.2)", background: "white", color: "#1C1917", flex: 1 }}
                        >
                          {availableFields.map(af => <option key={af.field} value={af.field}>{af.label}</option>)}
                        </select>
                        <select
                          value={filter.operator}
                          onChange={e => setForm(f => { const filters = [...f.filters]; filters[fi] = { ...filters[fi], operator: e.target.value }; return { ...f, filters }; })}
                          style={{ fontSize: 11, padding: "4px 6px", borderRadius: 6, border: "1px solid rgba(197,160,89,0.2)", background: "white", color: "#1C1917", width: 70 }}
                        >
                          <option value="eq">= equals</option>
                          <option value="neq">≠ not</option>
                          <option value="gt">&gt; gt</option>
                          <option value="lt">&lt; lt</option>
                          <option value="like">~ like</option>
                        </select>
                        <input
                          value={filter.value}
                          onChange={e => setForm(f => { const filters = [...f.filters]; filters[fi] = { ...filters[fi], value: e.target.value }; return { ...f, filters }; })}
                          placeholder="value"
                          style={{ fontSize: 11, padding: "4px 6px", borderRadius: 6, border: "1px solid rgba(197,160,89,0.2)", background: "white", color: "#1C1917", flex: 1 }}
                        />
                        <button
                          onClick={() => setForm(f => ({ ...f, filters: f.filters.filter((_, i) => i !== fi) }))}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", padding: 2 }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {form.columns.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center rounded-xl" style={{ background: "rgba(197,160,89,0.04)", border: "1px dashed rgba(197,160,89,0.15)" }}>
                    <p className="text-sm" style={{ color: "#9ca3af" }}>Add columns from the left panel</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto rounded-xl mt-3" style={{ border: "1px solid rgba(197,160,89,0.15)" }}>
                    <table className="w-full text-sm" style={{ background: "#fff" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(197,160,89,0.1)", background: "rgba(197,160,89,0.04)" }}>
                          {form.columns.map(c => (
                            <th key={c.field} className="px-3 py-2.5 text-left text-xs font-medium"
                              style={{ color: "rgba(197,160,89,0.7)", letterSpacing: "0.05em" }}>
                              {c.label.toUpperCase()}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewLoading ? (
                          <tr><td colSpan={form.columns.length} className="px-3 py-8 text-center text-sm" style={{ color: "#9ca3af" }}>Loading…</td></tr>
                        ) : previewData.length === 0 ? (
                          <tr><td colSpan={form.columns.length} className="px-3 py-8 text-center text-sm" style={{ color: "#9ca3af" }}>Click "Run Preview" to see data</td></tr>
                        ) : previewData.map((row, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid rgba(197,160,89,0.06)" }}>
                            {form.columns.map(c => (
                              <td key={c.field} className="px-3 py-2.5 text-sm" style={{ color: "#4b5563" }}>
                                {String(row[c.field] ?? "—")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Heatmap Tab ─────────────────────────────────────────────────────────────

function HeatmapTab({ clinicId, dateFrom, dateTo }: { clinicId: string; dateFrom: string; dateTo: string }) {
  const [heatData, setHeatData] = useState<Record<string, Record<number, number>>>({});
  const [providers, setProviders] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [tooltip, setTooltip] = useState<{ provider: string; hour: number; count: number } | null>(null);

  const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8-19

  const fetchHeatmap = useCallback(async () => {
    setLoading(true);
    const [apptsRes, profsRes] = await Promise.all([
      supabase.from("appointments")
        .select("provider_id, start_time")
        .eq("clinic_id", clinicId)
        .gte("start_time", dateFrom + "T00:00:00")
        .lte("start_time", dateTo + "T23:59:59"),
      supabase.from("profiles")
        .select("id, full_name")
        .eq("clinic_id", clinicId)
        .eq("is_active", true),
    ]);

    const provMap: Record<string, string> = {};
    (profsRes.data || []).forEach((p: { id: string; full_name: string }) => { provMap[p.id] = p.full_name; });

    const heat: Record<string, Record<number, number>> = {};
    (apptsRes.data || []).forEach((a: { provider_id: string | null; start_time: string }) => {
      if (!a.provider_id) return;
      const hour = new Date(a.start_time).getHours();
      if (hour < 8 || hour > 19) return;
      if (!heat[a.provider_id]) heat[a.provider_id] = {};
      heat[a.provider_id][hour] = (heat[a.provider_id][hour] || 0) + 1;
    });

    const allProviderIds = [...new Set([
      ...Object.keys(heat),
      ...(profsRes.data || []).map((p: { id: string }) => p.id),
    ])];
    setProviders(allProviderIds.map(id => ({ id, name: provMap[id] ?? "Unknown" })));
    setHeatData(heat);
    setLoading(false);
  }, [clinicId, dateFrom, dateTo]);

  useEffect(() => { fetchHeatmap(); }, [fetchHeatmap]);

  const maxCount = Math.max(1, ...Object.values(heatData).flatMap(h => Object.values(h)));

  const getCellColor = (count: number): string => {
    if (!count) return "rgba(197,160,89,0.04)";
    const intensity = count / maxCount;
    if (intensity < 0.33) return `rgba(197,160,89,${0.15 + intensity * 0.3})`;
    if (intensity < 0.66) return `rgba(197,160,89,${0.45 + intensity * 0.3})`;
    return `rgba(217,119,6,${0.5 + intensity * 0.5})`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24" style={{ color: "#9ca3af" }}>
        <p>Loading heatmap…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Scheduler Utilisation Heatmap</h2>
        <p className="text-sm mt-1" style={{ color: "#9ca3af" }}>Appointment density per provider × hour. Darker = more bookings.</p>
      </div>

      {providers.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
          <Calendar size={36} className="mx-auto mb-3 opacity-20" style={{ color: "var(--gold)" }} />
          <p className="text-sm" style={{ color: "#9ca3af" }}>No appointment data for this period</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-auto" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
          <table className="text-xs" style={{ borderCollapse: "collapse", minWidth: "100%" }}>
            <thead>
              <tr style={{ background: "rgba(197,160,89,0.04)" }}>
                <th className="px-4 py-3 text-left font-medium sticky left-0 bg-white" style={{ color: "rgba(197,160,89,0.7)", minWidth: 140, zIndex: 2, boxShadow: "1px 0 0 rgba(197,160,89,0.1)" }}>
                  HOUR ↓ / PROVIDER →
                </th>
                {providers.map(p => (
                  <th key={p.id} className="py-3 px-2 text-center font-medium" style={{ color: "rgba(197,160,89,0.7)", minWidth: 80 }}>
                    {p.name.split(" ")[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HOURS.map(hour => (
                <tr key={hour} style={{ borderTop: "1px solid rgba(197,160,89,0.06)" }}>
                  <td className="px-4 py-2 font-medium sticky left-0 bg-white" style={{ color: "#6b7280", zIndex: 1, boxShadow: "1px 0 0 rgba(197,160,89,0.1)" }}>
                    {hour > 12 ? `${hour - 12}:00 PM` : hour === 12 ? "12:00 PM" : `${hour}:00 AM`}
                  </td>
                  {providers.map(p => {
                    const count = heatData[p.id]?.[hour] || 0;
                    return (
                      <td key={p.id} className="py-2 px-2 text-center cursor-pointer transition-all"
                        style={{ background: getCellColor(count) }}
                        onMouseEnter={() => count && setTooltip({ provider: p.name, hour, count })}
                        onMouseLeave={() => setTooltip(null)}
                        title={count ? `${p.name} at ${hour}:00 — ${count} appointment${count !== 1 ? "s" : ""}` : undefined}>
                        {count > 0 && <span style={{ fontWeight: 600, color: count >= maxCount * 0.66 ? "#fff" : "var(--gold)" }}>{count}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {tooltip && (
            <div className="px-4 py-2 text-xs" style={{ borderTop: "1px solid rgba(197,160,89,0.1)", color: "#6b7280" }}>
              {tooltip.provider} · {tooltip.hour > 12 ? `${tooltip.hour - 12}PM` : `${tooltip.hour}AM`} → {tooltip.count} appointment{tooltip.count !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 mt-4">
        <span className="text-xs" style={{ color: "#9ca3af" }}>Intensity:</span>
        {[0, 0.25, 0.5, 0.75, 1].map(v => (
          <div key={v} className="flex items-center gap-1">
            <div className="w-5 h-5 rounded" style={{ background: v === 0 ? "rgba(197,160,89,0.04)" : `rgba(217,119,6,${0.2 + v * 0.8})` }} />
            <span className="text-xs" style={{ color: "#9ca3af" }}>{v === 0 ? "None" : v === 1 ? "Peak" : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { profile, activeClinicId } = useClinic();
  const [tab, setTab] = useState<TabKey>("library");

  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const today = now.toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);

  const clinicId = activeClinicId || profile?.clinic_id;

  if (!clinicId) {
    return (
      <div className="flex flex-col h-screen" style={{ background: "#F9F7F2" }}>
        <TopBar />
        <div className="flex-1 flex items-center justify-center" style={{ color: "#9ca3af" }}>
          <p style={{ fontFamily: "Georgia, serif" }}>No clinic selected</p>
        </div>
      </div>
    );
  }

  const TABS: { key: TabKey; label: string }[] = [
    { key: "library", label: "Library" },
    { key: "builder", label: "Custom Builder" },
    { key: "heatmap", label: "Utilisation Heatmap" },
  ];

  return (
    <div className="flex flex-col h-screen" style={{ background: "#F9F7F2" }}>
      <TopBar />

      {/* Top bar with tabs + date range */}
      <div className="flex items-center justify-between px-6 py-4" style={{ background: "#fff", borderBottom: "1px solid rgba(197,160,89,0.12)" }}>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(197,160,89,0.08)", border: "1px solid rgba(197,160,89,0.15)" }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
              style={tab === t.key ? { background: "var(--gold)", color: "#fff", fontFamily: "Georgia, serif" } : { color: "rgba(197,160,89,0.7)" }}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label className="text-xs" style={{ color: "#9ca3af" }}>From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-1.5 rounded-lg border text-sm outline-none"
            style={{ borderColor: "rgba(197,160,89,0.3)" }} />
          <label className="text-xs" style={{ color: "#9ca3af" }}>To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-1.5 rounded-lg border text-sm outline-none"
            style={{ borderColor: "rgba(197,160,89,0.3)" }} />
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto" style={{ padding: tab === "builder" ? 0 : "1.5rem" }}>
        {tab === "library" && <LibraryTab clinicId={clinicId} dateFrom={dateFrom} dateTo={dateTo} />}
        {tab === "builder" && (
          <div className="flex h-full overflow-hidden">
            <BuilderTab clinicId={clinicId} profile={profile} />
          </div>
        )}
        {tab === "heatmap" && <HeatmapTab clinicId={clinicId} dateFrom={dateFrom} dateTo={dateTo} />}
      </div>
    </div>
  );
}
