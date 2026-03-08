"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Receipt, Plus, Search, Download, Printer,
  X, Check, Clock, Loader2, CreditCard,
  Banknote, Smartphone, Building2, Wallet, Shield,
  User, FileText, Eye, Trash2, RefreshCw,
  IndianRupee, BadgeCheck, ArrowUpRight, ChevronRight,
  AlertTriangle, Package, Sparkles, Gift,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { withSupabaseRetry } from "@/lib/withRetry";
import { useClinic } from "@/contexts/ClinicContext";
import { toast } from "sonner";
import { logAction } from "@/lib/audit";

// ── Types ─────────────────────────────────────────────────────────────────────

type InvoiceStatus = "pending" | "partial" | "paid" | "overdue" | "void";
type PaymentMode   = "cash" | "card" | "upi" | "bank_transfer" | "wallet" | "insurance" | "gift_card";

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
  id?:                  string;
  description:          string;
  service_id:           string | null;
  inventory_product_id?: string | null;
  item_type?:           "service" | "product";
  quantity:             number;
  unit_price:           number;
  discount_pct:         number;
  gst_pct:              number;
  line_total:           number;
}

interface ProductOption {
  id: string; name: string; selling_price: number | null;
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
  { value: "gift_card",     label: "Gift Card",     Icon: Gift       },
];

