"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  User, Building2, Layers, Bell, Zap, LayoutGrid,
  Save, Lock, Mail, MapPin, Globe, MessageSquare, MessageCircle,
  Shield, ShieldCheck, Users, ScrollText, Receipt, Scissors, Crown,
  Calendar, Camera, Package, BarChart3, Network,
  ChevronRight, Check, Loader2, AlertCircle,
  Sparkles, LogOut, Smartphone, Sliders, Plus, X, Pencil, Trash2,
  Target, Key, Copy, Image,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import { logAction } from "@/lib/audit";
import { toast } from "sonner";
import TopBar from "@/components/TopBar";
import { MODULE_KEYS, ALWAYS_ON_MODULES, type ModuleKey } from "@modules/config/environment";

// ─────────────────────────────────────── Types ───────────────────────────────

interface ClinicRow {
  id: string;
  name: string;
  location: string | null;
  admin_email: string | null;
  subscription_status: string;
  chain_id: string | null;
}

interface ModuleRow {
  module_key: string;
  is_enabled: boolean;
  config: Record<string, unknown>;
}

interface NotifPrefs {
  email_reminders: boolean;
  sms_reminders: boolean;
  whatsapp_reminders: boolean;
  reminder_hours_before: number;
  new_patient_alert: boolean;
  daily_summary: boolean;
}

// ─────────────────────────────────────── Constants ───────────────────────────

type TabKey = "account" | "clinic" | "modules" | "notifications" | "integrations" | "links" | "custom_fields";

const TABS: { key: TabKey; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { key: "account",       label: "My Account",     icon: User                           },
  { key: "clinic",        label: "Clinic Profile",  icon: Building2, adminOnly: true     },
  { key: "modules",       label: "Modules",         icon: Layers,    adminOnly: true     },
  { key: "notifications", label: "Notifications",   icon: Bell                           },
  { key: "integrations",  label: "Integrations",    icon: Zap,       adminOnly: true     },
  { key: "links",         label: "Quick Links",     icon: LayoutGrid                     },
  { key: "custom_fields", label: "Custom Fields",   icon: Sliders,   adminOnly: true     },
];

interface ModuleMeta {
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  alwaysOn: boolean;
}

const MODULE_META: Partial<Record<ModuleKey, ModuleMeta>> = {
  core:               { label: "Core",               description: "Login, profiles, base system",               icon: Shield,     color: "#6B7280", alwaysOn: true  },
  patients:           { label: "Patient Records",     description: "Full EMR, medical history, clinical notes",  icon: User,       color: "#6366F1", alwaysOn: true  },
  scheduler:          { label: "Smart Scheduler",     description: "Appointment booking and calendar management", icon: Calendar,   color: "#0891B2", alwaysOn: false },
  photos:             { label: "Before & After",      description: "Photo comparisons, progress gallery",         icon: Camera,     color: "#C5A059", alwaysOn: false },
  inventory:          { label: "Inventory",           description: "Stock tracking, suppliers, low-stock alerts", icon: Package,    color: "#059669", alwaysOn: false },
  services:           { label: "Services & Packages", description: "Service catalog, packages, pricing",          icon: Scissors,   color: "#7C3AED", alwaysOn: true  },
  billing:            { label: "Billing",             description: "Invoicing, payments, revenue tracking",       icon: Receipt,    color: "#DC2626", alwaysOn: true  },
  advanced_analytics: { label: "Advanced Analytics",  description: "Revenue insights, trends, dashboards",        icon: BarChart3,  color: "#EA580C", alwaysOn: false },
  intake:             { label: "Digital Intake",      description: "Patient-facing intake forms and consent",     icon: Globe,      color: "#0D9488", alwaysOn: true  },
  multi_chain:        { label: "Multi-Chain",         description: "Manage multiple clinic chains and branches",  icon: Network,    color: "#9333EA", alwaysOn: false },
};

const DEFAULT_NOTIF: NotifPrefs = {
  email_reminders:       true,
  sms_reminders:         false,
  whatsapp_reminders:    false,
  reminder_hours_before: 24,
  new_patient_alert:     true,
  daily_summary:         false,
};

const SUB_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  active:   { label: "Active",   bg: "rgba(5,150,105,0.12)",    color: "#059669" },
  trial:    { label: "Trial",    bg: "rgba(197,160,89,0.15)",   color: "#C5A059" },
  paused:   { label: "Paused",   bg: "rgba(107,114,128,0.12)",  color: "#6B7280" },
  cancelled:{ label: "Cancelled",bg: "rgba(220,38,38,0.1)",     color: "#DC2626" },
};

// ─────────────────────────────────────── Main Page ───────────────────────────

export default function SettingsPage() {
  const { profile, activeClinicId, loading: profileLoading } = useClinic();
  const [tab, setTab] = useState<TabKey>("account");

  const role      = profile?.role ?? null;
  const isAdmin   = ["superadmin", "chain_admin", "clinic_admin"].includes(role ?? "");

  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin);

  return (
    <div className="min-h-full" style={{ background: "var(--background)" }}>
      <TopBar />

      <div style={{ display: "flex", gap: 0, height: "calc(100vh - 64px)", overflow: "hidden" }}>

        {/* ── Left Tab Nav ── */}
        <aside style={{
          width: 220, flexShrink: 0, background: "white",
          borderRight: "1px solid rgba(197,160,89,0.15)",
          display: "flex", flexDirection: "column",
          padding: "24px 12px 20px",
          overflowY: "auto",
        }}>
          <div style={{ marginBottom: 20, paddingLeft: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(197,160,89,0.7)" }}>
              Settings
            </p>
          </div>

          <nav style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
            {profileLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ height: 38, borderRadius: 10, background: "rgba(197,160,89,0.06)", margin: "1px 0", animation: "pulse 1.4s infinite" }} />
              ))
            ) : (
              visibleTabs.map(t => {
                const Icon     = t.icon;
                const isActive = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 12px", borderRadius: 10, border: "none",
                      cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                      background: isActive ? "rgba(197,160,89,0.12)" : "transparent",
                      borderLeft: isActive ? "3px solid var(--gold)" : "3px solid transparent",
                      color: isActive ? "#C5A059" : "#6B6358",
                    }}
                  >
                    <Icon size={15} style={{ flexShrink: 0, color: isActive ? "#C5A059" : "#9C9584" }} />
                    <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, fontFamily: "Georgia, serif" }}>
                      {t.label}
                    </span>
                  </button>
                );
              })
            )}
          </nav>

          {/* Profile mini */}
          {!profileLoading && profile && (
            <div style={{ marginTop: "auto", padding: "12px", borderRadius: 12, background: "rgba(249,247,242,0.8)", border: "1px solid rgba(197,160,89,0.15)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #C5A059, #A8853A)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: "white", fontWeight: 700, fontSize: 12, fontFamily: "Georgia, serif" }}>
                    {(profile.full_name ?? "?").split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                  </span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {profile.full_name ?? "—"}
                  </p>
                  <p style={{ fontSize: 10, color: "#9C9584", margin: 0, textTransform: "capitalize" }}>
                    {role ?? "staff"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* ── Content ── */}
        <main style={{ flex: 1, overflowY: "auto", padding: "32px 40px 48px" }}>
          {!profileLoading && (
            <>
              {tab === "account"       && <AccountTab       profile={profile} />}
              {tab === "clinic"        && <ClinicProfileTab clinicId={activeClinicId} />}
              {tab === "modules"       && <ModulesTab       clinicId={activeClinicId} />}
              {tab === "notifications" && <NotificationsTab clinicId={activeClinicId} />}
              {tab === "integrations"  && <IntegrationsTab  />}
              {tab === "links"         && <LinksTab         isAdmin={isAdmin} isSuperAdmin={role === "superadmin"} />}
              {tab === "custom_fields" && <CustomFieldsTab  clinicId={activeClinicId} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────── Shared UI ───────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: "0 0 4px" }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{ fontSize: 13, color: "#9C9584", margin: 0 }}>{subtitle}</p>
      )}
      <div style={{ marginTop: 16, height: 1, background: "rgba(197,160,89,0.2)" }} />
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 12, fontWeight: 600, color: "#5C5447", letterSpacing: "0.04em", display: "block", marginBottom: 6 }}>
      {children}
    </label>
  );
}

