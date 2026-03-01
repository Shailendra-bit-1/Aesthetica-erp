"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import Link from "next/link";
import {
  Crown,
  Network,
  Plus,
  Building2,
  Link2,
  Mail,
  MapPin,
  ChevronDown,
  Loader2,
  X,
  Sparkles,
  AlertCircle,
  Pencil,
  ShieldCheck,
  Users,
  Receipt,
  Hash,
  CreditCard,
  Smartphone,
  Landmark,
  Bell,
  CheckCircle2,
} from "lucide-react";
import { ROLE_BADGE } from "@/lib/permissions";

// ── Types ────────────────────────────────────────────────────────────────────

type Chain = {
  id: string;
  name: string;
  created_at: string;
};

type Clinic = {
  id: string;
  name: string;
  chain_id: string | null;
  location: string | null;
  subscription_status: string;
  admin_email?: string | null;
  created_at: string;
  chains?: { name: string } | null;
};

type StaffProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  clinic_id: string | null;
};

const emptyClinicForm = {
  name: "",
  chain_id: "",
  location: "",
  admin_email: "",
  subscription_status: "active",
  gst_number: "",
  legal_business_name: "",
  gst_state_code: "",
  gst_registered_state: "",
};

// Updated labels per spec: Active / Past Due / Canceled
const SUBSCRIPTION_STATUSES = ["active", "past_due", "canceled"] as const;
type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

const statusColors: Record<string, { bg: string; color: string }> = {
  active:   { bg: "rgba(139,158,122,0.15)", color: "#6B8A5A" },
  past_due: { bg: "rgba(197,160,89,0.15)",  color: "#A8853A" },
  canceled: { bg: "rgba(138,128,120,0.15)", color: "#6A6460" },
  // keep old values so existing data still renders
  trial:    { bg: "rgba(197,160,89,0.15)",  color: "#A8853A" },
  inactive: { bg: "rgba(138,128,120,0.15)", color: "#6A6460" },
};

const statusLabel: Record<string, string> = {
  active:   "Active",
  past_due: "Past Due",
  canceled: "Canceled",
  trial:    "Trial",
  inactive: "Inactive",
};

// ── Shared styles ─────────────────────────────────────────────────────────────

const labelSx: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.09em",
  color: "var(--text-muted)",
  marginBottom: 6,
};

const inputSx: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 10,
  fontSize: 13,
  fontFamily: "Georgia, serif",
  background: "#FDFCF9",
  border: "1px solid var(--border)",
  color: "var(--foreground)",
  outline: "none",
  transition: "all 0.2s",
  boxSizing: "border-box",
};

// ── Edit Clinic Drawer ────────────────────────────────────────────────────────

