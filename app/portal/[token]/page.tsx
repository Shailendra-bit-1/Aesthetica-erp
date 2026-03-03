"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Sparkles, Calendar, FileText, Wallet, Trophy, LogOut,
  Clock, CheckCircle, XCircle, AlertCircle, ChevronRight,
  CreditCard, ArrowDownCircle, ArrowUpCircle, Star,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────── */
interface PortalPatient {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  date_of_birth: string | null;
  wallet_balance: number;
}

interface PortalAppointment {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  service_name: string | null;
  notes: string | null;
  profiles: { full_name: string } | null;
}

interface PortalInvoice {
  id: string;
  invoice_number: string | null;
  service_name: string | null;
  total_amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
}

interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  reason: string | null;
  created_at: string;
}

interface LoyaltyData {
  balance: number;
  tier: string;
  color: string;
}

interface PortalData {
  patient: PortalPatient;
  appointments: PortalAppointment[];
  invoices: PortalInvoice[];
  wallet: { transactions: WalletTransaction[]; balance: number };
  loyalty: LoyaltyData;
}

/* ─── Helpers ────────────────────────────────────────────── */
const TIER_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Bronze:   { bg: "rgba(205,127,50,0.12)",  text: "#8B5E3C", border: "rgba(205,127,50,0.3)" },
  Silver:   { bg: "rgba(168,168,168,0.12)", text: "#6b7280", border: "rgba(168,168,168,0.3)" },
  Gold:     { bg: "rgba(197,160,89,0.15)",  text: "#92702A", border: "rgba(197,160,89,0.4)" },
  Platinum: { bg: "rgba(100,116,139,0.12)", text: "#475569", border: "rgba(100,116,139,0.3)" },
};

const APPT_STATUS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  scheduled:  { label: "Upcoming",   color: "#2563eb", icon: <Clock size={12} /> },
  confirmed:  { label: "Confirmed",  color: "#16a34a", icon: <CheckCircle size={12} /> },
  completed:  { label: "Completed",  color: "#6b7280", icon: <CheckCircle size={12} /> },
  cancelled:  { label: "Cancelled",  color: "#dc2626", icon: <XCircle size={12} /> },
  no_show:    { label: "No Show",    color: "#f59e0b", icon: <AlertCircle size={12} /> },
};

