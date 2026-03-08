"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import { logAction } from "@/lib/audit";
import {
  Users, Search, ChevronRight, Sparkles, Phone, Mail, Calendar, Eye, EyeOff,
  AlertTriangle, Stethoscope, Building2, UserPlus, SlidersHorizontal, X, Merge,
} from "lucide-react";
import NewPatientModal from "@/components/NewPatientModal";
import MergePatientModal from "@/components/MergePatientModal";
import { TableRowSkeleton } from "@/components/ui";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

interface Patient {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  primary_concern: string[] | null;
  created_at: string;
  date_of_birth: string | null;
  allergies: string[] | null;
  fitzpatrick_type: number | null;
  preferred_provider: string | null;
  patient_tier: string | null;
}

const TIER_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  vip:       { label: "VIP",      bg: "rgba(197,160,89,0.15)", color: "#8B6914" },
  hni:       { label: "HNI",      bg: "rgba(124,58,237,0.12)", color: "#7C3AED" },
  regular:   { label: "Regular",  bg: "rgba(107,114,128,0.1)", color: "#6B7280" },
  at_risk:   { label: "At Risk",  bg: "rgba(220,38,38,0.1)",   color: "#DC2626" },
};

// ── PHI masking helpers ───────────────────────────────────────────────────────

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "••••••••";
  return `+•• ••••••${digits.slice(-2)}`;
}

function maskEmail(email: string | null): string {
  if (!email) return "—";
  const [local, domain] = email.split("@");
  if (!domain || local.length === 0) return "•••@•••";
  return `${local[0]}•••@${domain}`;
}

function calcAge(dob: string | null): string {
  if (!dob) return "";
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() - d.getMonth() < 0 || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return `${age}y`;
}

const FST_LABEL = ["", "I", "II", "III", "IV", "V", "VI"];

// ─────────────────────────────────────────────────────────────────────────────

