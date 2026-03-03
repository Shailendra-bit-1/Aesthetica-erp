"use client";

import { useState, useEffect } from "react";
import {
  Wallet, CreditCard, Star, ArrowUpCircle, ArrowDownCircle,
  RefreshCw, Loader2, Users, ExternalLink, CalendarDays,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Patient, ServiceCredit, PatientMembership, fmtDate } from "../types";

// ─────────────────────── Types ────────────────────────────────────────────────

interface WalletTransaction {
  id: string;
  type: "credit" | "debit" | "refund" | "expiry";
  amount: number;
  balance_after: number;
  reason: string | null;
  created_at: string;
}

interface Props {
  patient: Patient;
  clinicId: string;
  privacyMode: boolean;
  onRefresh: () => void;
}

// ─────────────────────── Helpers ─────────────────────────────────────────────

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const MEMBERSHIP_STATUS_CFG: Record<string, { bg: string; color: string; border: string }> = {
  active:    { bg: "rgba(16,185,129,0.1)",  color: "#065F46", border: "rgba(16,185,129,0.3)" },
  expired:   { bg: "rgba(107,114,128,0.1)", color: "#374151", border: "rgba(107,114,128,0.25)" },
  cancelled: { bg: "rgba(220,38,38,0.09)",  color: "#991B1B", border: "rgba(220,38,38,0.25)" },
  paused:    { bg: "rgba(245,158,11,0.1)",  color: "#92400E", border: "rgba(245,158,11,0.3)" },
};

const CREDIT_STATUS_CFG: Record<string, { bg: string; color: string; border: string }> = {
  active:    { bg: "rgba(197,160,89,0.1)",  color: "#7A5518", border: "rgba(197,160,89,0.35)" },
  expired:   { bg: "rgba(107,114,128,0.1)", color: "#374151", border: "rgba(107,114,128,0.25)" },
  cancelled: { bg: "rgba(220,38,38,0.09)",  color: "#991B1B", border: "rgba(220,38,38,0.25)" },
};

const TX_CFG: Record<string, { icon: React.ElementType; color: string; sign: string }> = {
  credit: { icon: ArrowUpCircle,   color: "#059669", sign: "+" },
  debit:  { icon: ArrowDownCircle, color: "#DC2626", sign: "−" },
  refund: { icon: RefreshCw,       color: "#6366F1", sign: "+" },
  expiry: { icon: ArrowDownCircle, color: "#9CA3AF", sign: "−" },
};

const DURATION_LABEL: Record<string, string> = {
  monthly: "Monthly", quarterly: "Quarterly", annual: "Annual", lifetime: "Lifetime",
};

// ─────────────────────── WalletTab ───────────────────────────────────────────

