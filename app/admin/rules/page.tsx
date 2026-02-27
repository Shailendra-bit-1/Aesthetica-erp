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
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

type Trigger = "after_treatment" | "low_stock" | "new_lead" | "appointment_noshow";
type Action  = "send_whatsapp"  | "email_care_instructions" | "nudge_receptionist";
type Status  = "active" | "paused";

interface AutomationRule {
  id: string;
  name: string;
  trigger: Trigger;
  condition_treatment: string | null;
  condition_days: number | null;
  condition_product: string | null;
  condition_quantity: number | null;
  condition_source: string | null;
  condition_hours: number | null;
  action: Action;
  message_template: string;
  is_global: boolean;
  clinic_id: string | null;
  status: Status;
  created_at: string;
}

interface Clinic {
  id: string;
  name: string;
}

interface RuleForm {
  name: string;
  trigger: Trigger | "";
  condition_treatment: string;
  condition_days: string;
  condition_product: string;
  condition_quantity: string;
  condition_source: string;
  condition_hours: string;
  action: Action | "";
  message_template: string;
  is_global: boolean;
  clinic_id: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TRIGGERS: { value: Trigger; label: string; icon: React.ElementType; description: string }[] = [
  { value: "after_treatment",      label: "After Treatment",      icon: Sparkles,  description: "Fires after a treatment session is completed" },
  { value: "low_stock",            label: "Low Stock",            icon: Package,   description: "Fires when a product falls below threshold" },
  { value: "new_lead",             label: "New Lead",             icon: UserCheck, description: "Fires when a new lead is registered" },
  { value: "appointment_noshow",   label: "Appointment No-show",  icon: CalendarX, description: "Fires when a patient misses their appointment" },
];

const ACTIONS: { value: Action; label: string; icon: React.ElementType; description: string }[] = [
  { value: "send_whatsapp",          label: "Send WhatsApp",           icon: MessageSquare, description: "Send a WhatsApp message to the patient" },
  { value: "email_care_instructions",label: "Email Care Instructions", icon: Mail,          description: "Send a post-care email to the patient" },
  { value: "nudge_receptionist",     label: "Nudge Receptionist",      icon: Bell,          description: "Send an internal alert to the front desk" },
];

const TRIGGER_LABELS: Record<Trigger, string> = {
  after_treatment:     "After Treatment",
  low_stock:           "Low Stock",
  new_lead:            "New Lead",
  appointment_noshow:  "Appointment No-show",
};

const ACTION_LABELS: Record<Action, string> = {
  send_whatsapp:           "Send WhatsApp",
  email_care_instructions: "Email Care Instructions",
  nudge_receptionist:      "Nudge Receptionist",
};

const TRIGGER_ICONS: Record<Trigger, React.ElementType> = {
  after_treatment:     Sparkles,
  low_stock:           Package,
  new_lead:            UserCheck,
  appointment_noshow:  CalendarX,
};

const ACTION_ICONS: Record<Action, React.ElementType> = {
  send_whatsapp:           MessageSquare,
  email_care_instructions: Mail,
  nudge_receptionist:      Bell,
};

const DEFAULT_TEMPLATES: Record<Action, string> = {
  send_whatsapp: "Hi {patient_name}, thank you for your {treatment_name} session at {clinic_name}! 🌿 Here are your aftercare tips: avoid direct sunlight for {days} days and keep the area moisturised. We look forward to seeing you again — {doctor_name}",
  email_care_instructions: "Dear {patient_name},\n\nThank you for choosing {clinic_name} for your {treatment_name} treatment.\n\nPlease follow these care instructions for the next {days} days:\n• Avoid direct sunlight and apply SPF 50+\n• Keep the area hydrated with a gentle moisturiser\n• Avoid makeup for 24 hours\n\nIf you have any concerns, please don't hesitate to reach out.\n\nWarm regards,\n{doctor_name}\n{clinic_name}",
  nudge_receptionist: "📌 Patient Follow-up Required\n\nPatient: {patient_name}\nTreatment: {treatment_name}\nClinic: {clinic_name}\n\nPlease reach out to schedule a follow-up appointment within {hours} hours.\n\nNext available slots: {next_appointment}",
};

const EMPTY_FORM: RuleForm = {
  name: "",
  trigger: "",
  condition_treatment: "",
  condition_days: "3",
  condition_product: "",
  condition_quantity: "5",
  condition_source: "",
  condition_hours: "2",
  action: "",
  message_template: "",
  is_global: true,
  clinic_id: "",
};

// ── Template preview helpers ───────────────────────────────────────────────────

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
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("automation_rules")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setRules(data as AutomationRule[]);
    setLoading(false);
  }, []);

  const fetchClinics = useCallback(async () => {
    const { data } = await supabase.from("clinics").select("id, name").order("name");
    if (data) setClinics(data);
  }, []);

  useEffect(() => {
    fetchRules();
    fetchClinics();
  }, [fetchRules, fetchClinics]);

  // Auto-set template when action changes
  function handleActionChange(action: Action | "") {
    setForm((f) => ({
      ...f,
      action,
      message_template: action ? (f.message_template || DEFAULT_TEMPLATES[action]) : "",
    }));
  }

  // Auto-set template when trigger changes (reset conditions)
  function handleTriggerChange(trigger: Trigger | "") {
    setForm((f) => ({
      ...f,
      trigger,
      condition_treatment: "",
      condition_days: "3",
      condition_product: "",
      condition_quantity: "5",
      condition_source: "",
      condition_hours: "2",
    }));
  }

  async function handleSave() {
    if (!form.name.trim() || !form.trigger || !form.action) {
      toast.error("Please fill in Name, Trigger, and Action.");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      trigger: form.trigger,
      condition_treatment: form.trigger === "after_treatment" ? (form.condition_treatment || null) : null,
      condition_days: form.trigger === "after_treatment" ? (parseInt(form.condition_days) || null) : null,
      condition_product: form.trigger === "low_stock" ? (form.condition_product || null) : null,
      condition_quantity: form.trigger === "low_stock" ? (parseInt(form.condition_quantity) || null) : null,
      condition_source: form.trigger === "new_lead" ? (form.condition_source || null) : null,
      condition_hours: (form.trigger === "new_lead" || form.trigger === "appointment_noshow") ? (parseInt(form.condition_hours) || null) : null,
      action: form.action,
      message_template: form.message_template,
      is_global: form.is_global,
      clinic_id: !form.is_global && form.clinic_id ? form.clinic_id : null,
      status: "active" as Status,
    };

    const { error } = await supabase.from("automation_rules").insert(payload);
    setSaving(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Rule created successfully.");
      setDrawerOpen(false);
      setForm(EMPTY_FORM);
      fetchRules();
    }
  }

  async function handleToggleStatus(rule: AutomationRule) {
    const next: Status = rule.status === "active" ? "paused" : "active";
    const { error } = await supabase
      .from("automation_rules")
      .update({ status: next })
      .eq("id", rule.id);
    if (error) {
      toast.error(error.message);
    } else {
      setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, status: next } : r));
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("automation_rules").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Rule deleted.");
      setRules((prev) => prev.filter((r) => r.id !== id));
    }
  }

  // Stats
  const total   = rules.length;
  const active  = rules.filter((r) => r.status === "active").length;
  const global  = rules.filter((r) => r.is_global).length;
  const local   = rules.filter((r) => !r.is_global).length;

  return (
    <div className="flex-1 overflow-y-auto p-8" style={{ background: "var(--background)" }}>

      {/* ── Hero ── */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(197,160,89,0.15)", border: "1px solid rgba(197,160,89,0.3)" }}
            >
              <Zap size={22} style={{ color: "var(--gold)" }} />
            </div>
            <div>
              <h1
                className="text-2xl font-semibold"
                style={{ color: "#1C1917", fontFamily: "Georgia, serif" }}
              >
                Rule Builder
              </h1>
              <p className="text-sm mt-0.5" style={{ color: "#9C9584" }}>
                Automate patient care nudges and internal alerts
              </p>
            </div>
          </div>

          <button
            onClick={() => { setForm(EMPTY_FORM); setDrawerOpen(true); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #C5A059, #A8853A)",
              color: "white",
              boxShadow: "0 2px 12px rgba(197,160,89,0.35)",
            }}
          >
            <Plus size={16} />
            New Rule
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Rules", value: total,  sub: "all nudges" },
          { label: "Active",      value: active, sub: "running now", gold: true },
          { label: "Global",      value: global, sub: "all clinics" },
          { label: "Clinic-Only", value: local,  sub: "targeted" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl p-5"
            style={{
              background: "white",
              border: s.gold ? "1px solid rgba(197,160,89,0.4)" : "1px solid rgba(197,160,89,0.12)",
              boxShadow: "0 1px 3px rgba(28,25,23,0.04)",
            }}
          >
            <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: "#9C9584" }}>
              {s.label}
            </p>
            <p className="text-3xl font-light mb-0.5" style={{ color: s.gold ? "var(--gold)" : "#1C1917", fontFamily: "Georgia, serif" }}>
              {s.value}
            </p>
            <p className="text-xs" style={{ color: "#B8AE9C" }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Rules Table ── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "white",
          border: "1px solid rgba(197,160,89,0.15)",
          boxShadow: "0 1px 4px rgba(28,25,23,0.05)",
        }}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: "rgba(197,160,89,0.12)" }}>
          <h2 className="text-base font-semibold" style={{ color: "#1C1917", fontFamily: "Georgia, serif" }}>
            Active Nudges
          </h2>
          {rules.length > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)" }}>
              {rules.length} rule{rules.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-14 rounded-lg animate-pulse" style={{ background: "rgba(197,160,89,0.05)" }} />
            ))}
          </div>
        ) : rules.length === 0 ? (
          <EmptyState onNew={() => { setForm(EMPTY_FORM); setDrawerOpen(true); }} />
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ background: "rgba(249,247,242,0.8)" }}>
                {["Rule", "Trigger", "Action", "Scope", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs uppercase tracking-widest font-medium"
                    style={{ color: "#9C9584" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "rgba(197,160,89,0.07)" }}>
              {rules.map((rule) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  clinics={clinics}
                  onToggle={handleToggleStatus}
                  onDelete={handleDelete}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Drawer ── */}
      {mounted && drawerOpen && createPortal(
        <RuleDrawer
          form={form}
          setForm={setForm}
          clinics={clinics}
          saving={saving}
          onClose={() => setDrawerOpen(false)}
          onSave={handleSave}
          onTriggerChange={handleTriggerChange}
          onActionChange={handleActionChange}
        />,
        document.body
      )}
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="py-20 flex flex-col items-center gap-5">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(197,160,89,0.1)", border: "1px solid rgba(197,160,89,0.2)" }}
      >
        <Zap size={28} style={{ color: "var(--gold)", opacity: 0.7 }} />
      </div>
      <div className="text-center">
        <p className="text-base font-medium mb-1" style={{ color: "#1C1917", fontFamily: "Georgia, serif" }}>
          No rules yet
        </p>
        <p className="text-sm" style={{ color: "#9C9584" }}>
          Create your first automation to start nudging patients automatically.
        </p>
      </div>
      <button
        onClick={onNew}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
        style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)", border: "1px solid rgba(197,160,89,0.25)" }}
      >
        <Plus size={15} />
        Create first rule
      </button>
    </div>
  );
}

