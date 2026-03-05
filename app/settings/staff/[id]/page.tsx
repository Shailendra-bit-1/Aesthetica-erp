"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  ChevronLeft,
  Shield,
  Sparkles,
  Loader2,
  ToggleLeft,
  CheckCircle2,
  Crown,
  Zap,
  AlertTriangle,
  ScrollText,
  TrendingUp,
  DollarSign,
  Star,
  Banknote,
  Plus,
  X,
  Check,
} from "lucide-react";
import {
  ROLE_PERMISSIONS,
  FULL_PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_BADGE,
  type StaffPermissions,
  type StaffRole,
} from "@/lib/permissions";
import { useRole } from "@/hooks/useRole";

// ── Toggle Switch ─────────────────────────────────────────────────────────────

function Switch({
  checked,
  onChange,
  disabled = false,
  gold = false,
  size = "md",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  gold?: boolean;
  size?: "md" | "lg";
}) {
  const w = size === "lg" ? 52 : 44;
  const h = size === "lg" ? 28 : 24;
  const knob = size === "lg" ? 20 : 16;
  const gap = 4;
  const on = gold ? "#C5A059" : "#7EC88A";

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
        background: checked ? on : "#E8E2D4",
        border: `1px solid ${checked ? (gold ? "#A8853A" : "#5EAA6A") : "#D4C9B8"}`,
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

// ── Permission row ────────────────────────────────────────────────────────────

function PermRow({
  permKey,
  value,
  defaultValue,
  onChange,
  disabled,
}: {
  permKey: keyof StaffPermissions;
  value: boolean;
  defaultValue: boolean;
  onChange: (k: keyof StaffPermissions, v: boolean) => void;
  disabled: boolean;
}) {
  const { label, desc } = PERMISSION_LABELS[permKey];
  const changed = !disabled && value !== defaultValue;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "13px 20px",
        borderBottom: "1px solid #F5F2EC",
        background: changed ? "rgba(197,160,89,0.03)" : "transparent",
        transition: "background 0.15s",
      }}
    >
      <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A", fontFamily: "Georgia, serif" }}>
            {label}
          </p>
          {changed && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase" as const,
                color: "#C5A059",
                background: "rgba(197,160,89,0.12)",
                border: "1px solid rgba(197,160,89,0.25)",
                borderRadius: 4,
                padding: "1px 6px",
              }}
            >
              Modified
            </span>
          )}
        </div>
        <p style={{ fontSize: 11, color: "#8A8078", marginTop: 2 }}>{desc}</p>
      </div>
      <Switch
        checked={value}
        onChange={(v) => onChange(permKey, v)}
        disabled={disabled}
        gold
      />
    </div>
  );
}

// ── System Override card (superadmin exclusive) ───────────────────────────────

