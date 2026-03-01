"use client";

/**
 * FeatureGate
 * ──────────────────────────────────────────────────────────────────────────────
 * Wraps any UI block and shows a "Locked" upgrade prompt when the clinic hasn't
 * enabled the feature in God Mode. Admins can always see everything.
 *
 * Usage:
 *   <FeatureGate name="whatsapp_booking">
 *     <WhatsAppBookingPanel />
 *   </FeatureGate>
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from "react";
import { Lock, Crown, ChevronRight, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";

// ── Feature display metadata ──────────────────────────────────────────────────

const FEATURE_META: Record<string, { label: string; description: string; tier: string }> = {
  scheduler:           { label: "Smart Scheduler",      description: "Appointment booking and calendar management", tier: "Silver" },
  photos:              { label: "Before & After",        description: "Photo comparison and progress gallery",        tier: "Silver" },
  inventory:           { label: "Inventory",             description: "Stock tracking and supplier management",        tier: "Silver" },
  billing:             { label: "Billing",               description: "Invoicing, payments, and revenue tracking",     tier: "Silver" },
  services:            { label: "Services & Packages",   description: "Service catalog and package management",        tier: "Silver" },
  advanced_analytics:  { label: "Advanced Analytics",    description: "Revenue insights and performance dashboards",   tier: "Gold"   },
  whatsapp_booking:    { label: "WhatsApp Booking",       description: "Book appointments via WhatsApp",               tier: "Gold"   },
  sms_reminders:       { label: "SMS Reminders",          description: "Automated SMS reminders to patients",          tier: "Gold"   },
  multi_chain:         { label: "Multi-Chain",            description: "Manage multiple clinic chains and branches",    tier: "Platinum"},
  leads:               { label: "Lead Management",        description: "Track and convert clinic leads",                tier: "Gold"   },
  intake:              { label: "Digital Intake",         description: "Patient-facing digital intake forms",           tier: "Silver" },
};

const TIER_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  Silver:   { bg: "rgba(156,148,164,0.12)", color: "#6B6378", border: "rgba(156,148,164,0.3)" },
  Gold:     { bg: "rgba(197,160,89,0.12)",  color: "#8B6914", border: "rgba(197,160,89,0.4)"  },
  Platinum: { bg: "rgba(99,102,241,0.1)",   color: "#4338CA", border: "rgba(99,102,241,0.3)"  },
};

// ─────────────────────────────────────── Props ───────────────────────────────

interface FeatureGateProps {
  name: string;
  children: React.ReactNode;
  /** Optional override: always show children (for admin-only areas) */
  bypass?: boolean;
  /** Size of the lock overlay — "inline" keeps the card-in-place look */
  size?: "full" | "inline";
}

// ─────────────────────────────────────── Component ───────────────────────────

export default function FeatureGate({ name, children, bypass, size = "inline" }: FeatureGateProps) {
  const { profile, activeClinicId } = useClinic();
  const [enabled, setEnabled] = useState<boolean | null>(null); // null = loading

  const role    = profile?.role ?? null;
  const isAdmin = ["superadmin", "chain_admin", "clinic_admin"].includes(role ?? "");

  useEffect(() => {
    // Admins always see everything — skip the DB check entirely
    if (isAdmin || bypass) { setEnabled(true); return; }
    if (!activeClinicId)    { setEnabled(false); return; }

    supabase
      .from("clinic_features")
      .select("is_enabled, valid_until")
      .eq("clinic_id", activeClinicId)
      .eq("feature_slug", name)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { setEnabled(false); return; }
        const notExpired = !data.valid_until || new Date(data.valid_until) > new Date();
        setEnabled(data.is_enabled && notExpired);
      });
  }, [name, activeClinicId, isAdmin, bypass]);

  // Loading state — render nothing briefly to avoid flash
  if (enabled === null) return null;

  // Feature enabled — render children
  if (enabled) return <>{children}</>;

  // Feature locked — render upgrade prompt
  const meta  = FEATURE_META[name] ?? { label: name, description: "This feature requires an upgrade", tier: "Gold" };
  const tier  = TIER_STYLE[meta.tier] ?? TIER_STYLE.Gold;

  if (size === "full") {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "60px 24px", textAlign: "center",
        background: "linear-gradient(135deg, rgba(197,160,89,0.04), rgba(168,133,58,0.02))",
        border: "1px dashed rgba(197,160,89,0.3)", borderRadius: 20,
      }}>
        <LockedContent meta={meta} tier={tier} name={name} />
      </div>
    );
  }

  return (
    <div style={{
      position: "relative", borderRadius: 16,
      border: "1px solid rgba(197,160,89,0.2)",
      overflow: "hidden", background: "white",
    }}>
      {/* Blurred children */}
      <div style={{ filter: "blur(3px)", pointerEvents: "none", userSelect: "none", opacity: 0.35 }}>
        {children}
      </div>
      {/* Lock overlay */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: "rgba(249,247,242,0.9)", backdropFilter: "blur(4px)",
      }}>
        <LockedContent meta={meta} tier={tier} name={name} />
      </div>
    </div>
  );
}

function LockedContent({ meta, tier, name }: {
  meta: { label: string; description: string; tier: string };
  tier: { bg: string; color: string; border: string };
  name: string;
}) {
  return (
    <>
      <div style={{
        width: 52, height: 52, borderRadius: 16, marginBottom: 14,
        background: "linear-gradient(135deg, rgba(197,160,89,0.15), rgba(168,133,58,0.08))",
        border: "1px solid rgba(197,160,89,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Lock size={20} style={{ color: "#C5A059" }} />
      </div>

      <p style={{ fontSize: 15, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: "0 0 6px" }}>
        {meta.label}
      </p>
      <p style={{ fontSize: 12, color: "#9C9584", margin: "0 0 14px", maxWidth: 280 }}>
        {meta.description}
      </p>

      <span style={{
        fontSize: 10, fontWeight: 700, padding: "3px 12px", borderRadius: 20,
        background: tier.bg, color: tier.color, border: `1px solid ${tier.border}`,
        textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16,
        display: "flex", alignItems: "center", gap: 5,
      }}>
        <Crown size={10} /> {meta.tier} Feature
      </span>

      <button
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 20px", borderRadius: 10, border: "none", cursor: "pointer",
          background: "linear-gradient(135deg, #C5A059, #A8853A)",
          color: "white", fontSize: 13, fontWeight: 600, fontFamily: "Georgia, serif",
          boxShadow: "0 4px 16px rgba(197,160,89,0.35)",
        }}
        onClick={() => {
          // In production: open upgrade modal or contact admin
          window.location.href = "/admin/god-mode";
        }}
      >
        <Zap size={14} /> Upgrade to Unlock <ChevronRight size={14} />
      </button>
    </>
  );
}
