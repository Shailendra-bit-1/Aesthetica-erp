"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  SplitSquareHorizontal,
  Package,
  Settings,
  Bell,
  ChevronRight,
  ChevronsLeft,
  Sparkles,
  ShieldCheck,
  UserCog,
  CreditCard,
  ScrollText,
  BarChart3,
  Crown,
  Network,
  Zap,
  Scissors,
  Receipt,
  Star,
  MessageCircle,
  Megaphone,
  UserCheck2,
  BarChart2,
  FormInput,
  Webhook,
  Puzzle,
  Banknote,
  MessageCirclePlus,
  FlaskConical,
  Stethoscope,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import { useClinic } from "@/contexts/ClinicContext";
import { useRealtimePermissions } from "@/hooks/useRealtimePermissions";
import { useFeatureFlags } from "@flags";
import { useSidebarCounts } from "@/hooks/useSidebarCounts";
import type { SidebarCounts } from "@/hooks/useSidebarCounts";
import type { ModuleKey } from "@modules/config/environment";

// ── SIDEBAR_ITEMS: permission key = null means always visible ─────────────────

const SIDEBAR_ITEMS = [
  { label: "Overview",            href: "/",                   icon: LayoutDashboard,       permission: null,              module: null          },
  { label: "Patient Records",     href: "/patients",           icon: Users,                 permission: "patients.view",   module: "patients"    },
  { label: "Smart Scheduler",     href: "/scheduler",          icon: CalendarDays,          permission: "scheduler.view",  module: "scheduler"   },
  { label: "Before & After",      href: "/photos",             icon: SplitSquareHorizontal, permission: "photos.view",     module: "photos"      },
  { label: "Inventory",           href: "/inventory",          icon: Package,               permission: "inventory.view",  module: "inventory"   },
  { label: "Services & Packages", href: "/settings/services",  icon: Scissors,              permission: "services.view",   module: "services"    },
  { label: "Billing",             href: "/billing",            icon: Receipt,               permission: "billing.view",    module: "billing"     },
  { label: "Memberships",         href: "/membership",         icon: Star,                  permission: "membership.view", module: "membership"  },
  { label: "Counselling",         href: "/counselling",        icon: MessageCircle,         permission: "counselling.view",module: "counselling" },
  { label: "CRM",                 href: "/crm",                icon: Megaphone,             permission: "crm.view",        module: "crm"         },
  { label: "Staff HR",            href: "/staff",              icon: UserCheck2,            permission: "staff_hr.view",   module: "staff_hr"    },
] as const;

const ADMIN_ITEMS = [
  { label: "User Management",    href: "/admin/users",               icon: UserCog,           superadminOnly: false },
  { label: "Billing & Plans",    href: "/admin/billing",             icon: CreditCard,        superadminOnly: true  },
  { label: "Analytics",          href: "/admin/analytics",           icon: BarChart3,         superadminOnly: false },
  { label: "Audit Log",          href: "/admin/audit",               icon: ScrollText,        superadminOnly: false },
  { label: "Permissions Matrix", href: "/admin/permissions",         icon: ShieldCheck,       superadminOnly: false },
  { label: "Team Permissions",   href: "/settings/team/permissions", icon: Users,             superadminOnly: false },
  { label: "Rule Builder",       href: "/admin/rules",               icon: Zap,               superadminOnly: false },
  { label: "Reports",            href: "/admin/reports",             icon: BarChart2,         superadminOnly: false },
  { label: "Form Builder",       href: "/admin/forms",               icon: FormInput,         superadminOnly: false },
  { label: "Webhooks",           href: "/admin/webhooks",            icon: Webhook,           superadminOnly: false },
  { label: "Plugins",            href: "/admin/plugins",             icon: Puzzle,            superadminOnly: false },
  { label: "Payroll",            href: "/payroll",                   icon: Banknote,          superadminOnly: false },
  { label: "Beta Feedback",      href: "/admin/beta-feedback",       icon: MessageCirclePlus, superadminOnly: false },
  { label: "Simulator",          href: "/admin/simulator",           icon: FlaskConical,      superadminOnly: false },
  { label: "Conditions & Protocols", href: "/admin/conditions",      icon: Stethoscope,       superadminOnly: false },
  { label: "Deleted Records",        href: "/admin/deleted",          icon: Trash2,            superadminOnly: true  },
] as const;

const BOTTOM_ITEMS = [
  { label: "Settings", href: "/settings", icon: Settings },
];

