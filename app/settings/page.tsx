"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  User, Building2, Layers, Bell, Zap, LayoutGrid,
  Save, Lock, Mail, MapPin, Globe, MessageSquare,
  Shield, ShieldCheck, Users, ScrollText, Receipt, Scissors, Crown,
  Calendar, Camera, Package, BarChart3, Network,
  ChevronRight, Check, Loader2, AlertCircle,
  Sparkles, LogOut, Smartphone,
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

type TabKey = "account" | "clinic" | "modules" | "notifications" | "integrations" | "links";

const TABS: { key: TabKey; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { key: "account",       label: "My Account",     icon: User                        },
  { key: "clinic",        label: "Clinic Profile",  icon: Building2, adminOnly: true  },
  { key: "modules",       label: "Modules",         icon: Layers,    adminOnly: true  },
  { key: "notifications", label: "Notifications",   icon: Bell                        },
  { key: "integrations",  label: "Integrations",    icon: Zap,       adminOnly: true  },
  { key: "links",         label: "Quick Links",     icon: LayoutGrid                  },
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
  const [clinic,  setClinic]  = useState<ClinicRow | null>(null);
  const [name,    setName]    = useState("");
  const [loc,     setLoc]     = useState("");
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    if (!clinicId) { setLoading(false); return; }
    supabase
      .from("clinics")
      .select("id, name, location, admin_email, subscription_status, chain_id")
      .eq("id", clinicId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setClinic(data as ClinicRow);
          setName(data.name ?? "");
          setLoc(data.location ?? "");
          setEmail(data.admin_email ?? "");
        }
        setLoading(false);
      });
  }, [clinicId]);

  async function handleSave() {
    if (!clinicId || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("clinics")
      .update({ name: name.trim(), location: loc.trim() || null, admin_email: email.trim() || null })
      .eq("id", clinicId);
    setSaving(false);
    if (error) { toast.error("Failed to save clinic profile"); return; }
    logAction({ action: "update_clinic_profile", targetId: clinicId, targetName: name.trim() });
    toast.success("Clinic profile saved");
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
          </div>

          <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
            <SaveButton saving={saving} onClick={handleSave} />
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

function IntegrationsTab() {
  const integrations = [
    {
      name: "WhatsApp Business",
      desc: "Send automated appointment reminders and follow-ups via WhatsApp",
      icon: MessageSquare,
      color: "#25D366",
      status: "coming_soon" as const,
    },
    {
      name: "SMS Gateway",
      desc: "Connect Twilio or MSG91 for SMS-based patient communications",
      icon: Smartphone,
      color: "#0891B2",
      status: "coming_soon" as const,
    },
    {
      name: "Google Calendar",
      desc: "Sync clinic appointments with Google Calendar",
      icon: Calendar,
      color: "#4285F4",
      status: "coming_soon" as const,
    },
    {
      name: "Razorpay",
      desc: "Accept payments and issue GST-compliant invoices",
      icon: Receipt,
      color: "#3395FF",
      status: "coming_soon" as const,
    },
    {
      name: "Zoho CRM",
      desc: "Sync patient leads and follow-up tasks with Zoho CRM",
      icon: Globe,
      color: "#E42527",
      status: "coming_soon" as const,
    },
  ];

  return (
    <div style={{ maxWidth: 680 }}>
      <SectionHeader
        title="Integrations"
        subtitle="Connect Aesthetica with your existing tools and services"
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {integrations.map(intg => {
          const Icon = intg.icon;
          return (
            <Card key={intg.name} style={{ padding: "14px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: `${intg.color}18`, border: `1px solid ${intg.color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={18} style={{ color: intg.color }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: "0 0 2px" }}>{intg.name}</p>
                  <p style={{ fontSize: 11, color: "#9C9584", margin: 0 }}>{intg.desc}</p>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
                  background: "rgba(107,114,128,0.1)", color: "#6B7280",
                  textTransform: "uppercase", letterSpacing: "0.08em",
                }}>
                  Coming Soon
                </span>
              </div>
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
