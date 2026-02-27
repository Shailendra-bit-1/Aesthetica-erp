"use client";

/**
 * useRealtimePermissions
 *
 * Single source of truth for "can this user do X?" — reads from:
 *   1. role_permissions  (DB defaults per role, row-per-permission)
 *   2. user_overrides    (per-user manual overrides, is_enabled flag)
 *
 * For superadmin / admin / clinic_admin / chain_admin the answer is always
 * true (wildcard), with zero DB queries.
 *
 * For staff roles the hook subscribes to realtime changes on both tables
 * so the sidebar updates instantly when an admin flips a toggle.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";

type PermMap = Record<string, boolean>;

const ADMIN_ROLES = new Set([
  "superadmin",
  "admin",
  "clinic_admin",
  "chain_admin",
]);

export interface RealtimePermissions {
  /** Check whether the current user holds a specific permission key */
  can: (key: string) => boolean;
  /** True once the initial load (and profile) has resolved */
  ready: boolean;
  /** Raw map — useful for the permissions matrix UI */
  perms: PermMap;
  /** Refresh manually if needed */
  reload: () => void;
}

export function useRealtimePermissions(): RealtimePermissions {
  const { profile, loading: profileLoading } = useClinic();
  const [perms, setPerms]   = useState<PermMap>({});
  const [ready, setReady]   = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const role        = profile?.role ?? null;
  const isSuperAdmin = role === "superadmin";
  const isAdmin      = role != null && ADMIN_ROLES.has(role);

  const fetchPerms = useCallback(async () => {
    if (!profile) {
      setPerms({});
      setReady(true);
      return;
    }

    // Admin roles get wildcard — no DB needed
    if (isAdmin) {
      setPerms({ "*": true });
      setReady(true);
      return;
    }

    // ── Staff roles: build perm map from DB ────────────────────────────────

    try {
      // 1. Role defaults
      const { data: roleRows } = await supabase
        .from("role_permissions")
        .select("permission")
        .eq("role", role);

      const map: PermMap = {};
      (roleRows ?? []).forEach((r) => { map[r.permission] = true; });

      // 2. User-specific overrides (can flip defaults both ways)
      const { data: overrides } = await supabase
        .from("user_overrides")
        .select("permission, is_enabled")
        .eq("user_id", profile.id);

      (overrides ?? []).forEach((o) => { map[o.permission] = !!o.is_enabled; });

      setPerms(map);
    } catch {
      // On error fall back to empty — staff sees no extra items, not a crash
      setPerms({});
    } finally {
      setReady(true);
    }
  }, [profile, role, isAdmin]);

  useEffect(() => {
    if (profileLoading) return;

    setReady(false);
    fetchPerms();

    // Realtime: subscribe only for non-admin users whose perms can change
    if (!isAdmin && profile?.id) {
      channelRef.current?.unsubscribe();

      channelRef.current = supabase
        .channel(`perms_${profile.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_overrides",
            filter: `user_id=eq.${profile.id}`,
          },
          fetchPerms
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "role_permissions",
            filter: `role=eq.${role}`,
          },
          fetchPerms
        )
        .subscribe();
    }

    return () => {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [profileLoading, profile?.id, role, isAdmin, fetchPerms]);

  function can(key: string): boolean {
    if (!ready) return false;
    if (perms["*"]) return true;        // wildcard for admin roles
    return perms[key] === true;
  }

  return { can, ready: ready && !profileLoading, perms, reload: fetchPerms };
}
