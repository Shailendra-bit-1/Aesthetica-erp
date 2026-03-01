"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  IndianRupee, Target, TrendingUp, Users, Calendar, Clock,
  ChevronRight, UserPlus, Camera, FlaskConical, FileText,
  Receipt, Loader2, Building2, Globe, Sparkles, AlertTriangle,
  Circle, Zap, BarChart3, CalendarCheck, Package, RefreshCw,
  CheckCircle2, XCircle, PhoneOff, UserCheck,
  TerminalSquare, Skull, Plus, Trash2, X, Eye, ExternalLink,
  Pencil, LayoutGrid as LayoutGridIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import TopBar from "@/components/TopBar";
import NewPatientModal from "@/components/NewPatientModal";
import { logAction } from "@/lib/audit";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DashConfig {
  sections: {
    kpi_cards:        boolean;
    revenue_progress: boolean;
    appointments:     boolean;
    quick_actions:    boolean;
    recent_patients:  boolean;
    inventory_alerts: boolean;
  };
  hidden_kpis: string[];
}

const DEFAULT_DASH: DashConfig = {
  sections: {
    kpi_cards:        true,
    revenue_progress: true,
    appointments:     true,
    quick_actions:    true,
    recent_patients:  true,
    inventory_alerts: true,
  },
  hidden_kpis: [],
};

interface KpiData {
  todayRevenue:      number;
  monthlyCollection: number;
  monthlyTarget:     number;
  totalPatients:     number;
  todayAppointments: number;
  pendingAmount:     number;
  newThisMonth:      number;
  completedToday:    number;
}

interface Appointment {
  id: string;
  patient_name: string | null;
  service_name: string | null;
  start_time: string;
  end_time: string | null;
  status: string;
  provider_id: string | null;
  patient_tier: string | null;
}

interface ClinicRevenue {
  id: string;
  name: string;
  revenue: number;
}

interface InventoryAlert {
  id: string;
  product_name: string;
  quantity: number;
  reorder_level: number | null;
}

interface RecentPatient {
  id: string;
  full_name: string;
  primary_concern: string[] | string | null;
  created_at: string;
}

