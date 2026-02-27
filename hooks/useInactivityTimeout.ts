"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

/**
 * HIPAA Inactivity Timeout
 * Automatically signs out the user and clears the session after 15 minutes
 * of inactivity. Only fires if there is an active session, so it is safe
 * to mount on public / intake routes too.
 */
export function useInactivityTimeout() {
  const router   = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const logout = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return; // no active session — nothing to clear
      await supabase.auth.signOut();
      router.push("/login");
    };

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(logout, TIMEOUT_MS);
    };

    const EVENTS = ["mousemove", "keydown", "mousedown", "touchstart", "scroll", "click"] as const;
    EVENTS.forEach(evt => window.addEventListener(evt, reset, { passive: true }));
    reset(); // start the clock immediately

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      EVENTS.forEach(evt => window.removeEventListener(evt, reset));
    };
  }, [router]);
}
