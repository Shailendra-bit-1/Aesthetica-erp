"use client";

/**
 * FeatureFlagsContext
 * ──────────────────────────────────────────────────────────────────────────────
 * Loads the active module list and feature-flag toggles for the current clinic
 * from Supabase and keeps them in sync via a realtime subscription.
 *
 * Architecture:
 *   1. On mount (once clinic_id is known), fetch:
 *        a. clinic_modules   → which modules are enabled for this clinic
 *        b. system_settings  → global & clinic-level feature flags
 *   2. Merge: global flags → clinic overrides → compile-time defaults
 *   3. Subscribe to realtime changes on both tables — zero-downtime toggles
 *      without redeployment.
 *
 * Consumers:
 *   const { isEnabled, getFlag, getConfig, loading } = useFeatureFlags();
 *   isEnabled("scheduler")                       // module gate
 *   getFlag("whatsapp_integration")             // feature flag
 *   getConfig("scheduler").max_concurrent_rooms // module config
 * ──────────────────────────────────────────────────────────────────────────────
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import {
  defaultFeatureFlags,
  FeatureFlagKey,
  ModuleKey,
  ALWAYS_ON_MODULES,
} from "@modules/config/environment";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModuleEntry {
  key:       ModuleKey;
  enabled:   boolean;
  config:    Record<string, unknown>;
}

interface FeatureFlagsState {
  modules:  Record<ModuleKey, ModuleEntry>;
  flags:    Record<string, boolean>;
  loading:  boolean;
  reload:   () => void;
  /** Returns true if a module is active for the current clinic */
  isEnabled: (key: ModuleKey) => boolean;
  /** Returns the value of a specific feature flag */
  getFlag:   (key: string) => boolean;
  /** Returns module-level config object (empty {} if not configured) */
  getConfig: (key: ModuleKey) => Record<string, unknown>;
}

