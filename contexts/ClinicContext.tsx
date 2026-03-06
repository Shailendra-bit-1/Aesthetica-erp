"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Clinic {
  id: string;
  name: string;
  location: string | null;
  subscription_status: string;
}

export interface UserProfile {
  id: string;
  full_name: string | null;
  role: string | null;
  clinic_id: string | null;
  email: string | null;
}

interface ClinicCtx {
  profile: UserProfile | null;
  clinics: Clinic[];
  activeClinicId: string | null;
  setActiveClinicId: (id: string | null) => void;
  loading: boolean;
}

// ── Context ────────────────────────────────────────────────────────────────────

const ClinicContext = createContext<ClinicCtx>({
  profile: null,
  clinics: [],
  activeClinicId: null,
  setActiveClinicId: () => {},
  loading: true,
});

// ── Provider ───────────────────────────────────────────────────────────────────

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [profile,        setProfile]        = useState<UserProfile | null>(null);
  const [clinics,        setClinics]        = useState<Clinic[]>([]);
  const [activeClinicId, setActiveClinicId] = useState<string | null>(null);
  const [loading,        setLoading]        = useState(true);

  async function loadProfile() {
    try {
      // ── Step 1: get the authenticated user ──────────────────────────────────
      // getUser() validates the token with Supabase Auth (network request).
      // If that fails (e.g. slow network on first load), fall back to getSession()
      // which reads the cached token from cookies without a network call.
      let userId: string | null = null;
      let userEmail: string | null = null;
      let metaRole: string | null = null;
      let metaName: string | null = null;

      const { data: { user }, error: userErr } = await supabase.auth.getUser();

      if (user) {
        userId    = user.id;
        userEmail = user.email ?? null;
        // Role & name from server-set app_metadata (trustworthy) or user_metadata (fallback)
        metaRole = user.app_metadata?.role ?? user.user_metadata?.role ?? null;
        metaName = user.user_metadata?.full_name ?? null;
      } else if (userErr || !user) {
        // Fallback: read session from cookie cache (no network request)
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); return; }
        userId    = session.user.id;
        userEmail = session.user.email ?? null;
        metaRole  = session.user.app_metadata?.role ?? session.user.user_metadata?.role ?? null;
        metaName  = session.user.user_metadata?.full_name ?? null;
      }

      if (!userId) { setLoading(false); return; }

      // ── Step 2: fetch profile row ────────────────────────────────────────────
      // Uses the authenticated session so RLS (auth.uid() = id) passes correctly.
      const { data: p } = await supabase
        .from("profiles")
        .select("id, full_name, role, clinic_id")
        .eq("id", userId)
        .maybeSingle();

      // ── Step 3: build profile — DB row wins; auth metadata is the fallback ───
      const resolved: UserProfile = {
        id:        userId,
        full_name: p?.full_name ?? metaName ?? null,
        role:      p?.role      ?? metaRole  ?? null,
        clinic_id: p?.clinic_id ?? null,
        email:     userEmail ?? null,
      };

      setProfile(resolved);
      setActiveClinicId(resolved.clinic_id);

      // Superadmins load all clinics for the context-switcher in TopBar
      if (resolved.role === "superadmin") {
        const { data: all } = await supabase
          .from("clinics")
          .select("id, name, location, subscription_status")
          .order("name");
        setClinics(all ?? []);
      }

      // GAP-24: Chain admins load all clinics in their chain
      if (resolved.role === "chain_admin" && resolved.clinic_id) {
        const { data: myCli } = await supabase
          .from("clinics")
          .select("chain_id")
          .eq("id", resolved.clinic_id)
          .maybeSingle();
        if (myCli?.chain_id) {
          const { data: chainClis } = await supabase
            .from("clinics")
            .select("id, name, location, subscription_status")
            .eq("chain_id", myCli.chain_id)
            .order("name");
          setClinics(chainClis ?? []);
        }
      }
    } catch {
      // Swallow — loading stays false, profile stays null (unauthenticated state)
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();

    // Re-run on auth state changes (sign-in / sign-out / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        loadProfile();
      }
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setClinics([]);
        setActiveClinicId(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ClinicContext.Provider value={{ profile, clinics, activeClinicId, setActiveClinicId, loading }}>
      {children}
    </ClinicContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export const useClinic = () => useContext(ClinicContext);