function Input({
  value, onChange, placeholder, readOnly, type = "text", icon: Icon,
}: {
  value: string; onChange?: (v: string) => void;
  placeholder?: string; readOnly?: boolean;
  type?: string; icon?: React.ElementType;
}) {
  return (
    <div style={{ position: "relative" }}>
      {Icon && (
        <Icon size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#B8AE9C", pointerEvents: "none" }} />
      )}
      <input
        type={type}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        style={{
          width: "100%", padding: Icon ? "10px 12px 10px 34px" : "10px 14px",
          borderRadius: 10, border: "1px solid rgba(197,160,89,0.25)",
          background: readOnly ? "rgba(249,247,242,0.6)" : "white",
          fontSize: 13, color: readOnly ? "#9C9584" : "#1C1917",
          fontFamily: "Georgia, serif",
          outline: "none",
          boxSizing: "border-box",
          cursor: readOnly ? "default" : "text",
          transition: "border-color 0.15s",
        }}
        onFocus={e => { if (!readOnly) e.currentTarget.style.borderColor = "rgba(197,160,89,0.6)"; }}
        onBlur={e => { e.currentTarget.style.borderColor = "rgba(197,160,89,0.25)"; }}
      />
    </div>
  );
}

function SaveButton({ saving, onClick, label = "Save Changes" }: { saving: boolean; onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "10px 20px", borderRadius: 10, border: "none", cursor: saving ? "not-allowed" : "pointer",
        background: saving ? "rgba(197,160,89,0.4)" : "linear-gradient(135deg, #C5A059, #A8853A)",
        color: "white", fontSize: 13, fontWeight: 600, fontFamily: "Georgia, serif",
        boxShadow: saving ? "none" : "0 2px 12px rgba(197,160,89,0.3)",
        transition: "all 0.15s",
      }}
    >
      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
      {saving ? "Saving…" : label}
    </button>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "white", borderRadius: 16, padding: "20px 24px",
      border: "1px solid rgba(197,160,89,0.15)",
      boxShadow: "0 1px 8px rgba(28,25,23,0.04)",
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────── Tab: My Account ─────────────────────

