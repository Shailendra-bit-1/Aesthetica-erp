"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  FULL_PERMISSIONS,
  ROLE_PERMISSIONS,
  type StaffPermissions,
  type StaffRole,
} from "@/lib/permissions";
import { useRole } from "./useRole";

interface UsePermissionsResult {
  permissions: StaffPermissions | null;
  loading: boolean;
  isCustom: boolean;
}

export function usePermissions(): UsePermissionsResult {
  const { role, loading: roleLoading, isAdmin } = useRole();
  const [permissions, setPermissions] = useState<StaffPermissions | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (roleLoading) return;

    // Admins and superadmins get full access — no DB query needed
    if (isAdmin) {
      setPermissions(FULL_PERMISSIONS);
      setLoading(false);
      return;
    }

    async function fetchPermissions() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setPermissions(null);
          setLoading(false);
          return;
        }

        // Check for custom overrides in user_overrides table
        const { data, error } = await supabase
          .from("user_overrides")
          .select("permission, is_enabled")
          .eq("user_id", user.id);

        if (!error && data && data.length > 0) {
          // Build a permission map from override rows
          setIsCustom(true);
          const base = role ? { ...(ROLE_PERMISSIONS[role as StaffRole] ?? FULL_PERMISSIONS) } : { ...FULL_PERMISSIONS };
          data.forEach(row => {
            if (row.permission in base) {
              (base as Record<string, boolean>)[row.permission] = row.is_enabled ?? true;
            }
          });
          setPermissions(base as StaffPermissions);
        } else {
          // No custom override — try fetching role defaults from role_permissions table
          if (role) {
            try {
              const { data: roleRow, error: roleErr } = await supabase
                .from("role_permissions")
                .select("*")
                .eq("role", role)
                .single();

              if (!roleErr && roleRow) {
                // Strip non-permission columns
                const { role: _r, updated_at: _u, ...dbPerms } = roleRow;
                setPermissions(dbPerms as StaffPermissions);
              } else {
                // Table empty or no row for this role — fall back to hardcoded defaults
                const defaultPerms = ROLE_PERMISSIONS[role as StaffRole] ?? null;
                setPermissions(defaultPerms);
              }
            } catch {
              // Fall back to hardcoded defaults silently
              const defaultPerms = ROLE_PERMISSIONS[role as StaffRole] ?? null;
              setPermissions(defaultPerms);
            }
          } else {
            setPermissions(null);
          }
        }
      } catch {
        // Fall back to role defaults silently
        const defaultPerms = role ? ROLE_PERMISSIONS[role as StaffRole] : null;
        setPermissions(defaultPerms ?? null);
      } finally {
        setLoading(false);
      }
    }

    fetchPermissions();
  }, [roleLoading, isAdmin, role]);

  return { permissions, loading: loading || roleLoading, isCustom };
}
