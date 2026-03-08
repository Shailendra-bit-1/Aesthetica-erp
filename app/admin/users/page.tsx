"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Users,
  Plus,
  X,
  Loader2,
  Sparkles,
  Search,
  UserPlus,
  Shield,
  ChevronRight,
  Mail,
  Crown,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import {
  STAFF_ROLES,
  ROLE_BADGE,
  type StaffRole,
} from "@/lib/permissions";

// ── Types ────────────────────────────────────────────────────────────────────

type StaffProfile = {
  id: string;
  role: string;
  full_name: string | null;
  email: string | null;
  status: string | null;
  created_at: string | null;
};

// ── Badge component ──────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const badge = ROLE_BADGE[role] ?? {
    label: role,
    bg: "rgba(197,160,89,0.1)",
    color: "#8A8078",
    border: "rgba(197,160,89,0.2)",
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.04em",
        background: badge.bg,
        color: badge.color,
        border: `1px solid ${badge.border}`,
        fontFamily: "Georgia, serif",
      }}
    >
      {badge.label}
    </span>
  );
}

// ── Status dot ───────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string | null }) {
  const isActive = !status || status === "active";
  const isInvited = status === "invited";
  const color = isActive ? "#7EC88A" : isInvited ? "#C5A059" : "#C88A7E";
  const label = isActive ? "Active" : isInvited ? "Invited" : status ?? "—";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 6px ${color}80`,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 12, color: "#8A8078" }}>{label}</span>
    </div>
  );
}

// ── Avatar initials ──────────────────────────────────────────────────────────

function Avatar({ name, role }: { name: string | null; role: string }) {
  const badge = ROLE_BADGE[role];
  const initials = name
    ? name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "??";

  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: badge?.bg ?? "rgba(197,160,89,0.12)",
        border: `1.5px solid ${badge?.border ?? "rgba(197,160,89,0.25)"}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 13,
        fontWeight: 700,
        color: badge?.color ?? "#C5A059",
        fontFamily: "Georgia, serif",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

// ── Add Staff Modal ──────────────────────────────────────────────────────────

