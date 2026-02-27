export { useBillingV1 as useBilling } from "./v1/hooks/useBillingV1";
export const BILLING_MODULE = { key: "billing" as const, version: "1.0.0", displayName: "Billing & Invoicing", minPlan: "free" as const } as const;