const AVATAR_COLORS = ["#C5A059","#8B7EC8","#7A9E8E","#B07A5A","#9E7A9E","#6B8A9A"];

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}
function monthStart() {
  const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d.toISOString();
}
function todayStart() {
  const d = new Date(); d.setHours(0,0,0,0); return d.toISOString();
}
function todayEnd() {
  const d = new Date(); d.setHours(23,59,59,999); return d.toISOString();
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function fmtDate(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7)  return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; bg: string; color: string; dot: string; icon: React.ElementType }> = {
  planned:    { label: "Scheduled",  bg: "rgba(122,142,158,0.12)", color: "#5A7A8A",  dot: "#7A8E9E",  icon: Clock        },
  confirmed:  { label: "Confirmed",  bg: "rgba(197,160,89,0.12)",  color: "#A8853A",  dot: "#C5A059",  icon: CalendarCheck },
  arrived:    { label: "Checked In", bg: "rgba(139,126,200,0.12)", color: "#6B5FAA",  dot: "#8B7EC8",  icon: UserCheck    },
  in_session: { label: "In Session", bg: "rgba(197,160,89,0.18)",  color: "#9A6A14",  dot: "#C5A059",  icon: Zap          },
  completed:  { label: "Completed",  bg: "rgba(139,158,122,0.12)", color: "#6B8A5A",  dot: "#8B9E7A",  icon: CheckCircle2 },
  cancelled:  { label: "Cancelled",  bg: "rgba(180,80,80,0.1)",    color: "#B45050",  dot: "#B45050",  icon: XCircle      },
  no_show:    { label: "No Show",    bg: "rgba(180,120,50,0.1)",   color: "#A06030",  dot: "#C08040",  icon: PhoneOff     },
};

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const router  = useRouter();
  const { profile, activeClinicId, clinics, loading: profileLoading } = useClinic();

  const isSuperAdmin = profile?.role === "superadmin";
  const isChainAdmin = profile?.role === "chain_admin" || isSuperAdmin;
  const isAdmin = isSuperAdmin || profile?.role === "clinic_admin" || profile?.role === "chain_admin";
  const isGlobal     = isSuperAdmin && !activeClinicId;

  const [kpi,           setKpi]           = useState<KpiData | null>(null);
  const [appts,         setAppts]         = useState<Appointment[]>([]);
  const [branchRevs,    setBranchRevs]    = useState<ClinicRevenue[]>([]);
  const [invAlerts,     setInvAlerts]     = useState<InventoryAlert[]>([]);
  const [recentPats,    setRecentPats]    = useState<RecentPatient[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [showNewPat,    setShowNewPat]    = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [dashConfig,    setDashConfig]    = useState<DashConfig>(DEFAULT_DASH);
  const [configId,      setConfigId]      = useState<string | null>(null);

  // Superadmin panels
  const [devModules,    setDevModules]    = useState<{ module_key: string; display_name: string; is_globally_killed: boolean; killed_reason: string | null }[]>([]);
  const [demoList,      setDemoList]      = useState<{ id: string; name: string; admin_email: string; demo_created_at: string | null }[]>([]);
  const [devLoading,    setDevLoading]    = useState(false);
  const [demoName,      setDemoName]      = useState("");
  const [demoCreating,  setDemoCreating]  = useState(false);
  const [demoResult,    setDemoResult]    = useState<{ email: string; password: string; loginUrl: string | null } | null>(null);
  const [demoClearing,  setDemoClearing]  = useState<string | null>(null);

  // Monthly revenue target — fetched from clinics.monthly_revenue_target (GAP-C4 fix)
  const [monthlyTarget, setMonthlyTarget] = useState(0);

  // ── Dashboard config load + helpers ────────────────────────────────────────
  useEffect(() => {
    if (!profile?.id || !profile?.clinic_id) return;
    supabase
      .from("dashboard_configs")
      .select("id, layout")
      .eq("clinic_id", profile.clinic_id)
      .eq("user_id", profile.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setConfigId(data.id);
          setDashConfig({ ...DEFAULT_DASH, ...(data.layout as DashConfig) });
        }
      });
  }, [profile?.id, profile?.clinic_id]);

  const saveConfig = useCallback((cfg: DashConfig) => {
    if (!profile?.id || !profile?.clinic_id) return;
    if (configId) {
      supabase.from("dashboard_configs").update({ layout: cfg }).eq("id", configId).then(({ data }) => {
        if (data) setConfigId((data as unknown as { id: string }[])[0]?.id ?? configId);
      });
    } else {
      supabase.from("dashboard_configs")
        .insert({ clinic_id: profile.clinic_id, user_id: profile.id, layout: cfg, widgets: [] })
        .select("id").single()
        .then(({ data }) => { if (data) setConfigId(data.id); });
    }
  }, [profile?.id, profile?.clinic_id, configId]);

  const toggleSection = (key: keyof DashConfig["sections"]) => {
    const next = { ...dashConfig, sections: { ...dashConfig.sections, [key]: !dashConfig.sections[key] } };
    setDashConfig(next);
    saveConfig(next);
  };

  const toggleKpi = (cardKey: string) => {
    const hidden = dashConfig.hidden_kpis.includes(cardKey)
      ? dashConfig.hidden_kpis.filter(k => k !== cardKey)
      : [...dashConfig.hidden_kpis, cardKey];
    const next = { ...dashConfig, hidden_kpis: hidden };
    setDashConfig(next);
    saveConfig(next);
  };

  const resetToDefaults = () => {
    setDashConfig(DEFAULT_DASH);
    saveConfig(DEFAULT_DASH);
  };

  const fetchAll = useCallback(async () => {
    if (profileLoading) return;
    setLoading(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scope = (q: any) => (!isGlobal && activeClinicId) ? q.eq("clinic_id", activeClinicId) : q;

    const [
      totalPatRes, newPatRes, todayApptRes, allApptRes,
      paidTodayRes, paidMonthRes, pendingRes,
      invRes, recentPatsRes, branchRes, clinicTargetRes,
    ] = await Promise.all([
      // Total patients
      scope(supabase.from("patients").select("id", { count: "exact", head: true })),
      // New this month
      scope(supabase.from("patients").select("id", { count: "exact", head: true }).gte("created_at", monthStart())),
      // Today's appointment count
      scope(supabase.from("appointments").select("id", { count: "exact", head: true }).gte("start_time", todayStart()).lte("start_time", todayEnd())),
      // Today's appointment list (for the live widget)
      scope(supabase.from("appointments").select("id,patient_name,service_name,start_time,end_time,status,provider_id,patient_tier").gte("start_time", todayStart()).lte("start_time", todayEnd()).order("start_time")),
      // Revenue collected today
      scope(supabase.from("pending_invoices").select("total_amount").eq("status","paid").gte("created_at", todayStart()).lte("created_at", todayEnd())),
      // Revenue collected this month
      scope(supabase.from("pending_invoices").select("total_amount").eq("status","paid").gte("created_at", monthStart())),
      // Pending invoice amount
      scope(supabase.from("pending_invoices").select("total_amount").eq("status","pending")),
      // Inventory low-stock alerts
      scope(supabase.from("inventory_products").select("id,product_name,quantity,reorder_level").lt("quantity", 10).order("quantity").limit(5)),
      // Recent patients
      scope(supabase.from("patients").select("id,full_name,primary_concern,created_at").order("created_at", { ascending: false }).limit(6)),
      // Branch revenue for chain view
      isChainAdmin
        ? supabase.from("clinics").select("id,name")
        : Promise.resolve({ data: [] }),
      // GAP-C4: Per-clinic monthly revenue target
      activeClinicId
        ? supabase.from("clinics").select("monthly_revenue_target").eq("id", activeClinicId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    // Aggregate revenue
    const todayRev  = (paidTodayRes.data  ?? []).reduce((s: number, r: { total_amount?: number | null }) => s + (r.total_amount ?? 0), 0);
    const monthRev  = (paidMonthRes.data  ?? []).reduce((s: number, r: { total_amount?: number | null }) => s + (r.total_amount ?? 0), 0);
    const pendingAmt= (pendingRes.data    ?? []).reduce((s: number, r: { total_amount?: number | null }) => s + (r.total_amount ?? 0), 0);

    // Completed today
    const apptList = (allApptRes.data ?? []) as Appointment[];
    const completedToday = apptList.filter(a => a.status === "completed").length;

    const target = (clinicTargetRes.data as { monthly_revenue_target?: number | null } | null)?.monthly_revenue_target ?? 0;
    setMonthlyTarget(target);
    setKpi({
      todayRevenue:      todayRev,
      monthlyCollection: monthRev,
      monthlyTarget:     target,
      totalPatients:     totalPatRes.count  ?? 0,
      todayAppointments: todayApptRes.count ?? 0,
      pendingAmount:     pendingAmt,
      newThisMonth:      newPatRes.count    ?? 0,
      completedToday,
    });
    setAppts(apptList);
    setInvAlerts((invRes.data ?? []) as InventoryAlert[]);
    setRecentPats((recentPatsRes.data ?? []) as RecentPatient[]);

    // Branch revenue (chain/superadmin)
    if (isChainAdmin && branchRes.data && branchRes.data.length > 0) {
      const clinicIds = (branchRes.data as { id: string; name: string }[]).map(c => c.id);
      const revPerClinic = await Promise.all(
        clinicIds.map(cid =>
          supabase.from("pending_invoices").select("total_amount").eq("clinic_id", cid).eq("status","paid").gte("created_at", monthStart())
        )
      );
      const bRevs: ClinicRevenue[] = (branchRes.data as { id: string; name: string }[]).map((c, i) => ({
        id:      c.id,
        name:    c.name,
        revenue: (revPerClinic[i].data ?? []).reduce((s: number, r: { total_amount?: number | null }) => s + (r.total_amount ?? 0), 0),
      }));
      setBranchRevs(bRevs.sort((a, b) => b.revenue - a.revenue));
    }

    setLoading(false);
  }, [profileLoading, activeClinicId, isGlobal, isChainAdmin]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Superadmin: load dev panel + demo data
  const fetchSuperAdminData = useCallback(async () => {
    if (!isSuperAdmin) return;
    setDevLoading(true);
    const [modRes, demoRes] = await Promise.all([
      supabase.from("module_registry").select("module_key,display_name,is_globally_killed,killed_reason").order("display_name"),
      supabase.from("clinics").select("id,name,admin_email,demo_created_at").eq("is_demo", true).order("name"),
    ]);
    setDevModules(modRes.data ?? []);
    setDemoList(demoRes.data ?? []);
    setDevLoading(false);
  }, [isSuperAdmin]);

  useEffect(() => { fetchSuperAdminData(); }, [fetchSuperAdminData]);

  async function toggleKillSwitch(moduleKey: string, killed: boolean) {
    const update: Record<string, unknown> = { is_globally_killed: killed };
    if (killed) update.killed_at = new Date().toISOString();
    else { update.killed_at = null; update.killed_reason = null; }
    await supabase.from("module_registry").update(update).eq("module_key", moduleKey);
    setDevModules(prev => prev.map(m => m.module_key === moduleKey ? { ...m, is_globally_killed: killed } : m));
  }

  async function createDemoClinic() {
    if (!demoName.trim()) return;
    setDemoCreating(true);
    const res = await fetch("/api/admin/demo/create", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: demoName.trim() }),
    });
    const json = await res.json();
    setDemoCreating(false);
    if (!res.ok) { const { toast: t } = await import("sonner"); t.error(json.error ?? "Creation failed"); return; }
    setDemoName("");
    setDemoResult({ email: json.email, password: json.password, loginUrl: json.loginUrl });
    fetchSuperAdminData();
  }

  async function clearDemoClinic(clinicId: string) {
    if (!confirm("Delete all data for this demo clinic?")) return;
    setDemoClearing(clinicId);
    await fetch("/api/admin/demo/clear", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinicId }),
    });
    setDemoClearing(null);
    fetchSuperAdminData();
  }

  const targetPct = kpi ? Math.min(100, Math.round((kpi.monthlyCollection / kpi.monthlyTarget) * 100)) : 0;

  return (
    <div className="min-h-full flex flex-col" style={{ background: "var(--background)" }}>
      <TopBar />
      {/* Dashboard Customize button */}
      {isAdmin && (
        <div className="flex justify-end px-8 pt-2">
          <button
            onClick={() => setCustomizeOpen(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: "rgba(197,160,89,0.08)", color: "var(--gold)", border: "1px solid rgba(197,160,89,0.2)" }}
          >
            <Pencil size={12} /> Customize Dashboard
          </button>
        </div>
      )}
      <div className="flex-1 px-8 pb-10 space-y-6 pt-2">

        {/* ── Global view banner ── */}
        {isGlobal && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl w-fit"
            style={{ background: "rgba(197,160,89,0.1)", border: "1px solid rgba(197,160,89,0.3)" }}>
            <Globe size={13} style={{ color: "#C5A059" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#8B6914", fontFamily: "Georgia, serif" }}>
              Global View — combined stats across all clinics
            </span>
          </div>
        )}

        {/* ── Superadmin: Dev Panel + Demo Manager ── */}
        {isSuperAdmin && (
          <div className="grid grid-cols-2 gap-5">

            {/* Dev Panel — Module Kill Switches */}
            <section className="luxury-card rounded-2xl overflow-hidden" style={{ background: "var(--surface)" }}>
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2">
                  <TerminalSquare size={15} style={{ color: "var(--gold)" }} />
                  <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>Dev Panel</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(180,60,60,0.1)", color: "#B43C3C", fontSize: 10, fontWeight: 700 }}>Kill Switches</span>
                </div>
                <button onClick={fetchSuperAdminData} style={{ background: "none", border: "none", cursor: "pointer" }}>
                  <RefreshCw size={13} style={{ color: "var(--text-muted)" }} className={devLoading ? "animate-spin" : ""} />
                </button>
              </div>
              <div style={{ maxHeight: 320, overflowY: "auto" }}>
                {devLoading ? (
                  <div className="flex justify-center py-8"><Loader2 size={18} style={{ color: "rgba(197,160,89,0.4)", animation: "spin 1s linear infinite" }} /></div>
                ) : devModules.length === 0 ? (
                  <p className="text-center text-xs py-8" style={{ color: "var(--text-muted)" }}>No modules in registry</p>
                ) : (
                  <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                    {devModules.map(mod => (
                      <div key={mod.module_key} className="px-5 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: mod.is_globally_killed ? "#B43C3C" : "var(--foreground)", fontFamily: "Georgia, serif" }}>
                            {mod.display_name}
                          </p>
                          <code className="text-xs" style={{ color: "var(--text-muted)" }}>{mod.module_key}</code>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {mod.is_globally_killed && <Skull size={12} style={{ color: "#B43C3C" }} />}
                          <button
                            onClick={() => toggleKillSwitch(mod.module_key, !mod.is_globally_killed)}
                            style={{
                              padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                              border: `1px solid ${mod.is_globally_killed ? "rgba(180,60,60,0.4)" : "rgba(197,160,89,0.3)"}`,
                              background: mod.is_globally_killed ? "rgba(180,60,60,0.1)" : "rgba(197,160,89,0.08)",
                              color: mod.is_globally_killed ? "#B43C3C" : "var(--gold)", cursor: "pointer",
                            }}
                          >
                            {mod.is_globally_killed ? "Revive" : "Kill"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Demo Manager */}
            <section className="luxury-card rounded-2xl overflow-hidden" style={{ background: "var(--surface)" }}>
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2">
                  <FlaskConical size={15} style={{ color: "#6366F1" }} />
                  <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>Demo Manager</h3>
                </div>
              </div>

              {/* Create form */}
              <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)", background: "rgba(99,102,241,0.03)" }}>
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>New Demo Clinic</p>
                <div className="flex gap-2">
                  <input type="text" value={demoName} onChange={e => setDemoName(e.target.value)}
                    placeholder="Clinic name…"
                    className="flex-1 text-sm px-3 py-1.5 rounded-lg outline-none"
                    style={{ border: "1px solid var(--border)", background: "white", color: "var(--foreground)", fontFamily: "Georgia, serif" }} />
                  <button onClick={createDemoClinic} disabled={demoCreating || !demoName.trim()}
                    style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#6366F1",
                      cursor: demoCreating || !demoName.trim() ? "not-allowed" : "pointer",
                      color: "white", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5,
                      opacity: !demoName.trim() ? 0.5 : 1 }}>
                    {demoCreating ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={12} />}
                    Create
                  </button>
                </div>

                {/* Result card */}
                {demoResult && (
                  <div className="mt-3 p-3 rounded-xl" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold" style={{ color: "#4F46E5" }}>Demo Clinic Created!</p>
                      <button onClick={() => setDemoResult(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                        <X size={12} style={{ color: "#6366F1" }} />
                      </button>
                    </div>
                    <div className="space-y-1 text-xs" style={{ color: "#4F46E5" }}>
                      <p><strong>Email:</strong> <code style={{ background: "rgba(99,102,241,0.15)", padding: "1px 5px", borderRadius: 3 }}>{demoResult.email}</code></p>
                      <p><strong>Password:</strong> <code style={{ background: "rgba(99,102,241,0.15)", padding: "1px 5px", borderRadius: 3 }}>{demoResult.password}</code></p>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {demoResult.loginUrl && (
                        <a href={demoResult.loginUrl} target="_blank" rel="noreferrer"
                          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "4px 10px",
                            borderRadius: 6, background: "#6366F1", color: "white", fontWeight: 600, textDecoration: "none" }}>
                          <ExternalLink size={10} /> Open Demo
                        </a>
                      )}
                      <button onClick={() => navigator.clipboard.writeText(`Email: ${demoResult.email}\nPassword: ${demoResult.password}`)}
                        style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6,
                          border: "1px solid rgba(99,102,241,0.3)", background: "transparent",
                          color: "#6366F1", cursor: "pointer", fontWeight: 600 }}>
                        Copy Credentials
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Demo list */}
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {demoList.length === 0 ? (
                  <p className="text-center text-xs py-6" style={{ color: "var(--text-muted)" }}>No demo clinics yet</p>
                ) : demoList.map(d => (
                  <div key={d.id} className="px-5 py-3 flex items-center justify-between gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>{d.name}</p>
                      <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{d.admin_email}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => {
                        fetch("/api/admin/magic-link", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ clinicId: d.id }),
                        }).then(r => r.json()).then(j => { if (j.url) window.open(j.url, "_blank"); });
                      }} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5,
                        border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.08)",
                        color: "#6366F1", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
                        <Eye size={9} /> Open
                      </button>
                      <button onClick={() => clearDemoClinic(d.id)} disabled={demoClearing === d.id}
                        style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5,
                          border: "1px solid rgba(180,60,60,0.3)", background: "rgba(180,60,60,0.06)",
                          color: "#B43C3C", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
                        {demoClearing === d.id ? <Loader2 size={9} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={9} />}
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

          </div>
        )}

        {/* ── KPI Cards (6) ── */}
        {dashConfig.sections.kpi_cards && (
        <section>
          <div className="grid grid-cols-6 gap-4">
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="luxury-card rounded-2xl p-4 flex items-center justify-center" style={{ background: "var(--surface)", minHeight: 100 }}>
                <Loader2 size={18} style={{ color: "rgba(197,160,89,0.4)", animation: "spin 1s linear infinite" }} />
              </div>
            )) : ([
              {
                key:   "revenue_today",
                label: "Today's Revenue",
                value: fmt(kpi?.todayRevenue ?? 0),
                sub:   `${kpi?.completedToday ?? 0} sessions done`,
                icon:  IndianRupee, color: "#C5A059",
                href:  "/billing",
                positive: (kpi?.todayRevenue ?? 0) > 0,
              },
              {
                key:   "monthly_collection",
                label: "Monthly Collection",
                value: fmt(kpi?.monthlyCollection ?? 0),
                sub:   `${targetPct}% of target`,
                icon:  TrendingUp, color: "#8B9E7A",
                href:  "/billing",
                positive: targetPct >= 50,
              },
              {
                key:   "monthly_target",
                label: "Monthly Target",
                value: fmt(kpi?.monthlyTarget ?? 0),
                sub:   targetPct >= 100 ? "Target achieved!" : `${100 - targetPct}% remaining`,
                icon:  Target, color: "#7A8E9E",
                href:  "/billing",
                positive: targetPct >= 80,
              },
              {
                key:   "total_patients",
                label: "Total Patients",
                value: (kpi?.totalPatients ?? 0).toLocaleString(),
                sub:   `+${kpi?.newThisMonth ?? 0} this month`,
                icon:  Users, color: "#9E8E7A",
                href:  "/patients",
                positive: (kpi?.newThisMonth ?? 0) > 0,
              },
              {
                key:   "appointments_today",
                label: "Today's Appointments",
                value: (kpi?.todayAppointments ?? 0).toString(),
                sub:   `${kpi?.completedToday ?? 0} completed`,
                icon:  Calendar, color: "#8B7EC8",
                href:  "/scheduler",
                positive: (kpi?.todayAppointments ?? 0) > 0,
              },
              {
                key:   "pending_dues",
                label: "Pending Dues",
                value: fmt(kpi?.pendingAmount ?? 0),
                sub:   "Outstanding invoices",
                icon:  Receipt, color: "#E8935A",
                href:  "/billing",
                positive: (kpi?.pendingAmount ?? 0) === 0,
              },
            ] as const).filter(card => !dashConfig.hidden_kpis.includes(card.key)).map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.key} href={card.href}
                  className="luxury-card rounded-2xl p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg group block"
                  style={{ background: "var(--surface)" }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${card.color}18` }}>
                      <Icon size={16} style={{ color: card.color }} />
                    </div>
                    <ChevronRight size={14} className="opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: card.color }} />
                  </div>
                  <p className="text-xl font-bold mb-1" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
                    {card.value}
                  </p>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>{card.label}</p>
                  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{
                    background: card.positive ? "rgba(139,158,122,0.12)" : "rgba(232,147,90,0.12)",
                    color:      card.positive ? "#6B8A5A" : "#C8673A",
                  }}>{card.sub}</span>
                </Link>
              );
            })}
          </div>
        </section>
        )}

        {/* ── Revenue Target Progress + Branch Comparison ── */}
        {dashConfig.sections.revenue_progress && (
        <section className="grid grid-cols-3 gap-5">
          {/* Monthly progress */}
          <div className="luxury-card rounded-2xl p-5 col-span-1" style={{ background: "var(--surface)" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 size={16} style={{ color: "var(--gold)" }} />
                <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
                  Monthly Target
                </h3>
              </div>
              <button onClick={fetchAll} className="opacity-50 hover:opacity-100 transition-opacity">
                <RefreshCw size={13} style={{ color: "var(--text-muted)" }} />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} style={{ color: "rgba(197,160,89,0.4)", animation: "spin 1s linear infinite" }} />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-2xl font-bold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
                      {targetPct}%
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>achieved</span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(197,160,89,0.12)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${targetPct}%`,
                        background: targetPct >= 80
                          ? "linear-gradient(90deg, #C5A059, #8B9E7A)"
                          : targetPct >= 50
                            ? "linear-gradient(90deg, #C5A059, #E8935A)"
                            : "linear-gradient(90deg, #E8935A, #B45050)",
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  {[
                    { label: "Collected",  value: fmt(kpi?.monthlyCollection ?? 0), color: "#8B9E7A" },
                    { label: "Target",     value: fmt(kpi?.monthlyTarget ?? 0),    color: "#C5A059" },
                    { label: "Remaining",  value: fmt(Math.max(0, (kpi?.monthlyTarget ?? 0) - (kpi?.monthlyCollection ?? 0))), color: "#E8935A" },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: row.color }} />
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{row.label}</span>
                      </div>
                      <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>{row.value}</span>
                    </div>
                  ))}
                </div>

                <Link href="/billing" className="block mt-3 text-center text-xs font-medium py-2 rounded-lg transition-opacity hover:opacity-80"
                  style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)", border: "1px solid rgba(197,160,89,0.25)" }}>
                  View Full Billing →
                </Link>
              </div>
            )}
          </div>

          {/* Branch comparison (chain/superadmin) or Today's summary (single clinic) */}
          <div className="luxury-card rounded-2xl p-5 col-span-2" style={{ background: "var(--surface)" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Building2 size={16} style={{ color: "var(--gold)" }} />
                <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
                  {isChainAdmin && branchRevs.length > 1 ? "Branch Revenue Comparison" : "Today at a Glance"}
                </h3>
              </div>
              {isChainAdmin && branchRevs.length > 1 && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(197,160,89,0.12)", color: "var(--gold)" }}>
                  This Month
                </span>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} style={{ color: "rgba(197,160,89,0.4)", animation: "spin 1s linear infinite" }} />
              </div>
            ) : isChainAdmin && branchRevs.length > 1 ? (
              // Branch comparison bars
              <div className="space-y-3">
                {branchRevs.map((b, i) => {
                  const maxRev = branchRevs[0].revenue || 1;
                  const pct = Math.round((b.revenue / maxRev) * 100);
                  return (
                    <div key={b.id}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-medium truncate max-w-[140px]" style={{ color: "var(--foreground)" }}>{b.name}</span>
                        <span className="text-xs font-semibold" style={{ color: i === 0 ? "var(--gold)" : "var(--text-muted)" }}>{fmt(b.revenue)}</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(197,160,89,0.1)" }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: i === 0
                              ? "linear-gradient(90deg, #C5A059, #A8853A)"
                              : "rgba(197,160,89,0.4)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Today's summary grid for single clinic
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Appointments",  value: kpi?.todayAppointments ?? 0, icon: Calendar,    color: "#8B7EC8", href: "/scheduler" },
                  { label: "Completed",     value: kpi?.completedToday ?? 0,    icon: CheckCircle2, color: "#8B9E7A", href: "/scheduler" },
                  { label: "New Patients",  value: kpi?.newThisMonth ?? 0,      icon: Users,        color: "#C5A059", href: "/patients"  },
                  { label: "Today Revenue", value: fmt(kpi?.todayRevenue ?? 0), icon: IndianRupee,  color: "#C5A059", href: "/billing"   },
                  { label: "Pending Dues",  value: fmt(kpi?.pendingAmount ?? 0),icon: Receipt,      color: "#E8935A", href: "/billing"   },
                  { label: "Stock Alerts",  value: invAlerts.length,            icon: AlertTriangle,color: "#E8935A", href: "/inventory" },
                ].map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <Link key={stat.label} href={stat.href}
                      className="p-3 rounded-xl group hover:scale-[1.03] transition-all duration-200 cursor-pointer"
                      style={{ background: "var(--surface-warm)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon size={14} style={{ color: stat.color }} />
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{stat.label}</span>
                      </div>
                      <p className="text-lg font-bold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
                        {typeof stat.value === "number" ? stat.value : stat.value}
                      </p>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>
        )}

        {/* ── Main Grid: Appointments + Right Panel ── */}
        {dashConfig.sections.appointments || dashConfig.sections.quick_actions || dashConfig.sections.inventory_alerts ? (
        <div className="grid grid-cols-3 gap-5">

          {/* ── Today's Appointments (Live) ── */}
          {dashConfig.sections.appointments && (
          <section className="col-span-2 luxury-card rounded-2xl overflow-hidden" style={{ background: "var(--surface)" }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-3">
                <Clock size={16} style={{ color: "var(--gold)" }} />
                <h3 className="text-base font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
                  Today&apos;s Appointments
                </h3>
                {!loading && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                    style={{ background: "rgba(197,160,89,0.15)", color: "var(--gold)" }}>
                    {appts.length} scheduled
                  </span>
                )}
              </div>
              <Link href="/scheduler" className="text-xs flex items-center gap-1 font-medium transition-opacity hover:opacity-70" style={{ color: "var(--gold)" }}>
                Open Scheduler <ChevronRight size={13} />
              </Link>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={22} style={{ color: "rgba(197,160,89,0.4)", animation: "spin 1s linear infinite" }} />
              </div>
            ) : appts.length === 0 ? (
              <div className="text-center py-14">
                <Calendar size={28} style={{ color: "rgba(197,160,89,0.3)", margin: "0 auto 10px" }} />
                <p className="text-sm" style={{ color: "var(--text-muted)", fontFamily: "Georgia, serif" }}>No appointments today</p>
                <Link href="/scheduler" className="inline-block mt-3 text-xs font-medium px-4 py-2 rounded-lg"
                  style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)", border: "1px solid rgba(197,160,89,0.3)" }}>
                  Schedule one →
                </Link>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--border)", maxHeight: 380, overflowY: "auto" }}>
                {appts.map((a) => {
                  const s = STATUS_CFG[a.status] ?? STATUS_CFG.planned;
                  const Icon = s.icon;
                  const initials = (a.patient_name ?? "?").split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
                  return (
                    <Link key={a.id} href="/scheduler"
                      className="px-6 py-3.5 flex items-center gap-4 hover:bg-stone-50 transition-colors cursor-pointer group"
                      style={{ display: "flex" }}
                    >
                      {/* Time */}
                      <div className="w-16 flex-shrink-0">
                        <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>{fmtTime(a.start_time)}</p>
                      </div>

                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: a.patient_tier === "vip" ? "#C5A059" : a.patient_tier === "hni" ? "#8B7EC8" : "#7A9E8E" }}>
                        {initials}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
                          {a.patient_name ?? "Walk-in"}
                        </p>
                        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                          {a.service_name ?? "Consultation"}
                        </p>
                      </div>

                      {/* Status */}
                      <span className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 flex-shrink-0 font-medium"
                        style={{ background: s.bg, color: s.color }}>
                        <Icon size={10} />
                        {s.label}
                      </span>

                      <ChevronRight size={14} className="opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: "var(--gold)" }} />
                    </Link>
                  );
                })}
              </div>
            )}

            <div className="px-6 py-3" style={{ borderTop: "1px solid var(--border)", background: "var(--surface-warm)" }}>
              <Link href="/scheduler"
                className="block w-full text-center text-sm font-medium py-2 rounded-xl transition-all duration-200 hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #C5A059, #A8853A)", color: "white", fontFamily: "Georgia, serif" }}>
                + Schedule New Appointment
              </Link>
            </div>
          </section>
          )}

          {/* ── Right panel: Quick Links + Inventory Alerts ── */}
          {(dashConfig.sections.quick_actions || dashConfig.sections.inventory_alerts) && (
          <div className="col-span-1 space-y-5">

            {/* Quick Links */}
            {dashConfig.sections.quick_actions && (
            <section className="luxury-card rounded-2xl overflow-hidden" style={{ background: "var(--surface)" }}>
              <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <Zap size={15} style={{ color: "var(--gold)" }} />
                <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>Quick Links</h3>
              </div>
              <div className="p-3 grid grid-cols-2 gap-2">
                {[
                  { icon: UserPlus,    label: "New Patient",   desc: "Register client",     color: "#C5A059", action: "new-patient" },
                  { icon: Calendar,    label: "Scheduler",     desc: "Book appointment",    color: "#8B7EC8", href: "/scheduler"    },
                  { icon: Camera,      label: "Photo Compare", desc: "Before / after",      color: "#8B9E7A", href: "/photos"       },
                  { icon: FlaskConical,label: "Inventory",     desc: "Check stock",         color: "#7A8E9E", href: "/inventory"    },
                  { icon: FileText,    label: "Patient Records",desc: "View all records",   color: "#9E8E7A", href: "/patients"     },
                  { icon: Receipt,     label: "Billing",       desc: "Invoices & payments", color: "#E8935A", href: "/billing"      },
                ].map((item) => {
                  const Icon = item.icon;
                  const inner = (
                    <>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-1.5" style={{ background: `${item.color}18` }}>
                        <Icon size={13} style={{ color: item.color }} />
                      </div>
                      <p className="text-xs font-semibold leading-tight" style={{ color: "var(--foreground)" }}>{item.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)", fontSize: 10 }}>{item.desc}</p>
                    </>
                  );
                  return item.action ? (
                    <button key={item.label} onClick={() => setShowNewPat(true)}
                      className="flex flex-col items-start p-2.5 rounded-xl border text-left transition-all duration-200 hover:scale-[1.03]"
                      style={{ background: "rgba(197,160,89,0.07)", borderColor: "rgba(197,160,89,0.35)" }}>
                      {inner}
                    </button>
                  ) : (
                    <Link key={item.label} href={item.href!}
                      className="flex flex-col items-start p-2.5 rounded-xl border text-left transition-all duration-200 hover:scale-[1.03]"
                      style={{ background: "var(--surface-warm)", borderColor: "var(--border)" }}>
                      {inner}
                    </Link>
                  );
                })}
              </div>
            </section>
            )}

            {/* Inventory Alerts */}
            {dashConfig.sections.inventory_alerts && (
            <section className="luxury-card rounded-2xl overflow-hidden" style={{ background: "var(--surface)" }}>
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#E8935A" }} />
                  <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>Stock Alerts</h3>
                </div>
                <Link href="/inventory" className="text-xs" style={{ color: "var(--gold)" }}>View all →</Link>
              </div>
              <div className="px-5 py-3 space-y-3">
                {loading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 size={16} style={{ color: "rgba(197,160,89,0.4)", animation: "spin 1s linear infinite" }} />
                  </div>
                ) : invAlerts.length === 0 ? (
                  <div className="text-center py-4">
                    <Package size={20} style={{ color: "rgba(197,160,89,0.3)", margin: "0 auto 6px" }} />
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>All stock levels OK</p>
                  </div>
                ) : invAlerts.map((item) => {
                  const isUrgent = item.quantity <= 3;
                  return (
                    <Link key={item.id} href="/inventory" className="flex items-center justify-between group">
                      <div className="flex items-center gap-2 min-w-0">
                        <Circle size={5} fill={isUrgent ? "#E8935A" : "#C5A059"} stroke="none" className="flex-shrink-0" />
                        <p className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>{item.product_name}</p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2"
                        style={{
                          background: isUrgent ? "rgba(232,147,90,0.15)" : "rgba(197,160,89,0.12)",
                          color:      isUrgent ? "#C8673A" : "#A8853A",
                        }}>
                        {item.quantity} left
                      </span>
                    </Link>
                  );
                })}
                <Link href="/inventory"
                  className="block w-full mt-1 text-center text-xs font-medium py-2 rounded-lg transition-opacity hover:opacity-70"
                  style={{ color: "var(--gold)", border: "1px solid rgba(197,160,89,0.35)" }}>
                  Manage Inventory →
                </Link>
              </div>
            </section>
            )}
          </div>
          )}
        </div>
        ) : null}

        {/* ── Recent Patients ── */}
        {dashConfig.sections.recent_patients && (
        <section className="luxury-card rounded-2xl overflow-hidden" style={{ background: "var(--surface)" }}>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-3">
              <Users size={16} style={{ color: "var(--gold)" }} />
              <h3 className="text-base font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>Recent Patients</h3>
              {isGlobal && (
                <span className="text-xs px-2.5 py-0.5 rounded-full" style={{ background: "rgba(197,160,89,0.15)", color: "var(--gold)" }}>All Clinics</span>
              )}
            </div>
            <Link href="/patients" className="text-xs flex items-center gap-1 font-medium transition-opacity hover:opacity-70" style={{ color: "var(--gold)" }}>
              View all records <ChevronRight size={13} />
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} style={{ color: "rgba(197,160,89,0.4)", animation: "spin 1s linear infinite" }} />
            </div>
          ) : recentPats.length === 0 ? (
            <div className="text-center py-12">
              <Sparkles size={26} style={{ color: "rgba(197,160,89,0.3)", margin: "0 auto 10px" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)", fontFamily: "Georgia, serif" }}>No patients registered yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 divide-x" style={{ borderColor: "var(--border)" }}>
              {recentPats.map((p, i) => {
                const initials = p.full_name.split(" ").map(n => n[0]).slice(0, 2).join("");
                const concern  = Array.isArray(p.primary_concern)
                  ? (p.primary_concern[0] ?? null)
                  : (p.primary_concern?.split(",")[0].trim() ?? null);
                return (
                  <div key={p.id} onClick={() => {
                    logAction({ action: "view_patient_profile", targetId: p.id, targetName: p.full_name, metadata: { source: "overview_recent_patients" } });
                    router.push(`/patients/${p.id}`);
                  }}
                    className="px-5 py-4 flex items-center gap-3 hover:bg-stone-50 transition-colors cursor-pointer group"
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>{p.full_name}</p>
                      {concern && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full mt-0.5 inline-block"
                          style={{ background: "rgba(197,160,89,0.08)", color: "#7A5C14", border: "1px solid rgba(197,160,89,0.2)", fontSize: 10 }}>
                          {concern}
                        </span>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtDate(p.created_at)}</p>
                      <ChevronRight size={12} className="opacity-0 group-hover:opacity-60 transition-opacity ml-auto mt-1" style={{ color: "var(--gold)" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="px-6 py-3" style={{ borderTop: "1px solid var(--border)", background: "var(--surface-warm)" }}>
            <Link href="/patients"
              className="block w-full text-center text-sm font-medium py-2 rounded-xl transition-all duration-200 hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #C5A059, #A8853A)", color: "white", fontFamily: "Georgia, serif" }}>
              Open Patient Records
            </Link>
          </div>
        </section>
        )}


      </div>

      {/* New Patient Modal */}
      <NewPatientModal isOpen={showNewPat} onClose={() => setShowNewPat(false)} />

      {/* Dashboard Customize Drawer */}
      {customizeOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setCustomizeOpen(false)} />
          <div className="w-80 h-full overflow-y-auto flex flex-col" style={{ background: "#fff" }}>
            {/* Header */}
            <div className="flex justify-between items-center px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid rgba(197,160,89,0.15)" }}>
              <h3 className="font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Customize Dashboard</h3>
              <button onClick={() => setCustomizeOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X size={16} />
              </button>
            </div>

            {/* Sections */}
            <div className="flex-1 overflow-y-auto p-5 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "#9ca3af" }}>Sections</p>

              {/* KPI Cards toggle + sub-toggles */}
              <div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium" style={{ color: "#1a1714" }}>KPI Cards</span>
                  <button onClick={() => toggleSection("kpi_cards")}
                    className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                    style={{ background: dashConfig.sections.kpi_cards ? "var(--gold)" : "rgba(197,160,89,0.2)" }}>
                    <span className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
                      style={{ transform: dashConfig.sections.kpi_cards ? "translateX(18px)" : "translateX(2px)" }} />
                  </button>
                </div>
                {dashConfig.sections.kpi_cards && (
                  <div className="ml-3 mt-1 mb-2 space-y-1.5 pl-3" style={{ borderLeft: "2px solid rgba(197,160,89,0.15)" }}>
                    {[
                      { key: "revenue_today",      label: "Today's Revenue"       },
                      { key: "monthly_collection", label: "Monthly Collection"    },
                      { key: "monthly_target",     label: "Monthly Target"        },
                      { key: "total_patients",     label: "Total Patients"        },
                      { key: "appointments_today", label: "Today's Appointments"  },
                      { key: "pending_dues",       label: "Pending Dues"          },
                    ].map(card => {
                      const hidden = dashConfig.hidden_kpis.includes(card.key);
                      return (
                        <label key={card.key} className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={!hidden} onChange={() => toggleKpi(card.key)}
                            className="rounded" style={{ accentColor: "var(--gold)" }} />
                          <span className="text-xs" style={{ color: hidden ? "#9ca3af" : "#4b5563" }}>{card.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {[
                { key: "revenue_progress" as const, label: "Revenue Progress"       },
                { key: "appointments"     as const, label: "Today's Appointments"   },
                { key: "quick_actions"    as const, label: "Quick Actions"          },
                { key: "inventory_alerts" as const, label: "Inventory Alerts"       },
                { key: "recent_patients"  as const, label: "Recent Patients"        },
              ].map(s => (
                <div key={s.key} className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium" style={{ color: "#1a1714" }}>{s.label}</span>
                  <button onClick={() => toggleSection(s.key)}
                    className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                    style={{ background: dashConfig.sections[s.key] ? "var(--gold)" : "rgba(197,160,89,0.2)" }}>
                    <span className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
                      style={{ transform: dashConfig.sections[s.key] ? "translateX(18px)" : "translateX(2px)" }} />
                  </button>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: "1px solid rgba(197,160,89,0.15)", background: "rgba(249,247,242,0.7)" }}>
              <p className="text-xs mb-2" style={{ color: "#9ca3af" }}>Changes save automatically</p>
              <button onClick={resetToDefaults}
                className="text-xs font-medium px-3 py-1.5 rounded-lg"
                style={{ border: "1px solid rgba(197,160,89,0.25)", color: "#9C9584" }}>
                Reset to defaults
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
