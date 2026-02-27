// ── Permission types & role defaults ────────────────────────────────────────

export type StaffRole =
  | "doctor"
  | "counsellor"
  | "therapist"
  | "front_desk";

export type AnyRole =
  | "superadmin"
  | "admin"
  | "clinic_admin"
  | "chain_admin"
  | StaffRole;

export interface StaffPermissions {
  view_patients: boolean;
  edit_patients: boolean;
  view_scheduler: boolean;
  edit_scheduler: boolean;
  view_photos: boolean;
  edit_photos: boolean;
  view_inventory: boolean;
  view_revenue: boolean;
  edit_notes: boolean;
  view_medical: boolean;
  access_billing: boolean;
  delete_patient_photos: boolean;
  edit_staff: boolean;
}

// ── Default permission templates per role ────────────────────────────────────

export const ROLE_PERMISSIONS: Record<StaffRole, StaffPermissions> = {
  doctor: {
    view_patients: true,
    edit_patients: true,
    view_scheduler: true,
    edit_scheduler: true,
    view_photos: true,
    edit_photos: true,
    view_inventory: true,
    view_revenue: false,
    edit_notes: true,
    view_medical: true,
    access_billing: false,
    delete_patient_photos: false,
    edit_staff: false,
  },
  counsellor: {
    view_patients: true,
    edit_patients: false,
    view_scheduler: true,
    edit_scheduler: false,
    view_photos: false,
    edit_photos: false,
    view_inventory: false,
    view_revenue: false,
    edit_notes: true,
    view_medical: false,
    access_billing: false,
    delete_patient_photos: false,
    edit_staff: false,
  },
  therapist: {
    view_patients: true,
    edit_patients: true,
    view_scheduler: true,
    edit_scheduler: false,
    view_photos: true,
    edit_photos: false,
    view_inventory: false,
    view_revenue: false,
    edit_notes: true,
    view_medical: true,
    access_billing: false,
    delete_patient_photos: false,
    edit_staff: false,
  },
  front_desk: {
    view_patients: true,
    edit_patients: false,
    view_scheduler: true,
    edit_scheduler: true,
    view_photos: false,
    edit_photos: false,
    view_inventory: false,
    view_revenue: false,
    edit_notes: false,
    view_medical: false,
    access_billing: false,
    delete_patient_photos: false,
    edit_staff: false,
  },
};

// Admins/superadmins get everything
export const FULL_PERMISSIONS: StaffPermissions = {
  view_patients: true,
  edit_patients: true,
  view_scheduler: true,
  edit_scheduler: true,
  view_photos: true,
  edit_photos: true,
  view_inventory: true,
  view_revenue: true,
  edit_notes: true,
  view_medical: true,
  access_billing: true,
  delete_patient_photos: true,
  edit_staff: true,
};

// Human-readable labels for the permissions editor
export const PERMISSION_LABELS: Record<keyof StaffPermissions, { label: string; desc: string }> = {
  view_patients:          { label: "View Patients",           desc: "Browse patient records" },
  edit_patients:          { label: "Edit Patients",           desc: "Modify patient details" },
  view_scheduler:         { label: "View Scheduler",          desc: "See appointment calendar" },
  edit_scheduler:         { label: "Edit Scheduler",          desc: "Book and reschedule appointments" },
  view_photos:            { label: "View Photo Comparison",   desc: "Access before/after photos" },
  edit_photos:            { label: "Edit Photos",             desc: "Upload and delete patient photos" },
  view_inventory:         { label: "View Inventory",          desc: "See product and supply stock" },
  view_revenue:           { label: "View Revenue",            desc: "See financial summaries" },
  edit_notes:             { label: "Edit Clinical Notes",     desc: "Write and update consultation notes" },
  view_medical:           { label: "View Medical Records",    desc: "Full clinical history access" },
  access_billing:         { label: "Access Billing",          desc: "Manage invoices and payments" },
  delete_patient_photos:  { label: "Delete Patient Photos",   desc: "Permanently remove photo records" },
  edit_staff:             { label: "Edit Staff",              desc: "Modify staff roles and permissions" },
};

export const STAFF_ROLES: { value: StaffRole; label: string }[] = [
  { value: "doctor",     label: "Doctor"     },
  { value: "counsellor", label: "Counsellor" },
  { value: "therapist",  label: "Therapist"  },
  { value: "front_desk", label: "Front Desk" },
];

// Badge styling per role
// ── Runtime permission check ──────────────────────────────────────────────────
// Superadmins and admins bypass every flag. All other roles are bound by their
// effective permissions (role defaults or custom overrides).

export function hasPermission(
  role: string | null,
  permissions: StaffPermissions | null,
  key: keyof StaffPermissions
): boolean {
  if (role === "superadmin" || role === "admin") return true;
  return permissions?.[key] ?? false;
}

// ── Role badge styling ────────────────────────────────────────────────────────

export const ROLE_BADGE: Record<string, { label: string; bg: string; color: string; border: string }> = {
  superadmin: { label: "Superadmin", bg: "rgba(197,160,89,0.2)",  color: "#A8853A", border: "rgba(197,160,89,0.45)" },
  admin:      { label: "Admin",      bg: "rgba(197,160,89,0.12)", color: "#C5A059", border: "rgba(197,160,89,0.3)"  },
  doctor:     { label: "Doctor",     bg: "rgba(197,160,89,0.16)", color: "#A8853A", border: "rgba(197,160,89,0.35)" },
  counsellor: { label: "Counsellor", bg: "rgba(122,158,142,0.15)",color: "#4A7A68", border: "rgba(122,158,142,0.3)" },
  therapist:  { label: "Therapist",  bg: "rgba(158,142,122,0.15)",color: "#7A6A52", border: "rgba(158,142,122,0.3)" },
  front_desk: { label: "Front Desk", bg: "rgba(232,226,212,0.6)", color: "#6A6058", border: "rgba(197,160,89,0.2)" },
};
