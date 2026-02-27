"use client";

import { useInactivityTimeout } from "@/hooks/useInactivityTimeout";

/**
 * Mounts the 15-minute inactivity timeout.
 * Wrap authenticated layout content with this component.
 */
export default function InactivityGuard({ children }: { children: React.ReactNode }) {
  useInactivityTimeout();
  return <>{children}</>;
}
