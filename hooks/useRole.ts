"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type UserRole = "superadmin" | "admin" | "clinic_admin" | "chain_admin" | "doctor" | "therapist" | "counsellor" | "front_desk" | "staff" | "provider" | null;

interface UseRoleResult {
  role: UserRole;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export function useRole(): UseRoleResult {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  async function fetchRole() {
    try {
      // 1. Get the authenticated user from the current session
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      // 2. Prefer app_metadata.role (set server-side, cannot be spoofed by the user)
      const metaRole =
        (user.app_metadata?.role as UserRole) ??
        (user.user_metadata?.role as UserRole);

      if (metaRole) {
        setRole(metaRole);
        setLoading(false);
        return;
      }

      // 3. Fallback: query the profiles table
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!error && data?.role) {
        setRole(data.role as UserRole);
      } else {
        setRole(null);
      }
    } catch {
      setRole(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRole();

    // Re-run whenever the auth session changes (sign-in / sign-out)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      setLoading(true);
      fetchRole();
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    role,
    loading,
    isAdmin: role === "superadmin" || role === "admin" || role === "clinic_admin" || role === "chain_admin",
    isSuperAdmin: role === "superadmin",
  };
}
