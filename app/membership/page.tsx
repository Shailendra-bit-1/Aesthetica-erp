"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import TopBar from "@/components/TopBar";
import {
  Star, Plus, X, ChevronDown, Wallet, Users, Crown,
  Check, Pause, Trash2, Gift, Edit2, Search, Trophy, Zap, TrendingUp,
} from "lucide-react";

type DurationType = "monthly" | "quarterly" | "annual" | "lifetime";
type MembershipStatus = "active" | "expired" | "cancelled" | "paused";

interface LoyaltyTier {
  id: string;
  name: string;
  min_points: number;
  color: string;
  icon: string | null;
  benefits: Array<{ label: string }> | null;
}

interface LoyaltyActivity {
  id: string;
  patient_id: string;
  type: string;
  points: number;
  balance_after: number;
  reason: string | null;
  created_at: string;
  patients: { full_name: string } | null;
}

interface MembershipPlan {
  id: string;
  name: string;
  duration_type: DurationType;
  price: number;
  benefits: Array<{ type: "discount" | "wallet_credit" | "service"; value: number; service_id?: string; label?: string }>;
  max_members: number | null;
  is_global: boolean;
  is_active: boolean;
}

interface PatientMembership {
  id: string;
  patient_id: string;
  plan_id: string;
  status: MembershipStatus;
  started_at: string;
  expires_at: string | null;
  auto_renew: boolean;
  membership_plans: { name: string; price: number; duration_type: DurationType };
  patients: { full_name: string; wallet_balance: number };
}

interface WalletTxn {
  id: string;
  patient_id: string;
  type: "credit" | "debit" | "refund" | "expiry";
  amount: number;
  balance_after: number;
  reason: string | null;
  created_at: string;
  patients: { full_name: string };
}

const DURATION_LABELS: Record<DurationType, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
  lifetime: "Lifetime",
};

const STATUS_COLORS: Record<MembershipStatus, { bg: string; color: string; label: string }> = {
  active:    { bg: "rgba(34,197,94,0.12)",  color: "#16a34a", label: "Active" },
  expired:   { bg: "rgba(239,68,68,0.12)",  color: "#dc2626", label: "Expired" },
  cancelled: { bg: "rgba(107,114,128,0.12)",color: "#6b7280", label: "Cancelled" },
  paused:    { bg: "rgba(234,179,8,0.12)",  color: "#ca8a04", label: "Paused" },
};

const TXN_COLORS: Record<string, { bg: string; color: string }> = {
  credit:  { bg: "rgba(34,197,94,0.12)",  color: "#16a34a" },
  debit:   { bg: "rgba(239,68,68,0.12)",  color: "#dc2626" },
  refund:  { bg: "rgba(59,130,246,0.12)", color: "#2563eb" },
  expiry:  { bg: "rgba(107,114,128,0.12)",color: "#6b7280" },
};

