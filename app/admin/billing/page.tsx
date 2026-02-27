"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CreditCard, Users, Building2, Network, CheckCircle2, AlertTriangle,
  IndianRupee, Crown, Zap, Shield, Loader2, RefreshCw, Receipt,
  Smartphone, Landmark, ChevronDown, Bell, TrendingUp, Ban, RotateCcw,
  Calendar, MapPin, Mail, Hash,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import { toast } from "sonner";
import TopBar from "@/components/TopBar";

// ── Types ─────────────────────────────────────────────────────────────────────

type Plan   = "free" | "growth" | "enterprise";
type Status = "active" | "past_due" | "canceled";

interface ClinicRow {
  id:                  string;
  name:                string;
  location:            string | null;
  admin_email:         string | null;
  subscription_status: string;
  subscription_plan:   Plan;
  chain_id:            string | null;
  chain_name:          string | null;
  gst_number:          string | null;
  patient_count:       number;
  revenue_mtd:         number;
  billing_method:      string | null;
  created_at:          string;
}

interface ChainRow {
  id:                  string;
  name:                string;
  clinic_count:        number;
  billing_method:      string | null;
  grace_period_days:   number | null;
  warning_days_before: number | null;
}

interface PaymentRow {
  id:         string;
  clinic_id:  string | null;
  chain_id:   string | null;
  amount:     number;
  currency:   string;
  status:     string;
  method:     string | null;
  paid_at:    string | null;
  created_at: string;
  clinic_name?: string;
  chain_name?:  string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const PLANS: Record<Plan, {
  label: string; price: number;
  color: string; bg: string; border: string;
  features: string[]; Icon: React.ElementType;
}> = {
  free: {
    label: "Free", price: 0,
    color: "#6B7280", bg: "rgba(107,114,128,0.08)", border: "rgba(107,114,128,0.2)",
    Icon: Shield,
    features: ["Up to 50 patients", "Basic invoicing", "1 provider"],
  },
  growth: {
    label: "Growth", price: 2999,
    color: "#C5A059", bg: "rgba(197,160,89,0.08)", border: "rgba(197,160,89,0.2)",
    Icon: Zap,
    features: ["Unlimited patients", "Smart Scheduler", "5 providers", "Analytics"],
  },
  enterprise: {
    label: "Enterprise", price: 9999,
    color: "#7C3AED", bg: "rgba(124,58,237,0.08)", border: "rgba(124,58,237,0.2)",
    Icon: Crown,
    features: ["Multi-clinic chain", "Custom workflows", "Priority support", "API access"],
  },
};

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  active:   { label: "Active",   bg: "#EFF6EF", text: "#2A5A2A", dot: "#4A8A4A" },
  past_due: { label: "Past Due", bg: "#FFF8E8", text: "#92600A", dot: "#D4A017" },
  canceled: { label: "Canceled", bg: "#FEF2F2", text: "#8A1A1A", dot: "#EF4444" },
  trial:    { label: "Trial",    bg: "#F0F4FF", text: "#2A3A8A", dot: "#4A6AEF" },
};

const METHOD_ICON: Record<string, React.ElementType> = {
  credit_card:   CreditCard,
  bank_transfer: Landmark,
  upi:           Smartphone,
};
const METHOD_LABEL: Record<string, string> = {
  credit_card:   "Card",
  bank_transfer: "Bank",
  upi:           "UPI",
};

