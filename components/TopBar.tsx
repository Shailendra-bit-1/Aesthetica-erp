"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Search, ChevronDown, Building2, LogOut, Check,
  AlertTriangle, X, ChevronRight, Settings,
} from "lucide-react";
import { useClinic } from "@/contexts/ClinicContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { supabase } from "@/lib/supabase";
import NotificationCenter from "@/components/NotificationCenter";
import GlobalSearchPalette from "@/components/GlobalSearchPalette";

// ── Page title map from pathname ───────────────────────────────────────────

const PAGE_TITLES: Record<string, { title: string; crumbs?: string[] }> = {
  "/":                       { title: "Dashboard" },
  "/patients":               { title: "Patient Records" },
  "/scheduler":              { title: "Smart Scheduler" },
  "/photos":                 { title: "Before & After" },
  "/inventory":              { title: "Inventory" },
  "/billing":                { title: "Billing" },
  "/membership":             { title: "Memberships" },
  "/counselling":            { title: "Counselling" },
  "/crm":                    { title: "CRM & Leads" },
  "/staff":                  { title: "Staff HR" },
  "/payroll":                { title: "Payroll" },
  "/settings":               { title: "Settings" },
  "/settings/services":      { title: "Services & Packages",    crumbs: ["Settings"] },
  "/settings/services/credits": { title: "Credits & Commissions", crumbs: ["Settings", "Services"] },
  "/settings/team/permissions": { title: "Team Permissions",    crumbs: ["Settings"] },
  "/admin/billing":          { title: "Platform Billing",       crumbs: ["Admin"] },
  "/admin/reports":          { title: "Reports",                crumbs: ["Admin"] },
  "/admin/forms":            { title: "Form Builder",           crumbs: ["Admin"] },
  "/admin/rules":            { title: "Rule Builder",           crumbs: ["Admin"] },
  "/admin/webhooks":         { title: "Webhooks",               crumbs: ["Admin"] },
  "/admin/plugins":          { title: "Plugins",                crumbs: ["Admin"] },
  "/admin/users":            { title: "User Management",        crumbs: ["Admin"] },
  "/admin/analytics":        { title: "Analytics",              crumbs: ["Admin"] },
  "/admin/audit":            { title: "Audit Log",              crumbs: ["Admin"] },
  "/admin/permissions":      { title: "Permissions Matrix",     crumbs: ["Admin"] },
  "/admin/god-mode":         { title: "God Mode",               crumbs: ["Admin"] },
  "/admin/manage":           { title: "Master Admin",           crumbs: ["Admin"] },
};

function resolveTitle(pathname: string) {
  // Exact match first
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Patient profile
  if (pathname.startsWith("/patients/")) return { title: "Patient Profile", crumbs: ["Patient Records"] };
  // Settings sub-pages
  if (pathname.startsWith("/settings/staff/")) return { title: "Staff Profile", crumbs: ["Settings"] };
  // Intake (public, no topbar shown)
  if (pathname.startsWith("/intake")) return { title: "Patient Intake" };
  return { title: "Aesthetica" };
}

// ══════════════════════════════════════════════════════════════════════════════

