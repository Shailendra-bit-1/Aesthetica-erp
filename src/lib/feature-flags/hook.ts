"use client";

/**
 * useFeatureFlags
 * ──────────────────────────────────────────────────────────────────────────────
 * Public API for consuming feature flags and module state anywhere in the app.
 *
 * Usage:
 *   const { isEnabled, getFlag, getConfig, loading } = useFeatureFlags();
 *
 *   // Module gate (show/hide entire module)
 *   if (!isEnabled("scheduler")) return <UpgradeBanner module="scheduler" />;
 *
 *   // Feature flag (A/B, gradual rollout, kill-switch)
 *   if (getFlag("whatsapp_integration")) { ... }
 *
 *   // Module-level config (admin-set JSON in clinic_modules.config)
 *   const { max_concurrent_rooms } = getConfig("scheduler");
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { _useFeatureFlagsContext } from "./context";
import type { ModuleKey } from "@modules/config/environment";

export interface UseFeatureFlagsReturn {
  /** True while the initial DB fetch is in flight */
  loading:   boolean;
  /** Returns true if a module is active for the current clinic */
  isEnabled: (key: ModuleKey) => boolean;
  /** Returns the value of a named feature flag (boolean) */
  getFlag:   (key: string) => boolean;
  /** Returns the admin-configurable JSON blob for a module */
  getConfig: (key: ModuleKey) => Record<string, unknown>;
  /** Force a refresh (e.g. after an admin enables a module) */
  reload:    () => void;
}

export function useFeatureFlags(): UseFeatureFlagsReturn {
  const { loading, isEnabled, getFlag, getConfig, reload } = _useFeatureFlagsContext();
  return { loading, isEnabled, getFlag, getConfig, reload };
}
