"use client";

import { useState, useEffect, useRef } from "react";
import { Stethoscope, ChevronDown, ChevronUp, CheckCircle2, Clock, XCircle, Activity, User, DollarSign, Layers, History } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Patient, Treatment, fmtDate } from "../types";
import AuditHistoryDrawer from "../AuditHistoryDrawer";

// ─────────────────────────────────────── Types ───────────────────────────────

interface Props {
  patient: Patient;
  clinicId: string;
  treatments: Treatment[];
}

type TreatmentStatus = "proposed" | "in_progress" | "completed" | "cancelled";

// ─────────────────────────────────────── Config ───────────────────────────────

const GOLD = "#C5A059";

const STATUS_CONFIG: Record<TreatmentStatus, { label: string; bg: string; text: string; border: string; icon: React.ReactNode }> = {
  proposed:    { label: "Proposed",    bg: "rgba(245,158,11,0.1)",  text: "#92400E", border: "rgba(245,158,11,0.3)",  icon: <Clock size={11} /> },
  in_progress: { label: "In Progress", bg: "rgba(59,130,246,0.1)",  text: "#1E3A8A", border: "rgba(59,130,246,0.3)",  icon: <Activity size={11} /> },
  completed:   { label: "Completed",   bg: "rgba(16,185,129,0.1)",  text: "#065F46", border: "rgba(16,185,129,0.3)",  icon: <CheckCircle2 size={11} /> },
  cancelled:   { label: "Cancelled",   bg: "rgba(156,148,132,0.1)", text: "#6B7280", border: "rgba(156,148,132,0.3)", icon: <XCircle size={11} /> },
};

const STATUS_ORDER: TreatmentStatus[] = ["proposed", "in_progress", "completed", "cancelled"];
const STATUS_OPTIONS: TreatmentStatus[] = ["proposed", "in_progress", "completed", "cancelled"];

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

// ─────────────────────────────────────── Main Component ──────────────────────

