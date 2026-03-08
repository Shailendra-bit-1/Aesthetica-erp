"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  ChevronDown, Building2, LogOut, Check, AlertTriangle, X,
  Grid3X3, Settings, LayoutDashboard, Users, Calendar, Receipt,
  Target, BarChart2, Search, User, Package, Camera, Boxes,
  UserCog, Wallet, MessageSquare, Stethoscope, FlaskConical,
  Webhook, Puzzle, BookOpen, ClipboardList, CreditCard, Globe,
  FileClock,
} from "lucide-react";
import { useClinic } from "@/contexts/ClinicContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { supabase } from "@/lib/supabase";
import NotificationCenter from "@/components/NotificationCenter";

// ── Primary Nav ────────────────────────────────────────────────────────────

const PRIMARY_NAV = [
  { label: "Dashboard",  href: "/",              icon: LayoutDashboard },
  { label: "Patients",   href: "/patients",       icon: Users           },
  { label: "Scheduler",  href: "/scheduler",      icon: Calendar        },
  { label: "Billing",    href: "/billing",        icon: Receipt         },
  { label: "CRM",        href: "/crm",            icon: Target          },
  { label: "Reports",    href: "/admin/reports",  icon: BarChart2       },
];

// ── Apps Grid ──────────────────────────────────────────────────────────────

const APPS = [
  {
    section: "PATIENT MANAGEMENT",
    items: [
      { label: "Patients",       href: "/patients",      icon: Users          },
      { label: "Medical Records",href: "/patients",      icon: Stethoscope    },
      { label: "Intake Portal",  href: "/admin/forms",   icon: ClipboardList  },
    ],
  },
  {
    section: "OPERATIONS",
    items: [
      { label: "Scheduler",      href: "/scheduler",     icon: Calendar       },
      { label: "Inventory",      href: "/inventory",     icon: Boxes          },
      { label: "Photos",         href: "/photos",        icon: Camera         },
    ],
  },
  {
    section: "SALES",
    items: [
      { label: "CRM",            href: "/crm",           icon: Target         },
      { label: "Counselling",    href: "/counselling",   icon: MessageSquare  },
      { label: "Memberships",    href: "/membership",    icon: CreditCard     },
    ],
  },
  {
    section: "FINANCE",
    items: [
      { label: "Billing",        href: "/billing",       icon: Receipt        },
      { label: "Payroll",        href: "/payroll",       icon: Wallet         },
      { label: "Services",       href: "/settings/services", icon: Package    },
    ],
  },
  {
    section: "ADMIN",
    items: [
      { label: "Staff HR",       href: "/staff",              icon: UserCog       },
      { label: "Form Builder",   href: "/admin/forms",        icon: BookOpen      },
      { label: "Reports",        href: "/admin/reports",      icon: BarChart2     },
      { label: "Simulator",      href: "/admin/simulator",    icon: FlaskConical  },
      { label: "God Mode",       href: "/admin/god-mode",     icon: Globe         },
    ],
  },
  {
    section: "SETTINGS",
    items: [
      { label: "Settings",       href: "/settings",           icon: Settings      },
      { label: "Webhooks",       href: "/admin/webhooks",     icon: Webhook       },
      { label: "Plugins",        href: "/admin/plugins",      icon: Puzzle        },
      { label: "Audit Log",      href: "/admin/audit",        icon: FileClock     },
    ],
  },
];

// ══════════════════════════════════════════════════════════════════════════════

