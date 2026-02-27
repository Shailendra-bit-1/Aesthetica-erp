"use client";

import { useEffect, useState } from "react";
import { Users, CalendarCheck, TrendingUp, Building2, Loader2, Globe } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";

interface DashStats {
  totalPatients:       number;
  newThisMonth:        number;
  sessionsThisMonth:   number;
  fourthValue:         number;   // activeClinics for superadmin global, proposedRevenue for others
  fourthLabel:         string;
  fourthIcon:          "clinics" | "revenue";
  isGlobal:            boolean;
}

function monthStart(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function StatsRow() {
  const { profile, activeClinicId, loading: profileLoading } = useClinic();
  const [stats,   setStats]   = useState<DashStats | null>(null);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = profile?.role === "superadmin";
  // Global view: superadmin with no specific clinic selected
  const isGlobal = isSuperAdmin && !activeClinicId;

  useEffect(() => {
    if (profileLoading) return;

    (async () => {
      setLoading(true);
      const iso = monthStart();

      // Build queries — scoped unless global superadmin view
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scope = (q: any) =>
        !isGlobal && activeClinicId ? q.eq("clinic_id", activeClinicId) : q;

      const [totRes, monRes, encRes, fourthRes] = await Promise.all([
        // 1. Total patients
        scope(supabase.from("patients").select("id", { count: "exact", head: true })),

        // 2. New patients this month
        scope(
          supabase
            .from("patients")
            .select("id", { count: "exact", head: true })
            .gte("created_at", iso)
        ),

        // 3. Clinical sessions this month
        scope(
          supabase
            .from("clinical_encounters")
            .select("id", { count: "exact", head: true })
            .gte("created_at", iso)
        ),

        // 4. Active clinics (superadmin global) OR proposed treatment count (clinic view)
        isGlobal
          ? supabase
              .from("clinics")
              .select("id", { count: "exact", head: true })
              .eq("subscription_status", "active")
          : scope(
              supabase
                .from("patient_treatments")
                .select("id", { count: "exact", head: true })
                .eq("status", "proposed")
            ),
      ]);

      setStats({
        totalPatients:     totRes.count     ?? 0,
        newThisMonth:      monRes.count     ?? 0,
        sessionsThisMonth: encRes.count     ?? 0,
        fourthValue:       fourthRes.count  ?? 0,
        fourthLabel:       isGlobal ? "Active Clinics" : "Proposed Treatments",
        fourthIcon:        isGlobal ? "clinics" : "revenue",
        isGlobal,
      });
      setLoading(false);
    })();
  }, [profile, activeClinicId, profileLoading, isGlobal]);

  const cards = stats
    ? [
        {
          label:    "Total Patients",
          value:    stats.totalPatients.toLocaleString(),
          change:   stats.newThisMonth > 0 ? `+${stats.newThisMonth} this month` : "No new this month",
          positive: stats.newThisMonth > 0,
          icon:     Users,
          color:    "#C5A059",
        },
        {
          label:    "New This Month",
          value:    stats.newThisMonth.toLocaleString(),
          change:   new Date().toLocaleString("en-US", { month: "long", year: "numeric" }),
          positive: true,
          icon:     CalendarCheck,
          color:    "#8B9E7A",
        },
        {
          label:    "Clinical Sessions",
          value:    stats.sessionsThisMonth.toLocaleString(),
          change:   "SOAP notes this month",
          positive: stats.sessionsThisMonth > 0,
          icon:     TrendingUp,
          color:    "#7A8E9E",
        },
        {
          label:    stats.fourthLabel,
          value:    stats.fourthValue.toLocaleString(),
          change:   stats.isGlobal ? "Across all registered clinics" : "In proposed pipeline",
          positive: true,
          icon:     stats.fourthIcon === "clinics" ? Building2 : TrendingUp,
          color:    "#C5A059",
        },
      ]
    : null;

  return (
    <div>
      {/* Global View banner for superadmin */}
      {isGlobal && (
        <div
          className="flex items-center gap-2 mb-4 px-4 py-2 rounded-xl w-fit"
          style={{
            background: "rgba(197,160,89,0.1)",
            border: "1px solid rgba(197,160,89,0.3)",
          }}
        >
          <Globe size={13} style={{ color: "#C5A059" }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#8B6914", fontFamily: "Georgia, serif" }}>
            Global View — combined stats across all clinics
          </span>
        </div>
      )}

      <div className="grid grid-cols-4 gap-5 pt-2">
        {loading || !cards
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="luxury-card rounded-2xl p-5 flex items-center justify-center"
                style={{ background: "var(--surface)", minHeight: 112 }}
              >
                <Loader2 size={20} style={{ color: "rgba(197,160,89,0.4)", animation: "spin 1s linear infinite" }} />
              </div>
            ))
          : cards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="luxury-card rounded-2xl p-5"
                  style={{ background: "var(--surface)" }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${stat.color}18` }}
                    >
                      <Icon size={18} style={{ color: stat.color }} />
                    </div>
                    <span
                      className="text-xs px-2 py-1 rounded-full font-medium"
                      style={{
                        background: stat.positive ? "rgba(139,158,122,0.12)" : "rgba(180,80,80,0.12)",
                        color:      stat.positive ? "#6B8A5A"                : "#B45050",
                        maxWidth:   120,
                        textAlign:  "right",
                        lineHeight: 1.4,
                      }}
                    >
                      {stat.change}
                    </span>
                  </div>
                  <p
                    className="text-2xl font-bold mb-1"
                    style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}
                  >
                    {stat.value}
                  </p>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    {stat.label}
                  </p>
                </div>
              );
            })}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
