"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import { CheckCircle2, XCircle, ExternalLink, Send, CreditCard, Smartphone } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Invoice {
  id: string;
  invoice_number: string;
  patient_name: string;
  total_amount: number;
  status: string;
}

interface Patient {
  id: string;
  full_name: string;
  phone: string | null;
}

interface PayResult {
  success: boolean;
  payment_id?: string;
  new_status?: string;
  amount?: number;
  error?: string;
  [k: string]: unknown;
}

type MsgType = "appointment_reminder" | "post_treatment" | "birthday_offer" | "invoice_due" | "custom";

const MSG_TEMPLATES: Record<MsgType, (name: string) => string> = {
  appointment_reminder: (n) =>
    `Hi ${n}, this is a reminder for your appointment tomorrow at Aesthetica Clinic. Please arrive 10 mins early. Reply CONFIRM to confirm or CANCEL to cancel. 📅`,
  post_treatment: (n) =>
    `Hi ${n}, hope you're feeling great after your treatment! 🌟 Please follow the aftercare instructions provided. Contact us if you have any concerns.`,
  birthday_offer: (n) =>
    `Happy Birthday ${n}! 🎂 We're celebrating you with a special 15% off on your next visit. Use code BDAY15 when booking. Valid for 30 days!`,
  invoice_due: (n) =>
    `Hi ${n}, your invoice from Aesthetica Clinic is due. Please contact us to settle your balance at your earliest convenience. 🧾`,
  custom: () => "",
};

const INTERESTS = [
  "Botox", "Filler", "Laser Treatment", "Skin Care",
  "Hair Restoration", "Body Contouring", "PRP Therapy", "Other",
];

// ── Reusable result card ───────────────────────────────────────────────────────

