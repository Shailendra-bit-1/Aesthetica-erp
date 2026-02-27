"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, ChevronRight, Calendar, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import { logAction } from "@/lib/audit";

interface RecentPatient {
  id: string;
  full_name: string;
  primary_concern: string[] | string | null;
  created_at: string;
  clinic_id: string | null;
}

const AVATAR_COLORS = ["#C5A059","#8B7EC8","#7A9E8E","#B07A5A","#9E7A9E","#6B8A9A"];

export default function RecentPatients() {
  const router = useRouter();
  const { profile, activeClinicId, loading: profileLoading } = useClinic();
  const [patients, setPatients] = useState<RecentPatient[]>([]);
  const [loading,  setLoading]  = useState(true);

  const isSuperAdmin = profile?.role === "superadmin";
  const isGlobal     = isSuperAdmin && !activeClinicId;

  useEffect(() => {
    if (profileLoading) return;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("patients")
        .select("id, full_name, primary_concern, created_at, clinic_id")
        .order("created_at", { ascending: false })
        .limit(6);

      if (!isGlobal && activeClinicId) {
        q = q.eq("clinic_id", activeClinicId);
      }

      const { data } = await q;
      setPatients(data ?? []);
      setLoading(false);
    })();
  }, [profile, activeClinicId, profileLoading, isGlobal]);

  function handleOpen(patient: RecentPatient) {
    // HIPAA Audit: log every patient profile navigation from the overview
    logAction({
      action:     "view_patient_profile",
      targetId:   patient.id,
      targetName: patient.full_name,
      metadata:   { source: "overview_recent_patients" },
    });
    router.push(`/patients/${patient.id}`);
  }

  function fmtDate(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const d = Math.floor(diff / 86400000);
    if (d === 0) return "Today";
    if (d === 1) return "Yesterday";
    if (d < 7)  return `${d} days ago`;
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  return (
    <section
      className="rounded-2xl luxury-card overflow-hidden"
      style={{ background: "var(--surface)" }}
    >
      {/* Header */}
      <div
        className="px-6 py-5 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <Users size={18} style={{ color: "var(--gold)" }} />
          <h3
            className="text-lg font-semibold"
            style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}
          >
            Recent Patients
          </h3>
          {isGlobal && (
            <span
              className="text-xs px-2.5 py-0.5 rounded-full font-medium"
              style={{ background: "rgba(197,160,89,0.15)", color: "var(--gold)" }}
            >
              All Clinics
            </span>
          )}
        </div>
        <button
          onClick={() => router.push("/patients")}
          className="text-sm flex items-center gap-1 font-medium transition-opacity hover:opacity-70"
          style={{ color: "var(--gold)" }}
        >
          View all records
          <ChevronRight size={14} />
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={22} style={{ color: "rgba(197,160,89,0.4)", animation: "spin 1s linear infinite" }} />
        </div>
      ) : patients.length === 0 ? (
        <div className="text-center py-14">
          <Sparkles size={28} style={{ color: "rgba(197,160,89,0.3)", margin: "0 auto 12px" }} />
          <p style={{ color: "var(--text-muted)", fontFamily: "Georgia, serif", fontSize: 14 }}>
            No patients registered yet
          </p>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {patients.map((p, i) => {
            const initials = p.full_name.split(" ").map(n => n[0]).slice(0, 2).join("");
            const concern  = Array.isArray(p.primary_concern)
              ? (p.primary_concern[0] ?? null)
              : (p.primary_concern?.split(",")[0].trim() ?? null);
            return (
              <div
                key={p.id}
                onClick={() => handleOpen(p)}
                className="px-6 py-4 flex items-center gap-4 hover:bg-stone-50 transition-colors cursor-pointer group"
              >
                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                >
                  {initials}
                </div>

                {/* Name + concern */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}
                  >
                    {p.full_name}
                  </p>
                  {concern && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block"
                      style={{
                        background: "rgba(197,160,89,0.08)",
                        color: "#7A5C14",
                        border: "1px solid rgba(197,160,89,0.2)",
                      }}
                    >
                      {concern}
                    </span>
                  )}
                </div>

                {/* Date */}
                <span
                  className="text-xs flex items-center gap-1.5 flex-shrink-0"
                  style={{ color: "var(--text-muted)" }}
                >
                  <Calendar size={10} />
                  {fmtDate(p.created_at)}
                </span>

                {/* Arrow */}
                <ChevronRight
                  size={16}
                  className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  style={{ color: "var(--gold)" }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div
        className="px-6 py-3"
        style={{ borderTop: "1px solid var(--border)", background: "var(--surface-warm)" }}
      >
        <button
          onClick={() => router.push("/patients")}
          className="w-full text-sm font-medium py-2 rounded-xl transition-all duration-200 hover:opacity-90"
          style={{
            background: "linear-gradient(135deg, #C5A059, #A8853A)",
            color: "white",
            fontFamily: "Georgia, serif",
          }}
        >
          Open Patient Records
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
