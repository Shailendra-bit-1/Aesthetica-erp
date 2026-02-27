"use client";

/**
 * ModuleGate  &  withModule
 * ──────────────────────────────────────────────────────────────────────────────
 * Two patterns for gating UI behind a module flag:
 *
 * Pattern A — JSX component (preferred for page-level gates):
 *   <ModuleGate module="scheduler" fallback={<UpgradeBanner />}>
 *     <SchedulerPage />
 *   </ModuleGate>
 *
 * Pattern B — Higher-Order Component (for wrapping exported components):
 *   export default withModule("scheduler")(SchedulerPage);
 *
 * Both patterns:
 *   • Render null (or the fallback) while loading — no flash
 *   • Are reactive — if an admin enables a module in another tab, the UI
 *     updates within seconds via the realtime subscription
 * ──────────────────────────────────────────────────────────────────────────────
 */

import React from "react";
import { Loader2 } from "lucide-react";
import { useFeatureFlags } from "./hook";
import type { ModuleKey } from "@modules/config/environment";

// ─── Upgrade Banner (default fallback) ───────────────────────────────────────

function DefaultFallback({ module: mod }: { module: string }) {
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: 64, textAlign: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 56, height: 56, borderRadius: 16,
          background: "rgba(197,160,89,0.12)",
          border: "1px solid rgba(197,160,89,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 24 }}>🔒</span>
      </div>
      <div>
        <p
          style={{
            fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 600,
            color: "var(--foreground)", margin: "0 0 6px",
          }}
        >
          Module Not Active
        </p>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
          The <strong style={{ color: "var(--gold)", textTransform: "capitalize" }}>{mod}</strong> module
          is not enabled for your clinic. Contact your administrator or upgrade your plan.
        </p>
      </div>
    </div>
  );
}

// ─── ModuleGate component ─────────────────────────────────────────────────────

interface ModuleGateProps {
  /** The module key to check against clinic_modules */
  module:    ModuleKey;
  /** Rendered when loading (defaults to a gold spinner) */
  skeleton?: React.ReactNode;
  /** Rendered when module is disabled (defaults to DefaultFallback) */
  fallback?: React.ReactNode;
  children:  React.ReactNode;
}

export function ModuleGate({ module: mod, skeleton, fallback, children }: ModuleGateProps) {
  const { isEnabled, loading } = useFeatureFlags();

  if (loading) {
    return (
      <>
        {skeleton ?? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh" }}>
            <Loader2 size={26} style={{ color: "rgba(197,160,89,0.5)", animation: "spin 1s linear infinite" }} />
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
          </div>
        )}
      </>
    );
  }

  if (!isEnabled(mod)) {
    return <>{fallback ?? <DefaultFallback module={mod} />}</>;
  }

  return <>{children}</>;
}

// ─── withModule HOC ───────────────────────────────────────────────────────────

/**
 * withModule("scheduler")(MyComponent)
 * Returns a wrapped component that renders null until the module is active.
 * Use this when you want to wrap an entire exported default component.
 */
export function withModule(mod: ModuleKey, fallback?: React.ReactNode) {
  return function wrap<P extends object>(
    Component: React.ComponentType<P>
  ): React.FC<P> {
    const WrappedComponent: React.FC<P> = (props) => (
      <ModuleGate module={mod} fallback={fallback}>
        <Component {...props} />
      </ModuleGate>
    );
    WrappedComponent.displayName = `withModule(${mod})(${Component.displayName ?? Component.name})`;
    return WrappedComponent;
  };
}

// ─── FlagGate  — thin wrapper for boolean feature flags ──────────────────────

interface FlagGateProps {
  flag:      string;
  fallback?: React.ReactNode;
  children:  React.ReactNode;
}

/**
 * <FlagGate flag="whatsapp_integration">
 *   <WhatsAppButton />
 * </FlagGate>
 */
export function FlagGate({ flag, fallback, children }: FlagGateProps) {
  const { getFlag, loading } = useFeatureFlags();
  if (loading) return null;
  if (!getFlag(flag)) return <>{fallback ?? null}</>;
  return <>{children}</>;
}
