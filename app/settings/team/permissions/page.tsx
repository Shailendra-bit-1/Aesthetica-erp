"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Crown, Globe, ShieldCheck, Loader2, Users, Search, Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";

// ── Permission columns ────────────────────────────────────────────────────────

const CLINICAL_PERMS = [
  { key: "patients.view",  label: "View Patients"  },
  { key: "notes.edit",     label: "Edit Face Map"  },
  { key: "photos.upload",  label: "Upload Photos"  },
] as const;

const BUSINESS_PERMS = [
  { key: "revenue.view",   label: "View Revenue"   },
  { key: "inventory.edit", label: "Edit Inventory" },
  { key: "billing.access", label: "Manage Billing" },
] as const;

const ALL_PERMS = [...CLINICAL_PERMS, ...BUSINESS_PERMS];

// ── Types ─────────────────────────────────────────────────────────────────────

interface StaffRow {
  id: string;
  full_name: string | null;
  role: string;
  clinic_id: string | null;
}

interface PermCell {
  value: boolean;
  isOverride: boolean;
  roleDefault: boolean;
}

type PermMatrix = Record<string, Record<string, PermCell>>;
type RoleDefaultMap = Record<string, Set<string>>;

interface ClinicOption { id: string; name: string }

const STAFF_ROLES = ["doctor", "therapist", "counsellor", "front_desk"];

const ROLE_LABELS: Record<string, string> = {
  doctor:      "Doctor",
  therapist:   "Therapist",
  counsellor:  "Counsellor",
  front_desk:  "Front Desk",
};

const ROLE_COLORS: Record<string, string> = {
  doctor:      "rgba(197,160,89,0.15)",
  therapist:   "rgba(122,158,142,0.15)",
  counsellor:  "rgba(122,142,158,0.15)",
  front_desk:  "rgba(158,142,122,0.15)",
};

