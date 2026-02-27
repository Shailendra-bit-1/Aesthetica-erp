"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import { logAction } from "@/lib/audit";
import { Users, Search, ChevronRight, Sparkles, Phone, Mail, Calendar, Eye, EyeOff } from "lucide-react";
import TopBar from "@/components/TopBar";

interface Patient {
  id: string; full_name: string; email: string | null; phone: string;
  primary_concern: string[] | null; created_at: string;
}

// ── PHI masking helpers ───────────────────────────────────────────────────────

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "••••••••";
  const last2 = digits.slice(-2);
  return `+•• ••••••${last2}`;
}

function maskEmail(email: string | null): string {
  if (!email) return "—";
  const [local, domain] = email.split("@");
  if (!domain || local.length === 0) return "•••@•••";
  return `${local[0]}•••@${domain}`;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function PatientsPage() {
  const router = useRouter();
  const { profile, activeClinicId, loading: profileLoading } = useClinic();

  const [patients,    setPatients]    = useState<Patient[]>([]);
  const [query,       setQuery]       = useState("");
  const [loading,     setLoading]     = useState(true);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  // Fetch patients scoped by clinic
  useEffect(() => {
    if (profileLoading) return; // wait for profile
    (async () => {
      setLoading(true);
      let q = supabase
        .from("patients")
        .select("id, full_name, email, phone, primary_concern, created_at")
        .order("created_at", { ascending: false })
        .limit(200);

      // Non-superadmins see only their clinic's patients
      // Superadmins see all clinics, or a single clinic when switcher is active
      if (profile?.role !== "superadmin" && activeClinicId) {
        q = q.eq("clinic_id", activeClinicId);
      } else if (profile?.role === "superadmin" && activeClinicId) {
        q = q.eq("clinic_id", activeClinicId);
      }

      const { data } = await q;
      setPatients(data ?? []);
      setLoading(false);
    })();
  }, [profile, activeClinicId, profileLoading]);

  function toggleReveal(id: string, name: string, e: React.MouseEvent) {
    e.stopPropagation(); // don't navigate to EMR
    const alreadyRevealed = revealedIds.has(id);
    setRevealedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    // HIPAA Audit: log every contact-detail reveal
    if (!alreadyRevealed) {
      logAction({
        action:     "reveal_contact_details",
        targetId:   id,
        targetName: name,
        metadata:   { page: "patient_list" },
      });
    }
  }

  const filtered = patients.filter(p =>
    p.full_name.toLowerCase().includes(query.toLowerCase()) ||
    p.email?.toLowerCase().includes(query.toLowerCase()) ||
    p.phone.includes(query)
  );

  return (
    <div className="min-h-full" style={{ background: "var(--background)" }}>
      <TopBar />
      <div className="px-8 py-6">

        {/* Hero */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(197,160,89,0.12)", border: "1px solid rgba(197,160,89,0.25)" }}>
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

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* HIPAA notice */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "rgba(197,160,89,0.06)", border: "1px solid rgba(197,160,89,0.18)" }}>
              <EyeOff size={11} style={{ color: "#9C9584" }} />
              <span style={{ fontSize: 10, color: "#9C9584", fontFamily: "Georgia, serif" }}>Contact details masked · Click <strong style={{ color: "#C5A059" }}>View</strong> to reveal</span>
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
                style={{ background: "white", border: "1px solid rgba(197,160,89,0.25)", color: "#1C1917", width: 280, fontFamily: "Georgia, serif" }}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid rgba(197,160,89,0.15)", boxShadow: "0 1px 4px rgba(28,25,23,0.05)" }}>
          <table className="w-full">
            <thead>
              <tr style={{ background: "rgba(249,247,242,0.8)" }}>
                {["Patient", "Contact", "Primary Concern", "Registered", ""].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs uppercase tracking-widest font-medium" style={{ color: "#9C9584" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "rgba(197,160,89,0.07)" }}>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {[140, 100, 90, 80, 20].map((w, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 rounded animate-pulse" style={{ background: "rgba(197,160,89,0.07)", width: w }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <Sparkles size={28} style={{ color: "rgba(197,160,89,0.3)", margin: "0 auto 12px" }} />
                    <p style={{ color: "#9C9584", fontFamily: "Georgia, serif" }}>
                      {query ? "No patients match your search." : "No patients on record yet."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map(p => {
                  const revealed = revealedIds.has(p.id);
                  return (
                    <tr
                      key={p.id}
                      className="group hover:bg-amber-50/30 transition-colors cursor-pointer"
                      onClick={() => router.push(`/patients/${p.id}`)}
                    >
                      {/* Name — always visible */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: "rgba(197,160,89,0.15)", color: "var(--gold)" }}
                          >
                            {p.full_name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                          </div>
                          <span className="text-sm font-medium" style={{ color: "#1C1917", fontFamily: "Georgia, serif" }}>
                            {p.full_name}
                          </span>
                        </div>
                      </td>

                      {/* Contact — MASKED unless revealed */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1.5 text-xs" style={{ color: revealed ? "#6B6358" : "#B8AE9C", fontFamily: revealed ? "Georgia, serif" : "monospace" }}>
                            <Phone size={10} />
                            {revealed ? p.phone : maskPhone(p.phone)}
                          </span>
                          {(revealed ? p.email : true) && (
                            <span className="flex items-center gap-1.5 text-xs" style={{ color: revealed ? "#9C9584" : "#B8AE9C", fontFamily: revealed ? "Georgia, serif" : "monospace" }}>
                              <Mail size={10} />
                              {revealed ? (p.email ?? "—") : maskEmail(p.email)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Concern */}
                      <td className="px-6 py-4">
                        {p.primary_concern?.[0] ? (
                          <span
                            className="text-xs px-2.5 py-1 rounded-full"
                            style={{ background: "rgba(197,160,89,0.08)", color: "#7A5C14", border: "1px solid rgba(197,160,89,0.2)" }}
                          >
                            {p.primary_concern[0]}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: "#B8AE9C" }}>—</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-1.5 text-xs" style={{ color: "#9C9584" }}>
                          <Calendar size={10} />
                          {new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </td>

                      {/* View / Hide + Arrow */}
                      <td className="px-6 py-4">
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
                            {revealed
                              ? <><EyeOff size={9} /> Hide</>
                              : <><Eye size={9} /> View</>
                            }
                          </button>
                          <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--gold)" }} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
