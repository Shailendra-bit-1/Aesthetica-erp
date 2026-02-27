/**
 * Services Module — v1 types (schema-aware)
 * All new columns added to services/service_packages must be optional here.
 */

export interface Service {
  id:               string;
  clinic_id?:       string | null;
  chain_id?:        string | null;
  name:             string;
  category:         string;
  description?:     string | null;
  duration_minutes: number;
  selling_price:    number;
  // v1.1+ optional additions:
  mrp?:             number;        // Maximum Retail Price
  tax_percent?:     number;        // GST / VAT
  hsn_code?:        string;        // for GST invoicing
  is_active?:       boolean;
  is_global_template?: boolean;
}

export interface ServicePackage {
  id:                string;
  clinic_id?:        string | null;
  is_global_template?: boolean;
  name:              string;
  description?:      string | null;
  total_sessions:    number;
  per_session_value: number;
  is_active?:        boolean;
}

export interface PatientServiceCredit {
  id:                string;
  patient_id:        string;
  service_name:      string;
  total_sessions:    number;
  used_sessions:     number;
  per_session_value: number;
  status:            "active" | "completed" | "expired";
}

/** Explicit column sets — prevents SELECT * */
export const SERVICE_COLUMNS = "id, clinic_id, name, category, duration_minutes, selling_price, is_active, is_global_template";
export const PACKAGE_COLUMNS = "id, clinic_id, name, total_sessions, per_session_value, is_active, is_global_template";
