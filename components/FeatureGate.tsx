"use client";

/**
 * FeatureGate — thin wrapper over ModuleGate with plan-aware locked state.
 *
 * Usage:
 *   <FeatureGate name="scheduler">
 *     <SchedulerPage />
 *   </FeatureGate>
 *
 * When locked, shows: "Available on Growth plan — upgrade to unlock."
 */

import React from "react";
import { ModuleGate } from "@/src/lib/feature-flags/gate";
import type { ModuleKey } from "@/src/lib/config/environment";
import { Lock } from "lucide-react";

/** Maps module slug → minimum plan that unlocks it */
const FEATURE_PLAN: Record<string, "free" | "growth" | "enterprise"> = {
  core:                "free",
  patients:            "free",
  services:            "free",
  billing:             "free",
  intake:              "free",
  scheduler:           "growth",
  photos:              "growth",
  inventory:           "growth",
  advanced_analytics:  "enterprise",
  multi_chain:         "enterprise",
  sms_reminders:       "growth",
  whatsapp_booking:    "growth",
  leads:               "growth",
};

const PLAN_LABELS: Record<string, string> = {
  free:       "Free",
  growth:     "Growth",
  enterprise: "Enterprise",
};

function LockedFeature({ name }: { name: string }) {
  const plan = FEATURE_PLAN[name] ?? "growth";
  const planLabel = PLAN_LABELS[plan] ?? "Growth";

  return (
    <div
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "64px 32px", textAlign: "center", gap: 16,
      }}
    >
      <div
        style={{
          width: 60, height: 60, borderRadius: 18,
          background: "rgba(197,160,89,0.1)",
          border: "1px solid rgba(197,160,89,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <Lock size={24} style={{ color: "var(--gold)" }} />
      </div>
      <div>
        <p
          style={{
            fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 600,
            color: "var(--foreground)", margin: "0 0 8px",
          }}
        >
          Feature Locked
        </p>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 16px", maxWidth: 320 }}>
          Available on the{" "}
          <strong style={{ color: "var(--gold)" }}>{planLabel} plan</strong>
          {" "}— upgrade to unlock this feature for your clinic.
        </p>
        <a
          href="/admin/billing"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "9px 20px", borderRadius: 10,
            background: "var(--gold)", color: "white",
            fontSize: 13, fontWeight: 600, fontFamily: "Georgia, serif",
            textDecoration: "none", transition: "opacity 0.15s",
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.opacity = "0.85")}
          onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.opacity = "1")}
        >
          View Plans
        </a>
      </div>
    </div>
  );
}

interface FeatureGateProps {
  name:     ModuleKey;
  children: React.ReactNode;
}

export default function FeatureGate({ name, children }: FeatureGateProps) {
  return (
    <ModuleGate module={name} fallback={<LockedFeature name={name} />}>
      {children}
    </ModuleGate>
  );
}
