"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Receipt, Plus, Search, Download, Printer,
  X, Check, Clock, Loader2, CreditCard,
  Banknote, Smartphone, Building2, Wallet, Shield,
  User, FileText, Eye, Trash2, RefreshCw,
  IndianRupee, BadgeCheck, ArrowUpRight, ChevronRight,
  AlertTriangle, Package, Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import { toast } from "sonner";
import TopBar from "@/components/TopBar";
import { logAction } from "@/lib/audit";

// ── Types ─────────────────────────────────────────────────────────────────────

type InvoiceStatus = "pending" | "partial" | "paid" | "overdue" | "void";
type PaymentMode   = "cash" | "card" | "upi" | "bank_transfer" | "wallet" | "insurance";

interface Invoice {
  id:              string;
  clinic_id:       string;
  patient_id:      string | null;
  patient_name:    string | null;
  appointment_id:  string | null;
  credit_id:       string | null;
  service_name:    string;
  amount:          number;
  tax_amount:      number;
  discount_amount: number;
  total_amount:    number;
  gst_pct:         number;
  status:          InvoiceStatus;
  payment_mode:    PaymentMode | null;
  payment_ref:     string | null;
  notes:           string | null;
  invoice_number:  string;
  invoice_type:    string;
  provider_name:   string | null;
  due_date:        string | null;
  paid_at:         string | null;
  void_reason:     string | null;
  created_at:      string;
  updated_at:      string;
}

interface InvoicePayment {
  id:              string;
  invoice_id:      string;
  amount:          number;
  payment_mode:    PaymentMode;
  transaction_ref: string | null;
  notes:           string | null;
  created_at:      string;
}

interface InvoiceItem {
  id?:           string;
  description:   string;
  service_id:    string | null;
  quantity:      number;
  unit_price:    number;
  discount_pct:  number;
  gst_pct:       number;
  line_total:    number;
}

interface PatientOption { id: string; full_name: string; phone: string | null; }
interface ServiceOption  { id: string; name: string; selling_price: number; category: string; }

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<InvoiceStatus, { label: string; bg: string; border: string; text: string; dot: string }> = {
  pending: { label: "Pending",  bg: "#FFF8E8", border: "#D4A017", text: "#92600A", dot: "#D4A017" },
  partial: { label: "Partial",  bg: "#EEF2FA", border: "#2A4A8A", text: "#1A3A7A", dot: "#2A4A8A" },
  paid:    { label: "Paid",     bg: "#EFF6EF", border: "#4A8A4A", text: "#2A5A2A", dot: "#4A8A4A" },
  overdue: { label: "Overdue",  bg: "#FEF2F2", border: "#B43C3C", text: "#8A1A1A", dot: "#EF4444" },
  void:    { label: "Void",     bg: "#F5F5F3", border: "#9C9584", text: "#6B6456", dot: "#9C9584" },
};

const PAYMENT_MODES: { value: PaymentMode; label: string; Icon: React.ElementType }[] = [
  { value: "cash",          label: "Cash",          Icon: Banknote   },
  { value: "card",          label: "Card",          Icon: CreditCard },
  { value: "upi",           label: "UPI",           Icon: Smartphone },
  { value: "bank_transfer", label: "Bank Transfer", Icon: Building2  },
  { value: "wallet",        label: "Wallet",        Icon: Wallet     },
  { value: "insurance",     label: "Insurance",     Icon: Shield     },
];

const PM_ICON: Record<PaymentMode, React.ElementType> = {
  cash: Banknote, card: CreditCard, upi: Smartphone,
  bank_transfer: Building2, wallet: Wallet, insurance: Shield,
};

const GST_OPTIONS = [0, 5, 12, 18, 28];