export default function TopBar() {
  const router   = useRouter();
  const pathname = usePathname();
  const { profile, clinics, activeClinicId, setActiveClinicId, loading } = useClinic();
  const { isImpersonating, impersonated, stopImpersonation } = useImpersonation();

  const [clinicOpen,  setClinicOpen]  = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [appsOpen,    setAppsOpen]    = useState(false);
  const [cmdOpen,     setCmdOpen]     = useState(false);

  const clinicRef  = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const appsRef    = useRef<HTMLDivElement>(null);

  const initials     = profile?.full_name?.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() ?? "—";
  const activeClinic = clinics.find(c => c.id === activeClinicId);
  const canSwitch    = !loading && (profile?.role === "superadmin" || profile?.role === "chain_admin") && clinics.length > 0;

  // Close dropdowns on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (clinicRef.current  && !clinicRef.current.contains(e.target  as Node)) setClinicOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (appsRef.current    && !appsRef.current.contains(e.target    as Node)) setAppsOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  // Cmd+K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen(true); }
      if (e.key === "Escape") { setAppsOpen(false); setClinicOpen(false); setProfileOpen(false); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* ── Impersonation Banner ─────────────────────────────────────────── */}
      {isImpersonating && impersonated && (
        <div style={{
          background: "rgba(217,119,6,0.1)",
          borderBottom: "1px solid rgba(217,119,6,0.35)",
          padding: "7px 24px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          position: "fixed", top: 0, left: 0, right: 0, zIndex: "calc(var(--z-topbar) + 1)" as unknown as number,
        }}>
          <AlertTriangle size={13} style={{ color: "#B45309", flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "#92400E" }}>
            <strong>View Mode:</strong> Viewing as{" "}
            <strong style={{ color: "#78350F" }}>{impersonated.clinicName}</strong>
          </span>
          <button
            onClick={stopImpersonation}
            style={{
              padding: "2px 8px", borderRadius: 6,
              border: "1px solid rgba(217,119,6,0.4)",
              background: "rgba(217,119,6,0.1)", cursor: "pointer",
              color: "#92400E", fontSize: 11, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 3,
            }}
          >
            <X size={10} /> Exit View Mode
          </button>
        </div>
      )}

      {/* ── Main TopBar ──────────────────────────────────────────────────── */}
      <header style={{
        background: "var(--primary)",
        height: 64,
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        gap: 0,
        position: "fixed",
        top: isImpersonating ? 36 : 0,
        left: 0,
        right: 0,
        zIndex: "var(--z-topbar)" as React.CSSProperties["zIndex"],
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
      }}>

        {/* ── Logo + Wordmark ─────────────────────────────────────────── */}
        <Link href="/" style={{
          display: "flex", alignItems: "center", gap: 8,
          textDecoration: "none", marginRight: 20, flexShrink: 0,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: "rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 800, color: "#fff",
          }}>A</div>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>
            Aesthetica
          </span>
        </Link>

        {/* ── Clinic Switcher ──────────────────────────────────────────── */}
        {canSwitch && (
          <div ref={clinicRef} style={{ position: "relative", marginRight: 12, flexShrink: 0 }}>
            <button
              onClick={() => setClinicOpen(o => !o)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 10px", borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.2)",
                background: clinicOpen ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)",
                cursor: "pointer", color: "#fff",
              }}
            >
              <Building2 size={12} />
              <span style={{ fontSize: 12, fontWeight: 500, maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {activeClinic?.name ?? "All Clinics"}
              </span>
              <ChevronDown size={11} style={{ opacity: 0.7, transform: clinicOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </button>

            {clinicOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", left: 0,
                minWidth: 240, background: "#fff",
                borderRadius: 12, border: "1px solid var(--border)",
                boxShadow: "var(--shadow-lg)", zIndex: 200, overflow: "hidden",
              }}>
                <div style={{ padding: "8px 12px 6px", borderBottom: "1px solid var(--border)" }}>
                  <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", margin: 0 }}>
                    Switch Clinic
                  </p>
                </div>
                <button
                  onClick={() => { setActiveClinicId(null); setClinicOpen(false); }}
                  style={{ width: "100%", padding: "8px 12px", textAlign: "left", border: "none", background: activeClinicId === null ? "var(--primary-subtle)" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
                >
                  <Building2 size={12} style={{ color: "var(--text-muted)" }} />
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1 }}>All Clinics</span>
                  {activeClinicId === null && <Check size={11} style={{ color: "var(--primary)" }} />}
                </button>
                {clinics.map(c => (
                  <button key={c.id} onClick={() => { setActiveClinicId(c.id); setClinicOpen(false); }}
                    style={{ width: "100%", padding: "8px 12px", textAlign: "left", border: "none", background: activeClinicId === c.id ? "var(--primary-subtle)" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid var(--border)" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.subscription_status === "active" ? "var(--success)" : "var(--text-muted)", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                      {c.location && <p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0 }}>{c.location}</p>}
                    </div>
                    {activeClinicId === c.id && <Check size={11} style={{ color: "var(--primary)" }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Primary Nav Links ─────────────────────────────────────────── */}
        <nav style={{ display: "flex", alignItems: "center", gap: 2, flex: 1, overflow: "hidden" }}>
          {PRIMARY_NAV.map(item => (
            <Link key={item.href} href={item.href} style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "6px 10px", borderRadius: 8, textDecoration: "none",
              fontSize: 13, fontWeight: isActive(item.href) ? 600 : 400,
              color: isActive(item.href) ? "#fff" : "rgba(255,255,255,0.72)",
              background: isActive(item.href) ? "rgba(255,255,255,0.15)" : "transparent",
              transition: "all 0.15s ease",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={e => { if (!isActive(item.href)) (e.currentTarget as HTMLElement).style.color = "#fff"; }}
            onMouseLeave={e => { if (!isActive(item.href)) (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.72)"; }}
            >
              <item.icon size={13} />
              <span className="hidden md:inline">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* ── Right Controls ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>

          {/* Apps Menu */}
          <div ref={appsRef} style={{ position: "relative" }}>
            <button
              onClick={() => setAppsOpen(o => !o)}
              title="Apps"
              style={{
                width: 34, height: 34, borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.2)",
                background: appsOpen ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff",
              }}
            >
              <Grid3X3 size={15} />
            </button>

            {appsOpen && (
              <div style={{
                position: "fixed",
                top: 72, right: 16,
                width: 560,
                background: "#fff",
                borderRadius: 16,
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-xl)",
                zIndex: 200,
                padding: 20,
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 20,
              }}>
                {APPS.map(group => (
                  <div key={group.section}>
                    <p style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", marginBottom: 8, marginTop: 0 }}>
                      {group.section}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {group.items.map(item => (
                        <Link key={item.href + item.label} href={item.href}
                          onClick={() => setAppsOpen(false)}
                          style={{
                            display: "flex", alignItems: "center", gap: 7,
                            padding: "6px 8px", borderRadius: 8,
                            textDecoration: "none", color: "var(--text-primary)",
                            fontSize: 13, fontWeight: 500,
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "var(--primary-subtle)")}
                          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                        >
                          <item.icon size={13} style={{ color: "var(--primary)", flexShrink: 0 }} />
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cmd+K Search */}
          <button
            onClick={() => setCmdOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "6px 12px", borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.08)",
              cursor: "pointer", color: "rgba(255,255,255,0.75)",
              fontSize: 12, minWidth: 160,
            }}
          >
            <Search size={12} />
            <span style={{ flex: 1, textAlign: "left" }}>Search…</span>
            <kbd style={{ padding: "1px 4px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.25)", fontSize: 10, color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.05)" }}>⌘K</kbd>
          </button>

          {/* Notifications */}
          <div style={{ color: "#fff" }}>
            <NotificationCenter />
          </div>

          {/* Settings */}
          <button
            onClick={() => router.push("/settings")}
            title="Settings"
            style={{
              width: 34, height: 34, borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.08)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(255,255,255,0.75)",
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.15)")}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)")}
          >
            <Settings size={14} />
          </button>

          {/* Profile */}
          <div ref={profileRef} style={{ position: "relative" }}>
            <button
              onClick={() => setProfileOpen(o => !o)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                cursor: "pointer", background: "transparent", border: "none",
                padding: "4px 6px", borderRadius: 8,
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700,
                background: "rgba(255,255,255,0.2)",
                color: "#fff", border: "1.5px solid rgba(255,255,255,0.35)",
                flexShrink: 0,
              }}>
                {loading ? "…" : initials}
              </div>
              <ChevronDown size={11} style={{ color: "rgba(255,255,255,0.7)", transform: profileOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </button>

            {profileOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0,
                minWidth: 200, background: "#fff",
                borderRadius: 12, border: "1px solid var(--border)",
                boxShadow: "var(--shadow-lg)", zIndex: 200, overflow: "hidden",
              }}>
                <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", background: "var(--primary-subtle)" }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                    {profile?.full_name ?? "—"}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "2px 0 0", textTransform: "capitalize" }}>
                    {profile?.role ?? "—"}
                  </p>
                </div>
                <button
                  onClick={() => { router.push("/settings"); setProfileOpen(false); }}
                  style={{ width: "100%", padding: "9px 14px", textAlign: "left", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)", fontSize: 13 }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "var(--primary-subtle)")}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                >
                  <User size={13} style={{ color: "var(--text-muted)" }} />
                  Profile & Settings
                </button>
                <button
                  onClick={handleSignOut}
                  style={{ width: "100%", padding: "9px 14px", textAlign: "left", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: "var(--error)", fontSize: 13, borderTop: "1px solid var(--border)" }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "var(--error-bg)")}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                >
                  <LogOut size={13} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── CommandBar ────────────────────────────────────────────────────── */}
      {cmdOpen && <CommandBarInline onClose={() => setCmdOpen(false)} pathname={pathname} />}
    </>
  );
}

// ── Inline CommandBar (C5) ─────────────────────────────────────────────────

interface CmdItem {
  id: string;
  label: string;
  subtitle?: string;
  href?: string;
  action?: () => void;
  category: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
}

function CommandBarInline({ onClose, pathname }: { onClose: () => void; pathname: string }) {
  const router  = useRouter();
  const { profile, activeClinicId } = useClinic();
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState<CmdItem[]>([]);
  const [idx,     setIdx]     = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const NAV_COMMANDS: CmdItem[] = [
    { id: "nav-dashboard",  label: "Go to Dashboard",  href: "/",                category: "Navigate", icon: LayoutDashboard },
    { id: "nav-patients",   label: "Go to Patients",   href: "/patients",        category: "Navigate", icon: Users           },
    { id: "nav-scheduler",  label: "Go to Scheduler",  href: "/scheduler",       category: "Navigate", icon: Calendar        },
    { id: "nav-billing",    label: "Go to Billing",    href: "/billing",         category: "Navigate", icon: Receipt         },
    { id: "nav-crm",        label: "Go to CRM",        href: "/crm",             category: "Navigate", icon: Target          },
    { id: "nav-inventory",  label: "Go to Inventory",  href: "/inventory",       category: "Navigate", icon: Boxes           },
    { id: "nav-membership", label: "Go to Memberships",href: "/membership",      category: "Navigate", icon: CreditCard      },
    { id: "nav-staff",      label: "Go to Staff HR",   href: "/staff",           category: "Navigate", icon: UserCog         },
    { id: "nav-settings",   label: "Go to Settings",   href: "/settings",        category: "Navigate", icon: Settings        },
    ...(profile?.role === "superadmin" ? [
      { id: "nav-godmode", label: "God Mode", href: "/admin/god-mode", category: "Admin", icon: Globe },
      { id: "nav-reports", label: "Reports",  href: "/admin/reports",  category: "Admin", icon: BarChart2 },
      { id: "nav-chains",  label: "Chains & Clinics", href: "/admin/chains", category: "Admin", icon: Building2 },
    ] : []),
  ];

  const QUICK_CREATE: CmdItem[] = [
    { id: "new-patient",     label: "New Patient",      subtitle: "Add a new patient record", category: "Create", icon: Users, href: "/patients?new=1"      },
    { id: "new-appointment", label: "New Appointment",  subtitle: "Schedule an appointment",  category: "Create", icon: Calendar, href: "/scheduler?new=1"  },
    { id: "new-invoice",     label: "New Invoice",      subtitle: "Create an invoice",        category: "Create", icon: Receipt, href: "/billing?new=1"     },
    { id: "new-lead",        label: "New Lead",         subtitle: "Add a CRM lead",           category: "Create", icon: Target, href: "/crm?new=1"          },
  ];

  // F5: Contextual smart suggestions based on current page + role
  const SMART_SUGGESTIONS: CmdItem[] = (() => {
    const suggestions: CmdItem[] = [];
    // Page-specific suggestions
    if (pathname === "/" || pathname.startsWith("/dashboard")) {
      suggestions.push(
        { id: "s-today-appts", label: "View Today's Appointments", subtitle: "See your schedule for today", href: "/scheduler", category: "Suggested", icon: Calendar },
        { id: "s-pending-inv", label: "Check Pending Invoices",    subtitle: "Review unpaid invoices",       href: "/billing",   category: "Suggested", icon: Receipt  },
      );
    }
    if (pathname.startsWith("/patients")) {
      suggestions.push(
        { id: "s-new-appt-p",  label: "Book Appointment for Patient",  subtitle: "Schedule on the scheduler",   href: "/scheduler?new=1", category: "Suggested", icon: Calendar },
        { id: "s-new-invoice", label: "Create Invoice for Patient",    subtitle: "Open billing page",           href: "/billing?new=1",   category: "Suggested", icon: Receipt  },
      );
    }
    if (pathname.startsWith("/scheduler")) {
      suggestions.push(
        { id: "s-availability", label: "Manage Staff Availability", subtitle: "Set weekly schedules", href: "/staff", category: "Suggested", icon: UserCog },
        { id: "s-new-patient",  label: "Add a New Patient",         subtitle: "Register before booking", href: "/patients?new=1", category: "Suggested", icon: Users },
      );
    }
    if (pathname.startsWith("/billing")) {
      suggestions.push(
        { id: "s-inv-report",  label: "Revenue Report",        subtitle: "Open reports page",    href: "/admin/reports", category: "Suggested", icon: BarChart2 },
        { id: "s-memberships", label: "Manage Memberships",    subtitle: "Wallet & plans",        href: "/membership",    category: "Suggested", icon: CreditCard },
      );
    }
    if (pathname.startsWith("/crm")) {
      suggestions.push(
        { id: "s-campaigns",  label: "View Campaigns",         subtitle: "Check CRM campaigns",  href: "/crm",            category: "Suggested", icon: Target },
        { id: "s-counselling",label: "Counselling Pipeline",   subtitle: "Conversion pipeline",  href: "/counselling",    category: "Suggested", icon: MessageSquare },
      );
    }
    if (pathname.startsWith("/inventory")) {
      suggestions.push(
        { id: "s-po", label: "Create Purchase Order", subtitle: "Order low-stock items", href: "/inventory", category: "Suggested", icon: Package },
      );
    }
    // Role-specific suggestions
    if (profile?.role === "superadmin") {
      suggestions.push({ id: "s-godmode", label: "Open God Mode", subtitle: "Platform admin controls", href: "/admin/god-mode", category: "Suggested", icon: Globe });
    }
    if (["clinic_admin","chain_admin","superadmin"].includes(profile?.role ?? "")) {
      suggestions.push({ id: "s-invite", label: "Invite Staff Member", subtitle: "Staff HR → Directory", href: "/staff", category: "Suggested", icon: UserCog });
    }
    return suggestions.slice(0, 4);
  })();

  // On mount: show suggestions + quick create
  useEffect(() => {
    setResults([...SMART_SUGGESTIONS, ...QUICK_CREATE]);
    inputRef.current?.focus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([...SMART_SUGGESTIONS, ...QUICK_CREATE]);
      setIdx(0);
      return;
    }
    const lower = q.toLowerCase();

    // Filter nav + suggestions
    const navHits    = NAV_COMMANDS.filter(c => c.label.toLowerCase().includes(lower)).slice(0, 3);
    const createHits = QUICK_CREATE.filter(c => c.label.toLowerCase().includes(lower)).slice(0, 2);
    const smartHits  = SMART_SUGGESTIONS.filter(c => c.label.toLowerCase().includes(lower) || (c.subtitle ?? "").toLowerCase().includes(lower)).slice(0, 2);

    // Live search patients
    const { data: patients } = await supabase
      .from("patients")
      .select("id, full_name, phone")
      .eq("clinic_id", activeClinicId)
      .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(4);

    const patientHits: CmdItem[] = (patients ?? []).map(p => ({
      id: `patient-${p.id}`,
      label: p.full_name,
      subtitle: p.phone ? `···${p.phone.slice(-4)}` : "Patient",
      href: `/patients/${p.id}`,
      category: "Patients",
      icon: Users,
    }));

    setResults([...smartHits, ...navHits, ...createHits, ...patientHits]);
    setIdx(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClinicId]);

  function onQueryChange(q: string) {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 200);
  }

  function execute(item: CmdItem) {
    if (item.action) { item.action(); }
    else if (item.href) { router.push(item.href); }
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter")     { e.preventDefault(); if (results[idx]) execute(results[idx]); }
    if (e.key === "Escape")    { onClose(); }
  }

  // Group results by category
  const groups: Record<string, CmdItem[]> = {};
  for (const r of results) {
    if (!groups[r.category]) groups[r.category] = [];
    groups[r.category].push(r);
  }
  let flatIdx = 0;

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(15,23,42,0.55)",
        zIndex: "var(--z-modal)" as React.CSSProperties["zIndex"],
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: 80,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: "100%", maxWidth: 560,
        background: "#fff",
        borderRadius: 16,
        border: "1px solid var(--border)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
        overflow: "hidden",
      }}>
        {/* Search input */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
          <Search size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search patients, navigate, create…"
            style={{
              flex: 1, border: "none", outline: "none",
              fontSize: 15, color: "var(--text-primary)",
              background: "transparent",
            }}
          />
          {query && (
            <button onClick={() => onQueryChange("")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2 }}>
              <X size={14} />
            </button>
          )}
          <kbd style={{ padding: "2px 6px", borderRadius: 5, border: "1px solid var(--border)", fontSize: 11, color: "var(--text-muted)", background: "var(--surface-muted)" }}>Esc</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 400, overflowY: "auto", padding: "8px 0" }}>
          {results.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "24px 0" }}>No results found</p>
          ) : (
            Object.entries(groups).map(([cat, items]) => (
              <div key={cat}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", padding: "8px 16px 4px", margin: 0 }}>
                  {cat}
                </p>
                {items.map(item => {
                  const thisIdx = flatIdx++;
                  return (
                    <button
                      key={item.id}
                      onClick={() => execute(item)}
                      style={{
                        width: "100%", padding: "9px 16px",
                        display: "flex", alignItems: "center", gap: 10,
                        border: "none", cursor: "pointer",
                        background: thisIdx === idx ? "var(--primary-subtle)" : "transparent",
                        textAlign: "left",
                      }}
                      onMouseEnter={() => setIdx(thisIdx)}
                    >
                      <item.icon size={14} style={{ color: thisIdx === idx ? "var(--primary)" : "var(--text-muted)", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>{item.label}</p>
                        {item.subtitle && <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0 }}>{item.subtitle}</p>}
                      </div>
                      {thisIdx === idx && (
                        <kbd style={{ padding: "1px 5px", borderRadius: 4, border: "1px solid var(--border)", fontSize: 10, color: "var(--text-muted)", background: "var(--surface-muted)" }}>↵</kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border)", background: "var(--surface-muted)", display: "flex", gap: 12 }}>
          {[["↑↓", "Navigate"], ["↵", "Select"], ["Esc", "Close"]].map(([k, v]) => (
            <span key={k} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)" }}>
              <kbd style={{ padding: "1px 5px", borderRadius: 4, border: "1px solid var(--border)", fontSize: 10, background: "#fff" }}>{k}</kbd>
              {v}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
