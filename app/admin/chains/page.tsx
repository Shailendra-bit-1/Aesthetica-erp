"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import {
  Building2, Plus, ChevronDown, ChevronRight, Edit2, Trash2, Check, X, Loader2, Globe,
  MapPin, Mail, CreditCard, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface Chain {
  id: string;
  name: string;
  created_at: string;
}

interface Clinic {
  id: string;
  chain_id: string | null;
  name: string;
  location: string | null;
  admin_email: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  is_trial: boolean | null;
  created_at: string;
}

const PLAN_COLORS: Record<string, { bg: string; color: string }> = {
  starter:    { bg: "rgba(34,197,94,0.12)",  color: "#16a34a" },
  growth:     { bg: "rgba(59,130,246,0.12)", color: "#2563eb" },
  enterprise: { bg: "rgba(139,92,246,0.12)", color: "#7c3aed" },
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active:    { bg: "rgba(34,197,94,0.12)",  color: "#16a34a" },
  trialing:  { bg: "rgba(234,179,8,0.12)",  color: "#ca8a04" },
  canceled:  { bg: "rgba(239,68,68,0.12)",  color: "#dc2626" },
  past_due:  { bg: "rgba(249,115,22,0.12)", color: "#ea580c" },
};

export default function ChainsPage() {
  const { profile } = useClinic();
  const router = useRouter();

  const isSuperAdmin = profile?.role === "superadmin";

  useEffect(() => {
    if (profile && !isSuperAdmin) router.replace("/");
  }, [isSuperAdmin, profile, router]);

  const [chains, setChains] = useState<Chain[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Chain form
  const [chainDrawer, setChainDrawer] = useState(false);
  const [chainForm, setChainForm] = useState({ name: "" });
  const [editingChain, setEditingChain] = useState<Chain | null>(null);
  const [savingChain, setSavingChain] = useState(false);

  // Clinic form
  const [clinicDrawer, setClinicDrawer] = useState(false);
  const [clinicForm, setClinicForm] = useState({
    chain_id: "",
    name: "",
    location: "",
    admin_email: "",
    subscription_plan: "starter",
    subscription_status: "active",
  });
  const [editingClinic, setEditingClinic] = useState<Clinic | null>(null);
  const [savingClinic, setSavingClinic] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<{ type: "chain" | "clinic"; id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    const [{ data: chainsData }, { data: clinicsData }] = await Promise.all([
      supabase.from("chains").select("*").order("name"),
      supabase.from("clinics").select("id, chain_id, name, location, admin_email, subscription_plan, subscription_status, is_trial, created_at").order("name"),
    ]);
    setChains((chainsData ?? []) as Chain[]);
    setClinics((clinicsData ?? []) as Clinic[]);
    setLoading(false);
  }, [isSuperAdmin]);

  useEffect(() => { load(); }, [load]);

  // Standalone clinics (no chain)
  const standaloneClinics = clinics.filter(c => !c.chain_id);

  async function saveChain() {
    if (!chainForm.name.trim()) return;
    setSavingChain(true);
    if (editingChain) {
      const { error } = await supabase.from("chains").update({ name: chainForm.name.trim() }).eq("id", editingChain.id);
      if (error) toast.error("Update failed: " + error.message);
      else { toast.success("Chain updated"); load(); setChainDrawer(false); setEditingChain(null); }
    } else {
      const { error } = await supabase.from("chains").insert({ name: chainForm.name.trim() });
      if (error) toast.error("Create failed: " + error.message);
      else { toast.success("Chain created"); load(); setChainDrawer(false); }
    }
    setSavingChain(false);
  }

  async function saveClinic() {
    if (!clinicForm.name.trim()) return;
    setSavingClinic(true);
    const payload = {
      name: clinicForm.name.trim(),
      location: clinicForm.location.trim() || null,
      admin_email: clinicForm.admin_email.trim() || null,
      subscription_plan: clinicForm.subscription_plan,
      subscription_status: clinicForm.subscription_status,
      chain_id: clinicForm.chain_id || null,
    };
    if (editingClinic) {
      const { error } = await supabase.from("clinics").update(payload).eq("id", editingClinic.id);
      if (error) toast.error("Update failed: " + error.message);
      else { toast.success("Clinic updated"); load(); setClinicDrawer(false); setEditingClinic(null); }
    } else {
      const { error } = await supabase.from("clinics").insert(payload);
      if (error) toast.error("Create failed: " + error.message);
      else { toast.success("Clinic created"); load(); setClinicDrawer(false); }
    }
    setSavingClinic(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    if (deleteTarget.type === "chain") {
      // Unlink all clinics from this chain first
      await supabase.from("clinics").update({ chain_id: null }).eq("chain_id", deleteTarget.id);
      const { error } = await supabase.from("chains").delete().eq("id", deleteTarget.id);
      if (error) toast.error("Delete failed: " + error.message);
      else { toast.success("Chain deleted"); load(); }
    } else {
      const { error } = await supabase.from("clinics").delete().eq("id", deleteTarget.id);
      if (error) toast.error("Delete failed: " + error.message);
      else { toast.success("Clinic deleted"); load(); }
    }
    setDeleting(false);
    setDeleteTarget(null);
  }

  function openEditChain(chain: Chain) {
    setEditingChain(chain);
    setChainForm({ name: chain.name });
    setChainDrawer(true);
  }

  function openEditClinic(clinic: Clinic) {
    setEditingClinic(clinic);
    setClinicForm({
      chain_id: clinic.chain_id ?? "",
      name: clinic.name,
      location: clinic.location ?? "",
      admin_email: clinic.admin_email ?? "",
      subscription_plan: clinic.subscription_plan ?? "starter",
      subscription_status: clinic.subscription_status ?? "active",
    });
    setClinicDrawer(true);
  }

  function openNewClinic(chainId = "") {
    setEditingClinic(null);
    setClinicForm({ chain_id: chainId, name: "", location: "", admin_email: "", subscription_plan: "starter", subscription_status: "active" });
    setClinicDrawer(true);
  }

  if (!isSuperAdmin) return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <TopBar />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 40px 60px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(11,42,74,0.1)", border: "1px solid rgba(11,42,74,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Building2 size={16} style={{ color: "#0B2A4A" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--foreground)", margin: 0, fontFamily: "Georgia, serif" }}>Chains & Clinics</h1>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Manage multi-clinic chains and standalone clinics</p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={() => openNewClinic()}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, border: "1px solid rgba(11,42,74,0.2)", background: "rgba(11,42,74,0.06)", color: "#0B2A4A", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              <Plus size={13} /> New Clinic
            </button>
            <button onClick={() => { setEditingChain(null); setChainForm({ name: "" }); setChainDrawer(true); }}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, border: "none", background: "#0B2A4A", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              <Plus size={13} /> New Chain
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80, gap: 10, color: "var(--text-muted)" }}>
            <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> Loading…
          </div>
        ) : (
          <>
            {/* Chains */}
            {chains.map(chain => {
              const chainClinics = clinics.filter(c => c.chain_id === chain.id);
              const isOpen = expanded[chain.id] !== false; // default open
              return (
                <div key={chain.id} style={{ marginBottom: 16, background: "#fff", borderRadius: 14, border: "1px solid rgba(11,42,74,0.12)", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                  {/* Chain header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", cursor: "pointer", background: "rgba(11,42,74,0.03)" }}
                    onClick={() => setExpanded(e => ({ ...e, [chain.id]: !isOpen }))}>
                    {isOpen ? <ChevronDown size={15} style={{ color: "#0B2A4A", flexShrink: 0 }} /> : <ChevronRight size={15} style={{ color: "#0B2A4A", flexShrink: 0 }} />}
                    <Globe size={14} style={{ color: "#0B2A4A", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#0B2A4A", fontFamily: "Georgia, serif" }}>{chain.name}</span>
                      <span style={{ marginLeft: 10, fontSize: 11, color: "var(--text-muted)" }}>{chainClinics.length} clinic{chainClinics.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={e => { e.stopPropagation(); openNewClinic(chain.id); }}
                        style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, border: "1px solid rgba(11,42,74,0.2)", background: "rgba(11,42,74,0.06)", color: "#0B2A4A", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                        <Plus size={11} /> Add Clinic
                      </button>
                      <button onClick={e => { e.stopPropagation(); openEditChain(chain); }}
                        style={{ padding: "5px 8px", borderRadius: 7, border: "1px solid rgba(11,42,74,0.15)", background: "transparent", cursor: "pointer", color: "#0B2A4A" }}>
                        <Edit2 size={12} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); setDeleteTarget({ type: "chain", id: chain.id, name: chain.name }); }}
                        style={{ padding: "5px 8px", borderRadius: 7, border: "1px solid rgba(220,38,38,0.2)", background: "transparent", cursor: "pointer", color: "#dc2626" }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  {/* Chain clinics */}
                  {isOpen && (
                    <div>
                      {chainClinics.length === 0 ? (
                        <div style={{ padding: "16px 20px", fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>No clinics in this chain yet.</div>
                      ) : (
                        chainClinics.map((clinic, idx) => (
                          <ClinicRow key={clinic.id} clinic={clinic} isLast={idx === chainClinics.length - 1}
                            onEdit={() => openEditClinic(clinic)}
                            onDelete={() => setDeleteTarget({ type: "clinic", id: clinic.id, name: clinic.name })} />
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Standalone clinics */}
            {standaloneClinics.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(197,160,89,0.2)", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                <div style={{ padding: "14px 20px", background: "rgba(197,160,89,0.05)", borderBottom: "1px solid rgba(197,160,89,0.15)", display: "flex", alignItems: "center", gap: 8 }}>
                  <Building2 size={14} style={{ color: "#C5A059" }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#8B6914", fontFamily: "Georgia, serif" }}>Standalone Clinics</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{standaloneClinics.length} clinic{standaloneClinics.length !== 1 ? "s" : ""}</span>
                </div>
                {standaloneClinics.map((clinic, idx) => (
                  <ClinicRow key={clinic.id} clinic={clinic} isLast={idx === standaloneClinics.length - 1}
                    onEdit={() => openEditClinic(clinic)}
                    onDelete={() => setDeleteTarget({ type: "clinic", id: clinic.id, name: clinic.name })} />
                ))}
              </div>
            )}

            {chains.length === 0 && standaloneClinics.length === 0 && (
              <div style={{ textAlign: "center", padding: "64px 20px" }}>
                <Building2 size={36} style={{ color: "rgba(11,42,74,0.2)", margin: "0 auto 12px" }} />
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No chains or clinics yet. Create one above.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* CHAIN DRAWER */}
      {chainDrawer && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
          <div style={{ background: "#fff", borderRadius: 16, width: 400, border: "1px solid rgba(11,42,74,0.15)", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(11,42,74,0.1)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, fontFamily: "Georgia, serif", color: "#0B2A4A", margin: 0 }}>{editingChain ? "Edit Chain" : "New Chain"}</h3>
              <button onClick={() => setChainDrawer(false)} style={{ border: "none", background: "none", cursor: "pointer", color: "#9ca3af" }}><X size={16} /></button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#4b5563", marginBottom: 6 }}>Chain Name *</label>
                <input value={chainForm.name} onChange={e => setChainForm({ name: e.target.value })}
                  placeholder="e.g. Aesthetica North India"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid rgba(11,42,74,0.2)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(11,42,74,0.1)", display: "flex", gap: 10 }}>
              <button onClick={() => setChainDrawer(false)} style={{ flex: 1, padding: "9px", borderRadius: 9, border: "1px solid rgba(11,42,74,0.15)", background: "transparent", cursor: "pointer", fontSize: 13, color: "#6b7280" }}>Cancel</button>
              <button onClick={saveChain} disabled={savingChain || !chainForm.name.trim()}
                style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", borderRadius: 9, background: "#0B2A4A", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, opacity: savingChain ? 0.7 : 1 }}>
                {savingChain ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={13} />}
                {editingChain ? "Update" : "Create Chain"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLINIC DRAWER */}
      {clinicDrawer && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
          <div style={{ background: "#fff", borderRadius: 16, width: 480, border: "1px solid rgba(11,42,74,0.15)", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(11,42,74,0.1)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, fontFamily: "Georgia, serif", color: "#0B2A4A", margin: 0 }}>{editingClinic ? "Edit Clinic" : "New Clinic"}</h3>
              <button onClick={() => setClinicDrawer(false)} style={{ border: "none", background: "none", cursor: "pointer", color: "#9ca3af" }}><X size={16} /></button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#4b5563", marginBottom: 6 }}>Clinic Name *</label>
                <input value={clinicForm.name} onChange={e => setClinicForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Aesthetica Delhi South"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid rgba(11,42,74,0.2)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#4b5563", marginBottom: 6 }}>Chain (optional)</label>
                <select value={clinicForm.chain_id} onChange={e => setClinicForm(f => ({ ...f, chain_id: e.target.value }))}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid rgba(11,42,74,0.2)", fontSize: 13, outline: "none", background: "#fff", boxSizing: "border-box" }}>
                  <option value="">— Standalone (no chain) —</option>
                  {chains.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#4b5563", marginBottom: 6 }}>Location</label>
                  <input value={clinicForm.location} onChange={e => setClinicForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="e.g. Hauz Khas, Delhi"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid rgba(11,42,74,0.2)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#4b5563", marginBottom: 6 }}>Admin Email</label>
                  <input value={clinicForm.admin_email} onChange={e => setClinicForm(f => ({ ...f, admin_email: e.target.value }))}
                    placeholder="admin@clinic.com" type="email"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid rgba(11,42,74,0.2)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#4b5563", marginBottom: 6 }}>Plan</label>
                  <select value={clinicForm.subscription_plan} onChange={e => setClinicForm(f => ({ ...f, subscription_plan: e.target.value }))}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid rgba(11,42,74,0.2)", fontSize: 13, outline: "none", background: "#fff", boxSizing: "border-box" }}>
                    <option value="starter">Starter</option>
                    <option value="growth">Growth</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#4b5563", marginBottom: 6 }}>Status</label>
                  <select value={clinicForm.subscription_status} onChange={e => setClinicForm(f => ({ ...f, subscription_status: e.target.value }))}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid rgba(11,42,74,0.2)", fontSize: 13, outline: "none", background: "#fff", boxSizing: "border-box" }}>
                    <option value="active">Active</option>
                    <option value="trialing">Trialing</option>
                    <option value="past_due">Past Due</option>
                    <option value="canceled">Canceled</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(11,42,74,0.1)", display: "flex", gap: 10 }}>
              <button onClick={() => setClinicDrawer(false)} style={{ flex: 1, padding: "9px", borderRadius: 9, border: "1px solid rgba(11,42,74,0.15)", background: "transparent", cursor: "pointer", fontSize: 13, color: "#6b7280" }}>Cancel</button>
              <button onClick={saveClinic} disabled={savingClinic || !clinicForm.name.trim()}
                style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", borderRadius: 9, background: "#0B2A4A", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, opacity: savingClinic ? 0.7 : 1 }}>
                {savingClinic ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={13} />}
                {editingClinic ? "Update Clinic" : "Create Clinic"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteTarget && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
          <div style={{ background: "#fff", borderRadius: 16, width: 380, padding: 28, border: "1px solid rgba(220,38,38,0.2)", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <AlertTriangle size={20} color="#dc2626" />
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1C1917", margin: 0 }}>Delete {deleteTarget.type === "chain" ? "Chain" : "Clinic"}</h3>
            </div>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
            </p>
            {deleteTarget.type === "chain" && (
              <p style={{ fontSize: 12, color: "#ea580c", background: "rgba(249,115,22,0.08)", padding: "8px 12px", borderRadius: 8, marginBottom: 16 }}>
                All clinics in this chain will become standalone.
              </p>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: "9px", borderRadius: 9, border: "1px solid #e5e7eb", background: "transparent", cursor: "pointer", fontSize: 13 }}>Cancel</button>
              <button onClick={confirmDelete} disabled={deleting}
                style={{ flex: 1, padding: "9px", borderRadius: 9, background: "#dc2626", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, opacity: deleting ? 0.7 : 1 }}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Clinic Row Sub-component ─────────────────────────────────────────────────

function ClinicRow({
  clinic, isLast, onEdit, onDelete,
}: {
  clinic: Clinic;
  isLast: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const plan = PLAN_COLORS[clinic.subscription_plan ?? ""] ?? { bg: "rgba(120,130,140,0.1)", color: "#6b7280" };
  const status = STATUS_COLORS[clinic.subscription_status ?? ""] ?? { bg: "rgba(120,130,140,0.1)", color: "#6b7280" };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px 12px 44px", borderBottom: isLast ? "none" : "1px solid rgba(11,42,74,0.06)" }}>
      <Building2 size={14} style={{ color: "#9ca3af", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#1C1917", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{clinic.name}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
          {clinic.location && (
            <span style={{ fontSize: 11, color: "#9ca3af", display: "flex", alignItems: "center", gap: 3 }}>
              <MapPin size={9} /> {clinic.location}
            </span>
          )}
          {clinic.admin_email && (
            <span style={{ fontSize: 11, color: "#9ca3af", display: "flex", alignItems: "center", gap: 3 }}>
              <Mail size={9} /> {clinic.admin_email}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {clinic.is_trial && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "rgba(234,179,8,0.12)", color: "#ca8a04", letterSpacing: "0.05em" }}>TRIAL</span>
        )}
        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: plan.bg, color: plan.color, display: "flex", alignItems: "center", gap: 3 }}>
          <CreditCard size={9} /> {clinic.subscription_plan ?? "—"}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: status.bg, color: status.color }}>
          {clinic.subscription_status ?? "—"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <button onClick={onEdit} style={{ padding: "5px 8px", borderRadius: 7, border: "1px solid rgba(11,42,74,0.15)", background: "transparent", cursor: "pointer", color: "#0B2A4A" }}>
          <Edit2 size={12} />
        </button>
        <button onClick={onDelete} style={{ padding: "5px 8px", borderRadius: 7, border: "1px solid rgba(220,38,38,0.2)", background: "transparent", cursor: "pointer", color: "#dc2626" }}>
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
