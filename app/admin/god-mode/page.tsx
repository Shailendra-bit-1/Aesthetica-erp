"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Crown, Search, Building2, ToggleLeft, ToggleRight, Loader2,
  Eye, Send, CheckCircle2, ChevronDown, ChevronUp, Network,
  Zap, Calendar, Camera, Package, Receipt, Scissors, Globe,
  Users, BarChart3, MessageSquare, Smartphone, RefreshCw,
  Shield, AlertCircle, X, Check, Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { logAction } from "@/lib/audit";
import { toast } from "sonner";
import TopBar from "@/components/TopBar";

// ─────────────────────────────────────── Constants ───────────────────────────

interface FeatureDef {
  slug:        string;
  label:       string;
  icon:        React.ElementType;
  color:       string;
  tier:        "silver" | "gold" | "platinum";
  description: string;
}

const ALL_FEATURES: FeatureDef[] = [
  { slug: "scheduler",          label: "Scheduler",          icon: Calendar,      color: "#0891B2", tier: "silver",   description: "Appointment booking & calendar" },
  { slug: "photos",             label: "Before & After",     icon: Camera,        color: "#C5A059", tier: "silver",   description: "Photo comparison gallery" },
  { slug: "inventory",          label: "Inventory",          icon: Package,       color: "#059669", tier: "silver",   description: "Stock & supplier management" },
  { slug: "billing",            label: "Billing",            icon: Receipt,       color: "#DC2626", tier: "silver",   description: "Invoicing & revenue tracking" },
  { slug: "services",           label: "Services",           icon: Scissors,      color: "#7C3AED", tier: "silver",   description: "Service catalog & packages" },
  { slug: "patients",           label: "Patients",           icon: Users,         color: "#6366F1", tier: "silver",   description: "Patient records & EMR" },
  { slug: "intake",             label: "Digital Intake",     icon: Globe,         color: "#0D9488", tier: "silver",   description: "Patient-facing intake forms" },
  { slug: "advanced_analytics", label: "Analytics",          icon: BarChart3,     color: "#EA580C", tier: "gold",     description: "Advanced reports & analytics" },
  { slug: "whatsapp_booking",   label: "WhatsApp Booking",   icon: MessageSquare, color: "#25D366", tier: "gold",     description: "Book via WhatsApp Business" },
  { slug: "sms_reminders",      label: "SMS Reminders",      icon: Smartphone,    color: "#0891B2", tier: "gold",     description: "Automated SMS reminders" },
  { slug: "leads",              label: "Lead Management",    icon: Zap,           color: "#F59E0B", tier: "gold",     description: "Track & convert clinic leads" },
  { slug: "multi_chain",        label: "Multi-Chain",        icon: Network,       color: "#9333EA", tier: "platinum", description: "Multi-branch chain management" },
];

const TIER_COLORS = {
  silver:   { bg: "rgba(156,148,164,0.12)", color: "#6B6378", border: "rgba(156,148,164,0.3)" },
  gold:     { bg: "rgba(197,160,89,0.12)",  color: "#8B6914", border: "rgba(197,160,89,0.4)"  },
  platinum: { bg: "rgba(99,102,241,0.1)",   color: "#4338CA", border: "rgba(99,102,241,0.3)"  },
};

const PLATINUM_CONFIG: Record<string, boolean> = Object.fromEntries(ALL_FEATURES.map(f => [f.slug, true]));
const GOLD_CONFIG:     Record<string, boolean> = Object.fromEntries(ALL_FEATURES.map(f => [f.slug, f.tier !== "platinum"]));
const SILVER_CONFIG:   Record<string, boolean> = Object.fromEntries(ALL_FEATURES.map(f => [f.slug, f.tier === "silver"]));

// ─────────────────────────────────────── Types ───────────────────────────────

interface ClinicRow {
  id: string; name: string; chain_id: string | null;
  subscription_status: string; location: string | null;
  chain_name: string | null;
}

type FeatureMap = Record<string, boolean>; // slug → enabled