export default function WalletTab({ patient, clinicId, privacyMode, onRefresh }: Props) {
  const [credits,      setCredits]      = useState<ServiceCredit[]>([]);
  const [memberships,  setMemberships]  = useState<PatientMembership[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [credRes, memRes, txRes] = await Promise.all([
        supabase
          .from("patient_service_credits")
          .select("id,service_name,total_sessions,used_sessions,purchase_price,per_session_value,status,family_shared,purchase_clinic_id,current_clinic_id,expires_at")
          .eq("patient_id", patient.id)
          .eq("status", "active")
          .order("expires_at", { ascending: true }),
        supabase
          .from("patient_memberships")
          .select("id,status,started_at,expires_at,plan:membership_plans!plan_id(name,duration_type,price)")
          .eq("patient_id", patient.id)
          .order("started_at", { ascending: false }),
        supabase
          .from("wallet_transactions")
          .select("id,type,amount,balance_after,reason,created_at")
          .eq("patient_id", patient.id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      setCredits((credRes.data ?? []) as ServiceCredit[]);
      // Normalise membership plan (supabase may return single obj or array from FK join)
      const memData = (memRes.data ?? []).map((m: Record<string, unknown>) => {
        const plan = Array.isArray(m.plan) ? m.plan[0] : m.plan;
        return { ...m, plan } as PatientMembership;
      });
      setMemberships(memData);
      setTransactions((txRes.data ?? []) as WalletTransaction[]);
      setLoading(false);
    }
    load();
  }, [patient.id]);

  const mask = (n: number) => privacyMode ? "₹ ••••" : fmtINR(n);
  const walletBal = patient.wallet_balance ?? 0;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48, gap: 8 }}>
        <Loader2 size={18} color="#C5A059" style={{ animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: 13, color: "#6B7280" }}>Loading wallet data…</span>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 22 }}>

      {/* ── Wallet Balance Card ─────────────────────────────────────────────── */}
      <div style={{
        borderRadius: 16, padding: "22px 24px",
        background: "linear-gradient(135deg, #C5A059 0%, #A8853A 55%, #8B6914 100%)",
        boxShadow: "0 4px 20px rgba(197,160,89,0.35)",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
            <Wallet size={15} color="rgba(255,255,255,0.85)" />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.8)" }}>
              Wallet Balance
            </span>
          </div>
          <p style={{ fontSize: 34, fontWeight: 700, fontFamily: "Georgia, serif", color: "#fff", margin: 0, letterSpacing: "-0.5px" }}>
            {privacyMode ? "₹ ••••" : fmtINR(walletBal)}
          </p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", margin: "4px 0 0" }}>
            {patient.full_name}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{
            padding: "8px 16px", borderRadius: 10,
            background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.3)",
          }}>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Credits Active</p>
            <p style={{ fontSize: 20, fontWeight: 700, fontFamily: "Georgia, serif", color: "#fff", margin: 0 }}>{credits.length}</p>
          </div>
        </div>
      </div>

      {/* ── Active Service Credits ──────────────────────────────────────────── */}
      <section>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
          <CreditCard size={13} color="#C5A059" />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280" }}>
            Active Service Credits
          </span>
        </div>

        {credits.length === 0 ? (
          <div style={{
            padding: "20px 16px", borderRadius: 12, textAlign: "center",
            border: "1px dashed rgba(197,160,89,0.25)", background: "rgba(197,160,89,0.02)",
          }}>
            <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>No active service credits for this patient.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {credits.map(credit => {
              const remaining  = credit.total_sessions - credit.used_sessions;
              const pct        = credit.total_sessions > 0 ? Math.round((credit.used_sessions / credit.total_sessions) * 100) : 0;
              const cfg        = CREDIT_STATUS_CFG[credit.status] ?? CREDIT_STATUS_CFG.active;
              return (
                <div key={credit.id} style={{
                  padding: "14px 16px", borderRadius: 12,
                  background: "#fff", border: "1px solid rgba(197,160,89,0.18)",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#1C1917", margin: 0, fontFamily: "Georgia, serif" }}>
                          {credit.service_name}
                        </p>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                          {credit.status}
                        </span>
                        {credit.family_shared && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, color: "#6366F1" }}>
                            <Users size={9} /> Family
                          </span>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div style={{ marginTop: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: "#6B7280" }}>{credit.used_sessions} used / {credit.total_sessions} total</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: remaining > 0 ? "#C5A059" : "#9CA3AF" }}>
                            {remaining} remaining
                          </span>
                        </div>
                        <div style={{ height: 6, borderRadius: 999, background: "rgba(197,160,89,0.15)", overflow: "hidden" }}>
                          <div style={{
                            height: "100%", borderRadius: 999, transition: "width 0.3s",
                            width: `${pct}%`,
                            background: pct >= 80 ? "linear-gradient(90deg,#DC2626,#F87171)" : "linear-gradient(90deg,#C5A059,#A8853A)",
                          }} />
                        </div>
                      </div>
                    </div>

                    {/* Value + expiry */}
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#1C1917", fontFamily: "Georgia, serif", margin: 0 }}>
                        {mask(credit.per_session_value)}<span style={{ fontSize: 10, fontWeight: 400, color: "#9CA3AF" }}>/session</span>
                      </p>
                      <p style={{ fontSize: 11, color: "#9CA3AF", margin: "3px 0 0" }}>
                        Paid: {mask(credit.purchase_price)}
                      </p>
                      {credit.expires_at && (
                        <p style={{ fontSize: 10, color: "#D97706", margin: "3px 0 0", display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                          <CalendarDays size={9} /> Expires {fmtDate(credit.expires_at)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Memberships ────────────────────────────────────────────────────── */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Star size={13} color="#C5A059" />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280" }}>
              Memberships
            </span>
          </div>
          <a href="/membership" style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 11, fontWeight: 600, color: "#C5A059",
            padding: "4px 10px", borderRadius: 7, textDecoration: "none",
            border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.06)",
          }}>
            Manage <ExternalLink size={9} />
          </a>
        </div>

        {memberships.length === 0 ? (
          <div style={{
            padding: "20px 16px", borderRadius: 12, textAlign: "center",
            border: "1px dashed rgba(197,160,89,0.25)", background: "rgba(197,160,89,0.02)",
          }}>
            <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>No memberships found for this patient.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {memberships.map(mem => {
              const cfg = MEMBERSHIP_STATUS_CFG[mem.status] ?? MEMBERSHIP_STATUS_CFG.expired;
              return (
                <div key={mem.id} style={{
                  padding: "14px 16px", borderRadius: 12,
                  background: "#fff", border: "1px solid rgba(197,160,89,0.18)",
                  display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                }}>
                  {/* Plan icon */}
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: "linear-gradient(135deg,rgba(197,160,89,0.12),rgba(197,160,89,0.06))",
                    border: "1px solid rgba(197,160,89,0.25)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Star size={16} color="#C5A059" />
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#1C1917", margin: 0, fontFamily: "Georgia, serif" }}>
                        {mem.plan?.name ?? "Unknown Plan"}
                      </p>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, textTransform: "capitalize" }}>
                        {mem.status}
                      </span>
                      {mem.plan?.duration_type && (
                        <span style={{ fontSize: 10, color: "#9CA3AF" }}>
                          {DURATION_LABEL[mem.plan.duration_type] ?? mem.plan.duration_type}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 14, marginTop: 5, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: "#6B7280" }}>Started {fmtDate(mem.started_at)}</span>
                      {mem.expires_at && (
                        <span style={{ fontSize: 11, color: mem.status === "active" ? "#D97706" : "#9CA3AF" }}>
                          {mem.status === "active" ? "Expires" : "Expired"} {fmtDate(mem.expires_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  {mem.plan?.price !== undefined && (
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#C5A059", fontFamily: "Georgia, serif", margin: 0 }}>
                        {mask(mem.plan.price)}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Wallet Ledger ──────────────────────────────────────────────────── */}
      <section>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
          <Wallet size={13} color="#C5A059" />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280" }}>
            Wallet Ledger
          </span>
          <span style={{ fontSize: 10, color: "#9CA3AF", marginLeft: 2 }}>(last 20)</span>
        </div>

        {transactions.length === 0 ? (
          <div style={{
            padding: "20px 16px", borderRadius: 12, textAlign: "center",
            border: "1px dashed rgba(197,160,89,0.25)", background: "rgba(197,160,89,0.02)",
          }}>
            <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>No wallet transactions yet.</p>
          </div>
        ) : (
          <div style={{
            borderRadius: 12, border: "1px solid rgba(197,160,89,0.18)",
            background: "#fff", overflow: "hidden",
          }}>
            {transactions.map((tx, idx) => {
              const cfg  = TX_CFG[tx.type] ?? TX_CFG.debit;
              const Icon = cfg.icon;
              const isCredit = tx.type === "credit" || tx.type === "refund";
              return (
                <div key={tx.id} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "11px 16px",
                  borderBottom: idx < transactions.length - 1 ? "1px solid rgba(197,160,89,0.08)" : "none",
                  background: idx % 2 === 0 ? "#fff" : "rgba(249,247,242,0.5)",
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: isCredit ? "rgba(16,185,129,0.08)" : "rgba(220,38,38,0.07)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={14} color={cfg.color} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#1C1917", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {tx.reason ?? (isCredit ? "Wallet credit" : "Wallet debit")}
                    </p>
                    <p style={{ fontSize: 10, color: "#9CA3AF", margin: "2px 0 0" }}>{fmtDate(tx.created_at)}</p>
                  </div>

                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: cfg.color, margin: 0, fontFamily: "Georgia, serif" }}>
                      {cfg.sign} {privacyMode ? "••••" : fmtINR(tx.amount)}
                    </p>
                    {!privacyMode && (
                      <p style={{ fontSize: 10, color: "#9CA3AF", margin: "1px 0 0" }}>
                        Bal: {fmtINR(tx.balance_after)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
