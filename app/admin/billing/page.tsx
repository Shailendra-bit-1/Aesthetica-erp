"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  CreditCard, Users, Building2, Network, CheckCircle2, AlertTriangle,
  IndianRupee, Loader2, RefreshCw, Receipt, Smartphone, Landmark,
  ChevronDown, Bell, Ban, RotateCcw, Calendar, MapPin,
  Mail, Hash, Plus, Pencil, Trash2, X, Sparkles, GripVertical,
  ExternalLink, Eye, Clock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import { toast } from "sonner";
import { useImpersonation } from "@/contexts/ImpersonationContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DbPlan {
  id:            string;
  key:           string;
  label:         string;
  price:         number;
  color:         string;
  features:      string[];
  is_active:     boolean;
  sort_order:    number;
  features_json: Record<string, boolean> | null;
}

interface ClinicRow {
  id:                  string;
  name:                string;
  location:            string | null;
  admin_email:         string | null;
  subscription_status: string;
  subscription_plan:   string;
  chain_id:            string | null;
  chain_name:          string | null;
  gst_number:          string | null;
  patient_count:       number;
  revenue_mtd:         number;
  billing_method:      string | null;
  created_at:          string;
  grace_period_days:   number;
  warning_days_before: number;
  next_billing_date:   string | null;
  is_trial:            boolean;
  trial_ends_at:       string | null;
}

interface ModuleRegistry {
  module_key:   string;
  display_name: string;
  is_core:      boolean;
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
  id:          string;
  clinic_id:   string | null;
  chain_id:    string | null;
  amount:      number;
  status:      string;
  method:      string | null;
  paid_at:     string | null;
  created_at:  string;
  clinic_name?: string;
  chain_name?:  string;
}

type TabKey = "clinics" | "chains" | "payments";
type Status  = "active" | "past_due" | "canceled";

// ── Static config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  active:   { label: "Active",   bg: "#EFF6EF", text: "#2A5A2A", dot: "#4A8A4A" },
  past_due: { label: "Past Due", bg: "#FFF8E8", text: "#92600A", dot: "#D4A017" },
  canceled: { label: "Canceled", bg: "#FEF2F2", text: "#8A1A1A", dot: "#EF4444" },
  trial:    { label: "Trial",    bg: "#F0F4FF", text: "#2A3A8A", dot: "#4A6AEF" },
};

const METHOD_ICON: Record<string, React.ElementType> = {
  credit_card: CreditCard, bank_transfer: Landmark, upi: Smartphone,
};
const METHOD_LABEL: Record<string, string> = {
  credit_card: "Card", bank_transfer: "Bank", upi: "UPI",
};

const PRESET_COLORS = [
  "#6B7280", "#C5A059", "#7C3AED", "#2A4A8A", "#4A8A4A",
  "#EF4444", "#F59E0B", "#10B981", "#EC4899", "#0EA5E9",
];