const PM_ICON: Record<PaymentMode, React.ElementType> = {
  cash: Banknote, card: CreditCard, upi: Smartphone,
  bank_transfer: Building2, wallet: Wallet, insurance: Shield, gift_card: Gift,
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
  const [showProforma,   setShowProforma]   = useState(false);
  const [showSellPkg,    setShowSellPkg]    = useState(false);
  const [showWalletTopup,  setShowWalletTopup]  = useState(false);
  const [showGiftCards,    setShowGiftCards]    = useState(false);

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
      // Persist overdue status for past-due invoices before loading
      supabase.rpc("mark_overdue_invoices").then(() => {
        fetchInvoices();
        fetchCommOwed();
      });
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

  // B8: void_invoice_safe reverses wallet payments before voiding
  const voidInvoice = async (inv: Invoice, reason: string) => {
    const { error } = await supabase.rpc("void_invoice_safe", {
      p_invoice_id: inv.id,
      p_actor_id:   profile?.id ?? null,
      p_reason:     reason || null,
    });
    if (error) { toast.error(error.message ?? "Failed to void"); return; }
    toast.success("Invoice voided");
    await logAction({ action: "void_invoice", targetId: inv.id, targetName: inv.invoice_number });
    fetchInvoices();
    setDetailInv(null);
  };

  // GAP-31: Issue credit note for a paid invoice
  const issueCreditNote = async (inv: Invoice) => {
    const { error } = await supabase.rpc("create_invoice_with_items", {
      p_clinic_id:       activeClinicId,
      p_patient_id:      inv.patient_id ?? null,
      p_patient_name:    inv.patient_name,
      p_provider_id:     null,
      p_provider_name:   null,
      p_invoice_type:    "credit_note",
      p_line_items:      [{ description: `Credit note for ${inv.invoice_number}`, quantity: 1, unit_price: -(inv.total_amount ?? 0), discount_pct: 0, gst_pct: 0 }],
      p_discount_amount: 0,
      p_gst_pct:         0,
    });
    if (error) { toast.error("Failed to issue credit note"); return; }
    toast.success("Credit note issued");
    await logAction({ action: "issue_credit_note", targetId: inv.id, targetName: inv.invoice_number });
    fetchInvoices();
    setPanelInv(null);
  };

  const convertProforma = async (inv: Invoice) => {
    const { error } = await supabase.from("pending_invoices").update({
      invoice_type: "ad_hoc", updated_at: new Date().toISOString(),
    }).eq("id", inv.id);
    if (error) { toast.error("Failed to convert"); return; }
    toast.success("Proforma converted to invoice");
    await logAction({ action: "convert_proforma", targetId: inv.id, targetName: inv.invoice_number });
    fetchInvoices();
    setPanelInv(null);
  };

  const isAdmin      = ["superadmin","chain_admin","clinic_admin"].includes(profile?.role ?? "");
  const isCounsellor = profile?.role === "counsellor"; // B3: counsellors cannot create/pay invoices

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

  // P1: GSTR-1 monthly summary export
  const handleGstrExport = async () => {
    if (!activeClinicId) return;
    // Fetch paid invoices with line items for the filtered period
    const from = new Date(); from.setDate(1); from.setHours(0,0,0,0);
    const { data: clinicRow } = await supabase.from("clinics").select("name, gst_number").eq("id", activeClinicId).maybeSingle();
    const { data: invData } = await supabase.from("pending_invoices")
      .select("id, invoice_number, patient_name, total_amount, gst_pct, created_at, paid_at")
      .eq("clinic_id", activeClinicId).eq("status", "paid")
      .gte("paid_at", from.toISOString()).order("paid_at");

    // Group by GST rate
    const grouped: Record<number, { count: number; taxable: number; cgst: number; sgst: number }> = {};
    (invData ?? []).forEach((inv: any) => {
      const rate = inv.gst_pct ?? 0;
      const taxable = (inv.total_amount ?? 0) / (1 + rate / 100);
      const tax = inv.total_amount - taxable;
      if (!grouped[rate]) grouped[rate] = { count: 0, taxable: 0, cgst: 0, sgst: 0 };
      grouped[rate].count++;
      grouped[rate].taxable += taxable;
      grouped[rate].cgst    += tax / 2;
      grouped[rate].sgst    += tax / 2;
    });

    const clinicName = (clinicRow as any)?.name ?? "Clinic";
    const gstin      = (clinicRow as any)?.gst_number ?? "";
    const period     = from.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    const hdrs = ["Clinic", "GSTIN", "Period", "GST Rate %", "No. of Invoices", "Taxable Amount", "CGST", "SGST", "Total Tax"];
    const rows = Object.entries(grouped).map(([rate, vals]) => [
      clinicName, gstin, period, rate, vals.count,
      vals.taxable.toFixed(2), vals.cgst.toFixed(2), vals.sgst.toFixed(2),
      (vals.cgst + vals.sgst).toFixed(2),
    ]);
    const csv = [hdrs, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a   = document.createElement("a"); a.href = url;
    a.download = `GSTR1-${clinicName.replace(/\s+/g,"-")}-${period.replace(/\s+/g,"-")}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // B8: 2-panel layout — selected invoice for right panel
  const [panelInv, setPanelInv] = useState<Invoice | null>(null);

  // ── Render ──

  return (
    <div className="min-h-full" style={{ background: "var(--background)" }}>

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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowWalletTopup(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
              style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)", border: "1px solid rgba(197,160,89,0.3)" }}
            >
              <Wallet size={16} /> Top Up Wallet
            </button>
            <button
              onClick={() => setShowGiftCards(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
              style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)", border: "1px solid rgba(197,160,89,0.3)" }}
            >
              <Gift size={16} /> Gift Cards
            </button>
            {/* B3: hide invoice creation buttons for counsellors */}
            {!isCounsellor && (
              <>
                <button
                  onClick={() => setShowSellPkg(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                  style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)", border: "1px solid rgba(197,160,89,0.3)" }}
                >
                  <Package size={16} /> Sell Package
                </button>
                <button
                  onClick={() => setShowProforma(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                  style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)", border: "1px solid rgba(197,160,89,0.3)" }}
                >
                  <FileText size={16} /> New Proforma
                </button>
                <button
                  onClick={() => setShowNew(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                  style={{ background: "var(--gold)", color: "#fff" }}
                >
                  <Plus size={16} /> New Invoice
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Stats row ── */}
        <StatsRow todayRev={todayRev} mtdRev={mtdRev} outstanding={outstanding} commOwed={commOwed} />

        {/* ── B8: 2-panel layout ── */}
        <div style={{ display: "grid", gridTemplateColumns: panelInv ? "1fr 380px" : "1fr", gap: 20, alignItems: "start" }}>

        {/* ── Left: Invoice panel ── */}
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
            <button
              onClick={handleGstrExport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
              style={{ background: "rgba(37,99,235,0.08)", color: "#2563eb", border: "1px solid rgba(37,99,235,0.2)" }}
            >
              <FileText size={12} /> GSTR-1
            </button>
          </div>

          {/* Table */}
          <InvoiceTable
            invoices={filtered}
            loading={loading}
            onView={inv => { setPanelInv(inv); openDetail(inv); }}
            onPay={setPayInv}
          />
        </div>

        {/* ── Right: Smart Panel (B8) ── */}
        {panelInv && (
          <div style={{ position: "sticky", top: 80 }}>
            <BillingSmartPanel
              invoice={panelInv}
              payments={detailPayments}
              items={detailItems}
              loading={loadingDetail}
              isAdmin={isAdmin}
              todayRev={todayRev}
              outstanding={outstanding}
              onClose={() => setPanelInv(null)}
              onPay={() => setPayInv(panelInv)}
              onVoid={reason => { voidInvoice(panelInv, reason); setPanelInv(null); }}
              onFull={() => openDetail(panelInv)}
              onConvertProforma={() => convertProforma(panelInv)}
              onIssueCreditNote={() => issueCreditNote(panelInv)}
            />
          </div>
        )}
        </div>{/* end 2-panel grid */}
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
      {showProforma && (
        <NewInvoiceDrawer
          clinicId={activeClinicId!}
          isProforma
          onClose={() => setShowProforma(false)}
          onSuccess={() => { setShowProforma(false); fetchInvoices(); }}
        />
      )}
      {showSellPkg && activeClinicId && (
        <SellPackageDrawer
          clinicId={activeClinicId}
          onClose={() => setShowSellPkg(false)}
          onSuccess={() => { setShowSellPkg(false); fetchInvoices(); toast.success("Package sold — invoice created"); }}
        />
      )}
      {showWalletTopup && activeClinicId && (
        <WalletTopupModal
          clinicId={activeClinicId}
          onClose={() => setShowWalletTopup(false)}
          onSuccess={() => { setShowWalletTopup(false); toast.success("Wallet topped up!"); }}
        />
      )}
      {showGiftCards && activeClinicId && (
        <GiftCardsModal
          clinicId={activeClinicId}
          onClose={() => setShowGiftCards(false)}
        />
      )}
    </div>
  );
}

// ── B8: Billing Smart Panel ──────────────────────────────────────────────────

function BillingSmartPanel({
  invoice: inv, payments, items, loading, isAdmin, todayRev, outstanding,
  onClose, onPay, onVoid, onFull, onConvertProforma, onIssueCreditNote,
}: {
  invoice: Invoice; payments: InvoicePayment[]; items: InvoiceItem[];
  loading: boolean; isAdmin: boolean; todayRev: number; outstanding: number;
  onClose: () => void; onPay: () => void;
  onVoid: (reason: string) => void; onFull: () => void;
  onConvertProforma?: () => void;
  onIssueCreditNote?: () => void;
}) {
  const [showVoidInput, setShowVoidInput] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [converting, setConverting] = useState(false);

  const cfg         = STATUS_CFG_BILLING[inv.status];
  const isPaid      = inv.status === "paid";
  const isVoid      = inv.status === "void";
  const isProforma  = inv.invoice_type === "proforma";
  const paidSoFar = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "var(--card-bg)", border: "1px solid var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.08)" }}>
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)", background: "rgba(249,247,242,0.7)" }}>
        <div>
          <p className="text-xs font-mono font-semibold" style={{ color: "var(--gold)" }}>{inv.invoice_number}</p>
          <p className="font-semibold mt-0.5" style={{ fontFamily: "Georgia, serif", color: "var(--foreground)", fontSize: 15 }}>
            {inv.patient_name ?? "Walk-in"}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={onFull}
            style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--text-muted)", cursor: "pointer" }}
          >
            Full View
          </button>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={16} /></button>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
            <Loader2 size={20} style={{ color: "rgba(197,160,89,0.5)", animation: "spin 1s linear infinite" }} />
          </div>
        ) : (
          <>
            {/* Amount + Status */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 28, fontWeight: 700, fontFamily: "Georgia, serif", color: "var(--gold)", margin: 0 }}>
                  {fmt(inv.total_amount)}
                </p>
                {paidSoFar > 0 && paidSoFar < inv.total_amount && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
                    {fmt(paidSoFar)} paid · {fmt(inv.total_amount - paidSoFar)} remaining
                  </p>
                )}
              </div>
              <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 999, fontWeight: 700, background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>
                {cfg.label}
              </span>
            </div>

            {/* Service info */}
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(249,247,242,0.8)", border: "1px solid var(--border)" }}>
              <p style={{ fontSize: 13, fontFamily: "Georgia, serif", fontWeight: 600, margin: 0 }}>{inv.service_name}</p>
              {inv.provider_name && <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "3px 0 0" }}>Provider: {inv.provider_name}</p>}
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>{fmtDate(inv.created_at)}</p>
            </div>

            {/* Line items summary */}
            {items.length > 0 && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9C9584", marginBottom: 8 }}>Items</p>
                {items.map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: i < items.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
                    <span style={{ fontSize: 12, color: "var(--foreground)" }}>{item.description}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gold)" }}>{fmt(item.line_total)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* GST + Discount chips */}
            {(inv.gst_pct > 0 || inv.discount_amount > 0) && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {inv.discount_amount > 0 && (
                  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: "rgba(74,138,74,0.08)", color: "#4A8A4A", border: "1px solid rgba(74,138,74,0.2)" }}>
                    -{fmt(inv.discount_amount)} discount
                  </span>
                )}
                {inv.gst_pct > 0 && (
                  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: "rgba(42,74,138,0.07)", color: "#2A4A8A", border: "1px solid rgba(42,74,138,0.2)" }}>
                    GST {inv.gst_pct}% (+{fmt(inv.tax_amount)})
                  </span>
                )}
              </div>
            )}

            {/* Payment history */}
            {payments.length > 0 && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9C9584", marginBottom: 8 }}>Payments</p>
                {payments.map(p => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                    <div>
                      <span style={{ fontSize: 12, textTransform: "capitalize" }}>{p.payment_mode}</span>
                      {p.transaction_ref && <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>{p.transaction_ref}</span>}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#4A8A4A" }}>{fmt(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Smart suggestions strip */}
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(197,160,89,0.05)", border: "1px solid rgba(197,160,89,0.18)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9C9584", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                <Sparkles size={11} style={{ display: "inline", marginRight: 4 }} /> Smart Suggestions
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {!isPaid && !isVoid && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                    ✓ {fmt(inv.total_amount - paidSoFar)} remaining — collect via {inv.payment_mode ?? "any mode"}
                  </p>
                )}
                {inv.gst_pct === 0 && !isPaid && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                    ℹ Consider adding 18% GST for B2B client invoices
                  </p>
                )}
                {outstanding > 50000 && (
                  <p style={{ fontSize: 12, color: "#D4A017", margin: 0 }}>
                    ⚠ ₹{(outstanding/1000).toFixed(0)}K total outstanding across clinic — follow up needed
                  </p>
                )}
              </div>
            </div>

            {/* Action buttons */}
            {isProforma && onConvertProforma && (
              <button
                onClick={onConvertProforma}
                disabled={converting}
                style={{ width: "100%", padding: "11px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #059669, #047857)", color: "white", fontSize: 14, fontWeight: 600, fontFamily: "Georgia, serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <Receipt size={15} /> Convert to Invoice
              </button>
            )}
            {!isPaid && !isVoid && !isProforma && (
              <button
                onClick={onPay}
                style={{ width: "100%", padding: "11px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #C5A059, #A8853A)", color: "white", fontSize: 14, fontWeight: 600, fontFamily: "Georgia, serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 14px rgba(197,160,89,0.35)" }}
              >
                <IndianRupee size={15} /> Record Payment
              </button>
            )}
            {/* GAP-31: Issue credit note for paid invoices */}
            {isPaid && isAdmin && onIssueCreditNote && (
              <button
                onClick={onIssueCreditNote}
                style={{ width: "100%", padding: "8px 0", borderRadius: 10, border: "1px solid rgba(124,58,237,0.3)", background: "rgba(124,58,237,0.05)", color: "#7C3AED", fontSize: 13, cursor: "pointer", fontFamily: "Georgia, serif" }}
              >
                Issue Credit Note
              </button>
            )}

            {isAdmin && !isVoid && inv.status !== "paid" && (
              <>
                {!showVoidInput ? (
                  <button
                    onClick={() => setShowVoidInput(true)}
                    style={{ width: "100%", padding: "8px 0", borderRadius: 10, border: "1px solid rgba(180,60,60,0.3)", background: "rgba(180,60,60,0.05)", color: "#B43C3C", fontSize: 13, cursor: "pointer" }}
                  >
                    Void Invoice
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      value={voidReason}
                      onChange={e => setVoidReason(e.target.value)}
                      placeholder="Reason for voiding…"
                      style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--input-bg)", fontSize: 12, color: "var(--foreground)", outline: "none" }}
                    />
                    <button onClick={() => { onVoid(voidReason); setShowVoidInput(false); }} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#B43C3C", color: "white", fontSize: 12, cursor: "pointer" }}>Void</button>
                    <button onClick={() => setShowVoidInput(false)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}><X size={12} /></button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// STATUS_CFG for billing (mirrors STATUS_CFG in scheduler but for invoices)
const STATUS_CFG_BILLING: Record<string, { label: string; bg: string; border: string; text: string }> = {
  pending:  { label: "Pending",  bg: "#FDF9F2", border: "rgba(197,160,89,0.5)", text: "#A8853A" },
  partial:  { label: "Partial",  bg: "#FFF8E8", border: "rgba(212,160,23,0.5)", text: "#D4A017" },
  paid:     { label: "Paid",     bg: "#EFF6EF", border: "rgba(74,138,74,0.5)",  text: "#4A8A4A" },
  overdue:  { label: "Overdue",  bg: "#FEF2F2", border: "rgba(180,60,60,0.4)", text: "#B43C3C" },
  void:     { label: "Voided",   bg: "#F5F5F5", border: "rgba(0,0,0,0.15)",    text: "#6B7280" },
};

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
  const [clinicGstin, setClinicGstin] = useState<string | null>(null);
  const [clinicPrintName, setClinicPrintName] = useState<string>("Aesthetica Clinic");
  const cfg    = STATUS_CFG[inv.status];
  const canPay = ["pending","partial","overdue"].includes(inv.status);

  // M10: fetch clinic GSTIN + name for print header
  useEffect(() => {
    if (!inv.clinic_id) return;
    supabase.from("clinics").select("name, gst_number").eq("id", inv.clinic_id).maybeSingle()
      .then(({ data }) => {
        if (data?.gst_number) setClinicGstin(data.gst_number);
        if (data?.name) setClinicPrintName(data.name);
      });
  }, [inv.clinic_id]);

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
      <h1>${clinicPrintName.toUpperCase()}</h1>
      ${clinicGstin ? `<div class="sub">GSTIN: ${clinicGstin}</div>` : ""}
      <div class="sub">Tax Invoice</div>
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
                {/* GAP-13: Show CGST + SGST split for intra-state (standard) */}
                {(inv.gst_pct ?? 0) > 0 ? (
                  <>
                    <ARow label={`CGST (${(inv.gst_pct ?? 18) / 2}%)`} value={fmt((inv.tax_amount ?? 0) / 2)} />
                    <ARow label={`SGST (${(inv.gst_pct ?? 18) / 2}%)`} value={fmt((inv.tax_amount ?? 0) / 2)} />
                  </>
                ) : null}
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
  const [amount,    setAmount]    = useState(
    ((inv.total_amount ?? inv.amount ?? 0) - 0).toFixed(2)
  );
  const [mode,      setMode]      = useState<PaymentMode>("cash");
  const [ref,       setRef]       = useState("");
  const [notes,     setNotes]     = useState("");
  const [tipAmount, setTipAmount] = useState("0"); // B9: Tip at checkout
  const [saving,    setSaving]    = useState(false);

  // N5: Split payment
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [amount2,      setAmount2]      = useState("0");
  const [mode2,        setMode2]        = useState<PaymentMode>("upi");

  // Gift card
  const [gcCode,       setGcCode]       = useState("");
  const [gcCard,       setGcCard]       = useState<{ id: string; remaining_value: number } | null>(null);
  const [gcChecking,   setGcChecking]   = useState(false);

  // C4: Loyalty points redemption
  const [loyaltyPts,  setLoyaltyPts]  = useState(0);
  const [redeemPts,   setRedeemPts]   = useState(0);
  const [loyaltyTier, setLoyaltyTier] = useState("");

  const due = inv.total_amount ?? inv.amount ?? 0;
  const tip = parseFloat(tipAmount) || 0;
  const pointsDiscount = Math.floor(redeemPts / 100) * 10; // 100 pts = ₹10

  // C4: Fetch loyalty balance on mount
  useEffect(() => {
    if (!inv.patient_id) return;
    supabase.rpc("get_patient_loyalty", { p_patient_id: inv.patient_id, p_clinic_id: clinicId })
      .single()
      .then(({ data }) => {
        if (data) {
          const d = data as { balance: number; tier: string; color: string };
          setLoyaltyPts(d.balance);
          setLoyaltyTier(d.tier);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    const pay = parseFloat(amount);
    if (!pay || pay <= 0) { toast.error("Enter a valid amount"); return; }
    const pay2 = splitEnabled ? parseFloat(amount2) || 0 : 0;
    if (splitEnabled && pay2 <= 0) { toast.error("Enter a valid amount for the second payment"); return; }
    if (splitEnabled && Math.abs(pay + pay2 - due) > 0.01) {
      toast.error(`Split amounts must add up to ₹${due.toFixed(2)}`);
      return;
    }
    setSaving(true);
    try {
      // C4: Redeem loyalty points first (before payment)
      if (redeemPts > 0 && inv.patient_id) {
        const { error: re } = await supabase.rpc("redeem_loyalty_points", {
          p_patient_id: inv.patient_id,
          p_clinic_id:  clinicId,
          p_points:     redeemPts,
          p_invoice_id: inv.id,
        });
        if (re) throw new Error(re.message);
      }

      // N5: If split enabled, also record second payment
      if (splitEnabled && pay2 > 0) {
        await withSupabaseRetry(() =>
          supabase.rpc("record_payment", {
            p_invoice_id:      inv.id,
            p_clinic_id:       clinicId,
            p_amount:          pay2,
            p_payment_mode:    mode2,
            p_transaction_ref: null,
            p_notes:           "Split payment (part 2)",
            p_recorded_by:     null,
          })
        );
      }

      // C-3 fix: single atomic RPC — inserts payment + recomputes invoice status
      const { data: newStatus, error: pe } = await withSupabaseRetry(() =>
        supabase.rpc("record_payment", {
          p_invoice_id:      inv.id,
          p_clinic_id:       clinicId,
          p_amount:          pay,
          p_payment_mode:    mode,
          p_transaction_ref: ref   || null,
          p_notes:           notes || null,
          p_recorded_by:     null,
        })
      );
      if (pe) throw pe;

      // Deduct gift card balance if used
      if (mode === "gift_card" && gcCard) {
        const newRemaining = Math.max(0, gcCard.remaining_value - pay);
        await supabase.from("gift_cards").update({
          remaining_value: newRemaining,
          status: newRemaining <= 0 ? "redeemed" : "active",
          redeemed_by_patient_id: inv.patient_id ?? null,
        }).eq("id", gcCard.id);
        // Link payment row to gift card
        await supabase.from("invoice_payments")
          .update({ gift_card_id: gcCard.id })
          .eq("invoice_id", inv.id)
          .eq("payment_mode", "gift_card")
          .order("created_at", { ascending: false })
          .limit(1);
      }

      // B9: Save tip amount if any
      if (tip > 0) {
        await supabase.from("pending_invoices").update({ tip_amount: tip }).eq("id", inv.id);
      }

      // C1: Earn loyalty points (fire-and-forget, 1 pt per ₹10)
      if (inv.patient_id) {
        supabase.rpc("earn_loyalty_points", {
          p_patient_id: inv.patient_id,
          p_clinic_id:  clinicId,
          p_amount:     pay,
          p_invoice_id: inv.id,
        }).then(() => {});
      }

      await logAction({
        action:     "record_payment",
        targetId:   inv.id,
        targetName: inv.invoice_number,
        metadata:   { amount: pay, mode, tip: tip > 0 ? tip : undefined, redeemPts: redeemPts > 0 ? redeemPts : undefined, status: newStatus },
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

          {/* N5: Split payment toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Split Payment</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Collect via two payment modes</p>
            </div>
            <button onClick={() => { setSplitEnabled(v => !v); if (splitEnabled) { setAmount2("0"); } else { setAmount(((due / 2)).toFixed(2)); setAmount2(((due / 2)).toFixed(2)); } }}
              style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: splitEnabled ? "1px solid rgba(197,160,89,0.5)" : "1px solid var(--border)",
                background: splitEnabled ? "rgba(197,160,89,0.12)" : "var(--input-bg)",
                color: splitEnabled ? "var(--gold)" : "var(--text-muted)" }}>
              {splitEnabled ? "On" : "Off"}
            </button>
          </div>

          {/* N5: Second payment mode row */}
          {splitEnabled && (
            <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(197,160,89,0.04)", border: "1px solid rgba(197,160,89,0.2)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                Second Payment Mode
              </p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {PAYMENT_MODES.filter(pm => pm.value !== "wallet").map(pm => (
                  <button key={pm.value} onClick={() => setMode2(pm.value)}
                    className="flex flex-col items-center gap-1 py-2 rounded-xl text-xs font-semibold"
                    style={{
                      background: mode2 === pm.value ? "rgba(197,160,89,0.15)" : "var(--input-bg)",
                      color: mode2 === pm.value ? "var(--gold)" : "var(--text-muted)",
                      border: mode2 === pm.value ? "1px solid rgba(197,160,89,0.4)" : "1px solid var(--border)",
                    }}>
                    <pm.Icon size={14} />{pm.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: "var(--gold)" }}>₹</span>
                <input type="number" value={amount2}
                  onChange={e => { setAmount2(e.target.value); setAmount((due - (parseFloat(e.target.value) || 0)).toFixed(2)); }}
                  className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
              </div>
              {parseFloat(amount2) > 0 && (
                <p className="text-xs mt-1.5" style={{ color: "#9CA3AF" }}>
                  Split: ₹{parseFloat(amount).toFixed(2)} ({mode}) + ₹{parseFloat(amount2).toFixed(2)} ({mode2})
                  {Math.abs(parseFloat(amount) + parseFloat(amount2) - due) > 0.01 && (
                    <span style={{ color: "#DC2626" }}> — must total ₹{due.toFixed(2)}</span>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Gift card code input */}
          {mode === "gift_card" && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Gift Card Code *</label>
              <div className="flex gap-2">
                <input value={gcCode} onChange={e => { setGcCode(e.target.value.toUpperCase()); setGcCard(null); }}
                  placeholder="e.g. GC-ABCD12" className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none font-mono"
                  style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
                <button onClick={async () => {
                  if (!gcCode) return;
                  setGcChecking(true);
                  const { data } = await supabase.from("gift_cards").select("id, remaining_value, status")
                    .eq("code", gcCode).eq("clinic_id", clinicId).eq("status", "active").maybeSingle();
                  setGcChecking(false);
                  if (!data) { toast.error("Gift card not found or already used"); setGcCard(null); }
                  else {
                    setGcCard({ id: data.id, remaining_value: (data as any).remaining_value });
                    setAmount(Math.min(due, (data as any).remaining_value).toFixed(2));
                    toast.success(`Valid — ₹${(data as any).remaining_value.toLocaleString("en-IN")} remaining`);
                  }
                }} disabled={gcChecking}
                  className="px-3 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
                  style={{ background: "var(--gold)", color: "#fff" }}>
                  {gcChecking ? "…" : "Check"}
                </button>
              </div>
              {gcCard && (
                <p className="text-xs mt-1.5" style={{ color: "#16a34a" }}>
                  ✓ Valid — ₹{gcCard.remaining_value.toLocaleString("en-IN")} available
                </p>
              )}
            </div>
          )}

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

          {/* C4: Redeem Loyalty Points */}
          {loyaltyPts >= 100 && (
            <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(139,126,200,0.06)", border: "1px solid rgba(139,126,200,0.25)" }}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold" style={{ fontFamily: "Georgia, serif", color: "var(--foreground)" }}>
                    Loyalty Points
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {loyaltyPts.toLocaleString()} pts available · {loyaltyTier} · 100 pts = ₹10 off
                  </p>
                </div>
                {redeemPts === 0 ? (
                  <button
                    onClick={() => {
                      const maxRedeemable = Math.floor(Math.min(loyaltyPts, (due * 100) / 10) / 100) * 100;
                      setRedeemPts(maxRedeemable);
                      setAmount((due - (maxRedeemable / 100) * 10).toFixed(2));
                    }}
                    style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(139,126,200,0.5)", background: "rgba(139,126,200,0.1)", color: "#6B5FAA", cursor: "pointer" }}>
                    Apply Max
                  </button>
                ) : (
                  <button
                    onClick={() => { setRedeemPts(0); setAmount(due.toFixed(2)); }}
                    style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(220,38,38,0.3)", background: "rgba(220,38,38,0.06)", color: "#DC2626", cursor: "pointer" }}>
                    Remove
                  </button>
                )}
              </div>
              {redeemPts > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(139,126,200,0.1)" }}>
                  <BadgeCheck size={13} style={{ color: "#6B5FAA" }} />
                  <p className="text-xs font-semibold" style={{ color: "#6B5FAA" }}>
                    {redeemPts} pts → ₹{pointsDiscount} discount applied · Patient pays ₹{(due - pointsDiscount).toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* B9: Tip at checkout */}
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(197,160,89,0.05)", border: "1px solid rgba(197,160,89,0.2)" }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold" style={{ fontFamily: "Georgia, serif", color: "var(--foreground)" }}>
                  Add a Tip (Optional)
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Patient can tip their provider</p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[0, 100, 200, 500].map(t => (
                  <button
                    key={t}
                    onClick={() => setTipAmount(String(t))}
                    style={{
                      padding: "4px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                      border: tip === t ? "1px solid #C5A059" : "1px solid var(--border)",
                      background: tip === t ? "rgba(197,160,89,0.15)" : "var(--input-bg)",
                      color: tip === t ? "#A8853A" : "var(--text-muted)",
                      fontWeight: tip === t ? 700 : 400,
                    }}
                  >
                    {t === 0 ? "None" : `₹${t}`}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: "var(--gold)" }}>₹</span>
              <input
                type="number" value={tipAmount} min="0"
                onChange={e => setTipAmount(e.target.value)}
                className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              />
            </div>
            {tip > 0 && (
              <p className="text-xs mt-1.5" style={{ color: "#C5A059" }}>
                Total to collect: ₹{(parseFloat(amount) + tip).toFixed(2)} (including ₹{tip} tip)
              </p>
            )}
          </div>
        </div>

        {/* Inventory reminder */}
        <div className="mx-5 mb-4 flex items-start gap-2 px-3 py-2 rounded-xl"
          style={{ background: "rgba(197,160,89,0.06)", border: "1px solid rgba(197,160,89,0.18)" }}>
          <Package size={13} style={{ color: "var(--gold)", flexShrink: 0, marginTop: 1 }} />
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            If consumables were used, record stock usage in{" "}
            <a href="/inventory" target="_blank" rel="noopener noreferrer"
              style={{ color: "var(--gold)", fontWeight: 600 }}>Inventory → Adjust Stock</a>
          </p>
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

// ── N2: Wallet Top-up Modal ───────────────────────────────────────────────────

function WalletTopupModal({ clinicId, onClose, onSuccess }: {
  clinicId: string; onClose: () => void; onSuccess: () => void;
}) {
  const [patients,  setPatients]  = useState<PatientOption[]>([]);
  const [patSearch, setPatSearch] = useState("");
  const [selPat,    setSelPat]    = useState<PatientOption | null>(null);
  const [showPats,  setShowPats]  = useState(false);
  const [amount,    setAmount]    = useState("");
  const [reason,    setReason]    = useState("");
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    supabase.from("patients").select("id, full_name, phone").eq("clinic_id", clinicId).limit(200)
      .then(({ data }) => setPatients(data ?? []));
  }, [clinicId]);

  const filteredPats = patSearch.length >= 1
    ? patients.filter(p => p.full_name.toLowerCase().includes(patSearch.toLowerCase()))
    : [];

  const handleSave = async () => {
    if (!selPat || !amount) { toast.error("Select a patient and enter an amount"); return; }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { toast.error("Enter a valid amount"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("add_wallet_credit", {
        p_patient_id: selPat.id,
        p_clinic_id:  clinicId,
        p_amount:     amt,
        p_reason:     reason || "Manual top-up from billing",
        p_reference_id:   null,
        p_reference_type: null,
      });
      if (error) throw error;
      onSuccess();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to top up wallet");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl flex flex-col" style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <Wallet size={16} style={{ color: "var(--gold)" }} />
            <p className="font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>Top Up Wallet</p>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X size={16} /></button>
        </div>
        <div className="px-5 py-5 space-y-4">
          {/* Patient */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Patient *</label>
            {selPat ? (
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                style={{ background: "rgba(197,160,89,0.06)", border: "1px solid rgba(197,160,89,0.2)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{selPat.full_name}</p>
                <button onClick={() => { setSelPat(null); setPatSearch(""); }} style={{ color: "var(--text-muted)" }}><X size={13} /></button>
              </div>
            ) : (
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input value={patSearch} onChange={e => { setPatSearch(e.target.value); setShowPats(true); }} onFocus={() => setShowPats(true)}
                  placeholder="Search patient…" className="w-full pl-8 pr-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
                {showPats && filteredPats.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl shadow-xl max-h-40 overflow-y-auto"
                    style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
                    {filteredPats.slice(0, 6).map(p => (
                      <button key={p.id} onClick={() => { setSelPat(p); setPatSearch(""); setShowPats(false); }}
                        className="w-full text-left px-3 py-2 text-sm" style={{ color: "var(--foreground)", borderBottom: "1px solid var(--border)" }}>
                        {p.full_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Amount ₹ *</label>
            <input type="number" min={1} value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 1000"
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
          </div>
          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Reason (optional)</label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Package advance"
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--input-bg)", color: "var(--foreground)", border: "1px solid var(--border)" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: "var(--gold)", color: "#fff" }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Wallet size={13} />}
            {saving ? "Topping up…" : "Top Up"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── N2-1: Gift Cards Modal ────────────────────────────────────────────────────

interface GiftCard {
  id: string;
  code: string;
  original_value: number;
  remaining_value: number;
  status: string;
  expires_at: string | null;
  issued_to?: { full_name: string } | null;
}

function GiftCardsModal({ clinicId, onClose }: { clinicId: string; onClose: () => void }) {
  const [cards,        setCards]        = useState<GiftCard[]>([]);
  const [patients,     setPatients]     = useState<PatientOption[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showIssue,    setShowIssue]    = useState(false);
  const [patSearch,    setPatSearch]    = useState("");
  const [showPats,     setShowPats]     = useState(false);
  const [selPat,       setSelPat]       = useState<PatientOption | null>(null);
  const [value,        setValue]        = useState("");
  const [expiresAt,    setExpiresAt]    = useState("");
  const [saving,       setSaving]       = useState(false);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("gift_cards")
      .select("id, code, original_value, remaining_value, status, expires_at, issued_to_patient_id, patients:issued_to_patient_id(full_name)")
      .eq("clinic_id", clinicId).order("created_at", { ascending: false });
    setCards((data ?? []).map((c: any) => ({ ...c, issued_to: Array.isArray(c.patients) ? c.patients[0] : c.patients })));
    setLoading(false);
  }, [clinicId]);

  useEffect(() => { fetchCards(); }, [fetchCards]);
  useEffect(() => {
    supabase.from("patients").select("id, full_name, phone").eq("clinic_id", clinicId).limit(200)
      .then(({ data }) => setPatients(data ?? []));
  }, [clinicId]);

  const filteredPats = patSearch.length >= 1
    ? patients.filter(p => p.full_name.toLowerCase().includes(patSearch.toLowerCase()))
    : [];

  const genCode = () => `GC-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  const handleIssue = async () => {
    const amt = parseFloat(value);
    if (isNaN(amt) || amt <= 0) { toast.error("Enter a valid amount"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("gift_cards").insert({
        clinic_id:            clinicId,
        code:                 genCode(),
        original_value:       amt,
        remaining_value:      amt,
        issued_to_patient_id: selPat?.id ?? null,
        expires_at:           expiresAt || null,
        status:               "active",
      });
      if (error) throw error;
      toast.success("Gift card issued!");
      setShowIssue(false); setValue(""); setExpiresAt(""); setSelPat(null); setPatSearch("");
      fetchCards();
    } catch (e: any) { toast.error(e.message ?? "Failed to issue gift card"); }
    finally { setSaving(false); }
  };

  const voidCard = async (id: string) => {
    await supabase.from("gift_cards").update({ status: "void" }).eq("id", id);
    fetchCards();
  };

  const statusColor: Record<string, string> = { active: "#16a34a", redeemed: "#6B7280", expired: "#E8935A", void: "#DC2626" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl flex flex-col max-h-[90vh]" style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <Gift size={16} style={{ color: "var(--gold)" }} />
            <p className="font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>Gift Cards</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowIssue(s => !s)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: "var(--gold)", color: "#fff" }}>
              <Plus size={12} /> Issue New
            </button>
            <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X size={16} /></button>
          </div>
        </div>

        {/* Issue form */}
        {showIssue && (
          <div className="px-5 py-4 border-b space-y-3" style={{ borderColor: "var(--border)", background: "rgba(197,160,89,0.04)" }}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>Value (₹) *</label>
                <input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="e.g. 1000"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>Expires (optional)</label>
                <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>Issue to Patient (optional)</label>
              {selPat ? (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg"
                  style={{ background: "rgba(197,160,89,0.06)", border: "1px solid rgba(197,160,89,0.2)" }}>
                  <span className="text-sm" style={{ color: "var(--foreground)" }}>{selPat.full_name}</span>
                  <button onClick={() => { setSelPat(null); setPatSearch(""); }} style={{ color: "var(--text-muted)" }}><X size={12} /></button>
                </div>
              ) : (
                <div className="relative">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                  <input value={patSearch} onChange={e => { setPatSearch(e.target.value); setShowPats(true); }} onFocus={() => setShowPats(true)}
                    placeholder="Search patient…" className="w-full pl-7 pr-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
                  {showPats && filteredPats.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl shadow-xl max-h-36 overflow-y-auto"
                      style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
                      {filteredPats.map(p => (
                        <button key={p.id} className="w-full px-4 py-2.5 text-left hover:bg-gold/5 flex items-center gap-2 text-sm"
                          onClick={() => { setSelPat(p); setShowPats(false); setPatSearch(""); }}>
                          <User size={12} style={{ color: "var(--text-muted)" }} />
                          <span style={{ color: "var(--foreground)" }}>{p.full_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowIssue(false)} className="px-4 py-2 rounded-lg text-sm"
                style={{ background: "var(--input-bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>Cancel</button>
              <button onClick={handleIssue} disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 disabled:opacity-60"
                style={{ background: "var(--gold)", color: "#fff" }}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Gift size={12} />}
                {saving ? "Issuing…" : "Issue Gift Card"}
              </button>
            </div>
          </div>
        )}

        {/* Cards list */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="text-center py-8 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>
          ) : cards.length === 0 ? (
            <div className="text-center py-8 text-sm" style={{ color: "var(--text-muted)" }}>No gift cards yet. Issue one to get started.</div>
          ) : (
            <div className="space-y-2">
              {cards.map(c => (
                <div key={c.id} className="flex items-center justify-between px-4 py-3 rounded-xl"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-semibold" style={{ color: "var(--foreground)" }}>{c.code}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${statusColor[c.status]}18`, color: statusColor[c.status] }}>{c.status}</span>
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      ₹{c.remaining_value.toLocaleString("en-IN")} / ₹{c.original_value.toLocaleString("en-IN")}
                      {c.issued_to && ` · ${c.issued_to.full_name}`}
                      {c.expires_at && ` · exp ${new Date(c.expires_at).toLocaleDateString("en-IN")}`}
                    </div>
                  </div>
                  {c.status === "active" && (
                    <button onClick={() => voidCard(c.id)} className="text-xs px-2.5 py-1.5 rounded-lg"
                      style={{ background: "rgba(220,38,38,0.08)", color: "#DC2626", border: "1px solid rgba(220,38,38,0.2)" }}>
                      Void
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── GAP-4: Sell Package Drawer ───────────────────────────────────────────────

interface PkgOption { id: string; name: string; total_price: number; package_items: { sessions: number; service_id: string; services: { name: string } | null }[] }

function SellPackageDrawer({ clinicId, onClose, onSuccess }: { clinicId: string; onClose: () => void; onSuccess: () => void }) {
  const { profile } = useClinic();
  const [patients, setPatients] = useState<{ id: string; full_name: string; phone: string | null }[]>([]);
  const [packages, setPackages] = useState<PkgOption[]>([]);
  const [patientQ,  setPatientQ]  = useState("");
  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [pkgId, setPkgId] = useState("");
  const [payMode, setPayMode] = useState("cash");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("service_packages")
      .select("id, name, total_price, package_items(sessions, service_id, services(name))")
      .eq("clinic_id", clinicId).eq("is_active", true)
      .then(({ data }) => setPackages((data ?? []) as unknown as PkgOption[]));
  }, [clinicId]);

  useEffect(() => {
    if (!patientQ || patientQ.length < 2) return;
    supabase.from("patients").select("id, full_name, phone")
      .eq("clinic_id", clinicId).ilike("full_name", `%${patientQ}%`).limit(5)
      .then(({ data }) => setPatients((data ?? []) as { id: string; full_name: string; phone: string | null }[]));
  }, [patientQ, clinicId]);

  const selectedPkg = packages.find(p => p.id === pkgId);

  async function handleSell() {
    if (!patientId || !pkgId || !selectedPkg) return;
    setSaving(true);
    try {
      const { data: inv, error: invErr } = await supabase.rpc("create_invoice_with_items", {
        p_clinic_id:      clinicId,
        p_patient_id:     patientId,
        p_patient_name:   patientName,
        p_provider_id:    null,
        p_provider_name:  null,
        p_invoice_type:   "package",
        p_line_items:     [{ description: selectedPkg.name, quantity: 1, unit_price: selectedPkg.total_price, discount_pct: 0, gst_pct: 0 }],
        p_discount_amount: 0,
        p_gst_pct:        0,
      });
      if (invErr || !inv) throw invErr;
      await withSupabaseRetry(() =>
        supabase.rpc("record_payment", {
          p_invoice_id: inv, p_clinic_id: clinicId,
          p_amount: selectedPkg.total_price, p_payment_mode: payMode,
          p_transaction_ref: null, p_notes: `Package sale: ${selectedPkg.name}`, p_recorded_by: profile?.full_name ?? null,
        })
      );
      // Create service credits per package item
      for (const item of (selectedPkg.package_items ?? [])) {
        await supabase.from("patient_service_credits").insert({
          patient_id:        patientId,
          purchase_clinic_id: clinicId,
          current_clinic_id:  clinicId,
          service_id:         item.service_id,
          package_id:         pkgId,
          service_name:       item.services?.name ?? "Service",
          total_sessions:     item.sessions ?? 1,
          used_sessions:      0,
          purchase_price:     selectedPkg.total_price,
          per_session_value:  selectedPkg.total_price / Math.max(1, (selectedPkg.package_items ?? []).reduce((s, i) => s + (i.sessions ?? 1), 0)),
          status:             "active",
        });
      }

      // B10: Sale commission for the selling staff member
      if (profile?.id && selectedPkg.total_price > 0) {
        const { data: rateRow } = await supabase.rpc("get_commission_pct", {
          p_clinic_id:   clinicId,
          p_provider_id: profile.id,
          p_service_id:  null,
        });
        const commPct = (rateRow as number | null) ?? 10;
        const commAmt = Math.round(selectedPkg.total_price * commPct / 100 * 100) / 100;
        if (commAmt > 0) {
          await supabase.from("staff_commissions").insert({
            provider_id:       profile.id,
            clinic_id:         clinicId,
            patient_id:        patientId,
            service_name:      selectedPkg.name,
            sale_amount:       selectedPkg.total_price,
            commission_pct:    commPct,
            commission_amount: commAmt,
            commission_type:   "sale",
            status:            "pending",
          });
        }
      }

      onSuccess();
    } catch (e) {
      toast.error((e as Error)?.message ?? "Failed to sell package");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "flex-start", justifyContent: "flex-end" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} onClick={onClose} />
      <div style={{ position: "relative", width: 420, height: "100vh", background: "white", boxShadow: "-8px 0 32px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(197,160,89,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Package size={18} style={{ color: "#C5A059" }} />
            <span style={{ fontSize: 16, fontWeight: 600, fontFamily: "Georgia, serif", color: "#1C1917" }}>Sell Package</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9C9584" }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Patient search */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#5C5447", display: "block", marginBottom: 6 }}>Patient *</label>
            <input value={patientId ? patientName : patientQ} onChange={e => { setPatientQ(e.target.value); setPatientId(""); setPatientName(""); }}
              placeholder="Search patient name…"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(197,160,89,0.25)", fontSize: 13, fontFamily: "Georgia, serif" }} />
            {patients.length > 0 && !patientId && (
              <div style={{ border: "1px solid rgba(197,160,89,0.2)", borderRadius: 8, marginTop: 4, background: "white", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                {patients.map(p => (
                  <button key={p.id} onClick={() => { setPatientId(p.id); setPatientName(p.full_name); setPatients([]); setPatientQ(""); }}
                    style={{ display: "block", width: "100%", padding: "10px 12px", border: "none", background: "none", textAlign: "left", fontSize: 13, cursor: "pointer", color: "#1C1917", fontFamily: "Georgia, serif" }}>
                    {p.full_name} {p.phone ? `· ${p.phone}` : ""}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Package select */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#5C5447", display: "block", marginBottom: 6 }}>Package *</label>
            <select value={pkgId} onChange={e => setPkgId(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(197,160,89,0.25)", fontSize: 13, fontFamily: "Georgia, serif", background: "white" }}>
              <option value="">Select package…</option>
              {packages.map(p => <option key={p.id} value={p.id}>{p.name} — ₹{p.total_price.toLocaleString("en-IN")}</option>)}
            </select>
          </div>
          {/* Package summary */}
          {selectedPkg && (
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(197,160,89,0.06)", border: "1px solid rgba(197,160,89,0.2)" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#1C1917", margin: "0 0 8px", fontFamily: "Georgia, serif" }}>{selectedPkg.name}</p>
              {(selectedPkg.package_items ?? []).map((item, i) => (
                <p key={i} style={{ fontSize: 12, color: "#5C5447", margin: "2px 0" }}>• {item.services?.name ?? "Service"} × {item.sessions} sessions</p>
              ))}
              <p style={{ fontSize: 14, fontWeight: 700, color: "#C5A059", margin: "8px 0 0", fontFamily: "Georgia, serif" }}>₹{selectedPkg.total_price.toLocaleString("en-IN")}</p>
            </div>
          )}
          {/* Payment mode */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#5C5447", display: "block", marginBottom: 6 }}>Payment Mode</label>
            <select value={payMode} onChange={e => setPayMode(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(197,160,89,0.25)", fontSize: 13, fontFamily: "Georgia, serif", background: "white" }}>
              {["cash","card","upi","bank_transfer","wallet"].map(m => <option key={m} value={m}>{m.replace("_"," ").toUpperCase()}</option>)}
            </select>
          </div>
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(197,160,89,0.15)" }}>
          <button onClick={handleSell} disabled={saving || !patientId || !pkgId}
            style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: saving || !patientId || !pkgId ? "rgba(197,160,89,0.3)" : "var(--gold)", color: "white", fontSize: 14, fontWeight: 600, cursor: saving || !patientId || !pkgId ? "not-allowed" : "pointer", fontFamily: "Georgia, serif" }}>
            {saving ? "Processing…" : "Sell Package & Create Invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── New Invoice Drawer ────────────────────────────────────────────────────────

function NewInvoiceDrawer({ clinicId, onClose, onSuccess, isProforma = false }: {
  clinicId:   string;
  onClose:    () => void;
  onSuccess:  () => void;
  isProforma?: boolean;
}) {
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [patSearch, setPatSearch]     = useState("");
  const [showPats,  setShowPats]      = useState(false);
  const [selPat,    setSelPat]        = useState<PatientOption | null>(null);
  const [items,     setItems]         = useState<InvoiceItem[]>([
    { description: "", service_id: null, quantity: 1, unit_price: 0, discount_pct: 0, gst_pct: 18, line_total: 0 },
  ]);
  const [notes,     setNotes]         = useState("");
  const [dueDate,   setDueDate]       = useState("");
  const [saving,    setSaving]        = useState(false);
  const [membershipBenefit, setMembershipBenefit] = useState<{ planName: string; discountPct: number } | null>(null);
  // GAP-27: discount approval
  const [discApprovalId,   setDiscApprovalId]   = useState<string | null>(null);
  const [discOtpInput,     setDiscOtpInput]     = useState("");
  const [discApproved,     setDiscApproved]     = useState(false);
  const [discOtpSent,      setDiscOtpSent]      = useState(false);
  const [discOtpDemo,      setDiscOtpDemo]      = useState<string | null>(null);
  const DISCOUNT_THRESHOLD = 10; // % — approvals required above this

  useEffect(() => {
    (async () => {
      const [{ data: pats }, { data: svcs }, { data: prods }] = await Promise.all([
        supabase.from("patients").select("id, full_name, phone").eq("clinic_id", clinicId).limit(200),
        supabase.from("services").select("id, name, selling_price, category").eq("clinic_id", clinicId).eq("is_active", true),
        supabase.from("inventory_products").select("id, name, selling_price").eq("clinic_id", clinicId).eq("is_active", true).order("name"),
      ]);
      setPatients(pats ?? []);
      setServices(svcs ?? []);
      setProducts((prods ?? []).filter((p: ProductOption) => p.selling_price != null));
    })();
  }, [clinicId]);

  const filteredPats = patSearch.length >= 1
    ? patients.filter(p => p.full_name.toLowerCase().includes(patSearch.toLowerCase()))
    : [];

  // When patient changes, check for active membership benefits
  useEffect(() => {
    if (!selPat) { setMembershipBenefit(null); return; }
    (async () => {
      const { data } = await supabase
        .from("patient_memberships")
        .select("plan:membership_plans!plan_id(name, benefits)")
        .eq("patient_id", selPat.id)
        .eq("status", "active")
        .lte("started_at", new Date().toISOString())
        .gte("expires_at", new Date().toISOString())
        .limit(1)
        .maybeSingle();
      if (!data?.plan) { setMembershipBenefit(null); return; }
      // Supabase returns joined row as an array even with !inner — normalise to object
      const rawPlan = Array.isArray(data.plan) ? data.plan[0] : data.plan;
      const plan = rawPlan as unknown as { name: string; benefits: Record<string, unknown> };
      const discountPct = typeof plan.benefits?.discount === "number" ? plan.benefits.discount : 0;
      if (discountPct > 0) {
        setMembershipBenefit({ planName: plan.name, discountPct });
        // Auto-apply discount to all line items
        setItems(prev => prev.map(it => {
          const updated = { ...it, discount_pct: discountPct };
          updated.line_total = calcLineTotal(updated);
          return updated;
        }));
        toast.success(`${plan.name} membership applied — ${discountPct}% discount`, { duration: 3000 });
      } else {
        setMembershipBenefit({ planName: plan.name, discountPct: 0 });
      }
    })();
  }, [selPat]);

  const updateItem = (idx: number, field: keyof InvoiceItem, val: unknown) => {
    const arr = [...items];
    (arr[idx] as any)[field] = val;
    if (field === "service_id" && val) {
      const svc = services.find(s => s.id === val);
      if (svc) { arr[idx].description = svc.name; arr[idx].unit_price = svc.selling_price; arr[idx].inventory_product_id = null; }
    }
    if (field === "inventory_product_id" && val) {
      const prod = products.find(p => p.id === val);
      if (prod) { arr[idx].description = prod.name; arr[idx].unit_price = prod.selling_price ?? 0; arr[idx].service_id = null; }
    }
    if (field === "item_type") {
      arr[idx].service_id = null;
      arr[idx].inventory_product_id = null;
      arr[idx].description = "";
      arr[idx].unit_price = 0;
    }
    arr[idx].line_total = calcLineTotal(arr[idx]);
    setItems(arr);
  };

  const addItem    = () => setItems([...items, { description: "", service_id: null, inventory_product_id: null, item_type: "service", quantity: 1, unit_price: 0, discount_pct: 0, gst_pct: 18, line_total: 0 }]);
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
    // GAP-27: require approval if any line item exceeds discount threshold
    const maxDisc = Math.max(...items.map(it => it.discount_pct ?? 0));
    if (!isProforma && maxDisc > DISCOUNT_THRESHOLD && !discApproved) {
      toast.error(`Discount exceeds ${DISCOUNT_THRESHOLD}% — approval required. Use the Approval section below.`);
      return;
    }
    setSaving(true);
    try {
      const svcNames = items.filter(it => it.description).map(it => it.description).join(", ");
      // Atomic invoice + line items in single DB transaction (GAP-10)
      const validItems = items.filter(it => it.description.trim() && it.unit_price > 0);
      // H-3 fix: compute effective GST from line items (weighted average)
      const lineSub  = validItems.reduce((s, it) => s + it.unit_price * it.quantity * (1 - it.discount_pct / 100), 0);
      const lineGst  = validItems.reduce((s, it) => { const b = it.unit_price * it.quantity * (1 - it.discount_pct / 100); return s + b * (it.gst_pct / 100); }, 0);
      const effGstPct = lineSub > 0 ? Math.round(lineGst / lineSub * 100) : 0;
      const { data: result, error: ie } = await supabase.rpc("create_invoice_with_items", {
        p_clinic_id:     clinicId,
        p_patient_id:    selPat?.id   ?? null,
        p_patient_name:  selPat?.full_name ?? "Walk-in",
        p_provider_id:   null,
        p_provider_name: "",
        p_due_date:      dueDate || null,
        p_gst_pct:       effGstPct,
        p_invoice_type:  isProforma ? "proforma" : "ad_hoc",
        p_notes:         notes || null,
        p_items: JSON.stringify(validItems.map(it => ({
          service_id:           it.service_id ?? null,
          inventory_product_id: it.inventory_product_id ?? null,
          description:          it.description,
          quantity:             it.quantity,
          unit_price:           it.unit_price,
          discount_pct:         it.discount_pct,
          gst_pct:              it.gst_pct,
        }))),
      });
      if (ie) throw ie;
      const inv = result as { invoice_id: string } | null;

      // M3: create inventory_movements for product line items
      const productItems = validItems.filter(it => it.item_type === "product" && it.inventory_product_id);
      if (productItems.length > 0) {
        await supabase.from("inventory_movements").insert(
          productItems.map(it => ({
            clinic_id:          clinicId,
            product_id:         it.inventory_product_id,
            movement_type:      "sale",
            quantity:           it.quantity,
            selling_price:      it.unit_price,
            patient_id:         selPat?.id ?? null,
            notes:              `Invoice ${inv?.invoice_id ?? ""}`,
          }))
        );
      }

      await logAction({ action: isProforma ? "create_proforma" : "create_invoice", targetId: inv?.invoice_id, targetName: svcNames });
      toast.success(isProforma ? "Proforma created!" : "Invoice created!");
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
              {isProforma ? "New Proforma / Quote" : "New Invoice"}
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

          {/* Membership benefit banner */}
          {membershipBenefit && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: "rgba(197,160,89,0.08)", border: "1px solid rgba(197,160,89,0.25)" }}>
              <BadgeCheck size={14} style={{ color: "var(--gold)", flexShrink: 0 }} />
              <p className="text-xs font-medium" style={{ color: "var(--gold)" }}>
                {membershipBenefit.planName} member
                {membershipBenefit.discountPct > 0
                  ? ` — ${membershipBenefit.discountPct}% discount applied to all line items`
                  : " — no discount benefit on this plan"}
              </p>
            </div>
          )}

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
                  products={products}
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

        {/* GAP-27: Discount approval panel (shown when discount > threshold) */}
        {!isProforma && Math.max(...items.map(it => it.discount_pct ?? 0)) > DISCOUNT_THRESHOLD && !discApproved && (
          <div className="mx-5 mb-3 p-4 rounded-xl" style={{ background: "rgba(180,60,60,0.06)", border: "1px solid rgba(180,60,60,0.25)" }}>
            <p className="text-xs font-semibold mb-2" style={{ color: "#B43C3C" }}>
              Discount &gt;{DISCOUNT_THRESHOLD}% requires manager approval
            </p>
            {!discOtpSent ? (
              <button
                onClick={async () => {
                  const res = await fetch("/api/discounts/request", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ clinic_id: clinicId, discount_pct: Math.max(...items.map(it => it.discount_pct ?? 0)) }),
                  });
                  const json = await res.json();
                  if (json.approval_id) {
                    setDiscApprovalId(json.approval_id);
                    setDiscOtpSent(true);
                    setDiscOtpDemo(json.otp_demo ?? null);
                    toast.success("OTP sent to clinic admin for approval");
                  }
                }}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: "rgba(180,60,60,0.1)", color: "#B43C3C", border: "1px solid rgba(180,60,60,0.3)", cursor: "pointer" }}
              >
                Request Approval OTP
              </button>
            ) : (
              <div className="flex gap-2 items-center">
                <input
                  value={discOtpInput} onChange={e => setDiscOtpInput(e.target.value)}
                  placeholder="Enter 6-digit OTP"
                  maxLength={6}
                  className="px-3 py-1.5 rounded-lg text-xs outline-none flex-1"
                  style={{ border: "1px solid rgba(180,60,60,0.3)", background: "white" }}
                />
                <button
                  onClick={async () => {
                    const res = await fetch("/api/discounts/verify-otp", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ approval_id: discApprovalId, otp: discOtpInput }),
                    });
                    if (res.ok) { setDiscApproved(true); toast.success("Discount approved"); }
                    else { toast.error("Invalid or expired OTP"); }
                  }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: "#C5A059", color: "white", border: "none", cursor: "pointer" }}
                >
                  Verify
                </button>
                {discOtpDemo && (
                  <span className="text-xs" style={{ color: "#9C9584" }}>Demo OTP: {discOtpDemo}</span>
                )}
              </div>
            )}
          </div>
        )}
        {discApproved && (
          <div className="mx-5 mb-3 px-3 py-2 rounded-xl text-xs font-semibold" style={{ background: "rgba(46,125,110,0.08)", color: "#2E7D6E", border: "1px solid rgba(46,125,110,0.2)" }}>
            Discount approved by manager
          </div>
        )}

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

function LineItemRow({ item, services, products = [], onChange, onRemove, canRemove }: {
  item:       InvoiceItem;
  services:   ServiceOption[];
  products?:  ProductOption[];
  onChange:   (field: keyof InvoiceItem, val: unknown) => void;
  onRemove:   () => void;
  canRemove:  boolean;
}) {
  const isProduct = item.item_type === "product";
  return (
    <div className="rounded-xl p-3 space-y-2.5" style={{ background: "var(--input-bg)", border: "1px solid var(--border)" }}>
      {/* M3: Type toggle + picker */}
      <div className="flex gap-2">
        <div className="flex rounded-lg overflow-hidden flex-shrink-0" style={{ border: "1px solid var(--border)" }}>
          {(["service", "product"] as const).map(t => (
            <button key={t} onClick={() => onChange("item_type", t)}
              className="px-2.5 py-1.5 text-xs font-semibold capitalize"
              style={{
                background: (item.item_type ?? "service") === t ? "var(--gold)" : "var(--card-bg)",
                color: (item.item_type ?? "service") === t ? "#fff" : "var(--text-muted)",
                border: "none",
              }}>{t}</button>
          ))}
        </div>
        {isProduct ? (
          <select
            value={item.inventory_product_id ?? ""}
            onChange={e => onChange("inventory_product_id", e.target.value || null)}
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--card-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
            <option value="">Select product…</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name} — ₹{p.selling_price}</option>
            ))}
          </select>
        ) : (
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
        )}
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
