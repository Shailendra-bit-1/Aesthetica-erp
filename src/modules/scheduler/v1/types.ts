/**
 * Scheduler Module — v1 types
 * ──────────────────────────────────────────────────────────────────────────────
 * All types are versioned here. When a new column is added to the DB (e.g.,
 * adding `room_type` to appointments), add it as OPTIONAL (?) so v1 queries
 * that don't select it still compile and run correctly.
 *
 * Schema-aware contract: every field that is DB-backed MUST be optional unless
 * it has a DB-level NOT NULL with a DEFAULT.
 * ──────────────────────────────────────────────────────────────────────────────
 */

export type AppointmentStatus =
  | "planned" | "confirmed" | "arrived"
  | "in_session" | "completed" | "cancelled" | "no_show";

export type PatientTier = "vip" | "hni" | "standard";

export interface Appointment {
  id:               string;
  clinic_id:        string;
  patient_id:       string | null;
  provider_id:      string | null;
  service_id:       string | null;
  credit_id:        string | null;
  service_name:     string;
  room:             string | null;
  start_time:       string;
  end_time:         string;
  status:           AppointmentStatus;
  notes:            string | null;
  credit_reserved:  boolean;
  // Joined fields
  patient_name:     string;
  patient_tier:     PatientTier | null;
  provider_name:    string;
  // v1.1+ optional additions (safe to add; existing code ignores them)
  room_type?:       string;
  booked_by?:       string;
  updated_at?:      string;
}

export interface SchedulerSettings {
  id:                     string;
  clinic_id:              string;
  enable_double_booking:  boolean;
  buffer_time_minutes:    number;
  credit_lock:            boolean;
  working_start:          string;
  working_end:            string;
  slot_duration_minutes:  number;
}

/** Explicit column list used in all v1 SELECT calls — schema-aware */
export const APPOINTMENT_COLUMNS = [
  "id", "clinic_id", "patient_id", "provider_id", "service_id",
  "credit_id", "service_name", "room", "start_time", "end_time",
  "status", "notes", "credit_reserved",
  // Joins:
  "patients!patient_id(full_name,patient_tier)",
  "profiles!provider_id(full_name)",
].join(", ");
