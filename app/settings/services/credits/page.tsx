"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowUpCircle, GitBranch, RefreshCw, Users, TrendingUp,
  Clock, MapPin, CheckCircle2, XCircle, AlertCircle,
  Loader2, Search, X, ChevronDown, DollarSign,
  Crown, Star, Package, Percent, Send, Plus,
  ArrowRight, Building2, ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import { logAction } from "@/lib/audit";
import { toast } from "sonner";
import TopBar from "@/components/TopBar";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ServiceCredit {
  id: string;
  patient_id: string;
  patient_name: string;
  purchase_clinic_id: string;
  purchase_clinic_name: string;
  current_clinic_id: string;
  current_clinic_name: string;
  service_name: string;
  total_sessions: number;
  used_sessions: number;
  purchase_price: number;
  per_session_value: number;
  status: "active" | "upgraded" | "transferred" | "refunded" | "completed";
  commission_pct: number;
  family_shared: boolean;
  created_at: string;
  expires_at: string | null;
}

interface PendingRefund {
  id: string;
  credit_id: string;
  clinic_id: string;
  patient_name: string;
  service_name: string;
  clinic_name: string;
  total_sessions: number;
  used_sessions: number;
  original_price: number;
  per_session_value: number;
  cancellation_fee: number;
  refund_amount: number;
  refund_reason: string;
  requested_at: string;
  status: "pending" | "approved" | "rejected";
}

interface PendingTransfer {
  id: string;
  credit_id: string;
  patient_name: string;
  service_name: string;
  from_clinic_id: string;
  from_clinic_name: string;
  to_clinic_name: string;
  sessions_transferred: number;
  revenue_split_pct: number;
  transfer_reason: string | null;
  created_at: string;
  status: "pending" | "approved" | "completed" | "rejected";
}

