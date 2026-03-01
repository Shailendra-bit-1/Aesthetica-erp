"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronDown, Building2, LogOut, Check, AlertTriangle, X } from "lucide-react";
import { useClinic } from "@/contexts/ClinicContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { supabase } from "@/lib/supabase";

export default function TopBar() {
  const router = useRouter();
  const { profile, clinics, activeClinicId, setActiveClinicId, loading } = useClinic();
  const { isImpersonating, impersonated, stopImpersonation } = useImpersonation();

  const [clinicOpen,   setClinicOpen]   = useState(false);
  const [profileOpen,  setProfileOpen]  = useState(false);
  const [today,        setToday]        = useState("");
  const clinicRef  = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Compute date client-side only to avoid SSR/client timezone mismatch
  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    }));
  }, []);

  // Initials from full_name
  const initials = profile?.full_name
    ?.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() ?? "—";

  const activeClinic = clinics.find(c => c.id === activeClinicId);

  // Close dropdowns on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (clinicRef.current  && !clinicRef.current.contains(e.target as Node))  setClinicOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="sticky top-0 z-10">
      {/* ── Impersonation Banner ── */}
      {isImpersonating && impersonated && (
        <div
          style={{
            background: "rgba(217,119,6,0.12)",
            borderBottom: "1px solid rgba(217,119,6,0.4)",
            padding: "8px 24px",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}
        >
          <AlertTriangle size={14} style={{ color: "#B45309", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "#92400E", fontFamily: "Georgia, serif" }}>
            <strong>View Mode:</strong> Viewing as{" "}
            <strong style={{ color: "#78350F" }}>{impersonated.clinicName}</strong>
            {" "}— changes you make will affect this clinic.
          </span>
          <button
            onClick={stopImpersonation}
            style={{
              marginLeft: 8, padding: "3px 10px", borderRadius: 6,
              border: "1px solid rgba(217,119,6,0.5)",
              background: "rgba(217,119,6,0.15)", cursor: "pointer",
              color: "#92400E", fontSize: 12, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <X size={11} />
            Stop Impersonating
          </button>
        </div>
      )}
    <header
      className="px-8 py-5 flex items-center justify-between"
      style={{
        background: "rgba(249,247,242,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Page title + clinic context */}
      <div>
        <h2
          className="text-2xl font-semibold"
          style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}
        >
          Overview
        </h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
          {activeClinic ? `${activeClinic.name} · ` : ""}{today}
        </p>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">

        {/* Global search */}
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-full"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", minWidth: "220px" }}
        >
          <Search size={15} style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder="Search patients, records…"
            className="text-sm bg-transparent outline-none flex-1"
            style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}
          />
        </div>

        {/* ── Superadmin Clinic Switcher ── */}
        {!loading && profile?.role === "superadmin" && clinics.length > 0 && (
          <div ref={clinicRef} style={{ position: "relative" }}>
            <button
              onClick={() => setClinicOpen(o => !o)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "7px 12px", borderRadius: 10,
                border: "1px solid rgba(197,160,89,0.35)",
                background: clinicOpen ? "rgba(197,160,89,0.1)" : "rgba(197,160,89,0.06)",
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              <Building2 size={13} style={{ color: "#C5A059" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {activeClinic?.name ?? "All Clinics"}
              </span>
              <ChevronDown size={12} style={{ color: "#9C9584", transform: clinicOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </button>

            {clinicOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0,
                minWidth: 240, background: "white", borderRadius: 14,
                border: "1px solid rgba(197,160,89,0.25)",
                boxShadow: "0 12px 40px rgba(28,25,23,0.15)",
                zIndex: 200, overflow: "hidden",
              }}>
                <div style={{ padding: "8px 12px 6px", borderBottom: "1px solid rgba(197,160,89,0.1)" }}>
                  <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9C9584", margin: 0 }}>
                    Switch Clinic
                  </p>
                </div>

                {/* "All Clinics" option for superadmin global view */}
                <button
                  onClick={() => { setActiveClinicId(null); setClinicOpen(false); }}
                  style={{
                    width: "100%", padding: "9px 14px", textAlign: "left", border: "none",
                    background: activeClinicId === null ? "rgba(197,160,89,0.08)" : "transparent",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid rgba(197,160,89,0.07)",
                  }}
                >
                  <Building2 size={12} style={{ color: "#9C9584", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "#6B6358", fontFamily: "Georgia, serif", flex: 1 }}>All Clinics</span>
                  {activeClinicId === null && <Check size={12} style={{ color: "#C5A059" }} />}
                </button>

                {clinics.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setActiveClinicId(c.id); setClinicOpen(false); }}
                    style={{
                      width: "100%", padding: "9px 14px", textAlign: "left", border: "none",
                      background: activeClinicId === c.id ? "rgba(197,160,89,0.08)" : "transparent",
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                      borderBottom: "1px solid rgba(197,160,89,0.05)",
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: c.subscription_status === "active" ? "#4A8A4A" : "#9C9584" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                      {c.location && <p style={{ fontSize: 10, color: "#9C9584", margin: 0 }}>{c.location}</p>}
                    </div>
                    {activeClinicId === c.id && <Check size={12} style={{ color: "#C5A059", flexShrink: 0 }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="w-px h-6" style={{ background: "var(--border)" }} />

        {/* Profile dropdown */}
        <div ref={profileRef} style={{ position: "relative" }}>
          <button
            onClick={() => setProfileOpen(o => !o)}
            className="flex items-center gap-2"
            style={{ cursor: "pointer", background: "transparent", border: "none", padding: "4px 8px", borderRadius: 10 }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: "var(--gold)", color: "white", fontFamily: "Georgia, serif" }}
            >
              {loading ? "…" : initials}
            </div>
            <span
              className="text-sm font-medium"
              style={{ color: "var(--foreground)", fontFamily: "Georgia, serif", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {loading ? "Loading…" : (profile?.full_name ?? profile?.email ?? "Super Admin")}
            </span>
            <ChevronDown size={14} style={{ color: "var(--text-muted)", transform: profileOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </button>

          {profileOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", right: 0,
              minWidth: 200, background: "white", borderRadius: 14,
              border: "1px solid rgba(197,160,89,0.25)",
              boxShadow: "0 12px 40px rgba(28,25,23,0.15)",
              zIndex: 200, overflow: "hidden",
            }}>
              {/* User info header */}
              <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(197,160,89,0.1)", background: "rgba(249,247,242,0.7)" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: 0 }}>
                  {profile?.full_name ?? "—"}
                </p>
                <p style={{ fontSize: 11, color: "#9C9584", margin: "2px 0 0", textTransform: "capitalize" }}>
                  {profile?.role ?? "—"}
                </p>
              </div>

              <button
                onClick={handleSignOut}
                style={{
                  width: "100%", padding: "11px 16px", textAlign: "left", border: "none",
                  background: "transparent", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                  color: "#B43C3C", fontSize: 13, fontFamily: "Georgia, serif",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(180,60,60,0.06)")}
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
    </div>
  );
}