const fmt = (n: number) =>
  "₹" + (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtFull = (n: number) =>
  "₹" + (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Shared styles ─────────────────────────────────────────────────────────────

const labelSx: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.09em", color: "var(--text-muted)", marginBottom: 2,
};

// ── Page ──────────────────────────────────────────────────────────────────────

type TabKey = "clinics" | "chains" | "payments";

export default function AdminBillingPage() {
  const { profile, loading: profileLoading } = useClinic();

  const [tab,      setTab]      = useState<TabKey>("clinics");
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");

  const [clinics,  setClinics]  = useState<ClinicRow[]>([]);
  const [chains,   setChains]   = useState<ChainRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  // KPIs
  const [mrr,        setMrr]        = useState(0);
  const [mtdRevenue, setMtdRevenue] = useState(0);
  const [activeCnt,  setActiveCnt]  = useState(0);
  const [pastDueCnt, setPastDueCnt] = useState(0);

  // Inline action state
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // ── Data fetch ────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const firstOfMonth = new Date(
        new Date().getFullYear(), new Date().getMonth(), 1
      ).toISOString();

      // 1. Clinics with chain name
      const { data: clinicData } = await supabase
        .from("clinics")
        .select("id, name, location, admin_email, subscription_status, subscription_plan, chain_id, gst_number, created_at, chains(name)")
        .order("created_at", { ascending: false });

      // 2. Clinic billing methods
      const { data: cbData } = await supabase
        .from("clinic_billing_methods")
        .select("clinic_id, method_type")
        .eq("is_active", true);

      const cbMap: Record<string, string> = {};
      (cbData ?? []).forEach(r => { cbMap[r.clinic_id] = r.method_type; });

      // 3. Enrich each clinic
      const enriched: ClinicRow[] = await Promise.all(
        (clinicData ?? []).map(async (c) => {
          const [{ count: pCount }, { data: invData }] = await Promise.all([
            supabase.from("patients")
              .select("*", { count: "exact", head: true })
              .eq("clinic_id", c.id),
            supabase.from("pending_invoices")
              .select("total_amount, amount, tax_amount")
              .eq("clinic_id", c.id)
              .eq("status", "paid")
              .gte("created_at", firstOfMonth),
          ]);
          const revMTD = (invData ?? []).reduce(
            (s, i) => s + (i.total_amount ?? (i.amount ?? 0) + (i.tax_amount ?? 0)), 0
          );
          const chainInfo = c.chains as unknown as { name: string } | null;
          return {
            id:                  c.id,
            name:                c.name,
            location:            c.location,
            admin_email:         c.admin_email,
            subscription_status: c.subscription_status ?? "active",
            subscription_plan:   (c.subscription_plan ?? "growth") as Plan,
            chain_id:            c.chain_id,
            chain_name:          chainInfo?.name ?? null,
            gst_number:          c.gst_number,
            patient_count:       pCount ?? 0,
            revenue_mtd:         revMTD,
            billing_method:      cbMap[c.id] ?? null,
            created_at:          c.created_at,
          };
        })
      );
      setClinics(enriched);

      // KPIs
      const active = enriched.filter(c => c.subscription_status === "active");
      const pastDue = enriched.filter(c => c.subscription_status === "past_due");
      setActiveCnt(active.length);
      setPastDueCnt(pastDue.length);
      setMrr(active.reduce((s, c) => s + PLANS[c.subscription_plan].price, 0));
      setMtdRevenue(enriched.reduce((s, c) => s + c.revenue_mtd, 0));

      // 4. Chains with billing
      const { data: chainData } = await supabase
        .from("chains").select("id, name, created_at").order("created_at", { ascending: false });

      const { data: cbChainData } = await supabase
        .from("chain_billing_methods")
        .select("chain_id, method_type, grace_period_days, warning_days_before")
        .eq("is_active", true);

      type CbChainRow = { chain_id: string; method_type: string; grace_period_days: number; warning_days_before: number };
      const cbChainMap: Record<string, CbChainRow> = {};
      (cbChainData ?? []).forEach(r => { cbChainMap[r.chain_id] = r as CbChainRow; });

      const chainRows: ChainRow[] = (chainData ?? []).map(ch => {
        const bm = cbChainMap[ch.id];
        return {
          id:                  ch.id,
          name:                ch.name,
          clinic_count:        enriched.filter(c => c.chain_id === ch.id).length,
          billing_method:      bm?.method_type ?? null,
          grace_period_days:   bm?.grace_period_days ?? null,
          warning_days_before: bm?.warning_days_before ?? null,
        };
      });
      setChains(chainRows);

      // 5. Recent payments
      const { data: pmtData } = await supabase
        .from("subscription_payments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      // Resolve clinic/chain names
      const pmtRows: PaymentRow[] = (pmtData ?? []).map(p => ({
        ...p,
        clinic_name: enriched.find(c => c.id === p.clinic_id)?.name,
        chain_name:  chainRows.find(ch => ch.id === p.chain_id)?.name,
      }));
      setPayments(pmtRows);

    } catch (err) {
      console.error(err);
      toast.error("Failed to load billing data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!profileLoading) fetchAll(); }, [profileLoading, fetchAll]);

  // ── Actions ───────────────────────────────────────────────────────────────

  async function updatePlan(clinicId: string, plan: Plan) {
    setUpdatingId(clinicId);
    const { error } = await supabase
      .from("clinics").update({ subscription_plan: plan }).eq("id", clinicId);
    if (error) {
      toast.error("Failed to update plan");
    } else {
      setClinics(prev => prev.map(c => c.id === clinicId ? { ...c, subscription_plan: plan } : c));
      toast.success(`Plan changed to ${PLANS[plan].label}`);
    }
    setUpdatingId(null);
  }

  async function updateStatus(clinicId: string, status: Status) {
    setUpdatingId(clinicId);
    const { error } = await supabase
      .from("clinics").update({ subscription_status: status }).eq("id", clinicId);
    if (error) {
      toast.error("Failed to update status");
    } else {
      setClinics(prev => prev.map(c => c.id === clinicId ? { ...c, subscription_status: status } : c));
      const labels: Record<Status, string> = { active: "Activated", past_due: "Marked Past Due", canceled: "Suspended" };
      toast.success(labels[status]);
    }
    setUpdatingId(null);
  }

  // ── Guard ────────────────────────────────────────────────────────────────

  if (!profileLoading && profile?.role !== "superadmin") {
    return (
      <div className="min-h-full" style={{ background: "var(--background)" }}>
        <TopBar />
        <div className="flex items-center justify-center" style={{ minHeight: "60vh" }}>
          <p style={{ color: "var(--text-muted)" }}>Superadmin access required.</p>
        </div>
      </div>
    );
  }

  // ── Filtered lists ────────────────────────────────────────────────────────

  const filteredClinics = clinics.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.admin_email ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (c.location ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const pastDueClinics = clinics.filter(c => c.subscription_status === "past_due");

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full" style={{ background: "var(--background)" }}>
      <TopBar />

      <div className="px-6 py-6 max-w-[1440px] mx-auto space-y-6">

        {/* ── Page header ── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold uppercase tracking-widest"
                style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)" }}>
                Superadmin
              </span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>·</span>
              <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: "var(--text-muted)" }}>
                Platform Billing
              </span>
            </div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
              Billing &amp; Plans
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              Manage subscriptions, plans and payment methods across the network.
            </p>
          </div>
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ background: "rgba(197,160,89,0.08)", color: "var(--gold)", border: "1px solid rgba(197,160,89,0.2)" }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-4 gap-4">
          <KpiCard
            label="Monthly Recurring Revenue"
            value={fmt(mrr)}
            sub="from active subscriptions"
            Icon={TrendingUp}
            color="#C5A059"
            bg="rgba(197,160,89,0.08)"
            loading={loading}
          />
          <KpiCard
            label="MTD Collections"
            value={fmtFull(mtdRevenue)}
            sub="paid invoices this month"
            Icon={IndianRupee}
            color="#4A8A4A"
            bg="rgba(74,138,74,0.08)"
            loading={loading}
          />
          <KpiCard
            label="Active Subscriptions"
            value={activeCnt}
            sub={`of ${clinics.length} total clinics`}
            Icon={Building2}
            color="#2A4A8A"
            bg="rgba(42,74,138,0.08)"
            loading={loading}
          />
          <KpiCard
            label="Past Due / At Risk"
            value={pastDueCnt}
            sub={pastDueCnt > 0 ? "action required" : "all clear"}
            Icon={AlertTriangle}
            color={pastDueCnt > 0 ? "#D4A017" : "#4A8A4A"}
            bg={pastDueCnt > 0 ? "rgba(212,160,23,0.08)" : "rgba(74,138,74,0.08)"}
            loading={loading}
            alert={pastDueCnt > 0}
          />
        </div>

        {/* ── Past-due alert strip ── */}
        {!loading && pastDueClinics.length > 0 && (
          <div
            className="rounded-2xl p-4 flex items-start gap-4"
            style={{
              background: "rgba(212,160,23,0.06)",
              border: "1px solid rgba(212,160,23,0.3)",
            }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(212,160,23,0.15)" }}>
              <Bell size={16} color="#D4A017" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold mb-1" style={{ color: "#92600A", fontFamily: "Georgia, serif" }}>
                {pastDueClinics.length} clinic{pastDueClinics.length > 1 ? "s" : ""} overdue
              </p>
              <div className="flex flex-wrap gap-2">
                {pastDueClinics.map(c => (
                  <div key={c.id} className="flex items-center gap-1.5">
                    <span className="text-xs font-medium" style={{ color: "#92600A" }}>{c.name}</span>
                    <button
                      onClick={() => updateStatus(c.id, "active")}
                      className="text-xs px-2 py-0.5 rounded-full font-semibold transition-colors"
                      style={{ background: "rgba(74,138,74,0.15)", color: "#2A5A2A", border: "1px solid rgba(74,138,74,0.3)" }}
                    >
                      Reactivate
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Plan tiers overview ── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
            Plan Distribution
          </p>
          <div className="grid grid-cols-3 gap-4">
            {(Object.entries(PLANS) as [Plan, typeof PLANS[Plan]][]).map(([key, p]) => {
              const count = clinics.filter(c => c.subscription_plan === key).length;
              const mrrContrib = clinics
                .filter(c => c.subscription_plan === key && c.subscription_status === "active")
                .length * p.price;
              return (
                <div key={key} className="rounded-2xl p-5"
                  style={{ background: "var(--surface)", border: `1px solid ${p.border}` }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: p.bg }}>
                        <p.Icon size={16} style={{ color: p.color }} />
                      </div>
                      <div>
                        <p className="font-semibold text-sm" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>{p.label}</p>
                        <p className="text-xs" style={{ color: p.color }}>
                          {p.price === 0 ? "Free forever" : `${fmt(p.price)}/mo`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>{count}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>clinic{count !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <ul className="space-y-1 mb-3">
                    {p.features.map(f => (
                      <li key={f} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                        <CheckCircle2 size={10} style={{ color: p.color, flexShrink: 0 }} /> {f}
                      </li>
                    ))}
                  </ul>
                  {mrrContrib > 0 && (
                    <p className="text-xs font-semibold pt-2" style={{ color: p.color, borderTop: `1px solid ${p.border}` }}>
                      {fmt(mrrContrib)} MRR contribution
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div>
          <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {([
              { key: "clinics",  label: "Clinics",         count: clinics.length  },
              { key: "chains",   label: "Chains & Billing", count: chains.length   },
              { key: "payments", label: "Payment Log",      count: payments.length },
            ] as { key: TabKey; label: string; count: number }[]).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
                style={tab === t.key
                  ? { background: "linear-gradient(135deg, #C5A059, #A8853A)", color: "white" }
                  : { background: "transparent", color: "var(--text-muted)" }}
              >
                {t.label}
                <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                  style={tab === t.key
                    ? { background: "rgba(255,255,255,0.2)", color: "white" }
                    : { background: "var(--border)", color: "var(--text-muted)" }}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* ── CLINICS TAB ── */}
          {tab === "clinics" && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>

              {/* Table header + search */}
              <div className="px-5 py-4 flex items-center justify-between gap-4"
                style={{ borderBottom: "1px solid var(--border)" }}>
                <p className="font-semibold text-sm" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
                  All Clinics
                </p>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search clinics…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="text-sm rounded-xl pl-3 pr-9 py-2 outline-none"
                      style={{
                        background: "var(--background)",
                        border: "1px solid var(--border)",
                        color: "var(--foreground)",
                        width: 220,
                      }}
                    />
                    {search && (
                      <button onClick={() => setSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                        style={{ color: "var(--text-muted)" }}>✕</button>
                    )}
                  </div>
                  <p className="text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                    {filteredClinics.length} of {clinics.length}
                  </p>
                </div>
              </div>

              {loading ? <LoadingTable /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        {["Clinic", "Plan", "Status", "Payment Method", "Patients", "MTD Revenue", "Actions"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                            style={{ color: "var(--text-muted)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClinics.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>No clinics found.</td></tr>
                      ) : (
                        filteredClinics.map(c => {
                          const statusCfg = STATUS_CFG[c.subscription_status] ?? STATUS_CFG.active;
                          const planCfg  = PLANS[c.subscription_plan];
                          const isBusy   = updatingId === c.id;
                          const MethodIcon = c.billing_method ? METHOD_ICON[c.billing_method] : null;

                          return (
                            <tr key={c.id}
                              style={{ borderBottom: "1px solid var(--border)" }}
                              onMouseEnter={e => (e.currentTarget.style.background = "rgba(197,160,89,0.02)")}
                              onMouseLeave={e => (e.currentTarget.style.background = "")}>

                              {/* Clinic info */}
                              <td className="px-4 py-3.5" style={{ minWidth: 220 }}>
                                <p className="font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
                                  {c.name}
                                </p>
                                <div className="flex flex-col gap-0.5 mt-0.5">
                                  {c.location && (
                                    <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                                      <MapPin size={9} /> {c.location}
                                    </span>
                                  )}
                                  {c.admin_email && (
                                    <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                                      <Mail size={9} /> {c.admin_email}
                                    </span>
                                  )}
                                  {c.chain_name && (
                                    <span className="flex items-center gap-1 text-xs" style={{ color: "var(--gold)" }}>
                                      <Network size={9} /> {c.chain_name}
                                    </span>
                                  )}
                                  {c.gst_number && (
                                    <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)", fontFamily: "monospace" }}>
                                      <Hash size={9} /> {c.gst_number}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Plan selector */}
                              <td className="px-4 py-3.5" style={{ minWidth: 150 }}>
                                <div className="relative flex items-center gap-1.5">
                                  <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                                    style={{ background: planCfg.bg }}>
                                    <planCfg.Icon size={11} style={{ color: planCfg.color }} />
                                  </div>
                                  <div className="relative">
                                    <select
                                      value={c.subscription_plan}
                                      disabled={isBusy}
                                      onChange={e => updatePlan(c.id, e.target.value as Plan)}
                                      className="text-xs font-semibold rounded-lg pl-2 pr-6 py-1.5 outline-none appearance-none cursor-pointer"
                                      style={{
                                        background: planCfg.bg,
                                        color: planCfg.color,
                                        border: `1px solid ${planCfg.border}`,
                                        opacity: isBusy ? 0.5 : 1,
                                      }}>
                                      {(Object.keys(PLANS) as Plan[]).map(k => (
                                        <option key={k} value={k}>{PLANS[k].label}</option>
                                      ))}
                                    </select>
                                    <ChevronDown size={10} style={{ color: planCfg.color, position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                                  </div>
                                  {isBusy && <Loader2 size={12} style={{ color: "var(--gold)" }} className="animate-spin" />}
                                </div>
                              </td>

                              {/* Status badge + quick actions */}
                              <td className="px-4 py-3.5" style={{ minWidth: 140 }}>
                                <div className="flex flex-col gap-1.5">
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold w-fit"
                                    style={{ background: statusCfg.bg, color: statusCfg.text }}>
                                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: statusCfg.dot }} />
                                    {statusCfg.label}
                                  </span>
                                  {c.subscription_status !== "active" && (
                                    <button
                                      disabled={isBusy}
                                      onClick={() => updateStatus(c.id, "active")}
                                      className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full w-fit"
                                      style={{ background: "rgba(74,138,74,0.1)", color: "#2A5A2A", border: "1px solid rgba(74,138,74,0.2)" }}>
                                      <RotateCcw size={9} /> Activate
                                    </button>
                                  )}
                                  {c.subscription_status === "active" && (
                                    <button
                                      disabled={isBusy}
                                      onClick={() => updateStatus(c.id, "canceled")}
                                      className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full w-fit"
                                      style={{ background: "rgba(239,68,68,0.08)", color: "#8A1A1A", border: "1px solid rgba(239,68,68,0.2)" }}>
                                      <Ban size={9} /> Suspend
                                    </button>
                                  )}
                                </div>
                              </td>

                              {/* Billing method */}
                              <td className="px-4 py-3.5">
                                {MethodIcon && c.billing_method ? (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                                      style={{ background: "rgba(197,160,89,0.1)" }}>
                                      <MethodIcon size={12} style={{ color: "var(--gold)" }} />
                                    </div>
                                    <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                                      {METHOD_LABEL[c.billing_method]}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-xs italic" style={{ color: "var(--text-muted)" }}>Not set</span>
                                )}
                              </td>

                              {/* Patients */}
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-1.5">
                                  <Users size={13} style={{ color: "var(--text-muted)" }} />
                                  <span className="font-medium" style={{ color: "var(--foreground)" }}>
                                    {c.patient_count.toLocaleString("en-IN")}
                                  </span>
                                </div>
                              </td>

                              {/* MTD Revenue */}
                              <td className="px-4 py-3.5">
                                <p className="font-bold" style={{ color: "var(--gold)", fontFamily: "Georgia, serif" }}>
                                  {fmtFull(c.revenue_mtd)}
                                </p>
                                <p className="text-xs" style={{ color: "var(--text-muted)" }}>this month</p>
                              </td>

                              {/* Actions */}
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-1.5">
                                  {c.subscription_status === "active" && (
                                    <button
                                      disabled={isBusy}
                                      onClick={() => updateStatus(c.id, "past_due")}
                                      className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg whitespace-nowrap"
                                      style={{ background: "rgba(212,160,23,0.1)", color: "#92600A", border: "1px solid rgba(212,160,23,0.25)" }}>
                                      <AlertTriangle size={10} /> Mark Due
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── CHAINS TAB ── */}
          {tab === "chains" && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                <p className="font-semibold text-sm" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
                  Chain Billing Methods
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Auto-pay configuration per clinic chain
                </p>
              </div>

              {loading ? <LoadingTable /> : chains.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-3">
                  <Network size={32} style={{ color: "var(--gold)", opacity: 0.4 }} />
                  <p className="text-sm font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>No chains yet</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Create chains from Master Admin → Clinic Builder</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        {["Chain", "Clinics", "Billing Method", "Grace Period", "Warn Before"].map(h => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                            style={{ color: "var(--text-muted)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {chains.map(ch => {
                        const MethodIcon = ch.billing_method ? METHOD_ICON[ch.billing_method] : null;
                        return (
                          <tr key={ch.id}
                            style={{ borderBottom: "1px solid var(--border)" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(197,160,89,0.02)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "")}>

                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                  style={{ background: "rgba(197,160,89,0.1)", border: "1px solid rgba(197,160,89,0.2)" }}>
                                  <Network size={14} style={{ color: "var(--gold)" }} />
                                </div>
                                <p className="font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
                                  {ch.name}
                                </p>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex items-center gap-1.5">
                                <Building2 size={13} style={{ color: "var(--text-muted)" }} />
                                <span className="font-medium" style={{ color: "var(--foreground)" }}>
                                  {ch.clinic_count} clinic{ch.clinic_count !== 1 ? "s" : ""}
                                </span>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              {MethodIcon && ch.billing_method ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                    style={{ background: "rgba(197,160,89,0.1)", border: "1px solid rgba(197,160,89,0.2)" }}>
                                    <MethodIcon size={13} style={{ color: "var(--gold)" }} />
                                  </div>
                                  <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                                    {METHOD_LABEL[ch.billing_method]}
                                  </span>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                                  style={{ background: "rgba(138,128,120,0.1)", color: "var(--text-muted)" }}>
                                  Not configured
                                </span>
                              )}
                            </td>

                            <td className="px-5 py-4">
                              {ch.grace_period_days != null ? (
                                <div className="flex items-center gap-1.5">
                                  <Calendar size={12} style={{ color: "var(--text-muted)" }} />
                                  <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                                    {ch.grace_period_days} days
                                  </span>
                                </div>
                              ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                            </td>

                            <td className="px-5 py-4">
                              {ch.warning_days_before != null ? (
                                <div className="flex items-center gap-1.5">
                                  <Bell size={12} style={{ color: "#D4A017" }} />
                                  <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                                    {ch.warning_days_before} days prior
                                  </span>
                                </div>
                              ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── PAYMENTS TAB ── */}
          {tab === "payments" && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                <p className="font-semibold text-sm" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
                  Payment Log
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Recent subscription payment events
                </p>
              </div>

              {loading ? <LoadingTable /> : payments.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-3">
                  <Receipt size={32} style={{ color: "var(--gold)", opacity: 0.4 }} />
                  <p className="text-sm font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>No payment records yet</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Payments will appear here once processed</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        {["Date", "Clinic / Chain", "Amount", "Method", "Status"].map(h => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                            style={{ color: "var(--text-muted)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map(p => {
                        const statusCfg = STATUS_CFG[p.status] ?? STATUS_CFG.active;
                        const MethodIcon = p.method ? METHOD_ICON[p.method] : null;
                        const dateStr = new Date(p.paid_at ?? p.created_at).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric",
                        });
                        return (
                          <tr key={p.id}
                            style={{ borderBottom: "1px solid var(--border)" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(197,160,89,0.02)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "")}>

                            <td className="px-5 py-3.5 text-xs" style={{ color: "var(--text-muted)" }}>
                              {dateStr}
                            </td>

                            <td className="px-5 py-3.5">
                              <p className="font-semibold text-sm" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
                                {p.clinic_name ?? p.chain_name ?? "—"}
                              </p>
                              {p.chain_name && p.clinic_name && (
                                <p className="text-xs" style={{ color: "var(--gold)" }}>
                                  <Network size={9} className="inline mr-1" />{p.chain_name}
                                </p>
                              )}
                            </td>

                            <td className="px-5 py-3.5 font-bold"
                              style={{ color: "var(--gold)", fontFamily: "Georgia, serif" }}>
                              {fmtFull(p.amount)}
                            </td>

                            <td className="px-5 py-3.5">
                              {MethodIcon && p.method ? (
                                <div className="flex items-center gap-1.5">
                                  <MethodIcon size={13} style={{ color: "var(--text-muted)" }} />
                                  <span className="text-xs" style={{ color: "var(--foreground)" }}>
                                    {METHOD_LABEL[p.method]}
                                  </span>
                                </div>
                              ) : <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>}
                            </td>

                            <td className="px-5 py-3.5">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                                style={{ background: statusCfg.bg, color: statusCfg.text }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusCfg.dot }} />
                                {statusCfg.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, Icon, color, bg, loading, alert = false,
}: {
  label: string; value: string | number; sub: string;
  Icon: React.ElementType; color: string; bg: string;
  loading: boolean; alert?: boolean;
}) {
  return (
    <div className="rounded-2xl p-5"
      style={{
        background: "var(--surface)",
        border: alert ? `1px solid rgba(212,160,23,0.4)` : "1px solid var(--border)",
        boxShadow: alert ? "0 0 0 3px rgba(212,160,23,0.08)" : "none",
      }}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-widest leading-tight" style={{ color: "var(--text-muted)" }}>
          {label}
        </p>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      {loading ? (
        <div className="h-8 w-24 rounded-lg animate-pulse" style={{ background: "var(--border)" }} />
      ) : (
        <p className="text-2xl font-bold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
          {value}
        </p>
      )}
      <p className="text-xs mt-1" style={{ color: alert ? "#92600A" : "var(--text-muted)" }}>{sub}</p>
    </div>
  );
}

function LoadingTable() {
  return (
    <div className="p-6 space-y-3 animate-pulse">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg" style={{ background: "var(--border)" }} />
          <div className="flex-1 h-4 rounded" style={{ background: "var(--border)" }} />
          <div className="w-20 h-4 rounded" style={{ background: "var(--border)" }} />
          <div className="w-16 h-4 rounded" style={{ background: "var(--border)" }} />
        </div>
      ))}
    </div>
  );
}
