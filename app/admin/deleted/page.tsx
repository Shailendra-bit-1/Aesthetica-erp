"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import { useRouter } from "next/navigation";
import { Trash2, RotateCcw, Search, Loader2, User, Scissors, Users, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type EntityType = "patients" | "services" | "profiles";

interface DeletedRow {
  id: string;
  label: string;
  deleted_at: string | null;
  extra?: string;
}

const ENTITY_CFG: Record<EntityType, { label: string; icon: React.ElementType; color: string; selectCols: string; labelKey: string; extraKey?: string }> = {
  patients: {
    label:     "Patients",
    icon:      User,
    color:     "#2563EB",
    selectCols:"id, full_name, deleted_at, phone",
    labelKey:  "full_name",
    extraKey:  "phone",
  },
  services: {
    label:     "Services",
    icon:      Scissors,
    color:     "#059669",
    selectCols:"id, name, deleted_at, category",
    labelKey:  "name",
    extraKey:  "category",
  },
  profiles: {
    label:     "Staff Profiles",
    icon:      Users,
    color:     "#7C3AED",
    selectCols:"id, full_name, deleted_at, role",
    labelKey:  "full_name",
    extraKey:  "role",
  },
};

export default function DeletedRecordsPage() {
  const { profile, activeClinicId } = useClinic();
  const router = useRouter();
  const [entity,   setEntity]   = useState<EntityType>("patients");
  const [rows,     setRows]     = useState<DeletedRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [restoring, setRestoring] = useState<string | null>(null);

  const isSuperAdmin = profile?.role === "superadmin";

  useEffect(() => {
    if (!isSuperAdmin) { router.replace("/"); }
  }, [isSuperAdmin, router]);

  const load = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    const cfg = ENTITY_CFG[entity];

    // All three tables have deleted_at; patients also has is_deleted
    let query = supabase
      .from(entity)
      .select(cfg.selectCols)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(200);

    if (activeClinicId && entity !== "profiles") {
      query = query.eq("clinic_id", activeClinicId);
    }

    const { data } = await query;
    const mapped: DeletedRow[] = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
      id:         r.id as string,
      label:      (r[cfg.labelKey] as string) ?? "—",
      deleted_at: r.deleted_at as string | null,
      extra:      cfg.extraKey ? (r[cfg.extraKey] as string) ?? undefined : undefined,
    }));
    setRows(mapped);
    setLoading(false);
  }, [entity, isSuperAdmin, activeClinicId]);

  useEffect(() => { load(); }, [load]);

  async function restore(id: string, label: string) {
    if (!confirm(`Restore "${label}"? This will make the record visible again.`)) return;
    setRestoring(id);

    const updates: Record<string, unknown> = { deleted_at: null };
    if (entity === "patients") updates.is_deleted = false;

    const { error } = await supabase.from(entity).update(updates).eq("id", id);
    if (error) { toast.error("Restore failed: " + error.message); }
    else {
      toast.success(`"${label}" restored`);
      setRows(prev => prev.filter(r => r.id !== id));
    }
    setRestoring(null);
  }

  const filtered = rows.filter(r =>
    !search || r.label.toLowerCase().includes(search.toLowerCase()) || r.extra?.toLowerCase().includes(search.toLowerCase())
  );

  if (!isSuperAdmin) return null;

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", padding: "28px 40px 60px", maxWidth: 1000, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Trash2 size={16} style={{ color: "#DC2626" }} />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Deleted Records</h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Soft-deleted records — restore to make them visible again</p>
        </div>
        <div style={{ marginLeft: "auto", padding: "4px 12px", borderRadius: 6, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", fontSize: 11, fontWeight: 700, color: "#DC2626", letterSpacing: "0.06em" }}>
          SUPERADMIN ONLY
        </div>
      </div>

      {/* Warning */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, marginBottom: 20 }}>
        <AlertTriangle size={14} style={{ color: "#D97706", flexShrink: 0, marginTop: 1 }} />
        <p style={{ margin: 0, fontSize: 12, color: "#92400E" }}>
          Restoring a patient that was merged into another patient will create duplicate records. Only restore if the merge was erroneous.
        </p>
      </div>

      {/* Entity tabs */}
      <div style={{ display: "flex", gap: 4, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 4, width: "fit-content", marginBottom: 20 }}>
        {(Object.entries(ENTITY_CFG) as [EntityType, typeof ENTITY_CFG[EntityType]][]).map(([key, cfg]) => {
          const Icon = cfg.icon;
          const active = entity === key;
          return (
            <button key={key} onClick={() => setEntity(key)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: active ? "rgba(11,42,74,0.1)" : "transparent", color: active ? "var(--primary)" : "var(--text-muted)" }}>
              <Icon size={13} /> {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Search + refresh */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search deleted ${ENTITY_CFG[entity].label.toLowerCase()}…`}
            style={{ width: "100%", padding: "8px 10px 8px 30px", borderRadius: 9, border: "1px solid var(--border)", fontSize: 13, outline: "none", background: "var(--surface)", boxSizing: "border-box" }} />
        </div>
        <button onClick={load} style={{ padding: "8px 12px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Records */}
      <div style={{ background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48, gap: 10, color: "var(--text-muted)" }}>
            <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px" }}>
            <Trash2 size={28} style={{ color: "var(--border)", margin: "0 auto 10px" }} />
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No deleted {ENTITY_CFG[entity].label.toLowerCase()} found</p>
          </div>
        ) : filtered.map((row, i) => (
          <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 18px", borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.label}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
                {row.extra && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{row.extra}</span>}
                {row.deleted_at && (
                  <span style={{ fontSize: 11, color: "#DC2626" }}>
                    Deleted {new Date(row.deleted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => restore(row.id, row.label)}
              disabled={restoring === row.id}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(5,150,105,0.3)", background: "rgba(5,150,105,0.08)", color: "#059669", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0, opacity: restoring === row.id ? 0.6 : 1 }}>
              {restoring === row.id ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <RotateCcw size={12} />}
              Restore
            </button>
          </div>
        ))}
      </div>

      {filtered.length > 0 && (
        <p style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)", textAlign: "right" }}>{filtered.length} record{filtered.length !== 1 ? "s" : ""} · {rows.length} total deleted</p>
      )}
    </div>
  );
}
