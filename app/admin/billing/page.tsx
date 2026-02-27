"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CreditCard, Users, Building2,
  CheckCircle2, ChevronRight,
  IndianRupee, Crown, Zap, Shield, Loader2, RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import { toast } from "sonner";
import TopBar from "@/components/TopBar";

// ── Types ─────────────────────────────────────────────────────────────────────

type SubscriptionPlan = "free" | "growth" | "enterprise";

interface ClinicBilling {
  id:                  string;
  name:                string;
  location:            string | null;
  admin_email:         string | null;
  subscription_status: string | null;
  plan:                SubscriptionPlan;
  patient_count:       number;
  revenue_mtd:         number;
  created_at:          string;
}

// ── Plan config ───────────────────────────────────────────────────────────────

const PLANS: Record<SubscriptionPlan, {
  label: string; price: number; color: string; bg: string; border: string;
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

const STATUS_BADGE: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  active:    { label: "Active",    bg: "#EFF6EF", text: "#2A5A2A", dot: "#4A8A4A" },
  trial:     { label: "Trial",     bg: "#FFF8E8", text: "#92600A", dot: "#D4A017" },
  inactive:  { label: "Inactive",  bg: "#F5F5F3", text: "#6B6456", dot: "#9C9584" },
  suspended: { label: "Suspended", bg: "#FEF2F2", text: "#8A1A1A", dot: "#EF4444" },
};

