"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Crown, Search, Building2, Loader2,
  Eye, Send, ChevronDown, ChevronUp, Network,
  Zap, Calendar, Camera, Package, Receipt, Scissors, Globe,
  Users, BarChart3, MessageSquare, Smartphone, RefreshCw,
  Shield, X, Sparkles, FlaskConical, Star, Heart, Briefcase,
  DollarSign, Activity, ToggleLeft, ToggleRight, Plus, Trash2,
  Copy, ExternalLink,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { logAction } from "@/lib/audit";
import { toast } from "sonner";
import TopBar from "@/components/TopBar";

// ─────────────────────────────────────── Constants ───────────────────────────

interface ModuleDef {
  key:         string;
  label:       string;
  icon:        React.ElementType;
  color:       string;
  tier:        "starter" | "growth" | "enterprise" | "always";
  description: string;
}

const ALL_MODULES: ModuleDef[] = [
  { key: "scheduler",          label: "Scheduler",          icon: Calendar,      color: "#0891B2", tier: "starter",    description: "Appointment booking & calendar" },
  { key: "photos",             label: "Before & After",     icon: Camera,        color: "#C5A059", tier: "starter",    description: "Photo comparison gallery" },
  { key: "inventory",          label: "Inventory",          icon: Package,       color: "#059669", tier: "starter",    description: "Stock & supplier management" },
  { key: "advanced_analytics", label: "Analytics",          icon: BarChart3,     color: "#EA580C", tier: "growth",     description: "Advanced reports & analytics" },
  { key: "multi_chain",        label: "Multi-Chain",        icon: Network,       color: "#9333EA", tier: "growth",     description: "Multi-branch chain management" },
  { key: "sms_reminders",      label: "SMS Reminders",      icon: Smartphone,    color: "#0891B2", tier: "growth",     description: "Automated SMS reminders" },
  { key: "whatsapp_booking",   label: "WhatsApp Booking",   icon: MessageSquare, color: "#25D366", tier: "growth",     description: "Book via WhatsApp Business" },
  { key: "leads",              label: "Lead Management",    icon: Zap,           color: "#F59E0B", tier: "growth",     description: "Track & convert clinic leads" },
  { key: "membership",         label: "Memberships",        icon: Star,          color: "#C5A059", tier: "growth",     description: "Memberships & Wallet" },
  { key: "counselling",        label: "Counselling",        icon: Heart,         color: "#EC4899", tier: "growth",     description: "Counselling pipeline" },
  { key: "crm",                label: "CRM & Marketing",    icon: Users,         color: "#6366F1", tier: "growth",     description: "CRM & Marketing" },
  { key: "staff_hr",           label: "Staff HR",           icon: Briefcase,     color: "#64748B", tier: "growth",     description: "Staff HR & Attendance" },
  { key: "payroll",            label: "Payroll",            icon: DollarSign,    color: "#DC2626", tier: "enterprise", description: "Payroll processing" },
];

const TIER_COLORS = {
  always:     { bg: "rgba(5,150,105,0.08)",   color: "#059669", border: "rgba(5,150,105,0.2)"   },
  starter:    { bg: "rgba(156,148,164,0.12)", color: "#6B6378", border: "rgba(156,148,164,0.3)" },
  growth:     { bg: "rgba(197,160,89,0.12)",  color: "#8B6914", border: "rgba(197,160,89,0.4)"  },
  enterprise: { bg: "rgba(99,102,241,0.1)",   color: "#4338CA", border: "rgba(99,102,241,0.3)"  },
};

const STARTER_MODULES  = ALL_MODULES.filter(m => m.tier === "starter").map(m => m.key);
const GROWTH_MODULES   = ALL_MODULES.filter(m => m.tier !== "enterprise").map(m => m.key);
const ENTERPRISE_MODULES = ALL_MODULES.map(m => m.key);

// ─────────────────────────────────────── Types ───────────────────────────────

interface ClinicRow {
  id: string; name: string; chain_id: string | null;
  subscription_status: string; subscription_plan: string | null;
  location: string | null; chain_name: string | null; is_demo: boolean;
}

type ModuleMap = Record<string, boolean>;

interface SubscriptionPlan {
  id: string; name: string; slug: string;
  features_json: Record<string, boolean>;
  monthly_price: number | null;
}

interface ModuleRegistry {
  module_key: string; display_name: string;
  is_globally_killed: boolean; killed_reason: string | null; killed_at: string | null;
  last_usage_check: string | null;
}