const FeatureFlagsContext = createContext<FeatureFlagsState | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const { activeClinicId, loading: profileLoading } = useClinic();

  const [modules,        setModules]        = useState<Record<string, ModuleEntry>>({});
  const [flags,          setFlags]          = useState<Record<string, boolean>>(defaultFeatureFlags as Record<string, boolean>);
  const [loading,        setLoading]        = useState(true);
  const [killedModules,  setKilledModules]  = useState<Set<string>>(new Set());

  const channelRef       = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const killChannelRef   = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Kill switch fetch ────────────────────────────────────────────────────────

  const fetchKilledModules = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("module_registry")
        .select("key, is_globally_killed")
        .eq("is_globally_killed", true);
      setKilledModules(new Set((data ?? []).map((r: { key: string }) => r.key)));
    } catch {
      // Non-fatal — keep previous kill set
    }
  }, []);

  // ── Data fetch ──────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    if (!activeClinicId) {
      // No clinic — enable only always-on modules with defaults
      const fallbackModules: Record<string, ModuleEntry> = {};
      ALWAYS_ON_MODULES.forEach(k => {
        fallbackModules[k] = { key: k, enabled: true, config: {} };
      });
      setModules(fallbackModules);
      setFlags(defaultFeatureFlags as Record<string, boolean>);
      setLoading(false);
      return;
    }

    try {
      const [modulesRes, globalSettingsRes, clinicSettingsRes] = await Promise.all([
        // Which modules is this clinic subscribed to?
        supabase
          .from("clinic_modules")
          .select("module_key, is_enabled, config")
          .eq("clinic_id", activeClinicId),

        // Global feature flags
        supabase
          .from("system_settings")
          .select("key, value")
          .eq("scope", "global")
          .eq("key", "feature_flags"),

        // Clinic-level feature flag overrides
        supabase
          .from("system_settings")
          .select("key, value")
          .eq("scope", "clinic")
          .eq("clinic_id", activeClinicId)
          .eq("key", "feature_flags"),
      ]);

      // Build module map — always-on modules are enabled regardless of DB row
      const moduleMap: Record<string, ModuleEntry> = {};
      ALWAYS_ON_MODULES.forEach(k => {
        moduleMap[k] = { key: k, enabled: true, config: {} };
      });
      (modulesRes.data ?? []).forEach((row) => {
        moduleMap[row.module_key] = {
          key:     row.module_key as ModuleKey,
          enabled: row.is_enabled,
          config:  (row.config ?? {}) as Record<string, unknown>,
        };
      });
      setModules(moduleMap);

      // Merge flags: defaults → global → clinic override
      const globalFlags  = (globalSettingsRes.data?.[0]?.value as Record<string, boolean>) ?? {};
      const clinicFlags  = (clinicSettingsRes.data?.[0]?.value as Record<string, boolean>) ?? {};
      setFlags({
        ...(defaultFeatureFlags as Record<string, boolean>),
        ...globalFlags,
        ...clinicFlags,
      });
    } catch (err) {
      // On fetch failure keep compile-time defaults — degraded but not broken
      console.warn("[FeatureFlags] Fetch failed, using defaults:", err);
    } finally {
      setLoading(false);
    }
  }, [activeClinicId]);

  // ── Effects ─────────────────────────────────────────────────────────────────

  // Subscribe to module_registry kill switch changes (global — runs once)
  useEffect(() => {
    fetchKilledModules();
    killChannelRef.current = supabase
      .channel("module_registry_kill_switch")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "module_registry" },
        fetchKilledModules
      )
      .subscribe();
    return () => {
      killChannelRef.current?.unsubscribe();
      killChannelRef.current = null;
    };
  }, [fetchKilledModules]);

  useEffect(() => {
    if (profileLoading) return;
    setLoading(true);
    fetchAll();

    // Realtime subscription — fire fetchAll whenever clinic's modules change
    if (activeClinicId) {
      channelRef.current?.unsubscribe();
      channelRef.current = supabase
        .channel(`feature_flags_${activeClinicId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "clinic_modules",
            filter: `clinic_id=eq.${activeClinicId}` },
          fetchAll
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "system_settings" },
          fetchAll
        )
        .subscribe();
    }

    return () => {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [profileLoading, activeClinicId, fetchAll]);

  // ── Accessors ────────────────────────────────────────────────────────────────

  function isEnabled(key: ModuleKey): boolean {
    // Global kill switch — always respected, even for always-on modules
    if (killedModules.has(key)) return false;
    // Always-on modules are never gated (unless killed above)
    if (ALWAYS_ON_MODULES.includes(key as typeof ALWAYS_ON_MODULES[number])) return true;
    // While loading OR if no DB row exists → fail open (show the item)
    // Only hide when the DB explicitly sets is_enabled = false
    if (loading) return true;
    if (!(key in modules)) return true;
    return modules[key]?.enabled !== false;
  }

  function getFlag(key: string): boolean {
    return flags[key as FeatureFlagKey] ?? false;
  }

  function getConfig(key: ModuleKey): Record<string, unknown> {
    return modules[key]?.config ?? {};
  }

  return (
    <FeatureFlagsContext.Provider
      value={{
        modules:   modules as Record<ModuleKey, ModuleEntry>,
        flags,
        loading,
        reload:    fetchAll,
        isEnabled,
        getFlag,
        getConfig,
      }}
    >
      {children}
    </FeatureFlagsContext.Provider>
  );
}

// ─── Internal accessor (used by hook) ─────────────────────────────────────────

export function _useFeatureFlagsContext(): FeatureFlagsState {
  const ctx = useContext(FeatureFlagsContext);
  if (!ctx) {
    throw new Error(
      "useFeatureFlags must be called inside <FeatureFlagsProvider>. " +
      "Ensure it is nested inside <ClinicProvider> in app/layout.tsx."
    );
  }
  return ctx;
}
