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

// ── Template preview ──────────────────────────────────────────────────────────

function buildPreview(template: string, form: RuleForm): string {
  return template
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
      message_template:    ruleForm.message_template,
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

      {/* ── Rules list ── */}
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
