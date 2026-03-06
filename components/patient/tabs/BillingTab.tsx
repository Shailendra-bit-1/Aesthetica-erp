"use client";

import { useState, useEffect } from "react";
import {
  FileText, ChevronDown, ChevronUp, ExternalLink, RefreshCw,
  Receipt, AlertCircle, CheckCircle2, Clock, Ban, Loader2, Download,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Patient, fmtDate, fmtDateTime } from "../types";

// ─────────────────────── Types ────────────────────────────────────────────────

interface Invoice {
  id: string;
  invoice_number: string | null;
  invoice_type: string | null;
  status: string;
  total_amount: number;
  gst_pct: number | null;
  created_at: string;
  due_date: string | null;
  paid_at: string | null;
  patient_name: string | null;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_pct: number | null;
  line_total: number;
}

interface Payment {
  id: string;
  amount: number;
  payment_mode: string;
  transaction_ref: string | null;
  recorded_by: string | null;
}

interface Props {
  patient: Patient;
  clinicId: string;
  privacyMode: boolean;
}

// ─────────────────────── Helpers ─────────────────────────────────────────────

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const STATUS_CFG: Record<string, { label: string; bg: string; color: string; border: string; icon: React.ElementType }> = {
  pending:  { label: "Pending",  bg: "rgba(245,158,11,0.1)",  color: "#92400E", border: "rgba(245,158,11,0.35)", icon: Clock },
  partial:  { label: "Partial",  bg: "rgba(59,130,246,0.1)",  color: "#1E3A8A", border: "rgba(59,130,246,0.35)", icon: RefreshCw },
  paid:     { label: "Paid",     bg: "rgba(16,185,129,0.1)",  color: "#065F46", border: "rgba(16,185,129,0.35)", icon: CheckCircle2 },
  void:     { label: "Void",     bg: "rgba(107,114,128,0.1)", color: "#374151", border: "rgba(107,114,128,0.3)", icon: Ban },
  overdue:  { label: "Overdue",  bg: "rgba(220,38,38,0.09)",  color: "#991B1B", border: "rgba(220,38,38,0.3)",  icon: AlertCircle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.pending;
  const Icon = cfg.icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 9px", borderRadius: 999,
      fontSize: 11, fontWeight: 700,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
    }}>
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

const MODE_LABEL: Record<string, string> = {
  cash: "Cash", card: "Card", upi: "UPI",
  bank_transfer: "Bank Transfer", wallet: "Wallet", insurance: "Insurance",
};

// ─────────────────────── BillingTab ──────────────────────────────────────────

