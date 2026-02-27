export { usePatientsV1 as usePatients } from "./v1/hooks/usePatientsV1";
export const PATIENTS_MODULE = { key: "patients" as const, version: "1.0.0", displayName: "Patient Records", minPlan: "free" as const } as const;