// ── Rule Row ───────────────────────────────────────────────────────────────────

function RuleRow({
  rule,
  clinics,
  onToggle,
  onDelete,
}: {
  rule: AutomationRule;
  clinics: Clinic[];
  onToggle: (r: AutomationRule) => void;
  onDelete: (id: string) => void;
}) {
  const TriggerIcon = TRIGGER_ICONS[rule.trigger];
  const ActionIcon  = ACTION_ICONS[rule.action];
  const clinic      = clinics.find((c) => c.id === rule.clinic_id);
  const isActive    = rule.status === "active";

  return (
    <tr className="group hover:bg-amber-50/30 transition-colors">
      {/* Rule name */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(197,160,89,0.1)" }}
          >
            <Zap size={13} style={{ color: "var(--gold)" }} />
          </div>
          <span className="text-sm font-medium" style={{ color: "#1C1917", fontFamily: "Georgia, serif" }}>
            {rule.name}
          </span>
        </div>
      </td>

      {/* Trigger */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <TriggerIcon size={13} style={{ color: "var(--gold)", opacity: 0.7 }} />
          <span className="text-sm" style={{ color: "#5C5447" }}>
            {TRIGGER_LABELS[rule.trigger]}
          </span>
        </div>
      </td>

      {/* Action */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <ActionIcon size={13} style={{ color: "#7C6A99" }} />
          <span className="text-sm" style={{ color: "#5C5447" }}>
            {ACTION_LABELS[rule.action]}
          </span>
        </div>
      </td>

      {/* Scope */}
      <td className="px-6 py-4">
        {rule.is_global ? (
          <div className="flex items-center gap-1.5">
            <Globe size={12} style={{ color: "#9C9584" }} />
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(100,160,100,0.1)", color: "#4A8A4A" }}>
              Global
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Building2 size={12} style={{ color: "#9C9584" }} />
            <span className="text-xs px-2 py-0.5 rounded-full truncate max-w-[120px]" style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)" }}>
              {clinic?.name ?? "Clinic"}
            </span>
          </div>
        )}
      </td>

      {/* Status */}
      <td className="px-6 py-4">
        <button
          onClick={() => onToggle(rule)}
          className="flex items-center gap-2 group/toggle"
        >
          {isActive ? (
            <ToggleRight size={20} style={{ color: "#4A8A4A" }} />
          ) : (
            <ToggleLeft size={20} style={{ color: "#9C9584" }} />
          )}
          <span
            className="text-xs font-medium"
            style={{ color: isActive ? "#4A8A4A" : "#9C9584" }}
          >
            {isActive ? "Active" : "Paused"}
          </span>
        </button>
      </td>

      {/* Actions */}
      <td className="px-6 py-4">
        <button
          onClick={() => onDelete(rule.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50"
          title="Delete rule"
        >
          <Trash2 size={14} style={{ color: "#D47070" }} />
        </button>
      </td>
    </tr>
  );
}

// ── Rule Drawer ────────────────────────────────────────────────────────────────

function RuleDrawer({
  form,
  setForm,
  clinics,
  saving,
  onClose,
  onSave,
  onTriggerChange,
  onActionChange,
}: {
  form: RuleForm;
  setForm: React.Dispatch<React.SetStateAction<RuleForm>>;
  clinics: Clinic[];
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onTriggerChange: (t: Trigger | "") => void;
  onActionChange: (a: Action | "") => void;
}) {
  const previewText = form.message_template ? buildPreview(form.message_template, form) : "";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity"
        style={{ background: "rgba(28,25,23,0.5)", backdropFilter: "blur(2px)" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col"
        style={{
          width: 760,
          background: "var(--background)",
          boxShadow: "-8px 0 40px rgba(28,25,23,0.18)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-7 py-5 border-b flex-shrink-0"
          style={{ borderColor: "rgba(197,160,89,0.18)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(197,160,89,0.15)", border: "1px solid rgba(197,160,89,0.3)" }}
            >
              <Zap size={16} style={{ color: "var(--gold)" }} />
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: "#1C1917", fontFamily: "Georgia, serif" }}>
                New Automation Rule
              </h2>
              <p className="text-xs" style={{ color: "#9C9584" }}>Configure trigger, conditions, and action</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-amber-50 transition-colors"
          >
            <X size={16} style={{ color: "#9C9584" }} />
          </button>
        </div>

        {/* Body — two columns */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left: Form (scrollable) ── */}
          <div className="flex-1 overflow-y-auto px-7 py-6 space-y-6" style={{ borderRight: "1px solid rgba(197,160,89,0.12)" }}>

            {/* Rule Name */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-widest mb-2" style={{ color: "#9C9584" }}>
                Rule Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Post-Hydrafacial Care Follow-up"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: "white",
                  border: "1px solid rgba(197,160,89,0.25)",
                  color: "#1C1917",
                  fontFamily: "Georgia, serif",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(197,160,89,0.6)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(197,160,89,0.25)")}
              />
            </div>

            {/* Trigger */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-widest mb-2" style={{ color: "#9C9584" }}>
                Trigger
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TRIGGERS.map((t) => {
                  const Icon = t.icon;
                  const selected = form.trigger === t.value;
                  return (
                    <button
                      key={t.value}
                      onClick={() => onTriggerChange(t.value)}
                      className="flex items-start gap-3 p-3.5 rounded-xl text-left transition-all"
                      style={{
                        background: selected ? "rgba(197,160,89,0.12)" : "white",
                        border: selected ? "1px solid rgba(197,160,89,0.5)" : "1px solid rgba(197,160,89,0.18)",
                      }}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: selected ? "rgba(197,160,89,0.2)" : "rgba(197,160,89,0.08)" }}
                      >
                        <Icon size={13} style={{ color: "var(--gold)" }} />
                      </div>
                      <div>
                        <p className="text-sm font-medium" style={{ color: selected ? "#1C1917" : "#5C5447", fontFamily: "Georgia, serif" }}>
                          {t.label}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "#9C9584" }}>{t.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Condition Builder (dynamic) */}
            {form.trigger && (
              <div
                className="rounded-xl p-4 space-y-4"
                style={{ background: "white", border: "1px solid rgba(197,160,89,0.18)" }}
              >
                <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "#9C9584" }}>
                  Condition
                </p>
                <ConditionBuilder form={form} setForm={setForm} />
              </div>
            )}

            {/* Action */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-widest mb-2" style={{ color: "#9C9584" }}>
                Action
              </label>
              <div className="space-y-2">
                {ACTIONS.map((a) => {
                  const Icon = a.icon;
                  const selected = form.action === a.value;
                  return (
                    <button
                      key={a.value}
                      onClick={() => onActionChange(a.value)}
                      className="w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all"
                      style={{
                        background: selected ? "rgba(197,160,89,0.1)" : "white",
                        border: selected ? "1px solid rgba(197,160,89,0.45)" : "1px solid rgba(197,160,89,0.18)",
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: selected ? "rgba(197,160,89,0.2)" : "rgba(197,160,89,0.07)" }}
                      >
                        <Icon size={15} style={{ color: "var(--gold)" }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium" style={{ color: selected ? "#1C1917" : "#5C5447", fontFamily: "Georgia, serif" }}>
                          {a.label}
                        </p>
                        <p className="text-xs" style={{ color: "#9C9584" }}>{a.description}</p>
                      </div>
                      {selected && (
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ background: "var(--gold)" }}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message Template */}
            {form.action && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium uppercase tracking-widest" style={{ color: "#9C9584" }}>
                    Message Template
                  </label>
                  <span className="text-xs" style={{ color: "#B8AE9C" }}>
                    Use &#123;patient_name&#125;, &#123;treatment_name&#125;, &#123;days&#125;, &#123;clinic_name&#125;
                  </span>
                </div>
                <textarea
                  value={form.message_template}
                  onChange={(e) => setForm((f) => ({ ...f, message_template: e.target.value }))}
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none transition-all"
                  style={{
                    background: "white",
                    border: "1px solid rgba(197,160,89,0.25)",
                    color: "#1C1917",
                    lineHeight: 1.7,
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(197,160,89,0.6)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(197,160,89,0.25)")}
                />
              </div>
            )}

            {/* Scope */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-widest mb-3" style={{ color: "#9C9584" }}>
                Scope
              </label>
              <div className="flex gap-2 mb-4">
                {[
                  { label: "Global", value: true,  icon: Globe,     desc: "Applies to all clinics" },
                  { label: "Clinic", value: false, icon: Building2, desc: "Applies to one clinic" },
                ].map((opt) => {
                  const Icon = opt.icon;
                  const sel = form.is_global === opt.value;
                  return (
                    <button
                      key={String(opt.value)}
                      onClick={() => setForm((f) => ({ ...f, is_global: opt.value }))}
                      className="flex-1 flex items-center gap-2.5 p-3 rounded-xl transition-all"
                      style={{
                        background: sel ? "rgba(197,160,89,0.12)" : "white",
                        border: sel ? "1px solid rgba(197,160,89,0.45)" : "1px solid rgba(197,160,89,0.18)",
                      }}
                    >
                      <Icon size={14} style={{ color: sel ? "var(--gold)" : "#9C9584" }} />
                      <div className="text-left">
                        <p className="text-sm font-medium" style={{ color: sel ? "#1C1917" : "#5C5447", fontFamily: "Georgia, serif" }}>
                          {opt.label}
                        </p>
                        <p className="text-xs" style={{ color: "#9C9584" }}>{opt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Clinic selector */}
              {!form.is_global && (
                <div className="relative">
                  <select
                    value={form.clinic_id}
                    onChange={(e) => setForm((f) => ({ ...f, clinic_id: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none appearance-none pr-10"
                    style={{
                      background: "white",
                      border: "1px solid rgba(197,160,89,0.25)",
                      color: form.clinic_id ? "#1C1917" : "#9C9584",
                    }}
                  >
                    <option value="">Select a clinic…</option>
                    {clinics.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#9C9584" }} />
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Live Preview (sticky) ── */}
          <div
            className="w-72 flex-shrink-0 overflow-y-auto px-5 py-6"
            style={{ background: "rgba(249,247,242,0.5)" }}
          >
            <div className="flex items-center gap-2 mb-5">
              <Eye size={13} style={{ color: "#9C9584" }} />
              <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "#9C9584" }}>
                Live Preview
              </p>
            </div>

            {form.action ? (
              <LivePreview action={form.action as Action} preview={previewText} form={form} />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(197,160,89,0.08)", border: "1px solid rgba(197,160,89,0.15)" }}
                >
                  <Eye size={18} style={{ color: "rgba(197,160,89,0.4)" }} />
                </div>
                <p className="text-xs text-center" style={{ color: "#B8AE9C" }}>
                  Select an action to see the preview
                </p>
              </div>
            )}

            {/* Template variables reference */}
            <div
              className="mt-6 rounded-xl p-4"
              style={{ background: "white", border: "1px solid rgba(197,160,89,0.15)" }}
            >
              <p className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: "#9C9584" }}>
                Variables
              </p>
              <div className="space-y-1.5">
                {[
                  ["{patient_name}",    "Sarah Mitchell"],
                  ["{treatment_name}", "Hydrafacial"],
                  ["{clinic_name}",    "Aesthetica Clinic"],
                  ["{doctor_name}",    "Dr. Reyes"],
                  ["{days}",           "3"],
                  ["{hours}",          "2"],
                  ["{next_appointment}", "March 5th"],
                ].map(([key, sample]) => (
                  <div key={key} className="flex items-center justify-between gap-2">
                    <code className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)", fontFamily: "monospace", fontSize: 10 }}>
                      {key}
                    </code>
                    <span className="text-xs truncate" style={{ color: "#9C9584" }}>{sample}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-7 py-4 border-t flex-shrink-0"
          style={{ borderColor: "rgba(197,160,89,0.18)", background: "white" }}
        >
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ color: "#9C9584", border: "1px solid rgba(197,160,89,0.2)" }}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving || !form.name || !form.trigger || !form.action}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #C5A059, #A8853A)",
              color: "white",
              boxShadow: "0 2px 10px rgba(197,160,89,0.3)",
            }}
          >
            <Zap size={15} />
            {saving ? "Saving…" : "Save Rule"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Condition Builder ──────────────────────────────────────────────────────────

function ConditionBuilder({ form, setForm }: { form: RuleForm; setForm: React.Dispatch<React.SetStateAction<RuleForm>> }) {
  const inputStyle = {
    background: "rgba(249,247,242,0.8)",
    border: "1px solid rgba(197,160,89,0.2)",
    color: "#1C1917",
    borderRadius: 10,
    fontSize: 14,
    padding: "10px 14px",
    outline: "none",
    width: "100%",
  };

  const labelStyle = { fontSize: 11, color: "#9C9584", fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.08em", display: "block", marginBottom: 6 };

  if (form.trigger === "after_treatment") {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label style={labelStyle}>If treatment is</label>
          <input
            type="text"
            placeholder="e.g. Hydrafacial (or leave blank for any)"
            value={form.condition_treatment}
            onChange={(e) => setForm((f) => ({ ...f, condition_treatment: e.target.value }))}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Send after (days)</label>
          <input
            type="number"
            min={1}
            value={form.condition_days}
            onChange={(e) => setForm((f) => ({ ...f, condition_days: e.target.value }))}
            style={inputStyle}
          />
        </div>
      </div>
    );
  }

  if (form.trigger === "low_stock") {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label style={labelStyle}>Product name</label>
          <input
            type="text"
            placeholder="e.g. Vitamin C Serum (or leave blank for any)"
            value={form.condition_product}
            onChange={(e) => setForm((f) => ({ ...f, condition_product: e.target.value }))}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Alert when below (units)</label>
          <input
            type="number"
            min={1}
            value={form.condition_quantity}
            onChange={(e) => setForm((f) => ({ ...f, condition_quantity: e.target.value }))}
            style={inputStyle}
          />
        </div>
      </div>
    );
  }

  if (form.trigger === "new_lead") {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label style={labelStyle}>If source is</label>
          <input
            type="text"
            placeholder="e.g. Instagram (or leave blank for any)"
            value={form.condition_source}
            onChange={(e) => setForm((f) => ({ ...f, condition_source: e.target.value }))}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Follow up within (hours)</label>
          <input
            type="number"
            min={1}
            value={form.condition_hours}
            onChange={(e) => setForm((f) => ({ ...f, condition_hours: e.target.value }))}
            style={inputStyle}
          />
        </div>
      </div>
    );
  }

  if (form.trigger === "appointment_noshow") {
    return (
      <div className="max-w-xs">
        <label style={labelStyle}>Send alert after (hours)</label>
        <input
          type="number"
          min={1}
          value={form.condition_hours}
          onChange={(e) => setForm((f) => ({ ...f, condition_hours: e.target.value }))}
          style={inputStyle}
        />
      </div>
    );
  }

  return null;
}

// ── Live Preview ───────────────────────────────────────────────────────────────

function LivePreview({ action, preview, form }: { action: Action; preview: string; form: RuleForm }) {
  if (action === "send_whatsapp") {
    return (
      <div className="rounded-2xl overflow-hidden shadow-md" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
        {/* WhatsApp header */}
        <div className="px-4 py-3 flex items-center gap-3" style={{ background: "#075E54" }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: "#128C7E" }}>
            SM
          </div>
          <div>
            <p className="text-xs font-semibold text-white">Sarah Mitchell</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>online</p>
          </div>
          <Smartphone size={14} className="ml-auto" style={{ color: "rgba(255,255,255,0.5)" }} />
        </div>

        {/* Chat area */}
        <div className="px-3 py-4 space-y-2" style={{ background: "#ECE5DD", minHeight: 120 }}>
          <div className="flex justify-end">
            <div
              className="max-w-[90%] rounded-2xl rounded-tr-sm px-3 py-2 text-xs leading-relaxed"
              style={{ background: "#DCF8C6", color: "#1C1917" }}
            >
              {preview || "Your message will appear here…"}
              <p className="text-right mt-1" style={{ color: "#9C9584", fontSize: 10 }}>11:42 AM ✓✓</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (action === "email_care_instructions") {
    return (
      <div
        className="rounded-2xl overflow-hidden shadow-sm"
        style={{ background: "white", border: "1px solid rgba(197,160,89,0.2)" }}
      >
        {/* Email header */}
        <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(197,160,89,0.12)" }}>
          <div className="flex items-center gap-2 mb-2">
            <Mail size={13} style={{ color: "var(--gold)" }} />
            <span className="text-xs font-semibold" style={{ color: "#1C1917", fontFamily: "Georgia, serif" }}>
              {form.name || "Care Instructions"}
            </span>
          </div>
          <p className="text-xs" style={{ color: "#9C9584" }}>
            <span className="font-medium" style={{ color: "#5C5447" }}>To: </span>sarah.mitchell@example.com
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#9C9584" }}>
            <span className="font-medium" style={{ color: "#5C5447" }}>Subject: </span>Your Post-Treatment Care Guide
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "#5C5447" }}>
            {preview || "Your email body will appear here…"}
          </p>
        </div>
      </div>
    );
  }

  if (action === "nudge_receptionist") {
    return (
      <div
        className="rounded-2xl overflow-hidden shadow-sm"
        style={{ border: "1px solid rgba(197,160,89,0.2)" }}
      >
        {/* Dark notification header */}
        <div
          className="px-4 py-3 flex items-center gap-2"
          style={{ background: "#1C1917" }}
        >
          <Bell size={13} style={{ color: "var(--gold)" }} />
          <span className="text-xs font-semibold" style={{ color: "var(--gold)", fontFamily: "Georgia, serif" }}>
            Internal Alert
          </span>
          <span
            className="ml-auto text-xs px-1.5 py-0.5 rounded font-bold"
            style={{ background: "rgba(197,160,89,0.2)", color: "var(--gold)", fontSize: 9 }}
          >
            NOW
          </span>
        </div>
        <div className="px-4 py-3" style={{ background: "rgba(249,247,242,0.9)" }}>
          <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "#5C5447" }}>
            {preview || "Internal alert message will appear here…"}
          </p>
        </div>
      </div>
    );
  }

  return null;
}