export default function BillingTab({ patient, clinicId, privacyMode }: Props) {
  const [invoices, setInvoices]       = useState<Invoice[]>([]);
  const [loading, setLoading]         = useState(true);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [lineItems, setLineItems]     = useState<Record<string, LineItem[]>>({});
  const [payments, setPayments]       = useState<Record<string, Payment[]>>({});
  const [expandLoading, setExpandLoading] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("pending_invoices")
        .select("id,invoice_number,invoice_type,status,total_amount,gst_pct,created_at,due_date,paid_at,patient_name")
        .eq("patient_id", patient.id)
        .order("created_at", { ascending: false });

      if (!error) setInvoices((data ?? []) as Invoice[]);
      setLoading(false);
    }
    load();
  }, [patient.id]);

  async function toggleExpand(invoiceId: string) {
    if (expandedId === invoiceId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(invoiceId);
    if (lineItems[invoiceId] !== undefined) return; // already fetched

    setExpandLoading(invoiceId);
    const [liRes, pmtRes] = await Promise.all([
      supabase
        .from("invoice_line_items")
        .select("id,description,quantity,unit_price,discount_pct,line_total")
        .eq("invoice_id", invoiceId),
      supabase
        .from("invoice_payments")
        .select("id,amount,payment_mode,transaction_ref,recorded_by")
        .eq("invoice_id", invoiceId),
    ]);
    setLineItems(prev => ({ ...prev, [invoiceId]: (liRes.data ?? []) as LineItem[] }));
    setPayments(prev => ({ ...prev, [invoiceId]: (pmtRes.data ?? []) as Payment[] }));
    setExpandLoading(null);
  }

  // GAP-44: Download Statement of Account
  function downloadStatement() {
    const lines: string[] = [
      `STATEMENT OF ACCOUNT`,
      `Patient: ${patient.full_name}`,
      `Phone: ${patient.phone ?? "—"}`,
      `Generated: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`,
      ``,
      `Invoice#\tDate\tType\tStatus\tAmount`,
      ...invoices.map(i =>
        `${i.invoice_number ?? i.id.slice(0,8)}\t${fmtDate(i.created_at)}\t${i.invoice_type}\t${i.status}\t₹${i.total_amount.toLocaleString("en-IN")}`
      ),
      ``,
      `Total Paid: ₹${invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total_amount, 0).toLocaleString("en-IN")}`,
      `Outstanding: ₹${invoices.filter(i => ["pending","partial","overdue"].includes(i.status)).reduce((s, i) => s + i.total_amount, 0).toLocaleString("en-IN")}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `statement-${patient.full_name.replace(/\s+/g, "-")}.txt`;
    a.click(); URL.revokeObjectURL(url);
  }

  // Summary calculations
  const totalPaid        = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total_amount, 0);
  const totalOutstanding = invoices.filter(i => ["pending", "partial", "overdue"].includes(i.status)).reduce((s, i) => s + i.total_amount, 0);

  const mask = (n: number) => privacyMode ? "₹ ••••" : fmtINR(n);

  const inputSt: React.CSSProperties = {
    padding: "7px 10px", borderRadius: 8,
    border: "1px solid rgba(197,160,89,0.25)", fontSize: 12,
    color: "#1C1917", outline: "none", background: "white",
    fontFamily: "Georgia, serif",
  };

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Receipt size={14} color="#C5A059" />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280" }}>
            Invoices & Billing
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {invoices.length > 0 && (
            <button
              onClick={downloadStatement}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 9, background: "white", border: "1px solid rgba(197,160,89,0.3)", color: "#5C5447", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              <Download size={11} /> Statement
            </button>
          )}
          <a
            href={`/billing?patient=${patient.id}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "7px 14px", borderRadius: 9,
              background: "linear-gradient(135deg,#C5A059,#A8853A)",
              color: "white", fontSize: 12, fontWeight: 600,
              textDecoration: "none", boxShadow: "0 2px 6px rgba(197,160,89,0.35)",
            }}
          >
            <ExternalLink size={11} /> New Invoice
          </a>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          { label: "Total Paid",    value: mask(totalPaid),        color: "#059669", bg: "rgba(16,185,129,0.06)", border: "rgba(16,185,129,0.2)" },
          { label: "Outstanding",   value: mask(totalOutstanding),  color: "#D97706", bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.25)" },
          { label: "Total Invoices",value: String(invoices.length), color: "#C5A059", bg: "rgba(197,160,89,0.07)", border: "rgba(197,160,89,0.25)" },
        ].map(c => (
          <div key={c.label} style={{
            padding: "14px 16px", borderRadius: 12,
            background: c.bg, border: `1px solid ${c.border}`,
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280", margin: "0 0 5px" }}>{c.label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, fontFamily: "Georgia, serif", color: c.color, margin: 0 }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Invoice list */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 20, justifyContent: "center" }}>
          <Loader2 size={16} color="#C5A059" style={{ animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: 13, color: "#6B7280" }}>Loading invoices…</span>
        </div>
      ) : invoices.length === 0 ? (
        <div style={{
          padding: 32, borderRadius: 14, border: "1px dashed rgba(197,160,89,0.3)",
          textAlign: "center", background: "rgba(197,160,89,0.02)",
        }}>
          <FileText size={28} color="rgba(197,160,89,0.35)" style={{ marginBottom: 8 }} />
          <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>No invoices yet for this patient.</p>
          <p style={{ fontSize: 12, color: "#C5A059", marginTop: 6 }}>
            <a href={`/billing?patient=${patient.id}`} style={{ color: "#C5A059", textDecoration: "underline" }}>Create the first invoice →</a>
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {invoices.map(inv => {
            const isOpen   = expandedId === inv.id;
            const isLoading = expandLoading === inv.id;
            const items    = lineItems[inv.id] ?? [];
            const pmts     = payments[inv.id] ?? [];

            return (
              <div key={inv.id} style={{
                borderRadius: 12, border: "1px solid rgba(197,160,89,0.18)",
                background: "#fff", overflow: "hidden",
                boxShadow: isOpen ? "0 3px 12px rgba(0,0,0,0.06)" : "0 1px 4px rgba(0,0,0,0.03)",
                transition: "box-shadow 0.15s",
              }}>
                {/* Invoice header row */}
                <button
                  onClick={() => toggleExpand(inv.id)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center",
                    padding: "14px 16px", gap: 12,
                    background: "transparent", border: "none", cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {/* Invoice number & type */}
                  <div style={{ minWidth: 130 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#1C1917", margin: 0, fontFamily: "Georgia, serif" }}>
                      {inv.invoice_number ?? "Draft"}
                    </p>
                    {inv.invoice_type && (
                      <p style={{ fontSize: 10, color: "#9CA3AF", margin: "2px 0 0", textTransform: "capitalize" }}>{inv.invoice_type}</p>
                    )}
                  </div>

                  {/* Status */}
                  <div style={{ flexShrink: 0 }}>
                    <StatusBadge status={inv.status} />
                  </div>

                  {/* Amount */}
                  <div style={{ marginLeft: "auto", textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#1C1917", fontFamily: "Georgia, serif", margin: 0 }}>
                      {privacyMode ? "₹ ••••" : fmtINR(inv.total_amount)}
                    </p>
                    {inv.gst_pct && !privacyMode && (
                      <p style={{ fontSize: 10, color: "#9CA3AF", margin: "1px 0 0" }}>incl. {inv.gst_pct}% GST</p>
                    )}
                  </div>

                  {/* Dates */}
                  <div style={{ textAlign: "right", minWidth: 100, flexShrink: 0 }}>
                    <p style={{ fontSize: 11, color: "#6B7280", margin: 0 }}>{fmtDate(inv.created_at)}</p>
                    {inv.due_date && (
                      <p style={{ fontSize: 10, color: inv.status === "overdue" ? "#DC2626" : "#9CA3AF", margin: "2px 0 0" }}>
                        Due {fmtDate(inv.due_date)}
                      </p>
                    )}
                    {inv.paid_at && (
                      <p style={{ fontSize: 10, color: "#059669", margin: "2px 0 0" }}>Paid {fmtDate(inv.paid_at)}</p>
                    )}
                  </div>

                  {/* Expand icon */}
                  <div style={{ flexShrink: 0, marginLeft: 4 }}>
                    {isLoading
                      ? <Loader2 size={14} color="#C5A059" style={{ animation: "spin 1s linear infinite" }} />
                      : isOpen ? <ChevronUp size={14} color="#6B7280" /> : <ChevronDown size={14} color="#6B7280" />
                    }
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ borderTop: "1px solid rgba(197,160,89,0.12)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

                    {/* Line items */}
                    {items.length > 0 && (
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280", margin: "0 0 8px" }}>Line Items</p>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr>
                              {["Description", "Qty", "Unit Price", "Discount", "Total"].map(h => (
                                <th key={h} style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textAlign: h === "Description" ? "left" : "right", padding: "4px 8px", borderBottom: "1px solid rgba(197,160,89,0.12)" }}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {items.map(li => (
                              <tr key={li.id}>
                                <td style={{ fontSize: 12, color: "#1C1917", padding: "6px 8px", borderBottom: "1px solid rgba(197,160,89,0.07)" }}>{li.description}</td>
                                <td style={{ fontSize: 12, color: "#6B7280", textAlign: "right", padding: "6px 8px", borderBottom: "1px solid rgba(197,160,89,0.07)" }}>{li.quantity}</td>
                                <td style={{ fontSize: 12, color: "#6B7280", textAlign: "right", padding: "6px 8px", borderBottom: "1px solid rgba(197,160,89,0.07)" }}>{privacyMode ? "••••" : fmtINR(li.unit_price)}</td>
                                <td style={{ fontSize: 12, color: "#6B7280", textAlign: "right", padding: "6px 8px", borderBottom: "1px solid rgba(197,160,89,0.07)" }}>{li.discount_pct ? `${li.discount_pct}%` : "—"}</td>
                                <td style={{ fontSize: 12, fontWeight: 600, color: "#1C1917", textAlign: "right", padding: "6px 8px", borderBottom: "1px solid rgba(197,160,89,0.07)" }}>{privacyMode ? "₹ ••••" : fmtINR(li.line_total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {items.length === 0 && (
                      <p style={{ fontSize: 12, color: "#9CA3AF", fontStyle: "italic", margin: 0 }}>No line items recorded.</p>
                    )}

                    {/* Payments */}
                    {pmts.length > 0 && (
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280", margin: "0 0 8px" }}>Payments Received</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {pmts.map(p => (
                            <div key={p.id} style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "8px 12px", borderRadius: 8,
                              background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)",
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{
                                  fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                                  background: "rgba(16,185,129,0.1)", color: "#065F46",
                                }}>
                                  {MODE_LABEL[p.payment_mode] ?? p.payment_mode}
                                </span>
                                {p.transaction_ref && (
                                  <span style={{ fontSize: 11, color: "#6B7280" }}>Ref: {p.transaction_ref}</span>
                                )}
                                {p.recorded_by && (
                                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>by {p.recorded_by}</span>
                                )}
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#059669", fontFamily: "Georgia, serif" }}>
                                {privacyMode ? "₹ ••••" : fmtINR(p.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* View full invoice link */}
                    <div style={{ textAlign: "right" }}>
                      <a
                        href={`/billing?invoice=${inv.id}`}
                        style={{ fontSize: 12, color: "#C5A059", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        View full invoice <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Spin keyframe injection */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