// Badge key lookup by href
const BADGE_MAP: Partial<Record<string, keyof SidebarCounts>> = {
  "/scheduler": "scheduler",
  "/billing":   "billing",
  "/crm":       "crm",
  "/inventory": "inventory",
};

export default function Sidebar() {
  const pathname  = usePathname();
  const { profile, loading: profileLoading } = useClinic();
  const { can, ready }                       = useRealtimePermissions();
  const { isEnabled, loading: flagsLoading } = useFeatureFlags();
  const counts                               = useSidebarCounts();

  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("sidebar_collapsed") === "true"
  );

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar_collapsed", String(next));
  }

  const role         = profile?.role ?? null;
  const isSuperAdmin = role === "superadmin";
  const isAdmin      = role === "superadmin" || role === "admin"
                    || role === "clinic_admin" || role === "chain_admin";

  const loading = profileLoading || (!isAdmin && !ready);

  const visibleNav = SIDEBAR_ITEMS.filter((item) => {
    const moduleOn = item.module === null || isEnabled(item.module as ModuleKey);
    const permOk   = item.permission === null || isAdmin || can(item.permission);
    return moduleOn && permOk;
  });

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "…";

  return (
    <aside
      className="flex flex-col h-screen flex-shrink-0 overflow-hidden"
      style={{
        background: "var(--sidebar-bg)",
        width: collapsed ? 64 : 220,
        transition: "width 200ms ease",
      }}
    >
      {/* ── Logo ── */}
      <div
        className="py-7 border-b flex items-center"
        style={{
          borderColor: "rgba(197,160,89,0.2)",
          padding: collapsed ? "28px 0" : "28px 24px",
          justifyContent: collapsed ? "center" : "flex-start",
          transition: "padding 200ms ease",
        }}
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--gold)" }}
        >
          <Sparkles size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div className="ml-3 overflow-hidden">
            <h1
              className="text-base font-semibold tracking-widest uppercase whitespace-nowrap"
              style={{ color: "var(--gold)", fontFamily: "Georgia, serif", letterSpacing: "0.15em" }}
            >
              Aesthetica
            </h1>
            <p className="text-xs whitespace-nowrap" style={{ color: "rgba(232,226,212,0.45)", letterSpacing: "0.05em" }}>
              Clinic Suite
            </p>
          </div>
        )}
      </div>

      {/* ── User chip ── */}
      <div
        className="py-4 border-b flex items-center"
        style={{
          borderColor: "rgba(197,160,89,0.1)",
          padding: collapsed ? "16px 0" : "16px 24px",
          justifyContent: collapsed ? "center" : "flex-start",
          transition: "padding 200ms ease",
        }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ background: "rgba(197,160,89,0.2)", color: "var(--gold)", fontFamily: "Georgia, serif" }}
          title={collapsed ? (profile?.full_name ?? undefined) : undefined}
        >
          {initials}
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0 ml-3">
              <p
                className="text-sm font-medium truncate"
                style={{ color: "var(--sidebar-text)", fontFamily: "Georgia, serif" }}
              >
                {profile?.full_name ?? "Loading…"}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-xs truncate capitalize" style={{ color: "rgba(232,226,212,0.45)" }}>
                  {profile?.role ?? "—"}
                </p>
                {isSuperAdmin && (
                  <span
                    className="text-xs px-1.5 py-px rounded font-bold uppercase tracking-wider flex-shrink-0"
                    style={{
                      background: "rgba(197,160,89,0.2)",
                      color: "var(--gold)",
                      fontSize: 9,
                      letterSpacing: "0.08em",
                    }}
                  >
                    Super
                  </span>
                )}
              </div>
            </div>
            <button className="relative flex-shrink-0 ml-2" style={{ color: "rgba(232,226,212,0.5)" }}>
              <Bell size={16} />
              <span
                className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
                style={{ background: "var(--gold)" }}
              />
            </button>
          </>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 py-5 overflow-y-auto" style={{ padding: collapsed ? "20px 4px" : "20px 12px" }}>
        {!collapsed && (
          <p
            className="px-3 mb-3 text-xs uppercase tracking-widest font-medium"
            style={{ color: "rgba(232,226,212,0.3)" }}
          >
            Menu
          </p>
        )}

        {loading ? (
          <div className="space-y-1 animate-pulse px-1">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-9 rounded-lg" style={{ background: "rgba(232,226,212,0.04)" }} />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {visibleNav.map((item) => {
              const badgeKey = BADGE_MAP[item.href];
              const badge    = badgeKey ? (counts[badgeKey] ?? 0) : 0;
              return (
                <NavLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  badge={badge}
                  collapsed={collapsed}
                />
              );
            })}
          </div>
        )}

        {/* ── Master Admin — STRICTLY superadmin ── */}
        {!loading && profile?.role === "superadmin" && (
          <div className="pt-5 pb-1">
            <MasterAdminLink pathname={pathname} collapsed={collapsed} />
          </div>
        )}

        {/* ── Admin section ── */}
        {!loading && isAdmin && (
          <>
            {!collapsed && (
              <div className="pb-2 px-3 pt-2 flex items-center gap-2">
                <ShieldCheck size={12} style={{ color: "var(--gold)", opacity: 0.7 }} />
                <p
                  className="text-xs uppercase tracking-widest font-medium"
                  style={{ color: "rgba(197,160,89,0.6)" }}
                >
                  Admin
                </p>
                <div className="flex-1 h-px" style={{ background: "rgba(197,160,89,0.15)" }} />
              </div>
            )}

            <div
              className="rounded-xl overflow-hidden"
              style={{
                border: "1px solid rgba(197,160,89,0.15)",
                background: "rgba(197,160,89,0.04)",
                marginTop: collapsed ? 8 : 0,
              }}
            >
              {ADMIN_ITEMS.filter((item) => !item.superadminOnly || isSuperAdmin).map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  admin
                  collapsed={collapsed}
                />
              ))}
            </div>
          </>
        )}

        {/* Loading skeleton for admin section */}
        {loading && (
          <div className="pt-5 px-3 space-y-2 animate-pulse">
            <div className="h-3 w-16 rounded" style={{ background: "rgba(232,226,212,0.06)" }} />
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-9 rounded-lg" style={{ background: "rgba(232,226,212,0.04)" }} />
            ))}
          </div>
        )}
      </nav>

      {/* ── Bottom ── */}
      <div
        className="py-4 border-t space-y-1"
        style={{
          borderColor: "rgba(197,160,89,0.15)",
          padding: collapsed ? "16px 4px" : "16px 12px",
        }}
      >
        {BOTTOM_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg group transition-all duration-200"
              style={{
                color: "rgba(232,226,212,0.5)",
                borderLeft: "3px solid transparent",
                justifyContent: collapsed ? "center" : undefined,
                paddingLeft: collapsed ? 0 : undefined,
                paddingRight: collapsed ? 0 : undefined,
              }}
            >
              <Icon size={18} className="group-hover:text-white transition-colors" />
              {!collapsed && (
                <span className="text-sm font-medium group-hover:text-white transition-colors">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapse}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex items-center gap-2 py-2 rounded-lg w-full transition-colors hover:text-white"
          style={{
            color: "rgba(232,226,212,0.4)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            justifyContent: collapsed ? "center" : "flex-start",
            paddingLeft: collapsed ? 0 : 12,
            fontSize: 12,
          }}
        >
          {collapsed ? (
            <ChevronRight size={16} />
          ) : (
            <>
              <ChevronsLeft size={16} />
              <span>Collapse</span>
            </>
          )}
        </button>

        {!collapsed && (
          <div className="px-3 pt-2">
            <p className="text-xs text-center" style={{ color: "rgba(232,226,212,0.2)" }}>
              Aesthetica v1.0 &nbsp;·&nbsp; 2026
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

// ── Master Admin link ─────────────────────────────────────────────────────────

function MasterAdminLink({ pathname, collapsed }: { pathname: string; collapsed: boolean }) {
  const isActive = pathname.startsWith("/admin/manage");

  if (collapsed) {
    return (
      <Link
        href="/admin/manage"
        title="Master Admin"
        className="flex items-center justify-center py-2.5 rounded-lg"
        style={{
          background: isActive
            ? "linear-gradient(135deg, rgba(197,160,89,0.3), rgba(168,133,58,0.2))"
            : "linear-gradient(135deg, rgba(197,160,89,0.14), rgba(168,133,58,0.07))",
          border: isActive
            ? "1px solid rgba(197,160,89,0.6)"
            : "1px solid rgba(197,160,89,0.28)",
          boxShadow: isActive
            ? "0 0 18px rgba(197,160,89,0.45)"
            : "0 0 10px rgba(197,160,89,0.18)",
        }}
      >
        <Crown size={14} color="var(--gold)" />
      </Link>
    );
  }

  return (
    <Link
      href="/admin/manage"
      className="group block mx-px"
      style={{
        borderRadius: 12,
        background: isActive
          ? "linear-gradient(135deg, rgba(197,160,89,0.3), rgba(168,133,58,0.2))"
          : "linear-gradient(135deg, rgba(197,160,89,0.14), rgba(168,133,58,0.07))",
        border: isActive
          ? "1px solid rgba(197,160,89,0.6)"
          : "1px solid rgba(197,160,89,0.28)",
        boxShadow: isActive
          ? "0 0 18px rgba(197,160,89,0.45), inset 0 1px 0 rgba(197,160,89,0.2)"
          : "0 0 10px rgba(197,160,89,0.18)",
        padding: "10px 12px",
        transition: "all 0.25s ease",
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          const el = e.currentTarget as HTMLAnchorElement;
          el.style.background = "linear-gradient(135deg, rgba(197,160,89,0.22), rgba(168,133,58,0.12))";
          el.style.borderColor = "rgba(197,160,89,0.45)";
          el.style.boxShadow   = "0 0 16px rgba(197,160,89,0.32)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          const el = e.currentTarget as HTMLAnchorElement;
          el.style.background = "linear-gradient(135deg, rgba(197,160,89,0.14), rgba(168,133,58,0.07))";
          el.style.borderColor = "rgba(197,160,89,0.28)";
          el.style.boxShadow   = "0 0 10px rgba(197,160,89,0.18)";
        }
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: "rgba(197,160,89,0.22)",
            boxShadow: isActive
              ? "0 0 12px rgba(197,160,89,0.5)"
              : "0 0 6px rgba(197,160,89,0.2)",
          }}
        >
          <Crown size={14} color="var(--gold)" />
        </div>

        <div className="flex-1 min-w-0">
          <span
            className="text-sm font-semibold truncate block"
            style={{
              fontFamily: "Georgia, serif",
              color: isActive ? "var(--gold)" : "rgba(197,160,89,0.9)",
            }}
          >
            Master Admin
          </span>
          <p className="text-xs truncate" style={{ color: "rgba(197,160,89,0.5)", fontSize: 10 }}>
            Chains · Clinics · Network
          </p>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <Network size={12} style={{ color: "rgba(197,160,89,0.55)" }} />
          {isActive && <ChevronRight size={12} style={{ color: "var(--gold)" }} />}
        </div>
      </div>
    </Link>
  );
}

// ── Shared nav link ───────────────────────────────────────────────────────────

function NavLink({
  item,
  pathname,
  admin     = false,
  badge     = 0,
  collapsed = false,
}: {
  item: { label: string; href: string; icon: React.ElementType };
  pathname: string;
  admin?:     boolean;
  badge?:     number;
  collapsed?: boolean;
}) {
  const Icon     = item.icon;
  const isActive = pathname === item.href;
  const badgeStr = badge > 99 ? "99+" : String(badge);

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={clsx(
        "flex items-center px-3 py-2.5 rounded-lg group transition-all duration-200",
        collapsed ? "justify-center" : "gap-3",
        isActive ? "text-white" : "hover:text-white"
      )}
      style={
        isActive
          ? {
              background: admin ? "rgba(197,160,89,0.22)" : "rgba(197,160,89,0.18)",
              borderLeft: "3px solid var(--gold)",
            }
          : {
              color:      admin ? "rgba(197,160,89,0.65)" : "rgba(232,226,212,0.6)",
              borderLeft: "3px solid transparent",
            }
      }
    >
      <Icon
        size={16}
        style={{ color: isActive ? "var(--gold)" : undefined, flexShrink: 0 }}
        className={clsx(!isActive && "group-hover:text-white transition-colors")}
      />
      {!collapsed && (
        <>
          <span className="text-sm font-medium flex-1 truncate" style={{ fontFamily: "Georgia, serif" }}>
            {item.label}
          </span>
          {badge > 0 ? (
            <span
              className="flex items-center justify-center rounded-full text-white font-bold flex-shrink-0"
              style={{
                background: "var(--gold)",
                minWidth: 18,
                height: 18,
                fontSize: 10,
                padding: "0 4px",
              }}
            >
              {badgeStr}
            </span>
          ) : isActive ? (
            <ChevronRight size={14} style={{ color: "var(--gold)", opacity: 0.7 }} />
          ) : admin ? (
            <span
              className="text-xs px-1.5 py-0.5 rounded font-medium opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: "rgba(197,160,89,0.15)", color: "var(--gold)", fontSize: 10 }}
            >
              admin
            </span>
          ) : null}
        </>
      )}
    </Link>
  );
}