function AddStaffModal({
  isOpen,
  onClose,
  onAdded,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("doctor");
  const [clinicId, setClinicId] = useState("");
  const [clinics, setClinics] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => setMounted(true), 20);
      // Fetch clinics for the dropdown
      supabase
        .from("clinics")
        .select("id, name")
        .order("name")
        .then(({ data }) => setClinics(data ?? []));
      return () => clearTimeout(t);
    } else {
      setMounted(false);
    }
  }, [isOpen]);

  function reset() {
    setName("");
    setEmail("");
    setRole("doctor");
    setClinicId("");
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/admin/invite-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, clinicId: clinicId || undefined }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Failed to send invite", {
          icon: <Shield size={14} color="#C5A059" />,
        });
        setLoading(false);
        return;
      }

      toast.success(`${name} added`, {
        description: `Account created — a password setup email has been sent to ${email}`,
        icon: <Sparkles size={14} color="#C5A059" />,
      });

      onAdded();
      reset();
      onClose();
    } catch {
      toast.error("Network error — please try again");
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(28,25,23,0.55)",
        backdropFilter: "blur(6px)",
        opacity: mounted ? 1 : 0,
        transition: "opacity 0.25s ease",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Card */}
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: "#FFFFFF",
          borderRadius: 20,
          border: "1px solid rgba(197,160,89,0.25)",
          boxShadow: "0 20px 60px rgba(28,25,23,0.25), 0 1px 0 rgba(197,160,89,0.3) inset",
          overflow: "hidden",
          transform: mounted ? "translateY(0) scale(1)" : "translateY(16px) scale(0.98)",
          transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Gold bar */}
        <div style={{ height: 3, background: "linear-gradient(90deg, #A8853A, #C5A059, #E8CC8A, #C5A059, #A8853A)" }} />

        {/* Header */}
        <div
          style={{
            padding: "24px 28px 20px",
            borderBottom: "1px solid #F0EBE2",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "rgba(197,160,89,0.12)",
              border: "1px solid rgba(197,160,89,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <UserPlus size={18} color="#C5A059" />
          </div>
          <div style={{ flex: 1 }}>
            <h2
              style={{
                fontFamily: "Georgia, serif",
                fontSize: 18,
                fontWeight: 600,
                color: "#1A1A1A",
                margin: 0,
              }}
            >
              Invite Staff Member
            </h2>
            <p style={{ fontSize: 12, color: "#8A8078", margin: "2px 0 0" }}>
              They&apos;ll receive a login link at their email.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { reset(); onClose(); }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#8A8078",
              padding: 4,
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "24px 28px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Full Name */}
          <div>
            <label style={labelSx}>Full Name</label>
            <input
              type="text"
              required
              placeholder="Dr. Sarah Chen"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputSx}
              onFocus={(e) => focus(e.target)}
              onBlur={(e) => blur(e.target)}
            />
          </div>

          {/* Email */}
          <div>
            <label style={labelSx}>
              <Mail size={10} color="#C5A059" />
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="sarah@aesthetica.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputSx}
              onFocus={(e) => focus(e.target)}
              onBlur={(e) => blur(e.target)}
            />
          </div>

          {/* Role */}
          <div>
            <label style={labelSx}>
              <Shield size={10} color="#C5A059" />
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              style={{ ...inputSx, cursor: "pointer" }}
              onFocus={(e) => focus(e.target as unknown as HTMLInputElement)}
              onBlur={(e) => blur(e.target as unknown as HTMLInputElement)}
            >
              {STAFF_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <p style={{ fontSize: 11, color: "#A89E94", marginTop: 5, fontFamily: "Georgia, serif", fontStyle: "italic" }}>
              Default permissions will be applied automatically.
            </p>
          </div>

          {/* Clinic */}
          <div>
            <label style={labelSx}>
              <Crown size={10} color="#C5A059" />
              Assign to Clinic
            </label>
            <select
              value={clinicId}
              onChange={(e) => setClinicId(e.target.value)}
              style={{ ...inputSx, cursor: "pointer" }}
              onFocus={(e) => focus(e.target as unknown as HTMLInputElement)}
              onBlur={(e) => blur(e.target as unknown as HTMLInputElement)}
            >
              <option value="">— Unassigned —</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {clinics.length === 0 && (
              <p style={{ fontSize: 11, color: "#A89E94", marginTop: 5, fontFamily: "Georgia, serif", fontStyle: "italic" }}>
                No clinics found. Create one in Master Admin first.
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              width: "100%",
              padding: "13px 0",
              borderRadius: 12,
              border: "none",
              background: loading
                ? "rgba(197,160,89,0.45)"
                : "linear-gradient(135deg, #C5A059 0%, #D4B472 45%, #A8853A 100%)",
              color: "white",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "Georgia, serif",
              letterSpacing: "0.04em",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: loading ? "none" : "0 4px 20px rgba(197,160,89,0.35)",
              transition: "all 0.2s",
            }}
          >
            {loading ? (
              <>
                <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                Sending Invite…
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Send Invitation
              </>
            )}
          </button>
        </form>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>,
    document.body
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, role, full_name, email, status, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        // Graceful fallback if extra columns don't exist yet
        const { data: minimal } = await supabase
          .from("profiles")
          .select("id, role, created_at")
          .order("created_at", { ascending: false });
        setStaff(
          (minimal ?? []).map((p) => ({
            id: p.id,
            role: p.role ?? "staff",
            full_name: null,
            email: null,
            status: null,
            created_at: p.created_at,
          }))
        );
      } else {
        setStaff(data ?? []);
      }
    } catch {
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const filtered = staff.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.full_name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.role?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-full" style={{ background: "var(--background)" }}>


      <div className="px-8 pb-12">
        {/* Hero */}
        <div
          className="rounded-2xl px-8 py-8 mb-8 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #1C1917 0%, #2C2520 100%)",
            border: "1px solid rgba(197,160,89,0.2)",
          }}
        >
          <div style={{ position: "absolute", top: -50, right: -50, width: 160, height: 160, borderRadius: "50%", border: "1px solid rgba(197,160,89,0.07)" }} />
          <div style={{ position: "absolute", top: -20, right: -20, width: 110, height: 110, borderRadius: "50%", border: "1px solid rgba(197,160,89,0.1)" }} />

          <div className="flex items-center justify-between relative">
            <div className="flex items-center gap-4">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(197,160,89,0.15)", border: "1px solid rgba(197,160,89,0.3)" }}
              >
                <Users size={20} color="#C5A059" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest font-semibold mb-0.5" style={{ color: "rgba(197,160,89,0.6)" }}>
                  Admin Console
                </p>
                <h1 className="text-2xl font-semibold" style={{ color: "#F9F7F2", fontFamily: "Georgia, serif" }}>
                  Staff Management
                </h1>
              </div>
            </div>
            <button
              onClick={() => setModalOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 20px",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg, #C5A059, #A8853A)",
                color: "white",
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "Georgia, serif",
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(197,160,89,0.35)",
              }}
            >
              <Plus size={15} />
              Add Staff
            </button>
          </div>

          <p className="text-sm mt-3 relative" style={{ color: "rgba(232,226,212,0.5)", maxWidth: 380 }}>
            Manage clinic staff, roles, and granular access permissions.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Staff",  value: staff.length,                                                icon: Users,      color: "#C5A059" },
            { label: "Doctors",      value: staff.filter(s => s.role === "doctor").length,              icon: Crown,      color: "#A8853A" },
            { label: "Active",       value: staff.filter(s => !s.status || s.status === "active").length, icon: Sparkles,  color: "#7EC88A" },
            { label: "Invited",      value: staff.filter(s => s.status === "invited").length,           icon: Mail,       color: "#C5A059" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="luxury-card rounded-2xl p-5"
              style={{ background: "var(--surface)" }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${color}18`, border: `1px solid ${color}28` }}
                >
                  <Icon size={15} style={{ color }} />
                </div>
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  {label}
                </span>
              </div>
              <p className="text-3xl font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
                {loading ? "—" : value}
              </p>
            </div>
          ))}
        </div>

        {/* Table card */}
        <div
          className="luxury-card rounded-2xl overflow-hidden"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          {/* Table toolbar */}
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2.5" style={{ color: "var(--text-muted)" }}>
              <Search size={14} />
              <input
                type="text"
                placeholder="Search by name, email or role…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  fontSize: 13,
                  color: "var(--foreground)",
                  width: 240,
                  fontFamily: "Georgia, serif",
                }}
              />
            </div>
            <button
              onClick={fetchStaff}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-muted)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              <RefreshCw size={12} />
              Refresh
            </button>
          </div>

          {/* Table */}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#FDFCF8" }}>
                {["Staff Member", "Role", "Status", "Joined", ""].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "12px 20px",
                      textAlign: "left",
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      color: "#8A8078",
                      borderBottom: "1px solid #F0EBE2",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F5F2EC" }}>
                    {[...Array(5)].map((__, j) => (
                      <td key={j} style={{ padding: "16px 20px" }}>
                        <div
                          className="animate-pulse rounded"
                          style={{ height: 14, background: "rgba(197,160,89,0.07)", width: j === 0 ? 160 : j === 4 ? 80 : 100 }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: "48px 20px", textAlign: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 14,
                          background: "rgba(197,160,89,0.08)",
                          border: "1px solid rgba(197,160,89,0.2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Users size={20} color="#C5A059" />
                      </div>
                      <p style={{ fontFamily: "Georgia, serif", color: "#1A1A1A", fontSize: 15, fontWeight: 600 }}>
                        {search ? "No staff match your search" : "No staff yet"}
                      </p>
                      <p style={{ fontSize: 12, color: "#8A8078" }}>
                        {search ? "Try a different query." : "Click 'Add Staff' to invite your first team member."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((member, i) => (
                  <tr
                    key={member.id}
                    style={{
                      borderBottom: i < filtered.length - 1 ? "1px solid #F5F2EC" : "none",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "#FDFCF8")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}
                  >
                    {/* Staff Member */}
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Avatar name={member.full_name} role={member.role} />
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A", fontFamily: "Georgia, serif" }}>
                            {member.full_name ?? "—"}
                          </p>
                          <p style={{ fontSize: 12, color: "#8A8078", marginTop: 1 }}>
                            {member.email ?? member.id.slice(0, 8) + "…"}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td style={{ padding: "14px 20px" }}>
                      <RoleBadge role={member.role} />
                    </td>

                    {/* Status */}
                    <td style={{ padding: "14px 20px" }}>
                      <StatusDot status={member.status} />
                    </td>

                    {/* Joined */}
                    <td style={{ padding: "14px 20px" }}>
                      <span style={{ fontSize: 12, color: "#8A8078" }}>
                        {member.created_at
                          ? new Date(member.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "14px 20px" }}>
                      <Link
                        href={`/settings/staff/${member.id}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "5px 12px",
                          borderRadius: 8,
                          border: "1px solid rgba(197,160,89,0.3)",
                          background: "rgba(197,160,89,0.06)",
                          color: "#C5A059",
                          fontSize: 12,
                          fontWeight: 600,
                          fontFamily: "Georgia, serif",
                          textDecoration: "none",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.background = "rgba(197,160,89,0.14)";
                          (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(197,160,89,0.5)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.background = "rgba(197,160,89,0.06)";
                          (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(197,160,89,0.3)";
                        }}
                      >
                        Permissions
                        <ChevronRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Footer */}
          {!loading && filtered.length > 0 && (
            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid #F0EBE2",
                background: "#FDFCF8",
                fontSize: 11,
                color: "#A89E94",
                fontFamily: "Georgia, serif",
                fontStyle: "italic",
              }}
            >
              {filtered.length} staff member{filtered.length !== 1 ? "s" : ""}
              {search && ` matching "${search}"`}
            </div>
          )}
        </div>
      </div>

      <AddStaffModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdded={fetchStaff}
      />
    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────

const labelSx: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "#8A8078",
  marginBottom: 7,
};

const inputSx: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "Georgia, serif",
  background: "#FDFCF9",
  border: "1px solid #E8E2D4",
  color: "#1A1A1A",
  outline: "none",
  transition: "border-color 0.2s, box-shadow 0.2s",
  boxSizing: "border-box",
  appearance: "none" as const,
};

function focus(el: HTMLInputElement) {
  el.style.borderColor = "#C5A059";
  el.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.13)";
}
function blur(el: HTMLInputElement) {
  el.style.borderColor = "#E8E2D4";
  el.style.boxShadow = "none";
}