function SystemOverrideCard({
  active,
  onChange,
}: {
  active: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: `1px solid ${active ? "rgba(197,160,89,0.55)" : "rgba(197,160,89,0.25)"}`,
        overflow: "hidden",
        transition: "border-color 0.25s",
        marginBottom: 20,
      }}
    >
      {/* Dark header */}
      <div
        style={{
          background: "linear-gradient(135deg, #1C1917 0%, #2C2520 100%)",
          padding: "18px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: active ? "rgba(197,160,89,0.25)" : "rgba(197,160,89,0.12)",
              border: `1px solid ${active ? "rgba(197,160,89,0.5)" : "rgba(197,160,89,0.25)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: active ? "0 0 14px rgba(197,160,89,0.3)" : "none",
              transition: "all 0.25s",
            }}
          >
            <Zap size={17} color="#C5A059" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#F9F7F2",
                  fontFamily: "Georgia, serif",
                  letterSpacing: "0.02em",
                }}
              >
                System Override
              </p>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase" as const,
                  color: "#C5A059",
                  background: "rgba(197,160,89,0.15)",
                  border: "1px solid rgba(197,160,89,0.3)",
                  borderRadius: 4,
                  padding: "1px 7px",
                }}
              >
                Superadmin Only
              </span>
            </div>
            <p style={{ fontSize: 11, color: "rgba(232,226,212,0.45)", marginTop: 2 }}>
              Bypasses all role restrictions — changes are logged to the audit trail
            </p>
          </div>
        </div>
        <Switch checked={active} onChange={onChange} gold size="lg" />
      </div>

      {/* Status bar */}
      <div
        style={{
          padding: "10px 20px",
          background: active
            ? "rgba(197,160,89,0.08)"
            : "rgba(28,25,23,0.03)",
          borderTop: `1px solid ${active ? "rgba(197,160,89,0.2)" : "rgba(197,160,89,0.1)"}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {active ? (
          <>
            <Crown size={13} color="#C5A059" />
            <p style={{ fontSize: 12, color: "#A8853A", fontWeight: 600, fontFamily: "Georgia, serif" }}>
              ACTIVE — You have full manual control over every permission
            </p>
          </>
        ) : (
          <>
            <AlertTriangle size={13} color="#8A8078" />
            <p style={{ fontSize: 12, color: "#8A8078", fontFamily: "Georgia, serif" }}>
              Inactive — permissions follow the staff member&apos;s role defaults
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

// ── Earnings Tab ──────────────────────────────────────────────────────────────

interface Commission {
  id: string;
  service_name: string;
  patient_name: string | null;
  sale_amount: number;
  commission_pct: number;
  commission_amount: number;
  status: "pending" | "paid";
  created_at: string;
  paid_at: string | null;
}

function EarningsTab({ staffId }: { staffId: string }) {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("staff_commissions")
      .select("*, patients!patient_id(full_name)")
      .eq("provider_id", staffId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setCommissions((data ?? []).map((c: Record<string, unknown>) => ({
          ...c,
          patient_name: (c.patients as { full_name: string } | null)?.full_name ?? null,
        })) as Commission[]);
        setLoading(false);
      });
  }, [staffId]);

  const pending   = commissions.filter(c => c.status === "pending");
  const paid      = commissions.filter(c => c.status === "paid");
  const totalPending = pending.reduce((s, c) => s + c.commission_amount, 0);
  const totalPaid    = paid.reduce((s, c) => s + c.commission_amount, 0);
  const fmtInr = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
        <Loader2 size={22} color="#C5A059" style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Pending Payout",   value: fmtInr(totalPending), count: pending.length, gold: true  },
          { label: "Total Earned",      value: fmtInr(totalPaid),    count: paid.length,    gold: false },
        ].map(s => (
          <div key={s.label} style={{
            padding: "16px 20px", borderRadius: 14,
            background: s.gold ? "rgba(197,160,89,0.06)" : "rgba(249,247,242,0.8)",
            border: s.gold ? "1px solid rgba(197,160,89,0.3)" : "1px solid #E8E2D4",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              {s.gold ? <Star size={13} style={{ color: "#C5A059" }} /> : <CheckCircle2 size={13} style={{ color: "#4A8A4A" }} />}
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9C9584", margin: 0 }}>{s.label}</p>
            </div>
            <p style={{ fontSize: 22, fontWeight: 700, fontFamily: "Georgia, serif", color: s.gold ? "#C5A059" : "#2D7A2D", margin: 0 }}>{s.value}</p>
            <p style={{ fontSize: 11, color: "#9C9584", marginTop: 3 }}>{s.count} transaction(s)</p>
          </div>
        ))}
      </div>

      {commissions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <TrendingUp size={28} style={{ color: "rgba(197,160,89,0.3)", margin: "0 auto 12px" }} />
          <p style={{ fontFamily: "Georgia, serif", fontSize: 15, color: "#6B6358" }}>No commissions yet</p>
          <p style={{ fontSize: 12, color: "#9C9584" }}>Commissions are auto-calculated when a service session is consumed</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {commissions.map(c => (
            <div key={c.id} style={{
              padding: "13px 16px", borderRadius: 12, background: "white",
              border: c.status === "pending" ? "1px solid rgba(197,160,89,0.25)" : "1px solid #E8E2D4",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: c.status === "pending" ? "rgba(197,160,89,0.15)" : "rgba(74,138,74,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {c.status === "pending"
                  ? <DollarSign size={14} style={{ color: "#C5A059" }} />
                  : <CheckCircle2 size={14} style={{ color: "#4A8A4A" }} />}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: "Georgia, serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", margin: 0 }}>{c.service_name}</p>
                <p style={{ fontSize: 11, color: "#8A8078", margin: "2px 0 0" }}>
                  {c.patient_name ? `${c.patient_name} · ` : ""}{new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 700, color: c.status === "pending" ? "#C5A059" : "#2D7A2D", margin: 0 }}>
                  {fmtInr(c.commission_amount)}
                </p>
                <p style={{ fontSize: 10, color: "#9C9584", margin: "2px 0 0" }}>
                  {c.commission_pct}% of {fmtInr(c.sale_amount)}{c.status === "paid" ? " · Paid" : " · Pending"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}

// ── Compensation Tab (N1) ─────────────────────────────────────────────────────

interface AllowanceRow { key: string; label: string; amount: number; }

function CompensationTab({ staffId }: { staffId: string }) {
  const [basicSalary,  setBasicSalary]  = useState("");
  const [allowances,   setAllowances]   = useState<AllowanceRow[]>([]);
  const [deductions,   setDeductions]   = useState<AllowanceRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [newAllowKey,  setNewAllowKey]  = useState("");
  const [newAllowAmt,  setNewAllowAmt]  = useState("");
  const [newDeductKey, setNewDeductKey] = useState("");
  const [newDeductAmt, setNewDeductAmt] = useState("");

  useEffect(() => {
    supabase.from("profiles").select("basic_salary, allowances, deductions").eq("id", staffId).maybeSingle()
      .then(({ data }) => {
        if (data) {
          const d = data as any;
          setBasicSalary(String(d.basic_salary ?? 0));
          setAllowances(Object.entries(d.allowances ?? {}).map(([key, amount]) => ({ key, label: key, amount: amount as number })));
          setDeductions(Object.entries(d.deductions ?? {}).map(([key, amount]) => ({ key, label: key, amount: amount as number })));
        }
        setLoading(false);
      });
  }, [staffId]);

  const toJsonb = (rows: AllowanceRow[]) => rows.reduce<Record<string,number>>((acc, r) => { acc[r.key] = r.amount; return acc; }, {});

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      basic_salary: parseFloat(basicSalary) || 0,
      allowances:   toJsonb(allowances),
      deductions:   toJsonb(deductions),
    }).eq("id", staffId);
    setSaving(false);
    if (error) { toast.error("Failed to save compensation"); return; }
    toast.success("Compensation saved");
  };

  const gross = (parseFloat(basicSalary) || 0) + allowances.reduce((s, r) => s + r.amount, 0);
  const net   = gross - deductions.reduce((s, r) => s + r.amount, 0);

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}><Loader2 size={20} color="#C5A059" style={{ animation: "spin 1s linear infinite" }} /></div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Basic salary */}
      <div className="luxury-card rounded-2xl p-5" style={{ background: "var(--surface)" }}>
        <p style={{ fontFamily: "Georgia, serif", fontWeight: 600, fontSize: 14, color: "var(--foreground)", marginBottom: 12 }}>Basic Salary</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18, color: "#C5A059" }}>₹</span>
          <input type="number" value={basicSalary} onChange={e => setBasicSalary(e.target.value)}
            placeholder="0" style={{ flex: 1, padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(197,160,89,0.3)", fontSize: 14, outline: "none", background: "var(--surface-warm)" }} />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>/ month</span>
        </div>
      </div>

      {/* Allowances */}
      <div className="luxury-card rounded-2xl p-5" style={{ background: "var(--surface)" }}>
        <p style={{ fontFamily: "Georgia, serif", fontWeight: 600, fontSize: 14, color: "var(--foreground)", marginBottom: 12 }}>Allowances</p>
        {allowances.map((a, i) => (
          <div key={a.key} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input value={a.label} onChange={e => setAllowances(prev => prev.map((r,j) => j===i ? {...r, key: e.target.value, label: e.target.value} : r))}
              placeholder="e.g. HRA" style={{ flex: 2, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.25)", fontSize: 13, outline: "none", background: "var(--surface-warm)" }} />
            <input type="number" value={a.amount} onChange={e => setAllowances(prev => prev.map((r,j) => j===i ? {...r, amount: parseFloat(e.target.value)||0} : r))}
              placeholder="0" style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.25)", fontSize: 13, outline: "none", background: "var(--surface-warm)" }} />
            <button onClick={() => setAllowances(prev => prev.filter((_,j) => j !== i))} style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #F3E8E8", background: "rgba(220,38,38,0.06)", color: "#DC2626", cursor: "pointer" }}><X size={13} /></button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input value={newAllowKey} onChange={e => setNewAllowKey(e.target.value)} placeholder="Allowance name"
            style={{ flex: 2, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.25)", fontSize: 13, outline: "none", background: "var(--surface-warm)" }} />
          <input type="number" value={newAllowAmt} onChange={e => setNewAllowAmt(e.target.value)} placeholder="Amount"
            style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.25)", fontSize: 13, outline: "none", background: "var(--surface-warm)" }} />
          <button onClick={() => { if (!newAllowKey || !newAllowAmt) return; setAllowances(prev => [...prev, { key: newAllowKey, label: newAllowKey, amount: parseFloat(newAllowAmt)||0 }]); setNewAllowKey(""); setNewAllowAmt(""); }}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.08)", color: "#C5A059", cursor: "pointer", fontSize: 12 }}>
            <Plus size={13} />
          </button>
        </div>
      </div>

      {/* Deductions */}
      <div className="luxury-card rounded-2xl p-5" style={{ background: "var(--surface)" }}>
        <p style={{ fontFamily: "Georgia, serif", fontWeight: 600, fontSize: 14, color: "var(--foreground)", marginBottom: 12 }}>Deductions</p>
        {deductions.map((d, i) => (
          <div key={d.key} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input value={d.label} onChange={e => setDeductions(prev => prev.map((r,j) => j===i ? {...r, key: e.target.value, label: e.target.value} : r))}
              placeholder="e.g. PF" style={{ flex: 2, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.25)", fontSize: 13, outline: "none", background: "var(--surface-warm)" }} />
            <input type="number" value={d.amount} onChange={e => setDeductions(prev => prev.map((r,j) => j===i ? {...r, amount: parseFloat(e.target.value)||0} : r))}
              placeholder="0" style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.25)", fontSize: 13, outline: "none", background: "var(--surface-warm)" }} />
            <button onClick={() => setDeductions(prev => prev.filter((_,j) => j !== i))} style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #F3E8E8", background: "rgba(220,38,38,0.06)", color: "#DC2626", cursor: "pointer" }}><X size={13} /></button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input value={newDeductKey} onChange={e => setNewDeductKey(e.target.value)} placeholder="Deduction name"
            style={{ flex: 2, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.25)", fontSize: 13, outline: "none", background: "var(--surface-warm)" }} />
          <input type="number" value={newDeductAmt} onChange={e => setNewDeductAmt(e.target.value)} placeholder="Amount"
            style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.25)", fontSize: 13, outline: "none", background: "var(--surface-warm)" }} />
          <button onClick={() => { if (!newDeductKey || !newDeductAmt) return; setDeductions(prev => [...prev, { key: newDeductKey, label: newDeductKey, amount: parseFloat(newDeductAmt)||0 }]); setNewDeductKey(""); setNewDeductAmt(""); }}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.08)", color: "#C5A059", cursor: "pointer", fontSize: 12 }}>
            <Plus size={13} />
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="luxury-card rounded-2xl p-5" style={{ background: "rgba(197,160,89,0.04)", border: "1px solid rgba(197,160,89,0.2)" }}>
        <p style={{ fontFamily: "Georgia, serif", fontWeight: 600, fontSize: 14, color: "var(--foreground)", marginBottom: 10 }}>Monthly Summary</p>
        {[
          { label: "Basic Salary",  value: parseFloat(basicSalary) || 0, color: "#1a1714" },
          { label: "+ Allowances",  value: allowances.reduce((s,r) => s+r.amount,0), color: "#16a34a" },
          { label: "Gross CTC",     value: gross, color: "#C5A059", bold: true },
          { label: "- Deductions",  value: deductions.reduce((s,r) => s+r.amount,0), color: "#DC2626" },
          { label: "Net Take-Home", value: net, color: "#2563eb", bold: true },
        ].map(row => (
          <div key={row.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{row.label}</span>
            <span style={{ fontSize: 13, fontWeight: row.bold ? 700 : 500, color: row.color, fontFamily: "Georgia, serif" }}>₹{row.value.toLocaleString("en-IN")}</span>
          </div>
        ))}
      </div>

      <button onClick={handleSave} disabled={saving}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px 24px", borderRadius: 12, border: "none", background: "#C5A059", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
        {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={14} />}
        {saving ? "Saving…" : "Save Compensation"}
      </button>
    </div>
  );
}

// ── Commission Rates Tab ───────────────────────────────────────────────────────

interface CommissionRate {
  id: string;
  service_id: string | null;
  rate_pct: number;
  service_name?: string;
}

function CommissionRatesTab({ staffId, clinicId }: { staffId: string; clinicId: string }) {
  const [rates, setRates]       = useState<CommissionRate[]>([]);
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [defaultRate, setDefaultRate] = useState("");
  const [newSvcId, setNewSvcId] = useState("");
  const [newRate, setNewRate]   = useState("");

  const fmtInr = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
  void fmtInr;

  useEffect(() => {
    async function load() {
      const [{ data: rateData }, { data: svcData }] = await Promise.all([
        supabase
          .from("provider_commission_rates")
          .select("id, service_id, rate_pct")
          .eq("provider_id", staffId)
          .eq("clinic_id", clinicId),
        supabase
          .from("services")
          .select("id, name")
          .eq("clinic_id", clinicId)
          .eq("is_active", true)
          .order("name"),
      ]);
      setServices(svcData ?? []);
      const mapped = (rateData ?? []).map((r: CommissionRate) => ({
        ...r,
        service_name: svcData?.find(s => s.id === r.service_id)?.name,
      }));
      setRates(mapped);
      const def = mapped.find(r => r.service_id === null);
      if (def) setDefaultRate(String(def.rate_pct));
      setLoading(false);
    }
    load();
  }, [staffId, clinicId]);

  const saveDefault = async () => {
    const pct = parseFloat(defaultRate);
    if (isNaN(pct) || pct < 0 || pct > 100) { toast.error("Enter a valid percentage (0–100)"); return; }
    setSaving(true);
    const existing = rates.find(r => r.service_id === null);
    if (existing) {
      await supabase.from("provider_commission_rates").update({ rate_pct: pct }).eq("id", existing.id);
    } else {
      await supabase.from("provider_commission_rates").insert({
        clinic_id: clinicId, provider_id: staffId, service_id: null, rate_pct: pct,
        effective_from: new Date().toISOString().split("T")[0],
      });
    }
    setRates(prev => {
      const without = prev.filter(r => r.service_id !== null);
      return [{ id: existing?.id ?? "", service_id: null, rate_pct: pct }, ...without];
    });
    toast.success("Default commission rate saved");
    setSaving(false);
  };

  const addOverride = async () => {
    const pct = parseFloat(newRate);
    if (!newSvcId || isNaN(pct)) { toast.error("Select a service and enter a rate"); return; }
    if (rates.find(r => r.service_id === newSvcId)) { toast.error("Override already exists for this service"); return; }
    const { data, error } = await supabase.from("provider_commission_rates").insert({
      clinic_id: clinicId, provider_id: staffId, service_id: newSvcId, rate_pct: pct,
      effective_from: new Date().toISOString().split("T")[0],
    }).select().single();
    if (error) { toast.error(error.message); return; }
    const svcName = services.find(s => s.id === newSvcId)?.name;
    setRates(prev => [...prev, { ...data, service_name: svcName }]);
    setNewSvcId(""); setNewRate("");
    toast.success("Service override added");
  };

  const deleteOverride = async (id: string) => {
    await supabase.from("provider_commission_rates").delete().eq("id", id);
    setRates(prev => prev.filter(r => r.id !== id));
    toast.success("Override removed");
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
      <Loader2 size={22} color="#C5A059" style={{ animation: "spin 1s linear infinite" }} />
    </div>
  );

  const defaultEntry = rates.find(r => r.service_id === null);
  const overrides    = rates.filter(r => r.service_id !== null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Default rate card */}
      <div style={{ padding: "20px 24px", borderRadius: 16, background: "#fff", border: "1px solid rgba(197,160,89,0.2)" }}>
        <p style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 600, color: "#1A1A1A", marginBottom: 4 }}>Default Commission Rate</p>
        <p style={{ fontSize: 11, color: "#8A8078", marginBottom: 16 }}>Applied to all sessions unless a per-service override is set</p>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="number" min={0} max={100} step={0.5}
            value={defaultRate}
            onChange={e => setDefaultRate(e.target.value)}
            placeholder="e.g. 10"
            style={{ width: 120, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.35)", fontSize: 14, outline: "none" }}
          />
          <span style={{ fontSize: 14, color: "#6b7280" }}>%</span>
          <button onClick={saveDefault} disabled={saving}
            style={{ padding: "8px 18px", borderRadius: 8, background: "var(--gold)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            {saving ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={13} />}
            Save
          </button>
          {defaultEntry && <span style={{ fontSize: 12, color: "#9CA3AF" }}>Current: {defaultEntry.rate_pct}%</span>}
        </div>
      </div>

      {/* Per-service overrides */}
      <div style={{ padding: "20px 24px", borderRadius: 16, background: "#fff", border: "1px solid rgba(197,160,89,0.2)" }}>
        <p style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 600, color: "#1A1A1A", marginBottom: 4 }}>Per-Service Overrides</p>
        <p style={{ fontSize: 11, color: "#8A8078", marginBottom: 16 }}>Override the default rate for specific services</p>

        {/* Add override row */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <select value={newSvcId} onChange={e => setNewSvcId(e.target.value)}
            style={{ flex: 1, minWidth: 160, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.35)", fontSize: 13, outline: "none", background: "#fff" }}>
            <option value="">Select service…</option>
            {services.filter(s => !overrides.find(o => o.service_id === s.id)).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input type="number" min={0} max={100} step={0.5} value={newRate} onChange={e => setNewRate(e.target.value)}
            placeholder="Rate %"
            style={{ width: 90, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.35)", fontSize: 13, outline: "none" }} />
          <button onClick={addOverride}
            style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(197,160,89,0.1)", color: "var(--gold)", border: "1px solid rgba(197,160,89,0.3)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Add
          </button>
        </div>

        {overrides.length === 0 ? (
          <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: "16px 0" }}>No per-service overrides</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {overrides.map(o => (
              <div key={o.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: "rgba(197,160,89,0.04)", border: "1px solid rgba(197,160,89,0.12)" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A", margin: 0 }}>{o.service_name ?? o.service_id}</p>
                  <p style={{ fontSize: 11, color: "#8A8078", margin: "2px 0 0" }}>{o.rate_pct}% commission</p>
                </div>
                <button onClick={() => deleteOverride(o.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                  <X size={14} color="#9CA3AF" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}

export default function StaffPermissionsPage() {
  const params = useParams();
  const staffId = params.id as string;

  const { isSuperAdmin } = useRole();

  // Staff profile
  const [profile, setProfile] = useState<{
    id: string;
    role: string;
    full_name: string | null;
    email: string | null;
  } | null>(null);

  // Current superadmin's profile (for audit log)
  const [myProfile, setMyProfile] = useState<{
    id: string;
    full_name: string | null;
  } | null>(null);

  // Permission state
  const [useCustom, setUseCustom] = useState(false);
  const [systemOverride, setSystemOverride] = useState(false);
  const [perms, setPerms] = useState<StaffPermissions>(FULL_PERMISSIONS);
  // savedPerms = what's currently persisted — used to diff for audit log
  const [savedPerms, setSavedPerms] = useState<StaffPermissions>(FULL_PERMISSIONS);
  const [roleDefaults, setRoleDefaults] = useState<StaffPermissions>(FULL_PERMISSIONS);
  const [activeTab, setActiveTab] = useState<"permissions" | "earnings" | "commission_rates" | "compensation">("permissions");
  const [staffClinicId, setStaffClinicId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      // Load current user
      const {
        data: { user: me },
      } = await supabase.auth.getUser();
      if (me) {
        const { data: mp } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("id", me.id)
          .single();
        setMyProfile(mp ?? { id: me.id, full_name: null });
      }

      // Load staff profile
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, role, full_name, email, clinic_id")
        .eq("id", staffId)
        .single();

      setProfile(prof ?? { id: staffId, role: "staff", full_name: null, email: null });
      if (prof?.clinic_id) setStaffClinicId(prof.clinic_id);

      const role = prof?.role as StaffRole | null;
      const defaults =
        role && ROLE_PERMISSIONS[role] ? ROLE_PERMISSIONS[role] : FULL_PERMISSIONS;
      setRoleDefaults(defaults);

      // Load existing permission overrides
      const { data: cp } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", staffId)
        .single();

      if (cp?.use_custom) {
        setUseCustom(true);
        setSystemOverride(cp.system_override ?? false);
        const { use_custom, system_override: so, user_id, updated_at, ...p } = cp;
        const typed = p as StaffPermissions;
        setPerms(typed);
        setSavedPerms(typed);
      } else {
        setPerms(defaults);
        setSavedPerms(defaults);
      }
    }

    load().finally(() => setLoading(false));
  }, [staffId]);

  // ── Toggles ─────────────────────────────────────────────────────────────────

  function handleToggleCustom(enabled: boolean) {
    setUseCustom(enabled);
    if (!enabled) setPerms(roleDefaults);
    setSaved(false);
  }

  function handleToggleOverride(enabled: boolean) {
    setSystemOverride(enabled);
    if (!enabled) {
      setUseCustom(false);
      setPerms(roleDefaults);
    } else {
      setUseCustom(true);
    }
    setSaved(false);
  }

  function handlePermChange(key: keyof StaffPermissions, val: boolean) {
    setPerms((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);

    const isOverride = isSuperAdmin && systemOverride;
    const effectiveUseCustom = useCustom || isOverride;
    const effectivePerms = effectiveUseCustom ? perms : roleDefaults;

    try {
      // Persist permissions
      const { error: permErr } = await supabase
        .from("user_permissions")
        .upsert(
          {
            user_id: staffId,
            use_custom: effectiveUseCustom,
            system_override: isOverride,
            ...effectivePerms,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (permErr) {
        toast.error("Failed to save permissions", {
          description: permErr.message,
          icon: <Shield size={14} color="#C5A059" />,
        });
        return;
      }

      // ── Audit log — write one entry per changed permission ────────────────
      if (isSuperAdmin && myProfile) {
        const permKeys = Object.keys(PERMISSION_LABELS) as (keyof StaffPermissions)[];
        const changes = permKeys.filter((k) => effectivePerms[k] !== savedPerms[k]);

        if (changes.length > 0) {
          const actorName = myProfile.full_name ?? "Superadmin";
          const targetName = profile?.full_name ?? staffId;

          const entries = changes.map((key) => ({
            actor_id: myProfile.id,
            actor_name: actorName,
            target_id: staffId,
            target_name: targetName,
            action: "permission_change",
            permission_key: key,
            old_value: savedPerms[key],
            new_value: effectivePerms[key],
          }));

          const { error: auditErr } = await supabase
            .from("audit_logs")
            .insert(entries);

          if (auditErr) {
            // Non-fatal — log to console but don't block the save
            console.warn("[audit_logs] insert error:", auditErr.message);
          }
        }
      }

      // Sync savedPerms to the new state
      setSavedPerms({ ...effectivePerms });
      setSaved(true);

      toast.success("Permissions saved", {
        description: isSuperAdmin && systemOverride
          ? "System override is active — changes logged to audit trail."
          : effectiveUseCustom
          ? "Custom overrides applied."
          : "Permissions reset to role defaults.",
        icon: <Sparkles size={14} color="#C5A059" />,
      });
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const badge = ROLE_BADGE[profile?.role ?? ""] ?? {
    label: profile?.role ?? "Staff",
    bg: "rgba(197,160,89,0.1)",
    color: "#8A8078",
    border: "rgba(197,160,89,0.2)",
  };

  const permKeys = Object.keys(PERMISSION_LABELS) as (keyof StaffPermissions)[];

  // Active editing is allowed when custom or system override is on
  const canEdit = useCustom || (isSuperAdmin && systemOverride);

  return (
    <div className="min-h-full" style={{ background: "var(--background)" }}>
      <TopBar />

      <div className="px-8 pb-12 max-w-3xl mx-auto">
        {/* Back */}
        <Link
          href="/admin/users"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "#8A8078",
            textDecoration: "none",
            marginBottom: 20,
            padding: "6px 0",
          }}
        >
          <ChevronLeft size={14} />
          Back to Staff
        </Link>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
            <Loader2 size={24} color="#C5A059" style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : (
          <>
            {/* Staff card */}
            <div
              className="luxury-card rounded-2xl p-6 mb-6"
              style={{ background: "var(--surface)" }}
            >
              <div className="flex items-center gap-4">
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    background: badge.bg,
                    border: `2px solid ${badge.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    fontWeight: 700,
                    color: badge.color,
                    fontFamily: "Georgia, serif",
                    flexShrink: 0,
                  }}
                >
                  {profile?.full_name
                    ? profile.full_name
                        .split(" ")
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()
                    : "??"}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    style={{
                      fontFamily: "Georgia, serif",
                      fontSize: 18,
                      fontWeight: 600,
                      color: "var(--foreground)",
                    }}
                  >
                    {profile?.full_name ?? "Staff Member"}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {profile?.email ?? profile?.id ?? "—"}
                  </p>
                </div>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "4px 12px",
                    borderRadius: 20,
                    fontSize: 12,
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
              </div>

              {/* Audit trail link (superadmin only) */}
              {isSuperAdmin && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #F0EBE2" }}>
                  <Link
                    href="/admin/audit"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      color: "#8A8078",
                      textDecoration: "none",
                    }}
                  >
                    <ScrollText size={13} />
                    View audit trail for this staff member
                    <ChevronLeft size={12} style={{ transform: "rotate(180deg)" }} />
                  </Link>
                </div>
              )}
            </div>

            {/* ── Tab bar ── */}
            <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: "1px solid #F0EBE2" }}>
              {([
                { key: "permissions",     label: "Permissions",    icon: <Shield size={13} /> },
                { key: "earnings",        label: "Earnings",       icon: <TrendingUp size={13} /> },
                { key: "commission_rates",label: "Commission Rates",icon: <DollarSign size={13} /> },
                { key: "compensation",    label: "Compensation",   icon: <Banknote size={13} /> },
              ] as const).map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "9px 18px", border: "none", background: "transparent",
                    fontSize: 13, fontFamily: "Georgia, serif", cursor: "pointer",
                    fontWeight: activeTab === t.key ? 600 : 400,
                    color: activeTab === t.key ? "#C5A059" : "#8A8078",
                    borderBottom: activeTab === t.key ? "2px solid #C5A059" : "2px solid transparent",
                    marginBottom: -1, transition: "all 0.15s",
                  }}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* ── Earnings Tab ── */}
            {activeTab === "earnings" && <EarningsTab staffId={staffId} />}

            {/* ── Commission Rates Tab ── */}
            {activeTab === "commission_rates" && staffClinicId && (
              <CommissionRatesTab staffId={staffId} clinicId={staffClinicId} />
            )}

            {/* ── Compensation Tab (N1) ── */}
            {activeTab === "compensation" && (
              <CompensationTab staffId={staffId} />
            )}

            {/* ── System Override (superadmin only) ── */}
            {activeTab === "permissions" && isSuperAdmin && (
              <SystemOverrideCard
                active={systemOverride}
                onChange={handleToggleOverride}
              />
            )}

            {/* ── Permissions card ── */}
            {activeTab === "permissions" && <div
              className="luxury-card rounded-2xl overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              {/* Card header */}
              <div
                style={{
                  padding: "20px 24px",
                  borderBottom: "1px solid #F0EBE2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: "rgba(197,160,89,0.1)",
                      border: "1px solid rgba(197,160,89,0.22)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Shield size={16} color="#C5A059" />
                  </div>
                  <div>
                    <p
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: "var(--foreground)",
                        fontFamily: "Georgia, serif",
                      }}
                    >
                      Access Permissions
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                      {systemOverride
                        ? "System override active — all toggles unlocked"
                        : useCustom
                        ? "Custom overrides are active"
                        : `Using default permissions for ${badge.label}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Custom permissions toggle — only shown when NOT in system override */}
              {!isSuperAdmin && (
                <div
                  style={{
                    padding: "16px 24px",
                    borderBottom: "1px solid #F0EBE2",
                    background: useCustom ? "rgba(197,160,89,0.03)" : "#FDFCF8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <ToggleLeft size={18} color={useCustom ? "#C5A059" : "#8A8078"} />
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
                        Custom Permissions
                      </p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                        Override role defaults with individual toggles
                      </p>
                    </div>
                  </div>
                  <Switch checked={useCustom} onChange={handleToggleCustom} gold />
                </div>
              )}

              {/* Permission rows */}
              <div>
                {permKeys.map((key) => (
                  <PermRow
                    key={key}
                    permKey={key}
                    value={perms[key]}
                    defaultValue={roleDefaults[key]}
                    onChange={handlePermChange}
                    disabled={!canEdit}
                  />
                ))}
              </div>

              {/* Footer */}
              <div
                style={{
                  padding: "16px 24px",
                  borderTop: "1px solid #F0EBE2",
                  background: "#FDFCF8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <p style={{ fontSize: 11, color: "#A89E94", fontFamily: "Georgia, serif", fontStyle: "italic" }}>
                  {systemOverride
                    ? "All changes are saved to the audit trail automatically."
                    : canEdit
                    ? "Custom overrides will replace role defaults for this user."
                    : isSuperAdmin
                    ? "Enable System Override above to unlock all toggles."
                    : "Enable Custom Permissions to override individual settings."}
                </p>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 22px",
                    borderRadius: 10,
                    border: "none",
                    background: saving
                      ? "rgba(197,160,89,0.45)"
                      : "linear-gradient(135deg, #C5A059 0%, #D4B472 45%, #A8853A 100%)",
                    color: "white",
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "Georgia, serif",
                    cursor: saving ? "not-allowed" : "pointer",
                    boxShadow: saving ? "none" : "0 4px 16px rgba(197,160,89,0.3)",
                    transition: "all 0.2s",
                    whiteSpace: "nowrap" as const,
                  }}
                >
                  {saving ? (
                    <>
                      <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                      Saving…
                    </>
                  ) : saved ? (
                    <>
                      <CheckCircle2 size={14} />
                      Saved
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Save Permissions
                    </>
                  )}
                </button>
              </div>
            </div>}
          </>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