const fmt     = (n: number) => "₹" + (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtFull = (n: number) => "₹" + (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function planBg(color: string)     { return color + "18"; }
function planBorder(color: string) { return color + "33"; }

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputSx: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 10, fontSize: 13,
  fontFamily: "Georgia, serif", background: "#FDFCF9",
  border: "1px solid var(--border)", color: "var(--foreground)",
  outline: "none", transition: "all 0.2s", boxSizing: "border-box",
};
const labelSx: React.CSSProperties = {
  display: "block", fontSize: 10, fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.09em",
  color: "var(--text-muted)", marginBottom: 5,
};

// ── Plan Drawer ───────────────────────────────────────────────────────────────

function PlanDrawer({
  open, plan, modules, onClose, onSave,
}: {
  open:    boolean;
  plan:    DbPlan | null;   // null = new
  modules: ModuleRegistry[];
  onClose: () => void;
  onSave:  (p: DbPlan) => void;
}) {
  const isEdit = !!plan;
  const [visible, setVisible] = useState(false);
  const [saving, setSaving]   = useState(false);

  const [key,      setKey]      = useState("");
  const [label,    setLabel]    = useState("");
  const [price,    setPrice]    = useState(0);
  const [color,    setColor]    = useState("#C5A059");
  const [features, setFeatures] = useState<string[]>([""]);
  const [active,   setActive]   = useState(true);
  const [featJson, setFeatJson] = useState<Record<string, boolean>>({});
  const newFeatRef = useRef<HTMLInputElement>(null);

  // Sync form when plan or open changes
  useEffect(() => {
    if (open) {
      setKey(plan?.key ?? "");
      setLabel(plan?.label ?? "");
      setPrice(plan?.price ?? 0);
      setColor(plan?.color ?? "#C5A059");
      setFeatures(plan?.features?.length ? [...plan.features] : [""]);
      setActive(plan?.is_active ?? true);
      setFeatJson(plan?.features_json ?? {});
    }
  }, [open, plan]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => setVisible(true));
    else setVisible(false);
  }, [open]);

  function addFeature() {
    setFeatures(f => [...f, ""]);
    setTimeout(() => newFeatRef.current?.focus(), 50);
  }
  function updateFeature(i: number, val: string) {
    setFeatures(f => f.map((x, j) => j === i ? val : x));
  }
  function removeFeature(i: number) {
    setFeatures(f => f.filter((_, j) => j !== i));
  }

  async function handleSave() {
    const cleanKey = key.trim().toLowerCase().replace(/\s+/g, "_");
    if (!cleanKey || !label.trim()) {
      toast.error("Plan key and label are required");
      return;
    }
    setSaving(true);
    const cleanFeatures = features.map(f => f.trim()).filter(Boolean);
    const payload = {
      key: cleanKey, label: label.trim(), price, color,
      features: cleanFeatures, is_active: active, features_json: featJson,
    };

    if (isEdit && plan) {
      const { data, error } = await supabase
        .from("subscription_plans")
        .update(payload)
        .eq("id", plan.id)
        .select()
        .single();
      if (error) { toast.error("Failed to update plan", { description: error.message }); }
      else        { toast.success(`"${data.label}" updated`); onSave(data as DbPlan); onClose(); }
    } else {
      const { data, error } = await supabase
        .from("subscription_plans")
        .insert({ ...payload, sort_order: 99 })
        .select()
        .single();
      if (error) { toast.error("Failed to create plan", { description: error.message }); }
      else        { toast.success(`"${data.label}" plan created`); onSave(data as DbPlan); onClose(); }
    }
    setSaving(false);
  }

  if (typeof window === "undefined") return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(28,25,23,0.4)",
          backdropFilter: "blur(4px)", zIndex: 50,
          opacity: visible ? 1 : 0, transition: "opacity 0.25s",
          pointerEvents: open ? "auto" : "none",
        }}
      />

      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 460,
        background: "white", zIndex: 51, display: "flex", flexDirection: "column",
        transform: visible ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
        boxShadow: "-4px 0 32px rgba(28,25,23,0.18)",
      }}>
        {/* Gold bar */}
        <div style={{ height: 3, background: "linear-gradient(90deg, #C5A059, #A8853A)" }} />

        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F0EBE2", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(197,160,89,0.12)", border: "1px solid rgba(197,160,89,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {isEdit ? <Pencil size={16} color="#C5A059" /> : <Plus size={16} color="#C5A059" />}
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#1A1A1A", fontFamily: "Georgia, serif" }}>
                {isEdit ? "Edit Plan" : "New Plan"}
              </p>
              <p style={{ fontSize: 11, color: "#8A8078" }}>
                {isEdit ? plan?.label : "Add a subscription tier"}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #E8E2D4", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#8A8078" }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Key */}
            <div>
              <label style={labelSx}>Plan Key (unique ID)</label>
              <input
                type="text"
                placeholder="e.g. pro_plus"
                value={key}
                disabled={isEdit}
                onChange={e => setKey(e.target.value)}
                style={{ ...inputSx, fontFamily: "monospace", opacity: isEdit ? 0.55 : 1, cursor: isEdit ? "not-allowed" : "text" }}
                onFocus={e => { e.target.style.borderColor = "#C5A059"; e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.1)"; }}
                onBlur={e  => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
              />
              {isEdit && <p style={{ fontSize: 10, color: "#8A8078", marginTop: 3 }}>Key cannot be changed after creation.</p>}
            </div>

            {/* Label */}
            <div>
              <label style={labelSx}>Display Name</label>
              <input
                type="text"
                placeholder="e.g. Professional"
                value={label}
                onChange={e => setLabel(e.target.value)}
                style={inputSx}
                onFocus={e => { e.target.style.borderColor = "#C5A059"; e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.1)"; }}
                onBlur={e  => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
              />
            </div>

            {/* Price */}
            <div>
              <label style={labelSx}>Monthly Price (₹)</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#8A8078", fontSize: 13 }}>₹</span>
                <input
                  type="number"
                  min={0}
                  value={price}
                  onChange={e => setPrice(Number(e.target.value))}
                  style={{ ...inputSx, paddingLeft: 24 }}
                  onFocus={e => { e.target.style.borderColor = "#C5A059"; e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.1)"; }}
                  onBlur={e  => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                />
              </div>
              <p style={{ fontSize: 10, color: "#8A8078", marginTop: 3 }}>
                {price === 0 ? "Free forever" : `${fmt(price)} / month per clinic`}
              </p>
            </div>

            {/* Color */}
            <div>
              <label style={labelSx}>Accent Color</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{
                      width: 28, height: 28, borderRadius: 8, background: c, border: "none",
                      cursor: "pointer", outline: color === c ? `3px solid ${c}` : "none",
                      outlineOffset: 2, transition: "outline 0.1s",
                    }}
                  />
                ))}
              </div>
              {/* Live preview pill */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: planBg(color), border: `1px solid ${planBorder(color)}`, width: "fit-content" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: "Georgia, serif" }}>{label || "Plan preview"}</span>
              </div>
            </div>

            {/* Features */}
            <div>
              <label style={labelSx}>Features</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {features.map((f, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <GripVertical size={14} color="#C5A059" style={{ flexShrink: 0, opacity: 0.5 }} />
                    <input
                      ref={i === features.length - 1 ? newFeatRef : undefined}
                      type="text"
                      placeholder={`Feature ${i + 1}`}
                      value={f}
                      onChange={e => updateFeature(i, e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addFeature(); } }}
                      style={{ ...inputSx, flex: 1 }}
                      onFocus={e => { e.target.style.borderColor = "#C5A059"; e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.1)"; }}
                      onBlur={e  => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                    />
                    <button
                      type="button"
                      onClick={() => removeFeature(i)}
                      disabled={features.length === 1}
                      style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #E8E2D4", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#8A8078", flexShrink: 0, opacity: features.length === 1 ? 0.3 : 1 }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addFeature}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 10, border: "1px dashed rgba(197,160,89,0.4)", background: "rgba(197,160,89,0.04)", color: "#C5A059", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  <Plus size={12} /> Add Feature
                </button>
              </div>
            </div>

            {/* Active toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, background: active ? "rgba(74,138,74,0.06)" : "rgba(138,128,120,0.06)", border: `1px solid ${active ? "rgba(74,138,74,0.2)" : "rgba(138,128,120,0.15)"}` }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A", fontFamily: "Georgia, serif" }}>Active Plan</p>
                <p style={{ fontSize: 11, color: "#8A8078" }}>{active ? "Visible and assignable to clinics" : "Hidden from plan selectors"}</p>
              </div>
              <button
                type="button"
                onClick={() => setActive(a => !a)}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                  background: active ? "linear-gradient(135deg, #C5A059, #A8853A)" : "#D1C9BC",
                  position: "relative", transition: "all 0.2s",
                }}
              >
                <span style={{
                  position: "absolute", top: 3, left: active ? 23 : 3, width: 18, height: 18,
                  borderRadius: "50%", background: "white", transition: "left 0.2s",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
                }} />
              </button>
            </div>

            {/* Module Access */}
            <div>
              <label style={labelSx}>Module Access</label>
              <p style={{ fontSize: 10, color: "#8A8078", marginBottom: 8 }}>
                Check modules that clinics on this plan can access. This sets the default — individual clinic overrides take precedence.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {modules.map(mod => {
                  const isOn = featJson[mod.module_key] ?? false;
                  return (
                    <label key={mod.module_key} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
                      borderRadius: 8, cursor: "pointer",
                      background: isOn ? "rgba(74,138,74,0.06)" : "rgba(156,149,132,0.04)",
                      border: `1px solid ${isOn ? "rgba(74,138,74,0.2)" : "rgba(156,149,132,0.15)"}`,
                    }}>
                      <input type="checkbox" checked={isOn}
                        onChange={e => setFeatJson(prev => ({ ...prev, [mod.module_key]: e.target.checked }))}
                        style={{ accentColor: "#C5A059", width: 13, height: 13 }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "#1A1A1A", fontFamily: "Georgia, serif", margin: 0 }}>
                          {mod.display_name}
                        </p>
                        {mod.is_core && <p style={{ fontSize: 9, color: "#8A8078", margin: 0 }}>Always on</p>}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid #F0EBE2", display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid #E8E2D4", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#8A8078", fontFamily: "Georgia, serif" }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !key.trim() || !label.trim()}
            style={{
              flex: 2, padding: "10px 0", borderRadius: 10, border: "none",
              background: saving || !key.trim() || !label.trim() ? "rgba(197,160,89,0.35)" : "linear-gradient(135deg, #C5A059, #A8853A)",
              color: "white", cursor: saving || !key.trim() || !label.trim() ? "not-allowed" : "pointer",
              fontSize: 13, fontWeight: 600, fontFamily: "Georgia, serif",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {saving ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Saving…</> : <><Sparkles size={13} /> {isEdit ? "Save Changes" : "Create Plan"}</>}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminBillingPage() {
  const { profile, loading: profileLoading } = useClinic();
  const { startImpersonation } = useImpersonation();

  const [tab,      setTab]      = useState<TabKey>("clinics");
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");

  const [plans,    setPlans]    = useState<DbPlan[]>([]);
  const [clinics,  setClinics]  = useState<ClinicRow[]>([]);
  const [chains,   setChains]   = useState<ChainRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [modules,  setModules]  = useState<ModuleRegistry[]>([]);

  // KPIs
  const [mrr,        setMrr]        = useState(0);
  const [mtdRevenue, setMtdRevenue] = useState(0);
  const [activeCnt,  setActiveCnt]  = useState(0);
  const [pastDueCnt, setPastDueCnt] = useState(0);

  // Inline action state
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Grace period editing
  const [editGrace,   setEditGrace]   = useState<Record<string, { days: number; warn: number }>>({});
  const [savingGrace, setSavingGrace] = useState<string | null>(null);

  // Plan drawer
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [editingPlan, setEditingPlan] = useState<DbPlan | null>(null);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const firstOfMonth = new Date(
        new Date().getFullYear(), new Date().getMonth(), 1
      ).toISOString();

      // Plans + Clinics + Chain billing in parallel
      const [plansRes, clinicRes, cbRes, chainRes, cbChainRes, pmtRes, moduleRes] = await Promise.all([
        supabase.from("subscription_plans").select("*").order("sort_order"),
        supabase.from("clinics").select("id,name,location,admin_email,subscription_status,subscription_plan,chain_id,gst_number,created_at,chains(name),grace_period_days,warning_days_before,next_billing_date,is_trial,trial_ends_at").order("created_at", { ascending: false }),
        supabase.from("clinic_billing_methods").select("clinic_id,method_type").eq("is_active", true),
        supabase.from("chains").select("id,name").order("created_at", { ascending: false }),
        supabase.from("chain_billing_methods").select("chain_id,method_type,grace_period_days,warning_days_before").eq("is_active", true),
        supabase.from("subscription_payments").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("module_registry").select("module_key,display_name,is_core").order("display_name"),
      ]);

      const dbPlans = (plansRes.data ?? []) as DbPlan[];
      setPlans(dbPlans);
      setModules(moduleRes.data ?? []);

      // Build lookup maps
      const cbMap: Record<string, string> = {};
      (cbRes.data ?? []).forEach(r => { cbMap[r.clinic_id] = r.method_type; });

      // Enrich clinics
      const enriched: ClinicRow[] = await Promise.all(
        (clinicRes.data ?? []).map(async c => {
          const [{ count: pCount }, { data: invData }] = await Promise.all([
            supabase.from("patients").select("*", { count: "exact", head: true }).eq("clinic_id", c.id),
            supabase.from("pending_invoices").select("total_amount,amount,tax_amount").eq("clinic_id", c.id).eq("status", "paid").gte("created_at", firstOfMonth),
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
            subscription_plan:   c.subscription_plan ?? "growth",
            chain_id:            c.chain_id,
            chain_name:          chainInfo?.name ?? null,
            gst_number:          c.gst_number,
            patient_count:       pCount ?? 0,
            revenue_mtd:         revMTD,
            billing_method:      cbMap[c.id] ?? null,
            created_at:          c.created_at,
            grace_period_days:   (c as any).grace_period_days ?? 7,
            warning_days_before: (c as any).warning_days_before ?? 3,
            next_billing_date:   (c as any).next_billing_date ?? null,
            is_trial:            (c as any).is_trial ?? false,
            trial_ends_at:       (c as any).trial_ends_at ?? null,
          };
        })
      );
      setClinics(enriched);

      // KPIs
      const planPriceMap: Record<string, number> = {};
      dbPlans.forEach(p => { planPriceMap[p.key] = p.price; });
      const active  = enriched.filter(c => c.subscription_status === "active");
      const pastDue = enriched.filter(c => c.subscription_status === "past_due");
      setActiveCnt(active.length);
      setPastDueCnt(pastDue.length);
      setMrr(active.reduce((s, c) => s + (planPriceMap[c.subscription_plan] ?? 0), 0));
      setMtdRevenue(enriched.reduce((s, c) => s + c.revenue_mtd, 0));

      // Chains
      type CbChainRow = { chain_id: string; method_type: string; grace_period_days: number; warning_days_before: number };
      const cbChainMap: Record<string, CbChainRow> = {};
      (cbChainRes.data ?? []).forEach(r => { cbChainMap[r.chain_id] = r as CbChainRow; });

      setChains((chainRes.data ?? []).map(ch => {
        const bm = cbChainMap[ch.id];
        return {
          id: ch.id, name: ch.name,
          clinic_count:        enriched.filter(c => c.chain_id === ch.id).length,
          billing_method:      bm?.method_type ?? null,
          grace_period_days:   bm?.grace_period_days ?? null,
          warning_days_before: bm?.warning_days_before ?? null,
        };
      }));

      // Payments
      setPayments((pmtRes.data ?? []).map(p => ({
        ...p,
        clinic_name: enriched.find(c => c.id === p.clinic_id)?.name,
        chain_name:  (chainRes.data ?? []).find(ch => ch.id === p.chain_id)?.name,
      })));

    } catch (err) {
      console.error(err);
      toast.error("Failed to load billing data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!profileLoading) fetchAll(); }, [profileLoading, fetchAll]);

  // ── Plan CRUD ─────────────────────────────────────────────────────────────

  function handlePlanSaved(saved: DbPlan) {
    setPlans(prev => {
      const exists = prev.find(p => p.id === saved.id);
      return exists ? prev.map(p => p.id === saved.id ? saved : p) : [...prev, saved];
    });
  }

  async function handleDeletePlan(plan: DbPlan) {
    const inUse = clinics.filter(c => c.subscription_plan === plan.key).length;
    if (inUse > 0) {
      toast.error(`Cannot delete "${plan.label}"`, {
        description: `${inUse} clinic${inUse > 1 ? "s are" : " is"} on this plan. Reassign them first.`,
      });
      return;
    }
    setDeletingId(plan.id);
    const { error } = await supabase.from("subscription_plans").delete().eq("id", plan.id);
    if (error) {
      toast.error("Failed to delete plan", { description: error.message });
    } else {
      setPlans(prev => prev.filter(p => p.id !== plan.id));
      toast.success(`"${plan.label}" deleted`);
    }
    setDeletingId(null);
  }

  // ── Clinic actions ────────────────────────────────────────────────────────

  async function updatePlan(clinicId: string, planKey: string) {
    setUpdatingId(clinicId);
    const { error } = await supabase.from("clinics").update({ subscription_plan: planKey }).eq("id", clinicId);
    if (error) { toast.error("Failed to update plan"); }
    else {
      setClinics(prev => prev.map(c => c.id === clinicId ? { ...c, subscription_plan: planKey } : c));
      toast.success(`Plan changed to ${plans.find(p => p.key === planKey)?.label ?? planKey}`);
    }
    setUpdatingId(null);
  }

  async function updateStatus(clinicId: string, status: Status) {
    setUpdatingId(clinicId);
    const { error } = await supabase.from("clinics").update({ subscription_status: status }).eq("id", clinicId);
    if (error) { toast.error("Failed to update status"); }
    else {
      setClinics(prev => prev.map(c => c.id === clinicId ? { ...c, subscription_status: status } : c));
      const labels: Record<Status, string> = { active: "Activated", past_due: "Marked Past Due", canceled: "Suspended" };
      toast.success(labels[status]);
    }
    setUpdatingId(null);
  }

  // ── Grace period save ─────────────────────────────────────────────────────

  async function saveGracePeriod(clinicId: string) {
    const vals = editGrace[clinicId];
    if (!vals) return;
    setSavingGrace(clinicId);
    const { error } = await supabase.from("clinics")
      .update({ grace_period_days: vals.days, warning_days_before: vals.warn })
      .eq("id", clinicId);
    if (error) { toast.error("Failed to save grace period"); }
    else {
      setClinics(prev => prev.map(c => c.id === clinicId
        ? { ...c, grace_period_days: vals.days, warning_days_before: vals.warn } : c));
      setEditGrace(prev => { const n = { ...prev }; delete n[clinicId]; return n; });
      toast.success("Grace period saved");
    }
    setSavingGrace(null);
  }

  // ── Login As ──────────────────────────────────────────────────────────────

  async function handleLoginAs(clinicId: string, clinicName: string) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("clinic_id", clinicId)
      .order("role")
      .limit(10);
    const preferred = (profiles ?? []).find(p => p.role === "clinic_admin")
      ?? (profiles ?? [])[0];
    if (!preferred) {
      toast.error("No staff users found for this clinic. Create a clinic admin first.");
      return;
    }
    const res = await fetch("/api/admin/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: preferred.id }),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error ?? "Magic link failed"); return; }
    window.open(json.url, "_blank");
    toast.success(`Opening ${clinicName} as ${preferred.role}`);
  }

  // ── Guard ─────────────────────────────────────────────────────────────────

  if (!profileLoading && profile?.role !== "superadmin") {
    return (
      <div className="min-h-full" style={{ background: "var(--background)" }}>
        <div className="flex items-center justify-center" style={{ minHeight: "60vh" }}>
          <p style={{ color: "var(--text-muted)" }}>Superadmin access required.</p>
        </div>
      </div>
    );
  }

  const filteredClinics = clinics.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.admin_email ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (c.location ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const pastDueClinics = clinics.filter(c => c.subscription_status === "past_due");

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full" style={{ background: "var(--background)" }}>
      <div className="px-6 py-6 max-w-[1440px] mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold uppercase tracking-widest"
                style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)" }}>Superadmin</span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>·</span>
              <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: "var(--text-muted)" }}>Platform Billing</span>
            </div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
              Billing &amp; Plans
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              Manage subscription plans and clinic billing across the network.
            </p>
          </div>
          <button onClick={fetchAll} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ background: "rgba(197,160,89,0.08)", color: "var(--gold)", border: "1px solid rgba(197,160,89,0.2)" }}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="Monthly Recurring Revenue" value={fmt(mrr)} sub="from active subscriptions" Icon={TrendingUp} color="#C5A059" bg="rgba(197,160,89,0.08)" loading={loading} />
          <KpiCard label="MTD Collections" value={fmtFull(mtdRevenue)} sub="paid invoices this month" Icon={IndianRupee} color="#4A8A4A" bg="rgba(74,138,74,0.08)" loading={loading} />
          <KpiCard label="Active Subscriptions" value={activeCnt} sub={`of ${clinics.length} total clinics`} Icon={Building2} color="#2A4A8A" bg="rgba(42,74,138,0.08)" loading={loading} />
          <KpiCard label="Past Due / At Risk" value={pastDueCnt} sub={pastDueCnt > 0 ? "action required" : "all clear"} Icon={AlertTriangle} color={pastDueCnt > 0 ? "#D4A017" : "#4A8A4A"} bg={pastDueCnt > 0 ? "rgba(212,160,23,0.08)" : "rgba(74,138,74,0.08)"} loading={loading} alert={pastDueCnt > 0} />
        </div>

        {/* Past-due alert */}
        {!loading && pastDueClinics.length > 0 && (
          <div className="rounded-2xl p-4 flex items-start gap-4"
            style={{ background: "rgba(212,160,23,0.06)", border: "1px solid rgba(212,160,23,0.3)" }}>
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
                    <button onClick={() => updateStatus(c.id, "active")}
                      className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: "rgba(74,138,74,0.15)", color: "#2A5A2A", border: "1px solid rgba(74,138,74,0.3)" }}>
                      Reactivate
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Subscription Plans — CRUD ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-base font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
                Subscription Plans
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Add, edit or remove plans. Changes apply immediately to clinic plan selectors.
              </p>
            </div>
            <button
              onClick={() => { setEditingPlan(null); setDrawerOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "linear-gradient(135deg, #C5A059, #A8853A)", color: "white", border: "none" }}
            >
              <Plus size={14} /> New Plan
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ background: "var(--border)" }} />)}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {plans.map(p => {
                const inUse    = clinics.filter(c => c.subscription_plan === p.key).length;
                const mrrContr = clinics.filter(c => c.subscription_plan === p.key && c.subscription_status === "active").length * p.price;
                const isDeleting = deletingId === p.id;
                return (
                  <div key={p.id} className="rounded-2xl p-5 relative group"
                    style={{ background: "var(--surface)", border: `1px solid ${planBorder(p.color)}`, opacity: p.is_active ? 1 : 0.55 }}>

                    {/* Header row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ background: planBg(p.color) }}>
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: p.color, display: "block" }} />
                        </div>
                        <div>
                          <p className="font-semibold text-sm" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
                            {p.label}
                          </p>
                          <p className="text-xs" style={{ color: p.color }}>
                            {p.price === 0 ? "Free forever" : `${fmt(p.price)}/mo`}
                          </p>
                        </div>
                      </div>
                      {/* Action buttons — visible on hover */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          title="Edit plan"
                          onClick={() => { setEditingPlan(p); setDrawerOpen(true); }}
                          style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.06)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#C5A059" }}>
                          <Pencil size={12} />
                        </button>
                        <button
                          title={inUse > 0 ? `${inUse} clinics using this plan` : "Delete plan"}
                          disabled={isDeleting}
                          onClick={() => handleDeletePlan(p)}
                          style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${inUse > 0 ? "rgba(138,128,120,0.2)" : "rgba(239,68,68,0.25)"}`, background: inUse > 0 ? "rgba(138,128,120,0.04)" : "rgba(239,68,68,0.05)", cursor: inUse > 0 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: inUse > 0 ? "#8A8078" : "#EF4444", opacity: isDeleting ? 0.5 : 1 }}>
                          {isDeleting ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={12} />}
                        </button>
                      </div>
                    </div>

                    {/* Inactive badge */}
                    {!p.is_active && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold mb-2 inline-block"
                        style={{ background: "rgba(138,128,120,0.1)", color: "#8A8078" }}>Inactive</span>
                    )}

                    {/* Features */}
                    <ul className="space-y-1 mb-4">
                      {p.features.map((f, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                          <CheckCircle2 size={10} style={{ color: p.color, flexShrink: 0 }} /> {f}
                        </li>
                      ))}
                    </ul>

                    {/* Stats */}
                    <div className="flex items-center justify-between pt-3"
                      style={{ borderTop: `1px solid ${planBorder(p.color)}` }}>
                      <span className="text-xs font-semibold" style={{ color: p.color }}>
                        {inUse} clinic{inUse !== 1 ? "s" : ""}
                      </span>
                      {mrrContr > 0 && (
                        <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                          {fmt(mrrContr)} MRR
                        </span>
                      )}
                    </div>

                    {/* Plan key badge */}
                    <span className="absolute bottom-3 right-4 text-xs font-mono opacity-30" style={{ color: p.color }}>
                      {p.key}
                    </span>
                  </div>
                );
              })}

              {/* Add plan shortcut */}
              <button
                onClick={() => { setEditingPlan(null); setDrawerOpen(true); }}
                className="rounded-2xl p-5 flex flex-col items-center justify-center gap-3 transition-all duration-200 group"
                style={{ background: "transparent", border: "2px dashed rgba(197,160,89,0.3)", cursor: "pointer", minHeight: 160 }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(197,160,89,0.04)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(197,160,89,0.1)" }}>
                  <Plus size={18} style={{ color: "var(--gold)" }} />
                </div>
                <p className="text-sm font-semibold" style={{ color: "var(--gold)", fontFamily: "Georgia, serif" }}>
                  Add New Plan
                </p>
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div>
          <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {([
              { key: "clinics",  label: "Clinics",          count: clinics.length  },
              { key: "chains",   label: "Chains & Billing",  count: chains.length   },
              { key: "payments", label: "Payment Log",       count: payments.length },
            ] as { key: TabKey; label: string; count: number }[]).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
                style={tab === t.key
                  ? { background: "linear-gradient(135deg, #C5A059, #A8853A)", color: "white" }
                  : { background: "transparent", color: "var(--text-muted)" }}>
                {t.label}
                <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                  style={tab === t.key ? { background: "rgba(255,255,255,0.2)", color: "white" } : { background: "var(--border)", color: "var(--text-muted)" }}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* ── CLINICS TAB ── */}
          {tab === "clinics" && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="px-5 py-4 flex items-center justify-between gap-4"
                style={{ borderBottom: "1px solid var(--border)" }}>
                <p className="font-semibold text-sm" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>All Clinics</p>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input type="text" placeholder="Search clinics…" value={search} onChange={e => setSearch(e.target.value)}
                      className="text-sm rounded-xl pl-3 pr-9 py-2 outline-none"
                      style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)", width: 220 }} />
                    {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--text-muted)" }}>✕</button>}
                  </div>
                  <p className="text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{filteredClinics.length} of {clinics.length}</p>
                </div>
              </div>

              {loading ? <LoadingTable /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        {["Clinic", "Plan", "Status", "Grace Period", "Patients", "MTD Revenue", "Actions"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                            style={{ color: "var(--text-muted)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClinics.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>No clinics found.</td></tr>
                      ) : filteredClinics.map(c => {
                        const statusCfg = STATUS_CFG[c.subscription_status] ?? STATUS_CFG.active;
                        const planDb    = plans.find(p => p.key === c.subscription_plan);
                        const planColor = planDb?.color ?? "#C5A059";
                        const isBusy   = updatingId === c.id;

                        return (
                          <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(197,160,89,0.02)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "")}>

                            {/* Clinic info */}
                            <td className="px-4 py-3.5" style={{ minWidth: 220 }}>
                              <p className="font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>{c.name}</p>
                              <div className="flex flex-col gap-0.5 mt-0.5">
                                {c.location    && <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}><MapPin size={9} /> {c.location}</span>}
                                {c.admin_email && <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}><Mail size={9} /> {c.admin_email}</span>}
                                {c.chain_name  && <span className="flex items-center gap-1 text-xs" style={{ color: "var(--gold)" }}><Network size={9} /> {c.chain_name}</span>}
                                {c.gst_number  && <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)", fontFamily: "monospace" }}><Hash size={9} /> {c.gst_number}</span>}
                              </div>
                            </td>

                            {/* Plan */}
                            <td className="px-4 py-3.5" style={{ minWidth: 160 }}>
                              <div className="flex items-center gap-2">
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: planColor, flexShrink: 0 }} />
                                <div className="relative">
                                  <select
                                    value={c.subscription_plan}
                                    disabled={isBusy}
                                    onChange={e => updatePlan(c.id, e.target.value)}
                                    className="text-xs font-semibold rounded-lg pl-2 pr-6 py-1.5 outline-none appearance-none cursor-pointer"
                                    style={{ background: planBg(planColor), color: planColor, border: `1px solid ${planBorder(planColor)}`, opacity: isBusy ? 0.5 : 1 }}>
                                    {plans.filter(p => p.is_active || p.key === c.subscription_plan).map(p => (
                                      <option key={p.key} value={p.key}>{p.label}</option>
                                    ))}
                                  </select>
                                  <ChevronDown size={10} style={{ color: planColor, position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                                </div>
                                {isBusy && <Loader2 size={12} style={{ color: "var(--gold)" }} className="animate-spin" />}
                              </div>
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3.5" style={{ minWidth: 140 }}>
                              <div className="flex flex-col gap-1.5">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold w-fit"
                                  style={{ background: statusCfg.bg, color: statusCfg.text }}>
                                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: statusCfg.dot }} />
                                  {statusCfg.label}
                                </span>
                                {c.subscription_status !== "active" && (
                                  <button disabled={isBusy} onClick={() => updateStatus(c.id, "active")}
                                    className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full w-fit"
                                    style={{ background: "rgba(74,138,74,0.1)", color: "#2A5A2A", border: "1px solid rgba(74,138,74,0.2)" }}>
                                    <RotateCcw size={9} /> Activate
                                  </button>
                                )}
                                {c.subscription_status === "active" && (
                                  <button disabled={isBusy} onClick={() => updateStatus(c.id, "canceled")}
                                    className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full w-fit"
                                    style={{ background: "rgba(239,68,68,0.08)", color: "#8A1A1A", border: "1px solid rgba(239,68,68,0.2)" }}>
                                    <Ban size={9} /> Suspend
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* Grace Period */}
                            <td className="px-4 py-3.5" style={{ minWidth: 180 }}>
                              {editGrace[c.id] ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <label style={{ fontSize: 9, color: "var(--text-muted)", width: 30 }}>Grace</label>
                                    <input type="number" min={0} max={90}
                                      value={editGrace[c.id].days}
                                      onChange={e => setEditGrace(prev => ({ ...prev, [c.id]: { ...prev[c.id], days: Number(e.target.value) } }))}
                                      style={{ width: 48, padding: "2px 6px", borderRadius: 5, border: "1px solid rgba(197,160,89,0.4)", fontSize: 11, textAlign: "center" }} />
                                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>days</span>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <label style={{ fontSize: 9, color: "var(--text-muted)", width: 30 }}>Warn</label>
                                    <input type="number" min={0} max={30}
                                      value={editGrace[c.id].warn}
                                      onChange={e => setEditGrace(prev => ({ ...prev, [c.id]: { ...prev[c.id], warn: Number(e.target.value) } }))}
                                      style={{ width: 48, padding: "2px 6px", borderRadius: 5, border: "1px solid rgba(212,160,23,0.4)", fontSize: 11, textAlign: "center" }} />
                                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>days before</span>
                                  </div>
                                  <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                                    <button onClick={() => saveGracePeriod(c.id)} disabled={savingGrace === c.id}
                                      style={{ fontSize: 10, padding: "2px 8px", borderRadius: 5, border: "none", background: "var(--gold)", color: "white", cursor: "pointer", fontWeight: 600 }}>
                                      Save
                                    </button>
                                    <button onClick={() => setEditGrace(prev => { const n = { ...prev }; delete n[c.id]; return n; })}
                                      style={{ fontSize: 10, padding: "2px 8px", borderRadius: 5, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button onClick={() => setEditGrace(prev => ({ ...prev, [c.id]: { days: c.grace_period_days, warn: c.warning_days_before } }))}
                                  style={{ display: "flex", flexDirection: "column", gap: 3, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <Clock size={10} style={{ color: "var(--text-muted)" }} />
                                    <span style={{ fontSize: 11, color: "var(--foreground)" }}>{c.grace_period_days}d grace</span>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <Bell size={10} style={{ color: "#D4A017" }} />
                                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>warn {c.warning_days_before}d before</span>
                                  </div>
                                </button>
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

                            {/* Revenue */}
                            <td className="px-4 py-3.5">
                              <p className="font-bold" style={{ color: "var(--gold)", fontFamily: "Georgia, serif" }}>{fmtFull(c.revenue_mtd)}</p>
                              <p className="text-xs" style={{ color: "var(--text-muted)" }}>this month</p>
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3.5">
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                {c.subscription_status === "active" && (
                                  <button disabled={isBusy} onClick={() => updateStatus(c.id, "past_due")}
                                    className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg whitespace-nowrap"
                                    style={{ background: "rgba(212,160,23,0.1)", color: "#92600A", border: "1px solid rgba(212,160,23,0.25)" }}>
                                    <AlertTriangle size={10} /> Mark Due
                                  </button>
                                )}
                                <button onClick={() => startImpersonation(c.id, c.name)}
                                  style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "4px 8px", borderRadius: 6,
                                    border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.06)",
                                    cursor: "pointer", color: "#6366F1", fontWeight: 600, whiteSpace: "nowrap" }}>
                                  <Eye size={10} /> View As
                                </button>
                                <button onClick={() => handleLoginAs(c.id, c.name)}
                                  style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "4px 8px", borderRadius: 6,
                                    border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.06)",
                                    cursor: "pointer", color: "#8A6B20", fontWeight: 600, whiteSpace: "nowrap" }}>
                                  <ExternalLink size={10} /> Login As
                                </button>
                              </div>
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

          {/* ── CHAINS TAB ── */}
          {tab === "chains" && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                <p className="font-semibold text-sm" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>Chain Billing Methods</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Auto-pay configuration per clinic chain</p>
              </div>
              {loading ? <LoadingTable /> : chains.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-3">
                  <Network size={32} style={{ color: "var(--gold)", opacity: 0.4 }} />
                  <p className="text-sm font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>No chains yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        {["Chain", "Clinics", "Billing Method", "Grace Period", "Warn Before"].map(h => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {chains.map(ch => {
                        const MethodIcon = ch.billing_method ? METHOD_ICON[ch.billing_method] : null;
                        return (
                          <tr key={ch.id} style={{ borderBottom: "1px solid var(--border)" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(197,160,89,0.02)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "")}>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                  style={{ background: "rgba(197,160,89,0.1)", border: "1px solid rgba(197,160,89,0.2)" }}>
                                  <Network size={14} style={{ color: "var(--gold)" }} />
                                </div>
                                <p className="font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>{ch.name}</p>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-1.5">
                                <Building2 size={13} style={{ color: "var(--text-muted)" }} />
                                <span className="font-medium" style={{ color: "var(--foreground)" }}>{ch.clinic_count} clinic{ch.clinic_count !== 1 ? "s" : ""}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              {MethodIcon && ch.billing_method ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                    style={{ background: "rgba(197,160,89,0.1)", border: "1px solid rgba(197,160,89,0.2)" }}>
                                    <MethodIcon size={13} style={{ color: "var(--gold)" }} />
                                  </div>
                                  <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{METHOD_LABEL[ch.billing_method]}</span>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                                  style={{ background: "rgba(138,128,120,0.1)", color: "var(--text-muted)" }}>Not configured</span>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              {ch.grace_period_days != null ? (
                                <div className="flex items-center gap-1.5">
                                  <Calendar size={12} style={{ color: "var(--text-muted)" }} />
                                  <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{ch.grace_period_days} days</span>
                                </div>
                              ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                            </td>
                            <td className="px-5 py-4">
                              {ch.warning_days_before != null ? (
                                <div className="flex items-center gap-1.5">
                                  <Bell size={12} style={{ color: "#D4A017" }} />
                                  <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{ch.warning_days_before} days prior</span>
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
                <p className="font-semibold text-sm" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>Payment Log</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Recent subscription payment events</p>
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
                          <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map(p => {
                        const statusCfg  = STATUS_CFG[p.status] ?? STATUS_CFG.active;
                        const MethodIcon = p.method ? METHOD_ICON[p.method] : null;
                        const dateStr    = new Date(p.paid_at ?? p.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                        return (
                          <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(197,160,89,0.02)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "")}>
                            <td className="px-5 py-3.5 text-xs" style={{ color: "var(--text-muted)" }}>{dateStr}</td>
                            <td className="px-5 py-3.5">
                              <p className="font-semibold text-sm" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
                                {p.clinic_name ?? p.chain_name ?? "—"}
                              </p>
                            </td>
                            <td className="px-5 py-3.5 font-bold" style={{ color: "var(--gold)", fontFamily: "Georgia, serif" }}>{fmtFull(p.amount)}</td>
                            <td className="px-5 py-3.5">
                              {MethodIcon && p.method ? (
                                <div className="flex items-center gap-1.5">
                                  <MethodIcon size={13} style={{ color: "var(--text-muted)" }} />
                                  <span className="text-xs" style={{ color: "var(--foreground)" }}>{METHOD_LABEL[p.method]}</span>
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

      {/* Plan drawer */}
      <PlanDrawer
        open={drawerOpen}
        plan={editingPlan}
        modules={modules}
        onClose={() => { setDrawerOpen(false); setEditingPlan(null); }}
        onSave={handlePlanSaved}
      />

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, Icon, color, bg, loading, alert = false }: {
  label: string; value: string | number; sub: string;
  Icon: React.ElementType; color: string; bg: string;
  loading: boolean; alert?: boolean;
}) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: alert ? "1px solid rgba(212,160,23,0.4)" : "1px solid var(--border)", boxShadow: alert ? "0 0 0 3px rgba(212,160,23,0.08)" : "none" }}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-widest leading-tight" style={{ color: "var(--text-muted)" }}>{label}</p>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      {loading ? (
        <div className="h-8 w-24 rounded-lg animate-pulse" style={{ background: "var(--border)" }} />
      ) : (
        <p className="text-2xl font-bold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>{value}</p>
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

function TrendingUp(props: React.SVGProps<SVGSVGElement> & { size?: number }) {
  const { size = 16, ...rest } = props;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}
