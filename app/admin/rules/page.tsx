"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Zap,
  Bell,
  Plus,
  Trash2,
  Globe,
  Building2,
  MessageSquare,
  Mail,
  AlertCircle,
  ChevronDown,
  X,
  Smartphone,
  ToggleLeft,
  ToggleRight,
  Eye,
  Package,
  UserCheck,
  CalendarX,
  Sparkles,
  Edit2,
  Clock,
  Star,
  Gift,
  CreditCard,
  UserX,
  ClipboardList,
  CheckSquare,
  Square,
  Shield,
  Users,
  PenLine,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Activity,
  AlertTriangle,
  RefreshCw,
  BookOpen,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

type Status = "active" | "paused";

interface AutomationTrigger {
  id: string;
  key: string;
  label: string;
  description: string | null;
  icon: string;
  is_system: boolean;
  created_at: string;
}

interface AutomationRule {
  id: string;
  name: string;
  trigger_key: string;
  condition_treatment: string | null;
  condition_days: number | null;
  condition_product: string | null;
  condition_quantity: number | null;
  condition_source: string | null;
  condition_hours: number | null;
  action: string;
  nudge_target_role: string | null;    // legacy single
  nudge_target_roles: string[];        // multi-select (new)
  message_template: string;
  scope_type: "global" | "clinic";
  clinic_ids: string[];
  clinic_id: string | null;
  chain_id: string | null;
  status: Status;
  created_at: string;
}

interface CustomNudgeRole {
  id: string;
  key: string;
  label: string;
  created_at: string;
}

interface Clinic {
  id: string;
  name: string;
  chain_id: string | null;
}

interface RuleForm {
  id: string | null;   // null = creating, string = editing
  name: string;
  trigger_key: string;
  condition_treatment: string;
  condition_days: string;
  condition_product: string;
  condition_quantity: string;
  condition_source: string;
  condition_hours: string;
  action: string;
  nudge_target_roles: string[];        // multi-select, "all" is a special value
  message_template: string;
  scope_type: "global" | "clinic";
  clinic_ids: string[];
}

interface TriggerForm {
  id: string | null;
  key: string;
  label: string;
  description: string;
  icon: string;
}

interface ConditionRow {
  id: string;
  field_path: string;
  operator: string;
  value: string;
  logic_op: "AND" | "OR";
}

interface ActionRow {
  id: string;
  action_type: string;
  params: Record<string, string>;
  on_failure: "stop" | "continue" | "dlq_notify";
}

interface AdvancedRuleFull {
  id: string;
  conditions: Array<{ field_path: string; operator: string; value: Record<string,unknown>; logic_op: string; sort_order: number }>;
  actions: Array<{ action_type: string; params: Record<string,unknown>; on_failure: string; sort_order: number }>;
}

interface DLQItem {
  id: string;
  clinic_id: string;
  rule_id: string;
  action_index: number;
  action_type: string;
  params: Record<string,unknown> | null;
  error_message: string;
  trigger_payload: Record<string,unknown> | null;
  status: "pending" | "resolved" | "dismissed";
  retry_count: number;
  created_at: string;
  rule_definitions?: { name: string } | null;
}

interface ClinicOverride {
  rule_id: string;
  clinic_id: string;
  is_enabled: boolean;
}

interface BuiltinTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  trigger_event: string;
  is_featured: boolean;
  conditions: Array<{ field_path: string; operator: string; value: Record<string,unknown>; logic_op: string }>;
  actions: Array<{ action_type: string; params: Record<string,unknown>; on_failure: string }>;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  Sparkles,
  Package,
  UserCheck,
  CalendarX,
  Bell,
  Gift,
  ClipboardList,
  CreditCard,
  Clock,
  UserX,
  Star,
  Zap,
  Mail,
  MessageSquare,
  Building2,
  Globe,
};

const AVAILABLE_ICONS = [
  "Sparkles", "Package", "UserCheck", "CalendarX", "Bell", "Gift",
  "ClipboardList", "CreditCard", "Clock", "UserX", "Star", "Zap",
  "Mail", "MessageSquare",
];

// CalendarPlus doesn't exist in this lucide version — map it to CalendarX
function getTriggerIcon(iconName: string): React.ElementType {
  return ICON_MAP[iconName] ?? Zap;
}

const ACTIONS: { value: string; label: string; icon: React.ElementType; description: string }[] = [
  { value: "send_whatsapp",          label: "Send WhatsApp",           icon: MessageSquare, description: "Send a WhatsApp message to the patient" },
  { value: "email_care_instructions",label: "Email Care Instructions", icon: Mail,          description: "Send a post-care email to the patient" },
  { value: "nudge_staff",            label: "Nudge Staff",             icon: Bell,          description: "Send an internal alert to a specific staff role" },
  { value: "send_sms",               label: "Send SMS",                icon: Smartphone,    description: "Send an SMS to the patient" },
];

// Built-in staff roles (shown as checkboxes in the nudge picker)
const BUILTIN_NUDGE_ROLES: { value: string; label: string }[] = [
  { value: "front_desk",  label: "Front Desk"   },
  { value: "doctor",      label: "Doctor"       },
  { value: "therapist",   label: "Therapist"    },
  { value: "counsellor",  label: "Counsellor"   },
  { value: "clinic_admin",label: "Clinic Admin" },
  { value: "chain_admin", label: "Chain Admin"  },
];

const DEFAULT_TEMPLATES: Record<string, string> = {
  send_whatsapp: "Hi {patient_name}, thank you for your {treatment_name} session at {clinic_name}! Here are your aftercare tips: avoid direct sunlight for {days} days and keep the area moisturised. — {doctor_name}",
  email_care_instructions: "Dear {patient_name},\n\nThank you for choosing {clinic_name} for your {treatment_name} treatment.\n\nPlease follow these care instructions:\n• Avoid direct sunlight and apply SPF 50+\n• Keep the area hydrated with a gentle moisturiser\n• Avoid makeup for 24 hours\n\nWarm regards,\n{doctor_name}\n{clinic_name}",
  nudge_staff: "Patient Follow-up Required\n\nPatient: {patient_name}\nTreatment: {treatment_name}\nClinic: {clinic_name}\n\nPlease reach out to schedule a follow-up appointment within {hours} hours.",
  send_sms: "Hi {patient_name}, this is a reminder from {clinic_name}. Reply STOP to opt out.",
};

const EMPTY_RULE_FORM: RuleForm = {
  id: null,
  name: "",
  trigger_key: "",
  condition_treatment: "",
  condition_days: "3",
  condition_product: "",
  condition_quantity: "5",
  condition_source: "",
  condition_hours: "2",
  action: "",
  nudge_target_roles: [],
  message_template: "",
  scope_type: "global",
  clinic_ids: [],
};

const EMPTY_TRIGGER_FORM: TriggerForm = {
  id: null,
  key: "",
  label: "",
  description: "",
  icon: "Zap",
};

const TRIGGER_EVENTS = [
  { value: "appointment.completed",  label: "Appt Completed",    icon: CalendarX    },
  { value: "appointment.booked",     label: "Appt Booked",       icon: UserCheck    },
  { value: "appointment.noshow",     label: "No-Show",           icon: CalendarX    },
  { value: "treatment.completed",    label: "Treatment Done",    icon: Sparkles     },
  { value: "patient.created",        label: "New Patient",       icon: Users        },
  { value: "patient.birthday",       label: "Patient Birthday",  icon: Gift         },
  { value: "lead.created",           label: "New Lead",          icon: UserX        },
  { value: "invoice.overdue",        label: "Invoice Overdue",   icon: CreditCard   },
  { value: "invoice.paid",           label: "Invoice Paid",      icon: CreditCard   },
  { value: "membership.expiring",    label: "Membership Expiry", icon: Star         },
  { value: "credit.expiring",        label: "Credit Expiry",     icon: Package      },
  { value: "inventory.low_stock",    label: "Low Stock",         icon: Package      },
  { value: "form.submitted",         label: "Form Submitted",    icon: ClipboardList},
];

const FIELD_PATHS = [
  { value: "treatment_name",     label: "Treatment Name"     },
  { value: "patient.membership", label: "Patient Membership" },
  { value: "invoice.amount",     label: "Invoice Amount"     },
  { value: "lead.source",        label: "Lead Source"        },
  { value: "product.quantity",   label: "Product Quantity"   },
  { value: "appointment.type",   label: "Appointment Type"   },
  { value: "patient.tag",        label: "Patient Tag"        },
  { value: "lead.status",        label: "Lead Status"        },
  { value: "no_booking_after",   label: "No Booking After"   },
  { value: "staff.role",         label: "Staff Role"         },
];

const OPERATORS = [
  { value: "eq",       label: "equals"       },
  { value: "neq",      label: "not equals"   },
  { value: "gt",       label: "greater than" },
  { value: "lt",       label: "less than"    },
  { value: "contains", label: "contains"     },
  { value: "in",       label: "is one of"    },
  { value: "between",  label: "between"      },
  { value: "is_null",  label: "is empty"     },
  { value: "not_null", label: "is not empty" },
];

const ADV_ACTION_TYPES = [
  { value: "send_whatsapp", label: "Send WhatsApp",  icon: MessageSquare, paramKeys: ["message"]           },
  { value: "send_sms",      label: "Send SMS",        icon: Smartphone,    paramKeys: ["message"]           },
  { value: "send_email",    label: "Send Email",      icon: Mail,          paramKeys: ["subject", "body"]   },
  { value: "nudge_staff",   label: "Notify Staff",    icon: Bell,          paramKeys: ["role", "message"]   },
  { value: "create_task",   label: "Create Task",     icon: ClipboardList, paramKeys: ["title", "assigned_role"] },
  { value: "update_field",  label: "Update Field",    icon: PenLine,       paramKeys: ["field_path", "value"]},
  { value: "add_tag",       label: "Add Tag",         icon: Star,          paramKeys: ["tag"]               },
];

const CATEGORY_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  post_treatment:  { bg: "rgba(139,92,246,0.1)",  color: "#7C3AED", label: "Post-Treatment" },
  engagement:      { bg: "rgba(34,197,94,0.1)",   color: "#16a34a", label: "Engagement"     },
  lead_management: { bg: "rgba(59,130,246,0.1)",  color: "#2563EB", label: "Lead Mgmt"      },
  billing:         { bg: "rgba(220,38,38,0.1)",   color: "#DC2626", label: "Billing"        },
  staff_alert:     { bg: "rgba(234,179,8,0.1)",   color: "#ca8a04", label: "Staff Alert"    },
  inventory:       { bg: "rgba(249,115,22,0.1)",  color: "#EA580C", label: "Inventory"      },
  membership:      { bg: "rgba(139,92,246,0.1)",  color: "#7C3AED", label: "Membership"     },
  counselling:     { bg: "rgba(20,184,166,0.1)",  color: "#0D9488", label: "Counselling"    },
  staff_hr:        { bg: "rgba(245,158,11,0.1)",  color: "#D97706", label: "Staff HR"       },
  intake:          { bg: "rgba(99,102,241,0.1)",  color: "#4F46E5", label: "Intake & Forms" },
};