// ─────────────────────────────────────── Main Page ───────────────────────────

export default function GodModePage() {
  const { profile }                           = useClinic();
  const { startImpersonation, impersonating } = useImpersonation();

  const [clinics,     setClinics]     = useState<ClinicRow[]>([]);
  const [featureMap,  setFeatureMap]  = useState<Record<string, FeatureMap>>({}); // clinicId → FeatureMap
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [expanded,    setExpanded]    = useState<string | null>(null);
  const [saving,      setSaving]      = useState<string | null>(null); // clinicId_slug
  const [pushing,     setPushing]     = useState(false);
  const [pushTarget,  setPushTarget]  = useState<"platinum" | "gold" | "silver" | null>(null);

  // ── Load clinics + features ──────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [clinicsRes, featuresRes] = await Promise.all([
      supabase.from("clinics")
        .select("id, name, chain_id, subscription_status, location, chains(name)")
        .order("name"),
      supabase.from("clinic_features")
        .select("clinic_id, feature_slug, is_enabled, valid_until"),
    ]);

    const rawClinics = (clinicsRes.data ?? []) as unknown as (Omit<ClinicRow, "chain_name"> & { chains: { name: string } | null })[];
    setClinics(rawClinics.map(c => ({ ...c, chain_name: c.chains?.name ?? null })));

    // Build featureMap: { clinicId: { slug: bool } }
    const fMap: Record<string, FeatureMap> = {};
    (featuresRes.data ?? []).forEach((row: { clinic_id: string; feature_slug: string; is_enabled: boolean; valid_until: string | null }) => {
      fMap[row.clinic_id] ??= {};
      const notExpired = !row.valid_until || new Date(row.valid_until) > new Date();
      fMap[row.clinic_id][row.feature_slug] = row.is_enabled && notExpired;
    });
    setFeatureMap(fMap);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Derived state (must be hooks, must stay before any early return) ─────────
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
    Object.values(featureMap).forEach(fm => Object.values(fm).forEach(v => v && count++));
    return count;
  }, [featureMap]);

  // ── Access guard (after all hooks) ──────────────────────────────────────────
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

  // ── Toggle a single feature for a clinic ────────────────────────────────────
  async function toggleFeature(clinicId: string, slug: string, currentValue: boolean) {
    const newValue = !currentValue;
    const key = `${clinicId}_${slug}`;
    setSaving(key);

    const { error } = await supabase
      .from("clinic_features")
      .upsert({ clinic_id: clinicId, feature_slug: slug, is_enabled: newValue, plan_tier: "gold", enabled_by: profile?.id ?? null },
               { onConflict: "clinic_id,feature_slug" });

    setSaving(null);
    if (error) { toast.error(`Failed to toggle ${slug}`); return; }

    setFeatureMap(prev => ({
      ...prev,
      [clinicId]: { ...prev[clinicId], [slug]: newValue },
    }));

    const clinic = clinics.find(c => c.id === clinicId);
    logAction({
      action:     newValue ? "god_mode_enable_feature" : "god_mode_disable_feature",
      targetId:   clinicId,
      targetName: clinic?.name ?? clinicId,
      metadata:   { feature_slug: slug, enabled: newValue },
    });

    toast.success(`${newValue ? "Enabled" : "Disabled"} ${slug} for ${clinic?.name ?? "clinic"}`);
  }

  // ── Push plan config to a clinic ────────────────────────────────────────────
  async function pushPlanToClinic(clinicId: string, config: Record<string, boolean>, tier: string) {
    const rows = Object.entries(config).map(([slug, enabled]) => ({
      clinic_id: clinicId, feature_slug: slug, is_enabled: enabled,
      plan_tier: tier, enabled_by: profile?.id ?? null,
    }));

    const { error } = await supabase
      .from("clinic_features")
      .upsert(rows, { onConflict: "clinic_id,feature_slug" });

    if (error) throw error;
    setFeatureMap(prev => ({ ...prev, [clinicId]: config }));
  }

  // ── Batch-push to all clinics ────────────────────────────────────────────────
  async function handleBatchPush(tier: "platinum" | "gold" | "silver") {
    const config = tier === "platinum" ? PLATINUM_CONFIG : tier === "gold" ? GOLD_CONFIG : SILVER_CONFIG;
    setPushing(true);
    setPushTarget(tier);
    let success = 0, failed = 0;

    for (const clinic of filteredClinics) {
      try {
        await pushPlanToClinic(clinic.id, config, tier);
        success++;
      } catch { failed++; }
    }

    logAction({
      action:     `god_mode_batch_push_${tier}`,
      targetId:   "platform",
      targetName: "All Clinics",
      metadata:   { tier, clinics_updated: success, clinics_failed: failed },
    });

    setPushing(false);
    setPushTarget(null);
    toast.success(`Pushed ${tier} config to ${success} clinics${failed > 0 ? ` (${failed} failed)` : ""}`);
  }

  // ── Impersonation ────────────────────────────────────────────────────────────
  function handleImpersonate(clinic: ClinicRow) {
    startImpersonation({ clinicId: clinic.id, clinicName: clinic.name });
    toast.success(`Now viewing as ${clinic.name}`);
    window.location.href = "/";
  }

  return (
    <div style={{ background: "#F9F7F2", minHeight: "100vh" }}>
      <TopBar />

      {/* Impersonation active banner */}
      {impersonating && (
        <div style={{ background: "linear-gradient(90deg, #1C0A00, #2E1000)", borderBottom: "2px solid #C5A059", padding: "8px 40px", display: "flex", alignItems: "center", gap: 10 }}>
          <Eye size={14} style={{ color: "#C5A059" }} />
          <span style={{ fontSize: 12, color: "#C5A059", fontWeight: 600, fontFamily: "Georgia, serif" }}>
            Currently viewing as: {impersonating.clinicName}
          </span>
          <button onClick={() => { window.location.href = "/admin/god-mode"; }} style={{ marginLeft: "auto", fontSize: 11, color: "#C5A059", background: "none", border: "1px solid rgba(197,160,89,0.3)", padding: "3px 10px", borderRadius: 6, cursor: "pointer" }}>
            Back to God Mode
          </button>
        </div>
      )}

      <div style={{ padding: "28px 40px 60px", maxWidth: 1400, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, rgba(197,160,89,0.2), rgba(168,133,58,0.1))", border: "1px solid rgba(197,160,89,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Crown size={16} style={{ color: "#C5A059" }} />
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: 0 }}>God Mode</h1>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 6, background: "rgba(197,160,89,0.12)", color: "#8B6914", letterSpacing: "0.08em", textTransform: "uppercase" }}>Superadmin Only</span>
            </div>
            <p style={{ fontSize: 12, color: "#9C9584", margin: 0 }}>
              Centralized feature flag control — {clinics.length} clinics · {totalEnabled} features enabled
            </p>
          </div>

          {/* Batch push buttons */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => { fetchAll(); }} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(197,160,89,0.2)", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <RefreshCw size={14} style={{ color: "#9C9584" }} />
            </button>
            {(["silver", "gold", "platinum"] as const).map(tier => {
              const isPushing = pushing && pushTarget === tier;
              const T = TIER_COLORS[tier];
              return (
                <button
                  key={tier}
                  onClick={() => handleBatchPush(tier)}
                  disabled={pushing}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "8px 14px", borderRadius: 10, border: `1px solid ${T.border}`,
                    background: T.bg, cursor: pushing ? "not-allowed" : "pointer",
                    fontSize: 11, fontWeight: 700, color: T.color,
                    textTransform: "capitalize", letterSpacing: "0.04em",
                  }}
                >
                  {isPushing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  Push {tier.charAt(0).toUpperCase() + tier.slice(1)}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Feature legend ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {ALL_FEATURES.map(f => {
            const T = TIER_COLORS[f.tier];
            const Icon = f.icon;
            return (
              <div key={f.slug} style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: T.bg, border: `1px solid ${T.border}` }}>
                <Icon size={11} style={{ color: f.color }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: T.color }}>{f.label}</span>
              </div>
            );
          })}
        </div>

        {/* ── Search bar ── */}
        <div style={{ position: "relative", marginBottom: 16 }}>
          <Search size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#B8AE9C", pointerEvents: "none" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clinics by name, location, or chain…"
            style={{ width: "100%", padding: "10px 14px 10px 38px", borderRadius: 12, border: "1px solid rgba(197,160,89,0.2)", background: "white", fontSize: 13, color: "#1C1917", fontFamily: "Georgia, serif", outline: "none", boxSizing: "border-box" }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer" }}>
              <X size={14} style={{ color: "#9C9584" }} />
            </button>
          )}
        </div>

        {/* ── Clinic list ── */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1, 2, 3, 4, 5].map(i => <div key={i} style={{ height: 64, borderRadius: 14, background: "rgba(197,160,89,0.06)", animation: "pulse 1.4s infinite" }} />)}
          </div>
        ) : filteredClinics.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <Building2 size={36} style={{ color: "rgba(197,160,89,0.3)", margin: "0 auto 12px" }} />
            <p style={{ fontSize: 14, color: "#9C9584", fontFamily: "Georgia, serif" }}>No clinics found</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredClinics.map(clinic => {
              const fm        = featureMap[clinic.id] ?? {};
              const isOpen    = expanded === clinic.id;
              const enabledCt = ALL_FEATURES.filter(f => fm[f.slug]).length;
              const subBadge  = clinic.subscription_status === "active"
                ? { bg: "rgba(5,150,105,0.1)",    color: "#059669" }
                : { bg: "rgba(107,114,128,0.1)",   color: "#6B7280" };

              return (
                <div key={clinic.id} style={{ background: "white", borderRadius: 14, border: `1px solid ${isOpen ? "rgba(197,160,89,0.4)" : "rgba(197,160,89,0.15)"}`, overflow: "hidden", boxShadow: isOpen ? "0 4px 20px rgba(197,160,89,0.1)" : "0 1px 4px rgba(28,25,23,0.04)", transition: "all 0.2s" }}>

                  {/* ── Clinic header row ── */}
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", cursor: "pointer" }}
                    onClick={() => setExpanded(isOpen ? null : clinic.id)}
                  >
                    {/* Avatar */}
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, rgba(197,160,89,0.15), rgba(168,133,58,0.08))", border: "1px solid rgba(197,160,89,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Sparkles size={14} style={{ color: "#C5A059" }} />
                    </div>

                    {/* Name + meta */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{clinic.name}</p>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: subBadge.bg, color: subBadge.color, textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
                          {clinic.subscription_status}
                        </span>
                        {clinic.chain_name && (
                          <span style={{ fontSize: 10, color: "#9333EA", background: "rgba(147,51,234,0.08)", padding: "1px 7px", borderRadius: 5, flexShrink: 0 }}>
                            <Network size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 2 }} />
                            {clinic.chain_name}
                          </span>
                        )}
                      </div>
                      {clinic.location && <p style={{ fontSize: 11, color: "#9C9584", margin: "2px 0 0" }}>{clinic.location}</p>}
                    </div>

                    {/* Feature count */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                      {/* Mini feature pills */}
                      <div style={{ display: "flex", gap: 3 }}>
                        {ALL_FEATURES.slice(0, 7).map(f => (
                          <div key={f.slug} title={f.label} style={{ width: 8, height: 8, borderRadius: 2, background: fm[f.slug] ? f.color : "rgba(197,160,89,0.12)" }} />
                        ))}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#9C9584" }}>{enabledCt}/{ALL_FEATURES.length}</span>

                      {/* View as clinic */}
                      <button
                        onClick={e => { e.stopPropagation(); handleImpersonate(clinic); }}
                        title={`View as ${clinic.name}`}
                        style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(197,160,89,0.25)", background: "rgba(197,160,89,0.06)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <Eye size={13} style={{ color: "#C5A059" }} />
                      </button>

                      {isOpen ? <ChevronUp size={15} style={{ color: "#9C9584" }} /> : <ChevronDown size={15} style={{ color: "#9C9584" }} />}
                    </div>
                  </div>

                  {/* ── Expanded: feature grid ── */}
                  {isOpen && (
                    <div style={{ borderTop: "1px solid rgba(197,160,89,0.1)", padding: "16px 18px 18px" }}>
                      {/* Per-clinic plan push */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                        <span style={{ fontSize: 11, color: "#9C9584", marginRight: 4 }}>Quick set:</span>
                        {(["silver", "gold", "platinum"] as const).map(tier => {
                          const T = TIER_COLORS[tier];
                          const config = tier === "platinum" ? PLATINUM_CONFIG : tier === "gold" ? GOLD_CONFIG : SILVER_CONFIG;
                          return (
                            <button
                              key={tier}
                              onClick={async () => {
                                setSaving(`${clinic.id}_batch`);
                                try { await pushPlanToClinic(clinic.id, config, tier); toast.success(`Applied ${tier} to ${clinic.name}`); }
                                catch { toast.error("Failed"); }
                                setSaving(null);
                              }}
                              style={{ padding: "4px 12px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.bg, cursor: "pointer", fontSize: 10, fontWeight: 700, color: T.color, letterSpacing: "0.06em", textTransform: "capitalize" }}
                            >
                              {saving === `${clinic.id}_batch` ? <Loader2 size={10} style={{ display: "inline" }} /> : tier}
                            </button>
                          );
                        })}
                        <div style={{ flex: 1 }} />
                        <button
                          onClick={e => { e.stopPropagation(); handleImpersonate(clinic); }}
                          style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.06)", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#C5A059" }}
                        >
                          <Eye size={12} /> View as this clinic
                        </button>
                      </div>

                      {/* Feature toggles grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                        {ALL_FEATURES.map(feat => {
                          const enabled  = fm[feat.slug] ?? false;
                          const savingKey = `${clinic.id}_${feat.slug}`;
                          const isSaving  = saving === savingKey;
                          const T = TIER_COLORS[feat.tier];
                          const Icon = feat.icon;
                          return (
                            <div
                              key={feat.slug}
                              style={{
                                display: "flex", alignItems: "center", gap: 10,
                                padding: "10px 12px", borderRadius: 10,
                                background: enabled ? `${feat.color}08` : "rgba(249,247,242,0.7)",
                                border: `1px solid ${enabled ? feat.color + "25" : "rgba(197,160,89,0.12)"}`,
                                transition: "all 0.15s",
                              }}
                            >
                              <div style={{ width: 30, height: 30, borderRadius: 8, background: enabled ? `${feat.color}18` : "rgba(107,114,128,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <Icon size={13} style={{ color: enabled ? feat.color : "#9C9584" }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 11, fontWeight: 600, color: enabled ? "#1C1917" : "#9C9584", margin: "0 0 1px", fontFamily: "Georgia, serif" }}>{feat.label}</p>
                                <span style={{ fontSize: 9, fontWeight: 700, color: T.color, background: T.bg, padding: "1px 5px", borderRadius: 4, letterSpacing: "0.06em" }}>
                                  {feat.tier.toUpperCase()}
                                </span>
                              </div>
                              {isSaving ? (
                                <Loader2 size={16} className="animate-spin" style={{ color: "#C5A059", flexShrink: 0 }} />
                              ) : (
                                <button
                                  onClick={() => toggleFeature(clinic.id, feat.slug, enabled)}
                                  style={{
                                    width: 40, height: 22, borderRadius: 11, border: "none",
                                    cursor: "pointer", transition: "background 0.2s", flexShrink: 0, position: "relative",
                                    background: enabled ? feat.color : "rgba(107,114,128,0.2)",
                                  }}
                                >
                                  <span style={{ position: "absolute", top: 2, left: enabled ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s" }} />
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
    </div>
  );
}