export default function TopBar() {
  const router   = useRouter();
  const pathname = usePathname();
  const { profile, clinics, activeClinicId, setActiveClinicId, loading } = useClinic();
  const { isImpersonating, impersonated, stopImpersonation } = useImpersonation();

  const [clinicOpen,   setClinicOpen]   = useState(false);
  const [profileOpen,  setProfileOpen]  = useState(false);
  const [today,        setToday]        = useState("");
  const [searchOpen,   setSearchOpen]   = useState(false);
  const clinicRef  = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-IN", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    }));
  }, []);

  const initials    = profile?.full_name?.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() ?? "—";
  const activeClinic = clinics.find(c => c.id === activeClinicId);
  const { title, crumbs } = resolveTitle(pathname);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (clinicRef.current  && !clinicRef.current.contains(e.target  as Node)) setClinicOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen(true); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="sticky top-0" style={{ zIndex: "var(--z-topbar)" as React.CSSProperties["zIndex"] }}>

      {/* ── Impersonation Banner ── */}
      {isImpersonating && impersonated && (
        <div style={{
          background: "rgba(217,119,6,0.1)",
          borderBottom: "1px solid rgba(217,119,6,0.35)",
          padding: "7px 24px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        }}>
          <AlertTriangle size={13} style={{ color: "#B45309", flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "#92400E", fontFamily: "var(--font-serif)" }}>
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

      <header style={{
        background: "rgba(249,247,242,0.95)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--gold-border)",
        padding: "0 28px",
        height: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}>

        {/* ── Left: Breadcrumbs + Page Title ── */}
        <div style={{ minWidth: 0 }}>
          {crumbs && crumbs.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 1 }}>
              {crumbs.map((crumb, i) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.04em" }}>{crumb}</span>
                  <ChevronRight size={9} color="var(--text-muted)" style={{ opacity: 0.5 }} />
                </span>
              ))}
            </div>
          )}
          <h1 style={{
            fontSize: 16,
            fontWeight: 700,
            fontFamily: "var(--font-serif)",
            color: "var(--text-primary)",
            margin: 0,
            lineHeight: 1.2,
          }}>
            {title}
          </h1>
          {!crumbs?.length && (
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, lineHeight: 1 }}>
              {activeClinic ? `${activeClinic.name} · ` : ""}{today}
            </p>
          )}
        </div>

        {/* ── Right Controls ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>

          {/* Search bar — opens Cmd+K palette */}
          <div
            onClick={() => setSearchOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "7px 14px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-pill)",
              minWidth: 220, cursor: "pointer",
              transition: "var(--transition-base)",
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(197,160,89,0.4)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            <Search size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-sans)", flex: 1 }}>Search patients, records…</span>
            <kbd style={{ padding: "1px 5px", borderRadius: 4, border: "1px solid var(--border)", fontSize: 10, color: "var(--text-muted)", background: "rgba(197,160,89,0.04)", flexShrink: 0 }}>⌘K</kbd>
          </div>

          {/* Clinic Switcher (superadmin only) */}
          {!loading && profile?.role === "superadmin" && clinics.length > 0 && (
            <div ref={clinicRef} style={{ position: "relative" }}>
              <button
                onClick={() => setClinicOpen(o => !o)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 10px", borderRadius: "var(--radius-md)",
                  border: "1px solid rgba(197,160,89,0.3)",
                  background: clinicOpen ? "rgba(197,160,89,0.1)" : "rgba(197,160,89,0.05)",
                  cursor: "pointer",
                }}
              >
                <Building2 size={12} style={{ color: "var(--gold)" }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-serif)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {activeClinic?.name ?? "All Clinics"}
                </span>
                <ChevronDown size={11} style={{ color: "var(--text-muted)", transform: clinicOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
              </button>

              {clinicOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0,
                  minWidth: 240, background: "white",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid rgba(197,160,89,0.2)",
                  boxShadow: "var(--shadow-lg)",
                  zIndex: 200, overflow: "hidden",
                }}>
                  <div style={{ padding: "8px 12px 6px", borderBottom: "1px solid var(--gold-border)" }}>
                    <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", margin: 0 }}>
                      Switch Clinic
                    </p>
                  </div>
                  <button
                    onClick={() => { setActiveClinicId(null); setClinicOpen(false); }}
                    style={{ width: "100%", padding: "8px 12px", textAlign: "left", border: "none", background: activeClinicId === null ? "var(--gold-hover)" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid rgba(197,160,89,0.06)" }}
                  >
                    <Building2 size={12} style={{ color: "var(--text-muted)" }} />
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1 }}>All Clinics</span>
                    {activeClinicId === null && <Check size={11} style={{ color: "var(--gold)" }} />}
                  </button>
                  {clinics.map(c => (
                    <button key={c.id} onClick={() => { setActiveClinicId(c.id); setClinicOpen(false); }}
                      style={{ width: "100%", padding: "8px 12px", textAlign: "left", border: "none", background: activeClinicId === c.id ? "var(--gold-hover)" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid rgba(197,160,89,0.04)" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.subscription_status === "active" ? "var(--success)" : "var(--text-muted)" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-serif)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                        {c.location && <p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0 }}>{c.location}</p>}
                      </div>
                      {activeClinicId === c.id && <Check size={11} style={{ color: "var(--gold)" }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Divider */}
          <div style={{ width: 1, height: 20, background: "var(--border)" }} />

          {/* Notification Center */}
          <NotificationCenter />

          {/* Settings quick link */}
          <button onClick={() => router.push("/settings")}
            style={{ width: 34, height: 34, borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "var(--transition-base)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-subtle)")}
            onMouseLeave={e => (e.currentTarget.style.background = "none")}
            title="Settings"
          >
            <Settings size={14} color="var(--text-muted)" />
          </button>

          {/* Profile dropdown */}
          <div ref={profileRef} style={{ position: "relative" }}>
            <button
              onClick={() => setProfileOpen(o => !o)}
              style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", background: "transparent", border: "none", padding: "4px 8px", borderRadius: "var(--radius-md)" }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700, flexShrink: 0,
                background: "linear-gradient(135deg, #C5A059, #A8853A)",
                color: "white", fontFamily: "var(--font-serif)",
              }}>
                {loading ? "…" : initials}
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", fontFamily: "var(--font-serif)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {loading ? "Loading…" : (profile?.full_name ?? "Staff")}
              </span>
              <ChevronDown size={12} style={{ color: "var(--text-muted)", transform: profileOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </button>

            {profileOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", right: 0,
                minWidth: 200, background: "white",
                borderRadius: "var(--radius-lg)",
                border: "1px solid rgba(197,160,89,0.2)",
                boxShadow: "var(--shadow-lg)",
                zIndex: 200, overflow: "hidden",
              }}>
                <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--gold-border)", background: "rgba(249,247,242,0.6)" }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-serif)", margin: 0 }}>
                    {profile?.full_name ?? "—"}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0", textTransform: "capitalize" }}>
                    {profile?.role ?? "—"}
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  style={{ width: "100%", padding: "10px 14px", textAlign: "left", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: "var(--error)", fontSize: 13, fontFamily: "var(--font-serif)", transition: "background 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--error-bg)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <LogOut size={13} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    <GlobalSearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