const INV_STATUS: Record<string, { label: string; color: string }> = {
  pending:    { label: "Pending",  color: "#f59e0b" },
  partial:    { label: "Partial",  color: "#2563eb" },
  paid:       { label: "Paid",     color: "#16a34a" },
  overdue:    { label: "Overdue",  color: "#dc2626" },
  void:       { label: "Void",     color: "#9ca3af" },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
function fmtCur(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function PortalDashboard() {
  const { token } = useParams<{ token: string }>();
  const router     = useRouter();

  const [data,    setData]    = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<"appointments" | "billing" | "wallet">("appointments");
  const [apptFilter, setApptFilter] = useState<"upcoming" | "past">("upcoming");

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`/api/portal/data?token=${token}`);
        if (res.status === 401) { router.replace("/portal"); return; }
        const json = await res.json();
        if (json.error) { router.replace("/portal"); return; }
        setData(json as PortalData);
      } catch {
        router.replace("/portal");
      } finally {
        setLoading(false);
      }
    })();
  }, [token, router]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#F9F7F2", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <Sparkles size={32} color="#C5A059" style={{ margin: "0 auto 12px" }} />
          <p style={{ color: "#6b7280", fontSize: 14 }}>Loading your portal…</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { patient, appointments, invoices, wallet, loyalty } = data;
  const tierStyle = TIER_STYLES[loyalty.tier] ?? TIER_STYLES.Bronze;

  const now = new Date();
  const upcomingAppts = appointments.filter(a => new Date(a.start_time) >= now && !["cancelled","no_show"].includes(a.status));
  const pastAppts     = appointments.filter(a => new Date(a.start_time) < now || ["cancelled","no_show"].includes(a.status));

  const pendingAmt = invoices.filter(i => ["pending","partial","overdue"].includes(i.status)).reduce((s, i) => s + i.total_amount, 0);

  return (
    <div style={{ minHeight: "100vh", background: "#F9F7F2" }}>

      {/* ── Header ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid rgba(197,160,89,0.15)", padding: "16px 20px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Sparkles size={20} color="#C5A059" />
            <span style={{ fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 18, color: "#1a1714" }}>Aesthetica</span>
          </div>
          <button
            onClick={() => router.replace("/portal")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "none", cursor: "pointer", fontSize: 12, color: "#6b7280" }}
          >
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px" }}>

        {/* ── Patient Card ── */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, border: "1px solid rgba(197,160,89,0.2)", marginBottom: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Welcome back</p>
              <h1 style={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 700, color: "#1a1714", marginBottom: 4 }}>{patient.full_name}</h1>
              <p style={{ fontSize: 12, color: "#6b7280" }}>{patient.phone}</p>
            </div>
            {/* Loyalty badge */}
            <div style={{ textAlign: "right" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, background: tierStyle.bg, border: `1px solid ${tierStyle.border}` }}>
                <Trophy size={13} color={tierStyle.text} />
                <span style={{ fontSize: 12, fontWeight: 700, color: tierStyle.text }}>{loyalty.tier}</span>
              </div>
              <p style={{ fontSize: 12, marginTop: 4, color: "#6b7280" }}><span style={{ fontWeight: 700, color: "#1a1714" }}>{loyalty.balance.toLocaleString()}</span> pts</p>
            </div>
          </div>

          {/* Quick stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 16 }}>
            {[
              { label: "Upcoming", value: upcomingAppts.length.toString(), icon: <Calendar size={14} color="#2563eb" />, color: "#2563eb" },
              { label: "Due",      value: fmtCur(pendingAmt),              icon: <FileText size={14} color="#f59e0b" />, color: "#f59e0b" },
              { label: "Wallet",   value: fmtCur(wallet.balance),          icon: <Wallet size={14} color="#16a34a" />,  color: "#16a34a" },
            ].map(s => (
              <div key={s.label} style={{ background: "#faf9f7", borderRadius: 10, padding: "10px 12px", border: "1px solid #f3f4f6" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>{s.icon}<span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase" }}>{s.label}</span></div>
                <p style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["appointments", "billing", "wallet"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                flex: 1, padding: "9px 4px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: tab === t ? "#1a1714" : "#fff",
                color:      tab === t ? "#fff"    : "#6b7280",
                boxShadow:  tab === t ? "none"    : "0 1px 4px rgba(0,0,0,0.06)",
                transition: "all 0.15s",
              }}>
              {t === "appointments" ? "Appointments" : t === "billing" ? "Billing" : "Wallet & Loyalty"}
            </button>
          ))}
        </div>

        {/* ─── Appointments Tab ─── */}
        {tab === "appointments" && (
          <div>
            {/* Sub-filter */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {(["upcoming", "past"] as const).map(f => (
                <button key={f} onClick={() => setApptFilter(f)}
                  style={{ padding: "5px 14px", borderRadius: 8, border: "1px solid", cursor: "pointer", fontSize: 12, fontWeight: 600,
                    background:   apptFilter === f ? "rgba(197,160,89,0.12)" : "transparent",
                    borderColor:  apptFilter === f ? "rgba(197,160,89,0.4)"  : "#e5e7eb",
                    color:        apptFilter === f ? "#92702A"               : "#6b7280",
                  }}>
                  {f === "upcoming" ? `Upcoming (${upcomingAppts.length})` : `Past (${pastAppts.length})`}
                </button>
              ))}
            </div>

            {(apptFilter === "upcoming" ? upcomingAppts : pastAppts).length === 0 ? (
              <div style={{ background: "#fff", borderRadius: 14, padding: 32, textAlign: "center", border: "1px solid #f3f4f6" }}>
                <Calendar size={28} color="#d1d5db" style={{ margin: "0 auto 8px" }} />
                <p style={{ color: "#9ca3af", fontSize: 13 }}>No {apptFilter} appointments</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(apptFilter === "upcoming" ? upcomingAppts : pastAppts).map(a => {
                  const s = APPT_STATUS[a.status] ?? APPT_STATUS.scheduled;
                  return (
                    <div key={a.id} style={{ background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #f3f4f6", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: 700, fontSize: 14, color: "#1a1714", marginBottom: 3 }}>{a.service_name ?? "Appointment"}</p>
                          <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 3 }}>
                            <Calendar size={11} style={{ display: "inline", marginRight: 4 }} />
                            {fmt(a.start_time)} · {fmtTime(a.start_time)} – {fmtTime(a.end_time)}
                          </p>
                          {a.profiles && (
                            <p style={{ fontSize: 12, color: "#6b7280" }}>Dr. {a.profiles.full_name}</p>
                          )}
                          {a.notes && <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, fontStyle: "italic" }}>{a.notes}</p>}
                        </div>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20,
                          fontSize: 11, fontWeight: 700, color: s.color, background: `${s.color}18`,
                        }}>
                          {s.icon} {s.label}
                        </span>
                      </div>
                      {["scheduled", "confirmed"].includes(a.status) && new Date(a.start_time) > new Date() && (
                        <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 10, paddingTop: 10, borderTop: "1px solid #f3f4f6" }}>
                          To cancel or reschedule, please contact the clinic directly.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── Billing Tab ─── */}
        {tab === "billing" && (
          <div>
            {invoices.length === 0 ? (
              <div style={{ background: "#fff", borderRadius: 14, padding: 32, textAlign: "center", border: "1px solid #f3f4f6" }}>
                <FileText size={28} color="#d1d5db" style={{ margin: "0 auto 8px" }} />
                <p style={{ color: "#9ca3af", fontSize: 13 }}>No invoices found</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {invoices.map(inv => {
                  const s = INV_STATUS[inv.status] ?? INV_STATUS.pending;
                  return (
                    <div key={inv.id} style={{ background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #f3f4f6", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                        <div style={{ flex: 1 }}>
                          {inv.invoice_number && (
                            <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", marginBottom: 2 }}>{inv.invoice_number}</p>
                          )}
                          <p style={{ fontWeight: 700, fontSize: 14, color: "#1a1714", marginBottom: 3 }}>{inv.service_name ?? "Services"}</p>
                          <p style={{ fontSize: 12, color: "#6b7280" }}>{fmt(inv.created_at)}</p>
                          {inv.paid_at && <p style={{ fontSize: 11, color: "#16a34a", marginTop: 2 }}>Paid on {fmt(inv.paid_at)}</p>}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontWeight: 700, fontSize: 16, color: "#1a1714", marginBottom: 6 }}>{fmtCur(inv.total_amount)}</p>
                          <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, color: s.color, background: `${s.color}18` }}>{s.label}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {pendingAmt > 0 && (
              <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 12, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <p style={{ fontSize: 12, color: "#92400e", fontWeight: 600 }}>
                  You have <strong>{fmtCur(pendingAmt)}</strong> in outstanding dues. Please contact the clinic to settle your balance.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ─── Wallet & Loyalty Tab ─── */}
        {tab === "wallet" && (
          <div>
            {/* Wallet balance */}
            <div style={{ background: "linear-gradient(135deg, #1a1714 0%, #2d2520 100%)", borderRadius: 16, padding: 22, marginBottom: 14, color: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Wallet size={16} color="#C5A059" />
                <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Wallet Balance</span>
              </div>
              <p style={{ fontFamily: "Georgia, serif", fontSize: 32, fontWeight: 700, color: "#C5A059" }}>{fmtCur(wallet.balance)}</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>Available for payment at the clinic</p>
            </div>

            {/* Loyalty summary */}
            <div style={{ background: "#fff", borderRadius: 14, padding: 18, marginBottom: 14, border: "1px solid #f3f4f6", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Trophy size={16} color={tierStyle.text} />
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#1a1714" }}>Loyalty Points</span>
                </div>
                <span style={{ padding: "4px 12px", borderRadius: 20, background: tierStyle.bg, border: `1px solid ${tierStyle.border}`, fontSize: 12, fontWeight: 700, color: tierStyle.text }}>
                  {loyalty.tier} Tier
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "#faf9f7", borderRadius: 10, padding: 14 }}>
                  <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Points Balance</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: tierStyle.text }}>{loyalty.balance.toLocaleString()}</p>
                </div>
                <div style={{ background: "#faf9f7", borderRadius: 10, padding: 14 }}>
                  <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Redemption Value</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: "#1a1714" }}>{fmtCur(Math.floor(loyalty.balance / 100) * 10)}</p>
                </div>
              </div>
              <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 12 }}>Every 100 points = ₹10 off your next visit. Earn 1 point per ₹10 spent.</p>
            </div>

            {/* Wallet transactions */}
            <div style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #f3f4f6" }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "#1a1714", marginBottom: 14 }}>Transaction History</h3>
              {wallet.transactions.length === 0 ? (
                <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "16px 0" }}>No transactions yet</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {wallet.transactions.map((tx, i) => {
                    const isCredit = tx.type === "credit";
                    return (
                      <div key={tx.id} style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "12px 0",
                        borderBottom: i < wallet.transactions.length - 1 ? "1px solid #f9fafb" : "none",
                      }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: isCredit ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.1)",
                        }}>
                          {isCredit
                            ? <ArrowDownCircle size={16} color="#16a34a" />
                            : <ArrowUpCircle size={16} color="#dc2626" />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#1a1714", marginBottom: 1 }}>
                            {tx.reason ?? (isCredit ? "Credit" : "Debit")}
                          </p>
                          <p style={{ fontSize: 11, color: "#9ca3af" }}>{fmt(tx.created_at)}</p>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: isCredit ? "#16a34a" : "#dc2626" }}>
                            {isCredit ? "+" : "–"}{fmtCur(Math.abs(tx.amount))}
                          </p>
                          <p style={{ fontSize: 10, color: "#9ca3af" }}>Bal {fmtCur(tx.balance_after)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <p style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", marginTop: 24 }}>
          Your data is encrypted and secure. For assistance, contact the clinic directly.
        </p>
      </div>
    </div>
  );
}