interface Commission {
  id: string;
  provider_name: string;
  service_name: string;
  patient_name: string | null;
  sale_amount: number;
  commission_pct: number;
  commission_amount: number;
  status: "pending" | "paid";
  created_at: string;
  paid_at: string | null;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string; label: string }> = {
  active:      { bg: "rgba(74,138,74,0.1)",    color: "#2D7A2D", border: "rgba(74,138,74,0.3)",  label: "Active" },
  upgraded:    { bg: "rgba(197,160,89,0.12)",  color: "#A8853A", border: "rgba(197,160,89,0.35)", label: "Upgraded" },
  transferred: { bg: "rgba(197,160,89,0.18)",  color: "#C5A059", border: "rgba(197,160,89,0.5)",  label: "Transferred" },
  refunded:    { bg: "rgba(150,150,150,0.1)",  color: "#666",    border: "rgba(150,150,150,0.3)", label: "Refunded" },
  completed:   { bg: "rgba(107,99,133,0.1)",   color: "#6B6385", border: "rgba(107,99,133,0.3)",  label: "Completed" },
  pending:     { bg: "rgba(234,179,8,0.1)",    color: "#B45309", border: "rgba(234,179,8,0.3)",   label: "Pending" },
  approved:    { bg: "rgba(74,138,74,0.1)",    color: "#2D7A2D", border: "rgba(74,138,74,0.3)",   label: "Approved" },
  rejected:    { bg: "rgba(180,60,60,0.08)",   color: "#B43C3C", border: "rgba(180,60,60,0.25)",  label: "Rejected" },
  paid:        { bg: "rgba(74,138,74,0.1)",    color: "#2D7A2D", border: "rgba(74,138,74,0.3)",   label: "Paid" },
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CreditsPage() {
  const { profile, activeClinicId, clinics, loading: profileLoading } = useClinic();
  const isAdmin = profile?.role === "superadmin" || profile?.role === "clinic_admin" || profile?.role === "chain_admin";
  const isSuperAdmin = profile?.role === "superadmin";

  const [tab, setTab] = useState<"credits" | "approvals" | "transfers" | "commissions">("credits");
  const [credits,    setCredits]    = useState<ServiceCredit[]>([]);
  const [refunds,    setRefunds]    = useState<PendingRefund[]>([]);
  const [transfers,  setTransfers]  = useState<PendingTransfer[]>([]);
  const [commissions,setCommissions]= useState<Commission[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");

  // Active modals
  const [upgradeModal,  setUpgradeModal]  = useState<ServiceCredit | null>(null);
  const [transferModal, setTransferModal] = useState<ServiceCredit | null>(null);
  const [refundModal,   setRefundModal]   = useState<ServiceCredit | null>(null);
  const [membersModal,  setMembersModal]  = useState<ServiceCredit | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Credits with patient + clinic names
      const { data: creds } = await supabase
        .from("patient_service_credits")
        .select(`
          *,
          patients!patient_id(full_name),
          purchase_clinic:clinics!purchase_clinic_id(name),
          current_clinic:clinics!current_clinic_id(name)
        `)
        .order("created_at", { ascending: false });

      setCredits((creds ?? []).map((c: Record<string, unknown>) => ({
        ...c,
        patient_name: (c.patients as { full_name: string } | null)?.full_name ?? "—",
        purchase_clinic_name: (c.purchase_clinic as { name: string } | null)?.name ?? "—",
        current_clinic_name: (c.current_clinic as { name: string } | null)?.name ?? "—",
      })) as ServiceCredit[]);

      // Refund requests — join credit to get service_name
      const { data: refs } = await supabase
        .from("service_refunds")
        .select(`*, patients!patient_id(full_name), clinics!clinic_id(name), patient_service_credits!credit_id(service_name)`)
        .order("requested_at", { ascending: false });

      setRefunds((refs ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        patient_name: (r.patients as { full_name: string } | null)?.full_name ?? "—",
        clinic_name: (r.clinics as { name: string } | null)?.name ?? "—",
        service_name: (r.patient_service_credits as { service_name: string } | null)?.service_name ?? "—",
      })) as PendingRefund[]);

      // Transfer requests
      const { data: trans } = await supabase
        .from("service_transfers")
        .select(`
          *,
          from_clinic:clinics!from_clinic_id(name),
          to_clinic:clinics!to_clinic_id(name),
          patient_service_credits!credit_id(service_name, patient_id, patients!patient_id(full_name))
        `)
        .order("created_at", { ascending: false });

      setTransfers((trans ?? []).map((t: Record<string, unknown>) => {
        const credit = t.patient_service_credits as Record<string, unknown> | null;
        return {
          ...t,
          from_clinic_name: (t.from_clinic as { name: string } | null)?.name ?? "—",
          to_clinic_name:   (t.to_clinic   as { name: string } | null)?.name ?? "—",
          service_name:     credit?.service_name ?? "—",
          patient_name:     (credit?.patients as { full_name: string } | null)?.full_name ?? "—",
        };
      }) as PendingTransfer[]);

      // Commissions
      const { data: comms } = await supabase
        .from("staff_commissions")
        .select(`*, profiles!provider_id(full_name), patients!patient_id(full_name)`)
        .order("created_at", { ascending: false })
        .limit(100);

      setCommissions((comms ?? []).map((c: Record<string, unknown>) => ({
        ...c,
        provider_name: (c.profiles as { full_name: string } | null)?.full_name ?? "—",
        patient_name:  (c.patients as { full_name: string } | null)?.full_name ?? null,
      })) as Commission[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!profileLoading) fetchAll();
  }, [profileLoading, fetchAll]);

  const filteredCredits = credits.filter(c =>
    c.patient_name.toLowerCase().includes(search.toLowerCase()) ||
    c.service_name.toLowerCase().includes(search.toLowerCase())
  );

  const pendingRefunds    = refunds.filter(r => r.status === "pending");
  const pendingTransfers  = transfers.filter(t => t.status === "pending");
  const pendingCount      = pendingRefunds.length + pendingTransfers.length;

  // Stats
  const activeCredits     = credits.filter(c => c.status === "active");
  const totalValue        = activeCredits.reduce((s, c) => s + c.purchase_price, 0);
  const pendingCommissions = commissions.filter(c => c.status === "pending").reduce((s, c) => s + c.commission_amount, 0);

  return (
    <div className="min-h-full" style={{ background: "var(--background)" }}>
      <TopBar />

      <div className="px-8 py-8 max-w-screen-xl mx-auto">

        {/* Breadcrumb */}
        <Link
          href="/settings/services"
          style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 20 }}
        >
          <ChevronLeft size={13} /> Back to Services & Packages
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
              Service Credits
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              Track sessions, transfers, refunds, and staff commissions
            </p>
          </div>
          <button onClick={fetchAll} style={{ color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer" }}>
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-4 mb-7">
          {[
            { label: "Active Credits",      value: activeCredits.length,        icon: <Package size={16} />, gold: true  },
            { label: "Total Value on File",  value: fmt(totalValue),             icon: <DollarSign size={16} />, gold: false },
            { label: "Pending Approvals",    value: pendingCount,                icon: <AlertCircle size={16} />, gold: pendingCount > 0 },
            { label: "Commissions Due",      value: fmt(pendingCommissions),      icon: <TrendingUp size={16} />, gold: false },
          ].map(s => (
            <div key={s.label} style={{
              padding: "16px 18px", borderRadius: 14,
              background: "white",
              border: s.gold ? "1px solid rgba(197,160,89,0.35)" : "1px solid var(--border)",
              boxShadow: s.gold ? "0 2px 12px rgba(197,160,89,0.1)" : "0 1px 4px rgba(0,0,0,0.04)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ color: s.gold ? "#C5A059" : "var(--text-muted)" }}>{s.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
                  {s.label}
                </span>
              </div>
              <p style={{ fontSize: 22, fontWeight: 700, fontFamily: "Georgia, serif", color: s.gold ? "#C5A059" : "var(--foreground)", margin: 0 }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6" style={{ borderBottom: "1px solid var(--border)" }}>
          {([
            { key: "credits",     label: "All Credits",    icon: <Package size={13} />, count: credits.length,       urgent: false },
            { key: "approvals",   label: "Approvals",      icon: <CheckCircle2 size={13} />, count: pendingCount,   urgent: pendingCount > 0 },
            { key: "transfers",   label: "Transfers",      icon: <GitBranch size={13} />, count: transfers.length,  urgent: false },
            { key: "commissions", label: "Commissions",    icon: <TrendingUp size={13} />, count: commissions.length, urgent: false },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "10px 20px", border: "none", background: "transparent",
                fontSize: 14, fontFamily: "Georgia, serif", cursor: "pointer",
                fontWeight: tab === t.key ? 600 : 400,
                color: tab === t.key ? "#C5A059" : "var(--text-muted)",
                borderBottom: tab === t.key ? "2px solid #C5A059" : "2px solid transparent",
                marginBottom: -1, transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {t.icon} {t.label}
              <span style={{
                fontSize: 11, borderRadius: 999, padding: "1px 7px", fontWeight: 600,
                background: t.urgent ? "rgba(234,88,12,0.12)" : (tab === t.key ? "rgba(197,160,89,0.15)" : "rgba(0,0,0,0.06)"),
                color: t.urgent ? "#C2410C" : (tab === t.key ? "#C5A059" : "var(--text-muted)"),
              }}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Credits Tab ── */}
        {tab === "credits" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, padding: "9px 14px",
                borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)",
                flex: 1, maxWidth: 360,
              }}>
                <Search size={14} style={{ color: "var(--text-muted)" }} />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search patient or service…"
                  style={{ background: "transparent", border: "none", outline: "none", fontSize: 13, flex: 1, fontFamily: "Georgia, serif", color: "var(--foreground)" }}
                />
                {search && <button onClick={() => setSearch("")}><X size={13} style={{ color: "var(--text-muted)" }} /></button>}
              </div>
            </div>

            {loading ? (
              <CenteredLoader />
            ) : filteredCredits.length === 0 ? (
              <EmptyState icon={<Package size={32} />} text="No credits found" sub="Credits are created when a patient purchases a service or package" />
            ) : (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {filteredCredits.map(c => (
                  <CreditCard
                    key={c.id}
                    credit={c}
                    isAdmin={isAdmin}
                    isSuperAdmin={isSuperAdmin || profile?.role === "chain_admin"}
                    onUpgrade={() => setUpgradeModal(c)}
                    onTransfer={() => setTransferModal(c)}
                    onRefund={() => setRefundModal(c)}
                    onMembers={() => setMembersModal(c)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Approvals Tab ── */}
        {tab === "approvals" && isAdmin && (
          <ApprovalsTab
            refunds={refunds}
            transfers={transfers}
            onRefresh={fetchAll}
            profile={profile}
          />
        )}
        {tab === "approvals" && !isAdmin && (
          <EmptyState icon={<Crown size={32} />} text="Admin access required" sub="Only clinic admins can approve refunds and transfers" />
        )}

        {/* ── Transfers Tab ── */}
        {tab === "transfers" && (
          <TransfersTab transfers={transfers} loading={loading} />
        )}

        {/* ── Commissions Tab ── */}
        {tab === "commissions" && (
          <CommissionsTab commissions={commissions} loading={loading} onRefresh={fetchAll} isAdmin={isAdmin} />
        )}
      </div>

      {/* ── Modals ── */}
      {upgradeModal  && <UpgradeModal  credit={upgradeModal}  clinicId={activeClinicId} onClose={() => setUpgradeModal(null)}  onDone={() => { setUpgradeModal(null);  fetchAll(); }} />}
      {transferModal && <TransferModal credit={transferModal} clinics={clinics} profile={profile} onClose={() => setTransferModal(null)} onDone={() => { setTransferModal(null); fetchAll(); }} />}
      {refundModal   && <RefundModal   credit={refundModal}   clinicId={activeClinicId} profile={profile} isAdmin={isAdmin} onClose={() => setRefundModal(null)}   onDone={() => { setRefundModal(null);   fetchAll(); }} />}
      {membersModal  && <MembersDrawer credit={membersModal}  clinicId={activeClinicId} onClose={() => setMembersModal(null)}  onDone={() => { setMembersModal(null);  fetchAll(); }} />}
    </div>
  );
}

// ── Credit Card ───────────────────────────────────────────────────────────────

function CreditCard({ credit: c, isAdmin, isSuperAdmin, onUpgrade, onTransfer, onRefund, onMembers }: {
  credit: ServiceCredit;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  onUpgrade: () => void;
  onTransfer: () => void;
  onRefund: () => void;
  onMembers: () => void;
}) {
  const remaining = c.total_sessions - c.used_sessions;
  const pct       = (c.used_sessions / c.total_sessions) * 100;
  const st        = STATUS_COLORS[c.status];
  const isCrossBranch = c.purchase_clinic_id !== c.current_clinic_id;

  return (
    <div style={{
      background: "white", borderRadius: 16, overflow: "hidden",
      border: c.status === "transferred"
        ? "1px solid rgba(197,160,89,0.5)"
        : c.status === "refunded"
        ? "1px solid rgba(150,150,150,0.25)"
        : "1px solid var(--border)",
      boxShadow: c.status === "transferred"
        ? "0 2px 16px rgba(197,160,89,0.15)"
        : "0 1px 4px rgba(0,0,0,0.04)",
    }}>
      {/* Gold top strip for transferred */}
      {c.status === "transferred" && (
        <div style={{ height: 2, background: "linear-gradient(90deg, #A8853A, #C5A059, #E8CC8A, #C5A059, #A8853A)" }} />
      )}

      <div style={{ padding: "16px 18px" }}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <StatusBadge status={c.status} />
              {c.family_shared && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: "rgba(107,99,133,0.1)", color: "#6B6385", border: "1px solid rgba(107,99,133,0.2)" }}>
                  Family Shared
                </span>
              )}
              {isCrossBranch && (
                <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: "rgba(197,160,89,0.1)", color: "#A8853A", border: "1px solid rgba(197,160,89,0.25)" }}>
                  <MapPin size={9} /> Cross-Branch
                </span>
              )}
            </div>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
              {c.service_name}
            </h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
              {c.patient_name}
            </p>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <p style={{ fontSize: 16, fontWeight: 700, fontFamily: "Georgia, serif", color: "#C5A059", margin: 0 }}>
              {fmt(c.purchase_price)}
            </p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
              {fmt(c.per_session_value)}/session
            </p>
          </div>
        </div>

        {/* Branch info */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: 11, color: "var(--text-muted)" }}>
          <Building2 size={11} />
          <span>Purchased: <strong>{c.purchase_clinic_name}</strong></span>
          {isCrossBranch && (
            <>
              <ArrowRight size={10} />
              <span style={{ color: "#C5A059", fontWeight: 600 }}>Active: {c.current_clinic_name}</span>
            </>
          )}
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.used_sessions} used · {remaining} remaining</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: remaining > 0 ? "#C5A059" : "#6B7280" }}>
              {c.total_sessions} total sessions
            </span>
          </div>
          <div style={{ height: 7, borderRadius: 999, background: "rgba(197,160,89,0.1)", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 999,
              background: c.status === "refunded"
                ? "linear-gradient(90deg, #9CA3AF, #6B7280)"
                : "linear-gradient(90deg, #C5A059, #A8853A)",
              width: `${Math.min(pct, 100)}%`, transition: "width 0.6s ease",
            }} />
          </div>
        </div>

        {/* Actions */}
        {c.status === "active" && (
          <div className="flex flex-wrap gap-2">
            {c.used_sessions > 0 && (
              <ActionBtn icon={<ArrowUpCircle size={12} />} label="Upgrade" gold onClick={onUpgrade} />
            )}
            {isSuperAdmin && (
              <ActionBtn icon={<GitBranch size={12} />} label="Transfer Branch" onClick={onTransfer} />
            )}
            {isAdmin && (
              <ActionBtn icon={<RefreshCw size={12} />} label="Refund" red onClick={onRefund} />
            )}
            <ActionBtn icon={<Users size={12} />} label="Share Members" onClick={onMembers} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Approvals Tab ─────────────────────────────────────────────────────────────

function ApprovalsTab({ refunds, transfers, onRefresh, profile }: {
  refunds: PendingRefund[];
  transfers: PendingTransfer[];
  onRefresh: () => void;
  profile: { id: string; role: string | null } | null;
}) {
  const [processing, setProcessing] = useState<string | null>(null);
  const pending = [...refunds.filter(r => r.status === "pending"), ...transfers.filter(t => t.status === "pending")];

  async function approveRefund(refund: PendingRefund) {
    setProcessing(refund.id);
    try {
      const { data: user } = await supabase.auth.getUser();
      // Atomic: approves refund + marks credit refunded + reverses commissions + credits wallet (GAP-8)
      const { error } = await supabase.rpc("approve_refund", {
        p_refund_id:     refund.id,
        p_clinic_id:     refund.clinic_id,
        p_approved_by:   user.user?.id ?? null,
        p_credit_amount: refund.refund_amount ?? 0,
      });
      if (error) throw error;
      logAction({ action: "refund_approved", targetId: refund.credit_id, targetName: `${refund.patient_name} — ${refund.service_name}`, metadata: { refund_amount: refund.refund_amount } });
      toast.success(`Refund of ${fmt(refund.refund_amount)} approved — commissions reversed, wallet credited`);
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Refund approval failed");
    } finally {
      setProcessing(null);
    }
  }

  async function rejectRefund(refund: PendingRefund, note: string) {
    setProcessing(refund.id);
    const { data: user } = await supabase.auth.getUser();
    await supabase.from("service_refunds").update({
      status: "rejected", approved_by: user.user?.id, resolved_at: new Date().toISOString(), rejection_note: note,
    }).eq("id", refund.id);
    toast.success("Refund request rejected");
    setProcessing(null);
    onRefresh();
  }

  async function approveTransfer(t: PendingTransfer) {
    setProcessing(t.id);
    try {
      const { data: user } = await supabase.auth.getUser();
      // Atomic: approves transfer + moves credit to destination clinic in one transaction (GAP-12)
      const { error } = await supabase.rpc("approve_transfer", {
        p_transfer_id: t.id,
        p_clinic_id:   t.from_clinic_id,
        p_approved_by: user.user?.id ?? null,
      });
      if (error) throw error;
      logAction({ action: "transfer_approved", targetId: t.credit_id, targetName: `${t.patient_name} — ${t.service_name}`, metadata: { from: t.from_clinic_name, to: t.to_clinic_name } });
      toast.success(`Transfer approved: ${t.from_clinic_name} → ${t.to_clinic_name}`);
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Transfer approval failed");
    } finally {
      setProcessing(null);
    }
  }

  if (pending.length === 0) {
    return <EmptyState icon={<CheckCircle2 size={32} />} text="All caught up!" sub="No pending approvals" />;
  }

  return (
    <div className="space-y-4">
      {refunds.filter(r => r.status === "pending").map(r => (
        <ApprovalCard key={r.id} type="refund" title={`Refund — ${r.patient_name}`} subtitle={r.service_name}
          amount={r.refund_amount} details={[
            { label: "Used sessions", value: `${r.used_sessions} of ${r.total_sessions}` },
            { label: "Original price", value: fmt(r.original_price) },
            { label: "Cancellation fee", value: fmt(r.cancellation_fee) },
            { label: "Refund amount", value: fmt(r.refund_amount), highlight: true },
          ]}
          reason={r.refund_reason}
          processing={processing === r.id}
          onApprove={() => approveRefund(r)}
          onReject={(note) => rejectRefund(r, note)}
        />
      ))}

      {transfers.filter(t => t.status === "pending").map(t => (
        <ApprovalCard key={t.id} type="transfer" title={`Transfer — ${t.patient_name}`} subtitle={t.service_name}
          amount={0} details={[
            { label: "From", value: t.from_clinic_name },
            { label: "To",   value: t.to_clinic_name },
            { label: "Sessions", value: String(t.sessions_transferred) },
            { label: "Revenue retained by origin", value: `${t.revenue_split_pct}%`, highlight: true },
          ]}
          reason={t.transfer_reason ?? ""}
          processing={processing === t.id}
          onApprove={() => approveTransfer(t)}
          onReject={async () => {
            await supabase.from("service_transfers").update({ status: "rejected" }).eq("id", t.id);
            toast.success("Transfer rejected");
            onRefresh();
          }}
        />
      ))}
    </div>
  );
}

function ApprovalCard({ type, title, subtitle, amount, details, reason, processing, onApprove, onReject }: {
  type: "refund" | "transfer";
  title: string;
  subtitle: string;
  amount: number;
  details: { label: string; value: string; highlight?: boolean }[];
  reason: string;
  processing: boolean;
  onApprove: () => void;
  onReject: (note: string) => void;
}) {
  const [rejectNote, setRejectNote] = useState("");
  const [showReject, setShowReject] = useState(false);

  return (
    <div style={{
      background: "white", borderRadius: 16, overflow: "hidden",
      border: type === "refund" ? "1px solid rgba(234,179,8,0.3)" : "1px solid rgba(197,160,89,0.3)",
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    }}>
      <div style={{
        padding: "14px 20px",
        background: type === "refund" ? "rgba(234,179,8,0.06)" : "rgba(197,160,89,0.06)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div className="flex items-center gap-2">
            {type === "refund" ? <RefreshCw size={13} style={{ color: "#B45309" }} /> : <GitBranch size={13} style={{ color: "#C5A059" }} />}
            <p style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>{title}</p>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>{subtitle}</p>
        </div>
        <StatusBadge status="pending" />
      </div>

      <div style={{ padding: "16px 20px" }}>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {details.map(d => (
            <div key={d.label}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9C9584", margin: 0 }}>{d.label}</p>
              <p style={{ fontSize: 14, fontWeight: d.highlight ? 700 : 500, fontFamily: "Georgia, serif", color: d.highlight ? "#C5A059" : "var(--foreground)", margin: "2px 0 0" }}>{d.value}</p>
            </div>
          ))}
        </div>

        {reason && (
          <div style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(249,247,242,0.8)", border: "1px solid var(--border)", marginBottom: 14 }}>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, fontStyle: "italic" }}>"{reason}"</p>
          </div>
        )}

        {showReject && (
          <div style={{ marginBottom: 12 }}>
            <textarea
              value={rejectNote} onChange={e => setRejectNote(e.target.value)}
              placeholder="Reason for rejection (optional)"
              rows={2}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid #E8E2D4", background: "#FDFCF9", fontSize: 13, fontFamily: "Georgia, serif", color: "var(--foreground)", outline: "none", boxSizing: "border-box", resize: "none" }}
            />
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => { setShowReject(false); onApprove(); }}
            disabled={processing}
            style={{
              flex: 1, padding: "9px 0", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg, #C5A059, #A8853A)",
              color: "white", fontSize: 13, fontWeight: 600,
              fontFamily: "Georgia, serif", cursor: processing ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            {processing ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle2 size={13} />}
            Approve
          </button>
          {!showReject ? (
            <button
              onClick={() => setShowReject(true)}
              style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "1px solid rgba(180,60,60,0.3)", background: "rgba(180,60,60,0.06)", color: "#B43C3C", fontSize: 13, fontFamily: "Georgia, serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              <XCircle size={13} /> Reject
            </button>
          ) : (
            <button
              onClick={() => onReject(rejectNote)}
              style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", background: "#B43C3C", color: "white", fontSize: 13, fontFamily: "Georgia, serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              <XCircle size={13} /> Confirm Reject
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Transfers Tab ─────────────────────────────────────────────────────────────

function TransfersTab({ transfers, loading }: { transfers: PendingTransfer[]; loading: boolean }) {
  if (loading) return <CenteredLoader />;
  if (transfers.length === 0) return <EmptyState icon={<GitBranch size={32} />} text="No transfers yet" sub="Use 'Transfer Branch' on any active credit to start" />;

  return (
    <div className="space-y-3">
      {transfers.map(t => (
        <div key={t.id} style={{ padding: "16px 20px", borderRadius: 14, background: "white", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(197,160,89,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <GitBranch size={16} style={{ color: "#C5A059" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="flex items-center gap-2 mb-1">
              <p style={{ fontFamily: "Georgia, serif", fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
                {t.patient_name} — {t.service_name}
              </p>
              <StatusBadge status={t.status} />
            </div>
            <div className="flex items-center gap-2" style={{ fontSize: 12, color: "var(--text-muted)" }}>
              <Building2 size={11} /><span>{t.from_clinic_name}</span>
              <ArrowRight size={10} />
              <span style={{ color: "#C5A059", fontWeight: 600 }}>{t.to_clinic_name}</span>
              <span>·</span>
              <span>{t.sessions_transferred} sessions · {t.revenue_split_pct}% revenue retained</span>
            </div>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
            {new Date(t.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Commissions Tab ───────────────────────────────────────────────────────────

function CommissionsTab({ commissions, loading, onRefresh, isAdmin }: {
  commissions: Commission[];
  loading: boolean;
  onRefresh: () => void;
  isAdmin: boolean;
}) {
  const [markingPaid,  setMarkingPaid]  = useState<string | null>(null);
  const [staffFilter,  setStaffFilter]  = useState("");
  const [dateFrom,     setDateFrom]     = useState("");
  const [dateTo,       setDateTo]       = useState("");

  const filtered = commissions.filter(c => {
    if (staffFilter && c.provider_name !== staffFilter) return false;
    if (dateFrom && c.created_at < dateFrom) return false;
    if (dateTo && c.created_at > dateTo + "T23:59:59") return false;
    return true;
  });

  const pending = filtered.filter(c => c.status === "pending");
  const paid    = filtered.filter(c => c.status === "paid");
  const totalPending = pending.reduce((s, c) => s + c.commission_amount, 0);
  const uniqueStaff = Array.from(new Set(commissions.map(c => c.provider_name))).sort();

  async function markPaid(id: string) {
    setMarkingPaid(id);
    await supabase.from("staff_commissions").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
    toast.success("Commission marked as paid");
    setMarkingPaid(null);
    onRefresh();
  }

  function exportCsv() {
    const rows = [
      ["Provider", "Patient", "Service", "Sale Amount", "Commission %", "Commission Amount", "Status", "Date", "Paid At"],
      ...filtered.map(c => [
        c.provider_name, c.patient_name ?? "", c.service_name,
        c.sale_amount, c.commission_pct, c.commission_amount,
        c.status, new Date(c.created_at).toLocaleDateString("en-IN"),
        c.paid_at ? new Date(c.paid_at).toLocaleDateString("en-IN") : "",
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `commissions_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }

  if (loading) return <CenteredLoader />;
  if (commissions.length === 0) return <EmptyState icon={<TrendingUp size={32} />} text="No commissions yet" sub="Commissions are auto-calculated when a session is consumed" />;

  return (
    <div>
      {/* GAP-40: Date range + staff filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.25)", fontSize: 12, background: "white" }}>
          <option value="">All staff</option>
          {uniqueStaff.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.25)", fontSize: 12 }} />
        <span style={{ fontSize: 12, color: "#9C9584" }}>to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.25)", fontSize: 12 }} />
        {(staffFilter || dateFrom || dateTo) && (
          <button onClick={() => { setStaffFilter(""); setDateFrom(""); setDateTo(""); }}
            style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid rgba(107,114,128,0.2)", background: "white", cursor: "pointer", fontSize: 11, color: "#6B7280" }}>
            Clear filters
          </button>
        )}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#9C9584" }}>{filtered.length} of {commissions.length} records</span>
      </div>

      {/* Summary banner */}
      {pending.length > 0 && (
        <div style={{ padding: "14px 20px", borderRadius: 14, marginBottom: 20, background: "rgba(197,160,89,0.08)", border: "1px solid rgba(197,160,89,0.3)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="flex items-center gap-3">
            <Star size={16} style={{ color: "#C5A059" }} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, fontFamily: "Georgia, serif", color: "#1C1917", margin: 0 }}>
                {fmt(totalPending)} pending payout
              </p>
              <p style={{ fontSize: 12, color: "#9C9584", margin: 0 }}>{pending.length} commission(s) due across {[...new Set(pending.map(c => c.provider_name))].length} staff member(s)</p>
            </div>
          </div>
          <button onClick={exportCsv}
            style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.35)", background: "rgba(197,160,89,0.08)", color: "#C5A059", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Export CSV
          </button>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(c => (
          <div key={c.id} style={{ padding: "14px 18px", borderRadius: 12, background: "white", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(197,160,89,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "Georgia, serif", fontWeight: 700, color: "#C5A059", fontSize: 14 }}>
              {c.provider_name.split(" ").map(n => n[0]).slice(0, 2).join("")}
            </div>
            <div style={{ flex: 1 }}>
              <div className="flex items-center gap-2 mb-0.5">
                <p style={{ fontFamily: "Georgia, serif", fontSize: 13, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
                  {c.provider_name}
                </p>
                <StatusBadge status={c.status} />
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
                {c.service_name}{c.patient_name ? ` · ${c.patient_name}` : ""}
              </p>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <p style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 700, color: "#C5A059", margin: 0 }}>
                {fmt(c.commission_amount)}
              </p>
              <p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0 }}>{c.commission_pct}% of {fmt(c.sale_amount)}</p>
            </div>
            {isAdmin && c.status === "pending" && (
              <button
                onClick={() => markPaid(c.id)}
                disabled={markingPaid === c.id}
                style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #C5A059, #A8853A)", color: "white", fontSize: 12, fontFamily: "Georgia, serif", cursor: "pointer", flexShrink: 0 }}
              >
                {markingPaid === c.id ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : "Mark Paid"}
              </button>
            )}
          </div>
        ))}
      </div>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}

// ── Upgrade Modal ─────────────────────────────────────────────────────────────

function UpgradeModal({ credit, clinicId, onClose, onDone }: {
  credit: ServiceCredit;
  clinicId: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [packages, setPackages] = useState<{ id: string; name: string; total_price: number; total_sessions: number }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("service_packages")
      .select("id, name, total_price")
      .eq("is_active", true)
      .then(({ data }) => {
        // Fetch item counts
        const enriched = (data ?? []).map(p => ({ ...p, total_sessions: 0 }));
        setPackages(enriched);
      });
  }, []);

  const selectedPkg = packages.find(p => p.id === selected);
  const alreadyPaid = credit.purchase_price;
  const upgradeCost = selectedPkg ? Math.max(0, selectedPkg.total_price - alreadyPaid) : 0;

  async function handleUpgrade() {
    if (!selected || !selectedPkg) return;
    setSaving(true);
    const { data: user } = await supabase.auth.getUser();

    // Mark old credit as upgraded
    await supabase.from("patient_service_credits")
      .update({ status: "upgraded", updated_at: new Date().toISOString() })
      .eq("id", credit.id);

    // Create new credit for the package
    const { data: pkgItems } = await supabase.from("package_items")
      .select("sessions")
      .eq("package_id", selected);
    const totalSessions = (pkgItems ?? []).reduce((s: number, i: { sessions: number }) => s + i.sessions, 0);

    await supabase.from("patient_service_credits").insert({
      patient_id:          credit.patient_id,
      purchase_clinic_id:  clinicId ?? credit.purchase_clinic_id,
      current_clinic_id:   clinicId ?? credit.current_clinic_id,
      package_id:          selected,
      service_name:        selectedPkg.name,
      total_sessions:      totalSessions || 6,
      used_sessions:       credit.used_sessions,
      purchase_price:      selectedPkg.total_price,
      per_session_value:   Math.round(selectedPkg.total_price / (totalSessions || 6)),
      commission_pct:      credit.commission_pct,
      purchased_by:        user.user?.id,
      notes:               `Upgraded from: ${credit.service_name} (Credit: ${credit.id}). Patient pays difference: ${fmt(upgradeCost)}`,
    });

    logAction({ action: "credit_upgraded", targetId: credit.patient_id, targetName: credit.patient_name, metadata: { from: credit.service_name, to: selectedPkg.name, upgrade_cost: upgradeCost } });
    toast.success(`Upgraded to "${selectedPkg.name}". Charge patient ${fmt(upgradeCost)}`);
    onDone();
  }

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon={<ArrowUpCircle size={18} style={{ color: "#C5A059" }} />} title="Upgrade to Package" subtitle={`${credit.patient_name} · ${credit.service_name}`} onClose={onClose} />
      <div style={{ padding: "20px 24px" }}>
        <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(197,160,89,0.06)", border: "1px solid rgba(197,160,89,0.2)", marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9C9584", margin: "0 0 10px" }}>Current Credit</p>
          <div className="flex justify-between">
            <span style={{ fontSize: 13, color: "var(--foreground)" }}>{credit.service_name}</span>
            <span style={{ fontWeight: 700, fontFamily: "Georgia, serif", color: "#C5A059", fontSize: 15 }}>{fmt(credit.purchase_price)} paid</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
            {credit.used_sessions} session(s) used — these will carry over to the new package
          </p>
        </div>

        <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9C9584", marginBottom: 12 }}>Select Upgrade Package</p>

        {packages.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>No packages available</p>
        ) : (
          <div className="space-y-2">
            {packages.map(p => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                style={{
                  width: "100%", padding: "12px 16px", borderRadius: 12, cursor: "pointer",
                  border: selected === p.id ? "1.5px solid #C5A059" : "1px solid var(--border)",
                  background: selected === p.id ? "rgba(197,160,89,0.08)" : "white",
                  display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.15s",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <p style={{ fontFamily: "Georgia, serif", fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>{p.name}</p>
                  {selected === p.id && (
                    <p style={{ fontSize: 12, color: "#4A8A4A", margin: "3px 0 0", fontWeight: 600 }}>
                      Patient pays difference: {fmt(Math.max(0, p.total_price - alreadyPaid))}
                    </p>
                  )}
                </div>
                <p style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 700, color: "#C5A059", margin: 0 }}>{fmt(p.total_price)}</p>
              </button>
            ))}
          </div>
        )}

        {selectedPkg && (
          <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 12, background: "rgba(74,138,74,0.08)", border: "1px solid rgba(74,138,74,0.25)" }}>
            <div className="flex justify-between items-center">
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#2D7A2D", margin: 0, fontFamily: "Georgia, serif" }}>
                  Patient owes: {fmt(upgradeCost)}
                </p>
                <p style={{ fontSize: 11, color: "#4A8A4A", margin: "3px 0 0" }}>
                  {fmt(selectedPkg.total_price)} − {fmt(alreadyPaid)} already paid
                </p>
              </div>
              {upgradeCost === 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: "#2D7A2D", background: "rgba(74,138,74,0.15)", padding: "3px 10px", borderRadius: 999 }}>Free Upgrade!</span>
              )}
            </div>
          </div>
        )}
      </div>

      <ModalFooter
        onClose={onClose}
        onConfirm={handleUpgrade}
        confirmLabel="Confirm Upgrade"
        saving={saving}
        disabled={!selected}
      />
    </Modal>
  );
}

// ── Transfer Modal ────────────────────────────────────────────────────────────

function TransferModal({ credit, clinics, profile, onClose, onDone }: {
  credit: ServiceCredit;
  clinics: { id: string; name: string; location: string | null }[];
  profile: { id: string; role: string | null; full_name: string | null } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [toClinicId,    setToClinicId]    = useState("");
  const [sessions,      setSessions]      = useState(credit.total_sessions - credit.used_sessions);
  const [revenueSplit,  setRevenueSplit]  = useState(100);
  const [reason,        setReason]        = useState("");
  const [saving,        setSaving]        = useState(false);

  const remainingSessions = credit.total_sessions - credit.used_sessions;
  const availableClinics  = clinics.filter(c => c.id !== credit.current_clinic_id);
  const toClinic          = clinics.find(c => c.id === toClinicId);
  const originShare       = Math.round(credit.purchase_price * (revenueSplit / 100));
  const destShare         = credit.purchase_price - originShare;

  async function handleTransfer() {
    if (!toClinicId) { toast.error("Select destination branch"); return; }
    setSaving(true);
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from("service_transfers").insert({
      credit_id:           credit.id,
      from_clinic_id:      credit.current_clinic_id,
      to_clinic_id:        toClinicId,
      sessions_transferred: sessions,
      revenue_split_pct:   revenueSplit,
      status:              "pending",
      transferred_by:      user.user?.id,
      transfer_reason:     reason || null,
    });
    if (error) { toast.error("Failed to request transfer"); setSaving(false); return; }
    toast.success("Transfer request submitted — awaiting admin approval");
    onDone();
  }

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon={<GitBranch size={18} style={{ color: "#C5A059" }} />} title="Transfer to Branch" subtitle={`${credit.patient_name} · ${credit.service_name}`} onClose={onClose} />
      <div style={{ padding: "20px 24px" }} className="space-y-5">

        {/* From → To */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, padding: "10px 14px", borderRadius: 12, background: "rgba(249,247,242,0.8)", border: "1px solid var(--border)" }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#9C9584", margin: "0 0 3px" }}>From</p>
            <p style={{ fontSize: 13, fontWeight: 600, fontFamily: "Georgia, serif", color: "var(--foreground)", margin: 0 }}>{credit.current_clinic_name}</p>
          </div>
          <ArrowRight size={16} style={{ color: "#C5A059", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <select
              value={toClinicId}
              onChange={e => setToClinicId(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: "1.5px solid rgba(197,160,89,0.4)", background: "white", fontSize: 13, fontFamily: "Georgia, serif", color: "var(--foreground)", outline: "none" }}
            >
              <option value="">Select destination…</option>
              {availableClinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {/* Sessions to transfer */}
        <div>
          <label style={labelSx}>Sessions to Transfer</label>
          <input
            type="number" value={sessions} min={1} max={remainingSessions}
            onChange={e => setSessions(Math.min(remainingSessions, Math.max(1, Number(e.target.value))))}
            style={inputSx}
          />
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>
            Max {remainingSessions} remaining sessions available to transfer
          </p>
        </div>

        {/* Revenue split */}
        <div>
          <label style={labelSx}>Revenue Split — Origin Branch Retains</label>
          <div className="flex items-center gap-3">
            <input
              type="range" min={0} max={100} value={revenueSplit}
              onChange={e => setRevenueSplit(Number(e.target.value))}
              style={{ flex: 1, accentColor: "#C5A059" }}
            />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#C5A059", fontFamily: "Georgia, serif", minWidth: 40, textAlign: "right" }}>{revenueSplit}%</span>
          </div>
          <div className="flex justify-between mt-2">
            <span style={{ fontSize: 12, color: "var(--foreground)" }}>
              <strong>{credit.current_clinic_name}</strong> keeps {fmt(originShare)}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {toClinic?.name ?? "Destination"} gets {fmt(destShare)}
            </span>
          </div>
        </div>

        {/* Reason */}
        <div>
          <label style={labelSx}>Transfer Reason</label>
          <textarea
            value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Patient relocation, branch convenience…"
            rows={2}
            style={{ ...inputSx, resize: "none" }}
          />
        </div>
      </div>

      <ModalFooter onClose={onClose} onConfirm={handleTransfer} confirmLabel="Request Transfer" saving={saving} disabled={!toClinicId} />
    </Modal>
  );
}

// ── Refund Modal ──────────────────────────────────────────────────────────────

function RefundModal({ credit, clinicId, profile, isAdmin, onClose, onDone }: {
  credit: ServiceCredit;
  clinicId: string | null;
  profile: { id: string; role: string | null } | null;
  isAdmin: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const remaining        = credit.total_sessions - credit.used_sessions;
  const perSessionValue  = credit.per_session_value;
  const grossRefund      = remaining * perSessionValue;

  const [cancellationFee, setCancellationFee] = useState(Math.round(grossRefund * 0.1)); // default 10% fee
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const netRefund = Math.max(0, grossRefund - cancellationFee);

  async function handleRefund() {
    if (!reason.trim()) { toast.error("Refund reason is required"); return; }
    setSaving(true);
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from("service_refunds").insert({
      credit_id:         credit.id,
      patient_id:        credit.patient_id,
      clinic_id:         clinicId ?? credit.purchase_clinic_id,
      total_sessions:    credit.total_sessions,
      used_sessions:     credit.used_sessions,
      original_price:    credit.purchase_price,
      per_session_value: perSessionValue,
      cancellation_fee:  cancellationFee,
      refund_amount:     netRefund,
      refund_reason:     reason.trim(),
      status:            isAdmin ? "approved" : "pending",
      requested_by:      user.user?.id,
      approved_by:       isAdmin ? user.user?.id : null,
      resolved_at:       isAdmin ? new Date().toISOString() : null,
    });
    if (error) { toast.error("Failed to submit refund"); setSaving(false); return; }

    if (isAdmin) {
      await supabase.from("patient_service_credits").update({ status: "refunded", updated_at: new Date().toISOString() }).eq("id", credit.id);
      logAction({ action: "refund_processed", targetId: credit.patient_id, targetName: credit.patient_name, metadata: { net_refund: netRefund, used: credit.used_sessions, total: credit.total_sessions } });
      toast.success(`Refund of ${fmt(netRefund)} processed`);
    } else {
      toast.success("Refund request submitted for admin approval");
    }
    onDone();
  }

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon={<RefreshCw size={18} style={{ color: "#B45309" }} />} title="Refund Engine" subtitle={`${credit.patient_name} · ${credit.service_name}`} onClose={onClose} />
      <div style={{ padding: "20px 24px" }} className="space-y-5">

        {/* Session breakdown */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[
            { label: "Total Sessions",  value: credit.total_sessions, color: "var(--foreground)" },
            { label: "Used Sessions",   value: credit.used_sessions,  color: "#B43C3C" },
            { label: "Unused Sessions", value: remaining,             color: "#2D7A2D" },
          ].map(s => (
            <div key={s.label} style={{ padding: "12px", borderRadius: 12, background: "rgba(249,247,242,0.8)", border: "1px solid var(--border)", textAlign: "center" }}>
              <p style={{ fontSize: 22, fontWeight: 700, fontFamily: "Georgia, serif", color: s.color, margin: 0 }}>{s.value}</p>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9C9584", margin: "4px 0 0" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Calculation */}
        <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(197,160,89,0.06)", border: "1px solid rgba(197,160,89,0.2)" }}>
          <div className="space-y-2">
            {[
              { label: "Per-session value",        value: fmt(perSessionValue),                right: false },
              { label: `Unused sessions × ${fmt(perSessionValue)}`, value: fmt(grossRefund), right: false },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{r.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", fontFamily: "Georgia, serif" }}>{r.value}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid rgba(197,160,89,0.2)", paddingTop: 10, marginTop: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#9C9584", display: "block", marginBottom: 6 }}>
                Cancellation Fee (₹)
              </label>
              <input
                type="number" value={cancellationFee} min={0} max={grossRefund}
                onChange={e => setCancellationFee(Math.min(grossRefund, Math.max(0, Number(e.target.value))))}
                style={{ ...inputSx, marginBottom: 10 }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: netRefund > 0 ? "rgba(74,138,74,0.1)" : "rgba(150,150,150,0.1)", border: `1px solid ${netRefund > 0 ? "rgba(74,138,74,0.3)" : "rgba(150,150,150,0.2)"}` }}>
              <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "Georgia, serif", color: "var(--foreground)" }}>Net Refund Amount</span>
              <span style={{ fontSize: 20, fontWeight: 700, fontFamily: "Georgia, serif", color: netRefund > 0 ? "#2D7A2D" : "#666" }}>{fmt(netRefund)}</span>
            </div>
          </div>
        </div>

        <div>
          <label style={labelSx}>Reason for Refund <span style={{ color: "#C5A059" }}>*</span></label>
          <textarea
            value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Patient relocation, dissatisfaction, medical condition…"
            rows={2} style={{ ...inputSx, resize: "none" }}
          />
        </div>

        {!isAdmin && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.3)" }}>
            <AlertCircle size={14} style={{ color: "#B45309" }} />
            <p style={{ fontSize: 12, color: "#B45309", margin: 0 }}>This request will be sent to an admin for approval</p>
          </div>
        )}
      </div>
      <ModalFooter onClose={onClose} onConfirm={handleRefund} confirmLabel={isAdmin ? "Process Refund" : "Submit for Approval"} saving={saving} disabled={!reason.trim()} />
    </Modal>
  );
}

// ── Members Drawer ────────────────────────────────────────────────────────────

function MembersDrawer({ credit, clinicId, onClose, onDone }: {
  credit: ServiceCredit;
  clinicId: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [members, setMembers] = useState<{ id: string; member_patient_id: string; member_name: string; allowed_sessions: number | null; is_active: boolean }[]>([]);
  const [patients, setPatients] = useState<{ id: string; full_name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [allowedSessions, setAllowedSessions] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: mems } = await supabase.from("package_members")
        .select("*, patients!member_patient_id(full_name)")
        .eq("credit_id", credit.id);
      setMembers((mems ?? []).map((m: Record<string, unknown>) => ({
        id: m.id as string,
        member_patient_id: m.member_patient_id as string,
        member_name: (m.patients as { full_name: string } | null)?.full_name ?? "—",
        allowed_sessions: m.allowed_sessions as number | null,
        is_active: m.is_active as boolean,
      })));

      const { data: pts } = await supabase.from("patients")
        .select("id, full_name")
        .neq("id", credit.patient_id)
        .order("full_name").limit(300);
      setPatients(pts ?? []);
    }
    load();
  }, [credit.id, credit.patient_id]);

  const filteredPatients = patients.filter(p =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) &&
    !members.some(m => m.member_patient_id === p.id)
  );

  async function addMember() {
    if (!selected) return;
    setSaving(true);
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from("package_members").insert({
      credit_id: credit.id,
      primary_patient_id: credit.patient_id,
      member_patient_id: selected,
      allowed_sessions: allowedSessions ? Number(allowedSessions) : null,
      added_by: user.user?.id,
    });
    if (error) { toast.error("Failed to add member"); }
    else {
      await supabase.from("patient_service_credits").update({ family_shared: true }).eq("id", credit.id);
      toast.success("Member added to package");
      setSelected(null); setSearch(""); setAllowedSessions("");
      onDone();
    }
    setSaving(false);
  }

  async function removeMember(id: string) {
    await supabase.from("package_members").update({ is_active: false }).eq("id", id);
    toast.success("Member removed");
    setMembers(prev => prev.filter(m => m.id !== id));
  }

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon={<Users size={18} style={{ color: "#C5A059" }} />} title="Family & Friends Sharing" subtitle={`${credit.service_name} · ${credit.total_sessions - credit.used_sessions} sessions remaining`} onClose={onClose} />
      <div style={{ padding: "20px 24px" }}>
        {/* Existing members */}
        {members.filter(m => m.is_active).length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9C9584", marginBottom: 10 }}>Current Members</p>
            <div className="space-y-2">
              {members.filter(m => m.is_active).map(m => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderRadius: 12, background: "rgba(197,160,89,0.06)", border: "1px solid rgba(197,160,89,0.2)" }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "Georgia, serif", fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>{m.member_name}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>
                      {m.allowed_sessions != null ? `${m.allowed_sessions} sessions allowed` : "Unlimited sessions from pool"}
                    </p>
                  </div>
                  <button
                    onClick={() => removeMember(m.id)}
                    style={{ background: "transparent", border: "none", cursor: "pointer", color: "#B43C3C" }}
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add new member */}
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9C9584", marginBottom: 10 }}>Add Member</p>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 13px", borderRadius: 12, background: "#FDFCF9", border: "1px solid #E8E2D4" }}>
            <Search size={13} style={{ color: "var(--text-muted)" }} />
            <input
              value={search} onChange={e => { setSearch(e.target.value); setSelected(null); }}
              placeholder="Search patients to add…"
              style={{ background: "transparent", border: "none", outline: "none", fontSize: 13, flex: 1, fontFamily: "Georgia, serif", color: "var(--foreground)" }}
            />
          </div>
          {search && filteredPatients.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", borderRadius: 12, border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.1)", zIndex: 10, maxHeight: 200, overflowY: "auto" }}>
              {filteredPatients.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setSelected(p.id); setSearch(p.full_name); }}
                  style={{ width: "100%", padding: "10px 14px", textAlign: "left", border: "none", background: "transparent", cursor: "pointer", fontSize: 13, fontFamily: "Georgia, serif", color: "var(--foreground)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(197,160,89,0.06)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  {p.full_name}
                </button>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelSx}>Session Limit (leave blank for unlimited)</label>
            <input
              type="number" value={allowedSessions} min={1}
              onChange={e => setAllowedSessions(e.target.value)}
              placeholder="e.g. 2 (or blank = full pool)"
              style={inputSx}
            />
          </div>
        )}

        <button
          onClick={addMember}
          disabled={!selected || saving}
          style={{
            width: "100%", padding: "10px 0", borderRadius: 12, border: "none",
            background: !selected ? "rgba(197,160,89,0.4)" : "linear-gradient(135deg, #C5A059, #A8853A)",
            color: "white", fontSize: 14, fontWeight: 600, fontFamily: "Georgia, serif",
            cursor: !selected ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          }}
        >
          {saving && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
          <Plus size={14} /> Add Member
        </button>
      </div>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </Modal>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] ?? STATUS_COLORS.pending;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  );
}

function ActionBtn({ icon, label, onClick, gold, red }: {
  icon: React.ReactNode; label: string; onClick: () => void; gold?: boolean; red?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 5, padding: "5px 11px",
        borderRadius: 8, cursor: "pointer", fontSize: 12, fontFamily: "Georgia, serif",
        border: gold ? "1px solid rgba(197,160,89,0.4)" : red ? "1px solid rgba(180,60,60,0.3)" : "1px solid var(--border)",
        background: gold ? "rgba(197,160,89,0.08)" : red ? "rgba(180,60,60,0.06)" : "var(--surface)",
        color: gold ? "#C5A059" : red ? "#B43C3C" : "var(--text-muted)",
      }}
    >
      {icon} {label}
    </button>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(28,25,23,0.55)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: "100%", maxWidth: 520, background: "white", borderRadius: 20, boxShadow: "0 20px 60px rgba(28,25,23,0.2)", border: "1px solid rgba(197,160,89,0.2)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ icon, title, subtitle, onClose }: { icon: React.ReactNode; title: string; subtitle: string; onClose: () => void }) {
  return (
    <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", background: "rgba(249,247,242,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
      <div className="flex items-center gap-3">
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(197,160,89,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
        <div>
          <h3 style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>{title}</h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "3px 0 0" }}>{subtitle}</p>
        </div>
      </div>
      <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={18} /></button>
    </div>
  );
}

function ModalFooter({ onClose, onConfirm, confirmLabel, saving, disabled }: {
  onClose: () => void; onConfirm: () => void; confirmLabel: string; saving: boolean; disabled?: boolean;
}) {
  return (
    <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", gap: 12 }}>
      <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: 14, fontFamily: "Georgia, serif", cursor: "pointer" }}>
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={saving || disabled}
        style={{
          flex: 2, padding: "10px 0", borderRadius: 12, border: "none",
          background: disabled ? "rgba(197,160,89,0.4)" : "linear-gradient(135deg, #C5A059, #A8853A)",
          color: "white", fontSize: 14, fontWeight: 600,
          fontFamily: "Georgia, serif", cursor: disabled ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          boxShadow: disabled ? "none" : "0 4px 14px rgba(197,160,89,0.3)",
        }}
      >
        {saving && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
        {confirmLabel}
      </button>
    </div>
  );
}

function CenteredLoader() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
      <Loader2 size={24} style={{ color: "rgba(197,160,89,0.5)", animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}

function EmptyState({ icon, text, sub }: { icon: React.ReactNode; text: string; sub: string }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 0" }}>
      <div style={{ color: "rgba(197,160,89,0.35)", marginBottom: 14, display: "flex", justifyContent: "center" }}>{icon}</div>
      <p style={{ fontFamily: "Georgia, serif", fontSize: 16, color: "var(--foreground)", marginBottom: 6 }}>{text}</p>
      <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{sub}</p>
    </div>
  );
}

const labelSx: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.1em",
  color: "#9C9584", marginBottom: 7,
};

const inputSx: React.CSSProperties = {
  width: "100%", padding: "10px 13px", borderRadius: 10,
  border: "1px solid #E8E2D4", background: "#FDFCF9",
  fontSize: 14, fontFamily: "Georgia, serif",
  color: "var(--foreground)", outline: "none",
  boxSizing: "border-box",
};
