"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Package, Loader2, ChevronRight, RefreshCw, PauseCircle, PlayCircle, ArrowRightLeft } from "lucide-react";
import { Patient, fmtDate } from "../types";
import { toast } from "sonner";
import { useClinic } from "@/contexts/ClinicContext";

interface Props {
  patient: Patient;
  clinicId: string;
}

interface Credit {
  id: string;
  service_name: string;
  total_sessions: number;
  used_sessions: number;
  purchase_price: number | null;
  status: string;
  expires_at: string | null;
  created_at: string;
  package_id: string | null;
  provider_id: string | null;
}

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  active:    { bg: "#F0FDF4", color: "#16A34A" },
  exhausted: { bg: "#F9FAFB", color: "#6B7280" },
  expired:   { bg: "#FEF2F2", color: "#DC2626" },
  frozen:    { bg: "#EFF6FF", color: "#2563EB" },
  cancelled: { bg: "#FEF2F2", color: "#DC2626" },
};

export default function PackagesTab({ patient, clinicId }: Props) {
  const { profile } = useClinic();
  const [credits, setCredits]     = useState<Credit[]>([]);
  const [loading, setLoading]     = useState(true);
  const [busy,    setBusy]        = useState<string | null>(null);

  const isAdmin = ["superadmin", "chain_admin", "clinic_admin"].includes(profile?.role ?? "");

  const load = async () => {
    const { data } = await supabase
      .from("patient_service_credits")
      .select("id, service_name, total_sessions, used_sessions, purchase_price, status, expires_at, created_at, package_id, provider_id")
      .eq("patient_id", patient.id)
      .eq("current_clinic_id", clinicId)
      .order("created_at", { ascending: false });
    setCredits(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [patient.id, clinicId]);

  async function freezeCredit(id: string, freeze: boolean) {
    setBusy(id);
    const { error } = await supabase.from("patient_service_credits")
      .update({ status: freeze ? "frozen" : "active" })
      .eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(freeze ? "Credit frozen" : "Credit reactivated"); await load(); }
    setBusy(null);
  }

  if (loading) return (
    <div style={{ padding: 40, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text-muted)" }}>
      <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Loading packages…
    </div>
  );

  const active   = credits.filter(c => c.status === "active");
  const inactive = credits.filter(c => c.status !== "active");

  return (
    <div style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Service Credits & Packages</h3>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
            {active.length} active · {inactive.length} inactive
          </p>
        </div>
        <button
          onClick={load}
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "none", cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {credits.length === 0 && (
        <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
          <Package size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
          <p style={{ fontSize: 14, fontWeight: 500 }}>No credits or packages</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Service credits purchased for this patient will appear here.</p>
        </div>
      )}

      {active.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 10 }}>Active</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {active.map(c => <CreditCard key={c.id} credit={c} isAdmin={isAdmin} busy={busy} onFreeze={freezeCredit} />)}
          </div>
        </div>
      )}

      {inactive.length > 0 && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 10 }}>Inactive / History</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {inactive.map(c => <CreditCard key={c.id} credit={c} isAdmin={isAdmin} busy={busy} onFreeze={freezeCredit} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function CreditCard({
  credit, isAdmin, busy, onFreeze,
}: {
  credit: Credit;
  isAdmin: boolean;
  busy: string | null;
  onFreeze: (id: string, freeze: boolean) => void;
}) {
  const used = credit.used_sessions;
  const total = credit.total_sessions;
  const remaining = total - used;
  const pct = total > 0 ? (used / total) * 100 : 0;
  const sc = STATUS_COLOR[credit.status] ?? STATUS_COLOR.exhausted;
  const isBusy = busy === credit.id;

  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{credit.service_name}</p>
          {credit.expires_at && (
            <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
              Expires {fmtDate(credit.expires_at)}
            </p>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: sc.bg, color: sc.color }}>
            {credit.status.charAt(0).toUpperCase() + credit.status.slice(1)}
          </span>
          {credit.purchase_price != null && (
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>₹{credit.purchase_price.toLocaleString("en-IN")}</span>
          )}
        </div>
      </div>

      {/* Session progress */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
          <span>{used} of {total} sessions used</span>
          <span style={{ fontWeight: 600, color: remaining > 0 ? "var(--success)" : "var(--text-muted)" }}>{remaining} remaining</span>
        </div>
        <div style={{ height: 6, background: "var(--surface-muted)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: pct >= 100 ? "var(--neutral)" : "var(--primary)", borderRadius: 3, transition: "width 0.3s" }} />
        </div>
      </div>

      {/* Admin actions */}
      {isAdmin && credit.status !== "exhausted" && credit.status !== "cancelled" && (
        <div style={{ display: "flex", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          {credit.status === "active" ? (
            <button
              onClick={() => onFreeze(credit.id, true)}
              disabled={isBusy}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "none", cursor: "pointer", fontSize: 12, color: "var(--text-secondary)" }}
            >
              <PauseCircle size={12} /> {isBusy ? "…" : "Freeze"}
            </button>
          ) : credit.status === "frozen" ? (
            <button
              onClick={() => onFreeze(credit.id, false)}
              disabled={isBusy}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, border: "1px solid var(--primary)", background: "var(--primary-subtle)", cursor: "pointer", fontSize: 12, color: "var(--primary)" }}
            >
              <PlayCircle size={12} /> {isBusy ? "…" : "Reactivate"}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
