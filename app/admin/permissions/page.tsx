"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Shield,
  Building2,
  Users,
  Loader2,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import {
  ROLE_PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_BADGE,
  type StaffPermissions,
  type StaffRole,
} from "@/lib/permissions";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type PermMatrix = Record<StaffRole, StaffPermissions>;

type Clinic = {
  id: string;
  name: string;
  location: string | null;
};

type StaffProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  clinic_id: string | null;
};

type UserPermRow = StaffPermissions & {
  user_id: string;
  use_custom: boolean;
  system_override?: boolean;
  updated_at: string;
};

const ROLES: StaffRole[] = ["doctor", "counsellor", "therapist", "front_desk"];
const PERM_KEYS = Object.keys(PERMISSION_LABELS) as (keyof StaffPermissions)[];

// Sensitive permissions get red off-state
const SENSITIVE_PERMS = new Set<keyof StaffPermissions>([
  "view_revenue",
  "access_billing",
  "delete_patient_photos",
  "edit_staff",
]);

// ── Switch component ──────────────────────────────────────────────────────────

function Switch({
  checked,
  onChange,
  disabled = false,
  offColor = "#E8E2D4",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  offColor?: string;
}) {
  const w = 40;
  const h = 22;
  const knob = 14;
  const gap = 4;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: w,
        height: h,
        borderRadius: h / 2,
        background: checked ? "#C5A059" : offColor,
        border: `1px solid ${checked ? "#A8853A" : "rgba(0,0,0,0.1)"}`,
        cursor: disabled ? "not-allowed" : "pointer",
        position: "relative",
        transition: "all 0.22s cubic-bezier(0.4,0,0.2,1)",
        flexShrink: 0,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: gap - 1,
          left: checked ? w - knob - gap : gap - 1,
          width: knob,
          height: knob,
          borderRadius: "50%",
          background: "white",
          boxShadow: "0 1px 4px rgba(0,0,0,0.22)",
          transition: "left 0.22s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
    </button>
  );
}

// ── Role badge ────────────────────────────────────────────────────────────────

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
        letterSpacing: "0.03em",
        background: badge.bg,
        color: badge.color,
        border: `1px solid ${badge.border}`,
        fontFamily: "Georgia, serif",
        whiteSpace: "nowrap",
      }}
    >
      {badge.label}
    </span>
  );
}

// ── Staff avatar initials ─────────────────────────────────────────────────────