const TABS: { key: "all" | InvoiceStatus; label: string }[] = [
  { key: "all",     label: "All"     },
  { key: "pending", label: "Pending" },
  { key: "partial", label: "Partial" },
  { key: "paid",    label: "Paid"    },
  { key: "overdue", label: "Overdue" },
  { key: "void",    label: "Void"    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt      = (n: number) => "₹" + (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate  = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const todayStr = () => new Date().toISOString().split("T")[0];
const firstDOM = () => { const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0]; };

function calcLineTotal(it: InvoiceItem): number {
  const base         = it.unit_price * it.quantity;
  const afterDisc    = base * (1 - it.discount_pct / 100);
  const gst          = afterDisc * (it.gst_pct / 100);
  return Math.round((afterDisc + gst) * 100) / 100;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { profile, activeClinicId, loading: profileLoading } = useClinic();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [activeTab, setTab]     = useState<"all" | InvoiceStatus>("all");
  const [search, setSearch]     = useState("");
  const [dateFrom, setDateFrom] = useState(firstDOM());
  const [dateTo,   setDateTo]   = useState(todayStr());

  // Stats
  const [todayRev,     setTodayRev]     = useState(0);
  const [mtdRev,       setMtdRev]       = useState(0);
  const [outstanding,  setOutstanding]  = useState(0);
  const [commOwed,     setCommOwed]     = useState(0);

  // Modals
  const [detailInv,      setDetailInv]      = useState<Invoice | null>(null);
  const [detailPayments, setDetailPayments] = useState<InvoicePayment[]>([]);
  const [detailItems,    setDetailItems]    = useState<InvoiceItem[]>([]);
  const [loadingDetail,  setLoadingDetail]  = useState(false);
  const [payInv,         setPayInv]         = useState<Invoice | null>(null);
  const [showNew,        setShowNew]        = useState(false);

  // ── Fetch ──

  const fetchInvoices = useCallback(async () => {
    if (!activeClinicId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pending_invoices")
        .select("*")
        .eq("clinic_id", activeClinicId)
        .gte("created_at", dateFrom + "T00:00:00")
        .lte("created_at", dateTo   + "T23:59:59")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const now = new Date();
      const processed: Invoice[] = (data ?? []).map((r: any) => ({
        ...r,
        discount_amount: r.discount_amount ?? 0,
        total_amount:    r.total_amount    ?? (r.amount + (r.tax_amount ?? 0)),
        gst_pct:         r.gst_pct         ?? 18,
        invoice_type:    r.invoice_type    ?? "service",
        status: (r.status === "pending" && r.due_date && new Date(r.due_date) < now)
          ? "overdue"
          : r.status as InvoiceStatus,
      }));

      setInvoices(processed);

      const t = todayStr();
      setTodayRev(processed.filter(i => i.status === "paid" && i.paid_at?.startsWith(t))
        .reduce((s, i) => s + i.total_amount, 0));
      setMtdRev(processed.filter(i => i.status === "paid")
        .reduce((s, i) => s + i.total_amount, 0));
      setOutstanding(processed.filter(i => ["pending","partial","overdue"].includes(i.status))
        .reduce((s, i) => s + i.total_amount, 0));
    } catch { toast.error("Failed to load invoices"); }
    finally  { setLoading(false); }
  }, [activeClinicId, dateFrom, dateTo]);

  const fetchCommOwed = useCallback(async () => {
    if (!activeClinicId) return;
    const { data } = await supabase
      .from("staff_commissions")
      .select("commission_amount")
      .eq("clinic_id", activeClinicId)
      .eq("status", "pending");
    if (data) setCommOwed(data.reduce((s, r) => s + (r.commission_amount ?? 0), 0));
  }, [activeClinicId]);

  useEffect(() => {
    if (!profileLoading && activeClinicId) {
      fetchInvoices();
      fetchCommOwed();
    }
  }, [fetchInvoices, fetchCommOwed, profileLoading, activeClinicId]);

  // ── Filtered list ──

  const filtered = useMemo(() => invoices.filter(inv => {
    if (activeTab !== "all" && inv.status !== activeTab) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        inv.invoice_number?.toLowerCase().includes(q) ||
        inv.patient_name?.toLowerCase().includes(q)   ||
        inv.service_name?.toLowerCase().includes(q)
      );
    }
    return true;
  }), [invoices, activeTab, search]);

  // ── Open detail ──

  const openDetail = async (inv: Invoice) => {
    setDetailInv(inv);
    setLoadingDetail(true);
    const [{ data: pmts }, { data: items }] = await Promise.all([
      supabase.from("invoice_payments").select("*").eq("invoice_id", inv.id).order("created_at"),
      supabase.from("invoice_line_items").select("*").eq("invoice_id", inv.id).order("created_at"),
    ]);
    setDetailPayments(pmts ?? []);
    setDetailItems(items ?? []);
    setLoadingDetail(false);
  };

  // ── Void ──

  const voidInvoice = async (inv: Invoice, reason: string) => {
    const { error } = await supabase.from("pending_invoices").update({
      status: "void", void_reason: reason, updated_at: new Date().toISOString(),
    }).eq("id", inv.id);
    if (error) { toast.error("Failed to void"); return; }
    toast.success("Invoice voided");
    await logAction({ action: "void_invoice", targetId: inv.id, targetName: inv.invoice_number });
    fetchInvoices();
    setDetailInv(null);
  };

  const isAdmin = ["superadmin","chain_admin","clinic_admin"].includes(profile?.role ?? "");

  // ── Export ──

  const handleExport = () => {
    const hdrs = ["Invoice #","Date","Patient","Service","Subtotal","GST","Discount","Total","Status","Mode","Ref"];
    const rows = filtered.map(i => [
      i.invoice_number, fmtDate(i.created_at), i.patient_name ?? "Walk-in",
      i.service_name, i.amount, i.tax_amount, i.discount_amount,
      i.total_amount, i.status, i.payment_mode ?? "", i.payment_ref ?? "",
    ]);
    const csv  = [hdrs, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const url  = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a    = document.createElement("a");
    a.href = url; a.download = `invoices-${todayStr()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ──

  return (
    <div className="min-h-full" style={{ background: "var(--background)" }}>
      <TopBar />
      <div className="px-6 py-6 max-w-[1440px] mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
              Billing & Invoices
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
            style={{ background: "var(--gold)", color: "#fff" }}
          >
            <Plus size={16} /> New Invoice
          </button>
        </div>

        {/* ── Stats row ── */}
        <StatsRow todayRev={todayRev} mtdRev={mtdRev} outstanding={outstanding} commOwed={commOwed} />

        {/* ── Invoice panel ── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>

          {/* Tabs */}
          <div className="flex items-center gap-0.5 px-4 pt-4 border-b overflow-x-auto" style={{ borderColor: "var(--border)" }}>
            {TABS.map(tab => {
              const count = tab.key === "all" ? invoices.length : invoices.filter(i => i.status === tab.key).length;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setTab(tab.key)}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-all"
                  style={{
                    background:   active ? "rgba(197,160,89,0.1)" : "transparent",
                    color:        active ? "var(--gold)"          : "var(--text-muted)",
                    borderBottom: active ? "2px solid var(--gold)" : "2px solid transparent",
                  }}
                >
                  {tab.label}
                  {count > 0 && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                      style={{
                        background: active ? "var(--gold)" : "rgba(197,160,89,0.12)",
                        color:      active ? "#fff"        : "var(--gold)",
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Invoice #, patient, service…"
                className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              />
              <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              />
            </div>
            <button
              onClick={fetchInvoices}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
              style={{ background: "rgba(197,160,89,0.08)", color: "var(--gold)", border: "1px solid rgba(197,160,89,0.2)" }}
            >
              <RefreshCw size={12} /> Refresh
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
              style={{ background: "rgba(197,160,89,0.08)", color: "var(--gold)", border: "1px solid rgba(197,160,89,0.2)" }}
            >
              <Download size={12} /> Export CSV
            </button>
          </div>

          {/* Table */}
          <InvoiceTable
            invoices={filtered}
            loading={loading}
            onView={openDetail}
            onPay={setPayInv}
          />
        </div>
      </div>

      {/* ── Modals ── */}
      {detailInv && (
        <InvoiceDetailModal
          invoice={detailInv}
          payments={detailPayments}
          items={detailItems}
          loading={loadingDetail}
          isAdmin={isAdmin}
          onClose={() => setDetailInv(null)}
          onVoid={voidInvoice}
          onPay={inv => { setDetailInv(null); setPayInv(inv); }}
        />
      )}
      {payInv && (
        <RecordPaymentDrawer
          invoice={payInv}
          clinicId={activeClinicId!}
          onClose={() => setPayInv(null)}
          onSuccess={() => { setPayInv(null); fetchInvoices(); toast.success("Payment recorded!"); }}
        />
      )}
      {showNew && (
        <NewInvoiceDrawer
          clinicId={activeClinicId!}
          onClose={() => setShowNew(false)}
          onSuccess={() => { setShowNew(false); fetchInvoices(); }}
        />
      )}
    </div>
  );
}

// ── Stats Row ─────────────────────────────────────────────────────────────────

function StatsRow({ todayRev, mtdRev, outstanding, commOwed }: {
  todayRev: number; mtdRev: number; outstanding: number; commOwed: number;
}) {
  const cards = [
    { label: "Today's Revenue",  value: fmt(todayRev),    Icon: IndianRupee,  color: "#4A8A4A", bg: "rgba(74,138,74,0.08)",    border: "rgba(74,138,74,0.2)"  },
    { label: "MTD Revenue",      value: fmt(mtdRev),      Icon: ArrowUpRight, color: "var(--gold)", bg: "rgba(197,160,89,0.08)", border: "rgba(197,160,89,0.2)" },
    { label: "Outstanding",      value: fmt(outstanding), Icon: Clock,        color: "#D4A017", bg: "#FFF8E8",                  border: "rgba(212,160,23,0.2)" },
    { label: "Commissions Owed", value: fmt(commOwed),    Icon: BadgeCheck,   color: "#2A4A8A", bg: "rgba(42,74,138,0.08)",     border: "rgba(42,74,138,0.2)"  },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(c => (
        <div
          key={c.label}
          className="rounded-2xl p-5"
          style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{c.label}</p>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: c.bg, border: `1px solid ${c.border}` }}>
              <c.Icon size={16} style={{ color: c.color }} />
            </div>
          </div>
          <p className="text-2xl font-bold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Invoice Table ─────────────────────────────────────────────────────────────

function InvoiceTable({ invoices, loading, onView, onPay }: {
  invoices: Invoice[];
  loading:  boolean;
  onView:   (inv: Invoice) => void;
  onPay:    (inv: Invoice) => void;
}) {
  if (loading) {
    return (
      <div className="p-6 space-y-3 animate-pulse">
        {[1,2,3,4,5].map(n => (
          <div key={n} className="h-14 rounded-xl" style={{ background: "rgba(197,160,89,0.04)" }} />
        ))}
      </div>
    );
  }

  if (!invoices.length) {
    return (
      <div className="py-20 flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(197,160,89,0.06)", border: "1px solid rgba(197,160,89,0.15)" }}>
          <Receipt size={28} style={{ color: "rgba(197,160,89,0.4)" }} />
        </div>
        <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>No invoices found</p>
        <p className="text-xs" style={{ color: "rgba(197,160,89,0.4)" }}>Try adjusting the date range or filters</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {["Invoice #","Date","Patient / Service","Amount","GST","Total","Status",""].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {invoices.map(inv => {
            const cfg    = STATUS_CFG[inv.status];
            const PMIcon = inv.payment_mode ? PM_ICON[inv.payment_mode] : null;
            const canPay = ["pending","partial","overdue"].includes(inv.status);

            return (
              <tr
                key={inv.id}
                className="cursor-pointer transition-colors"
                style={{ borderBottom: "1px solid var(--border)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(197,160,89,0.025)")}
                onMouseLeave={e => (e.currentTarget.style.background = "")}
                onClick={() => onView(inv)}
              >
                {/* Invoice # */}
                <td className="px-4 py-3.5">
                  <span className="font-mono text-xs font-bold tracking-wide" style={{ color: "var(--gold)" }}>
                    {inv.invoice_number}
                  </span>
                </td>

                {/* Date */}
                <td className="px-4 py-3.5 text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                  {fmtDate(inv.created_at)}
                </td>

                {/* Patient / Service */}
                <td className="px-4 py-3.5">
                  <p className="font-medium" style={{ color: "var(--foreground)" }}>
                    {inv.patient_name ?? "Walk-in"}
                  </p>
                  <p className="text-xs truncate max-w-[200px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {inv.service_name}
                  </p>
                </td>

                {/* Subtotal */}
                <td className="px-4 py-3.5 text-right font-medium whitespace-nowrap" style={{ color: "var(--foreground)" }}>
                  {fmt(inv.amount ?? 0)}
                </td>

                {/* GST */}
                <td className="px-4 py-3.5 text-right text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                  {fmt(inv.tax_amount ?? 0)}
                  <span className="ml-1 opacity-60">({inv.gst_pct ?? 18}%)</span>
                </td>

                {/* Total */}
                <td className="px-4 py-3.5 text-right font-bold whitespace-nowrap" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
                  {fmt(inv.total_amount ?? 0)}
                </td>

                {/* Status */}
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
                    {cfg.label}
                  </span>
                  {PMIcon && (
                    <span className="ml-2 inline-flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      <PMIcon size={11} />
                      <span className="capitalize">{inv.payment_mode?.replace("_"," ")}</span>
                    </span>
                  )}
                </td>

                {/* Actions */}
                <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <button onClick={() => onView(inv)}
                      className="p-1.5 rounded-lg transition-colors hover:bg-black/5"
                      style={{ color: "var(--text-muted)" }} title="View">
                      <Eye size={14} />
                    </button>
                    {canPay && (
                      <button onClick={() => onPay(inv)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                        style={{ background: "rgba(74,138,74,0.1)", color: "#2A5A2A", border: "1px solid rgba(74,138,74,0.25)" }}>
                        Pay
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Summary footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: "var(--border)" }}>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Showing {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}
        </p>
        <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
          Total: <span style={{ color: "var(--gold)", fontFamily: "Georgia, serif" }}>
            {fmt(invoices.reduce((s, i) => s + i.total_amount, 0))}
          </span>
        </p>
      </div>
    </div>
  );
}

// ── Invoice Detail Modal ──────────────────────────────────────────────────────

function InvoiceDetailModal({ invoice: inv, payments, items, loading, isAdmin, onClose, onVoid, onPay }: {
  invoice:  Invoice;
  payments: InvoicePayment[];
  items:    InvoiceItem[];
  loading:  boolean;
  isAdmin:  boolean;
  onClose:  () => void;
  onVoid:   (inv: Invoice, reason: string) => void;
  onPay:    (inv: Invoice) => void;
}) {
  const [voidMode,   setVoidMode]   = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const cfg    = STATUS_CFG[inv.status];
  const canPay = ["pending","partial","overdue"].includes(inv.status);

  const handlePrint = () => {
    const el = document.getElementById("inv-print-body");
    if (!el) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>${inv.invoice_number}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Georgia, serif; padding: 48px; color: #1a1a1a; max-width: 680px; margin: auto; }
        h1  { font-size: 22px; color: #C5A059; letter-spacing: 0.1em; margin: 0 0 4px; }
        .sub{ font-size: 12px; color: #888; }
        .section-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; margin-bottom: 4px; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 20px 0; }
        .box  { background: #faf7f2; border: 1px solid #e8dfc8; border-radius: 8px; padding: 12px 16px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th    { background: #f5f0e8; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
        td    { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
        .totals { background: #faf7f2; border: 1px solid rgba(197,160,89,0.25); border-radius: 8px; padding: 16px; }
        .total-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 13px; }
        .grand { font-size: 18px; font-weight: bold; color: #C5A059; border-top: 1px solid #C5A059; padding-top: 8px; margin-top: 4px; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 600; border: 1px solid; }
        @media print { button { display: none; } }
      </style></head><body>
      <h1>AESTHETICA</h1>
      <div class="sub">Clinic Suite — Tax Invoice</div>
      ${el.innerHTML}
      </body></html>`);
    w.document.close();
    w.print();
  };

  const paidAmount = payments.reduce((s, p) => s + p.amount, 0);
  const balance    = (inv.total_amount ?? 0) - paidAmount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col rounded-2xl shadow-2xl"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(197,160,89,0.1)", border: "1px solid rgba(197,160,89,0.2)" }}>
              <Receipt size={17} style={{ color: "var(--gold)" }} />
            </div>
            <div>
              <p className="font-mono font-bold" style={{ color: "var(--gold)" }}>{inv.invoice_number}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtDate(inv.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
              {cfg.label}
            </span>
            <button onClick={handlePrint}
              className="p-2 rounded-lg transition-colors hover:bg-black/5"
              style={{ color: "var(--text-muted)" }} title="Print">
              <Printer size={16} />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg transition-colors hover:bg-black/5"
              style={{ color: "var(--text-muted)" }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin" style={{ color: "var(--gold)" }} />
            </div>
          ) : (
            <div id="inv-print-body" className="space-y-5">
              {/* Patient + Provider */}
              <div className="grid grid-cols-2 gap-3">
                <InfoBox label="Patient">
                  <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{inv.patient_name ?? "Walk-in"}</p>
                </InfoBox>
                {inv.provider_name && (
                  <InfoBox label="Provider">
                    <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{inv.provider_name}</p>
                  </InfoBox>
                )}
              </div>

              {/* Line items OR service summary */}
              {items.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                    Line Items
                  </p>
                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: "rgba(197,160,89,0.06)" }}>
                          {["Description","Qty","Unit","Disc","GST","Total"].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                              style={{ color: "var(--text-muted)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it, i) => (
                          <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                            <td className="px-3 py-2.5 font-medium" style={{ color: "var(--foreground)" }}>{it.description}</td>
                            <td className="px-3 py-2.5 text-center">{it.quantity}</td>
                            <td className="px-3 py-2.5 text-right">{fmt(it.unit_price)}</td>
                            <td className="px-3 py-2.5 text-right text-xs">{it.discount_pct}%</td>
                            <td className="px-3 py-2.5 text-right text-xs">{it.gst_pct}%</td>
                            <td className="px-3 py-2.5 text-right font-semibold" style={{ color: "var(--gold)" }}>{fmt(it.line_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <InfoBox label="Service">
                  <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{inv.service_name}</p>
                  <p className="text-xs capitalize mt-0.5" style={{ color: "var(--text-muted)" }}>{inv.invoice_type}</p>
                </InfoBox>
              )}

              {/* Amount breakdown */}
              <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(197,160,89,0.04)", border: "1px solid rgba(197,160,89,0.15)" }}>
                <ARow label="Subtotal"                 value={fmt(inv.amount ?? 0)} />
                {(inv.discount_amount ?? 0) > 0 && (
                  <ARow label="Discount"               value={`- ${fmt(inv.discount_amount)}`} color="#4A8A4A" />
                )}
                <ARow label={`GST (${inv.gst_pct ?? 18}%)`} value={fmt(inv.tax_amount ?? 0)} />
                <div className="border-t pt-2" style={{ borderColor: "rgba(197,160,89,0.2)" }}>
                  <ARow label="Grand Total" value={fmt(inv.total_amount ?? 0)} bold gold />
                </div>
                {paidAmount > 0 && (
                  <>
                    <ARow label="Paid" value={fmt(paidAmount)} color="#4A8A4A" />
                    {balance > 0 && <ARow label="Balance Due" value={fmt(balance)} color="#D4A017" bold />}
                  </>
                )}
              </div>

              {/* Payment history */}
              {payments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                    Payment History
                  </p>
                  <div className="space-y-2">
                    {payments.map(p => {
                      const PMIco = PM_ICON[p.payment_mode];
                      return (
                        <div key={p.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                          style={{ background: "rgba(74,138,74,0.06)", border: "1px solid rgba(74,138,74,0.15)" }}>
                          <div className="flex items-center gap-2">
                            <PMIco size={14} style={{ color: "#4A8A4A" }} />
                            <span className="text-sm font-medium capitalize" style={{ color: "var(--foreground)" }}>
                              {p.payment_mode.replace("_"," ")}
                            </span>
                            {p.transaction_ref && (
                              <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                                style={{ background: "rgba(74,138,74,0.1)", color: "#2A5A2A" }}>
                                #{p.transaction_ref}
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold" style={{ color: "#2A5A2A" }}>{fmt(p.amount)}</p>
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtDate(p.created_at)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Notes */}
              {inv.notes && (
                <InfoBox label="Notes">
                  <p className="text-sm" style={{ color: "var(--foreground)" }}>{inv.notes}</p>
                </InfoBox>
              )}

              {/* Void info */}
              {inv.status === "void" && inv.void_reason && (
                <div className="px-4 py-3 rounded-xl" style={{ background: "#FEF2F2", border: "1px solid #B43C3C" }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#B43C3C" }}>Void Reason</p>
                  <p className="text-sm" style={{ color: "#8A1A1A" }}>{inv.void_reason}</p>
                </div>
              )}

              {/* Void input */}
              {voidMode && (
                <div className="p-4 rounded-xl space-y-3" style={{ background: "#FEF2F2", border: "1px solid #B43C3C" }}>
                  <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "#B43C3C" }}>
                    <AlertTriangle size={14} /> Confirm void invoice
                  </p>
                  <textarea
                    value={voidReason}
                    onChange={e => setVoidReason(e.target.value)}
                    placeholder="Reason for voiding this invoice…"
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg text-sm resize-none outline-none"
                    style={{ background: "#fff", border: "1px solid #B43C3C", color: "#1a1a1a" }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { if (voidReason.trim()) onVoid(inv, voidReason); }}
                      disabled={!voidReason.trim()}
                      className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                      style={{ background: "#B43C3C", color: "#fff" }}>
                      Confirm Void
                    </button>
                    <button onClick={() => setVoidMode(false)}
                      className="px-4 py-2 rounded-lg text-sm font-semibold"
                      style={{ background: "rgba(0,0,0,0.06)", color: "var(--foreground)" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="flex items-center justify-between px-6 py-4 border-t flex-shrink-0"
            style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
            <div className="flex gap-2">
              {isAdmin && inv.status !== "void" && inv.status !== "paid" && !voidMode && (
                <button
                  onClick={() => setVoidMode(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: "rgba(180,60,60,0.08)", color: "#B43C3C", border: "1px solid rgba(180,60,60,0.2)" }}>
                  <Trash2 size={12} /> Void Invoice
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: "var(--input-bg)", color: "var(--foreground)", border: "1px solid var(--border)" }}>
                Close
              </button>
              {canPay && (
                <button
                  onClick={() => onPay(inv)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90"
                  style={{ background: "var(--gold)", color: "#fff" }}>
                  <CreditCard size={14} /> Record Payment
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Record Payment Drawer ─────────────────────────────────────────────────────

function RecordPaymentDrawer({ invoice: inv, clinicId, onClose, onSuccess }: {
  invoice:   Invoice;
  clinicId:  string;
  onClose:   () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState(
    ((inv.total_amount ?? inv.amount ?? 0) - 0).toFixed(2)
  );
  const [mode,   setMode]   = useState<PaymentMode>("cash");
  const [ref,    setRef]    = useState("");
  const [notes,  setNotes]  = useState("");
  const [saving, setSaving] = useState(false);

  const due = inv.total_amount ?? inv.amount ?? 0;

  const handleSave = async () => {
    const pay = parseFloat(amount);
    if (!pay || pay <= 0) { toast.error("Enter a valid amount"); return; }
    setSaving(true);
    try {
      const { error: pe } = await supabase.from("invoice_payments").insert({
        invoice_id: inv.id, clinic_id: clinicId,
        amount: pay, payment_mode: mode,
        transaction_ref: ref   || null,
        notes:           notes || null,
      });
      if (pe) throw pe;

      const newStatus: InvoiceStatus = pay >= due ? "paid" : "partial";
      const { error: ie } = await supabase.from("pending_invoices").update({
        status:       newStatus,
        payment_mode: mode,
        payment_ref:  ref || null,
        paid_at:      newStatus === "paid" ? new Date().toISOString() : null,
        updated_at:   new Date().toISOString(),
      }).eq("id", inv.id);
      if (ie) throw ie;

      await logAction({
        action:     "record_payment",
        targetId:   inv.id,
        targetName: inv.invoice_number,
        metadata:   { amount: pay, mode, status: newStatus },
      });
      onSuccess();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to record payment");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl shadow-2xl"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <p className="font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
              Record Payment
            </p>
            <p className="text-xs font-mono mt-0.5" style={{ color: "var(--gold)" }}>{inv.invoice_number}</p>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X size={16} /></button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Invoice summary chip */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl"
            style={{ background: "rgba(197,160,89,0.06)", border: "1px solid rgba(197,160,89,0.2)" }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                {inv.patient_name ?? "Walk-in"}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{inv.service_name}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold" style={{ color: "var(--gold)", fontFamily: "Georgia, serif" }}>
                {fmt(due)}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>due</p>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: "var(--text-muted)" }}>Payment Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: "var(--gold)" }}>₹</span>
              <input
                type="number" value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full pl-7 pr-3 py-3 rounded-xl text-base outline-none font-semibold"
                style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              />
            </div>
            {parseFloat(amount) > 0 && parseFloat(amount) < due && (
              <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: "#D4A017" }}>
                <AlertTriangle size={11} />
                Partial payment — balance {fmt(due - parseFloat(amount))} will remain
              </p>
            )}
          </div>

          {/* Payment mode */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: "var(--text-muted)" }}>Payment Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_MODES.map(pm => (
                <button key={pm.value} onClick={() => setMode(pm.value)}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: mode === pm.value ? "var(--gold)" : "var(--input-bg)",
                    color:      mode === pm.value ? "#fff"        : "var(--text-muted)",
                    border:     mode === pm.value ? "1px solid var(--gold)" : "1px solid var(--border)",
                  }}>
                  <pm.Icon size={18} />
                  {pm.label}
                </button>
              ))}
            </div>
          </div>

          {/* Transaction ref */}
          {["card","upi","bank_transfer"].includes(mode) && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: "var(--text-muted)" }}>
                {mode === "upi" ? "UPI Transaction ID" : mode === "card" ? "Card Last 4 / Auth Code" : "Transaction Reference"}
              </label>
              <input value={ref} onChange={e => setRef(e.target.value)}
                placeholder={mode === "upi" ? "e.g. 32045687XXXX" : "Optional reference"}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: "var(--text-muted)" }}>Notes (optional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Partial — balance on next visit"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold"
            style={{ background: "var(--input-bg)", color: "var(--foreground)", border: "1px solid var(--border)" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90"
            style={{ background: "var(--gold)", color: "#fff" }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? "Saving…" : "Confirm Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── New Invoice Drawer ────────────────────────────────────────────────────────

function NewInvoiceDrawer({ clinicId, onClose, onSuccess }: {
  clinicId:  string;
  onClose:   () => void;
  onSuccess: () => void;
}) {
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [patSearch, setPatSearch]     = useState("");
  const [showPats,  setShowPats]      = useState(false);
  const [selPat,    setSelPat]        = useState<PatientOption | null>(null);
  const [items,     setItems]         = useState<InvoiceItem[]>([
    { description: "", service_id: null, quantity: 1, unit_price: 0, discount_pct: 0, gst_pct: 18, line_total: 0 },
  ]);
  const [notes,     setNotes]         = useState("");
  const [dueDate,   setDueDate]       = useState("");
  const [saving,    setSaving]        = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: pats }, { data: svcs }] = await Promise.all([
        supabase.from("patients").select("id, full_name, phone").eq("clinic_id", clinicId).limit(200),
        supabase.from("services").select("id, name, selling_price, category").eq("clinic_id", clinicId).eq("is_active", true),
      ]);
      setPatients(pats ?? []);
      setServices(svcs ?? []);
    })();
  }, [clinicId]);

  const filteredPats = patSearch.length >= 1
    ? patients.filter(p => p.full_name.toLowerCase().includes(patSearch.toLowerCase()))
    : [];

  const updateItem = (idx: number, field: keyof InvoiceItem, val: unknown) => {
    const arr = [...items];
    (arr[idx] as any)[field] = val;
    if (field === "service_id" && val) {
      const svc = services.find(s => s.id === val);
      if (svc) { arr[idx].description = svc.name; arr[idx].unit_price = svc.selling_price; }
    }
    arr[idx].line_total = calcLineTotal(arr[idx]);
    setItems(arr);
  };

  const addItem    = () => setItems([...items, { description: "", service_id: null, quantity: 1, unit_price: 0, discount_pct: 0, gst_pct: 18, line_total: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const subtotal   = items.reduce((s, it) => s + it.unit_price * it.quantity * (1 - it.discount_pct / 100), 0);
  const totalGst   = items.reduce((s, it) => { const b = it.unit_price * it.quantity * (1 - it.discount_pct / 100); return s + b * (it.gst_pct / 100); }, 0);
  const totalDisc  = items.reduce((s, it) => s + it.unit_price * it.quantity * (it.discount_pct / 100), 0);
  const grandTotal = items.reduce((s, it) => s + it.line_total, 0);

  const handleSave = async () => {
    if (!items.some(it => it.description.trim() && it.unit_price > 0)) {
      toast.error("Add at least one line item with a description and price");
      return;
    }
    setSaving(true);
    try {
      const svcNames = items.filter(it => it.description).map(it => it.description).join(", ");
      const { data: inv, error: ie } = await supabase.from("pending_invoices").insert({
        clinic_id:       clinicId,
        patient_id:      selPat?.id             ?? null,
        patient_name:    selPat?.full_name       ?? "Walk-in",
        service_name:    svcNames,
        amount:          Math.round(subtotal   * 100) / 100,
        tax_amount:      Math.round(totalGst   * 100) / 100,
        discount_amount: Math.round(totalDisc  * 100) / 100,
        total_amount:    Math.round(grandTotal * 100) / 100,
        gst_pct:         18,
        status:          "pending",
        invoice_type:    "ad_hoc",
        notes:           notes   || null,
        due_date:        dueDate || null,
      }).select().single();
      if (ie) throw ie;

      if (inv) {
        const lineRows = items
          .filter(it => it.description.trim())
          .map(it => ({
            invoice_id:   inv.id,
            clinic_id:    clinicId,
            service_id:   it.service_id,
            description:  it.description,
            quantity:     it.quantity,
            unit_price:   it.unit_price,
            discount_pct: it.discount_pct,
            gst_pct:      it.gst_pct,
            line_total:   it.line_total,
          }));
        await supabase.from("invoice_line_items").insert(lineRows);
      }

      await logAction({ action: "create_invoice", targetId: inv?.id, targetName: svcNames });
      toast.success("Invoice created!");
      onSuccess();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create invoice");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-xl h-full flex flex-col"
        style={{ background: "var(--card-bg)", borderLeft: "1px solid var(--border)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(197,160,89,0.1)" }}>
              <Receipt size={16} style={{ color: "var(--gold)" }} />
            </div>
            <p className="font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
              New Invoice
            </p>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Patient selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: "var(--text-muted)" }}>
              Patient <span className="normal-case font-normal">(optional — leave blank for walk-in)</span>
            </label>
            {selPat ? (
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                style={{ background: "rgba(197,160,89,0.06)", border: "1px solid rgba(197,160,89,0.2)" }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{selPat.full_name}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{selPat.phone ?? "No phone"}</p>
                </div>
                <button onClick={() => { setSelPat(null); setPatSearch(""); }} style={{ color: "var(--text-muted)" }}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input
                  value={patSearch}
                  onChange={e => { setPatSearch(e.target.value); setShowPats(true); }}
                  onFocus={() => setShowPats(true)}
                  placeholder="Search patient by name…"
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                />
                {showPats && filteredPats.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl shadow-xl max-h-44 overflow-y-auto"
                    style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
                    {filteredPats.slice(0, 8).map(p => (
                      <button key={p.id}
                        onClick={() => { setSelPat(p); setPatSearch(""); setShowPats(false); }}
                        className="w-full text-left px-3 py-2.5 text-sm transition-colors"
                        style={{ color: "var(--foreground)", borderBottom: "1px solid var(--border)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(197,160,89,0.06)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "")}>
                        <span className="font-medium">{p.full_name}</span>
                        {p.phone && <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>{p.phone}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Line Items
              </label>
              <button onClick={addItem}
                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)" }}>
                <Plus size={12} /> Add Line
              </button>
            </div>
            <div className="space-y-3">
              {items.map((it, i) => (
                <LineItemRow
                  key={i}
                  item={it}
                  services={services}
                  onChange={(field, val) => updateItem(i, field, val)}
                  onRemove={() => removeItem(i)}
                  canRemove={items.length > 1}
                />
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="rounded-xl px-4 py-3 space-y-1.5"
            style={{ background: "rgba(197,160,89,0.04)", border: "1px solid rgba(197,160,89,0.15)" }}>
            <ARow label="Subtotal"                 value={fmt(subtotal)}  />
            {totalDisc > 0 && <ARow label="Discount" value={`- ${fmt(totalDisc)}`} color="#4A8A4A" />}
            <ARow label="GST"                      value={fmt(totalGst)}  />
            <div className="border-t pt-1.5" style={{ borderColor: "rgba(197,160,89,0.2)" }}>
              <ARow label="Total"                  value={fmt(grandTotal)} bold gold />
            </div>
          </div>

          {/* Due date */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: "var(--text-muted)" }}>Due Date (optional)</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              min={todayStr()}
              className="px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: "var(--text-muted)" }}>Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Internal notes about this invoice…"
              rows={2}
              className="w-full px-3 py-2 rounded-xl text-sm resize-none outline-none"
              style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t flex-shrink-0" style={{ borderColor: "var(--border)" }}>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold"
            style={{ background: "var(--input-bg)", color: "var(--foreground)", border: "1px solid var(--border)" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90"
            style={{ background: "var(--gold)", color: "#fff" }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            {saving ? "Creating…" : "Create Invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Line Item Row ─────────────────────────────────────────────────────────────

function LineItemRow({ item, services, onChange, onRemove, canRemove }: {
  item:      InvoiceItem;
  services:  ServiceOption[];
  onChange:  (field: keyof InvoiceItem, val: unknown) => void;
  onRemove:  () => void;
  canRemove: boolean;
}) {
  return (
    <div className="rounded-xl p-3 space-y-2.5" style={{ background: "var(--input-bg)", border: "1px solid var(--border)" }}>
      {/* Service picker */}
      <div className="flex gap-2">
        <select
          value={item.service_id ?? ""}
          onChange={e => onChange("service_id", e.target.value || null)}
          className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: "var(--card-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <option value="">Custom / Ad-hoc description</option>
          {services.map(s => (
            <option key={s.id} value={s.id}>{s.name} — ₹{s.selling_price}</option>
          ))}
        </select>
        {canRemove && (
          <button onClick={onRemove} className="p-2 rounded-lg flex-shrink-0"
            style={{ color: "#B43C3C" }}><X size={14} /></button>
        )}
      </div>

      {/* Description */}
      <input
        value={item.description}
        onChange={e => onChange("description", e.target.value)}
        placeholder="Description (required)"
        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }}
      />

      {/* Qty / Price / Disc / GST */}
      <div className="grid grid-cols-4 gap-2">
        <NumField label="Qty"      value={item.quantity}     min={1}   onChange={v => onChange("quantity",     parseInt(v) || 1)}  />
        <NumField label="Price ₹"  value={item.unit_price}   min={0}   onChange={v => onChange("unit_price",   parseFloat(v) || 0)} />
        <NumField label="Disc %"   value={item.discount_pct} min={0} max={100} onChange={v => onChange("discount_pct", parseFloat(v) || 0)} />
        <div>
          <label className="text-xs" style={{ color: "var(--text-muted)" }}>GST %</label>
          <select value={item.gst_pct} onChange={e => onChange("gst_pct", parseFloat(e.target.value))}
            className="w-full px-2 py-1.5 rounded-lg text-sm outline-none mt-0.5"
            style={{ background: "var(--card-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
            {GST_OPTIONS.map(g => <option key={g} value={g}>{g}%</option>)}
          </select>
        </div>
      </div>

      {/* Line total */}
      <div className="flex justify-end">
        <span className="text-sm font-bold" style={{ color: "var(--gold)", fontFamily: "Georgia, serif" }}>
          {fmt(item.line_total)}
        </span>
      </div>
    </div>
  );
}

// ── Shared mini-components ────────────────────────────────────────────────────

function InfoBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: "rgba(197,160,89,0.04)", border: "1px solid rgba(197,160,89,0.12)" }}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      {children}
    </div>
  );
}

function ARow({ label, value, bold, gold, color }: {
  label: string; value: string; bold?: boolean; gold?: boolean; color?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p
        className={bold ? "text-base font-bold" : "text-sm font-semibold"}
        style={{ color: gold ? "var(--gold)" : color ?? "var(--foreground)", fontFamily: bold ? "Georgia, serif" : undefined }}
      >
        {value}
      </p>
    </div>
  );
}

function NumField({ label, value, min, max, onChange }: {
  label: string; value: number; min?: number; max?: number; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</label>
      <input type="number" value={value} min={min} max={max}
        onChange={e => onChange(e.target.value)}
        className="w-full px-2 py-1.5 rounded-lg text-sm outline-none mt-0.5"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }}
      />
    </div>
  );
}