function ResultCard({
  result,
  onClear,
}: {
  result: { success: boolean; [k: string]: unknown };
  onClear: () => void;
}) {
  return (
    <div
      className="rounded-xl border p-4 mt-4"
      style={{
        background: result.success ? "rgba(34,197,94,0.08)" : "rgba(220,38,38,0.08)",
        borderColor: result.success ? "#16a34a" : "#DC2626",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {result.success ? (
            <CheckCircle2 size={18} color="#16a34a" />
          ) : (
            <XCircle size={18} color="#DC2626" />
          )}
          <span
            className="text-sm font-semibold"
            style={{ color: result.success ? "#16a34a" : "#DC2626" }}
          >
            {result.success ? "Success" : "Error"}
          </span>
        </div>
        <button onClick={onClear} className="text-xs text-gray-400 hover:text-gray-600">
          Dismiss
        </button>
      </div>
      <pre
        className="text-xs rounded p-2 overflow-auto max-h-32"
        style={{ background: "rgba(0,0,0,0.04)", color: "#374151" }}
      >
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function SimulatorPage() {
  const { profile, activeClinicId: clinicId } = useClinic();

  const [tab, setTab] = useState<"payment" | "meta" | "google" | "whatsapp">("payment");

  // ── Payment tab ─────────────────────────────────────────────────────────────
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payResult, setPayResult] = useState<PayResult | null>(null);

  // ── Lead tabs ───────────────────────────────────────────────────────────────
  const [leadForm, setLeadForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    interest: "",
    campaign: "",
  });
  const [leadLoading, setLeadLoading] = useState(false);
  const [leadResult, setLeadResult] = useState<{
    success: boolean;
    lead_id?: string;
    error?: string;
    source?: string;
  } | null>(null);

  // ── WhatsApp tab ────────────────────────────────────────────────────────────
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [msgType, setMsgType] = useState<MsgType>("appointment_reminder");
  const [msgText, setMsgText] = useState(
    MSG_TEMPLATES.appointment_reminder("there")
  );
  const [waResult, setWaResult] = useState<string | null>(null);
  const [waSending, setWaSending] = useState(false);

  // ── Load invoices + patients ─────────────────────────────────────────────────
  useEffect(() => {
    if (!clinicId) return;

    supabase
      .from("pending_invoices")
      .select("id, invoice_number, patient_name, total_amount, status")
      .in("status", ["pending", "partial"])
      .eq("clinic_id", clinicId)
      .limit(20)
      .then(({ data }) => setInvoices(data ?? []));

    supabase
      .from("patients")
      .select("id, full_name, phone")
      .eq("clinic_id", clinicId)
      .limit(50)
      .then(({ data }) => setPatients(data ?? []));
  }, [clinicId]);

  // ── Update message when type or patient changes ───────────────────────────
  useEffect(() => {
    const name = selectedPatient?.full_name ?? "there";
    setMsgText(MSG_TEMPLATES[msgType](name));
  }, [msgType, selectedPatient]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleSelectInvoice(inv: Invoice) {
    setSelectedInvoice(inv);
    setPayAmount(String(inv.total_amount));
    setPayResult(null);
  }

  function handleOpenModal() {
    if (!selectedInvoice || !payAmount || Number(payAmount) <= 0) return;
    setShowModal(true);
    setPayResult(null);
  }

  async function handlePay() {
    if (!selectedInvoice || paying) return;
    setPaying(true);
    try {
      const res = await fetch("/api/simulate/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: selectedInvoice.id,
          amount: Number(payAmount),
          payment_mode: "card",
        }),
      });
      const json = await res.json();
      setPayResult(json);
      if (json.success) {
        // Refresh invoices
        const { data } = await supabase
          .from("pending_invoices")
          .select("id, invoice_number, patient_name, total_amount, status")
          .in("status", ["pending", "partial"])
          .eq("clinic_id", clinicId!)
          .limit(20);
        setInvoices(data ?? []);
        if (json.new_status === "paid") {
          setSelectedInvoice(null);
        }
      }
    } finally {
      setPaying(false);
    }
  }

  async function handleLeadSubmit(source: "meta_ads" | "google_ads") {
    if (!leadForm.full_name.trim() || !leadForm.phone.trim()) return;
    setLeadLoading(true);
    setLeadResult(null);
    try {
      const res = await fetch("/api/simulate/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, ...leadForm }),
      });
      const json = await res.json();
      setLeadResult({ ...json, source });
    } finally {
      setLeadLoading(false);
    }
  }

  async function handleWaSend() {
    if (!selectedPatient || !msgText.trim() || !clinicId) return;
    setWaSending(true);
    setWaResult(null);
    try {
      await supabase.from("notifications").insert({
        clinic_id: clinicId,
        type: "whatsapp_preview",
        title: "WhatsApp Preview",
        body: msgText.slice(0, 80),
        entity_type: "patient",
        action_url: `/patients/${selectedPatient.id}`,
        is_read: false,
      });
      setWaResult("Message delivered to notification log");
    } catch {
      setWaResult("Failed to log message");
    } finally {
      setWaSending(false);
    }
  }

  // ── Shared tab button style ───────────────────────────────────────────────────

  const tabBtn = (t: typeof tab) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      tab === t
        ? "text-white"
        : "text-gray-600 hover:bg-gray-100"
    }`;

  const tabBg: Record<typeof tab, string> = {
    payment: "#3395FF",
    meta: "#0866FF",
    google: "#4285F4",
    whatsapp: "#25D366",
  };

  return (
    <div className="min-h-screen" style={{ background: "#F9F7F2" }}>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Georgia, serif", color: "#1a1a1a" }}>
            Integration Simulator
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Fire mock events for Razorpay, Meta Ads, Google Ads, and WhatsApp — no real API keys needed.
          </p>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-2 mb-6 p-1 rounded-xl" style={{ background: "#EDE9E0" }}>
          {(["payment", "meta", "google", "whatsapp"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setLeadResult(null); }}
              className={tabBtn(t)}
              style={tab === t ? { background: tabBg[t] } : {}}
            >
              {t === "payment" && "Razorpay"}
              {t === "meta" && "Meta Ads"}
              {t === "google" && "Google Ads"}
              {t === "whatsapp" && "WhatsApp"}
            </button>
          ))}
        </div>

        {/* ── Tab 1: Payment ─────────────────────────────────────────────────── */}
        {tab === "payment" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <CreditCard size={18} color="#3395FF" /> Mock Razorpay Payment
              </h2>

              <div className="mb-4">
                <label className="text-xs font-medium text-gray-500 mb-1 block">Select Invoice</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={selectedInvoice?.id ?? ""}
                  onChange={(e) => {
                    const inv = invoices.find((i) => i.id === e.target.value) ?? null;
                    if (inv) handleSelectInvoice(inv);
                    else setSelectedInvoice(null);
                  }}
                >
                  <option value="">— Select a pending invoice —</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} — {inv.patient_name} — ₹{inv.total_amount.toLocaleString("en-IN")}
                    </option>
                  ))}
                </select>
                {invoices.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">No pending/partial invoices found.</p>
                )}
              </div>

              <div className="mb-5">
                <label className="text-xs font-medium text-gray-500 mb-1 block">Amount (₹)</label>
                <input
                  type="number"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  min={1}
                  placeholder="Enter amount"
                />
              </div>

              <button
                onClick={handleOpenModal}
                disabled={!selectedInvoice || !payAmount || Number(payAmount) <= 0}
                className="w-full py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-40 transition-opacity"
                style={{ background: "#3395FF" }}
              >
                Pay with Razorpay
              </button>

              {payResult && !showModal && (
                <ResultCard result={payResult} onClear={() => setPayResult(null)} />
              )}
            </div>

            {/* Right — invoice details */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="font-semibold text-gray-800 mb-4">Invoice Details</h2>
              {selectedInvoice ? (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Invoice #</span>
                    <span className="font-medium">{selectedInvoice.invoice_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Patient</span>
                    <span className="font-medium">{selectedInvoice.patient_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total</span>
                    <span className="font-medium">₹{selectedInvoice.total_amount.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                      style={{
                        background:
                          selectedInvoice.status === "pending"
                            ? "rgba(234,179,8,0.15)"
                            : "rgba(59,130,246,0.12)",
                        color:
                          selectedInvoice.status === "pending" ? "#92400E" : "#1D4ED8",
                      }}
                    >
                      {selectedInvoice.status}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Select an invoice to see details.</p>
              )}
            </div>
          </div>
        )}

        {/* ── Tab 2: Meta Ads ────────────────────────────────────────────────── */}
        {tab === "meta" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Meta header */}
            <div
              className="px-6 py-4 flex items-center gap-3"
              style={{ background: "linear-gradient(90deg, #0866FF 0%, #1877F2 100%)" }}
            >
              <div className="text-white font-bold text-xl tracking-tight">f</div>
              <div>
                <div className="text-white font-semibold text-sm">Meta Lead Ads</div>
                <div className="text-blue-100 text-xs">Simulate a lead from a Meta Ads campaign</div>
              </div>
            </div>

            <div className="p-6">
              <LeadForm
                form={leadForm}
                onChange={(k, v) => setLeadForm((p) => ({ ...p, [k]: v }))}
                onSubmit={() => handleLeadSubmit("meta_ads")}
                loading={leadLoading}
                buttonColor="#0866FF"
                buttonLabel="Send Test Lead"
                showCampaign={false}
                showAdGroup={false}
              />

              {leadResult && (
                <div>
                  <ResultCard result={leadResult} onClear={() => setLeadResult(null)} />
                  {leadResult.success && (
                    <a
                      href="/crm"
                      className="inline-flex items-center gap-1 text-xs mt-2 font-medium"
                      style={{ color: "#0866FF" }}
                    >
                      View in CRM <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab 3: Google Ads ──────────────────────────────────────────────── */}
        {tab === "google" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Google header */}
            <div className="px-6 py-4 flex items-center gap-3" style={{ background: "#F8F9FA", borderBottom: "1px solid #E8EAED" }}>
              <div className="flex gap-0.5">
                {["#4285F4", "#EA4335", "#FBBC05", "#34A853"].map((c, i) => (
                  <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                ))}
              </div>
              <div>
                <div className="font-semibold text-sm text-gray-800">Google Lead Form</div>
                <div className="text-gray-500 text-xs">Simulate a lead from a Google Ads campaign</div>
              </div>
            </div>

            <div className="p-6">
              <LeadForm
                form={leadForm}
                onChange={(k, v) => setLeadForm((p) => ({ ...p, [k]: v }))}
                onSubmit={() => handleLeadSubmit("google_ads")}
                loading={leadLoading}
                buttonColor="#4285F4"
                buttonLabel="Submit Test Lead"
                showCampaign
                showAdGroup
              />

              {leadResult && (
                <div>
                  <ResultCard result={leadResult} onClear={() => setLeadResult(null)} />
                  {leadResult.success && (
                    <a
                      href="/crm"
                      className="inline-flex items-center gap-1 text-xs mt-2 font-medium"
                      style={{ color: "#4285F4" }}
                    >
                      View in CRM <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab 4: WhatsApp ────────────────────────────────────────────────── */}
        {tab === "whatsapp" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left panel */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Smartphone size={18} color="#25D366" /> WhatsApp Message Preview
              </h2>

              <div className="mb-3">
                <label className="text-xs font-medium text-gray-500 mb-1 block">Patient</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={selectedPatient?.id ?? ""}
                  onChange={(e) => {
                    const p = patients.find((x) => x.id === e.target.value) ?? null;
                    setSelectedPatient(p);
                  }}
                >
                  <option value="">— Select a patient —</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} {p.phone ? `(${p.phone})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="text-xs font-medium text-gray-500 mb-1 block">Message Type</label>
                <div className="flex flex-wrap gap-2">
                  {(["appointment_reminder", "post_treatment", "birthday_offer", "invoice_due", "custom"] as MsgType[]).map((mt) => (
                    <button
                      key={mt}
                      onClick={() => setMsgType(mt)}
                      className="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
                      style={
                        msgType === mt
                          ? { background: "#25D366", color: "#fff", borderColor: "#25D366" }
                          : { background: "#fff", color: "#374151", borderColor: "#D1D5DB" }
                      }
                    >
                      {mt.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-5">
                <label className="text-xs font-medium text-gray-500 mb-1 block">Message</label>
                <textarea
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                />
              </div>

              <button
                onClick={handleWaSend}
                disabled={!selectedPatient || !msgText.trim() || waSending}
                className="w-full py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2 transition-opacity"
                style={{ background: "#25D366" }}
              >
                <Send size={15} /> {waSending ? "Sending…" : "Simulate Send"}
              </button>

              {waResult && (
                <div
                  className="mt-3 rounded-lg px-3 py-2 text-xs font-medium flex items-center gap-2"
                  style={{ background: "rgba(37,211,102,0.1)", color: "#166534" }}
                >
                  <CheckCircle2 size={14} /> {waResult}
                </div>
              )}
            </div>

            {/* Right panel — chat preview */}
            <div>
              <div
                className="rounded-2xl overflow-hidden shadow-sm"
                style={{ border: "1px solid #D1D5DB", minHeight: 320 }}
              >
                {/* Chat header */}
                <div
                  className="px-4 py-3 flex items-center gap-3"
                  style={{ background: "#075E54" }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: "#128C7E" }}
                  >
                    AC
                  </div>
                  <div>
                    <div className="text-white text-sm font-medium">Aesthetica Clinic</div>
                    <div className="text-green-200 text-xs">Online</div>
                  </div>
                </div>

                {/* Chat body */}
                <div
                  className="px-4 py-5 flex flex-col items-end gap-2"
                  style={{ background: "#ECE5DD", minHeight: 200 }}
                >
                  {msgText.trim() ? (
                    <div style={{ maxWidth: "80%" }}>
                      <div
                        className="rounded-lg rounded-tr-none px-3 py-2 text-sm shadow-sm"
                        style={{ background: "#DCF8C6", color: "#111" }}
                      >
                        {msgText}
                      </div>
                      <div className="text-right text-xs text-gray-500 mt-0.5 pr-1">
                        {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} ✓✓
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 self-center">No message yet</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">
                Preview only — click &ldquo;Simulate Send&rdquo; to log to notification bell
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Razorpay Modal ────────────────────────────────────────────────────── */}
      {showModal && selectedInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget && !paying) setShowModal(false); }}
        >
          <div className="w-96 rounded-2xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="px-6 py-4 flex items-center gap-3" style={{ background: "#072654" }}>
              <div
                className="px-2 py-1 rounded text-xs font-bold text-white"
                style={{ background: "#3395FF" }}
              >
                rzp
              </div>
              <div className="text-white font-semibold">Razorpay</div>
              <div className="ml-auto text-white text-sm">Pay ₹{Number(payAmount).toLocaleString("en-IN")}</div>
            </div>

            <div className="bg-white p-6">
              {/* Card/UPI/Netbanking tabs (visual only) */}
              <div className="flex gap-2 mb-5">
                {["Card", "UPI", "Netbanking"].map((m, i) => (
                  <div
                    key={m}
                    className="px-3 py-1.5 rounded-md text-xs font-medium border"
                    style={
                      i === 0
                        ? { background: "#3395FF", color: "#fff", borderColor: "#3395FF" }
                        : { color: "#6B7280", borderColor: "#D1D5DB" }
                    }
                  >
                    {m}
                  </div>
                ))}
              </div>

              {/* Mock card fields */}
              <div className="space-y-3 mb-5">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Card Number</label>
                  <input
                    disabled
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 bg-gray-50"
                    value="4111 1111 1111 1111"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Expiry</label>
                    <input
                      disabled
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 bg-gray-50"
                      value="12/28"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">CVV</label>
                    <input
                      disabled
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 bg-gray-50"
                      value="•••"
                    />
                  </div>
                </div>
              </div>

              {/* Success state inside modal */}
              {payResult?.success ? (
                <div className="text-center py-4">
                  <CheckCircle2 size={48} color="#16a34a" className="mx-auto mb-3" />
                  <div className="font-semibold text-gray-800 mb-1">Payment Successful</div>
                  <div className="text-xs text-gray-500">
                    ID: {payResult.payment_id}
                  </div>
                  <div className="text-xs text-gray-500">
                    Status: <span className="font-medium capitalize">{payResult.new_status}</span>
                  </div>
                  <button
                    onClick={() => { setShowModal(false); setPayResult(null); }}
                    className="mt-4 px-6 py-2 rounded-lg text-white text-sm font-medium"
                    style={{ background: "#3395FF" }}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={handlePay}
                    disabled={paying}
                    className="w-full py-3 rounded-lg text-white text-sm font-semibold disabled:opacity-60 mb-2"
                    style={{ background: "#3395FF" }}
                  >
                    {paying ? "Processing…" : `Pay Now ₹${Number(payAmount).toLocaleString("en-IN")}`}
                  </button>
                  <button
                    onClick={() => { setShowModal(false); setPaying(false); }}
                    disabled={paying}
                    className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Lead Form sub-component ────────────────────────────────────────────────────

function LeadForm({
  form,
  onChange,
  onSubmit,
  loading,
  buttonColor,
  buttonLabel,
  showCampaign,
  showAdGroup,
}: {
  form: { full_name: string; phone: string; email: string; interest: string; campaign: string };
  onChange: (k: string, v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  buttonColor: string;
  buttonLabel: string;
  showCampaign: boolean;
  showAdGroup: boolean;
}) {
  const field = (label: string, key: string, required?: boolean, type = "text") => (
    <div key={key}>
      <label className="text-xs font-medium text-gray-500 mb-1 block">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
        value={form[key as keyof typeof form]}
        onChange={(e) => onChange(key, e.target.value)}
      />
    </div>
  );

  return (
    <div className="space-y-3">
      {field("Full Name", "full_name", true)}
      {field("Phone", "phone", true, "tel")}
      {field("Email", "email", false, "email")}

      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Interest</label>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((i) => (
            <button
              key={i}
              onClick={() => onChange("interest", form.interest === i ? "" : i)}
              className="px-3 py-1 rounded-full text-xs border transition-colors"
              style={
                form.interest === i
                  ? { background: buttonColor, color: "#fff", borderColor: buttonColor }
                  : { color: "#374151", borderColor: "#D1D5DB" }
              }
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      {showCampaign && field("Campaign Name", "campaign")}

      <button
        onClick={onSubmit}
        disabled={loading || !form.full_name.trim() || !form.phone.trim()}
        className="w-full py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-40 mt-2"
        style={{ background: buttonColor }}
      >
        {loading ? "Submitting…" : buttonLabel}
      </button>
    </div>
  );
}