const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: "bt-001", name: "Post-Treatment WhatsApp Follow-Up",
    description: "Send care reminder 3 days after treatment",
    category: "post_treatment", trigger_event: "appointment.completed", is_featured: true,
    conditions: [],
    actions: [{ action_type: "send_whatsapp", params: { message: "Hi {patient_name}, hope you're feeling great after your {treatment_name}! Avoid direct sunlight for 72h and apply SPF 50+. See you soon! — {clinic_name}" }, on_failure: "continue" }],
  },
  {
    id: "bt-002", name: "Post-Treatment Care Email",
    description: "Detailed aftercare instructions via email after any treatment",
    category: "post_treatment", trigger_event: "appointment.completed", is_featured: true,
    conditions: [],
    actions: [{ action_type: "send_email", params: { subject: "Your Aftercare Guide from {clinic_name}", body: "Dear {patient_name},\n\nThank you for your {treatment_name} session. Please follow these care instructions:\n• Avoid direct sunlight for 72h\n• Apply SPF 50+ daily\n• Avoid makeup for 24h\n\nWarm regards,\n{clinic_name}" }, on_failure: "continue" }],
  },
  {
    id: "bt-003", name: "48h Safety Check — Post-Injection",
    description: "Alert doctor + check in with patient 48h after botox/filler",
    category: "post_treatment", trigger_event: "appointment.completed", is_featured: true,
    conditions: [{ field_path: "treatment_name", operator: "contains", value: { v: "botox" }, logic_op: "AND" }],
    actions: [
      { action_type: "nudge_staff", params: { role: "doctor", message: "Patient {patient_name} had {treatment_name} — 48h check-in due. Review for adverse reactions." }, on_failure: "dlq_notify" },
      { action_type: "send_whatsapp", params: { message: "Hi {patient_name}, it's been 48h since your {treatment_name}. Any redness, swelling or discomfort? Reply YES if you need us to call you. — {clinic_name}" }, on_failure: "continue" },
    ],
  },
  {
    id: "bt-004", name: "Skin Review Reminder (28 days)",
    description: "Monthly check-in SMS after skin treatment completion",
    category: "post_treatment", trigger_event: "treatment.completed", is_featured: false,
    conditions: [],
    actions: [{ action_type: "send_sms", params: { message: "Hi {patient_name}, it's been 4 weeks since your {treatment_name}. Time for your monthly skin check! Book at {clinic_name}. Reply BOOK." }, on_failure: "continue" }],
  },
  {
    id: "bt-005", name: "Treatment Anniversary Celebration",
    description: "1-year anniversary offer: 10% off next session",
    category: "post_treatment", trigger_event: "treatment.completed", is_featured: false,
    conditions: [],
    actions: [{ action_type: "send_whatsapp", params: { message: "Hi {patient_name}! It's been one year since your {treatment_name} at {clinic_name}. Enjoy 10% off your next session — mention ANNIVERSARY10 when you book!" }, on_failure: "continue" }],
  },
  {
    id: "bt-006", name: "Birthday Greeting with Offer",
    description: "Personalised birthday WhatsApp with 15% off voucher",
    category: "engagement", trigger_event: "patient.birthday", is_featured: true,
    conditions: [],
    actions: [{ action_type: "send_whatsapp", params: { message: "Happy Birthday {patient_name}! As our gift to you, enjoy 15% off any treatment this month. Mention BDAY15 when you book. With love, {clinic_name}" }, on_failure: "continue" }],
  },
  {
    id: "bt-007", name: "Re-Engagement Campaign (60-day inactive)",
    description: "Reconnect with patients who haven't visited in 60 days",
    category: "engagement", trigger_event: "patient.created", is_featured: false,
    conditions: [],
    actions: [{ action_type: "send_sms", params: { message: "Hi {patient_name}, we miss you at {clinic_name}! Book now for a complimentary skin consultation. Reply BOOK." }, on_failure: "continue" }],
  },
  {
    id: "bt-008", name: "Appointment Reminder — 24h",
    description: "SMS reminder with reschedule info 24 hours before appointment",
    category: "engagement", trigger_event: "appointment.booked", is_featured: true,
    conditions: [],
    actions: [{ action_type: "send_sms", params: { message: "Reminder: You have an appointment at {clinic_name} tomorrow. To reschedule, reply CHANGE. See you soon!" }, on_failure: "continue" }],
  },
  {
    id: "bt-009", name: "Injectable Refill Reminder (3 months)",
    description: "WhatsApp top-up reminder 3 months after injectable treatment",
    category: "engagement", trigger_event: "treatment.completed", is_featured: true,
    conditions: [{ field_path: "treatment_name", operator: "contains", value: { v: "injectable" }, logic_op: "AND" }],
    actions: [{ action_type: "send_whatsapp", params: { message: "Hi {patient_name}! It's been 3 months since your injectable treatment. Most patients benefit from a top-up now. Ready to book? Reply YES — {clinic_name}" }, on_failure: "continue" }],
  },
  {
    id: "bt-010", name: "Package Completion Celebration",
    description: "Congratulate patient on completing package + encourage re-booking",
    category: "engagement", trigger_event: "credit.expiring", is_featured: false,
    conditions: [],
    actions: [
      { action_type: "send_whatsapp", params: { message: "Congratulations {patient_name}! You've completed your package at {clinic_name}. Ready to continue your journey? Reply REBOOK." }, on_failure: "continue" },
      { action_type: "nudge_staff", params: { role: "front_desk", message: "Patient {patient_name} completed their package. Please follow up for re-booking." }, on_failure: "continue" },
    ],
  },
  {
    id: "bt-011", name: "New Lead → Counsellor Instant Alert",
    description: "Instantly alert counsellor when a new lead arrives",
    category: "lead_management", trigger_event: "lead.created", is_featured: true,
    conditions: [],
    actions: [{ action_type: "nudge_staff", params: { role: "counsellor", message: "New lead: {patient_name} from {lead_source}. Please call within 2 hours." }, on_failure: "dlq_notify" }],
  },
  {
    id: "bt-012", name: "High-Value Lead Nurture (Meta/Google)",
    description: "Instant WhatsApp response for paid ad leads + counsellor alert",
    category: "lead_management", trigger_event: "lead.created", is_featured: true,
    conditions: [{ field_path: "lead.source", operator: "in", value: { v: "meta_ads,google_ads" }, logic_op: "AND" }],
    actions: [
      { action_type: "send_whatsapp", params: { message: "Hi {patient_name}! Thank you for your interest in {clinic_name}. Our specialist would love to connect — can we schedule a free consultation this week?" }, on_failure: "continue" },
      { action_type: "nudge_staff", params: { role: "counsellor", message: "High-value lead from paid ads: {patient_name}. Respond immediately." }, on_failure: "dlq_notify" },
    ],
  },
  {
    id: "bt-013", name: "Lead Inactivity Warning (3-day)",
    description: "Alert front desk if lead not contacted in 3 days",
    category: "lead_management", trigger_event: "lead.created", is_featured: false,
    conditions: [],
    actions: [{ action_type: "nudge_staff", params: { role: "front_desk", message: "Lead {patient_name} has not been contacted in 3 days. Please follow up immediately." }, on_failure: "continue" }],
  },
  {
    id: "bt-014", name: "Consultation Booked → Pre-Visit Prep",
    description: "Send pre-visit checklist when consultation is booked",
    category: "lead_management", trigger_event: "appointment.booked", is_featured: true,
    conditions: [],
    actions: [{ action_type: "send_whatsapp", params: { message: "Hi {patient_name}! Your consultation at {clinic_name} is confirmed. Please come with a clean face, stay hydrated, and bring a medication list. See you soon!" }, on_failure: "continue" }],
  },
  {
    id: "bt-015", name: "Lost Lead Re-engagement (30 days)",
    description: "Re-engage lost leads with an offer after 30 days",
    category: "lead_management", trigger_event: "lead.created", is_featured: false,
    conditions: [{ field_path: "lead.status", operator: "eq", value: { v: "lost" }, logic_op: "AND" }],
    actions: [{ action_type: "send_sms", params: { message: "Hi {patient_name}, we'd love another chance to help at {clinic_name}. Free consultation this month. Reply YES!" }, on_failure: "continue" }],
  },
  {
    id: "bt-016", name: "Invoice Overdue Admin Alert",
    description: "Alert admin + gentle reminder to patient for overdue invoice",
    category: "billing", trigger_event: "invoice.overdue", is_featured: true,
    conditions: [],
    actions: [
      { action_type: "nudge_staff", params: { role: "clinic_admin", message: "Invoice overdue for {patient_name}. Please follow up." }, on_failure: "dlq_notify" },
      { action_type: "send_email", params: { subject: "Gentle Payment Reminder — {clinic_name}", body: "Dear {patient_name},\n\nThis is a gentle reminder that your invoice from {clinic_name} is now due. Please contact us to arrange payment.\n\nWarm regards,\n{clinic_name}" }, on_failure: "continue" },
    ],
  },
  {
    id: "bt-017", name: "Membership Expiring Soon (7 days)",
    description: "Prompt member to renew 7 days before expiry",
    category: "billing", trigger_event: "membership.expiring", is_featured: true,
    conditions: [],
    actions: [
      { action_type: "send_whatsapp", params: { message: "Hi {patient_name}! Your membership at {clinic_name} expires in 7 days. Renew now to keep your benefits. Reply RENEW!" }, on_failure: "continue" },
      { action_type: "nudge_staff", params: { role: "front_desk", message: "Membership renewal due: {patient_name}. Expires in 7 days." }, on_failure: "continue" },
    ],
  },
  {
    id: "bt-018", name: "Credit Package Near Expiry (14 days)",
    description: "SMS reminder when credit package has 14 days remaining",
    category: "billing", trigger_event: "credit.expiring", is_featured: false,
    conditions: [],
    actions: [{ action_type: "send_sms", params: { message: "Hi {patient_name}, your credit package at {clinic_name} expires in 14 days. Book now! Reply BOOK." }, on_failure: "continue" }],
  },
  {
    id: "bt-019", name: "High Invoice Approval Required",
    description: "Flag large invoices (>₹50,000) to clinic admin for review",
    category: "billing", trigger_event: "invoice.paid", is_featured: false,
    conditions: [{ field_path: "invoice.amount", operator: "gt", value: { v: "50000" }, logic_op: "AND" }],
    actions: [{ action_type: "nudge_staff", params: { role: "clinic_admin", message: "High-value invoice paid by {patient_name}. Please review for compliance." }, on_failure: "dlq_notify" }],
  },
  {
    id: "bt-020", name: "Wallet Top-Up Thank You",
    description: "Send thank you WhatsApp with balance after wallet top-up",
    category: "billing", trigger_event: "invoice.paid", is_featured: false,
    conditions: [],
    actions: [{ action_type: "send_whatsapp", params: { message: "Thank you {patient_name}! Your payment has been received at {clinic_name}. Enjoy your treatments!" }, on_failure: "continue" }],
  },
  {
    id: "bt-021", name: "Appointment No-Show Follow-Up",
    description: "Alert front desk + SMS patient when they no-show",
    category: "staff_alert", trigger_event: "appointment.noshow", is_featured: true,
    conditions: [],
    actions: [
      { action_type: "nudge_staff", params: { role: "front_desk", message: "No-show: {patient_name} missed their appointment. Please call and reschedule." }, on_failure: "dlq_notify" },
      { action_type: "send_sms", params: { message: "Hi {patient_name}, we missed you at {clinic_name} today! Please call us to reschedule." }, on_failure: "continue" },
    ],
  },
  {
    id: "bt-022", name: "Low Stock Critical Alert",
    description: "Alert clinic admin when product drops below threshold",
    category: "staff_alert", trigger_event: "inventory.low_stock", is_featured: true,
    conditions: [{ field_path: "product.quantity", operator: "lt", value: { v: "10" }, logic_op: "AND" }],
    actions: [{ action_type: "nudge_staff", params: { role: "clinic_admin", message: "Low stock alert: {product_name} has only {quantity} units. Please reorder immediately." }, on_failure: "dlq_notify" }],
  },
  {
    id: "bt-023", name: "VIP Patient Appointment → Doctor Alert",
    description: "Pre-alert doctor when VIP membership patient books",
    category: "staff_alert", trigger_event: "appointment.booked", is_featured: false,
    conditions: [{ field_path: "patient.membership", operator: "eq", value: { v: "VIP" }, logic_op: "AND" }],
    actions: [{ action_type: "nudge_staff", params: { role: "doctor", message: "VIP patient {patient_name} has booked. Please review their history and prepare a personalised consultation." }, on_failure: "continue" }],
  },
  {
    id: "bt-024", name: "New Patient First Visit Welcome Protocol",
    description: "Welcome new patients + alert front desk with intake form",
    category: "staff_alert", trigger_event: "patient.created", is_featured: true,
    conditions: [],
    actions: [
      { action_type: "nudge_staff", params: { role: "front_desk", message: "New patient: {patient_name}. Please ensure intake form is completed before first visit." }, on_failure: "continue" },
      { action_type: "send_whatsapp", params: { message: "Welcome to {clinic_name}, {patient_name}! Please complete your intake form before your first visit. See you soon!" }, on_failure: "continue" },
    ],
  },
  {
    id: "bt-025", name: "Post-Consultation No-Booking Alert",
    description: "Alert counsellor when patient leaves without rebooking",
    category: "staff_alert", trigger_event: "appointment.completed", is_featured: false,
    conditions: [{ field_path: "no_booking_after", operator: "eq", value: { v: "true" }, logic_op: "AND" }],
    actions: [{ action_type: "nudge_staff", params: { role: "counsellor", message: "{patient_name} did not rebook after consultation. Please follow up within 24h." }, on_failure: "continue" }],
  },

  // ── Inventory (bt-026–030) ─────────────────────────────────────────────────
  {
    id: "bt-026", name: "Critical Stock Alert",
    description: "Alert clinic admin and WhatsApp notify when any product reaches critical low stock",
    category: "inventory", trigger_event: "inventory.low_stock", is_featured: true,
    conditions: [{ field_path: "product.quantity", operator: "lt", value: { v: "5" }, logic_op: "AND" }],
    actions: [
      { action_type: "nudge_staff", params: { role: "clinic_admin", message: "CRITICAL: {product_name} has only {quantity} units left. Immediate reorder required!" }, on_failure: "dlq_notify" },
      { action_type: "send_whatsapp", params: { message: "⚠️ Critical stock alert at {clinic_name}: {product_name} is almost out. Reorder now to avoid treatment delays." }, on_failure: "continue" },
    ],
  },
  {
    id: "bt-027", name: "Product Expiry Warning (30d)",
    description: "Alert clinic admin 30 days before product batch expires",
    category: "inventory", trigger_event: "inventory.low_stock", is_featured: false,
    conditions: [{ field_path: "product.days_to_expiry", operator: "lt", value: { v: "30" }, logic_op: "AND" }],
    actions: [
      { action_type: "nudge_staff", params: { role: "clinic_admin", message: "Expiry warning: {product_name} expires in less than 30 days. Please plan usage or arrange return." }, on_failure: "continue" },
    ],
  },
  {
    id: "bt-028", name: "Auto-Reorder Task",
    description: "Create a reorder task assigned to clinic admin when stock drops below threshold",
    category: "inventory", trigger_event: "inventory.low_stock", is_featured: false,
    conditions: [{ field_path: "product.quantity", operator: "lt", value: { v: "10" }, logic_op: "AND" }],
    actions: [
      { action_type: "create_task", params: { title: "Reorder low stock items", assigned_role: "clinic_admin", priority: "high", due_days: 2 }, on_failure: "continue" },
    ],
  },
  {
    id: "bt-029", name: "Dead Stock Alert",
    description: "Notify admin when a product has had no usage for 60+ days",
    category: "inventory", trigger_event: "inventory.low_stock", is_featured: false,
    conditions: [{ field_path: "product.days_since_last_use", operator: "gt", value: { v: "60" }, logic_op: "AND" }],
    actions: [
      { action_type: "nudge_staff", params: { role: "clinic_admin", message: "Dead stock alert: {product_name} has not been used in 60+ days. Consider promoting or returning it." }, on_failure: "continue" },
    ],
  },
  {
    id: "bt-030", name: "Stock Replenished — Notify Team",
    description: "Notify front desk when a previously low-stock item is replenished",
    category: "inventory", trigger_event: "inventory.low_stock", is_featured: false,
    conditions: [{ field_path: "product.quantity", operator: "gt", value: { v: "20" }, logic_op: "AND" }],
    actions: [
      { action_type: "nudge_staff", params: { role: "front_desk", message: "Stock update: {product_name} has been replenished. Available for bookings again." }, on_failure: "continue" },
    ],
  },

  // ── Membership (bt-031–035) ────────────────────────────────────────────────
  {
    id: "bt-031", name: "New Membership Welcome",
    description: "Welcome new member with WhatsApp + alert front desk to deliver membership kit",
    category: "membership", trigger_event: "membership.assigned", is_featured: true,
    conditions: [],
    actions: [
      { action_type: "send_whatsapp", params: { message: "Welcome to the {clinic_name} family, {patient_name}! 🎉 Your membership is now active. Enjoy priority booking, exclusive discounts, and member-only events. We're thrilled to have you!" }, on_failure: "continue" },
      { action_type: "nudge_staff", params: { role: "front_desk", message: "New member: {patient_name}. Please prepare the membership welcome kit and update their profile." }, on_failure: "continue" },
    ],
  },
  {
    id: "bt-032", name: "Membership Tier Upgrade Congrats",
    description: "Congratulate patient when they upgrade to a higher membership tier",
    category: "membership", trigger_event: "membership.assigned", is_featured: false,
    conditions: [{ field_path: "membership.is_upgrade", operator: "eq", value: { v: "true" }, logic_op: "AND" }],
    actions: [
      { action_type: "send_whatsapp", params: { message: "Congratulations {patient_name}! 🌟 You've been upgraded to our premium membership tier at {clinic_name}. Your enhanced benefits are now active. Thank you for your loyalty!" }, on_failure: "continue" },
    ],
  },
  {
    id: "bt-033", name: "Membership Renewal Due (14d)",
    description: "Send WhatsApp + email renewal reminder 14 days before membership expires",
    category: "membership", trigger_event: "membership.expiring", is_featured: true,
    conditions: [{ field_path: "membership.days_until_expiry", operator: "lt", value: { v: "14" }, logic_op: "AND" }],
    actions: [
      { action_type: "send_whatsapp", params: { message: "Hi {patient_name}! Your {clinic_name} membership expires in 14 days. Renew now to keep your benefits uninterrupted. Reply RENEW or visit us. 💫" }, on_failure: "continue" },
      { action_type: "send_email", params: { subject: "Your Membership Renewal is Due — {clinic_name}", body: "Dear {patient_name},\n\nYour membership at {clinic_name} expires in 14 days. Renew early to maintain continuous access to priority booking and member discounts.\n\nWarm regards,\n{clinic_name}" }, on_failure: "continue" },
    ],
  },
  {
    id: "bt-034", name: "Membership Paused Confirmation",
    description: "Confirm membership pause with WhatsApp and advise on resume process",
    category: "membership", trigger_event: "membership.expiring", is_featured: false,
    conditions: [{ field_path: "membership.status", operator: "eq", value: { v: "paused" }, logic_op: "AND" }],
    actions: [
      { action_type: "send_whatsapp", params: { message: "Hi {patient_name}, your membership at {clinic_name} has been paused as requested. Your benefits will resume once reactivated. Contact us anytime to restart. 🙏" }, on_failure: "continue" },
    ],
  },
  {
    id: "bt-035", name: "Membership Anniversary Offer",
    description: "Send a loyalty reward WhatsApp on the member's 1-year anniversary",
    category: "membership", trigger_event: "membership.assigned", is_featured: false,
    conditions: [{ field_path: "membership.years_active", operator: "eq", value: { v: "1" }, logic_op: "AND" }],
    actions: [
      { action_type: "send_whatsapp", params: { message: "Happy 1-year anniversary {patient_name}! 🎂 To celebrate your loyalty at {clinic_name}, enjoy a complimentary upgrade on your next treatment. You're the reason we shine!" }, on_failure: "continue" },
    ],
  },

  // ── Counselling (bt-036–040) ───────────────────────────────────────────────
  {
    id: "bt-036", name: "Session Booked — Counsellor Alert",
    description: "Instantly alert counsellor when a counselling appointment is booked",
    category: "counselling", trigger_event: "appointment.booked", is_featured: false,
    conditions: [{ field_path: "appointment.type", operator: "eq", value: { v: "counselling" }, logic_op: "AND" }],
    actions: [
      { action_type: "nudge_staff", params: { role: "counsellor", message: "Counselling session booked: {patient_name} on {appointment_date}. Please review their history and prepare treatment proposals." }, on_failure: "dlq_notify" },
    ],
  },
  {
    id: "bt-037", name: "Post-Session WhatsApp (48h)",
    description: "Send follow-up WhatsApp 48h after counselling session with summary and next steps",
    category: "counselling", trigger_event: "appointment.completed", is_featured: false,
    conditions: [{ field_path: "appointment.type", operator: "eq", value: { v: "counselling" }, logic_op: "AND" }],
    actions: [
      { action_type: "send_whatsapp", params: { message: "Hi {patient_name}, thank you for your counselling session at {clinic_name}! 💙 We hope you found it helpful. Your personalised treatment plan has been prepared. Reply PLAN to receive it or call us to book your first session." }, on_failure: "continue" },
    ],
  },
  {
    id: "bt-038", name: "Non-Converted Lead (7d)",
    description: "Alert counsellor + send SMS when a lead hasn't converted in 7 days",
    category: "counselling", trigger_event: "lead.created", is_featured: false,
    conditions: [{ field_path: "lead.days_since_created", operator: "gt", value: { v: "7" }, logic_op: "AND" }],
    actions: [
      { action_type: "nudge_staff", params: { role: "counsellor", message: "Lead {patient_name} has not converted in 7 days. Please reach out with a tailored offer." }, on_failure: "continue" },
      { action_type: "send_sms", params: { message: "Hi {patient_name}, still thinking about it? Book a free consultation at {clinic_name} — our specialists are ready for you. Reply YES!" }, on_failure: "continue" },
    ],
  },
  {
    id: "bt-039", name: "Partial Conversion Follow-Up",
    description: "Follow up on remaining treatments after partial counselling conversion",
    category: "counselling", trigger_event: "appointment.completed", is_featured: false,
    conditions: [{ field_path: "counselling.conversion_status", operator: "eq", value: { v: "partial" }, logic_op: "AND" }],
    actions: [
      { action_type: "send_whatsapp", params: { message: "Hi {patient_name}! 👋 You've started your treatment journey at {clinic_name}. We noticed you still have some recommended treatments pending. Book them today for best results! Reply BOOK." }, on_failure: "continue" },
    ],
  },
  {
    id: "bt-040", name: "Conversion Milestone Alert",
    description: "Alert doctor + congratulate patient when a counselled treatment invoice is paid",
    category: "counselling", trigger_event: "invoice.paid", is_featured: false,
    conditions: [{ field_path: "invoice.source", operator: "eq", value: { v: "counselling" }, logic_op: "AND" }],
    actions: [
      { action_type: "nudge_staff", params: { role: "doctor", message: "Conversion milestone: {patient_name} paid for counselled treatment. Please schedule their first session." }, on_failure: "continue" },
      { action_type: "send_whatsapp", params: { message: "Wonderful news {patient_name}! 🌟 Your treatment journey at {clinic_name} officially begins. Our team will contact you shortly to schedule your first session." }, on_failure: "continue" },
    ],
  },

  // ── Staff HR (bt-041–045) ──────────────────────────────────────────────────
  {
    id: "bt-041", name: "Leave Request Received",
    description: "Instantly alert clinic admin when a staff member submits a leave request",
    category: "staff_hr", trigger_event: "staff.leave_requested", is_featured: true,
    conditions: [],
    actions: [
      { action_type: "nudge_staff", params: { role: "clinic_admin", message: "Leave request: {staff_name} has requested leave from {from_date} to {to_date} ({leave_type}). Please review and approve." }, on_failure: "dlq_notify" },
    ],
  },
  {
    id: "bt-042", name: "Leave Approved — Cover Arrangement",
    description: "Alert front desk to arrange cover when a staff leave is approved",
    category: "staff_hr", trigger_event: "staff.leave_approved", is_featured: false,
    conditions: [],
    actions: [
      { action_type: "nudge_staff", params: { role: "front_desk", message: "Leave approved: {staff_name} will be absent from {from_date} to {to_date}. Please arrange coverage and update the appointment schedule." }, on_failure: "continue" },
    ],
  },
  {
    id: "bt-043", name: "Staff Late Arrival Alert",
    description: "Alert clinic admin when a staff member clocks in 30+ minutes late",
    category: "staff_hr", trigger_event: "appointment.booked", is_featured: false,
    conditions: [{ field_path: "attendance.minutes_late", operator: "gt", value: { v: "30" }, logic_op: "AND" }],
    actions: [
      { action_type: "nudge_staff", params: { role: "clinic_admin", message: "Late arrival: {staff_name} clocked in {minutes_late} minutes late today. Please address if this is recurring." }, on_failure: "continue" },
    ],
  },
  {
    id: "bt-044", name: "Absent Without Leave Alert",
    description: "Alert clinic admin and create task when staff is absent without approved leave",
    category: "staff_hr", trigger_event: "appointment.booked", is_featured: false,
    conditions: [{ field_path: "attendance.status", operator: "eq", value: { v: "absent_no_leave" }, logic_op: "AND" }],
    actions: [
      { action_type: "nudge_staff", params: { role: "clinic_admin", message: "AWOL alert: {staff_name} is absent today without approved leave. Patients may be affected — please take action." }, on_failure: "dlq_notify" },
      { action_type: "create_task", params: { title: "Follow up on unexcused absence", assigned_role: "clinic_admin", priority: "high", due_days: 1 }, on_failure: "continue" },
    ],
  },
  {
    id: "bt-045", name: "Payroll Run Ready for Approval",
    description: "Alert clinic admin when a payroll run is generated and awaiting approval",
    category: "staff_hr", trigger_event: "payroll.run_approved", is_featured: false,
    conditions: [{ field_path: "payroll.status", operator: "eq", value: { v: "draft" }, logic_op: "AND" }],
    actions: [
      { action_type: "nudge_staff", params: { role: "clinic_admin", message: "Payroll run for {period_start}–{period_end} is ready for your review and approval. Total: ₹{total_net}." }, on_failure: "dlq_notify" },
    ],
  },

  // ── Intake & Forms (bt-046–050) ────────────────────────────────────────────
  {
    id: "bt-046", name: "Intake Form Submitted",
    description: "Alert front desk and doctor when a patient submits their intake form",
    category: "intake", trigger_event: "form.submitted", is_featured: true,
    conditions: [{ field_path: "form.type", operator: "eq", value: { v: "intake" }, logic_op: "AND" }],
    actions: [
      { action_type: "nudge_staff", params: { role: "front_desk", message: "Intake form submitted by {patient_name}. Please review and prepare for their appointment." }, on_failure: "continue" },
      { action_type: "nudge_staff", params: { role: "doctor", message: "Intake form ready: {patient_name} has submitted their pre-consultation intake. Review before their appointment." }, on_failure: "continue" },
    ],
  },
  {
    id: "bt-047", name: "Consent Form Signed",
    description: "Notify doctor when a patient signs their consent form before treatment",
    category: "intake", trigger_event: "form.submitted", is_featured: false,
    conditions: [{ field_path: "form.type", operator: "eq", value: { v: "consent" }, logic_op: "AND" }],
    actions: [
      { action_type: "nudge_staff", params: { role: "doctor", message: "Consent form signed by {patient_name}. You are cleared to proceed with the treatment." }, on_failure: "continue" },
    ],
  },
  {
    id: "bt-048", name: "Intake Incomplete Reminder (24h)",
    description: "Send WhatsApp with portal link if patient hasn't completed intake 24h after registration",
    category: "intake", trigger_event: "patient.created", is_featured: false,
    conditions: [{ field_path: "intake.completed", operator: "eq", value: { v: "false" }, logic_op: "AND" }],
    actions: [
      { action_type: "send_whatsapp", params: { message: "Hi {patient_name}! We noticed your intake form at {clinic_name} is incomplete. Please complete it before your visit: {portal_link} — it only takes 2 minutes! 📋" }, on_failure: "continue" },
    ],
  },
  {
    id: "bt-049", name: "New Patient Digital Welcome",
    description: "Send welcome WhatsApp with portal link + alert front desk for new patient setup",
    category: "intake", trigger_event: "patient.created", is_featured: true,
    conditions: [],
    actions: [
      { action_type: "send_whatsapp", params: { message: "Welcome to {clinic_name}, {patient_name}! 🌿 We're so excited to have you. Complete your digital intake form before your visit: {portal_link}. Our team will reach out shortly." }, on_failure: "continue" },
      { action_type: "nudge_staff", params: { role: "front_desk", message: "New patient registered: {patient_name}. Please call to confirm their first appointment and ensure intake form is sent." }, on_failure: "continue" },
    ],
  },
  {
    id: "bt-050", name: "Post-Intake Counselling Prompt",
    description: "Prompt counsellor to reach out after patient submits intake with high-interest treatments",
    category: "intake", trigger_event: "form.submitted", is_featured: false,
    conditions: [{ field_path: "form.type", operator: "eq", value: { v: "intake" }, logic_op: "AND" }],
    actions: [
      { action_type: "nudge_staff", params: { role: "counsellor", message: "New intake from {patient_name}. They've indicated interest in {primary_concern}. Please schedule a counselling session." }, on_failure: "continue" },
    ],
  },
];