function EditClinicDrawer({
  clinic,
  chains,
  open,
  onClose,
  onSave,
}: {
  clinic: Clinic | null;
  chains: Chain[];
  open: boolean;
  onClose: () => void;
  onSave: (updated: Clinic) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [form, setForm] = useState({
    name: "",
    location: "",
    subscription_status: "active",
  });
  const [saving, setSaving] = useState(false);

  // Mount for SSR safety
  useEffect(() => { setMounted(true); }, []);

  // Sync form when clinic changes
  useEffect(() => {
    if (clinic) {
      setForm({
        name: clinic.name,
        location: clinic.location ?? "",
        subscription_status: clinic.subscription_status,
      });
    }
  }, [clinic]);

  // Animate in
  useEffect(() => {
    if (open) {
      const t = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(t);
    } else {
      setVisible(false);
    }
  }, [open]);

  async function handleSave() {
    if (!clinic || !form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        location: form.location.trim() || null,
        subscription_status: form.subscription_status,
      };

      const { error } = await supabase
        .from("clinics")
        .update(payload)
        .eq("id", clinic.id);

      if (error) {
        toast.error("Failed to update clinic", { description: error.message });
        return;
      }

      const updated: Clinic = { ...clinic, ...payload };
      onSave(updated);
      toast.success(`"${updated.name}" updated`, {
        icon: <Sparkles size={14} color="#C5A059" />,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(28,25,23,0.4)",
          backdropFilter: "blur(4px)",
          zIndex: 50,
          opacity: visible ? 1 : 0,
          transition: "opacity 0.28s",
          pointerEvents: open ? "auto" : "none",
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 420,
          background: "white",
          zIndex: 51,
          display: "flex",
          flexDirection: "column",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: "-4px 0 32px rgba(28,25,23,0.18)",
        }}
      >
        {/* Gold top bar */}
        <div
          style={{
            height: 3,
            background: "linear-gradient(90deg, #C5A059, #A8853A)",
          }}
        />

        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #F0EBE2",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(197,160,89,0.12)",
                border: "1px solid rgba(197,160,89,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Pencil size={16} color="#C5A059" />
            </div>
            <div>
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#1A1A1A",
                  fontFamily: "Georgia, serif",
                }}
              >
                Edit Clinic
              </p>
              <p style={{ fontSize: 11, color: "#8A8078" }}>{clinic?.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "1px solid #E8E2D4",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#8A8078",
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Name */}
            <div>
              <label style={labelSx}>
                <Building2 size={11} color="var(--gold)" /> Clinic Name *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                style={inputSx}
                onFocus={(e) => { e.target.style.borderColor = "#C5A059"; e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.1)"; }}
                onBlur={(e) => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
              />
            </div>

            {/* Location */}
            <div>
              <label style={labelSx}>
                <MapPin size={11} color="var(--gold)" /> Location
              </label>
              <input
                type="text"
                placeholder="e.g. 42 Harley Street, London"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                style={inputSx}
                onFocus={(e) => { e.target.style.borderColor = "#C5A059"; e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.1)"; }}
                onBlur={(e) => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
              />
            </div>

            {/* Subscription status */}
            <div>
              <label style={labelSx}>Subscription Status</label>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                {SUBSCRIPTION_STATUSES.map((s) => {
                  const sc = statusColors[s] ?? statusColors.canceled;
                  const isActive = form.subscription_status === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, subscription_status: s }))}
                      style={{
                        flex: 1,
                        padding: "7px 0",
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        border: isActive ? `1.5px solid ${sc.color}` : "1.5px solid #E8E2D4",
                        background: isActive ? sc.bg : "#FDFCF9",
                        color: isActive ? sc.color : "#8A8078",
                        transition: "all 0.15s",
                      }}
                    >
                      {statusLabel[s]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #F0EBE2",
            display: "flex",
            gap: 10,
          }}
        >
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: 10,
              border: "1px solid #E8E2D4",
              background: "transparent",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              color: "#8A8078",
              fontFamily: "Georgia, serif",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            style={{
              flex: 2,
              padding: "10px 0",
              borderRadius: 10,
              border: "none",
              background:
                saving || !form.name.trim()
                  ? "rgba(197,160,89,0.35)"
                  : "linear-gradient(135deg, #C5A059, #A8853A)",
              color: "white",
              cursor: saving || !form.name.trim() ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "Georgia, serif",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {saving ? (
              <>
                <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                Saving…
              </>
            ) : (
              <>
                <Sparkles size={13} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

// ── Manage Access Drawer ──────────────────────────────────────────────────────

function ManageAccessDrawer({
  clinic,
  open,
  onClose,
}: {
  clinic: Clinic | null;
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  // Assign admin section
  const [adminEmail, setAdminEmail] = useState("");
  const [assigningAdmin, setAssigningAdmin] = useState(false);

  // Staff section
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (open) {
      const t = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(t);
    } else {
      setVisible(false);
    }
  }, [open]);

  // Load staff when drawer opens for a clinic
  useEffect(() => {
    if (!open || !clinic) {
      setStaff([]);
      setAdminEmail("");
      return;
    }

    async function loadStaff() {
      setLoadingStaff(true);
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, email, role, clinic_id")
          .eq("clinic_id", clinic!.id)
          .not("role", "in", '("superadmin","admin","clinic_admin")');

        setStaff((data ?? []) as StaffProfile[]);
      } finally {
        setLoadingStaff(false);
      }
    }

    loadStaff();
  }, [open, clinic]);

  async function handleAssignAdmin() {
    if (!adminEmail.trim() || !clinic) return;
    setAssigningAdmin(true);
    try {
      const res = await fetch("/api/admin/assign-clinic-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail.trim(), clinicId: clinic.id }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error("Failed to assign clinic admin", {
          description: data.error ?? "Unknown error",
        });
        return;
      }

      if (data.isPlaceholder) {
        toast.success("Placeholder created", {
          description: "Admin rights will apply on signup.",
          icon: <ShieldCheck size={14} color="#C5A059" />,
        });
      } else {
        toast.success("Clinic admin assigned", {
          icon: <ShieldCheck size={14} color="#C5A059" />,
        });
      }

      setAdminEmail("");
    } finally {
      setAssigningAdmin(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(28,25,23,0.4)",
          backdropFilter: "blur(4px)",
          zIndex: 50,
          opacity: visible ? 1 : 0,
          transition: "opacity 0.28s",
          pointerEvents: open ? "auto" : "none",
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 420,
          background: "white",
          zIndex: 51,
          display: "flex",
          flexDirection: "column",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: "-4px 0 32px rgba(28,25,23,0.18)",
        }}
      >
        {/* Gold top bar */}
        <div
          style={{ height: 3, background: "linear-gradient(90deg, #C5A059, #A8853A)" }}
        />

        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #F0EBE2",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(197,160,89,0.12)",
                border: "1px solid rgba(197,160,89,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShieldCheck size={16} color="#C5A059" />
            </div>
            <div>
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#1A1A1A",
                  fontFamily: "Georgia, serif",
                }}
              >
                Manage Access
              </p>
              <p style={{ fontSize: 11, color: "#8A8078" }}>{clinic?.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "1px solid #E8E2D4",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#8A8078",
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Section A: Assign Clinic Admin */}
          <div
            style={{
              padding: "20px 24px",
              borderBottom: "1px solid #F0EBE2",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <ShieldCheck size={15} color="#C5A059" />
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#1A1A1A",
                  fontFamily: "Georgia, serif",
                }}
              >
                Assign Clinic Admin
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={labelSx}>
                  <Mail size={11} color="var(--gold)" /> Email Address
                </label>
                <input
                  type="email"
                  placeholder="admin@clinic.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  style={inputSx}
                  onFocus={(e) => { e.target.style.borderColor = "#C5A059"; e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.1)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAssignAdmin(); }}
                />
              </div>
              <button
                onClick={handleAssignAdmin}
                disabled={assigningAdmin || !adminEmail.trim()}
                style={{
                  width: "100%",
                  padding: "10px 0",
                  borderRadius: 10,
                  border: "none",
                  background:
                    assigningAdmin || !adminEmail.trim()
                      ? "rgba(197,160,89,0.35)"
                      : "linear-gradient(135deg, #C5A059, #A8853A)",
                  color: "white",
                  cursor: assigningAdmin || !adminEmail.trim() ? "not-allowed" : "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "Georgia, serif",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {assigningAdmin ? (
                  <>
                    <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                    Assigning…
                  </>
                ) : (
                  <>
                    <ShieldCheck size={13} />
                    Assign Clinic Admin
                  </>
                )}
              </button>
              <p style={{ fontSize: 11, color: "#8A8078", lineHeight: 1.5 }}>
                If the email is not found in the system, a placeholder profile will be created. Admin rights will apply once they sign up.
              </p>
            </div>
          </div>

          {/* Section B: Staff Permissions */}
          <div style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Users size={15} color="#C5A059" />
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#1A1A1A",
                  fontFamily: "Georgia, serif",
                }}
              >
                Staff Permissions
              </p>
            </div>

            {loadingStaff ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
                <Loader2 size={18} color="#C5A059" style={{ animation: "spin 1s linear infinite" }} />
              </div>
            ) : staff.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  padding: "28px 0",
                }}
              >
                <Users size={24} color="#C5A059" style={{ opacity: 0.4 }} />
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#1A1A1A",
                    fontFamily: "Georgia, serif",
                    textAlign: "center",
                  }}
                >
                  No staff assigned to this clinic yet
                </p>
                <p style={{ fontSize: 11, color: "#8A8078", textAlign: "center" }}>
                  Staff members will appear here once assigned.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {staff.map((member) => {
                  const badge = ROLE_BADGE[member.role] ?? {
                    label: member.role,
                    bg: "rgba(197,160,89,0.1)",
                    color: "#8A8078",
                    border: "rgba(197,160,89,0.2)",
                  };
                  const initials = member.full_name
                    ? member.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
                    : "??";

                  return (
                    <div
                      key={member.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid #F0EBE2",
                        background: "#FDFCF9",
                      }}
                    >
                      {/* Avatar */}
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: "50%",
                          background: badge.bg,
                          border: `1px solid ${badge.border}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 700,
                          color: badge.color,
                          fontFamily: "Georgia, serif",
                          flexShrink: 0,
                        }}
                      >
                        {initials}
                      </div>

                      {/* Name + badge */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#1A1A1A",
                            fontFamily: "Georgia, serif",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {member.full_name ?? "—"}
                        </p>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "1px 8px",
                            borderRadius: 20,
                            fontSize: 10,
                            fontWeight: 600,
                            background: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                            fontFamily: "Georgia, serif",
                          }}
                        >
                          {badge.label}
                        </span>
                      </div>

                      {/* Edit permissions link */}
                      <Link
                        href={`/settings/staff/${member.id}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#C5A059",
                          textDecoration: "none",
                          padding: "5px 10px",
                          borderRadius: 7,
                          border: "1px solid rgba(197,160,89,0.3)",
                          background: "rgba(197,160,89,0.06)",
                          flexShrink: 0,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Edit Perms
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ManagePage() {
  const [chains, setChains] = useState<Chain[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Chain form
  const [showChainForm, setShowChainForm] = useState(false);
  const [chainName, setChainName] = useState("");
  const [chainSubmitting, setChainSubmitting] = useState(false);
  const [chainBillingMethod, setChainBillingMethod] = useState<"credit_card" | "bank_transfer" | "upi" | "">("");
  const [chainBillingDetails, setChainBillingDetails] = useState({
    masked_card: "",
    masked_account: "",
    upi_id: "",
    grace_period_days: 7,
    warning_days_before: 3,
  });

  // Clinic form
  const [showClinicForm, setShowClinicForm] = useState(false);
  const [clinicForm, setClinicForm] = useState(emptyClinicForm);
  const [clinicSubmitting, setClinicSubmitting] = useState(false);
  const [clinicBillingMethod, setClinicBillingMethod] = useState<"credit_card" | "bank_transfer" | "upi" | "">("");
  const [clinicBillingDetails, setClinicBillingDetails] = useState({
    masked_card: "",
    masked_account: "",
    upi_id: "",
    grace_period_days: 7,
    warning_days_before: 3,
  });

  // Edit clinic drawer
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editClinic, setEditClinic] = useState<Clinic | null>(null);

  // Manage access drawer
  const [accessDrawerOpen, setAccessDrawerOpen] = useState(false);
  const [accessClinic, setAccessClinic] = useState<Clinic | null>(null);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoadingData(true);
    const [chainsRes, clinicsRes] = await Promise.all([
      supabase.from("chains").select("*").order("created_at", { ascending: false }),
      supabase.from("clinics").select("*, chains(name)").order("created_at", { ascending: false }),
    ]);
    if (chainsRes.data) setChains(chainsRes.data);
    if (clinicsRes.data) setClinics(clinicsRes.data);
    setLoadingData(false);
  }

  // ── Create Chain ──────────────────────────────────────────────────────────

  async function handleCreateChain(e: React.FormEvent) {
    e.preventDefault();
    if (!chainName.trim()) return;
    setChainSubmitting(true);

    const { data, error } = await supabase
      .from("chains")
      .insert({ name: chainName.trim() })
      .select()
      .single();

    if (error) {
      toast.error("Failed to create chain", { description: error.message });
      setChainSubmitting(false);
      return;
    }

    // Save auto-pay billing method if provided
    if (chainBillingMethod) {
      await supabase.from("chain_billing_methods").insert({
        chain_id: data.id,
        method_type: chainBillingMethod,
        masked_card_number: chainBillingDetails.masked_card.trim() || null,
        masked_account_number: chainBillingDetails.masked_account.trim() || null,
        upi_id: chainBillingDetails.upi_id.trim() || null,
        grace_period_days: chainBillingDetails.grace_period_days,
        warning_days_before: chainBillingDetails.warning_days_before,
        is_active: true,
      });
    }

    toast.success(`"${data.name}" chain created`, {
      icon: <Network size={15} color="#C5A059" />,
      description: chainBillingMethod ? "Auto-pay billing configured." : undefined,
    });
    setChains((prev) => [data, ...prev]);
    setChainName("");
    setChainBillingMethod("");
    setChainBillingDetails({ masked_card: "", masked_account: "", upi_id: "", grace_period_days: 7, warning_days_before: 3 });
    setShowChainForm(false);
    setChainSubmitting(false);
  }

  // ── Create Clinic ─────────────────────────────────────────────────────────

  async function handleCreateClinic(e: React.FormEvent) {
    e.preventDefault();
    setClinicSubmitting(true);

    const { data, error } = await supabase
      .from("clinics")
      .insert({
        name: clinicForm.name.trim(),
        chain_id: clinicForm.chain_id || null,
        location: clinicForm.location.trim() || null,
        subscription_status: clinicForm.subscription_status,
        admin_email: clinicForm.admin_email.trim() || null,
        gst_number: clinicForm.gst_number.trim() || null,
        legal_business_name: clinicForm.legal_business_name.trim() || null,
        gst_state_code: clinicForm.gst_state_code.trim() || null,
        gst_registered_state: clinicForm.gst_registered_state.trim() || null,
      })
      .select("*, chains(name)")
      .single();

    if (error) {
      toast.error("Failed to create clinic", { description: error.message });
    } else {
      // Save auto-pay billing method for this clinic if provided
      if (clinicBillingMethod) {
        await supabase.from("clinic_billing_methods").insert({
          clinic_id: data.id,
          method_type: clinicBillingMethod,
          masked_card_number: clinicBillingDetails.masked_card.trim() || null,
          masked_account_number: clinicBillingDetails.masked_account.trim() || null,
          upi_id: clinicBillingDetails.upi_id.trim() || null,
          grace_period_days: clinicBillingDetails.grace_period_days,
          warning_days_before: clinicBillingDetails.warning_days_before,
          is_active: true,
        });
      }

      toast.success(`"${data.name}" clinic created`, {
        icon: <Building2 size={15} color="#C5A059" />,
        description: clinicForm.admin_email
          ? `Admin invite queued for ${clinicForm.admin_email}`
          : undefined,
      });
      setClinics((prev) => [data, ...prev]);
      setClinicForm(emptyClinicForm);
      setClinicBillingMethod("");
      setClinicBillingDetails({ masked_card: "", masked_account: "", upi_id: "", grace_period_days: 7, warning_days_before: 3 });
      setShowClinicForm(false);
    }

    setClinicSubmitting(false);
  }

  // ── Handle edit save (optimistic update) ─────────────────────────────────

  function handleEditSave(updated: Clinic) {
    setClinics((prev) =>
      prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full flex flex-col" style={{ background: "var(--background)" }}>
      <div className="px-8 pb-10">
        {/* Page header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, rgba(197,160,89,0.2), rgba(168,133,58,0.1))",
                border: "1px solid rgba(197,160,89,0.35)",
                boxShadow: "0 4px 20px rgba(197,160,89,0.15)",
              }}
            >
              <Crown size={22} color="#C5A059" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "var(--text-muted)" }}>
                  Master Admin
                </p>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>·</span>
                <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "var(--text-muted)" }}>
                  Superadmin Only
                </p>
              </div>
              <h1
                className="text-2xl font-semibold"
                style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}
              >
                Clinic &amp; Chain Builder
              </h1>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                Build and manage your clinic network from one place.
              </p>
            </div>
          </div>

          {/* Network summary pills */}
          <div className="flex items-center gap-3">
            <StatPill label="Chains" value={chains.length} icon={<Network size={13} />} />
            <StatPill label="Clinics" value={clinics.length} icon={<Building2 size={13} />} />
          </div>
        </div>

        {/* Main grid — two columns */}
        <div className="grid grid-cols-2 gap-6">

          {/* ── Chains ──────────────────────────────────────────────────── */}
          <section
            className="luxury-card rounded-2xl overflow-hidden flex flex-col"
            style={{ background: "var(--surface)" }}
          >
            {/* Section header */}
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2.5">
                <Network size={17} style={{ color: "var(--gold)" }} />
                <h2
                  className="text-base font-semibold"
                  style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}
                >
                  Chains
                </h2>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: "rgba(197,160,89,0.12)", color: "var(--gold)" }}
                >
                  {chains.length}
                </span>
              </div>
              <button
                onClick={() => setShowChainForm((p) => !p)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-200"
                style={{
                  background: showChainForm ? "rgba(197,160,89,0.18)" : "rgba(197,160,89,0.1)",
                  color: "var(--gold)",
                  border: "1px solid rgba(197,160,89,0.3)",
                }}
              >
                {showChainForm ? <X size={13} /> : <Plus size={13} />}
                {showChainForm ? "Cancel" : "New Chain"}
              </button>
            </div>

            {/* Inline create-chain form */}
            {showChainForm && (
              <form
                onSubmit={handleCreateChain}
                className="px-6 py-5"
                style={{ borderBottom: "1px solid var(--border)", background: "rgba(197,160,89,0.03)" }}
              >
                <p
                  className="text-xs uppercase tracking-widest font-semibold mb-3"
                  style={{ color: "var(--gold)" }}
                >
                  New Chain
                </p>
                <div className="space-y-3">
                  <div>
                    <label style={labelSx}>
                      <Network size={11} color="var(--gold)" /> Chain Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Luxury Skin Group"
                      value={chainName}
                      onChange={(e) => setChainName(e.target.value)}
                      style={inputSx}
                      onFocus={(e) => { e.target.style.borderColor = "var(--gold)"; e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.1)"; }}
                      onBlur={(e)  => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                    />
                  </div>
                  {/* Auto-pay Billing */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Receipt size={12} color="var(--gold)" />
                      <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "var(--gold)" }}>
                        Auto-Pay Billing
                      </p>
                      <div className="flex-1 h-px" style={{ background: "rgba(197,160,89,0.2)" }} />
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>Optional</span>
                    </div>
                    <div className="space-y-3">
                      {/* Method type selector */}
                      <div>
                        <label style={labelSx}>Payment Method</label>
                        <div className="flex gap-2">
                          {(["credit_card", "bank_transfer", "upi"] as const).map((m) => {
                            const icons = {
                              credit_card: <CreditCard size={11} />,
                              bank_transfer: <Landmark size={11} />,
                              upi: <Smartphone size={11} />,
                            };
                            const labels = { credit_card: "Credit Card", bank_transfer: "Bank", upi: "UPI" };
                            return (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setChainBillingMethod((prev) => prev === m ? "" : m)}
                                className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all duration-150"
                                style={{
                                  border: chainBillingMethod === m ? "1.5px solid var(--gold)" : "1.5px solid var(--border)",
                                  background: chainBillingMethod === m ? "rgba(197,160,89,0.12)" : "var(--surface-warm)",
                                  color: chainBillingMethod === m ? "var(--gold)" : "var(--text-muted)",
                                }}
                              >
                                {icons[m]}
                                {labels[m]}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Conditional detail fields */}
                      {chainBillingMethod === "credit_card" && (
                        <div>
                          <label style={labelSx}>
                            <CreditCard size={11} color="var(--gold)" /> Masked Card Number
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. **** **** **** 4242"
                            value={chainBillingDetails.masked_card}
                            onChange={(e) => setChainBillingDetails((d) => ({ ...d, masked_card: e.target.value }))}
                            style={{ ...inputSx, fontFamily: "monospace" }}
                            onFocus={(e) => { e.target.style.borderColor = "var(--gold)"; e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.1)"; }}
                            onBlur={(e)  => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                          />
                        </div>
                      )}
                      {chainBillingMethod === "bank_transfer" && (
                        <div>
                          <label style={labelSx}>
                            <Landmark size={11} color="var(--gold)" /> Masked Account Number
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. ****6789"
                            value={chainBillingDetails.masked_account}
                            onChange={(e) => setChainBillingDetails((d) => ({ ...d, masked_account: e.target.value }))}
                            style={{ ...inputSx, fontFamily: "monospace" }}
                            onFocus={(e) => { e.target.style.borderColor = "var(--gold)"; e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.1)"; }}
                            onBlur={(e)  => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                          />
                        </div>
                      )}
                      {chainBillingMethod === "upi" && (
                        <div>
                          <label style={labelSx}>
                            <Smartphone size={11} color="var(--gold)" /> UPI ID
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. clinic@okaxis"
                            value={chainBillingDetails.upi_id}
                            onChange={(e) => setChainBillingDetails((d) => ({ ...d, upi_id: e.target.value }))}
                            style={inputSx}
                            onFocus={(e) => { e.target.style.borderColor = "var(--gold)"; e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.1)"; }}
                            onBlur={(e)  => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                          />
                        </div>
                      )}

                      {/* Grace period & warning (shown when any method selected) */}
                      {chainBillingMethod && (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label style={labelSx}>
                                <Bell size={11} color="var(--gold)" /> Grace Period (days)
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={30}
                                value={chainBillingDetails.grace_period_days}
                                onChange={(e) => setChainBillingDetails((d) => ({ ...d, grace_period_days: Number(e.target.value) }))}
                                style={inputSx}
                                onFocus={(e) => { e.target.style.borderColor = "var(--gold)"; e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.1)"; }}
                                onBlur={(e)  => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                              />
                            </div>
                            <div>
                              <label style={labelSx}>
                                <Bell size={11} color="var(--gold)" /> Warn Before (days)
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={14}
                                value={chainBillingDetails.warning_days_before}
                                onChange={(e) => setChainBillingDetails((d) => ({ ...d, warning_days_before: Number(e.target.value) }))}
                                style={inputSx}
                                onFocus={(e) => { e.target.style.borderColor = "var(--gold)"; e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.1)"; }}
                                onBlur={(e)  => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                              />
                            </div>
                          </div>
                          <div
                            className="flex items-start gap-2 p-3 rounded-xl"
                            style={{ background: "rgba(139,158,122,0.08)", border: "1px solid rgba(139,158,122,0.25)" }}
                          >
                            <CheckCircle2 size={13} style={{ color: "#6B8A5A", flexShrink: 0, marginTop: 1 }} />
                            <p style={{ fontSize: 11, color: "#6B8A5A", lineHeight: 1.6 }}>
                              Admins will be warned {chainBillingDetails.warning_days_before} days before due date.
                              After a {chainBillingDetails.grace_period_days}-day grace period, the subscription
                              auto-resumes once payment is cleared.
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <GoldButton type="submit" loading={chainSubmitting} disabled={!chainName.trim()}>
                    <Sparkles size={13} /> Create Chain
                  </GoldButton>
                </div>
              </form>
            )}

            {/* Chain list */}
            <div className="flex-1 divide-y" style={{ borderColor: "var(--border)" }}>
              {loadingData && <SkeletonRows n={3} />}
              {!loadingData && chains.length === 0 && (
                <EmptyState
                  icon={<Network size={26} style={{ color: "var(--gold)", opacity: 0.5 }} />}
                  text="No chains yet"
                  sub="Create your first clinic chain above."
                />
              )}
              {chains.map((chain) => (
                <div key={chain.id} className="px-6 py-4 flex items-center gap-3 hover:bg-stone-50 transition-colors">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(197,160,89,0.1)", border: "1px solid rgba(197,160,89,0.2)" }}
                  >
                    <Network size={14} style={{ color: "var(--gold)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-semibold truncate"
                      style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}
                    >
                      {chain.name}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {clinics.filter((c) => c.chain_id === chain.id).length} clinic
                      {clinics.filter((c) => c.chain_id === chain.id).length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {new Date(chain.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Clinics ─────────────────────────────────────────────────── */}
          <section
            className="luxury-card rounded-2xl overflow-hidden flex flex-col"
            style={{ background: "var(--surface)" }}
          >
            {/* Section header */}
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2.5">
                <Building2 size={17} style={{ color: "var(--gold)" }} />
                <h2
                  className="text-base font-semibold"
                  style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}
                >
                  Clinics
                </h2>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: "rgba(197,160,89,0.12)", color: "var(--gold)" }}
                >
                  {clinics.length}
                </span>
              </div>
              <button
                onClick={() => setShowClinicForm((p) => !p)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-200"
                style={{
                  background: showClinicForm ? "rgba(197,160,89,0.18)" : "rgba(197,160,89,0.1)",
                  color: "var(--gold)",
                  border: "1px solid rgba(197,160,89,0.3)",
                }}
              >
                {showClinicForm ? <X size={13} /> : <Plus size={13} />}
                {showClinicForm ? "Cancel" : "New Clinic"}
              </button>
            </div>

            {/* Inline create-clinic form */}
            {showClinicForm && (
              <form
                onSubmit={handleCreateClinic}
                className="px-6 py-5 space-y-4"
                style={{ borderBottom: "1px solid var(--border)", background: "rgba(197,160,89,0.03)" }}
              >
                <p
                  className="text-xs uppercase tracking-widest font-semibold"
                  style={{ color: "var(--gold)" }}
                >
                  New Clinic
                </p>

                {/* Clinic name */}
                <div>
                  <label style={labelSx}>
                    <Building2 size={11} color="var(--gold)" /> Clinic Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Aesthetica Mayfair"
                    value={clinicForm.name}
                    onChange={(e) => setClinicForm((f) => ({ ...f, name: e.target.value }))}
                    style={inputSx}
                    onFocus={(e) => { e.target.style.borderColor = "var(--gold)"; e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.1)"; }}
                    onBlur={(e)  => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                  />
                </div>

                {/* Chain selector */}
                <div>
                  <label style={labelSx}>
                    <Link2 size={11} color="var(--gold)" /> Chain
                  </label>
                  {chains.length === 0 ? (
                    <p className="text-xs italic" style={{ color: "var(--text-muted)", marginTop: 4 }}>
                      No chains yet — create one first, or leave independent.
                    </p>
                  ) : (
                    <div style={{ position: "relative" }}>
                      <select
                        value={clinicForm.chain_id}
                        onChange={(e) => setClinicForm((f) => ({ ...f, chain_id: e.target.value }))}
                        style={{ ...inputSx, appearance: "none", paddingRight: 32, cursor: "pointer" }}
                        onFocus={(e) => { e.target.style.borderColor = "var(--gold)"; e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.1)"; }}
                        onBlur={(e)  => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                      >
                        <option value="">Independent (no chain)</option>
                        {chains.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={13} color="var(--text-muted)" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                    </div>
                  )}
                </div>

                {/* Clinic Admin Email */}
                <div>
                  <label style={labelSx}>
                    <Mail size={11} color="var(--gold)" /> Clinic Admin Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="admin@aesthetica-mayfair.com"
                    value={clinicForm.admin_email}
                    onChange={(e) => setClinicForm((f) => ({ ...f, admin_email: e.target.value }))}
                    style={inputSx}
                    onFocus={(e) => { e.target.style.borderColor = "var(--gold)"; e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.1)"; }}
                    onBlur={(e)  => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                  />
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    This person will receive a Clinic Admin invite.
                  </p>
                </div>

                {/* Location */}
                <div>
                  <label style={labelSx}>
                    <MapPin size={11} color="var(--gold)" /> Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 42 Harley Street, London"
                    value={clinicForm.location}
                    onChange={(e) => setClinicForm((f) => ({ ...f, location: e.target.value }))}
                    style={inputSx}
                    onFocus={(e) => { e.target.style.borderColor = "var(--gold)"; e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.1)"; }}
                    onBlur={(e)  => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                  />
                </div>

                {/* GST Details */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Hash size={12} color="var(--gold)" />
                    <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "var(--gold)" }}>
                      GST Details
                    </p>
                    <div className="flex-1 h-px" style={{ background: "rgba(197,160,89,0.2)" }} />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>Optional</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label style={labelSx}>
                        <Hash size={11} color="var(--gold)" /> GSTIN
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 27AADCB2230M1ZP"
                        value={clinicForm.gst_number}
                        onChange={(e) => setClinicForm((f) => ({ ...f, gst_number: e.target.value.toUpperCase() }))}
                        style={{ ...inputSx, fontFamily: "monospace" }}
                        onFocus={(e) => { e.target.style.borderColor = "var(--gold)"; e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.1)"; }}
                        onBlur={(e)  => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                      />
                    </div>
                    <div>
                      <label style={labelSx}>
                        <Building2 size={11} color="var(--gold)" /> Legal Business Name
                      </label>
                      <input
                        type="text"
                        placeholder="As per GST registration"
                        value={clinicForm.legal_business_name}
                        onChange={(e) => setClinicForm((f) => ({ ...f, legal_business_name: e.target.value }))}
                        style={inputSx}
                        onFocus={(e) => { e.target.style.borderColor = "var(--gold)"; e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.1)"; }}
                        onBlur={(e)  => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label style={labelSx}>State Code</label>
                        <input
                          type="text"
                          placeholder="e.g. 27"
                          value={clinicForm.gst_state_code}
                          onChange={(e) => setClinicForm((f) => ({ ...f, gst_state_code: e.target.value }))}
                          style={inputSx}
                          onFocus={(e) => { e.target.style.borderColor = "var(--gold)"; e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.1)"; }}
                          onBlur={(e)  => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                        />
                      </div>
                      <div>
                        <label style={labelSx}>Registered State</label>
                        <input
                          type="text"
                          placeholder="e.g. Maharashtra"
                          value={clinicForm.gst_registered_state}
                          onChange={(e) => setClinicForm((f) => ({ ...f, gst_registered_state: e.target.value }))}
                          style={inputSx}
                          onFocus={(e) => { e.target.style.borderColor = "var(--gold)"; e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.1)"; }}
                          onBlur={(e)  => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Auto-pay Billing */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Receipt size={12} color="var(--gold)" />
                    <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "var(--gold)" }}>
                      Auto-Pay Billing
                    </p>
                    <div className="flex-1 h-px" style={{ background: "rgba(197,160,89,0.2)" }} />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>Optional</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label style={labelSx}>Payment Method</label>
                      <div className="flex gap-2">
                        {(["credit_card", "bank_transfer", "upi"] as const).map((m) => {
                          const icons = {
                            credit_card: <CreditCard size={11} />,
                            bank_transfer: <Landmark size={11} />,
                            upi: <Smartphone size={11} />,
                          };
                          const labels = { credit_card: "Credit Card", bank_transfer: "Bank", upi: "UPI" };
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setClinicBillingMethod((prev) => prev === m ? "" : m)}
                              className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all duration-150"
                              style={{
                                border: clinicBillingMethod === m ? "1.5px solid var(--gold)" : "1.5px solid var(--border)",
                                background: clinicBillingMethod === m ? "rgba(197,160,89,0.12)" : "var(--surface-warm)",
                                color: clinicBillingMethod === m ? "var(--gold)" : "var(--text-muted)",
                              }}
                            >
                              {icons[m]}
                              {labels[m]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {clinicBillingMethod === "credit_card" && (
                      <div>
                        <label style={labelSx}>
                          <CreditCard size={11} color="var(--gold)" /> Masked Card Number
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. **** **** **** 4242"
                          value={clinicBillingDetails.masked_card}
                          onChange={(e) => setClinicBillingDetails((d) => ({ ...d, masked_card: e.target.value }))}
                          style={{ ...inputSx, fontFamily: "monospace" }}
                          onFocus={(e) => { e.target.style.borderColor = "var(--gold)"; e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.1)"; }}
                          onBlur={(e)  => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                        />
                      </div>
                    )}
                    {clinicBillingMethod === "bank_transfer" && (
                      <div>
                        <label style={labelSx}>
                          <Landmark size={11} color="var(--gold)" /> Masked Account Number
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. ****6789"
                          value={clinicBillingDetails.masked_account}
                          onChange={(e) => setClinicBillingDetails((d) => ({ ...d, masked_account: e.target.value }))}
                          style={{ ...inputSx, fontFamily: "monospace" }}
                          onFocus={(e) => { e.target.style.borderColor = "var(--gold)"; e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.1)"; }}
                          onBlur={(e)  => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                        />
                      </div>
                    )}
                    {clinicBillingMethod === "upi" && (
                      <div>
                        <label style={labelSx}>
                          <Smartphone size={11} color="var(--gold)" /> UPI ID
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. clinic@okaxis"
                          value={clinicBillingDetails.upi_id}
                          onChange={(e) => setClinicBillingDetails((d) => ({ ...d, upi_id: e.target.value }))}
                          style={inputSx}
                          onFocus={(e) => { e.target.style.borderColor = "var(--gold)"; e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.1)"; }}
                          onBlur={(e)  => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                        />
                      </div>
                    )}

                    {clinicBillingMethod && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label style={labelSx}>
                              <Bell size={11} color="var(--gold)" /> Grace Period (days)
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={30}
                              value={clinicBillingDetails.grace_period_days}
                              onChange={(e) => setClinicBillingDetails((d) => ({ ...d, grace_period_days: Number(e.target.value) }))}
                              style={inputSx}
                              onFocus={(e) => { e.target.style.borderColor = "var(--gold)"; e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.1)"; }}
                              onBlur={(e)  => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                            />
                          </div>
                          <div>
                            <label style={labelSx}>
                              <Bell size={11} color="var(--gold)" /> Warn Before (days)
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={14}
                              value={clinicBillingDetails.warning_days_before}
                              onChange={(e) => setClinicBillingDetails((d) => ({ ...d, warning_days_before: Number(e.target.value) }))}
                              style={inputSx}
                              onFocus={(e) => { e.target.style.borderColor = "var(--gold)"; e.target.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.1)"; }}
                              onBlur={(e)  => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                            />
                          </div>
                        </div>
                        <div
                          className="flex items-start gap-2 p-3 rounded-xl"
                          style={{ background: "rgba(139,158,122,0.08)", border: "1px solid rgba(139,158,122,0.25)" }}
                        >
                          <CheckCircle2 size={13} style={{ color: "#6B8A5A", flexShrink: 0, marginTop: 1 }} />
                          <p style={{ fontSize: 11, color: "#6B8A5A", lineHeight: 1.6 }}>
                            Admins will be warned {clinicBillingDetails.warning_days_before} days before due date.
                            After a {clinicBillingDetails.grace_period_days}-day grace period, the subscription
                            auto-resumes once payment is cleared.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Subscription status */}
                <div>
                  <label style={labelSx}>Subscription Status</label>
                  <div className="flex gap-2 mt-1">
                    {(["active", "trial", "inactive"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setClinicForm((f) => ({ ...f, subscription_status: s }))}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all duration-150"
                        style={{
                          border: clinicForm.subscription_status === s
                            ? `1.5px solid ${(statusColors[s] ?? statusColors.inactive).color}`
                            : "1.5px solid var(--border)",
                          background: clinicForm.subscription_status === s
                            ? (statusColors[s] ?? statusColors.inactive).bg
                            : "var(--surface-warm)",
                          color: clinicForm.subscription_status === s
                            ? (statusColors[s] ?? statusColors.inactive).color
                            : "var(--text-muted)",
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <GoldButton
                  type="submit"
                  loading={clinicSubmitting}
                  disabled={!clinicForm.name.trim() || !clinicForm.admin_email.trim()}
                >
                  <Sparkles size={13} /> Create Clinic
                </GoldButton>
              </form>
            )}

            {/* Clinic list */}
            <div className="flex-1 divide-y overflow-y-auto" style={{ borderColor: "var(--border)", maxHeight: "460px" }}>
              {loadingData && <SkeletonRows n={3} />}
              {!loadingData && clinics.length === 0 && (
                <EmptyState
                  icon={<Building2 size={26} style={{ color: "var(--gold)", opacity: 0.5 }} />}
                  text="No clinics yet"
                  sub="Add your first clinic to the network."
                />
              )}
              {clinics.map((clinic) => {
                const sc = statusColors[clinic.subscription_status] ?? statusColors.canceled;
                const sl = statusLabel[clinic.subscription_status] ?? clinic.subscription_status;
                return (
                  <div
                    key={clinic.id}
                    className="px-6 py-4 hover:bg-stone-50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: "rgba(197,160,89,0.08)", border: "1px solid rgba(197,160,89,0.18)" }}
                      >
                        <Building2 size={14} style={{ color: "var(--gold)" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className="text-sm font-semibold truncate"
                            style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}
                          >
                            {clinic.name}
                          </p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                              style={{ background: sc.bg, color: sc.color }}
                            >
                              {sl}
                            </span>

                            {/* Edit button */}
                            <button
                              title="Edit clinic"
                              onClick={() => { setEditClinic(clinic); setEditDrawerOpen(true); }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 28,
                                height: 28,
                                borderRadius: 7,
                                border: "1px solid rgba(197,160,89,0.4)",
                                background: "transparent",
                                cursor: "pointer",
                                color: "#C5A059",
                                transition: "all 0.15s",
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.background = "rgba(197,160,89,0.1)";
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                              }}
                            >
                              <Pencil size={12} />
                            </button>

                            {/* Manage Access button */}
                            <button
                              title="Manage access"
                              onClick={() => { setAccessClinic(clinic); setAccessDrawerOpen(true); }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 28,
                                height: 28,
                                borderRadius: 7,
                                border: "none",
                                background: "linear-gradient(135deg, #C5A059, #A8853A)",
                                cursor: "pointer",
                                color: "white",
                                transition: "all 0.15s",
                                boxShadow: "0 1px 6px rgba(197,160,89,0.3)",
                              }}
                            >
                              <ShieldCheck size={12} />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {clinic.chains?.name && (
                            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--gold)" }}>
                              <Network size={10} /> {clinic.chains.name}
                            </span>
                          )}
                          {clinic.location && (
                            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                              <MapPin size={10} /> {clinic.location}
                            </span>
                          )}
                          {clinic.admin_email && (
                            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                              <Mail size={10} /> {clinic.admin_email}
                            </span>
                          )}
                          {!clinic.chains?.name && (
                            <span className="text-xs italic" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
                              Independent
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {/* Drawers */}
      <EditClinicDrawer
        clinic={editClinic}
        chains={chains}
        open={editDrawerOpen}
        onClose={() => setEditDrawerOpen(false)}
        onSave={handleEditSave}
      />
      <ManageAccessDrawer
        clinic={accessClinic}
        open={accessDrawerOpen}
        onClose={() => setAccessDrawerOpen(false)}
      />

      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-2 rounded-xl"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <span style={{ color: "var(--gold)" }}>{icon}</span>
      <span className="text-lg font-bold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
        {value}
      </span>
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
    </div>
  );
}

function GoldButton({
  children,
  loading,
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={loading || disabled}
      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
      style={{
        background: "linear-gradient(135deg, #C5A059, #A8853A)",
        color: "white",
        fontFamily: "Georgia, serif",
        border: "none",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {loading ? (
        <>
          <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
          Saving…
        </>
      ) : children}
    </button>
  );
}

function EmptyState({ icon, text, sub }: { icon: React.ReactNode; text: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 gap-3">
      {icon}
      <p className="text-sm font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
        {text}
      </p>
      <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>{sub}</p>
    </div>
  );
}

function SkeletonRows({ n }: { n: number }) {
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="px-6 py-4 flex items-center gap-3 animate-pulse">
          <div className="w-8 h-8 rounded-lg" style={{ background: "var(--border)" }} />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/2 rounded" style={{ background: "var(--border)" }} />
            <div className="h-2 w-1/3 rounded" style={{ background: "var(--border)" }} />
          </div>
        </div>
      ))}
    </>
  );
}
