/**
 * Services Module — public API surface
 */
export { useServicesV1 as useServices } from "./v1/hooks/useServicesV1";
export type { Service, ServicePackage, PatientServiceCredit } from "./v1/types";

export const SERVICES_MODULE = {
  key:         "services"  as const,
  version:     "1.0.0",
  displayName: "Services & Packages",
  minPlan:     "free" as const,
  activeHookVersion: "v1",
} as const;