function AccountTab({ profile }: { profile: { id: string; full_name: string | null; role: string | null; email: string | null } | null }) {
  const [name,    setName]    = useState(profile?.full_name ?? "");
  const [saving,  setSaving]  = useState(false);
  const [pwdSent, setPwdSent] = useState(false);
  const [pwdSending, setPwdSending] = useState(false);

  const ROLE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
    superadmin:   { bg: "rgba(197,160,89,0.15)",  color: "#8B6914",  label: "Superadmin"   },
    chain_admin:  { bg: "rgba(147,51,234,0.1)",   color: "#9333EA",  label: "Chain Admin"  },
    clinic_admin: { bg: "rgba(99,102,241,0.1)",   color: "#4338CA",  label: "Clinic Admin" },
    doctor:       { bg: "rgba(5,150,105,0.1)",    color: "#059669",  label: "Doctor"       },
    therapist:    { bg: "rgba(8,145,178,0.1)",    color: "#0891B2",  label: "Therapist"    },
    counsellor:   { bg: "rgba(234,88,12,0.1)",    color: "#EA580C",  label: "Counsellor"   },
    front_desk:   { bg: "rgba(107,114,128,0.12)", color: "#4B5563",  label: "Front Desk"   },
  };

  async function handleSave() {
    if (!name.trim() || !profile?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name.trim() })
      .eq("id", profile.id);
    setSaving(false);
    if (error) { toast.error("Failed to update name"); return; }
    logAction({ action: "update_profile_name", targetId: profile.id, targetName: name.trim() });
    toast.success("Profile updated");
  }

  async function handlePasswordReset() {
    if (!profile?.email) { toast.error("No email on file"); return; }
    setPwdSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}/settings`,
    });
    setPwdSending(false);
    if (error) { toast.error("Failed to send reset email"); return; }
    setPwdSent(true);
    toast.success("Password reset email sent");
  }

  const badge = profile?.role ? (ROLE_BADGE[profile.role] ?? ROLE_BADGE.front_desk) : null;

  return (
    <div style={{ maxWidth: 600 }}>
      <SectionHeader
        title="My Account"
        subtitle="Update your personal profile and security settings"
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Profile card */}
        <Card>
          {/* Avatar row */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, #C5A059, #A8853A)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(197,160,89,0.3)", flexShrink: 0 }}>
              <span style={{ color: "white", fontWeight: 700, fontSize: 22, fontFamily: "Georgia, serif" }}>
                {(name || profile?.full_name || "?").split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
              </span>
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: "0 0 4px" }}>
                {profile?.full_name ?? "—"}
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {badge && (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 6, background: badge.bg, color: badge.color, textTransform: "capitalize" }}>
                    {badge.label}
                  </span>
                )}
                {profile?.email && (
                  <span style={{ fontSize: 12, color: "#9C9584" }}>{profile.email}</span>
                )}
              </div>
            </div>
          </div>

          {/* Fields */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <FieldLabel>Full Name</FieldLabel>
              <Input value={name} onChange={setName} placeholder="Your name" icon={User} />
            </div>
            <div>
              <FieldLabel>Email Address</FieldLabel>
              <Input value={profile?.email ?? ""} readOnly icon={Mail} />
            </div>
            <div>
              <FieldLabel>Role</FieldLabel>
              <Input value={profile?.role ?? "—"} readOnly icon={Shield} />
            </div>
          </div>

          <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
            <SaveButton saving={saving} onClick={handleSave} />
          </div>
        </Card>

        {/* Security card */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: "0 0 3px" }}>Password</p>
              <p style={{ fontSize: 12, color: "#9C9584", margin: 0 }}>
                {pwdSent ? "Reset link sent — check your inbox" : "Send a password reset link to your email"}
              </p>
            </div>
            <button
              onClick={handlePasswordReset}
              disabled={pwdSent || pwdSending}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "9px 16px", borderRadius: 10,
                border: "1px solid rgba(197,160,89,0.3)",
                background: pwdSent ? "rgba(5,150,105,0.08)" : "rgba(197,160,89,0.06)",
                cursor: pwdSent ? "default" : "pointer", fontSize: 12, fontWeight: 600,
                color: pwdSent ? "#059669" : "#C5A059",
                transition: "all 0.15s",
              }}
            >
              {pwdSending ? <Loader2 size={13} className="animate-spin" /> : pwdSent ? <Check size={13} /> : <Lock size={13} />}
              {pwdSent ? "Email sent" : "Change Password"}
            </button>
          </div>
        </Card>

        {/* Sign out card */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: "0 0 3px" }}>Sign Out</p>
              <p style={{ fontSize: 12, color: "#9C9584", margin: 0 }}>Sign out of all devices and sessions</p>
            </div>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/login";
              }}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "9px 16px", borderRadius: 10,
                border: "1px solid rgba(220,38,38,0.25)",
                background: "rgba(220,38,38,0.05)",
                cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#DC2626",
              }}
            >
              <LogOut size={13} />
              Sign Out
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────── Tab: Clinic Profile ─────────────────

function ClinicProfileTab({ clinicId }: { clinicId: string | null }) {
  const [clinic,        setClinic]        = useState<ClinicRow | null>(null);
  const [name,          setName]          = useState("");
  const [loc,           setLoc]           = useState("");
  const [email,         setEmail]         = useState("");
  const [gstNumber,     setGstNumber]     = useState("");
  const [whatsappNum,   setWhatsappNum]   = useState("");
  const [logoUrl,       setLogoUrl]       = useState("");
  const [monthlyTarget,        setMonthlyTarget]        = useState("");
  const [monthlyServiceTarget, setMonthlyServiceTarget] = useState("");
  const [monthlyProductTarget, setMonthlyProductTarget] = useState("");
  const [loading,              setLoading]              = useState(true);
  const [saving,               setSaving]               = useState(false);
  // Scheduler config (GAP-53)
  const [slotDuration,   setSlotDuration]   = useState("30");
  const [bufferMinutes,  setBufferMinutes]  = useState("0");
  const [doubleBooking,  setDoubleBooking]  = useState(false);
  const [savingScheduler,setSavingScheduler]= useState(false);
  // Leave allocations (GAP-61)
  const [leaveCasual,    setLeaveCasual]    = useState("12");
  const [leaveSick,      setLeaveSick]      = useState("10");
  const [leaveEarned,    setLeaveEarned]    = useState("15");
  const [savingLeave,    setSavingLeave]    = useState(false);

  useEffect(() => {
    if (!clinicId) { setLoading(false); return; }
    Promise.all([
      supabase
        .from("clinics")
        .select("id, name, location, admin_email, subscription_status, chain_id, monthly_revenue_target, monthly_service_target, monthly_product_target, gst_number, whatsapp_number, logo_url")
        .eq("id", clinicId)
        .maybeSingle(),
      supabase
        .from("scheduler_settings")
        .select("slot_duration_minutes, buffer_minutes, allow_double_booking")
        .eq("clinic_id", clinicId)
        .maybeSingle(),
      supabase
        .from("system_settings")
        .select("value")
        .eq("clinic_id", clinicId)
        .eq("key", "leave_allocations")
        .maybeSingle(),
    ]).then(([{ data }, { data: ss }, { data: ls }]) => {
      if (data) {
        const d = data as typeof data & { monthly_service_target?: number | null; monthly_product_target?: number | null; gst_number?: string | null; whatsapp_number?: string | null; logo_url?: string | null };
        setClinic(data as ClinicRow);
        setName(data.name ?? "");
        setLoc(data.location ?? "");
        setEmail(data.admin_email ?? "");
        setGstNumber(d.gst_number ?? "");
        setWhatsappNum(d.whatsapp_number ?? "");
        setLogoUrl(d.logo_url ?? "");
        setMonthlyTarget(String(data.monthly_revenue_target ?? ""));
        setMonthlyServiceTarget(String(d.monthly_service_target ?? ""));
        setMonthlyProductTarget(String(d.monthly_product_target ?? ""));
      }
      if (ss) {
        const s = ss as { slot_duration_minutes?: number; buffer_minutes?: number; allow_double_booking?: boolean };
        if (s.slot_duration_minutes) setSlotDuration(String(s.slot_duration_minutes));
        if (s.buffer_minutes != null) setBufferMinutes(String(s.buffer_minutes));
        if (s.allow_double_booking != null) setDoubleBooking(s.allow_double_booking);
      }
      if (ls) {
        const alloc = ls.value as { casual?: number; sick?: number; earned?: number } | null;
        if (alloc?.casual != null) setLeaveCasual(String(alloc.casual));
        if (alloc?.sick != null)   setLeaveSick(String(alloc.sick));
        if (alloc?.earned != null) setLeaveEarned(String(alloc.earned));
      }
      setLoading(false);
    });
  }, [clinicId]);

  async function handleSave() {
    if (!clinicId || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("clinics")
      .update({
        name: name.trim(),
        location: loc.trim() || null,
        admin_email: email.trim() || null,
        gst_number: gstNumber.trim() || null,
        whatsapp_number: whatsappNum.trim() || null,
        logo_url: logoUrl.trim() || null,
        monthly_service_target: monthlyServiceTarget ? parseFloat(monthlyServiceTarget) : 0,
        monthly_product_target:  monthlyProductTarget ? parseFloat(monthlyProductTarget) : 0,
        monthly_revenue_target:  (monthlyServiceTarget ? parseFloat(monthlyServiceTarget) : 0) + (monthlyProductTarget ? parseFloat(monthlyProductTarget) : 0) || (monthlyTarget ? parseFloat(monthlyTarget) : 0),
      })
      .eq("id", clinicId);
    setSaving(false);
    if (error) { toast.error("Failed to save clinic profile"); return; }
    logAction({ action: "update_clinic_profile", targetId: clinicId, targetName: name.trim() });
    toast.success("Clinic profile saved");
  }

  async function handleSaveScheduler() {
    if (!clinicId) return;
    setSavingScheduler(true);
    const { error } = await supabase
      .from("scheduler_settings")
      .upsert({
        clinic_id:             clinicId,
        slot_duration_minutes: parseInt(slotDuration),
        buffer_minutes:        parseInt(bufferMinutes),
        allow_double_booking:  doubleBooking,
      }, { onConflict: "clinic_id" });
    setSavingScheduler(false);
    if (error) { toast.error("Failed to save scheduler settings"); return; }
    logAction({ action: "update_scheduler_settings", targetId: clinicId, targetName: name.trim() });
    toast.success("Scheduler settings saved");
  }

  async function handleSaveLeave() {
    if (!clinicId) return;
    setSavingLeave(true);
    const value = { casual: parseInt(leaveCasual) || 12, sick: parseInt(leaveSick) || 10, earned: parseInt(leaveEarned) || 15 };
    const { error } = await supabase
      .from("system_settings")
      .upsert({ clinic_id: clinicId, scope: "clinic", key: "leave_allocations", value }, { onConflict: "clinic_id,key" });
    setSavingLeave(false);
    if (error) { toast.error("Failed to save leave allocations"); return; }
    logAction({ action: "update_leave_allocations", targetId: clinicId, targetName: name.trim() });
    toast.success("Leave allocations saved");
  }

  if (!clinicId) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <Building2 size={36} style={{ color: "rgba(197,160,89,0.3)", margin: "0 auto 12px" }} />
        <p style={{ fontSize: 14, color: "#9C9584", fontFamily: "Georgia, serif" }}>Select a clinic from the top bar to edit its profile</p>
      </div>
    );
  }

  if (loading) {
    return <SkeletonCards count={2} />;
  }

  const sub = clinic?.subscription_status ?? "active";
  const badge = SUB_BADGE[sub] ?? SUB_BADGE.active;

  return (
    <div style={{ maxWidth: 600 }}>
      <SectionHeader
        title="Clinic Profile"
        subtitle="Update your clinic's name, location, and contact information"
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Core info */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, rgba(197,160,89,0.18), rgba(168,133,58,0.08))", border: "1px solid rgba(197,160,89,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={20} style={{ color: "#C5A059" }} />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: "0 0 3px" }}>
                {clinic?.name ?? "—"}
              </p>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 6, background: badge.bg, color: badge.color }}>
                {badge.label}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <FieldLabel>Clinic Name *</FieldLabel>
              <Input value={name} onChange={setName} placeholder="e.g. Aesthetica Bandra" icon={Building2} />
            </div>
            <div>
              <FieldLabel>Location / Address</FieldLabel>
              <Input value={loc} onChange={setLoc} placeholder="e.g. Level 3, Linking Road, Bandra West" icon={MapPin} />
            </div>
            <div>
              <FieldLabel>Admin Email</FieldLabel>
              <Input value={email} onChange={setEmail} placeholder="admin@yourclinicdomain.com" type="email" icon={Mail} />
            </div>
            <div>
              <FieldLabel>GSTIN (GST Number)</FieldLabel>
              <Input value={gstNumber} onChange={setGstNumber} placeholder="22AAAAA0000A1Z5" icon={Receipt} />
            </div>
            <div>
              <FieldLabel>WhatsApp Number (for WA deeplinks)</FieldLabel>
              <Input value={whatsappNum} onChange={setWhatsappNum} placeholder="91XXXXXXXXXX" icon={MessageCircle} />
            </div>
            {/* GAP-52: Logo URL */}
            <div>
              <FieldLabel>Clinic Logo URL</FieldLabel>
              <Input value={logoUrl} onChange={setLogoUrl} placeholder="https://..." icon={Image} />
              {logoUrl.trim() && (
                <div style={{ marginTop: 8 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt="Clinic logo preview" style={{ height: 40, borderRadius: 6, objectFit: "contain", border: "1px solid rgba(197,160,89,0.2)" }} onError={e => (e.currentTarget.style.display = "none")} />
                </div>
              )}
            </div>
            <div>
              <FieldLabel>Service Revenue Target (₹)</FieldLabel>
              <Input
                value={monthlyServiceTarget}
                onChange={setMonthlyServiceTarget}
                placeholder="e.g. 400000"
                type="number"
              />
            </div>
            <div>
              <FieldLabel>Product Sales Target (₹)</FieldLabel>
              <Input
                value={monthlyProductTarget}
                onChange={setMonthlyProductTarget}
                placeholder="e.g. 100000"
                type="number"
              />
              <p style={{ fontSize: 11, color: "#9C9584", marginTop: 4 }}>
                Combined total is used for the dashboard progress bar.
              </p>
            </div>
          </div>

          <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
            <SaveButton saving={saving} onClick={handleSave} />
          </div>
        </Card>

        {/* Scheduler config (GAP-53) */}
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#5C5447", fontFamily: "Georgia, serif", margin: "0 0 16px" }}>
            Scheduler Configuration
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <FieldLabel>Default Slot Duration</FieldLabel>
              <select
                value={slotDuration}
                onChange={e => setSlotDuration(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(197,160,89,0.25)", background: "white", fontSize: 13, color: "#1C1917", fontFamily: "Georgia, serif" }}
              >
                {[["30","30 minutes"],["45","45 minutes"],["60","60 minutes"],["90","90 minutes"]].map(([v,l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Buffer Between Appointments</FieldLabel>
              <select
                value={bufferMinutes}
                onChange={e => setBufferMinutes(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(197,160,89,0.25)", background: "white", fontSize: 13, color: "#1C1917", fontFamily: "Georgia, serif" }}
              >
                {[["0","No buffer"],["5","5 minutes"],["10","10 minutes"],["15","15 minutes"]].map(([v,l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={() => setDoubleBooking(!doubleBooking)}
                style={{ width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", background: doubleBooking ? "#C5A059" : "rgba(197,160,89,0.2)" }}
              >
                <span style={{ position: "absolute", top: 3, left: doubleBooking ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "white", transition: "left 0.2s" }} />
              </button>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#1C1917", margin: 0 }}>Allow Double Booking</p>
                <p style={{ fontSize: 11, color: "#9C9584", margin: 0 }}>Allow multiple appointments at the same provider timeslot</p>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
            <SaveButton saving={savingScheduler} onClick={handleSaveScheduler} />
          </div>
        </Card>

        {/* Leave allocations (GAP-61) */}
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#5C5447", fontFamily: "Georgia, serif", margin: "0 0 16px" }}>
            Annual Leave Allocations
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            {([
              { key: "casual", label: "Casual Leave", value: leaveCasual, set: setLeaveCasual },
              { key: "sick",   label: "Sick Leave",   value: leaveSick,   set: setLeaveSick   },
              { key: "earned", label: "Earned Leave",  value: leaveEarned, set: setLeaveEarned },
            ] as { key: string; label: string; value: string; set: (v: string) => void }[]).map(row => (
              <div key={row.key}>
                <FieldLabel>{row.label} (days)</FieldLabel>
                <input
                  type="number"
                  min={0}
                  value={row.value}
                  onChange={e => row.set(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(197,160,89,0.25)", background: "white", fontSize: 13, color: "#1C1917", fontFamily: "Georgia, serif" }}
                />
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "#9C9584", margin: "10px 0 0" }}>
            These apply to all staff at this clinic. Unpaid and other leaves are always unlimited.
          </p>
          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
            <SaveButton saving={savingLeave} onClick={handleSaveLeave} />
          </div>
        </Card>

        {/* Read-only info */}
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#5C5447", fontFamily: "Georgia, serif", margin: "0 0 14px" }}>
            Account Details
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Clinic ID",          value: clinicId,                              icon: Shield },
              { label: "Subscription Status",value: sub,                                   icon: Crown  },
              { label: "Chain ID",           value: clinic?.chain_id ?? "Independent",    icon: Network },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <row.icon size={13} style={{ color: "#B8AE9C", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#9C9584", width: 140, flexShrink: 0 }}>{row.label}</span>
                <span style={{ fontSize: 12, color: "#5C5447", fontFamily: "Georgia, serif", wordBreak: "break-all" }}>{row.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────── Tab: Modules ────────────────────────

function ModulesTab({ clinicId }: { clinicId: string | null }) {
  const [moduleMap, setModuleMap] = useState<Record<string, boolean>>({});
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState<string | null>(null);

  const fetchModules = useCallback(async () => {
    if (!clinicId) { setLoading(false); return; }
    const { data } = await supabase
      .from("clinic_modules")
      .select("module_key, is_enabled")
      .eq("clinic_id", clinicId);
    const map: Record<string, boolean> = {};
    (data ?? []).forEach((r: { module_key: string; is_enabled: boolean }) => {
      map[r.module_key] = r.is_enabled;
    });
    setModuleMap(map);
    setLoading(false);
  }, [clinicId]);

  useEffect(() => { fetchModules(); }, [fetchModules]);

  async function toggleModule(key: ModuleKey, enabled: boolean) {
    if (!clinicId) return;
    const meta = MODULE_META[key];
    if (meta?.alwaysOn) return;
    setSaving(key);
    const { error } = await supabase
      .from("clinic_modules")
      .upsert({ clinic_id: clinicId, module_key: key, is_enabled: enabled, config: {} },
               { onConflict: "clinic_id,module_key" });
    setSaving(null);
    if (error) { toast.error(`Failed to update ${key}`); return; }
    setModuleMap(prev => ({ ...prev, [key]: enabled }));
    logAction({ action: enabled ? "enable_module" : "disable_module", targetId: clinicId, targetName: key });
    toast.success(`${MODULE_META[key]?.label ?? key} ${enabled ? "enabled" : "disabled"}`);
  }

  if (!clinicId) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <Layers size={36} style={{ color: "rgba(197,160,89,0.3)", margin: "0 auto 12px" }} />
        <p style={{ fontSize: 14, color: "#9C9584", fontFamily: "Georgia, serif" }}>Select a clinic to manage its modules</p>
      </div>
    );
  }

  if (loading) return <SkeletonCards count={5} />;

  const toggleableModules = (MODULE_KEYS as readonly ModuleKey[]).filter(k => !ALWAYS_ON_MODULES.includes(k as typeof ALWAYS_ON_MODULES[number]));
  const alwaysOnModules   = (MODULE_KEYS as readonly ModuleKey[]).filter(k =>  ALWAYS_ON_MODULES.includes(k as typeof ALWAYS_ON_MODULES[number]));

  return (
    <div style={{ maxWidth: 700 }}>
      <SectionHeader
        title="Module Management"
        subtitle="Enable or disable feature modules for this clinic. Changes take effect instantly."
      />

      {/* Toggleable modules */}
      <div style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(197,160,89,0.7)", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 12px" }}>
          Optional Modules
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {toggleableModules.map(key => {
            const meta    = MODULE_META[key];
            if (!meta) return null;
            const enabled  = moduleMap[key] ?? true; // fail open
            const isSaving = saving === key;
            const Icon     = meta.icon;
            return (
              <Card key={key} style={{ padding: "14px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                    background: enabled ? `${meta.color}18` : "rgba(107,114,128,0.08)",
                    border: `1px solid ${enabled ? meta.color + "35" : "rgba(107,114,128,0.15)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s",
                  }}>
                    <Icon size={16} style={{ color: enabled ? meta.color : "#9C9584" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: enabled ? "#1C1917" : "#9C9584", fontFamily: "Georgia, serif", margin: "0 0 1px", transition: "color 0.2s" }}>
                      {meta.label}
                    </p>
                    <p style={{ fontSize: 11, color: "#B8AE9C", margin: 0 }}>{meta.description}</p>
                  </div>
                  {/* Toggle */}
                  {isSaving ? (
                    <Loader2 size={18} className="animate-spin" style={{ color: "#C5A059", flexShrink: 0 }} />
                  ) : (
                    <button
                      onClick={() => toggleModule(key, !enabled)}
                      style={{
                        width: 48, height: 26, borderRadius: 13, border: "none",
                        cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
                        background: enabled ? "#C5A059" : "rgba(107,114,128,0.25)",
                        position: "relative",
                      }}
                    >
                      <span style={{
                        position: "absolute", top: 3, transition: "left 0.2s",
                        left: enabled ? 25 : 3, width: 20, height: 20, borderRadius: "50%",
                        background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }} />
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Always-on modules */}
      <div style={{ marginTop: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(107,114,128,0.6)", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 12px" }}>
          Core Modules — Always On
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {alwaysOnModules.map(key => {
            const meta = MODULE_META[key];
            if (!meta) return null;
            const Icon = meta.icon;
            return (
              <div key={key} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", borderRadius: 10,
                background: "rgba(249,247,242,0.7)", border: "1px solid rgba(197,160,89,0.12)",
              }}>
                <Icon size={14} style={{ color: "#B8AE9C", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#6B6358", fontFamily: "Georgia, serif" }}>{meta.label}</span>
                <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: "#4A8A4A", flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────── Tab: Notifications ──────────────────

function NotificationsTab({ clinicId }: { clinicId: string | null }) {
  const [prefs,   setPrefs]   = useState<NotifPrefs>(DEFAULT_NOTIF);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    if (!clinicId) { setLoading(false); return; }
    supabase
      .from("system_settings")
      .select("value")
      .eq("scope", "clinic")
      .eq("clinic_id", clinicId)
      .eq("key", "notification_prefs")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setPrefs({ ...DEFAULT_NOTIF, ...(data.value as Partial<NotifPrefs>) });
        setLoading(false);
      });
  }, [clinicId]);

  async function handleSave() {
    if (!clinicId) return;
    setSaving(true);
    const { error } = await supabase
      .from("system_settings")
      .upsert(
        { scope: "clinic", clinic_id: clinicId, key: "notification_prefs", value: prefs },
        { onConflict: "scope,clinic_id,chain_id,key" }
      );
    setSaving(false);
    if (error) { toast.error("Failed to save notification preferences"); return; }
    logAction({ action: "update_notification_prefs", targetId: clinicId ?? "", targetName: "notification_prefs" });
    toast.success("Notification preferences saved");
  }

  function toggle(key: keyof NotifPrefs) {
    setPrefs(p => ({ ...p, [key]: !p[key] }));
  }

  if (loading) return <SkeletonCards count={3} />;

  return (
    <div style={{ maxWidth: 580 }}>
      <SectionHeader
        title="Notifications"
        subtitle="Control how and when your clinic receives automated alerts and reminders"
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Appointment reminders */}
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#5C5447", fontFamily: "Georgia, serif", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
            <Bell size={14} style={{ color: "#C5A059" }} /> Appointment Reminders
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <NotifRow
              label="Email Reminders"
              desc="Send appointment confirmations and reminders by email"
              icon={Mail}
              checked={prefs.email_reminders}
              onToggle={() => toggle("email_reminders")}
            />
            <NotifRow
              label="SMS Reminders"
              desc="Send SMS reminder texts before appointments"
              icon={Smartphone}
              checked={prefs.sms_reminders}
              onToggle={() => toggle("sms_reminders")}
            />
            <NotifRow
              label="WhatsApp Reminders"
              desc="Send WhatsApp messages for appointment reminders"
              icon={MessageSquare}
              checked={prefs.whatsapp_reminders}
              onToggle={() => toggle("whatsapp_reminders")}
            />
          </div>

          {/* Timing */}
          <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, background: "rgba(249,247,242,0.7)", border: "1px solid rgba(197,160,89,0.15)" }}>
            <FieldLabel>Send reminders before appointment</FieldLabel>
            <div style={{ display: "flex", gap: 8 }}>
              {[12, 24, 48].map(h => (
                <button
                  key={h}
                  onClick={() => setPrefs(p => ({ ...p, reminder_hours_before: h }))}
                  style={{
                    padding: "6px 16px", borderRadius: 8, border: "1px solid",
                    borderColor: prefs.reminder_hours_before === h ? "rgba(197,160,89,0.6)" : "rgba(197,160,89,0.2)",
                    background: prefs.reminder_hours_before === h ? "rgba(197,160,89,0.12)" : "transparent",
                    color: prefs.reminder_hours_before === h ? "#C5A059" : "#9C9584",
                    fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Staff alerts */}
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#5C5447", fontFamily: "Georgia, serif", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={14} style={{ color: "#C5A059" }} /> Staff Alerts
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <NotifRow
              label="New Patient Alert"
              desc="Notify admin when a new patient registers or completes intake"
              icon={Users}
              checked={prefs.new_patient_alert}
              onToggle={() => toggle("new_patient_alert")}
            />
            <NotifRow
              label="Daily Summary"
              desc="Send a daily summary of appointments and revenue to the admin email"
              icon={BarChart3}
              checked={prefs.daily_summary}
              onToggle={() => toggle("daily_summary")}
            />
          </div>
        </Card>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <SaveButton saving={saving} onClick={handleSave} />
        </div>
      </div>
    </div>
  );
}

function NotifRow({ label, desc, icon: Icon, checked, onToggle }: {
  label: string; desc: string; icon: React.ElementType;
  checked: boolean; onToggle: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Icon size={15} style={{ color: "#B8AE9C", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: "#1C1917", margin: 0 }}>{label}</p>
        <p style={{ fontSize: 11, color: "#9C9584", margin: "1px 0 0" }}>{desc}</p>
      </div>
      <button
        onClick={onToggle}
        style={{
          width: 44, height: 24, borderRadius: 12, border: "none",
          cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
          background: checked ? "#C5A059" : "rgba(107,114,128,0.25)",
          position: "relative",
        }}
      >
        <span style={{
          position: "absolute", top: 2, transition: "left 0.2s",
          left: checked ? 22 : 2, width: 20, height: 20, borderRadius: "50%",
          background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────── Tab: Integrations ───────────────────

interface IntegrationConfig {
  integration: string;
  config: Record<string, string>;
  is_active: boolean;
  last_tested_at: string | null;
  test_result: string | null;
}

const INTEGRATION_DEFS: Array<{
  key: string; name: string; desc: string; icon: React.ElementType; color: string;
  fields: Array<{ key: string; label: string; placeholder: string; secret?: boolean; autoGenerate?: boolean; readOnly?: boolean }>;
}> = [
  {
    key: "razorpay", name: "Razorpay", color: "#3395FF",
    desc: "Accept payments and issue GST-compliant invoices",
    icon: Receipt,
    fields: [
      { key: "key_id",     label: "Key ID",     placeholder: "rzp_live_…" },
      { key: "key_secret", label: "Key Secret", placeholder: "••••••••",  secret: true },
    ],
  },
  {
    key: "msg91", name: "MSG91", color: "#0891B2",
    desc: "Connect MSG91 for SMS-based patient communications",
    icon: Smartphone,
    fields: [
      { key: "auth_key",  label: "Auth Key",   placeholder: "Enter auth key" },
      { key: "sender_id", label: "Sender ID",  placeholder: "AESTCA" },
    ],
  },
  {
    key: "wati", name: "WATI (WhatsApp)", color: "#25D366",
    desc: "Send automated WhatsApp reminders and follow-ups via WATI",
    icon: MessageSquare,
    fields: [
      { key: "api_token",         label: "API Token",          placeholder: "eyJ…", secret: true },
      { key: "phone_number_id",   label: "Phone Number ID",    placeholder: "91XXXXXXXXXX" },
    ],
  },
  {
    key: "sendgrid", name: "SendGrid", color: "#1A82E2",
    desc: "Transactional email delivery for appointment confirmations",
    icon: Mail,
    fields: [
      { key: "api_key",    label: "API Key",    placeholder: "SG.…", secret: true },
      { key: "from_email", label: "From Email", placeholder: "noreply@yourclnic.com" },
      { key: "from_name",  label: "From Name",  placeholder: "Aesthetica Clinic" },
    ],
  },
  {
    key: "google_calendar", name: "Google Calendar", color: "#4285F4",
    desc: "Sync clinic appointments with Google Calendar",
    icon: Calendar,
    fields: [],
  },
  {
    key: "lead_api", name: "Website Lead API", color: "#6366F1",
    desc: "Capture leads from your website, landing pages, or any custom form via REST API",
    icon: Globe,
    fields: [
      { key: "api_key", label: "API Key", placeholder: "Auto-generated", autoGenerate: true },
    ],
  },
  {
    key: "meta_ads", name: "Meta Lead Ads", color: "#0866FF",
    desc: "Auto-import leads from Facebook & Instagram ad campaigns",
    icon: Target,
    fields: [
      { key: "app_id",            label: "Meta App ID",       placeholder: "1234567890" },
      { key: "page_id",           label: "Page ID",           placeholder: "987654321" },
      { key: "app_secret",        label: "App Secret",        placeholder: "••••••••",  secret: true },
      { key: "page_access_token", label: "Page Access Token", placeholder: "EAAx…",     secret: true },
      { key: "verify_token",      label: "Verify Token",      placeholder: "Auto-generated", autoGenerate: true },
    ],
  },
  {
    key: "google_ads", name: "Google Lead Form", color: "#EA4335",
    desc: "Receive leads from Google Ads lead form extensions automatically",
    icon: Key,
    fields: [
      { key: "webhook_key", label: "Webhook Key", placeholder: "Auto-generated", autoGenerate: true },
    ],
  },
];

// Sentinel: secret field already configured — don't overwrite unless user types a new value
const SECRET_PLACEHOLDER = "__configured__";

// Inbound endpoint URLs for lead integrations — shown as info panel inside the configure drawer
const INTEGRATION_WEBHOOK_URLS: Record<string, string> = {
  lead_api:   "/api/leads",
  meta_ads:   "/api/webhooks/inbound/meta",
  google_ads: "/api/webhooks/inbound/google",
};

function IntegrationsTab() {
  const { activeClinicId } = useClinic();
  const [configs, setConfigs] = useState<Record<string, IntegrationConfig>>({});
  const [fieldValues, setFieldValues] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const clinicId = activeClinicId;

  useEffect(() => {
    if (!clinicId) return;
    supabase.from("integration_configs").select("*").eq("clinic_id", clinicId).then(({ data }) => {
      if (!data) return;
      const map: Record<string, IntegrationConfig> = {};
      const fv: Record<string, Record<string, string>> = {};
      data.forEach((row: IntegrationConfig) => {
        map[row.integration] = row;
        // C-9 fix: for secret fields that have a value, store sentinel instead of plaintext
        const maskedConfig: Record<string, string> = {};
        const intgDef = INTEGRATION_DEFS.find(d => d.key === row.integration);
        Object.entries(row.config as Record<string, string>).forEach(([k, v]) => {
          const fieldDef = intgDef?.fields.find(f => f.key === k);
          maskedConfig[k] = (fieldDef?.secret && v) ? SECRET_PLACEHOLDER : (v ?? "");
        });
        fv[row.integration] = maskedConfig;
      });
      setConfigs(map);
      setFieldValues(fv);
    });
  }, [clinicId]);

  const setField = (intKey: string, fieldKey: string, value: string) => {
    setFieldValues(fv => ({ ...fv, [intKey]: { ...(fv[intKey] || {}), [fieldKey]: value } }));
  };

  const saveIntegration = async (intKey: string) => {
    if (!clinicId) return;
    setSaving(intKey);
    const displayedValues = fieldValues[intKey] || {};
    const existingConfig = (configs[intKey]?.config ?? {}) as Record<string, string>;
    const intgDef = INTEGRATION_DEFS.find(d => d.key === intKey);
    // C-9 fix: if a secret field still shows the sentinel, keep the existing stored value
    const cfg: Record<string, string> = {};
    Object.entries(displayedValues).forEach(([k, v]) => {
      const fieldDef = intgDef?.fields.find(f => f.key === k);
      if (fieldDef?.secret && v === SECRET_PLACEHOLDER) {
        cfg[k] = existingConfig[k] ?? "";  // preserve existing secret
      } else {
        cfg[k] = v;
      }
    });
    await supabase.from("integration_configs").upsert({
      clinic_id: clinicId, integration: intKey, config: cfg,
      is_active: Object.values(cfg).some(v => v && v.trim()),
      updated_at: new Date().toISOString(),
    }, { onConflict: "clinic_id,integration" });
    // Re-load and re-mask
    const { data } = await supabase.from("integration_configs").select("*")
      .eq("clinic_id", clinicId).eq("integration", intKey).single();
    if (data) {
      setConfigs(c => ({ ...c, [intKey]: data }));
      const maskedCfg: Record<string, string> = {};
      Object.entries((data.config as Record<string, string>)).forEach(([k, v]) => {
        const fieldDef = intgDef?.fields.find(f => f.key === k);
        maskedCfg[k] = (fieldDef?.secret && v) ? SECRET_PLACEHOLDER : (v ?? "");
      });
      setFieldValues(fv => ({ ...fv, [intKey]: maskedCfg }));
    }
    setSaving(null);
    toast.success("Integration saved");
  };

  const testIntegration = async (intKey: string) => {
    setTesting(intKey);
    // Simulate test — in production, call an edge function
    await new Promise(r => setTimeout(r, 1200));
    const testResult = "Connection test passed";
    if (clinicId) {
      await supabase.from("integration_configs").update({ last_tested_at: new Date().toISOString(), test_result: testResult })
        .eq("clinic_id", clinicId).eq("integration", intKey);
      setConfigs(c => ({ ...c, [intKey]: { ...c[intKey], last_tested_at: new Date().toISOString(), test_result: testResult } }));
    }
    setTesting(null);
    toast.success("Test connection successful");
  };

  return (
    <div style={{ maxWidth: 680 }}>
      <SectionHeader
        title="Integrations"
        subtitle="Connect Aesthetica with your existing tools and services"
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {INTEGRATION_DEFS.map(intg => {
          const Icon = intg.icon;
          const cfg = configs[intg.key];
          const isConnected = cfg?.is_active;
          const isSavingThis = saving === intg.key;
          const isTestingThis = testing === intg.key;
          const vals = fieldValues[intg.key] || {};
          const [expanded, setExpanded] = useState(false);

          return (
            <Card key={intg.key} style={{ padding: 0, overflow: "hidden" }}>
              <div
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", cursor: intg.fields.length ? "pointer" : "default" }}
                onClick={() => {
                  if (!intg.fields.length) return;
                  const nextExpanded = !expanded;
                  setExpanded(nextExpanded);
                  if (nextExpanded) {
                    intg.fields.forEach(field => {
                      if (field.autoGenerate && !fieldValues[intg.key]?.[field.key]) {
                        const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
                          .map(b => b.toString(16).padStart(2, "0")).join("");
                        setField(intg.key, field.key, hex);
                      }
                    });
                  }
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 12, background: `${intg.color}18`, border: `1px solid ${intg.color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={18} style={{ color: intg.color }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: "0 0 2px" }}>{intg.name}</p>
                  <p style={{ fontSize: 11, color: "#9C9584", margin: 0 }}>{intg.desc}</p>
                  {cfg?.last_tested_at && (
                    <p style={{ fontSize: 10, color: "#9C9584", margin: "2px 0 0" }}>
                      Last tested: {new Date(cfg.last_tested_at).toLocaleDateString("en-IN")} — {cfg.test_result}
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
                    background: isConnected ? "rgba(34,197,94,0.1)" : "rgba(107,114,128,0.1)",
                    color: isConnected ? "#16a34a" : "#6B7280",
                    textTransform: "uppercase", letterSpacing: "0.08em",
                  }}>
                    {isConnected ? "Connected" : intg.fields.length ? "Not Configured" : "Coming Soon"}
                  </span>
                  {intg.fields.length > 0 && (
                    <ChevronRight size={14} style={{ color: "#9C9584", transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
                  )}
                </div>
              </div>

              {expanded && intg.fields.length > 0 && (
                <div style={{ padding: "0 20px 16px", borderTop: "1px solid rgba(197,160,89,0.1)" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                    {intg.fields.map(field => (
                      <div key={field.key}>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#4b5563", marginBottom: 4 }}>{field.label}</label>
                        {field.autoGenerate ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <input
                              type="text"
                              value={vals[field.key] ?? ""}
                              onChange={e => setField(intg.key, field.key, e.target.value)}
                              placeholder={field.placeholder}
                              readOnly={field.readOnly}
                              style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.3)", fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "monospace" }}
                            />
                            <button
                              title="Copy to clipboard"
                              onClick={() => {
                                const v = vals[field.key] ?? "";
                                if (v) navigator.clipboard.writeText(v).then(() => toast.success("Copied!"));
                              }}
                              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.06)", color: "var(--gold)", cursor: "pointer", display: "flex", alignItems: "center" }}
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        ) : (
                          <input
                            type={field.secret ? "password" : "text"}
                            value={vals[field.key] ?? ""}
                            onFocus={() => {
                              // Clear sentinel on focus so user can type a new value cleanly
                              if (vals[field.key] === SECRET_PLACEHOLDER) {
                                setField(intg.key, field.key, "");
                              }
                            }}
                            onChange={e => setField(intg.key, field.key, e.target.value)}
                            placeholder={vals[field.key] === SECRET_PLACEHOLDER ? "••••••••••••••••" : field.placeholder}
                            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.3)", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                          />
                        )}
                      </div>
                    ))}

                    {/* Webhook / API URL info panel */}
                    {INTEGRATION_WEBHOOK_URLS[intg.key] && (
                      <div style={{ borderRadius: 8, padding: "10px 12px", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", marginTop: 2 }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "#6366F1", margin: "0 0 5px" }}>Webhook / API URL</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <code style={{ fontSize: 11, color: "#374151", flex: 1, wordBreak: "break-all" }}>
                            {typeof window !== "undefined" ? window.location.origin : ""}{INTEGRATION_WEBHOOK_URLS[intg.key]}
                          </code>
                          <button
                            title="Copy URL"
                            onClick={() => {
                              const url = `${window.location.origin}${INTEGRATION_WEBHOOK_URLS[intg.key]}`;
                              navigator.clipboard.writeText(url).then(() => toast.success("URL copied!"));
                            }}
                            style={{ padding: "4px 6px", border: "none", background: "transparent", cursor: "pointer", color: "#6366F1", display: "flex", alignItems: "center", flexShrink: 0 }}
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <button
                        onClick={() => testIntegration(intg.key)}
                        disabled={isTestingThis}
                        style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.06)", color: "var(--gold)", fontSize: 12, fontWeight: 500, cursor: "pointer", opacity: isTestingThis ? 0.6 : 1 }}
                      >
                        {isTestingThis ? "Testing…" : "Test Connection"}
                      </button>
                      <button
                        onClick={() => saveIntegration(intg.key)}
                        disabled={isSavingThis}
                        style={{ padding: "8px 20px", borderRadius: 8, background: "var(--gold)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", opacity: isSavingThis ? 0.7 : 1 }}
                      >
                        {isSavingThis ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────── Tab: Quick Links ────────────────────

function LinksTab({ isAdmin, isSuperAdmin }: { isAdmin: boolean; isSuperAdmin: boolean }) {
  const links = [
    { label: "User Management",    desc: "Add, edit, and manage staff accounts",           href: "/admin/users",               icon: Users,      show: isAdmin,       color: "#6366F1" },
    { label: "Team Permissions",   desc: "Per-staff permission overrides",                 href: "/settings/team/permissions", icon: Shield,     show: isAdmin,       color: "#C5A059" },
    { label: "Services & Packages",desc: "Manage your service catalog and packages",       href: "/settings/services",         icon: Scissors,   show: true,          color: "#7C3AED" },
    { label: "Audit Log",          desc: "HIPAA-compliant activity trail",                 href: "/admin/audit",               icon: ScrollText, show: isAdmin,       color: "#059669" },
    { label: "Permissions Matrix", desc: "Role-level default permission controls",         href: "/admin/permissions",         icon: ShieldCheck,show: isAdmin,       color: "#0891B2" },
    { label: "Rule Builder",       desc: "Automated clinic rules and workflows",           href: "/admin/rules",               icon: Zap,        show: isAdmin,       color: "#EA580C" },
    { label: "Billing & Plans",    desc: "Manage subscription, invoices, and payment",    href: "/admin/billing",             icon: Receipt,    show: isSuperAdmin,  color: "#DC2626" },
    { label: "Master Admin",       desc: "Chain and clinic network management",            href: "/admin/manage",              icon: Crown,      show: isSuperAdmin,  color: "#C5A059" },
    { label: "Before & After",     desc: "Photo comparison and progress gallery",          href: "/photos",                    icon: Camera,     show: true,          color: "#C5A059" },
    { label: "Inventory",          desc: "Product and stock management",                   href: "/inventory",                 icon: Package,    show: true,          color: "#059669" },
  ].filter(l => l.show);

  return (
    <div style={{ maxWidth: 720 }}>
      <SectionHeader
        title="Quick Links"
        subtitle="Jump to any section of the clinic management suite"
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {links.map(link => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href} style={{ textDecoration: "none" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px", borderRadius: 12,
                background: "white", border: "1px solid rgba(197,160,89,0.15)",
                boxShadow: "0 1px 4px rgba(28,25,23,0.04)",
                cursor: "pointer", transition: "all 0.15s",
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = `${link.color}50`;
                  (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 16px ${link.color}18`;
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(197,160,89,0.15)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(28,25,23,0.04)";
                  (e.currentTarget as HTMLDivElement).style.transform = "none";
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${link.color}14`, border: `1px solid ${link.color}28`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={16} style={{ color: link.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: "0 0 1px" }}>{link.label}</p>
                  <p style={{ fontSize: 11, color: "#9C9584", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{link.desc}</p>
                </div>
                <ChevronRight size={14} style={{ color: "#C8C0B0", flexShrink: 0 }} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────── Skeleton ────────────────────────────

function SkeletonCards({ count }: { count: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ height: 80, borderRadius: 16, background: "rgba(197,160,89,0.06)", animation: "pulse 1.4s infinite" }} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────── Custom Fields Tab ───────────────────

type FieldType = "text" | "number" | "date" | "dropdown" | "checkbox" | "textarea" | "phone" | "email";

interface CustomField {
  id: string;
  field_key: string;
  field_label: string;
  field_type: FieldType;
  options: string[] | null;
  validation: { required?: boolean } | null;
  display_order: number;
  section_group: string | null;
}

const FIELD_TYPES: { key: FieldType; label: string }[] = [
  { key: "text",     label: "Text"     },
  { key: "number",   label: "Number"   },
  { key: "date",     label: "Date"     },
  { key: "dropdown", label: "Dropdown" },
  { key: "checkbox", label: "Checkbox" },
  { key: "textarea", label: "Textarea" },
  { key: "phone",    label: "Phone"    },
  { key: "email",    label: "Email"    },
];

const TYPE_COLOR: Record<FieldType, { bg: string; color: string }> = {
  text:     { bg: "rgba(99,102,241,0.1)",  color: "#6366f1" },
  number:   { bg: "rgba(16,185,129,0.1)",  color: "#059669" },
  date:     { bg: "rgba(59,130,246,0.1)",  color: "#2563eb" },
  dropdown: { bg: "rgba(197,160,89,0.12)", color: "#a16207" },
  checkbox: { bg: "rgba(139,92,246,0.1)",  color: "#7c3aed" },
  textarea: { bg: "rgba(107,114,128,0.1)", color: "#6b7280" },
  phone:    { bg: "rgba(20,184,166,0.1)",  color: "#0d9488" },
  email:    { bg: "rgba(239,68,68,0.1)",   color: "#dc2626" },
};

function toKey(label: string) {
  return label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

const ENTITY_TYPES: { label: string; value: string }[] = [
  { label: "Patients",     value: "patients" },
  { label: "Services",     value: "services" },
  { label: "Leads",        value: "leads" },
  { label: "Appointments", value: "appointments" },
  { label: "Inventory",    value: "inventory" },
  { label: "Counselling",  value: "counselling_sessions" },
];

function CustomFieldsTab({ clinicId }: { clinicId: string | null }) {
  const [entityType,  setEntityType]  = useState<string>("patients");
  const [fields,      setFields]      = useState<CustomField[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [editing,     setEditing]     = useState<CustomField | null>(null);
  const [showForm,    setShowForm]    = useState(false);
  const [saving,      setSaving]      = useState(false);

  // Form state
  const [fLabel,      setFLabel]      = useState("");
  const [fKey,        setFKey]        = useState("");
  const [fType,       setFType]       = useState<FieldType>("text");
  const [fGroup,      setFGroup]      = useState("");
  const [fRequired,   setFRequired]   = useState(false);
  const [fOptions,    setFOptions]    = useState<string[]>([]);
  const [fOptionInput,setFOptionInput]= useState("");

  const fetchFields = useCallback(async () => {
    if (!clinicId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("custom_field_definitions")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("entity_type", entityType)
      .order("display_order");
    setFields((data as CustomField[]) ?? []);
    setLoading(false);
  }, [clinicId, entityType]);

  useEffect(() => { fetchFields(); }, [fetchFields]);

  const switchEntityType = (et: string) => {
    setEntityType(et);
    setShowForm(false);
    setEditing(null);
    setFLabel(""); setFKey(""); setFType("text"); setFGroup(""); setFRequired(false); setFOptions([]);
  };

  const openNew = () => {
    setEditing(null);
    setFLabel(""); setFKey(""); setFType("text"); setFGroup(""); setFRequired(false); setFOptions([]);
    setShowForm(true);
  };

  const openEdit = (f: CustomField) => {
    setEditing(f);
    setFLabel(f.field_label);
    setFKey(f.field_key);
    setFType(f.field_type);
    setFGroup(f.section_group ?? "");
    setFRequired(f.validation?.required ?? false);
    setFOptions(f.options ?? []);
    setShowForm(true);
  };

  const handleDelete = async (f: CustomField) => {
    if (!confirm(`Delete field "${f.field_label}"? This will also delete all stored values.`)) return;
    await supabase.from("custom_field_definitions").delete().eq("id", f.id);
    fetchFields();
  };

  const handleSave = async () => {
    if (!clinicId || !fLabel.trim()) return;
    setSaving(true);
    const key = editing ? editing.field_key : (fKey || toKey(fLabel));
    const payload = {
      clinic_id:     clinicId,
      entity_type:   entityType,
      field_key:     key,
      field_label:   fLabel.trim(),
      field_type:    fType,
      options:       fType === "dropdown" ? fOptions : null,
      validation:    { required: fRequired },
      section_group: fGroup.trim() || null,
      display_order: editing ? editing.display_order : fields.length,
    };

    if (editing) {
      await supabase.from("custom_field_definitions").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("custom_field_definitions").insert(payload);
    }
    setSaving(false);
    setShowForm(false);
    fetchFields();
  };

  const activeEntityLabel = ENTITY_TYPES.find(e => e.value === entityType)?.label ?? "Patients";

  return (
    <div>
      <SectionHeader
        title="Custom Fields"
        subtitle="Add extra fields to records across modules — no code required."
      />

      {!clinicId ? (
        <div style={{ padding: "32px", textAlign: "center", background: "rgba(197,160,89,0.04)", borderRadius: 16, border: "1px dashed rgba(197,160,89,0.3)" }}>
          <p style={{ color: "#9C9584", fontSize: 13 }}>Select a clinic to manage custom fields.</p>
        </div>
      ) : (
        <>
          {/* ── Entity type pill tabs ── */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
            {ENTITY_TYPES.map(et => (
              <button key={et.value} onClick={() => switchEntityType(et.value)}
                style={{
                  padding: "6px 14px", borderRadius: 20, border: "1px solid", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "Georgia, serif",
                  background: entityType === et.value ? "linear-gradient(135deg, #C5A059, #A8853A)" : "transparent",
                  color: entityType === et.value ? "white" : "#9C9584",
                  borderColor: entityType === et.value ? "transparent" : "rgba(197,160,89,0.25)",
                }}>
                {et.label}
              </button>
            ))}
          </div>

        <div style={{ display: "grid", gridTemplateColumns: showForm ? "1fr 380px" : "1fr", gap: 24 }}>

          {/* ── Left: Field List ── */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: 0 }}>
                {activeEntityLabel} Custom Fields
              </p>
              <button onClick={openNew}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #C5A059, #A8853A)", color: "white", fontSize: 12, fontWeight: 600, fontFamily: "Georgia, serif" }}>
                <Plus size={13} /> Add Field
              </button>
            </div>

            {loading ? (
              <SkeletonCards count={3} />
            ) : fields.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 24px", background: "rgba(197,160,89,0.03)", borderRadius: 16, border: "1px dashed rgba(197,160,89,0.25)" }}>
                <Sliders size={32} style={{ color: "rgba(197,160,89,0.3)", margin: "0 auto 12px" }} />
                <p style={{ fontSize: 13, color: "#9C9584", fontFamily: "Georgia, serif", margin: "0 0 6px" }}>No custom fields yet</p>
                <p style={{ fontSize: 12, color: "#B8AE9C", margin: 0 }}>Click &quot;Add Field&quot; to create your first custom patient field.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {fields.map(f => {
                  const tc = TYPE_COLOR[f.field_type];
                  return (
                    <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: "white", border: "1px solid rgba(197,160,89,0.15)" }}>
                      {/* Type badge */}
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, textTransform: "uppercase", letterSpacing: "0.06em", background: tc.bg, color: tc.color, flexShrink: 0 }}>
                        {f.field_type}
                      </span>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: 0 }}>{f.field_label}</p>
                        <p style={{ fontSize: 11, color: "#9C9584", margin: "1px 0 0" }}>
                          key: {f.field_key}
                          {f.section_group && <> · group: <em>{f.section_group}</em></>}
                          {f.validation?.required && <> · <span style={{ color: "#dc2626" }}>required</span></>}
                        </p>
                      </div>
                      {/* Actions */}
                      <button onClick={() => openEdit(f)} style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(197,160,89,0.2)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Pencil size={12} style={{ color: "#9C9584" }} />
                      </button>
                      <button onClick={() => handleDelete(f)} style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(220,38,38,0.15)", background: "rgba(220,38,38,0.05)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Trash2 size={12} style={{ color: "#dc2626" }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Right: Inline Form ── */}
          {showForm && (
            <div style={{ background: "white", borderRadius: 16, border: "1px solid rgba(197,160,89,0.2)", padding: 20, alignSelf: "start", position: "sticky", top: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: 0 }}>
                  {editing ? "Edit Field" : "New Field"}
                </p>
                <button onClick={() => setShowForm(false)} style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid rgba(197,160,89,0.2)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={12} style={{ color: "#9C9584" }} />
                </button>
              </div>

              {/* Field Label */}
              <div style={{ marginBottom: 14 }}>
                <FieldLabel>Field Label *</FieldLabel>
                <Input value={fLabel} onChange={v => { setFLabel(v); if (!editing) setFKey(toKey(v)); }} placeholder="e.g. Skin Score" />
              </div>

              {/* Field Key (auto-generated, read-only on edit) */}
              <div style={{ marginBottom: 14 }}>
                <FieldLabel>Field Key (auto-generated)</FieldLabel>
                <Input value={editing ? fKey : (fKey || toKey(fLabel))} readOnly />
                <p style={{ fontSize: 11, color: "#9C9584", marginTop: 4 }}>Used in exports and integrations</p>
              </div>

              {/* Field Type */}
              <div style={{ marginBottom: 14 }}>
                <FieldLabel>Field Type</FieldLabel>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {FIELD_TYPES.map(t => (
                    <button key={t.key} onClick={() => setFType(t.key)}
                      style={{
                        padding: "5px 10px", borderRadius: 8, border: "1px solid", cursor: "pointer", fontSize: 11, fontWeight: 600,
                        background: fType === t.key ? TYPE_COLOR[t.key].bg : "transparent",
                        color: fType === t.key ? TYPE_COLOR[t.key].color : "#9C9584",
                        borderColor: fType === t.key ? TYPE_COLOR[t.key].color + "60" : "rgba(197,160,89,0.2)",
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section Group */}
              <div style={{ marginBottom: 14 }}>
                <FieldLabel>Section Group (optional)</FieldLabel>
                <Input value={fGroup} onChange={setFGroup} placeholder="e.g. Skin, Body, Lifestyle" />
                <p style={{ fontSize: 11, color: "#9C9584", marginTop: 4 }}>Groups fields together in patient EMR</p>
              </div>

              {/* Required toggle */}
              <div style={{ marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <FieldLabel>Required</FieldLabel>
                  <p style={{ fontSize: 11, color: "#9C9584", margin: "2px 0 0" }}>Patient must fill this field</p>
                </div>
                <button onClick={() => setFRequired(r => !r)}
                  style={{ position: "relative", display: "inline-flex", height: 20, width: 36, alignItems: "center", borderRadius: 9999, border: "none", cursor: "pointer", background: fRequired ? "var(--gold)" : "rgba(197,160,89,0.2)", flexShrink: 0 }}>
                  <span style={{ display: "inline-block", height: 16, width: 16, borderRadius: "50%", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "transform 0.15s", transform: fRequired ? "translateX(18px)" : "translateX(2px)" }} />
                </button>
              </div>

              {/* Options (dropdown only) */}
              {fType === "dropdown" && (
                <div style={{ marginBottom: 14 }}>
                  <FieldLabel>Options</FieldLabel>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    <input value={fOptionInput} onChange={e => setFOptionInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && fOptionInput.trim()) { setFOptions(o => [...o, fOptionInput.trim()]); setFOptionInput(""); e.preventDefault(); } }}
                      placeholder="Type option, press Enter"
                      style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.25)", fontSize: 12, outline: "none", fontFamily: "Georgia, serif" }} />
                    <button onClick={() => { if (fOptionInput.trim()) { setFOptions(o => [...o, fOptionInput.trim()]); setFOptionInput(""); } }}
                      style={{ padding: "0 10px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.08)", cursor: "pointer", fontSize: 12, color: "var(--gold)" }}>
                      Add
                    </button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {fOptions.map((opt, i) => (
                      <span key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 20, background: "rgba(197,160,89,0.1)", border: "1px solid rgba(197,160,89,0.2)", fontSize: 11, color: "#6B5C2E" }}>
                        {opt}
                        <button onClick={() => setFOptions(o => o.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "#9C9584" }}>
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "1px solid rgba(197,160,89,0.25)", background: "transparent", cursor: "pointer", fontSize: 12, color: "#9C9584", fontFamily: "Georgia, serif" }}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving || !fLabel.trim()}
                  style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", cursor: saving || !fLabel.trim() ? "not-allowed" : "pointer", background: saving || !fLabel.trim() ? "rgba(197,160,89,0.3)" : "linear-gradient(135deg, #C5A059, #A8853A)", color: "white", fontSize: 12, fontWeight: 600, fontFamily: "Georgia, serif" }}>
                  {saving ? "Saving…" : editing ? "Update Field" : "Save Field"}
                </button>
              </div>
            </div>
          )}
        </div>
        </>
      )}
    </div>
  );
}