const fmt = (n: number) =>
  "₹" + (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminBillingPage() {
  const { profile, loading: profileLoading } = useClinic();

  const [clinics,  setClinics]  = useState<ClinicBilling[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [planMap,  setPlanMap]  = useState<Record<string, SubscriptionPlan>>({});

  const [totalRev,    setTotalRev]    = useState(0);
  const [totalPats,   setTotalPats]   = useState(0);
  const [activeCnt,   setActiveCnt]   = useState(0);

  // ── Load data ──

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: clinicData, error } = await supabase
        .from("clinics")
        .select("id, name, location, admin_email, subscription_status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      const enriched: ClinicBilling[] = await Promise.all(
        (clinicData ?? []).map(async (c) => {
          const [{ count: pCount }, { data: invData }] = await Promise.all([
            supabase
              .from("patients")
              .select("*", { count: "exact", head: true })
              .eq("clinic_id", c.id),
            supabase
              .from("pending_invoices")
              .select("total_amount, amount, tax_amount")
              .eq("clinic_id", c.id)
              .eq("status", "paid")
              .gte("created_at", firstOfMonth),
          ]);
          const revMTD = (invData ?? []).reduce(
            (s, i) => s + (i.total_amount ?? i.amount + (i.tax_amount ?? 0)),
            0
          );
          return {
            ...c,
            plan:          planMap[c.id] ?? "growth",
            patient_count: pCount ?? 0,
            revenue_mtd:   revMTD,
          };
        })
      );

      setClinics(enriched);
      setTotalRev(enriched.reduce((s, c) => s + c.revenue_mtd, 0));
      setTotalPats(enriched.reduce((s, c) => s + c.patient_count, 0));
      setActiveCnt(enriched.filter(c => !c.subscription_status || c.subscription_status === "active").length);
    } catch {
      toast.error("Failed to load platform billing data");
    } finally {
      setLoading(false);
    }
  }, [planMap]);

  useEffect(() => {
    if (!profileLoading) fetchData();
  }, [fetchData, profileLoading]);

  // Guard
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

  const updatePlan = (clinicId: string, plan: SubscriptionPlan) => {
    setPlanMap(prev => ({ ...prev, [clinicId]: plan }));
    toast.success(`Plan updated to ${PLANS[plan].label}`);
  };

  return (
    <div className="min-h-full" style={{ background: "var(--background)" }}>
      <TopBar />
      <div className="px-6 py-6 max-w-[1400px] mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-xs px-2 py-0.5 rounded-full font-semibold uppercase tracking-widest"
                style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)" }}
              >
                Superadmin
              </span>
            </div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
              Platform Billing
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              Subscription plans and revenue across all clinics
            </p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium"
            style={{ background: "rgba(197,160,89,0.08)", color: "var(--gold)", border: "1px solid rgba(197,160,89,0.2)" }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* ── Platform stats ── */}
        <div className="grid grid-cols-3 gap-4">
          {([
            { label: "MTD Platform Revenue", value: fmt(totalRev), Icon: IndianRupee, color: "#C5A059", bg: "rgba(197,160,89,0.08)" },
            { label: "Total Patients",        value: totalPats,     Icon: Users,       color: "#4A8A4A", bg: "rgba(74,138,74,0.08)"  },
            { label: "Active Clinics",        value: activeCnt,     Icon: Building2,   color: "#2A4A8A", bg: "rgba(42,74,138,0.08)"  },
          ] as const).map(c => (
            <div key={c.label} className="rounded-2xl p-5"
              style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{c.label}</p>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: c.bg }}>
                  <c.Icon size={16} style={{ color: c.color }} />
                </div>
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
                {c.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── Plan tiers ── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
            Available Plans
          </p>
          <div className="grid grid-cols-3 gap-4">
            {(Object.entries(PLANS) as [SubscriptionPlan, typeof PLANS[SubscriptionPlan]][]).map(([key, p]) => {
              const count = clinics.filter(c => (planMap[c.id] ?? "growth") === key).length;
              return (
                <div key={key} className="rounded-2xl p-5"
                  style={{ background: "var(--card-bg)", border: `1px solid ${p.border}` }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: p.bg }}>
                      <p.Icon size={16} style={{ color: p.color }} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
                        {p.label}
                      </p>
                      <p className="text-xs" style={{ color: p.color }}>
                        {p.price === 0 ? "Free forever" : `₹${p.price.toLocaleString("en-IN")}/mo`}
                      </p>
                    </div>
                  </div>
                  <ul className="space-y-1.5 mb-3">
                    {p.features.map(f => (
                      <li key={f} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                        <CheckCircle2 size={11} style={{ color: p.color, flexShrink: 0 }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs font-semibold" style={{ color: p.color }}>
                    {count} clinic{count !== 1 ? "s" : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Clinics table ── */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-4 border-b flex items-center justify-between"
            style={{ borderColor: "var(--border)" }}>
            <p className="font-semibold text-sm" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
              All Clinics
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {clinics.length} clinic{clinics.length !== 1 ? "s" : ""}
            </p>
          </div>

          {loading ? (
            <div className="p-10 flex items-center justify-center">
              <Loader2 size={24} className="animate-spin" style={{ color: "var(--gold)" }} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Clinic","Location","Status","Plan","Patients","MTD Revenue",""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                        style={{ color: "var(--text-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clinics.map(c => {
                    const statusKey = c.subscription_status ?? "active";
                    const badge     = STATUS_BADGE[statusKey] ?? STATUS_BADGE.active;
                    const plan      = planMap[c.id] ?? "growth";
                    const planCfg   = PLANS[plan];

                    return (
                      <tr key={c.id}
                        style={{ borderBottom: "1px solid var(--border)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(197,160,89,0.025)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "")}>

                        {/* Clinic */}
                        <td className="px-4 py-3.5">
                          <p className="font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>{c.name}</p>
                          {c.admin_email && (
                            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{c.admin_email}</p>
                          )}
                        </td>

                        {/* Location */}
                        <td className="px-4 py-3.5 text-xs" style={{ color: "var(--text-muted)" }}>
                          {c.location ?? "—"}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                            style={{ background: badge.bg, color: badge.text }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: badge.dot }} />
                            {badge.label}
                          </span>
                        </td>

                        {/* Plan */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded flex items-center justify-center"
                              style={{ background: planCfg.bg }}>
                              <planCfg.Icon size={11} style={{ color: planCfg.color }} />
                            </div>
                            <select
                              value={plan}
                              onChange={e => updatePlan(c.id, e.target.value as SubscriptionPlan)}
                              className="text-xs font-semibold px-2 py-1 rounded-lg outline-none"
                              style={{ background: planCfg.bg, color: planCfg.color, border: `1px solid ${planCfg.border}` }}>
                              {(Object.keys(PLANS) as SubscriptionPlan[]).map(k => (
                                <option key={k} value={k}>{PLANS[k].label}</option>
                              ))}
                            </select>
                          </div>
                        </td>

                        {/* Patients */}
                        <td className="px-4 py-3.5 font-medium" style={{ color: "var(--foreground)" }}>
                          {c.patient_count.toLocaleString("en-IN")}
                        </td>

                        {/* Revenue */}
                        <td className="px-4 py-3.5 font-bold" style={{ color: "var(--gold)", fontFamily: "Georgia, serif" }}>
                          {fmt(c.revenue_mtd)}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5">
                          <button className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg"
                            style={{ background: "rgba(197,160,89,0.08)", color: "var(--gold)", border: "1px solid rgba(197,160,89,0.2)" }}>
                            View <ChevronRight size={11} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