export default function PatientsPage() {
  const router = useRouter();
  const { profile, activeClinicId, loading: profileLoading } = useClinic();
  const isAdmin = ["superadmin", "chain_admin", "clinic_admin"].includes(profile?.role ?? "");

  const [patients,    setPatients]    = useState<Patient[]>([]);
  const [query,       setQuery]       = useState("");
  const [loading,     setLoading]     = useState(true);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [filterTab,   setFilterTab]   = useState<"all" | "allergy">("all");
  const [modalOpen,   setModalOpen]   = useState(false);
  const [mergeOpen,   setMergeOpen]   = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterConcern,  setFilterConcern]  = useState("");
  const [filterRegistered, setFilterRegistered] = useState<"" | "30d" | "90d" | "180d">("");

  // Fetch patients
  useEffect(() => {
    if (profileLoading) return;
    if (!activeClinicId) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("patients")
        .select(`
          id, full_name, email, phone, primary_concern, created_at,
          date_of_birth, allergies, fitzpatrick_type, patient_tier,
          provider:profiles!preferred_provider_id(full_name)
        `)
        .eq("clinic_id", activeClinicId)
        .order("created_at", { ascending: false })
        .limit(300);

      setPatients(
        (data ?? []).map((p: Record<string, unknown>) => ({
          ...(p as Omit<Patient, "preferred_provider">),
          preferred_provider: (p.provider as { full_name: string } | null)?.full_name ?? null,
        }))
      );
      setLoading(false);
    })();
  }, [profile, activeClinicId, profileLoading]);

  function toggleReveal(id: string, name: string, e: React.MouseEvent) {
    e.stopPropagation();
    const alreadyRevealed = revealedIds.has(id);
    setRevealedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    if (!alreadyRevealed) {
      logAction({ action: "reveal_contact_details", targetId: id, targetName: name, metadata: { page: "patient_list" } });
    }
  }

  // Stats
  const firstOfMonth = useMemo(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const stats = useMemo(() => ({
    total:     patients.length,
    newMonth:  patients.filter(p => p.created_at >= firstOfMonth).length,
    allergies: patients.filter(p => (p.allergies?.filter(Boolean).length ?? 0) > 0).length,
  }), [patients, firstOfMonth]);

  // Keyboard shortcut: N → New Patient
  useKeyboardShortcuts({ onNewPatient: () => setModalOpen(true) });

  // Unique concerns for filter dropdown
  const allConcerns = useMemo(() => {
    const seen = new Set<string>();
    patients.forEach(p => p.primary_concern?.[0] && seen.add(p.primary_concern[0]));
    return Array.from(seen).sort();
  }, [patients]);

  // Filter + search
  const filtered = useMemo(() => {
    const cutoff = filterRegistered
      ? new Date(Date.now() - parseInt(filterRegistered) * 86400000).toISOString()
      : null;
    return patients.filter(p => {
      if (filterTab === "allergy" && !(p.allergies?.filter(Boolean).length)) return false;
      if (filterConcern && p.primary_concern?.[0] !== filterConcern) return false;
      if (cutoff && p.created_at < cutoff) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        p.full_name.toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q) ||
        p.phone.includes(q)
      );
    });
  }, [patients, query, filterTab, filterConcern, filterRegistered]);

  return (
    <div className="min-h-full" style={{ background: "var(--background)" }}>

      <div className="px-6 py-6 max-w-[1440px] mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(197,160,89,0.12)", border: "1px solid rgba(197,160,89,0.25)" }}
            >
              <Users size={18} style={{ color: "var(--gold)" }} />
            </div>
            <div>
              <h1 className="text-xl font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1C1917" }}>
                Patient Records
              </h1>
              <p className="text-xs mt-0.5" style={{ color: "#9C9584" }}>
                {patients.length} patient{patients.length !== 1 ? "s" : ""} on record
                {revealedIds.size > 0 && (
                  <span style={{ color: "#C5A059", marginLeft: 8 }}>
                    · {revealedIds.size} contact{revealedIds.size !== 1 ? "s" : ""} revealed
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* HIPAA notice */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "rgba(197,160,89,0.06)", border: "1px solid rgba(197,160,89,0.18)" }}>
              <EyeOff size={11} style={{ color: "#9C9584" }} />
              <span style={{ fontSize: 10, color: "#9C9584", fontFamily: "Georgia, serif" }}>
                Contact details masked · Click <strong style={{ color: "#C5A059" }}>View</strong> to reveal
              </span>
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#9C9584" }} />
              <input
                type="text"
                placeholder="Search by name, email, or phone…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "white", border: "1px solid rgba(197,160,89,0.25)", color: "#1C1917", width: 260, fontFamily: "Georgia, serif" }}
              />
            </div>

            {/* Merge / New Patient */}
            {isAdmin && (
              <>
                <button
                  onClick={() => setMergeOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "var(--surface)", color: "var(--primary)", border: "1px solid var(--primary)" }}
                >
                  <Merge size={14} /> Merge
                </button>
                <button
                  onClick={() => setModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "var(--primary)", color: "#fff" }}
                >
                  <UserPlus size={15} /> New Patient
                </button>
              </>
            )}
          </div>
        </div>

        {/* No-clinic empty state */}
        {!profileLoading && !activeClinicId && (
          <div className="card" style={{ padding: "64px 24px", textAlign: "center", border: "1px dashed rgba(197,160,89,0.3)" }}>
            <Building2 size={36} className="mx-auto mb-3" style={{ color: "rgba(197,160,89,0.4)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              Select a clinic from the top bar to view patients
            </p>
          </div>
        )}

        {activeClinicId && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Total Patients", value: stats.total,     Icon: Users,          color: "#C5A059", bg: "rgba(197,160,89,0.08)" },
                { label: "New This Month", value: stats.newMonth,  Icon: UserPlus,       color: "#4A8A4A", bg: "rgba(74,138,74,0.08)"  },
                { label: "Allergy Flags",  value: stats.allergies, Icon: AlertTriangle,  color: "#D97706", bg: "#FFFBEB"               },
              ].map(c => (
                <div key={c.label} className="kpi-card">
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{c.label}</p>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: c.bg }}>
                      <c.Icon size={16} style={{ color: c.color }} />
                    </div>
                  </div>
                  {loading ? (
                    <div className="skeleton" style={{ height: 28, width: 48, borderRadius: "var(--radius-md)" }} />
                  ) : (
                    <p className="text-2xl font-bold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-serif)" }}>{c.value}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Filter tabs + advanced filter button */}
            <div className="flex items-center gap-2 flex-wrap">
              {([
                { key: "all",     label: `All (${patients.length})`               },
                { key: "allergy", label: `⚠ Allergy Flags (${stats.allergies})`  },
              ] as const).map(t => (
                <button
                  key={t.key}
                  onClick={() => setFilterTab(t.key)}
                  className="px-4 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={{
                    background: filterTab === t.key ? "rgba(197,160,89,0.15)" : "white",
                    border:     `1px solid ${filterTab === t.key ? "rgba(197,160,89,0.4)" : "rgba(197,160,89,0.2)"}`,
                    color:      filterTab === t.key ? "#8B6914" : "#9C9584",
                  }}
                >
                  {t.label}
                </button>
              ))}
              <button onClick={() => setShowFilters(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ml-auto"
                style={{
                  background: (showFilters || filterConcern || filterRegistered) ? "rgba(197,160,89,0.15)" : "white",
                  border: `1px solid ${(filterConcern || filterRegistered) ? "rgba(197,160,89,0.5)" : "rgba(197,160,89,0.2)"}`,
                  color: (filterConcern || filterRegistered) ? "#8B6914" : "#9C9584",
                }}>
                <SlidersHorizontal size={11} />
                Filters{(filterConcern || filterRegistered) ? " •" : ""}
              </button>
            </div>

            {/* M13: Advanced filter panel */}
            {showFilters && (
              <div className="flex flex-wrap gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(197,160,89,0.05)", border: "1px solid rgba(197,160,89,0.15)" }}>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium" style={{ color: "#9C9584" }}>Primary Concern</label>
                  <select value={filterConcern} onChange={e => setFilterConcern(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg text-xs outline-none"
                    style={{ border: "1px solid rgba(197,160,89,0.3)", background: "#fff", color: "#1C1917", minWidth: 140 }}>
                    <option value="">All concerns</option>
                    {allConcerns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium" style={{ color: "#9C9584" }}>Registered</label>
                  <select value={filterRegistered} onChange={e => setFilterRegistered(e.target.value as "" | "30d" | "90d" | "180d")}
                    className="px-2.5 py-1.5 rounded-lg text-xs outline-none"
                    style={{ border: "1px solid rgba(197,160,89,0.3)", background: "#fff", color: "#1C1917", minWidth: 120 }}>
                    <option value="">Any time</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="180d">Last 180 days</option>
                  </select>
                </div>
                {(filterConcern || filterRegistered) && (
                  <button onClick={() => { setFilterConcern(""); setFilterRegistered(""); }}
                    className="self-end flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                    style={{ border: "1px solid rgba(220,38,38,0.25)", background: "rgba(220,38,38,0.05)", color: "#B43C3C" }}>
                    <X size={10} /> Clear
                  </button>
                )}
                <span className="self-end ml-auto text-xs" style={{ color: "#9C9584" }}>
                  Showing {filtered.length} of {patients.length}
                </span>
              </div>
            )}

            {/* Table */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="ae-table">
                <thead>
                  <tr>
                    {["Patient", "Contact", "Primary Concern", "Provider", "Registered", ""].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center">
                        <Sparkles size={28} style={{ color: "rgba(197,160,89,0.3)", margin: "0 auto 12px" }} />
                        <p style={{ color: "#9C9584", fontFamily: "Georgia, serif" }}>
                          {query
                            ? "No patients match your search."
                            : filterTab === "allergy"
                            ? "No patients with allergy flags."
                            : "No patients on record yet."}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p, idx) => {
                      const revealed    = revealedIds.has(p.id);
                      const hasAllergy  = (p.allergies?.filter(Boolean).length ?? 0) > 0;
                      const age         = calcAge(p.date_of_birth);
                      const fst         = p.fitzpatrick_type ? FST_LABEL[p.fitzpatrick_type] : null;
                      return (
                        <tr
                          key={p.id}
                          className="group hover:bg-amber-50/30 transition-colors cursor-pointer"
                          style={{ borderTop: idx > 0 ? "1px solid rgba(197,160,89,0.07)" : "none" }}
                          onClick={() => router.push(`/patients/${p.id}`)}
                        >
                          {/* Patient */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="relative flex-shrink-0">
                                <div
                                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                                  style={{ background: "rgba(197,160,89,0.15)", color: "var(--gold)" }}
                                >
                                  {p.full_name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                                </div>
                                {hasAllergy && (
                                  <div
                                    className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                                    style={{ background: "#E85555", border: "2px solid white" }}
                                  >
                                    <span style={{ fontSize: 7, color: "white", fontWeight: 900 }}>!</span>
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium block" style={{ color: "#1C1917", fontFamily: "Georgia, serif" }}>
                                    {p.full_name}
                                  </span>
                                  {p.patient_tier && TIER_BADGE[p.patient_tier] && (
                                    <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: TIER_BADGE[p.patient_tier].bg, color: TIER_BADGE[p.patient_tier].color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                      {TIER_BADGE[p.patient_tier].label}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  {age && (
                                    <span className="text-xs" style={{ color: "#9C9584" }}>{age}</span>
                                  )}
                                  {fst && (
                                    <span
                                      className="text-xs px-1.5 py-px rounded"
                                      style={{ background: "rgba(197,160,89,0.08)", color: "#9C9584", fontSize: 10 }}
                                    >
                                      FST {fst}
                                    </span>
                                  )}
                                  {hasAllergy && (
                                    <span className="flex items-center gap-0.5" style={{ fontSize: 10, color: "#B43C3C" }}>
                                      <AlertTriangle size={9} />
                                      {p.allergies!.filter(Boolean).slice(0, 2).join(", ")}
                                      {(p.allergies!.filter(Boolean).length ?? 0) > 2 && ` +${p.allergies!.filter(Boolean).length - 2}`}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Contact */}
                          <td className="px-5 py-3.5">
                            <div className="flex flex-col gap-0.5">
                              <span
                                className="flex items-center gap-1.5 text-xs"
                                style={{ color: revealed ? "#6B6358" : "#B8AE9C", fontFamily: revealed ? "Georgia, serif" : "monospace" }}
                              >
                                <Phone size={10} />
                                {revealed ? p.phone : maskPhone(p.phone)}
                              </span>
                              <span
                                className="flex items-center gap-1.5 text-xs"
                                style={{ color: revealed ? "#9C9584" : "#B8AE9C", fontFamily: revealed ? "Georgia, serif" : "monospace" }}
                              >
                                <Mail size={10} />
                                {revealed ? (p.email ?? "—") : maskEmail(p.email)}
                              </span>
                            </div>
                          </td>

                          {/* Concern */}
                          <td className="px-5 py-3.5">
                            {p.primary_concern?.[0] ? (
                              <span className="badge badge-gold">{p.primary_concern[0]}</span>
                            ) : (
                              <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
                            )}
                          </td>

                          {/* Provider */}
                          <td className="px-5 py-3.5">
                            {p.preferred_provider ? (
                              <span className="flex items-center gap-1.5 text-xs" style={{ color: "#6B6358" }}>
                                <Stethoscope size={10} style={{ color: "#C5A059" }} />
                                {p.preferred_provider}
                              </span>
                            ) : (
                              <span className="text-xs" style={{ color: "#B8AE9C" }}>—</span>
                            )}
                          </td>

                          {/* Registered */}
                          <td className="px-5 py-3.5">
                            <span className="flex items-center gap-1.5 text-xs" style={{ color: "#9C9584" }}>
                              <Calendar size={10} />
                              {new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={e => toggleReveal(p.id, p.full_name, e)}
                                title={revealed ? "Hide contact details" : "View contact details"}
                                style={{
                                  display: "flex", alignItems: "center", gap: 4,
                                  padding: "3px 9px", borderRadius: 7,
                                  border: `1px solid ${revealed ? "rgba(197,160,89,0.45)" : "rgba(197,160,89,0.2)"}`,
                                  background: revealed ? "rgba(197,160,89,0.1)" : "transparent",
                                  cursor: "pointer", fontSize: 10, fontWeight: 600,
                                  color: revealed ? "#C5A059" : "#9C9584",
                                  transition: "all 0.15s",
                                }}
                              >
                                {revealed ? <><EyeOff size={9} /> Hide</> : <><Eye size={9} /> View</>}
                              </button>
                              <ChevronRight
                                size={14}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ color: "var(--gold)" }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* New Patient Modal */}
      {modalOpen && <NewPatientModal isOpen={modalOpen} onClose={() => { setModalOpen(false); }} />}

      {/* D7: Merge Patients Modal */}
      {mergeOpen && activeClinicId && (
        <MergePatientModal
          clinicId={activeClinicId}
          onClose={() => setMergeOpen(false)}
          onSuccess={() => { setMergeOpen(false); /* reload */ }}
        />
      )}
    </div>
  );
}