export default function TreatmentsTab({ patient, clinicId, treatments: initialTreatments }: Props) {
  const [treatments, setTreatments] = useState<Treatment[]>(initialTreatments);
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});

  useEffect(() => { setTreatments(initialTreatments); }, [initialTreatments]);

  useEffect(() => {
    async function loadSessionCounts() {
      const { data } = await supabase
        .from("credit_consumption_log")
        .select("credit_id")
        .eq("patient_id", patient.id);
      if (!data) return;
      const counts: Record<string, number> = {};
      for (const row of data) {
        counts[row.credit_id] = (counts[row.credit_id] ?? 0) + 1;
      }
      setSessionCounts(counts);
    }
    loadSessionCounts();
  }, [patient.id]);

  const totalSessionsConsumed = Object.values(sessionCounts).reduce((a, b) => a + b, 0);

  async function updateStatus(treatmentId: string, newStatus: TreatmentStatus) {
    const { error } = await supabase
      .from("patient_treatments")
      .update({ status: newStatus })
      .eq("id", treatmentId);
    if (error) {
      toast.error("Failed to update status");
      return;
    }
    setTreatments(prev => prev.map(t => t.id === treatmentId ? { ...t, status: newStatus } : t));
    toast.success(`Status updated to ${STATUS_CONFIG[newStatus].label}`);
  }

  const grouped = STATUS_ORDER.reduce<Record<TreatmentStatus, Treatment[]>>((acc, s) => {
    acc[s] = treatments.filter(t => t.status === s);
    return acc;
  }, {} as Record<TreatmentStatus, Treatment[]>);

  const activeSections = STATUS_ORDER.filter(s => grouped[s].length > 0);

  return (
    <div style={{ padding: "4px 0" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(197,160,89,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Stethoscope size={14} style={{ color: GOLD }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#2C2A26", fontFamily: "Georgia, serif" }}>
              Treatment Plan
            </h3>
            <p style={{ margin: 0, fontSize: 11, color: "#9C9584" }}>
              {treatments.length} treatment{treatments.length !== 1 ? "s" : ""}
              {totalSessionsConsumed > 0 && ` · ${totalSessionsConsumed} session${totalSessionsConsumed !== 1 ? "s" : ""} consumed`}
            </p>
          </div>
        </div>
      </div>

      {treatments.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", background: "rgba(197,160,89,0.04)", borderRadius: 12, border: "1px dashed rgba(197,160,89,0.25)" }}>
          <Stethoscope size={28} style={{ color: "rgba(197,160,89,0.4)", marginBottom: 10 }} />
          <p style={{ margin: 0, fontSize: 13, color: "#9C9584", fontFamily: "Georgia, serif" }}>No treatments recorded yet</p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#BDB6A8" }}>Treatments from counselling sessions and encounters will appear here</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {activeSections.map(status => (
            <StatusGroup
              key={status}
              status={status}
              items={grouped[status]}
              onStatusChange={updateStatus}
              sessionCounts={sessionCounts}
              patientId={patient.id}
              clinicId={clinicId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────── Status Group ────────────────────────

function StatusGroup({ status, items, onStatusChange, sessionCounts, patientId, clinicId }: {
  status: TreatmentStatus;
  items: Treatment[];
  onStatusChange: (id: string, s: TreatmentStatus) => void;
  sessionCounts: Record<string, number>;
  patientId: string;
  clinicId: string;
}) {
  const cfg = STATUS_CONFIG[status];
  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: cfg.text }}>
          {cfg.icon}{cfg.label}
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 20, background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>
          {items.length}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map(t => (
          <TreatmentCard
            key={t.id}
            treatment={t}
            onStatusChange={onStatusChange}
            sessionsConsumed={sessionCounts[t.id] ?? 0}
            patientId={patientId}
            clinicId={clinicId}
          />
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────── Treatment Card ──────────────────────

function TreatmentCard({ treatment: t, onStatusChange, sessionsConsumed, patientId, clinicId }: {
  treatment: Treatment;
  onStatusChange: (id: string, s: TreatmentStatus) => void;
  sessionsConsumed: number;
  patientId: string;
  clinicId: string;
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [expanded, setExpanded]         = useState(false);
  const [showAudit, setShowAudit]       = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const status = (t.status ?? "proposed") as TreatmentStatus;
  const cfg    = STATUS_CONFIG[status] ?? STATUS_CONFIG.proposed;

  const displayPrice = t.quoted_price ?? t.price;
  const hasDetails   = !!(t.notes || t.counselled_by || t.recommended_sessions || sessionsConsumed > 0);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown]);

  return (
    <div style={{ background: "white", borderRadius: 10, border: "1px solid rgba(197,160,89,0.15)", overflow: "visible" }}>
      {/* Main row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px" }}>
        {/* Name + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#2C2A26", fontFamily: "Georgia, serif" }}>
            {t.treatment_name}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 5, flexWrap: "wrap" }}>
            {displayPrice != null && (
              <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 600, color: GOLD }}>
                <DollarSign size={10} style={{ color: GOLD }} />
                {fmtINR(displayPrice)}
                {t.mrp != null && t.mrp > displayPrice && (
                  <span style={{ fontSize: 10, color: "#BDB6A8", textDecoration: "line-through", fontWeight: 400, marginLeft: 2 }}>
                    {fmtINR(t.mrp)}
                  </span>
                )}
              </span>
            )}
            {t.discount_pct != null && t.discount_pct > 0 && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 20, background: "rgba(16,185,129,0.1)", color: "#065F46", border: "1px solid rgba(16,185,129,0.25)" }}>
                {t.discount_pct}% off
              </span>
            )}
            {t.recommended_sessions != null && (
              <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "#6B7280" }}>
                <Layers size={10} />
                {t.recommended_sessions} session{t.recommended_sessions !== 1 ? "s" : ""}
              </span>
            )}
            {sessionsConsumed > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, color: "#065F46" }}>
                <CheckCircle2 size={10} />
                {sessionsConsumed} consumed
              </span>
            )}
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 10, color: "#BDB6A8" }}>{fmtDate(t.created_at)}</p>
        </div>

        {/* Status badge + dropdown */}
        <div ref={dropRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setShowDropdown(x => !x)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "4px 10px 4px 8px", borderRadius: 20,
              background: cfg.bg, color: cfg.text,
              border: `1px solid ${cfg.border}`,
              cursor: "pointer", fontSize: 10, fontWeight: 700,
              letterSpacing: "0.05em",
            }}
          >
            {cfg.icon}{cfg.label}<ChevronDown size={9} />
          </button>
          {showDropdown && (
            <div style={{
              position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 30,
              background: "white", border: "1px solid rgba(197,160,89,0.2)",
              borderRadius: 8, boxShadow: "0 4px 16px rgba(28,25,23,0.12)",
              overflow: "hidden", minWidth: 130,
            }}>
              {STATUS_OPTIONS.map(s => {
                const sc = STATUS_CONFIG[s];
                const isActive = s === status;
                return (
                  <button
                    key={s}
                    onClick={() => { onStatusChange(t.id, s); setShowDropdown(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 7,
                      width: "100%", padding: "8px 12px", border: "none",
                      background: isActive ? sc.bg : "transparent",
                      color: isActive ? sc.text : "#3C3830",
                      fontSize: 12, fontWeight: isActive ? 700 : 500,
                      cursor: "pointer", textAlign: "left",
                    }}
                  >
                    {sc.icon}{sc.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Audit history button */}
        <button
          onClick={() => setShowAudit(true)}
          title="View change history"
          style={{ background: "none", border: "none", cursor: "pointer", color: "#9C9584", padding: "2px", flexShrink: 0 }}
        >
          <History size={13} />
        </button>

        {/* Expand toggle (only if there are details) */}
        {hasDetails && (
          <button
            onClick={() => setExpanded(x => !x)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9C9584", padding: "2px", flexShrink: 0 }}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {/* Expandable details */}
      {expanded && hasDetails && (
        <div style={{ padding: "0 14px 14px", borderTop: "1px solid rgba(197,160,89,0.08)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 12 }}>
            {t.counselled_by && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <User size={12} style={{ color: "#9C9584", flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "#6B7280" }}>
                  Counselled by <strong style={{ color: "#3C3830" }}>{t.counselled_by}</strong>
                </span>
              </div>
            )}
            {t.package_type && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Layers size={12} style={{ color: "#9C9584", flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "#6B7280" }}>Package: <strong style={{ color: "#3C3830" }}>{t.package_type}</strong></span>
              </div>
            )}
            {t.notes && (
              <p style={{
                margin: 0, fontSize: 12, color: "#5C5447",
                background: "rgba(197,160,89,0.05)", padding: "8px 10px",
                borderRadius: 6, border: "1px solid rgba(197,160,89,0.1)",
                fontFamily: "Georgia, serif", lineHeight: 1.5,
              }}>
                {t.notes}
              </p>
            )}
          </div>
        </div>
      )}

      {/* D10: Audit history drawer */}
      {showAudit && (
        <AuditHistoryDrawer
          patientId={patientId}
          clinicId={clinicId}
          recordType="treatment"
          recordId={t.id}
          recordLabel={t.treatment_name}
          onClose={() => setShowAudit(false)}
        />
      )}
    </div>
  );
}
