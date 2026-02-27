/**
 * Scheduler Module — public API surface
 * ──────────────────────────────────────────────────────────────────────────────
 * Import from here, not from deep module paths.
 * This indirection lets us swap implementations (v1→v2) without changing
 * any consuming code outside this module.
 *
 * Usage:
 *   import { useScheduler, SCHEDULER_MODULE } from "@modules/scheduler";
 * ──────────────────────────────────────────────────────────────────────────────
 */

export { useSchedulerV1 as useScheduler } from "./v1/hooks/useSchedulerV1";
export type { Appointment, SchedulerSettings } from "./v1/types";

export const SCHEDULER_MODULE = {
  key:         "scheduler"  as const,
  version:     "1.0.0",
  displayName: "Smart Scheduler",
  minPlan:     "growth" as const,
  /** Bump this when the v2 hook is ready and flip the re-export above */
  activeHookVersion: "v1",
} as const;