const ROLE_TEXT: Record<string, string> = {
  doctor:     "#A8853A",
  therapist:  "#4A7A68",
  counsellor: "#4A5E7A",
  front_desk: "#7A6A52",
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TeamPermissionsPage() {
  const { profile, clinics: ctxClinics } = useClinic();

  const role         = profile?.role ?? null;
  const isSuperAdmin = role === "superadmin";
  const isChainAdmin = role === "chain_admin";

  // Scope selector
  const [clinicOptions,   setClinicOptions]   = useState<ClinicOption[]>([]);
  const [selectedClinicId, setSelectedClinic] = useState<string>("all");

  // Matrix data
  const [staff,   setStaff]   = useState<StaffRow[]>([]);
  const [matrix,  setMatrix]  = useState<PermMatrix>({});
  const [saving,  setSaving]  = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");

  // ── Clinic options ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile) return;

    if (isSuperAdmin) {
      setClinicOptions([
        { id: "all", name: "All Clinics" },
        ...ctxClinics.map((c) => ({ id: c.id, name: c.name })),
      ]);
    } else if (isChainAdmin && profile.clinic_id) {
      supabase
        .from("clinics")
        .select("id, name")
        .order("name")
        .then(({ data }) => {
          const opts = data ?? [];
          setClinicOptions(opts);
          if (opts.length > 0) setSelectedClinic(opts[0].id);
        });
    } else if (profile.clinic_id) {
      setSelectedClinic(profile.clinic_id);
    }
  }, [profile, isSuperAdmin, isChainAdmin, ctxClinics]);

  // ── Load matrix ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    // 1. Staff in scope
    let q = supabase
      .from("profiles")
      .select("id, full_name, role, clinic_id")
      .in("role", STAFF_ROLES)
      .eq("is_active", true);

    if (selectedClinicId !== "all") {
      q = q.eq("clinic_id", selectedClinicId);
    } else if (!isSuperAdmin && profile.clinic_id) {
      q = q.eq("clinic_id", profile.clinic_id);
    }

    const { data: staffData } = await q;
    const staffList = staffData ?? [];
    setStaff(staffList);

    if (staffList.length === 0) {
      setMatrix({});
      setLoading(false);
      return;
    }

    // 2. Role defaults
    const rolesInList = [...new Set(staffList.map((s) => s.role))];
    const { data: roleRows } = await supabase
      .from("role_permissions")
      .select("role, permission")
      .in("role", rolesInList);

    const roleDefaults: RoleDefaultMap = {};
    (roleRows ?? []).forEach((r) => {
      if (!roleDefaults[r.role]) roleDefaults[r.role] = new Set();
      roleDefaults[r.role].add(r.permission);
    });

    // 3. User overrides for all staff
    const staffIds = staffList.map((s) => s.id);
    const { data: overrideRows } = await supabase
      .from("user_overrides")
      .select("user_id, permission, is_enabled")
      .in("user_id", staffIds);

    const overrideMap: Record<string, Record<string, boolean>> = {};
    (overrideRows ?? []).forEach((o) => {
      if (!overrideMap[o.user_id]) overrideMap[o.user_id] = {};
      overrideMap[o.user_id][o.permission] = !!o.is_enabled;
    });

    // 4. Build matrix
    const mat: PermMatrix = {};
    for (const s of staffList) {
      mat[s.id] = {};
      const defaults  = roleDefaults[s.role] ?? new Set<string>();
      const overrides = overrideMap[s.id]    ?? {};

      for (const col of ALL_PERMS) {
        const roleDefault = defaults.has(col.key);
        const isOverride  = col.key in overrides;
        const value       = isOverride ? overrides[col.key] : roleDefault;
        mat[s.id][col.key] = { value, isOverride, roleDefault };
      }
    }

    setMatrix(mat);
    setLoading(false);
  }, [profile, selectedClinicId, isSuperAdmin]);

  useEffect(() => { load(); }, [load]);

  // Realtime: re-render whenever any override changes
  useEffect(() => {
    const ch = supabase
      .channel("matrix_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_overrides" }, load)
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [load]);

  // ── Toggle handler ─────────────────────────────────────────────────────────
  async function handleToggle(s: StaffRow, permKey: string) {
    const cell = matrix[s.id]?.[permKey];
    if (!cell) return;

    const key      = `${s.id}:${permKey}`;
    const newValue = !cell.value;
    const backToDefault = newValue === cell.roleDefault;

    setSaving(key);

    // Optimistic update immediately
    setMatrix((prev) => ({
      ...prev,
      [s.id]: {
        ...prev[s.id],
        [permKey]: { value: newValue, isOverride: !backToDefault, roleDefault: cell.roleDefault },
      },
    }));

    try {
      if (backToDefault) {
        const { error } = await supabase
          .from("user_overrides")
          .delete()
          .eq("user_id", s.id)
          .eq("permission", permKey);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_overrides")
          .upsert(
            { user_id: s.id, permission: permKey, is_enabled: newValue },
            { onConflict: "user_id,permission" }
          );
        if (error) throw error;
      }

      const permLabel = ALL_PERMS.find((c) => c.key === permKey)?.label ?? permKey;
      const name      = s.full_name ?? "Staff member";

      toast.success(`${name} — ${permLabel} ${newValue ? "enabled" : "disabled"}`, {
        description: backToDefault
          ? "Reverted to role default"
          : "Custom override saved",
      });
    } catch {
      // Revert optimistic update
      setMatrix((prev) => ({
        ...prev,
        [s.id]: { ...prev[s.id], [permKey]: cell },
      }));
      toast.error("Failed to save — please try again");
    } finally {
      setSaving(null);
    }
  }

  const filteredStaff = search
    ? staff.filter(
        (s) =>
          (s.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
          s.role.toLowerCase().includes(search.toLowerCase())
      )
    : staff;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full" style={{ background: "var(--background)" }}>


      <div className="px-8 py-8" style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1
              className="text-2xl font-semibold mb-1"
              style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}
            >
              Team Permissions Matrix
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Role defaults + manual overrides · changes apply live without a page refresh
            </p>
          </div>

          {(isSuperAdmin || isChainAdmin) && clinicOptions.length > 0 && (
            <select
              value={selectedClinicId}
              onChange={(e) => setSelectedClinic(e.target.value)}
              className="text-sm px-3 py-2 rounded-xl"
              style={{
                background: "var(--surface)",
                border: "1px solid rgba(197,160,89,0.3)",
                color: "var(--foreground)",
                fontFamily: "Georgia, serif",
                cursor: "pointer",
              }}
            >
              {clinicOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* ── God Mode banner ── */}
        {isSuperAdmin && (
          <div
            className="flex items-center gap-4 mb-8 p-5 rounded-2xl"
            style={{
              background: "linear-gradient(135deg, rgba(197,160,89,0.13), rgba(168,133,58,0.06))",
              border: "1px solid rgba(197,160,89,0.35)",
              boxShadow: "0 0 28px rgba(197,160,89,0.10), inset 0 1px 0 rgba(197,160,89,0.12)",
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: "rgba(197,160,89,0.2)",
                boxShadow: "0 0 14px rgba(197,160,89,0.45)",
              }}
            >
              <Crown size={18} color="#C5A059" />
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className="text-sm font-bold"
                  style={{ color: "var(--gold)", fontFamily: "Georgia, serif" }}
                >
                  God Mode — Superadmin
                </span>
                <span
                  className="px-2 py-0.5 rounded-full font-bold"
                  style={{
                    background: "rgba(197,160,89,0.2)",
                    color: "#A8853A",
                    fontSize: 9,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  All Access
                </span>
              </div>
              <p className="text-sm" style={{ color: "rgba(197,160,89,0.65)" }}>
                You have unrestricted access across all clinics and chains.
                Use the matrix below to manage individual staff permissions.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Zap size={14} style={{ color: "rgba(197,160,89,0.5)" }} />
              <Globe size={16} style={{ color: "rgba(197,160,89,0.45)" }} />
            </div>
          </div>
        )}

        {/* ── Search bar ── */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative">
            <Search
              size={14}
              className="absolute"
              style={{ color: "rgba(197,160,89,0.4)", top: "50%", left: 12, transform: "translateY(-50%)" }}
            />
            <input
              type="text"
              placeholder="Search staff…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                paddingLeft: 34,
                paddingRight: 12,
                paddingTop: 9,
                paddingBottom: 9,
                borderRadius: 12,
                background: "var(--surface)",
                border: "1px solid rgba(197,160,89,0.2)",
                color: "var(--foreground)",
                fontSize: 13,
                fontFamily: "Georgia, serif",
                outline: "none",
                width: 260,
              }}
            />
          </div>

          <p className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>
            <span style={{ color: "var(--gold)", fontWeight: 600 }}>{filteredStaff.length}</span>
            {" "}staff member{filteredStaff.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* ── Matrix ── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "#F9F7F2",
            border: "1px solid rgba(197,160,89,0.18)",
            boxShadow: "0 4px 28px rgba(0,0,0,0.06)",
          }}
        >
          {/* ── Column header row ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "220px 1fr 1px 1fr",
              background: "rgba(197,160,89,0.06)",
              borderBottom: "1px solid rgba(197,160,89,0.14)",
            }}
          >
            {/* Staff col */}
            <div className="px-5 py-4 flex items-end">
              <p
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: "rgba(100,80,40,0.45)" }}
              >
                Staff Member
              </p>
            </div>

            {/* Clinical group */}
            <div className="px-6 py-3 flex flex-col" style={{ borderLeft: "1px solid rgba(197,160,89,0.12)" }}>
              <p
                className="text-xs font-bold uppercase tracking-widest mb-3"
                style={{ color: "#C5A059" }}
              >
                Clinical
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {CLINICAL_PERMS.map((p) => (
                  <span key={p.key} className="text-xs font-medium" style={{ color: "rgba(80,60,20,0.6)" }}>
                    {p.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div style={{ background: "rgba(197,160,89,0.13)" }} />

            {/* Business group */}
            <div className="px-6 py-3 flex flex-col">
              <p
                className="text-xs font-bold uppercase tracking-widest mb-3"
                style={{ color: "#7A8E9E" }}
              >
                Business
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {BUSINESS_PERMS.map((p) => (
                  <span key={p.key} className="text-xs font-medium" style={{ color: "rgba(80,60,20,0.6)" }}>
                    {p.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ── Data rows ── */}
          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <Loader2
                size={22}
                style={{ color: "#C5A059", animation: "spin 1s linear infinite" }}
              />
              <p className="text-sm" style={{ color: "rgba(100,80,40,0.45)", fontFamily: "Georgia, serif" }}>
                Loading staff…
              </p>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(197,160,89,0.08)" }}
              >
                <Users size={20} style={{ color: "rgba(197,160,89,0.35)" }} />
              </div>
              <p className="text-sm" style={{ color: "rgba(100,80,40,0.45)", fontFamily: "Georgia, serif" }}>
                No staff found in this scope
              </p>
              <p className="text-xs" style={{ color: "rgba(100,80,40,0.3)" }}>
                Add staff members with roles: Doctor, Therapist, Counsellor, or Front Desk
              </p>
            </div>
          ) : (
            filteredStaff.map((s, idx) => {
              const cells  = matrix[s.id] ?? {};
              const isLast = idx === filteredStaff.length - 1;

              return (
                <div
                  key={s.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "220px 1fr 1px 1fr",
                    borderBottom: isLast ? "none" : "1px solid rgba(197,160,89,0.09)",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = "rgba(197,160,89,0.03)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = "transparent";
                  }}
                >
                  {/* Staff identity */}
                  <div className="px-5 py-4 flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{
                        background: ROLE_COLORS[s.role] ?? "rgba(197,160,89,0.12)",
                        color: ROLE_TEXT[s.role] ?? "#A8853A",
                        fontFamily: "Georgia, serif",
                      }}
                    >
                      {(s.full_name ?? "?")
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: "#3D2C0A", fontFamily: "Georgia, serif" }}
                      >
                        {s.full_name ?? "—"}
                      </p>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded font-medium"
                        style={{
                          background: ROLE_COLORS[s.role] ?? "rgba(197,160,89,0.1)",
                          color: ROLE_TEXT[s.role] ?? "#A8853A",
                          fontSize: 10,
                        }}
                      >
                        {ROLE_LABELS[s.role] ?? s.role}
                      </span>
                    </div>
                  </div>

                  {/* Clinical toggles */}
                  <div
                    className="px-6 py-4"
                    style={{ borderLeft: "1px solid rgba(197,160,89,0.09)" }}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                      {CLINICAL_PERMS.map((p) => (
                        <PermToggle
                          key={p.key}
                          cell={cells[p.key]}
                          saving={saving === `${s.id}:${p.key}`}
                          onChange={() => handleToggle(s, p.key)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Vertical rule */}
                  <div className="self-stretch" style={{ background: "rgba(197,160,89,0.09)" }} />

                  {/* Business toggles */}
                  <div className="px-6 py-4">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                      {BUSINESS_PERMS.map((p) => (
                        <PermToggle
                          key={p.key}
                          cell={cells[p.key]}
                          saving={saving === `${s.id}:${p.key}`}
                          onChange={() => handleToggle(s, p.key)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Legend ── */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 px-1">
          <LegendItem color="#C5A059" glow="0 0 6px rgba(197,160,89,0.5)" label="Role default (ON)" />
          <LegendItem color="#C5A059" dashed label="Custom override (ON)" />
          <LegendItem color="rgba(197,160,89,0.1)" label="Disabled" />
          <div className="flex items-center gap-1.5 ml-auto">
            <ShieldCheck size={12} style={{ color: "rgba(197,160,89,0.45)" }} />
            <span className="text-xs" style={{ color: "rgba(100,80,40,0.4)" }}>
              Changes are live — no refresh required
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Gold Toggle ───────────────────────────────────────────────────────────────

function PermToggle({
  cell,
  saving,
  onChange,
}: {
  cell?: PermCell;
  saving: boolean;
  onChange: () => void;
}) {
  if (!cell) {
    return <div style={{ width: 38, height: 22, borderRadius: 11, background: "rgba(197,160,89,0.05)" }} />;
  }

  const { value, isOverride } = cell;

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={onChange}
        disabled={saving}
        aria-label={value ? "Disable permission" : "Enable permission"}
        style={{
          width: 38,
          height: 22,
          borderRadius: 11,
          background: value
            ? isOverride
              ? "linear-gradient(135deg, #C5A059, #A8853A)"
              : "#C5A059"
            : "rgba(197,160,89,0.1)",
          border: `1px solid ${value ? "rgba(197,160,89,0.55)" : "rgba(197,160,89,0.18)"}`,
          boxShadow: value ? "0 0 10px rgba(197,160,89,0.42)" : "none",
          position: "relative",
          transition: "all 0.2s ease",
          cursor: saving ? "default" : "pointer",
          opacity: saving ? 0.55 : 1,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: value ? 19 : 3,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: value ? "white" : "rgba(197,160,89,0.35)",
            transition: "left 0.2s ease",
            boxShadow: value ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
          }}
        />
      </button>

      {/* Custom override indicator dot */}
      {isOverride && (
        <span
          title={`Custom override — ${value ? "enabled" : "disabled"}`}
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: value ? "#C5A059" : "rgba(180,60,60,0.55)",
            flexShrink: 0,
          }}
        />
      )}
    </div>
  );
}

// ── Legend item ───────────────────────────────────────────────────────────────

function LegendItem({
  color,
  glow,
  dashed,
  label,
}: {
  color: string;
  glow?: string;
  dashed?: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          background: color,
          boxShadow: glow,
          border: dashed ? "1.5px dashed rgba(197,160,89,0.7)" : undefined,
        }}
      />
      <span className="text-xs" style={{ color: "rgba(100,80,40,0.5)" }}>
        {label}
      </span>
    </div>
  );
}