interface UsageLog {
  module_key: string; used_at: string; clinic_id: string;
  clinics: { name: string } | null;
}

// ─────────────────────────────────────── Main Page ───────────────────────────

export default function GodModePage() {
  const { profile }                           = useClinic();
  const { startImpersonation, isImpersonating, impersonated } = useImpersonation();

  const [activeTab,   setActiveTab]   = useState<"clinics" | "plans" | "devpanel" | "demo">("clinics");

  // ── Tab 1: Clinics ──────────────────────────────────────────────────────────
  const [clinics,     setClinics]     = useState<ClinicRow[]>([]);
  const [moduleMap,   setModuleMap]   = useState<Record<string, ModuleMap>>({});
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [expanded,    setExpanded]    = useState<string | null>(null);
  const [saving,      setSaving]      = useState<string | null>(null);
  const [pushing,     setPushing]     = useState(false);
  const [pushTarget,  setPushTarget]  = useState<string | null>(null);

  // ── Tab 2: Plans ────────────────────────────────────────────────────────────
  const [plans,       setPlans]       = useState<SubscriptionPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [savingPlan,  setSavingPlan]  = useState<string | null>(null);

  // ── Tab 3: Dev Panel ────────────────────────────────────────────────────────
  const [modules,     setModules]     = useState<ModuleRegistry[]>([]);
  const [usageLogs,   setUsageLogs]   = useState<UsageLog[]>([]);
  const [devLoading,  setDevLoading]  = useState(false);
  const [killingSaving, setKillingSaving] = useState<string | null>(null);

  // ── Tab 4: Demo Manager ─────────────────────────────────────────────────────
  const [demoList,    setDemoList]    = useState<{ id: string; name: string; admin_email: string; demo_created_at: string | null }[]>([]);
  const [demoName,    setDemoName]    = useState("");
  const [demoCreating, setDemoCreating] = useState(false);
  const [demoResult,  setDemoResult]  = useState<{ email: string; password: string; userId: string } | null>(null);
  const [demoOpening, setDemoOpening] = useState(false);
  const [demoClearing, setDemoClearing] = useState<string | null>(null);

  // ── Load clinics + clinic_modules ───────────────────────────────────────────
  const fetchClinics = useCallback(async () => {
    setLoading(true);
    const [clinicsRes, modulesRes] = await Promise.all([
      supabase.from("clinics")
        .select("id, name, chain_id, subscription_status, subscription_plan, location, is_demo, chains(name)")
        .order("name"),
      supabase.from("clinic_modules")
        .select("clinic_id, module_key, is_enabled"),
    ]);

    const rawClinics = (clinicsRes.data ?? []) as unknown as (Omit<ClinicRow, "chain_name"> & { chains: { name: string } | null })[];
    setClinics(rawClinics.map(c => ({ ...c, chain_name: c.chains?.name ?? null })));

    const mMap: Record<string, ModuleMap> = {};
    (modulesRes.data ?? []).forEach((row: { clinic_id: string; module_key: string; is_enabled: boolean }) => {
      mMap[row.clinic_id] ??= {};
      mMap[row.clinic_id][row.module_key] = row.is_enabled;
    });
    setModuleMap(mMap);
    setLoading(false);
  }, []);

  // ── Load plans ──────────────────────────────────────────────────────────────
  const fetchPlans = useCallback(async () => {
    setPlansLoading(true);
    const { data } = await supabase.from("subscription_plans")
      .select("id, name, slug, features_json, monthly_price").order("monthly_price");
    setPlans((data ?? []) as SubscriptionPlan[]);
    setPlansLoading(false);
  }, []);

  // ── Load dev panel ──────────────────────────────────────────────────────────
  const fetchDevPanel = useCallback(async () => {
    setDevLoading(true);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const [modRes, usageRes] = await Promise.all([
      supabase.from("module_registry").select("module_key,display_name,is_globally_killed,killed_reason,killed_at,last_usage_check").order("display_name"),
      supabase.from("feature_usage_log").select("module_key,used_at,clinic_id,clinics(name)").gte("used_at", ninetyDaysAgo).order("used_at", { ascending: false }).limit(200),
    ]);
    setModules(modRes.data ?? []);
    setUsageLogs((usageRes.data ?? []) as unknown as UsageLog[]);
    setDevLoading(false);
  }, []);

  // ── Load demo list ──────────────────────────────────────────────────────────
  const fetchDemoList = useCallback(async () => {
    const { data } = await supabase.from("clinics").select("id,name,admin_email,demo_created_at").eq("is_demo", true).order("name");
    setDemoList(data ?? []);
  }, []);

  useEffect(() => { fetchClinics(); }, [fetchClinics]);
  useEffect(() => {
    if (activeTab === "plans" && plans.length === 0) fetchPlans();
    if (activeTab === "devpanel" && modules.length === 0) fetchDevPanel();
    if (activeTab === "demo") fetchDemoList();
  }, [activeTab, plans.length, modules.length, fetchPlans, fetchDevPanel, fetchDemoList]);

  // ── Derived state ───────────────────────────────────────────────────────────
  const filteredClinics = useMemo(() => {
    if (!search.trim()) return clinics;
    const q = search.toLowerCase();
    return clinics.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.location ?? "").toLowerCase().includes(q) ||
      (c.chain_name ?? "").toLowerCase().includes(q)
    );
  }, [clinics, search]);

  const totalEnabled = useMemo(() => {
    let count = 0;
    Object.values(moduleMap).forEach(mm => Object.values(mm).forEach(v => v && count++));
    return count;
  }, [moduleMap]);

  // ── Access guard ─────────────────────────────────────────────────────────────
  if (profile?.role !== "superadmin") {
    return (
      <div style={{ background: "#F9F7F2", minHeight: "100vh" }}>
        <TopBar />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 12 }}>
          <Shield size={36} style={{ color: "rgba(197,160,89,0.35)" }} />
          <p style={{ fontSize: 16, fontFamily: "Georgia, serif", color: "#9C9584" }}>Superadmin access required</p>
        </div>
      </div>
    );
  }

  // ── Toggle a single module for a clinic ─────────────────────────────────────
  async function toggleModule(clinicId: string, moduleKey: string, currentValue: boolean) {
    const newValue = !currentValue;
    const key = `${clinicId}_${moduleKey}`;
    setSaving(key);

    const { error } = await supabase
      .from("clinic_modules")
      .upsert({ clinic_id: clinicId, module_key: moduleKey, is_enabled: newValue, enabled_by: profile?.id ?? null },
               { onConflict: "clinic_id,module_key" });

    setSaving(null);
    if (error) { toast.error(`Failed to toggle ${moduleKey}`); return; }

    setModuleMap(prev => ({
      ...prev,
      [clinicId]: { ...prev[clinicId], [moduleKey]: newValue },
    }));

    const clinic = clinics.find(c => c.id === clinicId);
    logAction({
      action:     newValue ? "god_mode_enable_module" : "god_mode_disable_module",
      targetId:   clinicId,
      targetName: clinic?.name ?? clinicId,
      metadata:   { module_key: moduleKey, enabled: newValue },
    });

    toast.success(`${newValue ? "Enabled" : "Disabled"} ${moduleKey} for ${clinic?.name ?? "clinic"}`);
  }

  // ── Push module set to a clinic ─────────────────────────────────────────────
  async function pushModulesToClinic(clinicId: string, enabledKeys: string[]) {
    const rows = ALL_MODULES.map(m => ({
      clinic_id: clinicId, module_key: m.key,
      is_enabled: enabledKeys.includes(m.key),
      enabled_by: profile?.id ?? null,
    }));
    const { error } = await supabase.from("clinic_modules").upsert(rows, { onConflict: "clinic_id,module_key" });
    if (error) throw error;
    const newMap: ModuleMap = {};
    ALL_MODULES.forEach(m => { newMap[m.key] = enabledKeys.includes(m.key); });
    setModuleMap(prev => ({ ...prev, [clinicId]: newMap }));
  }

  // ── Batch-push to all clinics ────────────────────────────────────────────────
  async function handleBatchPush(tier: "starter" | "growth" | "enterprise") {
    const keys = tier === "starter" ? STARTER_MODULES : tier === "growth" ? GROWTH_MODULES : ENTERPRISE_MODULES;
    setPushing(true);
    setPushTarget(tier);
    let success = 0, failed = 0;
    for (const clinic of filteredClinics) {
      try { await pushModulesToClinic(clinic.id, keys); success++; }
      catch { failed++; }
    }
    setPushing(false);
    setPushTarget(null);
    toast.success(`Pushed ${tier} modules to ${success} clinics${failed > 0 ? ` (${failed} failed)` : ""}`);
  }

  // ── Impersonation ────────────────────────────────────────────────────────────
  function handleImpersonate(clinic: ClinicRow) {
    startImpersonation(clinic.id, clinic.name);
    toast.success(`Now viewing as ${clinic.name}`);
    window.location.href = "/";
  }

  // ── Login-As ─────────────────────────────────────────────────────────────────
  async function handleLoginAs(clinicId: string) {
    const res = await fetch("/api/admin/magic-link", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinicId }),
    });
    const json = await res.json();
    if (!res.ok || !json.url) { toast.error(json.error ?? "Could not generate link"); return; }
    window.open(json.url, "_blank", "noreferrer");
  }

  // ── Plan feature toggle ─────────────────────────────────────────────────────
  async function togglePlanFeature(planId: string, featureKey: string, currentValue: boolean) {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    const newFeatures = { ...plan.features_json, [featureKey]: !currentValue };
    setSavingPlan(`${planId}_${featureKey}`);
    const { error } = await supabase.from("subscription_plans").update({ features_json: newFeatures }).eq("id", planId);
    setSavingPlan(null);
    if (error) { toast.error("Failed to update plan"); return; }
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, features_json: newFeatures } : p));
    toast.success(`Updated ${plan.name}`);
  }

  // ── Apply plan features to all clinics on that plan ─────────────────────────
  async function applyPlanToAllClinics(planId: string) {
    const plan = plans.find(p => p.id === planId);
    if (!plan || !plan.slug) return;
    const clinicsOnPlan = clinics.filter(c => c.subscription_plan === plan.slug);
    if (!confirm(`Apply ${plan.name} module set to ${clinicsOnPlan.length} clinics?`)) return;
    const enabledKeys = ALL_MODULES.filter(m => plan.features_json?.[m.key]).map(m => m.key);
    let success = 0;
    for (const clinic of clinicsOnPlan) {
      try { await pushModulesToClinic(clinic.id, enabledKeys); success++; }
      catch { /* continue */ }
    }
    toast.success(`Applied to ${success} clinics`);
  }

  // ── Kill switch toggle ──────────────────────────────────────────────────────
  async function toggleKillSwitch(moduleKey: string, kill: boolean) {
    setKillingSaving(moduleKey);
    const update: Record<string, unknown> = { is_globally_killed: kill };
    if (kill) update.killed_at = new Date().toISOString();
    else { update.killed_at = null; update.killed_reason = null; }
    const { error } = await supabase.from("module_registry").update(update).eq("module_key", moduleKey);
    setKillingSaving(null);
    if (error) { toast.error("Failed"); return; }
    setModules(prev => prev.map(m => m.module_key === moduleKey ? { ...m, is_globally_killed: kill, killed_at: kill ? new Date().toISOString() : null } : m));
    toast.success(`${kill ? "Killed" : "Restored"} ${moduleKey} globally`);
  }

  // ── Demo: create ─────────────────────────────────────────────────────────────
  async function createDemoClinic() {
    if (!demoName.trim()) return;
    setDemoCreating(true);
    const res = await fetch("/api/admin/demo/create", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: demoName.trim() }),
    });
    const json = await res.json();
    setDemoCreating(false);
    if (!res.ok) { toast.error(json.error ?? "Creation failed"); return; }
    setDemoName("");
    setDemoResult({ email: json.email, password: json.password, userId: json.userId });
    fetchDemoList();
  }

  async function openDemoTab(userId: string) {
    setDemoOpening(true);
    const res = await fetch("/api/admin/magic-link", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const json = await res.json();
    setDemoOpening(false);
    if (!res.ok || !json.url) { toast.error(json.error ?? "Could not generate link"); return; }
    window.open(json.url, "_blank", "noreferrer");
  }

  async function clearDemoClinic(clinicId: string, name: string) {
    if (!confirm(`Delete ALL data for demo clinic "${name}"? This is irreversible.`)) return;
    setDemoClearing(clinicId);
    await fetch("/api/admin/demo/clear", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinicId }),
    });
    setDemoClearing(null);
    fetchDemoList();
    toast.success("Demo clinic cleared");
  }

  // ── Tab styles ───────────────────────────────────────────────────────────────
  const tabs = [
    { key: "clinics"  as const, label: "Clinics",     icon: Building2    },
    { key: "plans"    as const, label: "Plans",        icon: Star         },
    { key: "devpanel" as const, label: "Dev Panel",    icon: Activity     },
    { key: "demo"     as const, label: "Demo Manager", icon: FlaskConical },
  ];

  return (
    <div style={{ background: "#F9F7F2", minHeight: "100vh" }}>
      <TopBar />

      {/* Impersonation banner */}
      {isImpersonating && impersonated && (
        <div style={{ background: "linear-gradient(90deg, #1C0A00, #2E1000)", borderBottom: "2px solid #C5A059", padding: "8px 40px", display: "flex", alignItems: "center", gap: 10 }}>
          <Eye size={14} style={{ color: "#C5A059" }} />
          <span style={{ fontSize: 12, color: "#C5A059", fontWeight: 600, fontFamily: "Georgia, serif" }}>
            Currently viewing as: {impersonated.clinicName}
          </span>
          <button onClick={() => { window.location.href = "/admin/god-mode"; }} style={{ marginLeft: "auto", fontSize: 11, color: "#C5A059", background: "none", border: "1px solid rgba(197,160,89,0.3)", padding: "3px 10px", borderRadius: 6, cursor: "pointer" }}>
            Back to God Mode
          </button>
        </div>
      )}

      <div style={{ padding: "28px 40px 60px", maxWidth: 1400, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, rgba(197,160,89,0.2), rgba(168,133,58,0.1))", border: "1px solid rgba(197,160,89,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Crown size={16} style={{ color: "#C5A059" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: 0 }}>God Mode</h1>
            <p style={{ fontSize: 12, color: "#9C9584", margin: 0 }}>{clinics.length} clinics · {totalEnabled} module grants active</p>
          </div>
          <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 6, background: "rgba(197,160,89,0.12)", color: "#8B6914", letterSpacing: "0.08em", textTransform: "uppercase" }}>Superadmin Only</span>
        </div>

        {/* ── Tab Bar ── */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "white", padding: 4, borderRadius: 12, border: "1px solid rgba(197,160,89,0.15)", width: "fit-content" }}>
          {tabs.map(t => {
            const active = activeTab === t.key;
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "Georgia, serif", background: active ? "rgba(197,160,89,0.15)" : "transparent", color: active ? "#8B6914" : "#9C9584", transition: "all 0.15s" }}>
                <Icon size={13} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ════════════════════════════ TAB 1: Clinics ═══════════════════════════ */}
        {activeTab === "clinics" && (
          <div>
            {/* Batch push + search */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#B8AE9C", pointerEvents: "none" }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search clinics…"
                  style={{ width: "100%", padding: "9px 12px 9px 34px", borderRadius: 10, border: "1px solid rgba(197,160,89,0.2)", background: "white", fontSize: 13, color: "#1C1917", outline: "none", boxSizing: "border-box" }} />
                {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer" }}><X size={13} style={{ color: "#9C9584" }} /></button>}
              </div>
              <button onClick={() => fetchClinics()} style={{ width: 36, height: 36, borderRadius: 9, border: "1px solid rgba(197,160,89,0.2)", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <RefreshCw size={14} style={{ color: "#9C9584" }} />
              </button>
              {(["starter", "growth", "enterprise"] as const).map(tier => {
                const isPushing = pushing && pushTarget === tier;
                const T = tier === "starter" ? TIER_COLORS.starter : tier === "growth" ? TIER_COLORS.growth : TIER_COLORS.enterprise;
                return (
                  <button key={tier} onClick={() => handleBatchPush(tier)} disabled={pushing}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.bg, cursor: pushing ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, color: T.color, textTransform: "capitalize" }}>
                    {isPushing ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                    Push {tier.charAt(0).toUpperCase() + tier.slice(1)}
                  </button>
                );
              })}
            </div>

            {/* Clinic list */}
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[1,2,3].map(i => <div key={i} style={{ height: 60, borderRadius: 12, background: "rgba(197,160,89,0.06)", animation: "pulse 1.4s infinite" }} />)}
              </div>
            ) : filteredClinics.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <Building2 size={32} style={{ color: "rgba(197,160,89,0.3)", margin: "0 auto 12px" }} />
                <p style={{ fontSize: 14, color: "#9C9584", fontFamily: "Georgia, serif" }}>No clinics found</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filteredClinics.map(clinic => {
                  const mm       = moduleMap[clinic.id] ?? {};
                  const isOpen   = expanded === clinic.id;
                  const enabledCt = ALL_MODULES.filter(m => mm[m.key]).length;
                  const subColor  = clinic.subscription_status === "active" ? "#059669" : "#6B7280";

                  return (
                    <div key={clinic.id} style={{ background: "white", borderRadius: 12, border: `1px solid ${isOpen ? "rgba(197,160,89,0.4)" : "rgba(197,160,89,0.15)"}`, overflow: "hidden" }}>
                      {/* Header row */}
                      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer" }} onClick={() => setExpanded(isOpen ? null : clinic.id)}>
                        <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(197,160,89,0.1)", border: "1px solid rgba(197,160,89,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Sparkles size={13} style={{ color: "#C5A059" }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{clinic.name}</p>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: `${subColor}15`, color: subColor, textTransform: "uppercase" }}>{clinic.subscription_status}</span>
                            {clinic.is_demo && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "rgba(124,58,237,0.1)", color: "#7C3AED" }}>DEMO</span>}
                            {clinic.chain_name && <span style={{ fontSize: 10, color: "#9333EA", background: "rgba(147,51,234,0.08)", padding: "1px 7px", borderRadius: 4 }}>{clinic.chain_name}</span>}
                          </div>
                          {clinic.location && <p style={{ fontSize: 11, color: "#9C9584", margin: "2px 0 0" }}>{clinic.location}</p>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#9C9584" }}>{enabledCt}/{ALL_MODULES.length}</span>
                          <button onClick={e => { e.stopPropagation(); handleImpersonate(clinic); }} title="View as clinic"
                            style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(197,160,89,0.25)", background: "rgba(197,160,89,0.06)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Eye size={12} style={{ color: "#C5A059" }} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleLoginAs(clinic.id); }} title="Login as admin"
                            style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(99,102,241,0.25)", background: "rgba(99,102,241,0.06)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <ExternalLink size={12} style={{ color: "#6366F1" }} />
                          </button>
                          {isOpen ? <ChevronUp size={14} style={{ color: "#9C9584" }} /> : <ChevronDown size={14} style={{ color: "#9C9584" }} />}
                        </div>
                      </div>

                      {/* Expanded module grid */}
                      {isOpen && (
                        <div style={{ borderTop: "1px solid rgba(197,160,89,0.1)", padding: "14px 16px 16px" }}>
                          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                            <span style={{ fontSize: 11, color: "#9C9584", alignSelf: "center" }}>Quick set:</span>
                            {(["starter", "growth", "enterprise"] as const).map(tier => {
                              const keys = tier === "starter" ? STARTER_MODULES : tier === "growth" ? GROWTH_MODULES : ENTERPRISE_MODULES;
                              const T = tier === "starter" ? TIER_COLORS.starter : tier === "growth" ? TIER_COLORS.growth : TIER_COLORS.enterprise;
                              return (
                                <button key={tier} onClick={async () => {
                                  setSaving(`${clinic.id}_batch`);
                                  try { await pushModulesToClinic(clinic.id, keys); toast.success(`Applied ${tier} to ${clinic.name}`); }
                                  catch { toast.error("Failed"); }
                                  setSaving(null);
                                }} style={{ padding: "3px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.bg, cursor: "pointer", fontSize: 10, fontWeight: 700, color: T.color, textTransform: "capitalize" }}>
                                  {saving === `${clinic.id}_batch` ? <Loader2 size={10} style={{ display: "inline" }} className="animate-spin" /> : tier}
                                </button>
                              );
                            })}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7 }}>
                            {ALL_MODULES.map(mod => {
                              const enabled   = mm[mod.key] ?? false;
                              const savingKey = `${clinic.id}_${mod.key}`;
                              const isSaving  = saving === savingKey;
                              const T = TIER_COLORS[mod.tier];
                              const Icon = mod.icon;
                              return (
                                <div key={mod.key} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 9, background: enabled ? `${mod.color}08` : "rgba(249,247,242,0.7)", border: `1px solid ${enabled ? mod.color + "25" : "rgba(197,160,89,0.12)"}`, transition: "all 0.15s" }}>
                                  <div style={{ width: 28, height: 28, borderRadius: 7, background: enabled ? `${mod.color}18` : "rgba(107,114,128,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <Icon size={12} style={{ color: enabled ? mod.color : "#9C9584" }} />
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: 11, fontWeight: 600, color: enabled ? "#1C1917" : "#9C9584", margin: "0 0 1px", fontFamily: "Georgia, serif" }}>{mod.label}</p>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: T.color, background: T.bg, padding: "1px 4px", borderRadius: 3 }}>{mod.tier.toUpperCase()}</span>
                                  </div>
                                  {isSaving ? (
                                    <Loader2 size={15} className="animate-spin" style={{ color: "#C5A059", flexShrink: 0 }} />
                                  ) : (
                                    <button onClick={() => toggleModule(clinic.id, mod.key, enabled)}
                                      style={{ width: 38, height: 20, borderRadius: 10, border: "none", cursor: "pointer", flexShrink: 0, position: "relative", background: enabled ? mod.color : "rgba(107,114,128,0.2)", transition: "background 0.2s" }}>
                                      <span style={{ position: "absolute", top: 2, left: enabled ? 19 : 2, width: 16, height: 16, borderRadius: "50%", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s" }} />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════ TAB 2: Plans ═════════════════════════════ */}
        {activeTab === "plans" && (
          <div>
            {plansLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[1,2,3].map(i => <div key={i} style={{ height: 60, borderRadius: 12, background: "rgba(197,160,89,0.06)" }} />)}
              </div>
            ) : plans.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <Star size={32} style={{ color: "rgba(197,160,89,0.3)", margin: "0 auto 12px" }} />
                <p style={{ fontSize: 14, color: "#9C9584", fontFamily: "Georgia, serif" }}>No subscription plans found in DB</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {plans.map(plan => {
                  const clinicsOnPlan = clinics.filter(c => c.subscription_plan === plan.slug).length;
                  return (
                    <div key={plan.id} style={{ background: "white", borderRadius: 14, border: "1px solid rgba(197,160,89,0.2)", padding: "18px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div>
                          <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: "0 0 2px" }}>{plan.name}</h3>
                          <p style={{ fontSize: 11, color: "#9C9584", margin: 0 }}>{clinicsOnPlan} clinics · {plan.monthly_price ? `₹${plan.monthly_price}/mo` : "Custom"}</p>
                        </div>
                        <button onClick={() => applyPlanToAllClinics(plan.id)}
                          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.06)", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#8B6914" }}>
                          <Send size={12} /> Apply to {clinicsOnPlan} clinics
                        </button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 7 }}>
                        {ALL_MODULES.map(mod => {
                          const enabled   = plan.features_json?.[mod.key] ?? false;
                          const isSaving  = savingPlan === `${plan.id}_${mod.key}`;
                          const Icon = mod.icon;
                          return (
                            <div key={mod.key} onClick={() => !isSaving && togglePlanFeature(plan.id, mod.key, enabled)}
                              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: enabled ? `${mod.color}08` : "rgba(249,247,242,0.5)", border: `1px solid ${enabled ? mod.color + "22" : "rgba(197,160,89,0.1)"}`, transition: "all 0.15s" }}>
                              {isSaving ? <Loader2 size={12} className="animate-spin" style={{ color: "#C5A059" }} /> : <Icon size={12} style={{ color: enabled ? mod.color : "#9C9584", flexShrink: 0 }} />}
                              <span style={{ fontSize: 11, fontWeight: 600, color: enabled ? "#1C1917" : "#9C9584", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mod.label}</span>
                              <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: enabled ? mod.color : "rgba(107,114,128,0.3)", flexShrink: 0 }} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════ TAB 3: Dev Panel ═════════════════════════ */}
        {activeTab === "devpanel" && (
          <div>
            {devLoading ? (
              <p style={{ color: "#9C9584", fontSize: 13 }}>Loading…</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Kill switches */}
                <div style={{ background: "white", borderRadius: 14, border: "1px solid rgba(197,160,89,0.2)", padding: "18px 20px" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: "0 0 14px" }}>Global Kill Switches</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                    {modules.map(mod => (
                      <div key={mod.module_key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: mod.is_globally_killed ? "rgba(220,38,38,0.06)" : "rgba(249,247,242,0.7)", border: `1px solid ${mod.is_globally_killed ? "rgba(220,38,38,0.2)" : "rgba(197,160,89,0.12)"}` }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: "#1C1917", margin: "0 0 1px", fontFamily: "Georgia, serif" }}>{mod.display_name}</p>
                          {mod.is_globally_killed && mod.killed_at && (
                            <p style={{ fontSize: 10, color: "#DC2626", margin: 0 }}>Killed {new Date(mod.killed_at).toLocaleDateString("en-IN")}</p>
                          )}
                        </div>
                        {killingSaving === mod.module_key ? (
                          <Loader2 size={15} className="animate-spin" style={{ color: "#C5A059" }} />
                        ) : (
                          <button onClick={() => toggleKillSwitch(mod.module_key, !mod.is_globally_killed)}
                            style={{ width: 38, height: 20, borderRadius: 10, border: "none", cursor: "pointer", position: "relative", background: mod.is_globally_killed ? "#DC2626" : "rgba(107,114,128,0.2)", transition: "background 0.2s" }}>
                            <span style={{ position: "absolute", top: 2, left: mod.is_globally_killed ? 19 : 2, width: 16, height: 16, borderRadius: "50%", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s" }} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 90-day usage log */}
                <div style={{ background: "white", borderRadius: 14, border: "1px solid rgba(197,160,89,0.2)", padding: "18px 20px" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: "0 0 14px" }}>90-Day Feature Usage (last 200)</h3>
                  {usageLogs.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#9C9584" }}>No usage events in last 90 days</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 400, overflowY: "auto" }}>
                      {usageLogs.map((log, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", borderRadius: 7, background: "rgba(249,247,242,0.6)", border: "1px solid rgba(197,160,89,0.08)" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#C5A059", minWidth: 120 }}>{log.module_key}</span>
                          <span style={{ fontSize: 11, color: "#1C1917", flex: 1 }}>{log.clinics?.name ?? log.clinic_id}</span>
                          <span style={{ fontSize: 10, color: "#9C9584" }}>{new Date(log.used_at).toLocaleDateString("en-IN")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════ TAB 4: Demo Manager ══════════════════════ */}
        {activeTab === "demo" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Create demo */}
            <div style={{ background: "white", borderRadius: 14, border: "1px solid rgba(197,160,89,0.2)", padding: "18px 20px" }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: "0 0 14px" }}>Create Demo Clinic</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={demoName} onChange={e => setDemoName(e.target.value)}
                  placeholder="Clinic name (e.g. Aesthetica Demo)"
                  style={{ flex: 1, padding: "9px 12px", borderRadius: 9, border: "1px solid rgba(197,160,89,0.3)", fontSize: 13, outline: "none" }} />
                <button onClick={createDemoClinic} disabled={demoCreating || !demoName.trim()}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: "none", background: "rgba(197,160,89,0.15)", cursor: demoCreating || !demoName.trim() ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, color: "#8B6914" }}>
                  {demoCreating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Create
                </button>
              </div>
              {demoResult && (
                <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 10, background: "rgba(5,150,105,0.06)", border: "1px solid rgba(5,150,105,0.2)" }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#059669", margin: "0 0 6px" }}>Demo clinic created!</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <p style={{ fontSize: 11, color: "#374151", margin: 0 }}>Email: <strong>{demoResult.email}</strong></p>
                    <p style={{ fontSize: 11, color: "#374151", margin: 0 }}>Password: <strong>{demoResult.password}</strong></p>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button onClick={() => openDemoTab(demoResult.userId)} disabled={demoOpening}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7, border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.08)", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#8B6914" }}>
                      {demoOpening ? <Loader2 size={11} className="animate-spin" /> : <ExternalLink size={11} />}
                      Open in New Tab
                    </button>
                    <button onClick={() => { navigator.clipboard.writeText(`${demoResult.email} / ${demoResult.password}`); toast.success("Copied"); }}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7, border: "1px solid rgba(197,160,89,0.2)", background: "white", cursor: "pointer", fontSize: 11, color: "#9C9584" }}>
                      <Copy size={11} /> Copy Credentials
                    </button>
                    <button onClick={() => setDemoResult(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer" }}>
                      <X size={13} style={{ color: "#9C9584" }} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Demo list */}
            <div style={{ background: "white", borderRadius: 14, border: "1px solid rgba(197,160,89,0.2)", padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: 0 }}>Active Demo Clinics ({demoList.length})</h3>
                <button onClick={fetchDemoList} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(197,160,89,0.2)", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <RefreshCw size={13} style={{ color: "#9C9584" }} />
                </button>
              </div>
              {demoList.length === 0 ? (
                <p style={{ fontSize: 13, color: "#9C9584" }}>No demo clinics</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {demoList.map(demo => (
                    <div key={demo.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: "rgba(249,247,242,0.6)", border: "1px solid rgba(197,160,89,0.1)" }}>
                      <FlaskConical size={14} style={{ color: "#7C3AED", flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: "0 0 1px" }}>{demo.name}</p>
                        <p style={{ fontSize: 11, color: "#9C9584", margin: 0 }}>{demo.admin_email} · Created {demo.demo_created_at ? new Date(demo.demo_created_at).toLocaleDateString("en-IN") : "—"}</p>
                      </div>
                      <button onClick={() => handleLoginAs(demo.id)}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, border: "1px solid rgba(99,102,241,0.25)", background: "rgba(99,102,241,0.06)", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#6366F1" }}>
                        <ExternalLink size={11} /> Login As
                      </button>
                      <button onClick={() => clearDemoClinic(demo.id, demo.name)} disabled={demoClearing === demo.id}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, border: "1px solid rgba(220,38,38,0.25)", background: "rgba(220,38,38,0.04)", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#DC2626" }}>
                        {demoClearing === demo.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                        Clear
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