// ── Template preview ──────────────────────────────────────────────────────────

/** H-10 fix: strip any HTML tags before the template is used in external messages */
function sanitizeTemplate(t: string): string {
  return t.replace(/<[^>]*>/g, "");
}

function buildPreview(template: string, form: RuleForm): string {
  return sanitizeTemplate(template)
    .replace(/\{patient_name\}/g, "Sarah Mitchell")
    .replace(/\{treatment_name\}/g, form.condition_treatment || "Hydrafacial")
    .replace(/\{clinic_name\}/g, "Aesthetica Clinic")
    .replace(/\{doctor_name\}/g, "Dr. Reyes")
    .replace(/\{days\}/g, form.condition_days || "3")
    .replace(/\{hours\}/g, form.condition_hours || "2")
    .replace(/\{source\}/g, form.condition_source || "Instagram")
    .replace(/\{product_name\}/g, form.condition_product || "Vitamin C Serum")
    .replace(/\{next_appointment\}/g, "March 5th at 2:00 PM");
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function RulesPage() {
  const { profile } = useClinic();
  const role         = profile?.role ?? null;
  const isSuperAdmin = role === "superadmin";
  const isAdmin      = role === "superadmin" || role === "admin" || role === "clinic_admin" || role === "chain_admin";

  const [rules,            setRules]           = useState<AutomationRule[]>([]);
  const [triggers,         setTriggers]        = useState<AutomationTrigger[]>([]);
  const [clinics,          setClinics]         = useState<Clinic[]>([]);
  const [customNudgeRoles, setCustomNudgeRoles]= useState<CustomNudgeRole[]>([]);
  const [loading,          setLoading]         = useState(true);

  // Rule drawer
  const [ruleDrawer,  setRuleDrawer]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [ruleForm,    setRuleForm]    = useState<RuleForm>(EMPTY_RULE_FORM);
  const [previewMode, setPreviewMode] = useState(false);

  // Trigger manager drawer (superadmin only)
  const [triggerDrawer, setTriggerDrawer] = useState(false);
  const [triggerForm,   setTriggerForm]   = useState<TriggerForm>(EMPTY_TRIGGER_FORM);
  const [savingTrigger, setSavingTrigger] = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // ── Advanced Rules tab state ────────────────────────────────────────────────
  const [rulesTab, setRulesTab] = useState<"quick" | "workflows" | "templates" | "analytics" | "dlq">("quick");
  const [advRules, setAdvRules] = useState<Array<{ id: string; name: string; category: string; trigger_event: string; priority: number; run_mode: string; is_active: boolean; workflow_status: string; description: string | null; created_at: string }>>([]);
  const [advLoading, setAdvLoading] = useState(false);
  const [advDrawer, setAdvDrawer] = useState(false);
  const [advForm, setAdvForm] = useState({ name: "", category: "automation", trigger_event: "", priority: "10", run_mode: "async" });
  const [advSaving, setAdvSaving] = useState(false);

  // Workflow designer state
  const [advStep,           setAdvStep]          = useState<1|2|3>(1);
  const [advConditions,     setAdvConditions]     = useState<ConditionRow[]>([]);
  const [advActions,        setAdvActions]        = useState<ActionRow[]>([]);
  const [advWorkflowStatus, setAdvWorkflowStatus] = useState<"draft"|"live">("live");
  const [advDescription,    setAdvDescription]    = useState("");

  // Expandable rule detail
  const [expandedRuleId,   setExpandedRuleId]  = useState<string|null>(null);
  const [ruleDetails,      setRuleDetails]     = useState<Record<string, AdvancedRuleFull>>({});
  const [detailLoading,    setDetailLoading]   = useState<string|null>(null);

  // Branch overrides (superadmin)
  const [overridesOpen,    setOverridesOpen]   = useState<string|null>(null);
  const [overrides,        setOverrides]       = useState<ClinicOverride[]>([]);
  const [overridesLoading, setOverridesLoading]= useState(false);

  // DLQ
  const [dlqItems,   setDlqItems]   = useState<DLQItem[]>([]);
  const [dlqLoading, setDlqLoading] = useState(false);

  // Analytics
  const [analyticsRuleId, setAnalyticsRuleId] = useState<string>("");
  const [execLogs,        setExecLogs]        = useState<Array<{id:string; result:string; executed_at:string; duration_ms:number|null}>>([]);
  const [actionLogs,      setActionLogs]      = useState<Array<{action_index:number; result:string; action_type:string}>>([]);
  const [analyticsLoading,setAnalyticsLoading]= useState(false);

  // Template category filter
  const [tmplCategory, setTmplCategory] = useState<string>("all");

  // ── Fetch data ─────────────────────────────────────────────────────────────

  const fetchRules = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("automation_rules")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setRules(data as AutomationRule[]);
    setLoading(false);
  }, []);

  const fetchTriggers = useCallback(async () => {
    const { data } = await supabase
      .from("automation_triggers")
      .select("*")
      .order("is_system", { ascending: false });
    if (data) setTriggers(data as AutomationTrigger[]);
  }, []);

  const fetchClinics = useCallback(async () => {
    const { data } = await supabase.from("clinics").select("id, name, chain_id").order("name");
    if (data) setClinics(data as Clinic[]);
  }, []);

  const fetchCustomNudgeRoles = useCallback(async () => {
    const { data } = await supabase.from("custom_nudge_roles").select("*").order("created_at");
    if (data) setCustomNudgeRoles(data as CustomNudgeRole[]);
  }, []);

  useEffect(() => {
    fetchRules();
    fetchTriggers();
    fetchClinics();
    fetchCustomNudgeRoles();
  }, [fetchRules, fetchTriggers, fetchClinics, fetchCustomNudgeRoles]);

  const fetchAdvancedRules = useCallback(async () => {
    const { profile: p } = { profile };
    if (!p?.clinic_id) return;
    setAdvLoading(true);
    const { data } = await supabase.from("rule_definitions").select("*").eq("clinic_id", p.clinic_id).order("priority");
    setAdvRules(data || []);
    setAdvLoading(false);
  }, [profile]);

  const fetchDLQ = useCallback(async () => {
    if (!profile?.clinic_id) return;
    setDlqLoading(true);
    const { data } = await supabase
      .from("workflow_dlq")
      .select("*, rule_definitions(name)")
      .eq("clinic_id", profile.clinic_id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setDlqItems((data || []) as DLQItem[]);
    setDlqLoading(false);
  }, [profile]);

  const fetchAnalytics = useCallback(async (ruleId: string) => {
    if (!ruleId) return;
    setAnalyticsLoading(true);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: eLogs }, { data: aLogs }] = await Promise.all([
      supabase.from("rule_execution_log").select("id,result,executed_at,duration_ms")
        .eq("rule_id", ruleId).gte("executed_at", thirtyDaysAgo)
        .order("executed_at", { ascending: false }),
      supabase.from("workflow_action_log").select("action_index,result,action_type")
        .eq("rule_id", ruleId).gte("executed_at", thirtyDaysAgo),
    ]);
    setExecLogs((eLogs || []) as typeof execLogs);
    setActionLogs((aLogs || []) as typeof actionLogs);
    setAnalyticsLoading(false);
  }, []);

  const loadRuleDetail = useCallback(async (ruleId: string) => {
    if (ruleDetails[ruleId]) return;
    setDetailLoading(ruleId);
    const [{ data: conds }, { data: acts }] = await Promise.all([
      supabase.from("rule_conditions").select("*").eq("rule_id", ruleId).order("sort_order"),
      supabase.from("rule_actions").select("*").eq("rule_id", ruleId).order("sort_order"),
    ]);
    setRuleDetails(prev => ({ ...prev, [ruleId]: { id: ruleId, conditions: conds || [], actions: acts || [] } }));
    setDetailLoading(null);
  }, [ruleDetails]);

  const loadOverrides = useCallback(async (ruleId: string) => {
    setOverridesLoading(true);
    const { data } = await supabase.from("workflow_clinic_overrides")
      .select("*").eq("rule_id", ruleId);
    setOverrides((data || []) as ClinicOverride[]);
    setOverridesLoading(false);
  }, []);

  const toggleOverride = async (ruleId: string, clinicId: string, currentEnabled: boolean) => {
    await supabase.from("workflow_clinic_overrides").upsert(
      { rule_id: ruleId, clinic_id: clinicId, is_enabled: !currentEnabled, updated_by: profile?.id },
      { onConflict: "rule_id,clinic_id" }
    );
    loadOverrides(ruleId);
  };

  useEffect(() => {
    if (rulesTab === "workflows") fetchAdvancedRules();
    if (rulesTab === "dlq") fetchDLQ();
  }, [rulesTab, fetchAdvancedRules, fetchDLQ]);

  const saveAdvancedRule = async (status: "draft"|"live") => {
    if (!profile?.clinic_id || !advForm.name || !advForm.trigger_event) return;
    setAdvSaving(true);
    const { data: rule, error } = await supabase.from("rule_definitions").insert({
      clinic_id: profile.clinic_id,
      name: advForm.name,
      description: advDescription || null,
      category: advForm.category,
      trigger_event: advForm.trigger_event,
      priority: parseInt(advForm.priority) || 10,
      run_mode: advForm.run_mode,
      workflow_status: status,
      is_active: status === "live",
      created_by: profile.id,
    }).select("id").single();

    if (!error && rule) {
      if (advConditions.length > 0) {
        await supabase.from("rule_conditions").insert(
          advConditions.map((c, i) => ({
            rule_id: rule.id,
            field_path: c.field_path,
            operator: c.operator,
            value: { v: c.value },
            logic_op: c.logic_op,
            sort_order: i,
          }))
        );
      }
      if (advActions.length > 0) {
        await supabase.from("rule_actions").insert(
          advActions.map((a, i) => ({
            rule_id: rule.id,
            action_type: a.action_type,
            params: a.params,
            on_failure: a.on_failure,
            sort_order: i,
          }))
        );
      }
      toast.success(status === "draft" ? "Saved as draft." : "Workflow published live.");
      setAdvDrawer(false);
      setAdvStep(1);
      setAdvConditions([]);
      setAdvActions([]);
      setAdvDescription("");
      setAdvWorkflowStatus("live");
      setAdvForm({ name: "", category: "automation", trigger_event: "", priority: "10", run_mode: "async" });
      fetchAdvancedRules();
    } else if (error) {
      toast.error(error.message);
    }
    setAdvSaving(false);
  };

  const useBuiltinTemplate = async (tmpl: BuiltinTemplate) => {
    if (!profile?.clinic_id) return;
    const { data: rule, error } = await supabase.from("rule_definitions").insert({
      clinic_id: profile.clinic_id,
      name: tmpl.name,
      description: tmpl.description,
      category: tmpl.category,
      trigger_event: tmpl.trigger_event,
      priority: 10,
      run_mode: "async",
      workflow_status: "live",
      is_active: true,
      created_by: profile.id,
    }).select("id").single();

    if (!error && rule) {
      if (tmpl.conditions.length > 0) {
        await supabase.from("rule_conditions").insert(
          tmpl.conditions.map((c, i) => ({ rule_id: rule.id, ...c, sort_order: i }))
        );
      }
      if (tmpl.actions.length > 0) {
        await supabase.from("rule_actions").insert(
          tmpl.actions.map((a, i) => ({ rule_id: rule.id, ...a, sort_order: i }))
        );
      }
      setRulesTab("workflows");
      fetchAdvancedRules();
      toast.success(`"${tmpl.name}" added as a live workflow.`);
    } else if (error) {
      toast.error(error.message);
    }
  };

  const saveRuleAsTemplate = async (ruleId: string, ruleName: string) => {
    const detail = ruleDetails[ruleId];
    if (!detail) { toast.error("Load rule details first"); return; }
    const { error } = await supabase.from("rule_templates").insert({
      name: ruleName,
      description: "",
      category: "automation",
      trigger_event: advRules.find(r => r.id === ruleId)?.trigger_event || "",
      conditions: detail.conditions,
      actions: detail.actions,
      is_featured: false,
    });
    if (error) toast.error(error.message);
    else toast.success("Saved as template.");
  };

  const promoteToLive = async (ruleId: string) => {
    const { error } = await supabase.from("rule_definitions")
      .update({ workflow_status: "live", is_active: true })
      .eq("id", ruleId);
    if (error) toast.error(error.message);
    else {
      toast.success("Workflow promoted to live.");
      fetchAdvancedRules();
    }
  };

  // ── Rule CRUD ──────────────────────────────────────────────────────────────

  function openNewRule() {
    setRuleForm(EMPTY_RULE_FORM);
    setPreviewMode(false);
    setRuleDrawer(true);
  }

  function openEditRule(rule: AutomationRule) {
    setRuleForm({
      id:                  rule.id,
      name:                rule.name,
      trigger_key:         rule.trigger_key,
      condition_treatment: rule.condition_treatment ?? "",
      condition_days:      rule.condition_days?.toString() ?? "3",
      condition_product:   rule.condition_product ?? "",
      condition_quantity:  rule.condition_quantity?.toString() ?? "5",
      condition_source:    rule.condition_source ?? "",
      condition_hours:     rule.condition_hours?.toString() ?? "2",
      action:              rule.action,
      nudge_target_roles:  rule.nudge_target_roles?.length
                             ? rule.nudge_target_roles
                             : rule.nudge_target_role ? [rule.nudge_target_role] : [],
      message_template:    rule.message_template,
      scope_type:          rule.scope_type,
      clinic_ids:          rule.clinic_ids ?? [],
    });
    setPreviewMode(false);
    setRuleDrawer(true);
  }

  function handleActionChange(action: string) {
    setRuleForm((f) => ({
      ...f,
      action,
      message_template: f.message_template || (DEFAULT_TEMPLATES[action] ?? ""),
    }));
  }

  function handleTriggerChange(key: string) {
    setRuleForm((f) => ({
      ...f,
      trigger_key: key,
      condition_treatment: "",
      condition_days: "3",
      condition_product: "",
      condition_quantity: "5",
      condition_source: "",
      condition_hours: "2",
    }));
  }

  function toggleClinicId(id: string) {
    setRuleForm((f) => ({
      ...f,
      clinic_ids: f.clinic_ids.includes(id)
        ? f.clinic_ids.filter((c) => c !== id)
        : [...f.clinic_ids, id],
    }));
  }

  function toggleNudgeRole(value: string) {
    setRuleForm((f) => {
      if (value === "all") {
        // Toggle "All Staff" — clears individual selections
        return { ...f, nudge_target_roles: f.nudge_target_roles.includes("all") ? [] : ["all"] };
      }
      // Remove "all" if picking individual role
      const without = f.nudge_target_roles.filter((r) => r !== "all");
      return {
        ...f,
        nudge_target_roles: without.includes(value)
          ? without.filter((r) => r !== value)
          : [...without, value],
      };
    });
  }

  // ── Custom nudge role CRUD (superadmin) ────────────────────────────────────

  async function handleAddCustomNudgeRole(label: string) {
    const key = label.trim().toLowerCase().replace(/\s+/g, "_");
    if (!key) return;
    const { error } = await supabase.from("custom_nudge_roles").insert({ key, label: label.trim() });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Staff role "${label.trim()}" added.`);
      fetchCustomNudgeRoles();
    }
  }

  async function handleDeleteCustomNudgeRole(id: string, key: string) {
    // Check if used in any rule
    const inUse = rules.some((r) => r.nudge_target_roles?.includes(key));
    if (inUse) { toast.error("This role is used in existing rules."); return; }
    const { error } = await supabase.from("custom_nudge_roles").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Custom role removed.");
      fetchCustomNudgeRoles();
    }
  }

  async function handleSaveRule() {
    if (!ruleForm.name.trim() || !ruleForm.trigger_key || !ruleForm.action) {
      toast.error("Name, Trigger, and Action are required.");
      return;
    }
    if (ruleForm.scope_type === "clinic" && ruleForm.clinic_ids.length === 0) {
      toast.error("Select at least one clinic for clinic-scoped rules.");
      return;
    }
    setSaving(true);

    const payload: Partial<AutomationRule> & { trigger_key: string } = {
      name:               ruleForm.name.trim(),
      trigger_key:        ruleForm.trigger_key,
      condition_treatment: ruleForm.trigger_key === "after_treatment" ? (ruleForm.condition_treatment || null) : null,
      condition_days:      ruleForm.trigger_key === "after_treatment"  ? (parseInt(ruleForm.condition_days) || null) : null,
      condition_product:   ruleForm.trigger_key === "low_stock"        ? (ruleForm.condition_product || null) : null,
      condition_quantity:  ruleForm.trigger_key === "low_stock"        ? (parseInt(ruleForm.condition_quantity) || null) : null,
      condition_source:    ruleForm.trigger_key === "new_lead"         ? (ruleForm.condition_source || null) : null,
      condition_hours:     ["new_lead", "appointment_noshow", "appointment_reminder"].includes(ruleForm.trigger_key)
                            ? (parseInt(ruleForm.condition_hours) || null) : null,
      action:              ruleForm.action,
      nudge_target_roles:  ruleForm.action === "nudge_staff" ? ruleForm.nudge_target_roles : [],
      nudge_target_role:   ruleForm.action === "nudge_staff" && ruleForm.nudge_target_roles[0]
                             ? ruleForm.nudge_target_roles[0] : null,   // legacy compat
      message_template:    sanitizeTemplate(ruleForm.message_template),
      scope_type:          ruleForm.scope_type,
      clinic_ids:          ruleForm.scope_type === "clinic" ? ruleForm.clinic_ids : [],
      status:              "active",
      // ownership — set to user's clinic for non-superadmins
      clinic_id:           !isSuperAdmin ? (profile?.clinic_id ?? null) : null,
      chain_id:            null,
    };

    let error;
    if (ruleForm.id) {
      ({ error } = await supabase.from("automation_rules").update(payload).eq("id", ruleForm.id));
    } else {
      ({ error } = await supabase.from("automation_rules").insert(payload));
    }

    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(ruleForm.id ? "Rule updated." : "Rule created.");
      setRuleDrawer(false);
      setRuleForm(EMPTY_RULE_FORM);
      fetchRules();
    }
  }

  async function handleToggleStatus(rule: AutomationRule) {
    if (!isAdmin) return;
    const next: Status = rule.status === "active" ? "paused" : "active";
    const { error } = await supabase.from("automation_rules").update({ status: next }).eq("id", rule.id);
    if (error) {
      toast.error(error.message);
    } else {
      setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, status: next } : r));
    }
  }

  async function handleDeleteRule(id: string) {
    const { error } = await supabase.from("automation_rules").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Rule deleted.");
      setRules((prev) => prev.filter((r) => r.id !== id));
    }
  }

  // ── Trigger CRUD (superadmin only) ────────────────────────────────────────

  function openNewTrigger() {
    setTriggerForm(EMPTY_TRIGGER_FORM);
    setTriggerDrawer(true);
  }

  function openEditTrigger(t: AutomationTrigger) {
    setTriggerForm({ id: t.id, key: t.key, label: t.label, description: t.description ?? "", icon: t.icon });
    setTriggerDrawer(true);
  }

  async function handleSaveTrigger() {
    if (!triggerForm.key.trim() || !triggerForm.label.trim()) {
      toast.error("Key and Label are required.");
      return;
    }
    // Validate key format
    if (!/^[a-z][a-z0-9_]*$/.test(triggerForm.key)) {
      toast.error("Key must be lowercase letters, numbers, and underscores only.");
      return;
    }
    setSavingTrigger(true);
    const payload = {
      key:         triggerForm.key.trim(),
      label:       triggerForm.label.trim(),
      description: triggerForm.description.trim() || null,
      icon:        triggerForm.icon,
      is_system:   false,
    };

    let error;
    if (triggerForm.id) {
      // Can't change key of existing trigger (rules reference it)
      ({ error } = await supabase.from("automation_triggers").update({
        label: payload.label, description: payload.description, icon: payload.icon,
      }).eq("id", triggerForm.id));
    } else {
      ({ error } = await supabase.from("automation_triggers").insert(payload));
    }

    setSavingTrigger(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(triggerForm.id ? "Trigger updated." : "Trigger created.");
      setTriggerDrawer(false);
      fetchTriggers();
    }
  }

  async function handleDeleteTrigger(t: AutomationTrigger) {
    if (t.is_system) { toast.error("System triggers cannot be deleted."); return; }
    const inUse = rules.some((r) => r.trigger_key === t.key);
    if (inUse) { toast.error("This trigger is used by existing rules. Delete those rules first."); return; }
    const { error } = await supabase.from("automation_triggers").delete().eq("id", t.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Trigger deleted.");
      fetchTriggers();
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getTriggerLabel = (key: string) => triggers.find((t) => t.key === key)?.label ?? key;
  const getActionLabel  = (val: string) => ACTIONS.find((a) => a.value === val)?.label ?? val;
  const getNudgeLabel   = (val: string) => {
    if (val === "all") return "All Staff";
    return BUILTIN_NUDGE_ROLES.find((r) => r.value === val)?.label
      ?? customNudgeRoles.find((r) => r.key === val)?.label
      ?? val;
  };
  // Build full nudge roles list (builtin + custom)
  const allNudgeRoles = [
    ...BUILTIN_NUDGE_ROLES,
    ...customNudgeRoles.map((r) => ({ value: r.key, label: r.label, isCustom: true, id: r.id })),
  ];

  const total  = rules.length;
  const active = rules.filter((r) => r.status === "active").length;
  const global = rules.filter((r) => r.scope_type === "global").length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto p-8" style={{ background: "var(--background)" }}>

      {/* ── Hero ── */}
      <div className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(197,160,89,0.15)", border: "1px solid rgba(197,160,89,0.3)" }}
            >
              <Zap size={22} style={{ color: "var(--gold)" }} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: "#1C1917", fontFamily: "Georgia, serif" }}>
                Rule Builder
              </h1>
              <p className="text-sm mt-0.5" style={{ color: "#9C9584" }}>
                Automate patient care nudges and internal alerts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isSuperAdmin && (
              <button
                onClick={() => setTriggerDrawer(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200"
                style={{ border: "1px solid rgba(197,160,89,0.4)", color: "var(--gold)", background: "rgba(197,160,89,0.06)" }}
              >
                <PenLine size={15} />
                Manage Triggers
              </button>
            )}
            {isAdmin && (
              <button
                onClick={openNewRule}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #C5A059, #A8853A)", color: "white" }}
              >
                <Plus size={16} />
                New Rule
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total Rules", value: total,  icon: Zap    },
          { label: "Active",      value: active, icon: ToggleRight },
          { label: "Global",      value: global, icon: Globe  },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl p-4 flex items-center gap-3"
            style={{ background: "white", border: "1px solid rgba(197,160,89,0.2)" }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(197,160,89,0.1)" }}
            >
              <Icon size={16} style={{ color: "var(--gold)" }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: "#1C1917", fontFamily: "Georgia, serif" }}>{value}</p>
              <p className="text-xs" style={{ color: "#9C9584" }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tab switcher ── */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: "rgba(197,160,89,0.08)", border: "1px solid rgba(197,160,89,0.15)" }}>
        {([
          { key: "quick",     label: "Quick Rules" },
          { key: "workflows", label: "Workflows"   },
          { key: "templates", label: "Templates"   },
          { key: "analytics", label: "Analytics"   },
          { key: "dlq",       label: "Dead Letter Queue", badge: dlqItems.filter(i=>i.status==="pending").length },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setRulesTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5"
            style={rulesTab === t.key ? { background: "var(--gold)", color: "#fff", fontFamily: "Georgia,serif" } : { color: "rgba(197,160,89,0.7)" }}>
            {t.label}
            {"badge" in t && t.badge > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: "#DC2626", color: "#fff", fontSize: 10 }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Read-only notice for non-admins ── */}
      {!isAdmin && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl mb-6 text-sm"
          style={{ background: "rgba(197,160,89,0.08)", border: "1px solid rgba(197,160,89,0.25)", color: "#9C9584" }}
        >
          <AlertCircle size={15} style={{ color: "var(--gold)", flexShrink: 0 }} />
          You have read-only access. Contact your clinic admin to create or edit rules.
        </div>
      )}

      {/* ── WORKFLOWS TAB ── */}
      {rulesTab === "workflows" && (
        <div>
          <div className="flex justify-between items-center mb-5">
            <p className="text-sm" style={{ color: "#9C9584" }}>Visual workflows with condition trees and ordered action chains</p>
            {isAdmin && (
              <button onClick={() => { setAdvStep(1); setAdvDrawer(true); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #C5A059, #A8853A)" }}>
                <Plus size={15} /> New Workflow Rule
              </button>
            )}
          </div>

          {advLoading ? (
            <div className="space-y-3 animate-pulse">{[1,2,3].map(n => <div key={n} className="h-20 rounded-xl" style={{ background: "rgba(197,160,89,0.06)" }} />)}</div>
          ) : advRules.length === 0 ? (
            <div className="rounded-xl p-12 text-center" style={{ background: "white", border: "1px dashed rgba(197,160,89,0.3)" }}>
              <Zap size={28} className="mx-auto mb-2" style={{ color: "rgba(197,160,89,0.4)" }} />
              <p className="font-medium" style={{ fontFamily: "Georgia, serif", color: "#1C1917" }}>No workflows yet</p>
              <p className="text-sm mt-1" style={{ color: "#9C9584" }}>Create workflows with multi-condition trees and chained actions</p>
            </div>
          ) : (
            <div className="space-y-3">
              {advRules.map(r => {
                const TrigEvt = TRIGGER_EVENTS.find(t => t.value === r.trigger_event);
                const TIcon = TrigEvt?.icon ?? Zap;
                const isExpanded = expandedRuleId === r.id;
                const detail = ruleDetails[r.id];
                const catColor = CATEGORY_COLORS[r.category] ?? { bg: "rgba(197,160,89,0.1)", color: "#A8853A", label: r.category };
                return (
                  <div key={r.id} className="rounded-xl overflow-hidden" style={{ background: "white", border: "1px solid rgba(197,160,89,0.2)" }}>
                    {/* Card header */}
                    <div className="flex items-center gap-3 p-4">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(197,160,89,0.1)" }}>
                        <TIcon size={15} style={{ color: "var(--gold)" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm" style={{ fontFamily: "Georgia, serif", color: "#1C1917" }}>{r.name}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: r.workflow_status === "live" ? "rgba(34,197,94,0.12)" : "rgba(107,114,128,0.1)", color: r.workflow_status === "live" ? "#16a34a" : "#6b7280" }}>
                            {r.workflow_status === "live" ? "Live" : "Draft"}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: catColor.bg, color: catColor.color }}>
                            {catColor.label}
                          </span>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "#9C9584" }}>
                          {r.trigger_event} · priority {r.priority} · {r.run_mode}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={async () => {
                          const next = !r.is_active;
                          await supabase.from("rule_definitions").update({ is_active: next }).eq("id", r.id);
                          fetchAdvancedRules();
                        }}>
                          {r.is_active ? <ToggleRight size={22} style={{ color: "var(--gold)" }} /> : <ToggleLeft size={22} style={{ color: "#9C9584" }} />}
                        </button>
                        {isAdmin && (
                          <button onClick={async () => {
                            if (!confirm("Delete this workflow?")) return;
                            await supabase.from("rule_definitions").delete().eq("id", r.id);
                            fetchAdvancedRules();
                            toast.success("Workflow deleted.");
                          }} className="p-1.5 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                        <button onClick={() => {
                          const next = isExpanded ? null : r.id;
                          setExpandedRuleId(next);
                          if (next) { loadRuleDetail(next); if (isSuperAdmin) loadOverrides(next); }
                        }} className="p-1.5 rounded-lg" style={{ background: "rgba(197,160,89,0.08)", color: "var(--gold)" }}>
                          <ChevronDown size={14} style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                        </button>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t" style={{ borderColor: "rgba(197,160,89,0.12)" }}>
                        {detailLoading === r.id ? (
                          <p className="text-xs py-3" style={{ color: "#9C9584" }}>Loading details…</p>
                        ) : detail ? (
                          <>
                            {/* IF conditions */}
                            <div className="mt-3 mb-2">
                              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#7C6D3E" }}>IF</p>
                              {detail.conditions.length === 0 ? (
                                <span className="text-xs px-2 py-1 rounded" style={{ background: "rgba(197,160,89,0.06)", color: "#9C9584" }}>Always runs</span>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {detail.conditions.map((c, i) => (
                                    <span key={i} className="text-xs px-2 py-1 rounded-lg inline-flex items-center gap-1" style={{ background: "rgba(197,160,89,0.08)", color: "#7C6D3E" }}>
                                      {i > 0 && <span className="font-bold mr-1" style={{ color: "var(--gold)" }}>{c.logic_op}</span>}
                                      {c.field_path} {c.operator} {String((c.value as Record<string,unknown>)?.v ?? "")}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            {/* THEN actions */}
                            <div className="mb-3">
                              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#7C6D3E" }}>THEN</p>
                              {detail.actions.length === 0 ? (
                                <span className="text-xs" style={{ color: "#9C9584" }}>No actions defined</span>
                              ) : (
                                <div className="space-y-1">
                                  {detail.actions.map((a, i) => {
                                    const at = ADV_ACTION_TYPES.find(t => t.value === a.action_type);
                                    const msgKey = Object.keys(a.params || {}).find(k => k === "message" || k === "body");
                                    const preview = msgKey ? String((a.params as Record<string,unknown>)[msgKey]).slice(0, 60) + "…" : "";
                                    return (
                                      <div key={i} className="flex items-start gap-2 text-xs" style={{ color: "#4b5563" }}>
                                        <span className="font-bold" style={{ color: "var(--gold)", minWidth: 16 }}>{i+1}.</span>
                                        <ArrowRight size={12} className="mt-0.5 flex-shrink-0" style={{ color: "var(--gold)" }} />
                                        <span className="font-medium">{at?.label ?? a.action_type}</span>
                                        {preview && <span style={{ color: "#9C9584" }}>{preview}</span>}
                                        {a.on_failure === "dlq_notify" && (
                                          <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: "rgba(234,179,8,0.1)", color: "#ca8a04" }}>DLQ</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            {/* Action buttons */}
                            <div className="flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor: "rgba(197,160,89,0.12)" }}>
                              {r.workflow_status === "draft" && (
                                <button onClick={() => promoteToLive(r.id)}
                                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium text-white"
                                  style={{ background: "linear-gradient(135deg,#C5A059,#A8853A)" }}>
                                  <ArrowUp size={12} /> Promote to Live
                                </button>
                              )}
                              <button onClick={() => saveRuleAsTemplate(r.id, r.name)}
                                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium"
                                style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)" }}>
                                <Star size={12} /> Save as Template
                              </button>
                              {isSuperAdmin && (
                                <button onClick={() => { setOverridesOpen(overridesOpen === r.id ? null : r.id); if (overridesOpen !== r.id) loadOverrides(r.id); }}
                                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium"
                                  style={{ background: "rgba(59,130,246,0.1)", color: "#2563EB" }}>
                                  <Building2 size={12} /> Branch Overrides
                                </button>
                              )}
                            </div>
                            {/* Branch overrides panel */}
                            {isSuperAdmin && overridesOpen === r.id && (
                              <div className="mt-3 rounded-xl p-3" style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.15)" }}>
                                <p className="text-xs font-semibold mb-2" style={{ color: "#2563EB" }}>Per-Clinic Activation</p>
                                {overridesLoading ? <p className="text-xs" style={{ color: "#9C9584" }}>Loading…</p> : (
                                  <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {clinics.map(c => {
                                      const ov = overrides.find(o => o.clinic_id === c.id);
                                      const enabled = ov ? ov.is_enabled : true;
                                      return (
                                        <div key={c.id} className="flex items-center justify-between py-1">
                                          <span className="text-xs" style={{ color: "#1C1917" }}>{c.name}</span>
                                          <button onClick={() => toggleOverride(r.id, c.id, enabled)}>
                                            {enabled ? <ToggleRight size={18} style={{ color: "var(--gold)" }} /> : <ToggleLeft size={18} style={{ color: "#9C9584" }} />}
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 3-Step Workflow Designer Drawer */}
          {advDrawer && mounted && createPortal(
            <div className="fixed inset-0 z-50 flex" style={{ background: "rgba(0,0,0,0.4)" }}>
              <div className="flex-1" onClick={() => { setAdvDrawer(false); setAdvStep(1); setAdvConditions([]); setAdvActions([]); }} />
              <div className="w-[580px] h-full overflow-y-auto flex flex-col" style={{ background: "#FDFCFA", borderLeft: "1px solid rgba(197,160,89,0.2)" }}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(197,160,89,0.15)" }}>
                  <div>
                    <h3 className="text-base font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1C1917" }}>New Workflow Rule</h3>
                    <p className="text-xs mt-0.5" style={{ color: "#9C9584" }}>Define trigger, conditions, and chained actions</p>
                  </div>
                  <button onClick={() => { setAdvDrawer(false); setAdvStep(1); setAdvConditions([]); setAdvActions([]); }} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-0 px-6 py-3" style={{ borderBottom: "1px solid rgba(197,160,89,0.1)", background: "rgba(197,160,89,0.03)" }}>
                  {([["1","Trigger"],["2","Conditions"],["3","Actions"]] as const).map(([n, label], idx) => (
                    <div key={n} className="flex items-center">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ background: advStep >= parseInt(n) ? "var(--gold)" : "rgba(197,160,89,0.15)", color: advStep >= parseInt(n) ? "#fff" : "#9C9584" }}>
                          {n}
                        </div>
                        <span className="text-xs font-medium" style={{ color: advStep >= parseInt(n) ? "#7C6D3E" : "#9C9584" }}>{label}</span>
                      </div>
                      {idx < 2 && <div className="w-8 h-px mx-2" style={{ background: advStep > idx + 1 ? "var(--gold)" : "rgba(197,160,89,0.2)" }} />}
                    </div>
                  ))}
                </div>

                {/* Body */}
                <div className="flex-1 p-6 space-y-5">

                  {/* Step 1: Trigger & Basics */}
                  {advStep === 1 && (
                    <>
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Rule Name *</label>
                        <input value={advForm.name} onChange={e => setAdvForm(f => ({ ...f, name: e.target.value }))}
                          placeholder="e.g. Post-injection safety check" className="w-full px-3 py-2.5 rounded-xl border outline-none text-sm"
                          style={{ borderColor: "rgba(197,160,89,0.3)", background: "white", color: "#1C1917" }} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Description</label>
                        <textarea value={advDescription} onChange={e => setAdvDescription(e.target.value)}
                          rows={2} placeholder="Optional — explain when this workflow fires"
                          className="w-full px-3 py-2 rounded-xl border outline-none text-sm resize-none"
                          style={{ borderColor: "rgba(197,160,89,0.3)", background: "white", color: "#1C1917" }} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-2" style={{ color: "#4b5563" }}>Workflow Status</label>
                        <div className="flex gap-2">
                          {(["draft","live"] as const).map(s => (
                            <button key={s} onClick={() => setAdvWorkflowStatus(s)}
                              className="px-4 py-1.5 rounded-lg text-sm font-medium border transition-all"
                              style={{ background: advWorkflowStatus === s ? (s === "live" ? "var(--gold)" : "#6b7280") : "white", color: advWorkflowStatus === s ? "#fff" : "#6b7280", borderColor: advWorkflowStatus === s ? "transparent" : "rgba(197,160,89,0.3)" }}>
                              {s === "draft" ? "Draft" : "Live"}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-2" style={{ color: "#4b5563" }}>Trigger Event *</label>
                        <div className="grid grid-cols-3 gap-2">
                          {TRIGGER_EVENTS.map(t => {
                            const Icon = t.icon;
                            const active = advForm.trigger_event === t.value;
                            return (
                              <button key={t.value} onClick={() => setAdvForm(f => ({ ...f, trigger_event: t.value }))}
                                className="flex flex-col items-center gap-1 p-2.5 rounded-xl text-xs text-center transition-all"
                                style={{ border: active ? "1.5px solid var(--gold)" : "1px solid rgba(197,160,89,0.2)", background: active ? "rgba(197,160,89,0.1)" : "white", color: active ? "#7C6D3E" : "#9C9584" }}>
                                <Icon size={16} style={{ color: active ? "var(--gold)" : "#9C9584" }} />
                                {t.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Category</label>
                          <select value={advForm.category} onChange={e => setAdvForm(f => ({ ...f, category: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl border outline-none text-sm bg-white" style={{ borderColor: "rgba(197,160,89,0.3)" }}>
                            <option value="automation">Automation</option>
                            <option value="validation">Validation</option>
                            <option value="notification">Notification</option>
                            <option value="post_treatment">Post-Treatment</option>
                            <option value="engagement">Engagement</option>
                            <option value="lead_management">Lead Mgmt</option>
                            <option value="billing">Billing</option>
                            <option value="staff_alert">Staff Alert</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Run Mode</label>
                          <select value={advForm.run_mode} onChange={e => setAdvForm(f => ({ ...f, run_mode: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl border outline-none text-sm bg-white" style={{ borderColor: "rgba(197,160,89,0.3)" }}>
                            <option value="async">Async</option>
                            <option value="sync">Sync</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Priority</label>
                          <input type="number" value={advForm.priority} onChange={e => setAdvForm(f => ({ ...f, priority: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl border outline-none text-sm" style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Step 2: Conditions */}
                  {advStep === 2 && (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "#1C1917" }}>IF Conditions</p>
                          <p className="text-xs mt-0.5" style={{ color: "#9C9584" }}>Leave empty to run on every trigger event</p>
                        </div>
                        <button onClick={() => setAdvConditions(cs => [...cs, { id: crypto.randomUUID(), field_path: "", operator: "eq", value: "", logic_op: "AND" }])}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium"
                          style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)" }}>
                          <Plus size={12} /> Add Condition
                        </button>
                      </div>
                      {advConditions.length === 0 ? (
                        <div className="rounded-xl p-6 text-center" style={{ background: "rgba(197,160,89,0.04)", border: "1px dashed rgba(197,160,89,0.25)" }}>
                          <p className="text-sm" style={{ color: "#9C9584" }}>No conditions — workflow will always run when triggered</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {advConditions.map((c, i) => (
                            <div key={c.id} className="flex items-center gap-2">
                              {i > 0 && (
                                <button onClick={() => setAdvConditions(cs => cs.map((x, j) => j === i ? { ...x, logic_op: x.logic_op === "AND" ? "OR" : "AND" } : x))}
                                  className="text-xs px-2 py-1 rounded font-bold w-10 flex-shrink-0"
                                  style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)" }}>
                                  {c.logic_op}
                                </button>
                              )}
                              {i === 0 && <div className="w-10 flex-shrink-0" />}
                              <select value={c.field_path} onChange={e => setAdvConditions(cs => cs.map((x,j) => j===i ? {...x,field_path:e.target.value} : x))}
                                className="flex-1 px-2 py-1.5 rounded-lg border outline-none text-xs bg-white" style={{ borderColor: "rgba(197,160,89,0.3)" }}>
                                <option value="">Field…</option>
                                {FIELD_PATHS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                              </select>
                              <select value={c.operator} onChange={e => setAdvConditions(cs => cs.map((x,j) => j===i ? {...x,operator:e.target.value} : x))}
                                className="w-28 px-2 py-1.5 rounded-lg border outline-none text-xs bg-white" style={{ borderColor: "rgba(197,160,89,0.3)" }}>
                                {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                              {c.operator !== "is_null" && c.operator !== "not_null" && (
                                <input value={c.value} onChange={e => setAdvConditions(cs => cs.map((x,j) => j===i ? {...x,value:e.target.value} : x))}
                                  placeholder="value" className="w-24 px-2 py-1.5 rounded-lg border outline-none text-xs" style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                              )}
                              <button onClick={() => setAdvConditions(cs => cs.filter((_,j) => j!==i))} className="p-1 rounded" style={{ color: "#ef4444" }}><X size={13} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* Step 3: Actions */}
                  {advStep === 3 && (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "#1C1917" }}>THEN Actions</p>
                          <p className="text-xs mt-0.5" style={{ color: "#9C9584" }}>Actions run in order when conditions match</p>
                        </div>
                        <button onClick={() => setAdvActions(as => [...as, { id: crypto.randomUUID(), action_type: "", params: {}, on_failure: "continue" }])}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium"
                          style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)" }}>
                          <Plus size={12} /> Add Action Step
                        </button>
                      </div>
                      {advActions.length === 0 ? (
                        <div className="rounded-xl p-6 text-center" style={{ background: "rgba(197,160,89,0.04)", border: "1px dashed rgba(197,160,89,0.25)" }}>
                          <p className="text-sm" style={{ color: "#9C9584" }}>Add at least one action step</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {advActions.map((a, i) => {
                            const at = ADV_ACTION_TYPES.find(t => t.value === a.action_type);
                            return (
                              <div key={a.id} className="rounded-xl p-3 space-y-2" style={{ background: "rgba(197,160,89,0.04)", border: "1px solid rgba(197,160,89,0.15)" }}>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold w-5 text-center flex-shrink-0" style={{ color: "var(--gold)" }}>{i+1}</span>
                                  <div className="flex gap-1 flex-shrink-0">
                                    <button disabled={i===0} onClick={() => setAdvActions(as => { const n=[...as]; [n[i-1],n[i]]=[n[i],n[i-1]]; return n; })} className="p-1 rounded disabled:opacity-30" style={{ background: "rgba(197,160,89,0.1)" }}><ArrowUp size={10} /></button>
                                    <button disabled={i===advActions.length-1} onClick={() => setAdvActions(as => { const n=[...as]; [n[i],n[i+1]]=[n[i+1],n[i]]; return n; })} className="p-1 rounded disabled:opacity-30" style={{ background: "rgba(197,160,89,0.1)" }}><ArrowDown size={10} /></button>
                                  </div>
                                  <select value={a.action_type} onChange={e => setAdvActions(as => as.map((x,j) => j===i ? {...x,action_type:e.target.value,params:{}} : x))}
                                    className="flex-1 px-2 py-1.5 rounded-lg border outline-none text-xs bg-white" style={{ borderColor: "rgba(197,160,89,0.3)" }}>
                                    <option value="">Select action…</option>
                                    {ADV_ACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                  </select>
                                  <button onClick={() => setAdvActions(as => as.map((x,j) => j===i ? {...x,on_failure:x.on_failure==="continue"?"stop":x.on_failure==="stop"?"dlq_notify":"continue"} : x))}
                                    className="text-xs px-2 py-1 rounded font-medium flex-shrink-0"
                                    style={{ background: a.on_failure==="dlq_notify"?"rgba(234,179,8,0.12)":a.on_failure==="stop"?"rgba(239,68,68,0.08)":"rgba(197,160,89,0.08)", color: a.on_failure==="dlq_notify"?"#ca8a04":a.on_failure==="stop"?"#ef4444":"#9C9584" }}>
                                    {a.on_failure === "dlq_notify" ? "⚡DLQ" : a.on_failure === "stop" ? "⛔stop" : "✓continue"}
                                  </button>
                                  <button onClick={() => setAdvActions(as => as.filter((_,j) => j!==i))} className="p-1 rounded flex-shrink-0" style={{ color: "#ef4444" }}><X size={13} /></button>
                                </div>
                                {at && at.paramKeys.map(pk => (
                                  <div key={pk}>
                                    <label className="block text-xs mb-1" style={{ color: "#6b7280" }}>{pk}</label>
                                    {pk === "role" ? (
                                      <select value={a.params[pk] ?? ""} onChange={e => setAdvActions(as => as.map((x,j) => j===i ? {...x,params:{...x.params,[pk]:e.target.value}} : x))}
                                        className="w-full px-2 py-1.5 rounded-lg border outline-none text-xs bg-white" style={{ borderColor: "rgba(197,160,89,0.3)" }}>
                                        <option value="">Select role…</option>
                                        {BUILTIN_NUDGE_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                      </select>
                                    ) : pk === "message" || pk === "body" ? (
                                      <textarea value={a.params[pk] ?? ""} onChange={e => setAdvActions(as => as.map((x,j) => j===i ? {...x,params:{...x.params,[pk]:e.target.value}} : x))}
                                        rows={2} placeholder={`Enter ${pk}…`} className="w-full px-2 py-1.5 rounded-lg border outline-none text-xs resize-none"
                                        style={{ borderColor: "rgba(197,160,89,0.3)", background: "white" }} />
                                    ) : (
                                      <input value={a.params[pk] ?? ""} onChange={e => setAdvActions(as => as.map((x,j) => j===i ? {...x,params:{...x.params,[pk]:e.target.value}} : x))}
                                        placeholder={`Enter ${pk}…`} className="w-full px-2 py-1.5 rounded-lg border outline-none text-xs"
                                        style={{ borderColor: "rgba(197,160,89,0.3)", background: "white" }} />
                                    )}
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {advActions.some(a => a.on_failure === "dlq_notify") && (
                        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs" style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)", color: "#92400e" }}>
                          <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" style={{ color: "#ca8a04" }} />
                          Actions set to &apos;⚡DLQ&apos; will insert to the Dead Letter Queue and alert staff if they fail.
                        </div>
                      )}
                      {/* Rule summary */}
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(197,160,89,0.06)", color: "#7C6D3E" }}>
                        <Zap size={12} />
                        <span>{advForm.trigger_event || "No trigger"}</span>
                        <ArrowRight size={10} />
                        <span>{advConditions.length} condition{advConditions.length !== 1 ? "s" : ""}</span>
                        <ArrowRight size={10} />
                        <span>{advActions.length} action{advActions.length !== 1 ? "s" : ""}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 flex gap-3" style={{ borderTop: "1px solid rgba(197,160,89,0.15)" }}>
                  <button onClick={() => { if (advStep > 1) setAdvStep(s => (s - 1) as 1|2|3); else { setAdvDrawer(false); setAdvStep(1); setAdvConditions([]); setAdvActions([]); } }}
                    className="px-4 py-2 rounded-xl text-sm border" style={{ borderColor: "rgba(197,160,89,0.3)", color: "#6b7280" }}>
                    {advStep > 1 ? "← Back" : "Cancel"}
                  </button>
                  {advStep < 3 ? (
                    <button onClick={() => setAdvStep(s => (s + 1) as 1|2|3)}
                      disabled={advStep === 1 && (!advForm.name || !advForm.trigger_event)}
                      className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg,#C5A059,#A8853A)" }}>
                      Next →
                    </button>
                  ) : (
                    <>
                      <button onClick={() => saveAdvancedRule("draft")} disabled={advSaving}
                        className="flex-1 py-2 rounded-xl text-sm font-semibold border disabled:opacity-50"
                        style={{ borderColor: "rgba(197,160,89,0.3)", color: "#6b7280" }}>
                        {advSaving ? "Saving…" : "Save as Draft"}
                      </button>
                      <button onClick={() => saveAdvancedRule("live")} disabled={advSaving || advActions.length === 0}
                        className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg,#C5A059,#A8853A)" }}>
                        {advSaving ? "Saving…" : "Publish Live"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>
      )}

      {/* ── TEMPLATES TAB ── */}
      {rulesTab === "templates" && (
        <div>
          <p className="text-sm mb-4" style={{ color: "#9C9584" }}>25 ERP-grade workflow templates — click &quot;Use This&quot; to add to your workflows</p>
          {/* Category filter pills */}
          <div className="flex flex-wrap gap-2 mb-6">
            {[{ value: "all", label: `All (${BUILTIN_TEMPLATES.length})` },
              { value: "post_treatment", label: `Post-Treatment (5)` },
              { value: "engagement", label: `Engagement (5)` },
              { value: "lead_management", label: `Lead Mgmt (5)` },
              { value: "billing", label: `Billing (5)` },
              { value: "staff_alert", label: `Staff Alerts (5)` },
            ].map(f => (
              <button key={f.value} onClick={() => setTmplCategory(f.value)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{ background: tmplCategory === f.value ? "var(--gold)" : "rgba(197,160,89,0.1)", color: tmplCategory === f.value ? "#fff" : "#7C6D3E" }}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {BUILTIN_TEMPLATES.filter(t => tmplCategory === "all" || t.category === tmplCategory).map(t => {
              const catColor = CATEGORY_COLORS[t.category] ?? { bg: "rgba(197,160,89,0.1)", color: "#A8853A", label: t.category };
              const isPreviewOpen = expandedRuleId === `tmpl-${t.id}`;
              return (
                <div key={t.id} className="rounded-xl overflow-hidden" style={{ background: "white", border: "1px solid rgba(197,160,89,0.2)" }}>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-1.5">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: catColor.bg, color: catColor.color }}>{catColor.label}</span>
                      {t.is_featured && <span className="text-xs px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5" style={{ background: "rgba(197,160,89,0.12)", color: "var(--gold)" }}><Star size={9} /> Featured</span>}
                    </div>
                    <p className="font-semibold text-sm mt-1" style={{ fontFamily: "Georgia, serif", color: "#1C1917" }}>{t.name}</p>
                    <p className="text-xs mt-1 mb-3" style={{ color: "#9C9584" }}>{t.description}</p>
                    <div className="flex items-center gap-2 flex-wrap text-xs mb-3">
                      <span className="px-2 py-0.5 rounded font-mono" style={{ background: "rgba(197,160,89,0.06)", color: "var(--gold)" }}>{t.trigger_event}</span>
                      <span className="px-2 py-0.5 rounded" style={{ background: "rgba(107,114,128,0.08)", color: "#6b7280" }}>{t.conditions.length} cond{t.conditions.length !== 1 ? "s" : ""}</span>
                      <span className="px-2 py-0.5 rounded" style={{ background: "rgba(107,114,128,0.08)", color: "#6b7280" }}>{t.actions.length} action{t.actions.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <button onClick={() => setExpandedRuleId(isPreviewOpen ? null : `tmpl-${t.id}`)}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg"
                        style={{ background: "rgba(197,160,89,0.08)", color: "#7C6D3E" }}>
                        <ChevronDown size={11} style={{ transform: isPreviewOpen ? "rotate(180deg)" : "none" }} /> Preview
                      </button>
                      <button onClick={() => useBuiltinTemplate(t)}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-semibold text-white"
                        style={{ background: "var(--gold)" }}>
                        Use This <ArrowRight size={11} />
                      </button>
                    </div>
                  </div>
                  {isPreviewOpen && (
                    <div className="px-4 pb-3 border-t" style={{ borderColor: "rgba(197,160,89,0.12)" }}>
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-medium" style={{ color: "#7C6D3E" }}>IF: {t.conditions.length === 0 ? "Always runs" : t.conditions.map((c,i) => `${i>0?c.logic_op+' ':''}${c.field_path} ${c.operator} ${String(c.value?.v ?? "")}`).join(", ")}</p>
                        {t.actions.map((a, i) => {
                          const at = ADV_ACTION_TYPES.find(x => x.value === a.action_type);
                          const msgKey = Object.keys(a.params || {}).find(k => k === "message" || k === "body");
                          const msg = msgKey ? String((a.params as Record<string,unknown>)[msgKey]).slice(0, 80) + "…" : "";
                          return (
                            <p key={i} className="text-xs" style={{ color: "#4b5563" }}>
                              <span className="font-medium">{i+1}. {at?.label ?? a.action_type}</span>{msg ? <span style={{ color: "#9C9584" }}> — &quot;{msg}&quot;</span> : null}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ANALYTICS TAB ── */}
      {rulesTab === "analytics" && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <select value={analyticsRuleId} onChange={e => { setAnalyticsRuleId(e.target.value); fetchAnalytics(e.target.value); }}
              className="flex-1 px-3 py-2 rounded-xl border outline-none text-sm bg-white" style={{ borderColor: "rgba(197,160,89,0.3)", maxWidth: 360 }}>
              <option value="">Select a workflow…</option>
              {advRules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <span className="text-xs" style={{ color: "#9C9584" }}>Last 30 days</span>
          </div>
          {!analyticsRuleId ? (
            <div className="rounded-xl p-12 text-center" style={{ background: "white", border: "1px dashed rgba(197,160,89,0.3)" }}>
              <Activity size={28} className="mx-auto mb-2" style={{ color: "rgba(197,160,89,0.4)" }} />
              <p className="text-sm" style={{ color: "#9C9584" }}>Select a workflow above to see analytics</p>
            </div>
          ) : analyticsLoading ? (
            <div className="animate-pulse space-y-3">{[1,2,3].map(n=><div key={n} className="h-16 rounded-xl" style={{background:"rgba(197,160,89,0.06)"}}/>)}</div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Total Runs", value: execLogs.length, color: "#1C1917" },
                  { label: "Success", value: execLogs.filter(e=>e.result==="success").length, color: "#16a34a" },
                  { label: "Failed", value: execLogs.filter(e=>e.result==="failed").length, color: "#DC2626" },
                  { label: "Avg Duration", value: execLogs.length > 0 ? `${(execLogs.filter(e=>e.duration_ms).reduce((s,e)=>s+(e.duration_ms||0),0)/Math.max(execLogs.filter(e=>e.duration_ms).length,1)/1000).toFixed(1)}s` : "—", color: "#7C6D3E" },
                ].map(s => (
                  <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "white", border: "1px solid rgba(197,160,89,0.2)" }}>
                    <p className="text-2xl font-bold" style={{ color: s.color, fontFamily: "Georgia,serif" }}>{s.value}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#9C9584" }}>{s.label}</p>
                  </div>
                ))}
              </div>
              {/* Funnel */}
              <div className="rounded-xl p-5" style={{ background: "white", border: "1px solid rgba(197,160,89,0.2)" }}>
                <p className="text-sm font-semibold mb-4" style={{ fontFamily: "Georgia,serif", color: "#1C1917" }}>Step Funnel</p>
                {execLogs.length === 0 ? (
                  <p className="text-sm text-center py-4" style={{ color: "#9C9584" }}>No executions yet</p>
                ) : (
                  <div className="space-y-3">
                    {/* Triggered */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1" style={{ color: "#4b5563" }}>
                        <span className="font-medium">Triggered</span>
                        <span>{execLogs.length} (100%)</span>
                      </div>
                      <div className="h-7 rounded-lg overflow-hidden" style={{ background: "rgba(197,160,89,0.08)" }}>
                        <div className="h-full rounded-lg flex items-center px-2 text-xs font-medium text-white" style={{ width: "100%", background: "linear-gradient(90deg,#C5A059,#A8853A)" }}>
                          {execLogs.length}
                        </div>
                      </div>
                    </div>
                    {/* Per action step */}
                    {Array.from(new Set(actionLogs.map(a=>a.action_index))).sort().map(idx => {
                      const stepLogs = actionLogs.filter(a=>a.action_index===idx);
                      const success = stepLogs.filter(a=>a.result==="success").length;
                      const pct = execLogs.length > 0 ? Math.round((success/execLogs.length)*100) : 0;
                      const at = ADV_ACTION_TYPES.find(t => t.value === stepLogs[0]?.action_type);
                      return (
                        <div key={idx}>
                          <div className="flex items-center justify-between text-xs mb-1" style={{ color: "#4b5563" }}>
                            <span className="font-medium">Step {idx+1} {at ? `· ${at.label}` : ""}</span>
                            <span>{success} ({pct}%)</span>
                          </div>
                          <div className="h-7 rounded-lg overflow-hidden" style={{ background: "rgba(197,160,89,0.08)" }}>
                            <div className="h-full rounded-lg flex items-center px-2 text-xs font-medium text-white transition-all"
                              style={{ width: `${pct}%`, minWidth: pct > 0 ? 24 : 0, background: pct >= 90 ? "linear-gradient(90deg,#C5A059,#A8853A)" : pct >= 70 ? "#f59e0b" : "#ef4444" }}>
                              {pct > 10 && success}
                            </div>
                          </div>
                          {success < execLogs.length && (
                            <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "#DC2626" }}>
                              <AlertTriangle size={10} /> Drop-off: {execLogs.length - success}
                              <button onClick={() => setRulesTab("dlq")} className="underline ml-1">View in DLQ</button>
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* Recent executions */}
              <div className="rounded-xl overflow-hidden" style={{ background: "white", border: "1px solid rgba(197,160,89,0.2)" }}>
                <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(197,160,89,0.12)", background: "rgba(197,160,89,0.04)" }}>
                  <p className="text-sm font-semibold" style={{ fontFamily: "Georgia,serif", color: "#1C1917" }}>Recent Executions</p>
                </div>
                {execLogs.slice(0, 10).map(e => (
                  <div key={e.id} className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "rgba(197,160,89,0.08)" }}>
                    <span className="text-xs" style={{ color: "#6b7280" }}>{new Date(e.executed_at).toLocaleString()}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: e.result==="success"?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.1)", color: e.result==="success"?"#16a34a":"#DC2626" }}>
                      {e.result}
                    </span>
                    <span className="text-xs" style={{ color: "#9C9584" }}>{e.duration_ms ? `${(e.duration_ms/1000).toFixed(2)}s` : "—"}</span>
                  </div>
                ))}
                {execLogs.length === 0 && <p className="text-sm text-center py-6" style={{ color: "#9C9584" }}>No executions recorded</p>}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── DEAD LETTER QUEUE TAB ── */}
      {rulesTab === "dlq" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-sm px-3 py-1.5 rounded-xl" style={{ background: "rgba(239,68,68,0.08)", color: "#DC2626" }}>
                Pending: {dlqItems.length}
              </div>
            </div>
            <button onClick={fetchDLQ} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border" style={{ borderColor: "rgba(197,160,89,0.3)", color: "var(--gold)" }}>
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
          {dlqLoading ? (
            <div className="animate-pulse space-y-3">{[1,2,3].map(n=><div key={n} className="h-24 rounded-xl" style={{background:"rgba(197,160,89,0.06)"}}/>)}</div>
          ) : dlqItems.length === 0 ? (
            <div className="rounded-xl p-12 text-center" style={{ background: "white", border: "1px dashed rgba(197,160,89,0.3)" }}>
              <CheckSquare size={28} className="mx-auto mb-2" style={{ color: "rgba(34,197,94,0.5)" }} />
              <p className="font-medium" style={{ fontFamily: "Georgia, serif", color: "#1C1917" }}>Dead Letter Queue is clear</p>
              <p className="text-sm mt-1" style={{ color: "#9C9584" }}>No failed workflow actions pending</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dlqItems.map(item => (
                <div key={item.id} className="rounded-xl p-4" style={{ background: "white", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-semibold text-sm" style={{ fontFamily: "Georgia,serif", color: "#1C1917" }}>
                        {(item.rule_definitions as {name?:string})?.name ?? "Unknown Workflow"}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "#9C9584" }}>
                        Action {item.action_index + 1}: <span className="font-mono">{item.action_type}</span>
                        {" · "}Attempt: {item.retry_count + 1}
                        {" · "}{new Date(item.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium" style={{ background: "rgba(239,68,68,0.1)", color: "#DC2626" }}>
                      {item.status}
                    </span>
                  </div>
                  <div className="rounded-lg px-3 py-2 mb-3 text-xs" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.12)", color: "#7f1d1d" }}>
                    <span className="font-medium">Error:</span> {item.error_message}
                  </div>
                  {item.params && Object.keys(item.params).length > 0 && expandedRuleId === `dlq-${item.id}` && (
                    <div className="rounded-lg px-3 py-2 mb-3 text-xs font-mono" style={{ background: "rgba(197,160,89,0.04)", border: "1px solid rgba(197,160,89,0.15)", color: "#4b5563" }}>
                      {JSON.stringify(item.params, null, 2)}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button onClick={() => setExpandedRuleId(expandedRuleId === `dlq-${item.id}` ? null : `dlq-${item.id}`)}
                      className="text-xs px-3 py-1.5 rounded-lg" style={{ background: "rgba(197,160,89,0.08)", color: "var(--gold)" }}>
                      {expandedRuleId === `dlq-${item.id}` ? "Hide" : "View"} Details
                    </button>
                    <button onClick={async () => {
                      await supabase.from("workflow_dlq").update({ status: "dismissed" }).eq("id", item.id);
                      fetchDLQ();
                      toast.success("Dismissed.");
                    }} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: "rgba(107,114,128,0.08)", color: "#6b7280" }}>
                      Dismiss
                    </button>
                    <button onClick={async () => {
                      await supabase.from("workflow_dlq").update({ retry_count: item.retry_count + 1 }).eq("id", item.id);
                      fetchDLQ();
                      toast.success("Retry queued.");
                    }} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium"
                      style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)" }}>
                      <RefreshCw size={11} /> Retry
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Rules list ── */}
      {rulesTab === "quick" && (<>
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 rounded-xl" style={{ background: "rgba(197,160,89,0.06)" }} />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div
          className="rounded-xl p-16 text-center"
          style={{ background: "white", border: "1px dashed rgba(197,160,89,0.3)" }}
        >
          <Zap size={32} className="mx-auto mb-3" style={{ color: "rgba(197,160,89,0.4)" }} />
          <p className="font-medium mb-1" style={{ color: "#1C1917", fontFamily: "Georgia, serif" }}>No automation rules yet</p>
          <p className="text-sm mb-5" style={{ color: "#9C9584" }}>Create your first rule to automate patient care nudges.</p>
          {isAdmin && (
            <button
              onClick={openNewRule}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "linear-gradient(135deg, #C5A059, #A8853A)", color: "white" }}
            >
              Create First Rule
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const trigger   = triggers.find((t) => t.key === rule.trigger_key);
            const TIcon     = trigger ? getTriggerIcon(trigger.icon) : Zap;
            const aAction   = ACTIONS.find((a) => a.value === rule.action);
            const AIcon     = aAction?.icon ?? Bell;
            const scopeClinicNames = rule.scope_type === "clinic" && rule.clinic_ids?.length
              ? clinics.filter((c) => rule.clinic_ids.includes(c.id)).map((c) => c.name)
              : [];

            return (
              <div
                key={rule.id}
                className="rounded-xl p-5 group transition-all duration-200"
                style={{
                  background: "white",
                  border: "1px solid rgba(197,160,89,0.2)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Trigger icon */}
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: "rgba(197,160,89,0.1)" }}
                    >
                      <TIcon size={18} style={{ color: "var(--gold)" }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm" style={{ color: "#1C1917", fontFamily: "Georgia, serif" }}>
                          {rule.name}
                        </h3>
                        {/* Status badge */}
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{
                            background: rule.status === "active" ? "rgba(34,197,94,0.12)" : "rgba(156,149,132,0.12)",
                            color: rule.status === "active" ? "#16a34a" : "#9C9584",
                          }}
                        >
                          {rule.status}
                        </span>
                        {/* Scope badge */}
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1"
                          style={{ background: "rgba(197,160,89,0.1)", color: "#A8853A" }}
                        >
                          {rule.scope_type === "global"
                            ? <><Globe size={10} /> Global</>
                            : <><Building2 size={10} /> {scopeClinicNames.length} clinic{scopeClinicNames.length !== 1 ? "s" : ""}</>
                          }
                        </span>
                      </div>

                      {/* Trigger → Action summary */}
                      <div className="flex items-center gap-2 mt-2 text-xs flex-wrap">
                        <span
                          className="flex items-center gap-1 px-2 py-1 rounded-lg"
                          style={{ background: "rgba(197,160,89,0.08)", color: "#7C6D3E" }}
                        >
                          <TIcon size={11} />
                          {trigger?.label ?? rule.trigger_key}
                        </span>
                        <ChevronDown size={11} style={{ color: "#C5A059", transform: "rotate(-90deg)" }} />
                        <span
                          className="flex items-center gap-1 px-2 py-1 rounded-lg"
                          style={{ background: "rgba(197,160,89,0.08)", color: "#7C6D3E" }}
                        >
                          <AIcon size={11} />
                          {aAction?.label ?? rule.action}
                          {rule.action === "nudge_staff" && rule.nudge_target_roles?.length > 0 && (
                            <span style={{ color: "#C5A059" }}>
                              → {rule.nudge_target_roles.includes("all")
                                  ? "All Staff"
                                  : rule.nudge_target_roles.slice(0, 2).map(getNudgeLabel).join(", ")
                                    + (rule.nudge_target_roles.length > 2 ? ` +${rule.nudge_target_roles.length - 2}` : "")
                                }
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Clinic scope list */}
                      {rule.scope_type === "clinic" && scopeClinicNames.length > 0 && (
                        <p className="text-xs mt-1.5" style={{ color: "#9C9584" }}>
                          <Building2 size={10} className="inline mr-1" />
                          {scopeClinicNames.slice(0, 3).join(", ")}
                          {scopeClinicNames.length > 3 && ` +${scopeClinicNames.length - 3} more`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleToggleStatus(rule)}
                      disabled={!isAdmin}
                      title={rule.status === "active" ? "Pause rule" : "Activate rule"}
                    >
                      {rule.status === "active"
                        ? <ToggleRight size={22} style={{ color: "var(--gold)" }} />
                        : <ToggleLeft  size={22} style={{ color: "#9C9584" }} />
                      }
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => openEditRule(rule)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg"
                        style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)" }}
                        title="Edit rule"
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg"
                        style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}
                        title="Delete rule"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>)}

      {/* ── Rule Drawer ── */}
      {mounted && ruleDrawer && createPortal(
        <RuleDrawer
          form={ruleForm}
          setForm={setRuleForm}
          triggers={triggers}
          clinics={clinics}
          allNudgeRoles={allNudgeRoles}
          customNudgeRoles={customNudgeRoles}
          saving={saving}
          previewMode={previewMode}
          setPreviewMode={setPreviewMode}
          isSuperAdmin={isSuperAdmin}
          onClose={() => { setRuleDrawer(false); setRuleForm(EMPTY_RULE_FORM); }}
          onSave={handleSaveRule}
          onTriggerChange={handleTriggerChange}
          onActionChange={handleActionChange}
          onToggleClinic={toggleClinicId}
          onToggleNudgeRole={toggleNudgeRole}
          onAddCustomRole={handleAddCustomNudgeRole}
          onDeleteCustomRole={handleDeleteCustomNudgeRole}
        />,
        document.body
      )}

      {/* ── Trigger Manager Drawer (superadmin only) ── */}
      {mounted && isSuperAdmin && triggerDrawer && createPortal(
        <TriggerManagerDrawer
          triggers={triggers}
          triggerForm={triggerForm}
          setTriggerForm={setTriggerForm}
          savingTrigger={savingTrigger}
          onClose={() => { setTriggerDrawer(false); setTriggerForm(EMPTY_TRIGGER_FORM); }}
          onSave={handleSaveTrigger}
          onEdit={openEditTrigger}
          onDelete={handleDeleteTrigger}
          onNew={openNewTrigger}
        />,
        document.body
      )}
    </div>
  );
}

// ── Rule Drawer ────────────────────────────────────────────────────────────────

function RuleDrawer({
  form, setForm, triggers, clinics, allNudgeRoles, customNudgeRoles,
  saving, previewMode, setPreviewMode,
  isSuperAdmin, onClose, onSave, onTriggerChange, onActionChange,
  onToggleClinic, onToggleNudgeRole, onAddCustomRole, onDeleteCustomRole,
}: {
  form: RuleForm;
  setForm: React.Dispatch<React.SetStateAction<RuleForm>>;
  triggers: AutomationTrigger[];
  clinics: Clinic[];
  allNudgeRoles: { value: string; label: string; isCustom?: boolean; id?: string }[];
  customNudgeRoles: CustomNudgeRole[];
  saving: boolean;
  previewMode: boolean;
  setPreviewMode: (v: boolean) => void;
  isSuperAdmin: boolean;
  onClose: () => void;
  onSave: () => void;
  onTriggerChange: (key: string) => void;
  onActionChange: (action: string) => void;
  onToggleClinic: (id: string) => void;
  onToggleNudgeRole: (value: string) => void;
  onAddCustomRole: (label: string) => void;
  onDeleteCustomRole: (id: string, key: string) => void;
}) {
  const [newRoleInput, setNewRoleInput] = useState("");
  const selectedTrigger = triggers.find((t) => t.key === form.trigger_key);
  const preview = form.message_template ? buildPreview(form.message_template, form) : "";
  const isAllSelected = form.nudge_target_roles.includes("all");

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative flex flex-col w-full max-w-xl h-full overflow-y-auto shadow-2xl"
        style={{ background: "#FDFCFA", borderLeft: "1px solid rgba(197,160,89,0.2)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b" style={{ borderColor: "rgba(197,160,89,0.15)" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(197,160,89,0.12)" }}
            >
              <Zap size={16} style={{ color: "var(--gold)" }} />
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: "#1C1917", fontFamily: "Georgia, serif" }}>
                {form.id ? "Edit Rule" : "New Rule"}
              </h2>
              <p className="text-xs" style={{ color: "#9C9584" }}>
                {form.id ? "Update automation rule" : "Configure automation trigger & action"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-gray-100"
            style={{ color: "#9C9584" }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 px-7 py-6 space-y-6">

          {/* Name */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#7C6D3E" }}>Rule Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Post-treatment WhatsApp nudge"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 transition-all"
              style={{
                border: "1px solid rgba(197,160,89,0.3)",
                background: "white",
                color: "#1C1917",
                "--tw-ring-color": "rgba(197,160,89,0.3)",
              } as React.CSSProperties}
            />
          </div>

          {/* Trigger */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: "#7C6D3E" }}>Trigger *</label>
            <div className="grid grid-cols-2 gap-2">
              {triggers.map((t) => {
                const Icon    = getTriggerIcon(t.icon);
                const active  = form.trigger_key === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => onTriggerChange(t.key)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-left transition-all"
                    style={{
                      border: active ? "1px solid rgba(197,160,89,0.6)" : "1px solid rgba(197,160,89,0.2)",
                      background: active ? "rgba(197,160,89,0.12)" : "white",
                      color: active ? "#7C6D3E" : "#9C9584",
                    }}
                  >
                    <Icon size={15} style={{ color: active ? "var(--gold)" : "#9C9584", flexShrink: 0 }} />
                    <span className="truncate text-xs font-medium">{t.label}</span>
                    {!t.is_system && (
                      <span className="ml-auto flex-shrink-0 text-xs px-1 rounded" style={{ background: "rgba(197,160,89,0.2)", color: "var(--gold)", fontSize: 9 }}>custom</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Condition fields — vary by trigger */}
          {form.trigger_key === "after_treatment" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#7C6D3E" }}>Treatment Name</label>
                <input
                  type="text"
                  value={form.condition_treatment}
                  onChange={(e) => setForm((f) => ({ ...f, condition_treatment: e.target.value }))}
                  placeholder="e.g. Hydrafacial"
                  className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                  style={{ border: "1px solid rgba(197,160,89,0.3)", background: "white", color: "#1C1917" }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#7C6D3E" }}>Delay (days)</label>
                <input
                  type="number"
                  min={0}
                  value={form.condition_days}
                  onChange={(e) => setForm((f) => ({ ...f, condition_days: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                  style={{ border: "1px solid rgba(197,160,89,0.3)", background: "white", color: "#1C1917" }}
                />
              </div>
            </div>
          )}

          {form.trigger_key === "low_stock" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#7C6D3E" }}>Product Name</label>
                <input
                  type="text"
                  value={form.condition_product}
                  onChange={(e) => setForm((f) => ({ ...f, condition_product: e.target.value }))}
                  placeholder="e.g. Vitamin C Serum"
                  className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                  style={{ border: "1px solid rgba(197,160,89,0.3)", background: "white", color: "#1C1917" }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#7C6D3E" }}>Threshold Qty</label>
                <input
                  type="number"
                  min={1}
                  value={form.condition_quantity}
                  onChange={(e) => setForm((f) => ({ ...f, condition_quantity: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                  style={{ border: "1px solid rgba(197,160,89,0.3)", background: "white", color: "#1C1917" }}
                />
              </div>
            </div>
          )}

          {(form.trigger_key === "new_lead" || form.trigger_key === "appointment_noshow" || form.trigger_key === "appointment_reminder") && (
            <div className="grid grid-cols-2 gap-4">
              {form.trigger_key === "new_lead" && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#7C6D3E" }}>Lead Source</label>
                  <input
                    type="text"
                    value={form.condition_source}
                    onChange={(e) => setForm((f) => ({ ...f, condition_source: e.target.value }))}
                    placeholder="e.g. Instagram"
                    className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                    style={{ border: "1px solid rgba(197,160,89,0.3)", background: "white", color: "#1C1917" }}
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#7C6D3E" }}>
                  {form.trigger_key === "appointment_reminder" ? "Hours before" : "Hours window"}
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.condition_hours}
                  onChange={(e) => setForm((f) => ({ ...f, condition_hours: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                  style={{ border: "1px solid rgba(197,160,89,0.3)", background: "white", color: "#1C1917" }}
                />
              </div>
            </div>
          )}

          {/* Action */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: "#7C6D3E" }}>Action *</label>
            <div className="grid grid-cols-2 gap-2">
              {ACTIONS.map((a) => {
                const Icon   = a.icon;
                const active = form.action === a.value;
                return (
                  <button
                    key={a.value}
                    onClick={() => onActionChange(a.value)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-left transition-all"
                    style={{
                      border: active ? "1px solid rgba(197,160,89,0.6)" : "1px solid rgba(197,160,89,0.2)",
                      background: active ? "rgba(197,160,89,0.12)" : "white",
                      color: active ? "#7C6D3E" : "#9C9584",
                    }}
                  >
                    <Icon size={15} style={{ color: active ? "var(--gold)" : "#9C9584", flexShrink: 0 }} />
                    <span className="text-xs font-medium">{a.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nudge target roles — multi-select */}
          {form.action === "nudge_staff" && (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid rgba(197,160,89,0.2)" }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-4 py-2.5"
                style={{ background: "rgba(197,160,89,0.06)", borderBottom: "1px solid rgba(197,160,89,0.12)" }}
              >
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#7C6D3E" }}>
                  Notify Staff Roles
                </span>
                <span className="text-xs" style={{ color: "#9C9584" }}>
                  {isAllSelected ? "All staff selected" : `${form.nudge_target_roles.length} selected`}
                </span>
              </div>

              {/* "All Staff" toggle — full width, prominent */}
              <button
                onClick={() => onToggleNudgeRole("all")}
                className="w-full flex items-center gap-3 px-4 py-3 transition-colors"
                style={{
                  background: isAllSelected ? "rgba(197,160,89,0.12)" : "white",
                  borderBottom: "1px solid rgba(197,160,89,0.1)",
                }}
              >
                {isAllSelected
                  ? <CheckSquare size={16} style={{ color: "var(--gold)", flexShrink: 0 }} />
                  : <Square       size={16} style={{ color: "#9C9584",    flexShrink: 0 }} />
                }
                <span className="text-sm font-semibold" style={{ color: isAllSelected ? "#7C6D3E" : "#1C1917" }}>
                  All Staff
                </span>
                <span className="ml-auto text-xs" style={{ color: "#9C9584" }}>notifies everyone</span>
              </button>

              {/* Individual roles — disabled when "all" is checked */}
              <div className="divide-y" style={{ opacity: isAllSelected ? 0.4 : 1 }}>
                {allNudgeRoles.map((r) => {
                  const checked = !isAllSelected && form.nudge_target_roles.includes(r.value);
                  return (
                    <div key={r.value} className="flex items-center group">
                      <button
                        disabled={isAllSelected}
                        onClick={() => onToggleNudgeRole(r.value)}
                        className="flex-1 flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-amber-50 disabled:cursor-default"
                      >
                        {checked
                          ? <CheckSquare size={14} style={{ color: "var(--gold)", flexShrink: 0 }} />
                          : <Square       size={14} style={{ color: "#D1C9B0",    flexShrink: 0 }} />
                        }
                        <span className="text-sm" style={{ color: checked ? "#7C6D3E" : "#1C1917" }}>
                          {r.label}
                        </span>
                        {r.isCustom && (
                          <span
                            className="ml-1 text-xs px-1.5 py-0.5 rounded"
                            style={{ background: "rgba(197,160,89,0.15)", color: "var(--gold)", fontSize: 9 }}
                          >
                            custom
                          </span>
                        )}
                      </button>
                      {/* Delete custom role (superadmin) */}
                      {isSuperAdmin && r.isCustom && r.id && (
                        <button
                          onClick={() => onDeleteCustomRole(r.id!, r.value)}
                          className="opacity-0 group-hover:opacity-100 p-2 transition-opacity mr-2"
                          style={{ color: "#ef4444" }}
                          title="Remove this custom role"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Superadmin: add custom role inline */}
              {isSuperAdmin && (
                <div
                  className="flex gap-2 px-4 py-3"
                  style={{ borderTop: "1px solid rgba(197,160,89,0.12)", background: "rgba(197,160,89,0.03)" }}
                >
                  <input
                    type="text"
                    value={newRoleInput}
                    onChange={(e) => setNewRoleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newRoleInput.trim()) {
                        onAddCustomRole(newRoleInput.trim());
                        setNewRoleInput("");
                      }
                    }}
                    placeholder="Add custom role… (e.g. Nurse)"
                    className="flex-1 px-3 py-1.5 rounded-xl text-sm border outline-none"
                    style={{ border: "1px solid rgba(197,160,89,0.3)", background: "white", color: "#1C1917" }}
                  />
                  <button
                    onClick={() => {
                      if (newRoleInput.trim()) {
                        onAddCustomRole(newRoleInput.trim());
                        setNewRoleInput("");
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
                    style={{ background: "rgba(197,160,89,0.15)", color: "var(--gold)" }}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Message Template */}
          {form.action && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium" style={{ color: "#7C6D3E" }}>Message Template</label>
                <button
                  onClick={() => setPreviewMode(!previewMode)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors"
                  style={{
                    background: previewMode ? "rgba(197,160,89,0.15)" : "rgba(197,160,89,0.08)",
                    color: "var(--gold)",
                  }}
                >
                  <Eye size={11} /> {previewMode ? "Edit" : "Preview"}
                </button>
              </div>
              {previewMode ? (
                <div
                  className="w-full px-4 py-3 rounded-xl text-sm whitespace-pre-wrap min-h-[120px]"
                  style={{ background: "rgba(197,160,89,0.06)", border: "1px solid rgba(197,160,89,0.2)", color: "#1C1917", lineHeight: 1.7 }}
                >
                  {preview || <span style={{ color: "#9C9584", fontStyle: "italic" }}>Type a template to see preview…</span>}
                </div>
              ) : (
                <textarea
                  value={form.message_template}
                  onChange={(e) => setForm((f) => ({ ...f, message_template: e.target.value }))}
                  rows={5}
                  placeholder={DEFAULT_TEMPLATES[form.action] ?? "Enter your message template…"}
                  className="w-full px-3.5 py-3 rounded-xl text-sm border outline-none resize-none"
                  style={{ border: "1px solid rgba(197,160,89,0.3)", background: "white", color: "#1C1917", lineHeight: 1.7 }}
                />
              )}
              <p className="text-xs mt-1.5" style={{ color: "#9C9584" }}>
                Variables: {"{patient_name}"} {"{treatment_name}"} {"{clinic_name}"} {"{doctor_name}"} {"{days}"} {"{hours}"}
              </p>
            </div>
          )}

          {/* Scope */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: "#7C6D3E" }}>Scope</label>
            <div className="flex gap-2 mb-3">
              {[
                { value: "global" as const, label: "Global", icon: Globe,     desc: "Applies to all clinics" },
                { value: "clinic" as const, label: "Clinics", icon: Building2, desc: "Apply to specific clinics" },
              ].map(({ value, label, icon: Icon, desc }) => {
                const active = form.scope_type === value;
                return (
                  <button
                    key={value}
                    onClick={() => setForm((f) => ({ ...f, scope_type: value, clinic_ids: [] }))}
                    className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl text-sm text-left transition-all"
                    style={{
                      border: active ? "1px solid rgba(197,160,89,0.6)" : "1px solid rgba(197,160,89,0.2)",
                      background: active ? "rgba(197,160,89,0.12)" : "white",
                    }}
                  >
                    <Icon size={15} style={{ color: active ? "var(--gold)" : "#9C9584", flexShrink: 0 }} />
                    <div>
                      <p className="text-xs font-semibold" style={{ color: active ? "#7C6D3E" : "#1C1917" }}>{label}</p>
                      <p className="text-xs" style={{ color: "#9C9584" }}>{desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Multi-clinic picker */}
            {form.scope_type === "clinic" && (
              <div
                className="rounded-xl overflow-hidden border"
                style={{ border: "1px solid rgba(197,160,89,0.2)" }}
              >
                <div className="px-3 py-2 text-xs font-medium" style={{ background: "rgba(197,160,89,0.06)", color: "#7C6D3E" }}>
                  Select clinics ({form.clinic_ids.length} selected)
                </div>
                <div className="max-h-52 overflow-y-auto divide-y divide-amber-100/50">
                  {clinics.map((clinic) => {
                    const checked = form.clinic_ids.includes(clinic.id);
                    return (
                      <button
                        key={clinic.id}
                        onClick={() => onToggleClinic(clinic.id)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-amber-50"
                      >
                        {checked
                          ? <CheckSquare size={15} style={{ color: "var(--gold)", flexShrink: 0 }} />
                          : <Square       size={15} style={{ color: "#9C9584",    flexShrink: 0 }} />
                        }
                        <span className="text-sm" style={{ color: checked ? "#7C6D3E" : "#1C1917" }}>
                          {clinic.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-7 py-5 border-t flex gap-3"
          style={{ borderColor: "rgba(197,160,89,0.15)", background: "rgba(197,160,89,0.03)" }}
        >
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all"
            style={{ border: "1px solid rgba(197,160,89,0.3)", color: "#7C6D3E" }}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="grow px-8 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #C5A059, #A8853A)", color: "white" }}
          >
            {saving ? "Saving…" : form.id ? "Update Rule" : "Create Rule"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Trigger Manager Drawer (superadmin only) ───────────────────────────────────

function TriggerManagerDrawer({
  triggers, triggerForm, setTriggerForm, savingTrigger,
  onClose, onSave, onEdit, onDelete, onNew,
}: {
  triggers: AutomationTrigger[];
  triggerForm: TriggerForm;
  setTriggerForm: React.Dispatch<React.SetStateAction<TriggerForm>>;
  savingTrigger: boolean;
  onClose: () => void;
  onSave: () => void;
  onEdit: (t: AutomationTrigger) => void;
  onDelete: (t: AutomationTrigger) => void;
  onNew: () => void;
}) {
  const isEditing = !!triggerForm.id || triggerForm.key !== "";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative flex flex-col w-full max-w-md h-full overflow-y-auto shadow-2xl"
        style={{ background: "#FDFCFA", borderLeft: "1px solid rgba(197,160,89,0.2)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b" style={{ borderColor: "rgba(197,160,89,0.15)" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(197,160,89,0.12)" }}
            >
              <PenLine size={16} style={{ color: "var(--gold)" }} />
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: "#1C1917", fontFamily: "Georgia, serif" }}>Manage Triggers</h2>
              <p className="text-xs flex items-center gap-1" style={{ color: "#9C9584" }}>
                <Shield size={10} style={{ color: "var(--gold)" }} /> Superadmin only
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100" style={{ color: "#9C9584" }}>
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 px-7 py-6 space-y-5">

          {/* Add / Edit form */}
          <div
            className="rounded-xl p-4 space-y-4"
            style={{ background: "rgba(197,160,89,0.05)", border: "1px solid rgba(197,160,89,0.2)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#7C6D3E" }}>
              {triggerForm.id ? "Edit Trigger" : "Add Custom Trigger"}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#7C6D3E" }}>Key *</label>
                <input
                  type="text"
                  value={triggerForm.key}
                  disabled={!!triggerForm.id}   // key is immutable once created
                  onChange={(e) => setTriggerForm((f) => ({ ...f, key: e.target.value.toLowerCase().replace(/\s/g, "_") }))}
                  placeholder="e.g. follow_up_call"
                  className="w-full px-3 py-2 rounded-xl text-sm border outline-none disabled:opacity-50"
                  style={{ border: "1px solid rgba(197,160,89,0.3)", background: "white", color: "#1C1917", fontFamily: "monospace" }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#7C6D3E" }}>Label *</label>
                <input
                  type="text"
                  value={triggerForm.label}
                  onChange={(e) => setTriggerForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. Follow-up Call"
                  className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                  style={{ border: "1px solid rgba(197,160,89,0.3)", background: "white", color: "#1C1917" }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#7C6D3E" }}>Description</label>
              <input
                type="text"
                value={triggerForm.description}
                onChange={(e) => setTriggerForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Short description of when this fires"
                className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                style={{ border: "1px solid rgba(197,160,89,0.3)", background: "white", color: "#1C1917" }}
              />
            </div>

            {/* Icon picker */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#7C6D3E" }}>Icon</label>
              <div className="flex gap-2 flex-wrap">
                {AVAILABLE_ICONS.map((iconName) => {
                  const Icon   = getTriggerIcon(iconName);
                  const active = triggerForm.icon === iconName;
                  return (
                    <button
                      key={iconName}
                      onClick={() => setTriggerForm((f) => ({ ...f, icon: iconName }))}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                      style={{
                        border: active ? "1px solid rgba(197,160,89,0.6)" : "1px solid rgba(197,160,89,0.2)",
                        background: active ? "rgba(197,160,89,0.15)" : "white",
                      }}
                      title={iconName}
                    >
                      <Icon size={14} style={{ color: active ? "var(--gold)" : "#9C9584" }} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              {triggerForm.id && (
                <button
                  onClick={() => setTriggerForm({ ...EMPTY_TRIGGER_FORM })}
                  className="px-4 py-2 rounded-xl text-xs font-medium border"
                  style={{ border: "1px solid rgba(197,160,89,0.3)", color: "#9C9584" }}
                >
                  Clear
                </button>
              )}
              <button
                onClick={onSave}
                disabled={savingTrigger}
                className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #C5A059, #A8853A)", color: "white" }}
              >
                {savingTrigger ? "Saving…" : triggerForm.id ? "Update Trigger" : "Add Trigger"}
              </button>
            </div>
          </div>

          {/* Triggers list */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#7C6D3E" }}>
                All Triggers ({triggers.length})
              </p>
            </div>

            <div className="space-y-2">
              {triggers.map((t) => {
                const Icon = getTriggerIcon(t.icon);
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl group"
                    style={{ background: "white", border: "1px solid rgba(197,160,89,0.15)" }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(197,160,89,0.1)" }}
                    >
                      <Icon size={14} style={{ color: "var(--gold)" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "#1C1917" }}>{t.label}</p>
                      <p className="text-xs truncate" style={{ color: "#9C9584", fontFamily: "monospace" }}>{t.key}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {t.is_system ? (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(197,160,89,0.1)", color: "#7C6D3E" }}
                        >
                          system
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => onEdit(t)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-opacity"
                            style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)" }}
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => onDelete(t)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-opacity"
                            style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