function Avatar({ name, role }: { name: string | null; role: string }) {
  const badge = ROLE_BADGE[role] ?? { bg: "rgba(197,160,89,0.1)", color: "#8A8078", border: "rgba(197,160,89,0.2)" };
  const initials = name
    ? name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "??";
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: badge.bg,
        border: `1px solid ${badge.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        fontWeight: 700,
        color: badge.color,
        fontFamily: "Georgia, serif",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PermissionsMatrixPage() {
  // ── Platform Role Defaults state ──────────────────────────────────────────
  const [matrix, setMatrix] = useState<PermMatrix>(() => {
    // Initialize from hardcoded ROLE_PERMISSIONS
    const m = {} as PermMatrix;
    for (const role of ROLES) {
      m[role] = { ...ROLE_PERMISSIONS[role] };
    }
    return m;
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingMatrix, setLoadingMatrix] = useState(true);

  // ── Clinic Override state ─────────────────────────────────────────────────
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState<string>("");
  const [loadingClinics, setLoadingClinics] = useState(true);
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [staffPerms, setStaffPerms] = useState<Record<string, StaffPermissions>>({});
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [savingStaff, setSavingStaff] = useState<Record<string, boolean>>({});

  // ── Load role defaults from DB ─────────────────────────────────────────────
  useEffect(() => {
    async function loadMatrix() {
      try {
        const { data, error } = await supabase
          .from("role_permissions")
          .select("*");

        if (!error && data && data.length > 0) {
          const m = { ...matrix };
          for (const row of data) {
            const r = row.role as StaffRole;
            if (ROLES.includes(r)) {
              const { role: _r, updated_at: _u, ...perms } = row;
              m[r] = perms as StaffPermissions;
            }
          }
          setMatrix(m);
        }
        // If table empty or error, keep hardcoded defaults
      } catch {
        // silently keep hardcoded defaults
      } finally {
        setLoadingMatrix(false);
      }
    }
    loadMatrix();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load clinics ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadClinics() {
      const { data } = await supabase
        .from("clinics")
        .select("id, name, location")
        .order("name");
      if (data) setClinics(data);
      setLoadingClinics(false);
    }
    loadClinics();
  }, []);

  // ── Load staff for selected clinic ────────────────────────────────────────
  useEffect(() => {
    if (!selectedClinicId) {
      setStaffList([]);
      setStaffPerms({});
      return;
    }

    async function loadStaff() {
      setLoadingStaff(true);
      try {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email, role, clinic_id")
          .eq("clinic_id", selectedClinicId);

        const staff = (profiles ?? []) as StaffProfile[];
        setStaffList(staff);

        if (staff.length === 0) {
          setStaffPerms({});
          return;
        }

        // Fetch user_permissions for each staff member
        const ids = staff.map((s) => s.id);
        const { data: permsData } = await supabase
          .from("user_permissions")
          .select("*")
          .in("user_id", ids);

        const permsMap: Record<string, StaffPermissions> = {};
        for (const sp of staff) {
          const row = (permsData ?? []).find((p: UserPermRow) => p.user_id === sp.id);
          if (row && row.use_custom) {
            const { use_custom, user_id, updated_at, system_override: _so, ...p } = row as UserPermRow;
            void use_custom; void user_id; void updated_at;
            permsMap[sp.id] = p as StaffPermissions;
          } else {
            // Use role defaults from current matrix
            const roleKey = sp.role as StaffRole;
            permsMap[sp.id] = matrix[roleKey] ? { ...matrix[roleKey] } : { ...ROLE_PERMISSIONS[roleKey] ?? ROLE_PERMISSIONS.front_desk };
          }
        }
        setStaffPerms(permsMap);
      } finally {
        setLoadingStaff(false);
      }
    }
    loadStaff();
  }, [selectedClinicId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toggle role permission ─────────────────────────────────────────────────
  function handleRoleToggle(role: StaffRole, perm: keyof StaffPermissions, val: boolean) {
    setMatrix((prev) => ({
      ...prev,
      [role]: { ...prev[role], [perm]: val },
    }));
    setDirty(true);
  }

  // ── Save role defaults ─────────────────────────────────────────────────────
  async function handleSaveDefaults() {
    setSaving(true);
    try {
      const rows = ROLES.map((role) => ({
        role,
        ...matrix[role],
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("role_permissions")
        .upsert(rows, { onConflict: "role" });

      if (error) {
        toast.error("Failed to save defaults", { description: error.message });
        return;
      }

      setDirty(false);
      toast.success("Platform defaults saved", {
        icon: <Sparkles size={14} color="#C5A059" />,
        description: "All role permission defaults have been updated.",
      });
    } finally {
      setSaving(false);
    }
  }

  // ── Auto-save staff permission toggle ─────────────────────────────────────
  async function handleStaffToggle(
    staffId: string,
    perm: keyof StaffPermissions,
    val: boolean
  ) {
    // Optimistically update local state
    setStaffPerms((prev) => ({
      ...prev,
      [staffId]: { ...prev[staffId], [perm]: val },
    }));

    setSavingStaff((prev) => ({ ...prev, [staffId]: true }));
    try {
      const currentPerms = { ...staffPerms[staffId], [perm]: val };
      const { error } = await supabase
        .from("user_permissions")
        .upsert(
          {
            user_id: staffId,
            use_custom: true,
            system_override: false,
            ...currentPerms,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (error) {
        // Revert on error
        setStaffPerms((prev) => ({
          ...prev,
          [staffId]: { ...prev[staffId], [perm]: !val },
        }));
        toast.error("Failed to save permission", { description: error.message });
      }
    } finally {
      setSavingStaff((prev) => ({ ...prev, [staffId]: false }));
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full flex flex-col" style={{ background: "var(--background)" }}>


      {/* Hero banner */}
      <div
        style={{
          background: "#1C1917",
          padding: "28px 32px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "rgba(197,160,89,0.2)",
            border: "1px solid rgba(197,160,89,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 0 18px rgba(197,160,89,0.2)",
          }}
        >
          <Shield size={22} color="#C5A059" />
        </div>
        <div>
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "rgba(197,160,89,0.6)",
              marginBottom: 2,
            }}
          >
            Superadmin · Global Control
          </p>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: "#F9F7F2",
              fontFamily: "Georgia, serif",
              letterSpacing: "0.02em",
            }}
          >
            Global Permissions Matrix
          </h1>
          <p style={{ fontSize: 12, color: "rgba(232,226,212,0.45)", marginTop: 2 }}>
            Set platform-wide defaults per role and override individual staff permissions per clinic.
          </p>
        </div>
        {dirty && (
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 8,
              background: "rgba(212,112,112,0.15)",
              border: "1px solid rgba(212,112,112,0.35)",
            }}
          >
            <AlertCircle size={12} color="#D47070" />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#D47070" }}>
              Unsaved changes
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 32 }}>

        {/* ── Section 1: Platform Role Defaults ── */}
        <section
          className="luxury-card rounded-2xl overflow-hidden"
          style={{ background: "var(--surface)" }}
        >
          {/* Section header */}
          <div
            style={{
              padding: "18px 24px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Shield size={17} color="#C5A059" />
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "var(--foreground)",
                  fontFamily: "Georgia, serif",
                }}
              >
                Platform Role Defaults
              </h2>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#C5A059",
                  background: "rgba(197,160,89,0.1)",
                  border: "1px solid rgba(197,160,89,0.25)",
                  borderRadius: 4,
                  padding: "2px 8px",
                }}
              >
                5 Roles · 13 Permissions
              </span>
            </div>
            <button
              onClick={handleSaveDefaults}
              disabled={saving || !dirty}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 20px",
                borderRadius: 10,
                border: "none",
                background:
                  saving || !dirty
                    ? "rgba(197,160,89,0.35)"
                    : "linear-gradient(135deg, #C5A059, #A8853A)",
                color: "white",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "Georgia, serif",
                cursor: saving || !dirty ? "not-allowed" : "pointer",
                transition: "all 0.2s",
              }}
            >
              {saving ? (
                <>
                  <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                  Saving…
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  Save Defaults
                </>
              )}
            </button>
          </div>

          {/* Grid */}
          {loadingMatrix ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
              <Loader2 size={22} color="#C5A059" style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th
                      style={{
                        padding: "12px 20px",
                        textAlign: "left",
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        color: "var(--text-muted)",
                        minWidth: 180,
                        position: "sticky",
                        left: 0,
                        background: "var(--surface)",
                        zIndex: 1,
                      }}
                    >
                      Permission
                    </th>
                    {ROLES.map((role) => (
                      <th
                        key={role}
                        style={{
                          padding: "12px 16px",
                          textAlign: "center",
                          minWidth: 120,
                        }}
                      >
                        <RoleBadge role={role} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERM_KEYS.map((permKey, idx) => {
                    const { label, desc } = PERMISSION_LABELS[permKey];
                    const isSensitive = SENSITIVE_PERMS.has(permKey);
                    return (
                      <tr
                        key={permKey}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          background: idx % 2 === 0 ? "transparent" : "rgba(197,160,89,0.02)",
                        }}
                      >
                        <td
                          style={{
                            padding: "13px 20px",
                            position: "sticky",
                            left: 0,
                            background: idx % 2 === 0 ? "var(--surface)" : "rgba(249,247,242,0.98)",
                            zIndex: 1,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <p
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "var(--foreground)",
                                fontFamily: "Georgia, serif",
                              }}
                            >
                              {label}
                            </p>
                            {isSensitive && (
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.08em",
                                  color: "#D47070",
                                  background: "rgba(212,112,112,0.1)",
                                  border: "1px solid rgba(212,112,112,0.2)",
                                  borderRadius: 3,
                                  padding: "1px 5px",
                                }}
                              >
                                Sensitive
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
                            {desc}
                          </p>
                        </td>
                        {ROLES.map((role) => (
                          <td
                            key={role}
                            style={{ padding: "13px 16px", textAlign: "center" }}
                          >
                            <div style={{ display: "flex", justifyContent: "center" }}>
                              <Switch
                                checked={matrix[role][permKey]}
                                onChange={(v) => handleRoleToggle(role, permKey, v)}
                                offColor={isSensitive ? "#D47070" : "#E8E2D4"}
                              />
                            </div>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Section 2: Clinic Staff Overrides ── */}
        <section
          className="luxury-card rounded-2xl overflow-hidden"
          style={{ background: "var(--surface)" }}
        >
          {/* Section header */}
          <div
            style={{
              padding: "18px 24px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Building2 size={17} color="#C5A059" />
            <h2
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "var(--foreground)",
                fontFamily: "Georgia, serif",
              }}
            >
              Clinic Override
            </h2>
          </div>

          <div style={{ padding: "20px 24px" }}>
            {/* Clinic selector */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.09em",
                  color: "var(--text-muted)",
                  marginBottom: 6,
                }}
              >
                <Building2 size={11} color="var(--gold)" />
                Select Clinic
              </label>
              {loadingClinics ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Loader2 size={14} color="#C5A059" style={{ animation: "spin 1s linear infinite" }} />
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading clinics…</span>
                </div>
              ) : (
                <div style={{ position: "relative", maxWidth: 360 }}>
                  <select
                    value={selectedClinicId}
                    onChange={(e) => setSelectedClinicId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 32px 9px 12px",
                      borderRadius: 10,
                      fontSize: 13,
                      fontFamily: "Georgia, serif",
                      background: "#FDFCF9",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                      outline: "none",
                      appearance: "none",
                      cursor: "pointer",
                    }}
                  >
                    <option value="">— Choose a clinic —</option>
                    {clinics.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.location ? ` · ${c.location}` : ""}
                      </option>
                    ))}
                  </select>
                  <Building2
                    size={13}
                    color="var(--text-muted)"
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                  />
                </div>
              )}
            </div>

            {/* Staff table */}
            {selectedClinicId && (
              <>
                {loadingStaff ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
                    <Loader2 size={22} color="#C5A059" style={{ animation: "spin 1s linear infinite" }} />
                  </div>
                ) : staffList.length === 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 10,
                      padding: "40px 0",
                    }}
                  >
                    <Users size={28} color="#C5A059" style={{ opacity: 0.4 }} />
                    <p
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--foreground)",
                        fontFamily: "Georgia, serif",
                      }}
                    >
                      No staff assigned to this clinic yet
                    </p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      Staff members will appear here once they are assigned to this clinic.
                    </p>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border)" }}>
                          <th
                            style={{
                              padding: "10px 16px",
                              textAlign: "left",
                              fontSize: 10,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.1em",
                              color: "var(--text-muted)",
                              minWidth: 180,
                              position: "sticky",
                              left: 0,
                              background: "var(--surface)",
                              zIndex: 1,
                            }}
                          >
                            Staff Member
                          </th>
                          {PERM_KEYS.map((pk) => (
                            <th
                              key={pk}
                              style={{
                                padding: "10px 8px",
                                textAlign: "center",
                                fontSize: 9,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.07em",
                                color: "var(--text-muted)",
                                minWidth: 80,
                                whiteSpace: "nowrap",
                              }}
                              title={PERMISSION_LABELS[pk].desc}
                            >
                              {PERMISSION_LABELS[pk].label.replace("View ", "").replace("Edit ", "").replace("Access ", "").replace("Delete ", "")}
                            </th>
                          ))}
                          <th
                            style={{
                              padding: "10px 16px",
                              textAlign: "center",
                              fontSize: 10,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.1em",
                              color: "var(--text-muted)",
                            }}
                          >
                            Edit
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {staffList.map((staff, idx) => {
                          const isSaving = savingStaff[staff.id];
                          const perms = staffPerms[staff.id];
                          return (
                            <tr
                              key={staff.id}
                              style={{
                                borderBottom: "1px solid var(--border)",
                                background: idx % 2 === 0 ? "transparent" : "rgba(197,160,89,0.02)",
                                opacity: isSaving ? 0.7 : 1,
                                transition: "opacity 0.15s",
                              }}
                            >
                              <td
                                style={{
                                  padding: "12px 16px",
                                  position: "sticky",
                                  left: 0,
                                  background: idx % 2 === 0 ? "var(--surface)" : "rgba(249,247,242,0.98)",
                                  zIndex: 1,
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <Avatar name={staff.full_name} role={staff.role} />
                                  <div>
                                    <p
                                      style={{
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: "var(--foreground)",
                                        fontFamily: "Georgia, serif",
                                      }}
                                    >
                                      {staff.full_name ?? "—"}
                                    </p>
                                    <RoleBadge role={staff.role} />
                                  </div>
                                </div>
                              </td>
                              {PERM_KEYS.map((pk) => {
                                const isSensitive = SENSITIVE_PERMS.has(pk);
                                return (
                                  <td
                                    key={pk}
                                    style={{ padding: "12px 8px", textAlign: "center" }}
                                  >
                                    <div style={{ display: "flex", justifyContent: "center" }}>
                                      <Switch
                                        checked={perms ? perms[pk] : false}
                                        onChange={(v) => handleStaffToggle(staff.id, pk, v)}
                                        disabled={isSaving}
                                        offColor={isSensitive ? "#D47070" : "#E8E2D4"}
                                      />
                                    </div>
                                  </td>
                                );
                              })}
                              <td style={{ padding: "12px 16px", textAlign: "center" }}>
                                <Link
                                  href={`/settings/staff/${staff.id}`}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: "#C5A059",
                                    textDecoration: "none",
                                    padding: "4px 10px",
                                    borderRadius: 6,
                                    border: "1px solid rgba(197,160,89,0.3)",
                                    background: "rgba(197,160,89,0.06)",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  Edit Perms
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {!selectedClinicId && !loadingClinics && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  padding: "32px 0",
                  opacity: 0.5,
                }}
              >
                <Building2 size={28} color="#C5A059" style={{ opacity: 0.5 }} />
                <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "Georgia, serif" }}>
                  Select a clinic above to manage staff permissions
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