export default function MembershipPage() {
  const { profile, activeClinicId } = useClinic();

  const [tab, setTab] = useState<"plans" | "members" | "wallet" | "loyalty">("plans");
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [memberships, setMemberships] = useState<PatientMembership[]>([]);
  const [walletTxns, setWalletTxns] = useState<WalletTxn[]>([]);
  const [loading, setLoading] = useState(true);

  // Drawer state
  const [planDrawer, setPlanDrawer] = useState(false);
  const [assignDrawer, setAssignDrawer] = useState(false);
  const [walletDrawer, setWalletDrawer] = useState(false);
  const [editPlan, setEditPlan] = useState<MembershipPlan | null>(null);

  // Plan form
  const [planForm, setPlanForm] = useState({
    name: "", duration_type: "monthly" as DurationType, price: "", is_global: false, max_members: "",
    benefits: [] as Array<{ type: "discount" | "wallet_credit" | "service"; value: string; label: string }>,
  });

  // Assign form
  const [assignForm, setAssignForm] = useState({ patient_search: "", patient_id: "", plan_id: "", auto_renew: true });
  const [patientResults, setPatientResults] = useState<Array<{ id: string; full_name: string }>>([]);

  // Wallet form
  const [walletForm, setWalletForm] = useState({ patient_search: "", patient_id: "", patient_name: "", amount: "", reason: "" });
  const [walletPatientResults, setWalletPatientResults] = useState<Array<{ id: string; full_name: string; wallet_balance: number }>>([]);

  const [saving, setSaving] = useState(false);
  const [searchPatient, setSearchPatient] = useState("");

  // C5: Loyalty tab state
  const [loyaltyTiers,    setLoyaltyTiers]    = useState<LoyaltyTier[]>([]);
  const [loyaltyActivity, setLoyaltyActivity] = useState<LoyaltyActivity[]>([]);
  const [loyaltyStats,    setLoyaltyStats]    = useState({ totalEarned: 0, totalRedeemed: 0, activePatients: 0 });

  const clinicId = activeClinicId || profile?.clinic_id;

  const fetchPlans = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase
      .from("membership_plans")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false });
    setPlans(data || []);
  }, [clinicId, supabase]);

  const fetchMemberships = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase
      .from("patient_memberships")
      .select("*, membership_plans(name, price, duration_type), patients(full_name, wallet_balance)")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false });
    setMemberships((data as PatientMembership[]) || []);
  }, [clinicId, supabase]);

  const fetchWalletTxns = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase
      .from("wallet_transactions")
      .select("*, patients(full_name)")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(100);
    setWalletTxns((data as WalletTxn[]) || []);
  }, [clinicId, supabase]);

  const fetchLoyaltyData = useCallback(async () => {
    if (!clinicId) return;
    const [{ data: tiers }, { data: activity }] = await Promise.all([
      supabase.from("loyalty_tiers").select("*").or(`is_global.eq.true,clinic_id.eq.${clinicId}`).order("min_points"),
      supabase.from("loyalty_points_ledger").select("*, patients(full_name)")
        .eq("clinic_id", clinicId).order("created_at", { ascending: false }).limit(50),
    ]);
    setLoyaltyTiers((tiers as LoyaltyTier[]) || []);
    const acts = (activity as LoyaltyActivity[]) || [];
    setLoyaltyActivity(acts);
    const earned   = acts.filter(a => a.type === "earn").reduce((s, a) => s + a.points, 0);
    const redeemed = acts.filter(a => a.type === "redeem").reduce((s, a) => s + a.points, 0);
    const uniquePts = new Set(acts.map(a => a.patient_id)).size;
    setLoyaltyStats({ totalEarned: earned, totalRedeemed: redeemed, activePatients: uniquePts });
  }, [clinicId, supabase]);

  useEffect(() => {
    if (!clinicId) return;
    setLoading(true);
    // Auto-expire memberships past their expires_at before fetching
    supabase.rpc("update_expired_memberships").then(() => {
      Promise.all([fetchPlans(), fetchMemberships(), fetchWalletTxns(), fetchLoyaltyData()]).finally(() => setLoading(false));
    });
  }, [clinicId, fetchPlans, fetchMemberships, fetchWalletTxns, fetchLoyaltyData]);

  const openNewPlan = () => {
    setEditPlan(null);
    setPlanForm({ name: "", duration_type: "monthly", price: "", is_global: false, max_members: "", benefits: [] });
    setPlanDrawer(true);
  };

  const openEditPlan = (plan: MembershipPlan) => {
    setEditPlan(plan);
    setPlanForm({
      name: plan.name, duration_type: plan.duration_type, price: String(plan.price),
      is_global: plan.is_global, max_members: plan.max_members ? String(plan.max_members) : "",
      benefits: plan.benefits.map(b => ({ type: b.type, value: String(b.value), label: b.label || "" })),
    });
    setPlanDrawer(true);
  };

  const savePlan = async () => {
    if (!clinicId || !planForm.name) return;
    setSaving(true);
    const payload = {
      clinic_id: clinicId,
      name: planForm.name,
      duration_type: planForm.duration_type,
      price: parseFloat(planForm.price) || 0,
      is_global: planForm.is_global,
      max_members: planForm.max_members ? parseInt(planForm.max_members) : null,
      benefits: planForm.benefits.map(b => ({ type: b.type, value: parseFloat(b.value) || 0, label: b.label })),
    };
    if (editPlan) {
      await supabase.from("membership_plans").update(payload).eq("id", editPlan.id);
    } else {
      await supabase.from("membership_plans").insert(payload);
    }
    setSaving(false);
    setPlanDrawer(false);
    fetchPlans();
  };

  const deletePlan = async (id: string) => {
    if (!confirm("Delete this plan?")) return;
    await supabase.from("membership_plans").delete().eq("id", id);
    fetchPlans();
  };

  const searchPatients = async (q: string) => {
    if (!clinicId || q.length < 2) { setPatientResults([]); return; }
    const { data } = await supabase.from("patients").select("id, full_name")
      .eq("clinic_id", clinicId).ilike("full_name", `%${q}%`).limit(5);
    setPatientResults(data || []);
  };

  const assignMembership = async () => {
    if (!clinicId || !assignForm.patient_id || !assignForm.plan_id) return;
    setSaving(true);
    const plan = plans.find(p => p.id === assignForm.plan_id);
    let expires_at: string | null = null;
    if (plan && plan.duration_type !== "lifetime") {
      const d = new Date();
      if (plan.duration_type === "monthly") d.setMonth(d.getMonth() + 1);
      else if (plan.duration_type === "quarterly") d.setMonth(d.getMonth() + 3);
      else if (plan.duration_type === "annual") d.setFullYear(d.getFullYear() + 1);
      expires_at = d.toISOString().split("T")[0];
    }
    try {
      // C-4 fix: RPC checks for duplicate active membership before inserting
      const { error } = await supabase.rpc("assign_membership_safe", {
        p_patient_id: assignForm.patient_id,
        p_plan_id:    assignForm.plan_id,
        p_clinic_id:  clinicId,
        p_auto_renew: assignForm.auto_renew,
        p_started_at: new Date().toISOString().split("T")[0],
        p_expires_at: expires_at,
      });
      if (error) throw error;
      setAssignDrawer(false);
      setAssignForm({ patient_search: "", patient_id: "", plan_id: "", auto_renew: true });
      fetchMemberships();
    } catch (e: unknown) {
      alert((e as Error).message ?? "Failed to assign membership");
    } finally {
      setSaving(false);
    }
  };

  const cancelMembership = async (id: string) => {
    if (!confirm("Cancel this membership?")) return;
    await supabase.from("patient_memberships").update({ status: "cancelled" }).eq("id", id);
    fetchMemberships();
  };

  const pauseMembership = async (id: string) => {
    await supabase.from("patient_memberships").update({ status: "paused" }).eq("id", id);
    fetchMemberships();
  };

  const searchWalletPatients = async (q: string) => {
    if (!clinicId || q.length < 2) { setWalletPatientResults([]); return; }
    const { data } = await supabase.from("patients").select("id, full_name, wallet_balance")
      .eq("clinic_id", clinicId).ilike("full_name", `%${q}%`).limit(5);
    setWalletPatientResults(data || []);
  };

  const addWalletCredit = async () => {
    if (!clinicId || !walletForm.patient_id || !walletForm.amount) return;
    setSaving(true);
    try {
      const amount = parseFloat(walletForm.amount);
      if (isNaN(amount) || amount <= 0) throw new Error("Amount must be a positive number");

      // Atomic read-modify-write via DB function (GAP-4: eliminates race condition)
      const { error } = await supabase.rpc("add_wallet_credit", {
        p_patient_id:     walletForm.patient_id,
        p_clinic_id:      clinicId,
        p_amount:         amount,
        p_reason:         walletForm.reason || "Manual credit",
        p_reference_id:   null,
        p_reference_type: "manual",
        p_actor_id:       profile?.id ?? null,
      });
      if (error) throw error;

      setWalletDrawer(false);
      setWalletForm({ patient_search: "", patient_id: "", patient_name: "", amount: "", reason: "" });
      fetchWalletTxns();
      fetchMemberships();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to add wallet credit";
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const filteredMembers = memberships.filter(m =>
    !searchPatient || m.patients?.full_name?.toLowerCase().includes(searchPatient.toLowerCase())
  );

  // H-8 fix: block non-admin roles from managing memberships
  const ALLOWED_ROLES = ["superadmin", "chain_admin", "clinic_admin"];
  if (profile && !ALLOWED_ROLES.includes(profile.role ?? "")) {
    return (
      <div className="flex flex-col h-screen" style={{ background: "#F9F7F2" }}>
        <TopBar />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#6b7280", fontFamily: "Georgia, serif" }}>You don&apos;t have permission to manage memberships.</p>
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
          {(["plans", "members", "wallet", "loyalty"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize"
              style={tab === t
                ? { background: "var(--gold)", color: "#fff", fontFamily: "Georgia, serif" }
                : { color: "rgba(197,160,89,0.7)" }}
            >
              {t === "plans" ? "Plans" : t === "members" ? "Members" : t === "wallet" ? "Wallet" : "Loyalty"}
            </button>
          ))}
        </div>

        {/* PLANS TAB */}
        {tab === "plans" && (
          <div>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Membership Plans</h2>
              <button onClick={openNewPlan}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: "var(--gold)" }}>
                <Plus size={15} /> New Plan
              </button>
            </div>
            {loading ? (
              <div className="grid grid-cols-3 gap-4">
                {[1,2,3].map(n => <div key={n} className="h-48 rounded-xl animate-pulse" style={{ background: "rgba(197,160,89,0.06)" }} />)}
              </div>
            ) : plans.length === 0 ? (
              <div className="text-center py-16" style={{ color: "rgba(197,160,89,0.5)" }}>
                <Star size={40} className="mx-auto mb-3 opacity-30" />
                <p style={{ fontFamily: "Georgia, serif" }}>No plans yet — create your first membership plan</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {plans.map(plan => (
                  <div key={plan.id} className="rounded-xl p-5" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>{plan.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: "rgba(197,160,89,0.8)" }}>{DURATION_LABELS[plan.duration_type]}</p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openEditPlan(plan)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><Edit2 size={13} style={{ color: "#6b7280" }} /></button>
                        <button onClick={() => deletePlan(plan.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={13} style={{ color: "#ef4444" }} /></button>
                      </div>
                    </div>
                    <p className="text-2xl font-bold mb-3" style={{ color: "var(--gold)", fontFamily: "Georgia, serif" }}>₹{plan.price.toLocaleString()}</p>
                    {plan.benefits.length > 0 && (
                      <div className="space-y-1.5">
                        {plan.benefits.slice(0, 3).map((b, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs" style={{ color: "#4b5563" }}>
                            <Check size={11} style={{ color: "#16a34a" }} />
                            <span>{b.label || `${b.type}: ${b.value}`}</span>
                          </div>
                        ))}
                        {plan.benefits.length > 3 && <p className="text-xs" style={{ color: "#9ca3af" }}>+{plan.benefits.length - 3} more benefits</p>}
                      </div>
                    )}
                    {plan.max_members && <p className="text-xs mt-2" style={{ color: "#9ca3af" }}>Max {plan.max_members} members</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MEMBERS TAB */}
        {tab === "members" && (
          <div>
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Active Members</h2>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9ca3af" }} />
                  <input value={searchPatient} onChange={e => setSearchPatient(e.target.value)}
                    placeholder="Search patient…" className="pl-8 pr-3 py-1.5 rounded-lg text-sm border bg-white outline-none"
                    style={{ borderColor: "rgba(197,160,89,0.2)", width: 200 }} />
                </div>
              </div>
              <button onClick={() => setAssignDrawer(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: "var(--gold)" }}>
                <Plus size={15} /> Assign Membership
              </button>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(197,160,89,0.1)", background: "rgba(197,160,89,0.04)" }}>
                    {["Patient", "Plan", "Started", "Expires", "Status", "Wallet", "Actions"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: "rgba(197,160,89,0.7)", letterSpacing: "0.05em" }}>{h.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map(m => {
                    const sc = STATUS_COLORS[m.status];
                    return (
                      <tr key={m.id} style={{ borderBottom: "1px solid rgba(197,160,89,0.06)" }}>
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: "#1a1714" }}>{m.patients?.full_name}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>{m.membership_plans?.name}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>{new Date(m.started_at).toLocaleDateString("en-IN")}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>{m.expires_at ? new Date(m.expires_at).toLocaleDateString("en-IN") : "Lifetime"}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: "#1a1714" }}>₹{(m.patients?.wallet_balance || 0).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {m.status === "active" && (
                              <button onClick={() => pauseMembership(m.id)} className="p-1.5 rounded hover:bg-yellow-50 transition-colors" title="Pause"><Pause size={12} style={{ color: "#ca8a04" }} /></button>
                            )}
                            <button onClick={() => cancelMembership(m.id)} className="p-1.5 rounded hover:bg-red-50 transition-colors" title="Cancel"><X size={12} style={{ color: "#ef4444" }} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredMembers.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-sm" style={{ color: "#9ca3af" }}>No memberships found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* LOYALTY TAB */}
        {tab === "loyalty" && (
          <div className="space-y-6">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Points Earned",    value: loyaltyStats.totalEarned.toLocaleString(),    icon: TrendingUp, color: "#16a34a" },
                { label: "Points Redeemed",  value: loyaltyStats.totalRedeemed.toLocaleString(),  icon: Zap,        color: "#2563eb" },
                { label: "Active Earners",   value: loyaltyStats.activePatients.toLocaleString(), icon: Users,      color: "#C5A059" },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-4 flex items-center gap-3" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}18` }}>
                    <s.icon size={16} style={{ color: s.color }} />
                  </div>
                  <div>
                    <p className="text-xl font-bold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>{s.value}</p>
                    <p className="text-xs" style={{ color: "#6b7280" }}>{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Tier progression */}
            <div className="rounded-xl p-5" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Trophy size={16} style={{ color: "var(--gold)" }} />
                <h3 className="font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Tier Progression</h3>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(197,160,89,0.1)", color: "#8B6914" }}>100 pts = ₹10 reward value</span>
              </div>
              {loyaltyTiers.length === 0 ? (
                <p className="text-sm" style={{ color: "#9ca3af" }}>No tiers configured</p>
              ) : (
                <div className="flex gap-3">
                  {loyaltyTiers.map((tier, i) => {
                    const nextTier = loyaltyTiers[i + 1];
                    const COLORS: Record<string, { bg: string; text: string; border: string }> = {
                      "#CD7F32": { bg: "rgba(205,127,50,0.1)",  text: "#8B5A2B", border: "rgba(205,127,50,0.35)" },
                      "#C0C0C0": { bg: "rgba(148,163,184,0.1)", text: "#475569", border: "rgba(148,163,184,0.4)" },
                      "#FFD700": { bg: "rgba(197,160,89,0.1)",  text: "#8B6914", border: "rgba(197,160,89,0.4)" },
                      "#E5E4E2": { bg: "rgba(139,126,200,0.1)", text: "#6B5FAA", border: "rgba(139,126,200,0.4)" },
                    };
                    const c = COLORS[tier.color] ?? { bg: "rgba(120,130,140,0.08)", text: "#6B7280", border: "rgba(120,130,140,0.25)" };
                    return (
                      <div key={tier.id} className="flex-1 rounded-xl p-4" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span style={{ fontSize: 18 }}>{tier.icon || "⭐"}</span>
                          <span className="font-bold text-sm" style={{ fontFamily: "Georgia, serif", color: c.text }}>{tier.name}</span>
                        </div>
                        <p className="text-xs font-semibold mb-1" style={{ color: c.text }}>{tier.min_points.toLocaleString()} pts+</p>
                        {nextTier && <p className="text-xs" style={{ color: "#9ca3af" }}>Up to {(nextTier.min_points - 1).toLocaleString()} pts</p>}
                        {tier.benefits && tier.benefits.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {tier.benefits.slice(0, 2).map((b, j) => (
                              <div key={j} className="flex items-center gap-1.5 text-xs" style={{ color: c.text }}>
                                <Check size={9} /> {b.label}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent activity */}
            <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
              <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(197,160,89,0.1)" }}>
                <h3 className="font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Recent Activity</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr style={{ background: "rgba(197,160,89,0.04)" }}>
                    {["Date", "Patient", "Type", "Points", "Balance After", "Reason"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: "rgba(197,160,89,0.7)", letterSpacing: "0.05em" }}>{h.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loyaltyActivity.map(a => (
                    <tr key={a.id} style={{ borderTop: "1px solid rgba(197,160,89,0.06)" }}>
                      <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>{new Date(a.created_at).toLocaleDateString("en-IN")}</td>
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: "#1a1714" }}>{a.patients?.full_name || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 rounded-full font-medium capitalize" style={{
                          background: a.type === "earn" ? "rgba(34,197,94,0.12)" : a.type === "redeem" ? "rgba(59,130,246,0.12)" : "rgba(107,114,128,0.1)",
                          color: a.type === "earn" ? "#16a34a" : a.type === "redeem" ? "#2563eb" : "#6b7280",
                        }}>{a.type}</span>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold" style={{ color: a.type === "earn" ? "#16a34a" : "#dc2626" }}>
                        {a.type === "earn" ? "+" : "-"}{Math.abs(a.points)}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>{a.balance_after.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: "#6b7280" }}>{a.reason || "—"}</td>
                    </tr>
                  ))}
                  {loyaltyActivity.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-sm" style={{ color: "#9ca3af" }}>No loyalty activity yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* WALLET TAB */}
        {tab === "wallet" && (
          <div>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Wallet Transactions</h2>
              <button onClick={() => setWalletDrawer(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: "var(--gold)" }}>
                <Wallet size={15} /> Add Credit
              </button>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(197,160,89,0.1)", background: "rgba(197,160,89,0.04)" }}>
                    {["Date", "Patient", "Type", "Amount", "Balance After", "Reason"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: "rgba(197,160,89,0.7)", letterSpacing: "0.05em" }}>{h.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {walletTxns.map(txn => {
                    const tc = TXN_COLORS[txn.type];
                    return (
                      <tr key={txn.id} style={{ borderBottom: "1px solid rgba(197,160,89,0.06)" }}>
                        <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>{new Date(txn.created_at).toLocaleDateString("en-IN")}</td>
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: "#1a1714" }}>{txn.patients?.full_name}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-1 rounded-full font-medium capitalize" style={{ background: tc.bg, color: tc.color }}>{txn.type}</span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: txn.type === "credit" || txn.type === "refund" ? "#16a34a" : "#dc2626" }}>
                          {txn.type === "credit" || txn.type === "refund" ? "+" : "-"}₹{txn.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>₹{txn.balance_after.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: "#6b7280" }}>{txn.reason || "—"}</td>
                      </tr>
                    );
                  })}
                  {walletTxns.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-sm" style={{ color: "#9ca3af" }}>No transactions yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* PLAN DRAWER */}
      {planDrawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setPlanDrawer(false)} />
          <div className="w-[480px] h-full overflow-y-auto flex flex-col" style={{ background: "#fff" }}>
            <div className="flex justify-between items-center px-6 py-5" style={{ borderBottom: "1px solid rgba(197,160,89,0.15)" }}>
              <h3 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>{editPlan ? "Edit Plan" : "New Plan"}</h3>
              <button onClick={() => setPlanDrawer(false)} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="flex-1 p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Plan Name *</label>
                <input value={planForm.name} onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Gold Membership" className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Duration *</label>
                  <select value={planForm.duration_type} onChange={e => setPlanForm(f => ({ ...f, duration_type: e.target.value as DurationType }))}
                    className="w-full px-3 py-2 rounded-lg border outline-none text-sm bg-white"
                    style={{ borderColor: "rgba(197,160,89,0.3)" }}>
                    {Object.entries(DURATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Price (₹) *</label>
                  <input type="number" value={planForm.price} onChange={e => setPlanForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="0" className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                    style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Max Members (optional)</label>
                <input type="number" value={planForm.max_members} onChange={e => setPlanForm(f => ({ ...f, max_members: e.target.value }))}
                  placeholder="Unlimited" className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }} />
              </div>

              {/* Benefits Builder */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-medium" style={{ color: "#4b5563" }}>Benefits</label>
                  <button onClick={() => setPlanForm(f => ({ ...f, benefits: [...f.benefits, { type: "discount", value: "", label: "" }] }))}
                    className="text-xs px-2 py-1 rounded flex items-center gap-1" style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)" }}>
                    <Plus size={11} /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {planForm.benefits.map((b, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <select value={b.type}
                        onChange={e => { const nb = [...planForm.benefits]; nb[i].type = e.target.value as "discount"|"wallet_credit"|"service"; setPlanForm(f => ({ ...f, benefits: nb })); }}
                        className="text-xs px-2 py-1.5 rounded border bg-white" style={{ borderColor: "rgba(197,160,89,0.3)" }}>
                        <option value="discount">Discount %</option>
                        <option value="wallet_credit">Wallet Credit ₹</option>
                        <option value="service">Free Service</option>
                      </select>
                      <input value={b.value} onChange={e => { const nb = [...planForm.benefits]; nb[i].value = e.target.value; setPlanForm(f => ({ ...f, benefits: nb })); }}
                        placeholder="Value" className="text-xs px-2 py-1.5 rounded border w-16" style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                      <input value={b.label} onChange={e => { const nb = [...planForm.benefits]; nb[i].label = e.target.value; setPlanForm(f => ({ ...f, benefits: nb })); }}
                        placeholder="Label" className="text-xs px-2 py-1.5 rounded border flex-1" style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                      <button onClick={() => setPlanForm(f => ({ ...f, benefits: f.benefits.filter((_, j) => j !== i) }))} className="p-1 hover:bg-red-50 rounded"><X size={12} style={{ color: "#ef4444" }} /></button>
                    </div>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={planForm.is_global} onChange={e => setPlanForm(f => ({ ...f, is_global: e.target.checked }))} className="rounded" />
                <span className="text-sm" style={{ color: "#4b5563" }}>Global plan (available chain-wide)</span>
              </label>
            </div>
            <div className="px-6 py-4 flex gap-3" style={{ borderTop: "1px solid rgba(197,160,89,0.15)" }}>
              <button onClick={() => setPlanDrawer(false)} className="flex-1 px-4 py-2 rounded-lg text-sm border" style={{ borderColor: "rgba(197,160,89,0.2)", color: "#6b7280" }}>Cancel</button>
              <button onClick={savePlan} disabled={saving || !planForm.name}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "var(--gold)" }}>{saving ? "Saving…" : "Save Plan"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN DRAWER */}
      {assignDrawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setAssignDrawer(false)} />
          <div className="w-[400px] h-full overflow-y-auto flex flex-col" style={{ background: "#fff" }}>
            <div className="flex justify-between items-center px-6 py-5" style={{ borderBottom: "1px solid rgba(197,160,89,0.15)" }}>
              <h3 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif" }}>Assign Membership</h3>
              <button onClick={() => setAssignDrawer(false)} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="flex-1 p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Search Patient *</label>
                <input value={assignForm.patient_search}
                  onChange={e => { setAssignForm(f => ({ ...f, patient_search: e.target.value, patient_id: "" })); searchPatients(e.target.value); }}
                  placeholder="Type patient name…" className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                {patientResults.length > 0 && !assignForm.patient_id && (
                  <div className="mt-1 border rounded-lg overflow-hidden" style={{ borderColor: "rgba(197,160,89,0.2)" }}>
                    {patientResults.map(p => (
                      <button key={p.id} className="w-full px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                        onClick={() => { setAssignForm(f => ({ ...f, patient_id: p.id, patient_search: p.full_name })); setPatientResults([]); }}>
                        {p.full_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Select Plan *</label>
                <select value={assignForm.plan_id} onChange={e => setAssignForm(f => ({ ...f, plan_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border outline-none text-sm bg-white"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }}>
                  <option value="">Choose a plan…</option>
                  {plans.filter(p => p.is_active).map(p => (
                    <option key={p.id} value={p.id}>{p.name} — ₹{p.price} / {p.duration_type}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={assignForm.auto_renew} onChange={e => setAssignForm(f => ({ ...f, auto_renew: e.target.checked }))} />
                <span className="text-sm" style={{ color: "#4b5563" }}>Auto-renew</span>
              </label>
            </div>
            <div className="px-6 py-4 flex gap-3" style={{ borderTop: "1px solid rgba(197,160,89,0.15)" }}>
              <button onClick={() => setAssignDrawer(false)} className="flex-1 px-4 py-2 rounded-lg text-sm border" style={{ borderColor: "rgba(197,160,89,0.2)", color: "#6b7280" }}>Cancel</button>
              <button onClick={assignMembership} disabled={saving || !assignForm.patient_id || !assignForm.plan_id}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "var(--gold)" }}>{saving ? "Assigning…" : "Assign"}</button>
            </div>
          </div>
        </div>
      )}

      {/* WALLET CREDIT DRAWER */}
      {walletDrawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setWalletDrawer(false)} />
          <div className="w-[400px] h-full overflow-y-auto flex flex-col" style={{ background: "#fff" }}>
            <div className="flex justify-between items-center px-6 py-5" style={{ borderBottom: "1px solid rgba(197,160,89,0.15)" }}>
              <h3 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif" }}>Add Wallet Credit</h3>
              <button onClick={() => setWalletDrawer(false)} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="flex-1 p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Search Patient *</label>
                <input value={walletForm.patient_search}
                  onChange={e => { setWalletForm(f => ({ ...f, patient_search: e.target.value, patient_id: "" })); searchWalletPatients(e.target.value); }}
                  placeholder="Type patient name…" className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                {walletPatientResults.length > 0 && !walletForm.patient_id && (
                  <div className="mt-1 border rounded-lg overflow-hidden" style={{ borderColor: "rgba(197,160,89,0.2)" }}>
                    {walletPatientResults.map(p => (
                      <button key={p.id} className="w-full px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                        onClick={() => { setWalletForm(f => ({ ...f, patient_id: p.id, patient_search: `${p.full_name} (₹${p.wallet_balance})`, patient_name: p.full_name })); setWalletPatientResults([]); }}>
                        {p.full_name} <span style={{ color: "#9ca3af" }}>— ₹{p.wallet_balance} balance</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Amount (₹) *</label>
                <input type="number" value={walletForm.amount} onChange={e => setWalletForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0" className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Reason</label>
                <input value={walletForm.reason} onChange={e => setWalletForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="e.g. Membership benefit, manual top-up…" className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }} />
              </div>
            </div>
            <div className="px-6 py-4 flex gap-3" style={{ borderTop: "1px solid rgba(197,160,89,0.15)" }}>
              <button onClick={() => setWalletDrawer(false)} className="flex-1 px-4 py-2 rounded-lg text-sm border" style={{ borderColor: "rgba(197,160,89,0.2)", color: "#6b7280" }}>Cancel</button>
              <button onClick={addWalletCredit} disabled={saving || !walletForm.patient_id || !walletForm.amount}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "var(--gold)" }}>{saving ? "Adding…" : "Add Credit"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
