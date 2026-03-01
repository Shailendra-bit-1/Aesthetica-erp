"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  IndianRupee, TrendingUp, Users, Calendar, Building2, Globe,
  RefreshCw, CheckCircle2, XCircle, Loader2, Award,
  Target, BarChart3, Clock, ArrowUpRight, ArrowDownRight,
  Stethoscope, Crown, Network, PhoneOff, AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import TopBar from "@/components/TopBar";

// ─────────────────────────────────────── Types ───────────────────────────────

type DateRange = "7d" | "30d" | "90d" | "1y";

interface Invoice {
  clinic_id:    string | null;
  total_amount: number | null;
  amount:       number | null;
  status:       string;
  payment_mode: string | null;
  service_name: string | null;
  provider_name:string | null;
  created_at:   string;
}
interface Patient  { clinic_id: string | null; created_at: string }
interface Appt     { clinic_id: string | null; status: string; start_time: string; service_name: string | null }
interface ClinicRow{ id: string; name: string; chain_id: string | null; subscription_status: string }

interface Bucket   { label: string; key: string; start: Date; end: Date }

// ─────────────────────────────────────── Helpers ─────────────────────────────

function fmt(n: number): string {
  if (n >= 1000000) return `₹${(n / 1000000).toFixed(1)}M`;
  if (n >= 100000)  return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)    return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
function fmtShort(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 100000)  return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)    return `${(n / 1000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

function generateBuckets(range: DateRange): Bucket[] {
  const now = new Date();
  const buckets: Bucket[] = [];

  if (range === "7d") {
    for (let i = 6; i >= 0; i--) {
      const s = new Date(now); s.setDate(s.getDate() - i); s.setHours(0, 0, 0, 0);
      const e = new Date(s); e.setHours(23, 59, 59, 999);
      buckets.push({
        label: s.toLocaleDateString("en-GB", { weekday: "short" }),
        key: s.toISOString().slice(0, 10), start: s, end: e,
      });
    }
  } else if (range === "30d") {
    for (let i = 5; i >= 0; i--) {
      const e = new Date(now); e.setDate(e.getDate() - i * 5); e.setHours(23, 59, 59, 999);
      const s = new Date(e); s.setDate(s.getDate() - 4); s.setHours(0, 0, 0, 0);
      buckets.push({ label: s.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), key: `w${i}`, start: s, end: e });
    }
  } else if (range === "90d") {
    for (let i = 11; i >= 0; i--) {
      const e = new Date(now); e.setDate(e.getDate() - i * 7); e.setHours(23, 59, 59, 999);
      const s = new Date(e); s.setDate(s.getDate() - 6); s.setHours(0, 0, 0, 0);
      buckets.push({ label: s.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), key: `w${i}`, start: s, end: e });
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const s = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const e = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      buckets.push({ label: s.toLocaleDateString("en-GB", { month: "short" }), key: `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}`, start: s, end: e });
    }
  }
  return buckets;
}

function fillBuckets(items: { date: string; value: number }[], buckets: Bucket[]): number[] {
  return buckets.map(b => {
    const bs = b.start.getTime(), be = b.end.getTime();
    return items
      .filter(i => { const t = new Date(i.date).getTime(); return t >= bs && t <= be; })
      .reduce((s, i) => s + i.value, 0);
  });
}

function rangeStart(range: DateRange): Date {
  const d = new Date();
  if (range === "7d")  d.setDate(d.getDate() - 7);
  if (range === "30d") d.setDate(d.getDate() - 30);
  if (range === "90d") d.setDate(d.getDate() - 90);
  if (range === "1y")  d.setFullYear(d.getFullYear() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function prevRangeStart(range: DateRange): Date {
  const d = rangeStart(range);
  if (range === "7d")  d.setDate(d.getDate() - 7);
  if (range === "30d") d.setDate(d.getDate() - 30);
  if (range === "90d") d.setDate(d.getDate() - 90);
  if (range === "1y")  d.setFullYear(d.getFullYear() - 1);
  return d;
}

// ─────────────────────────────────────── SVG Charts ──────────────────────────

function BarChart({ data, color = "#C5A059", label = "Revenue" }: {
  data: { label: string; value: number }[]; color?: string; label?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <EmptyChart />;
  const max = Math.max(...data.map(d => d.value), 1);
  const W = 600, H = 180, PL = 48, PB = 28, PT = 10;
  const cW = W - PL, cH = H - PB - PT;
  const gap = cW / data.length;
  const bW  = gap * 0.6;
  const grids = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div style={{ position: "relative" }}>
      {hover !== null && data[hover] && (
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", background: "#1C1917", color: "white", padding: "4px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, zIndex: 10, pointerEvents: "none", whiteSpace: "nowrap", fontFamily: "Georgia, serif" }}>
          {data[hover].label}: {label === "Revenue" ? fmt(data[hover].value) : data[hover].value.toLocaleString()}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 180 }}>
        {grids.map((g, i) => {
          const y = PT + cH * (1 - g);
          return (
            <g key={i}>
              <line x1={PL} y1={y} x2={W} y2={y} stroke="rgba(197,160,89,0.1)" strokeWidth={0.5} />
              <text x={PL - 5} y={y + 3.5} textAnchor="end" fontSize={9} fill="#B8AE9C">{g > 0 ? fmtShort(max * g) : ""}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const bH  = Math.max(2, cH * (d.value / max));
          const x   = PL + gap * i + (gap - bW) / 2;
          const y   = PT + cH - bH;
          const isH = hover === i;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
              <defs>
                <linearGradient id={`bg${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={isH ? 1 : 0.85} />
                  <stop offset="100%" stopColor={color} stopOpacity={isH ? 0.7 : 0.4} />
                </linearGradient>
              </defs>
              <rect x={x} y={y} width={bW} height={bH} rx={3} fill={`url(#bg${i})`} />
              <text x={x + bW / 2} y={H - 4} textAnchor="middle" fontSize={8.5} fill={isH ? color : "#9C9584"}>{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function AreaChart({ data, color = "#059669" }: { data: { label: string; value: number }[]; color?: string }) {
  if (data.length < 2) return <EmptyChart />;
  const max = Math.max(...data.map(d => d.value), 1);
  const W = 600, H = 180, PL = 40, PB = 28, PT = 10;
  const cW = W - PL, cH = H - PB - PT;
  const n = data.length;
  const pts = data.map((d, i) => ({ x: PL + (i / (n - 1)) * cW, y: PT + cH * (1 - d.value / max) }));
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${pts[n - 1].x},${PT + cH} L${PL},${PT + cH} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 180 }}>
      <defs>
        <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((g, i) => (
        <line key={i} x1={PL} y1={PT + cH * (1 - g)} x2={W} y2={PT + cH * (1 - g)} stroke="rgba(5,150,105,0.1)" strokeWidth={0.5} />
      ))}
      <path d={areaPath} fill="url(#area-fill)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill={color} stroke="white" strokeWidth={1.5} />
          <text x={p.x} y={H - 4} textAnchor="middle" fontSize={8.5} fill="#9C9584">{data[i].label}</text>
        </g>
      ))}
    </svg>
  );
}

function DonutChart({ segments, title }: {
  segments: { label: string; value: number; color: string }[];
  title?: string;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return <EmptyChart small />;

  let acc = 0;
  const stops = segments.map(seg => {
    const pct = (seg.value / total) * 100;
    const s = acc, e = acc + pct;
    acc += pct;
    return `${seg.color} ${s.toFixed(1)}% ${e.toFixed(1)}%`;
  });

  return (
    <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
      <div style={{ position: "relative", width: 120, height: 120, flexShrink: 0 }}>
        <div style={{
          width: "100%", height: "100%", borderRadius: "50%",
          background: `conic-gradient(${stops.join(", ")})`,
        }} />
        <div style={{
          position: "absolute", inset: "22%", borderRadius: "50%", background: "white",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#1C1917", fontFamily: "Georgia, serif", lineHeight: 1 }}>{total.toLocaleString()}</span>
          {title && <span style={{ fontSize: 9, color: "#9C9584", textAlign: "center", marginTop: 2 }}>{title}</span>}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        {segments.map(seg => (
          <div key={seg.label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "#5C5447", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{seg.label}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#1C1917", marginLeft: 4 }}>
              {total > 0 ? Math.round((seg.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HBar({ items, valueLabel = "Revenue" }: {
  items: { label: string; primary: number; secondary?: number; primaryLabel?: string }[];
  valueLabel?: string;
}) {
  if (!items.length) return <EmptyChart small />;
  const max = Math.max(...items.map(i => i.primary), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.slice(0, 7).map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 20, fontSize: 10, fontWeight: 700, color: i < 3 ? "#C5A059" : "#9C9584", textAlign: "right", flexShrink: 0 }}>#{i + 1}</span>
          <span style={{ fontSize: 11, color: "#5C5447", width: 120, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "Georgia, serif" }}>{item.label}</span>
          <div style={{ flex: 1, height: 7, borderRadius: 4, background: "rgba(197,160,89,0.1)", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 4, transition: "width 0.6s ease",
              width: `${(item.primary / max) * 100}%`,
              background: i === 0
                ? "linear-gradient(90deg, #C5A059, #A8853A)"
                : i === 1
                  ? "linear-gradient(90deg, #B8A070, #9A7830)"
                  : "rgba(197,160,89,0.5)",
            }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#1C1917", width: 60, textAlign: "right", flexShrink: 0 }}>
            {item.primaryLabel ?? (valueLabel === "Revenue" ? fmt(item.primary) : item.primary.toLocaleString())}
          </span>
        </div>
      ))}
    </div>
  );
}

function EmptyChart({ small }: { small?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: small ? 80 : 160, color: "#B8AE9C" }}>
      <BarChart3 size={small ? 20 : 28} style={{ opacity: 0.3, marginBottom: 6 }} />
      <span style={{ fontSize: 11, color: "#B8AE9C" }}>No data for this period</span>
    </div>
  );
}

// ─────────────────────────────────────── KPI Card ────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color, delta, loading }: {
  label: string; value: string; sub: string; icon: React.ElementType;
  color: string; delta?: number; loading?: boolean;
}) {
  return (
    <div style={{ background: "white", borderRadius: 16, padding: "18px 20px", border: "1px solid rgba(197,160,89,0.15)", boxShadow: "0 1px 8px rgba(28,25,23,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#9C9584", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: `${color}14`, border: `1px solid ${color}28`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={14} style={{ color }} />
        </div>
      </div>
      {loading ? (
        <div style={{ height: 32, borderRadius: 8, background: "rgba(197,160,89,0.08)", animation: "pulse 1.4s infinite" }} />
      ) : (
        <p style={{ fontSize: 24, fontWeight: 700, color: "#1C1917", fontFamily: "Georgia, serif", margin: "0 0 4px", lineHeight: 1 }}>{value}</p>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, color: "#9C9584" }}>{sub}</span>
        {delta !== undefined && (
          <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 11, fontWeight: 600, color: delta >= 0 ? "#059669" : "#DC2626" }}>
            {delta >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {Math.abs(delta).toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────── Chart Card ──────────────────────────

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "white", borderRadius: 16, padding: "20px 22px", border: "1px solid rgba(197,160,89,0.15)", boxShadow: "0 1px 8px rgba(28,25,23,0.04)" }}>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: "0 0 2px" }}>{title}</p>
        {subtitle && <p style={{ fontSize: 11, color: "#9C9584", margin: 0 }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────── Main Page ───────────────────────────

export default function AnalyticsPage() {
  const { profile, activeClinicId, clinics: ctxClinics, loading: profileLoading } = useClinic();
  const [range, setRange]       = useState<DateRange>("30d");
  const [loading, setLoading]   = useState(true);
  const [refreshed, setRefreshed] = useState(0);

  // ── Role detection ──
  const role         = profile?.role ?? null;
  const isSuperAdmin = role === "superadmin";
  const isChainAdmin = role === "chain_admin";
  const isMultiClinic= isSuperAdmin || isChainAdmin;

  // ── Raw data ──
  const [invoices,  setInvoices]  = useState<Invoice[]>([]);
  const [prevInvs,  setPrevInvs]  = useState<Invoice[]>([]);
  const [patients,  setPatients]  = useState<Patient[]>([]);
  const [appts,     setAppts]     = useState<Appt[]>([]);
  const [clinicList,setClinicList]= useState<ClinicRow[]>([]);
  const [chainName, setChainName] = useState<string>("");

  const fetchData = useCallback(async () => {
    if (profileLoading) return;
    setLoading(true);

    const from     = rangeStart(range).toISOString();
    const prevFrom = prevRangeStart(range).toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function clinicScope(q: any) {
      if (isSuperAdmin && !activeClinicId) return q;  // all clinics
      if (activeClinicId) return q.eq("clinic_id", activeClinicId);
      return q;
    }

    const [invRes, prevInvRes, patRes, apptRes, clinicsRes] = await Promise.all([
      // Current-period invoices
      clinicScope(
        supabase.from("pending_invoices")
          .select("clinic_id,total_amount,amount,status,payment_mode,service_name,provider_name,created_at")
          .gte("created_at", from)
      ),
      // Previous-period invoices (for delta)
      clinicScope(
        supabase.from("pending_invoices")
          .select("total_amount,status")
          .gte("created_at", prevFrom)
          .lt("created_at", from)
          .eq("status", "paid")
      ),
      // Patients
      clinicScope(
        supabase.from("patients").select("clinic_id,created_at").gte("created_at", from)
      ),
      // Appointments
      clinicScope(
        supabase.from("appointments").select("clinic_id,status,start_time,service_name").gte("start_time", from)
      ),
      // Clinic list for leaderboard (superadmin: all; chain_admin: their chain)
      isMultiClinic
        ? (isSuperAdmin
            ? supabase.from("clinics").select("id,name,chain_id,subscription_status")
            : supabase.from("clinics").select("id,name,chain_id,subscription_status")
                .not("chain_id", "is", null)
          )
        : Promise.resolve({ data: [] }),
    ]);

    setInvoices((invRes.data  ?? []) as Invoice[]);
    setPrevInvs((prevInvRes.data ?? []) as Invoice[]);
    setPatients((patRes.data  ?? []) as Patient[]);
    setAppts((apptRes.data    ?? []) as Appt[]);
    setClinicList((clinicsRes.data ?? []) as ClinicRow[]);
    setLoading(false);
  }, [profileLoading, range, activeClinicId, isSuperAdmin, isChainAdmin, isMultiClinic]);

  useEffect(() => { fetchData(); }, [fetchData, refreshed]);

  // ── Derived KPIs ──
  const paid     = useMemo(() => invoices.filter(i => i.status === "paid"), [invoices]);
  const pending  = useMemo(() => invoices.filter(i => i.status === "pending"), [invoices]);
  const totalRev = useMemo(() => paid.reduce((s, i) => s + (i.total_amount ?? 0), 0), [paid]);
  const pendRev  = useMemo(() => pending.reduce((s, i) => s + (i.total_amount ?? 0), 0), [pending]);
  const prevRev  = useMemo(() => prevInvs.reduce((s, i) => s + (i.total_amount ?? 0), 0), [prevInvs]);
  const revDelta = prevRev > 0 ? ((totalRev - prevRev) / prevRev) * 100 : undefined;

  const completedAppts = useMemo(() => appts.filter(a => a.status === "completed").length, [appts]);
  const cancelledAppts = useMemo(() => appts.filter(a => a.status === "cancelled").length, [appts]);
  const noShowAppts    = useMemo(() => appts.filter(a => a.status === "no_show").length, [appts]);

  // ── Revenue trend ──
  const buckets       = useMemo(() => generateBuckets(range), [range]);
  const revItems      = useMemo(() => paid.map(i => ({ date: i.created_at, value: i.total_amount ?? 0 })), [paid]);
  const revTrend      = useMemo(() => buckets.map((b, idx) => ({ label: b.label, value: fillBuckets(revItems, buckets)[idx] })), [buckets, revItems]);
  const patItems      = useMemo(() => patients.map(p => ({ date: p.created_at, value: 1 })), [patients]);
  const patTrend      = useMemo(() => buckets.map((b, idx) => ({ label: b.label, value: fillBuckets(patItems, buckets)[idx] })), [buckets, patItems]);

  // ── Appointment status breakdown ──
  const apptStatus = useMemo(() => {
    const STATUS_CFG: Record<string, { label: string; color: string }> = {
      completed:  { label: "Completed",  color: "#059669" },
      cancelled:  { label: "Cancelled",  color: "#DC2626" },
      no_show:    { label: "No-Show",    color: "#EA580C" },
      in_session: { label: "In Session", color: "#C5A059" },
      confirmed:  { label: "Confirmed",  color: "#6366F1" },
      planned:    { label: "Planned",    color: "#9C9584" },
      arrived:    { label: "Arrived",    color: "#0891B2" },
    };
    const counts: Record<string, number> = {};
    appts.forEach(a => { counts[a.status] = (counts[a.status] ?? 0) + 1; });
    return Object.entries(STATUS_CFG)
      .map(([key, cfg]) => ({ label: cfg.label, value: counts[key] ?? 0, color: cfg.color }))
      .filter(s => s.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [appts]);

  // ── Payment modes ──
  const payModes = useMemo(() => {
    const COLORS: Record<string, string> = { cash: "#059669", card: "#6366F1", upi: "#C5A059", bank_transfer: "#0891B2", wallet: "#7C3AED", insurance: "#EA580C" };
    const counts: Record<string, number> = {};
    paid.forEach(i => { const m = i.payment_mode ?? "other"; counts[m] = (counts[m] ?? 0) + (i.total_amount ?? 0); });
    return Object.entries(counts)
      .map(([k, v]) => ({ label: k.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase()), value: Math.round(v), color: COLORS[k] ?? "#9C9584" }))
      .sort((a, b) => b.value - a.value);
  }, [paid]);

  // ── Top services ──
  const topServices = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {};
    paid.forEach(i => {
      const k = i.service_name ?? "Other";
      map[k] = { count: (map[k]?.count ?? 0) + 1, revenue: (map[k]?.revenue ?? 0) + (i.total_amount ?? 0) };
    });
    return Object.entries(map)
      .map(([label, v]) => ({ label, primary: v.revenue, secondary: v.count, primaryLabel: fmt(v.revenue) }))
      .sort((a, b) => b.primary - a.primary);
  }, [paid]);

  // ── Top providers ──
  const topProviders = useMemo(() => {
    const map: Record<string, { revenue: number; count: number }> = {};
    paid.forEach(i => {
      const k = i.provider_name ?? "Unassigned";
      map[k] = { revenue: (map[k]?.revenue ?? 0) + (i.total_amount ?? 0), count: (map[k]?.count ?? 0) + 1 };
    });
    return Object.entries(map)
      .map(([label, v]) => ({ label, primary: v.revenue, secondary: v.count, primaryLabel: fmt(v.revenue) }))
      .sort((a, b) => b.primary - a.primary);
  }, [paid]);

  // ── Clinic leaderboard ──
  const clinicLeaderboard = useMemo(() => {
    if (!isMultiClinic || !clinicList.length) return [];
    const revMap: Record<string, number> = {};
    const patMap: Record<string, number> = {};
    paid.forEach(i => { if (i.clinic_id) revMap[i.clinic_id] = (revMap[i.clinic_id] ?? 0) + (i.total_amount ?? 0); });
    patients.forEach(p => { if (p.clinic_id) patMap[p.clinic_id] = (patMap[p.clinic_id] ?? 0) + 1; });
    return clinicList
      .map(c => ({ id: c.id, name: c.name, revenue: revMap[c.id] ?? 0, patients: patMap[c.id] ?? 0, status: c.subscription_status }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [isMultiClinic, clinicList, paid, patients]);

  const RANGES: { key: DateRange; label: string }[] = [
    { key: "7d", label: "7 Days" }, { key: "30d", label: "30 Days" },
    { key: "90d", label: "90 Days" }, { key: "1y", label: "1 Year" },
  ];

  const ROLE_LABEL = isSuperAdmin ? "Platform View" : isChainAdmin ? "Chain View" : "Clinic View";
  const ROLE_COLOR = isSuperAdmin ? "#C5A059" : isChainAdmin ? "#9333EA" : "#6366F1";

  return (
    <div style={{ background: "#F9F7F2", minHeight: "100vh" }}>
      <TopBar />

      <div style={{ padding: "28px 40px 60px", maxWidth: 1320, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h1 style={{ fontSize: 22, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: 0 }}>Analytics</h1>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 6, background: `${ROLE_COLOR}14`, color: ROLE_COLOR, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {ROLE_LABEL}
              </span>
            </div>
            <p style={{ fontSize: 12, color: "#9C9584", margin: 0 }}>
              {isSuperAdmin ? "Platform-wide metrics across all clinics and chains"
                : isChainAdmin ? `Chain metrics — ${chainName || "all clinics in your chain"}`
                : "Clinic performance metrics and trends"}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Date range */}
            <div style={{ display: "flex", background: "white", borderRadius: 10, border: "1px solid rgba(197,160,89,0.2)", overflow: "hidden" }}>
              {RANGES.map(r => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  style={{
                    padding: "7px 14px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                    background: range === r.key ? "rgba(197,160,89,0.12)" : "transparent",
                    color: range === r.key ? "#C5A059" : "#9C9584",
                    borderRight: "1px solid rgba(197,160,89,0.12)",
                    transition: "all 0.15s",
                  }}
                >{r.label}</button>
              ))}
            </div>
            <button
              onClick={() => setRefreshed(x => x + 1)}
              style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(197,160,89,0.2)", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <RefreshCw size={14} style={{ color: "#9C9584" }} />
            </button>
          </div>
        </div>

        {/* ── KPI Row ── */}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${isMultiClinic ? 5 : 4}, 1fr)`, gap: 14, marginBottom: 24 }}>
          <KpiCard label="Revenue Collected" value={fmt(totalRev)} sub={`vs ${fmt(prevRev)} prev period`} icon={IndianRupee} color="#C5A059" delta={revDelta} loading={loading} />
          <KpiCard label="Pending Dues"       value={fmt(pendRev)} sub="Outstanding invoices"           icon={Clock}        color="#EA580C" loading={loading} />
          <KpiCard label="New Patients"        value={patients.length.toLocaleString()} sub={`${range} window`} icon={Users} color="#059669" loading={loading} />
          <KpiCard label="Appointments"        value={appts.length.toLocaleString()} sub={`${completedAppts} completed`} icon={Calendar} color="#6366F1" loading={loading} />
          {isMultiClinic && <KpiCard label="Active Clinics" value={clinicList.filter(c => c.subscription_status === "active").length.toLocaleString()} sub="on platform" icon={Building2} color="#9333EA" loading={loading} />}
        </div>

        {/* ── Revenue + Patient Trends ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <ChartCard title="Revenue Trend" subtitle={`Collected revenue — last ${range}`}>
            {loading ? <div style={{ height: 180, borderRadius: 8, background: "rgba(197,160,89,0.06)", animation: "pulse 1.4s infinite" }} /> : <BarChart data={revTrend} color="#C5A059" label="Revenue" />}
          </ChartCard>
          <ChartCard title="Patient Registrations" subtitle={`New patients — last ${range}`}>
            {loading ? <div style={{ height: 180, borderRadius: 8, background: "rgba(5,150,105,0.06)", animation: "pulse 1.4s infinite" }} /> : <AreaChart data={patTrend} color="#059669" />}
          </ChartCard>
        </div>

        {/* ── Clinic Leaderboard (superadmin / chain_admin) ── */}
        {isMultiClinic && (
          <div style={{ background: "white", borderRadius: 16, padding: "20px 24px", border: "1px solid rgba(197,160,89,0.15)", boxShadow: "0 1px 8px rgba(28,25,23,0.04)", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: "0 0 2px" }}>Clinic Leaderboard</p>
                <p style={{ fontSize: 11, color: "#9C9584", margin: 0 }}>Ranked by revenue collected in this period</p>
              </div>
              <Award size={16} style={{ color: "#C5A059" }} />
            </div>
            {loading ? (
              <div style={{ height: 120, borderRadius: 8, background: "rgba(197,160,89,0.04)", animation: "pulse 1.4s infinite" }} />
            ) : clinicLeaderboard.length === 0 ? (
              <p style={{ fontSize: 12, color: "#9C9584", textAlign: "center", padding: "24px 0" }}>No clinic data available</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(197,160,89,0.12)" }}>
                    {["Rank", "Clinic", "Revenue", "Patients", "Completion Rate", "Status"].map(h => (
                      <th key={h} style={{ fontSize: 10, fontWeight: 700, color: "#9C9584", textAlign: "left", padding: "4px 10px 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clinicLeaderboard.map((c, i) => {
                    const clinicAppts = appts.filter(a => a.clinic_id === c.id);
                    const completionPct = clinicAppts.length > 0 ? Math.round((clinicAppts.filter(a => a.status === "completed").length / clinicAppts.length) * 100) : 0;
                    const subBadge = c.status === "active" ? { bg: "rgba(5,150,105,0.1)", color: "#059669" } : { bg: "rgba(107,114,128,0.1)", color: "#6B7280" };
                    return (
                      <tr key={c.id} style={{ borderBottom: "1px solid rgba(197,160,89,0.07)", transition: "background 0.12s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(197,160,89,0.04)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "")}>
                        <td style={{ padding: "11px 10px" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: i < 3 ? "#C5A059" : "#9C9584" }}>
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                          </span>
                        </td>
                        <td style={{ padding: "11px 10px" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif" }}>{c.name}</span>
                        </td>
                        <td style={{ padding: "11px 10px" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#C5A059", fontFamily: "Georgia, serif" }}>{fmt(c.revenue)}</span>
                        </td>
                        <td style={{ padding: "11px 10px" }}>
                          <span style={{ fontSize: 12, color: "#5C5447" }}>{c.patients}</span>
                        </td>
                        <td style={{ padding: "11px 10px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, height: 5, borderRadius: 3, background: "rgba(197,160,89,0.1)", maxWidth: 80 }}>
                              <div style={{ height: "100%", borderRadius: 3, width: `${completionPct}%`, background: completionPct >= 70 ? "#059669" : completionPct >= 40 ? "#C5A059" : "#DC2626" }} />
                            </div>
                            <span style={{ fontSize: 11, color: "#6B6358" }}>{completionPct}%</span>
                          </div>
                        </td>
                        <td style={{ padding: "11px 10px" }}>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: subBadge.bg, color: subBadge.color, textTransform: "capitalize" }}>{c.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Breakdowns Row ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <ChartCard title="Appointment Status" subtitle="Distribution across all statuses">
            {loading ? <div style={{ height: 120, borderRadius: 8, background: "rgba(99,102,241,0.04)", animation: "pulse 1.4s infinite" }} /> : <DonutChart segments={apptStatus} title="Total" />}
          </ChartCard>
          <ChartCard title="Payment Modes" subtitle="Revenue split by payment channel">
            {loading ? <div style={{ height: 120, borderRadius: 8, background: "rgba(5,150,105,0.04)", animation: "pulse 1.4s infinite" }} /> : <DonutChart segments={payModes.map(p => ({ ...p, label: p.label, value: p.value, color: p.color }))} title="Revenue" />}
          </ChartCard>
        </div>

        {/* ── Performance Row ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <ChartCard title="Top Services" subtitle="By revenue generated">
            {loading ? <div style={{ height: 180, borderRadius: 8, background: "rgba(197,160,89,0.04)", animation: "pulse 1.4s infinite" }} /> : <HBar items={topServices} valueLabel="Revenue" />}
          </ChartCard>
          <ChartCard title="Provider Performance" subtitle="By revenue generated">
            {loading ? <div style={{ height: 180, borderRadius: 8, background: "rgba(99,102,241,0.04)", animation: "pulse 1.4s infinite" }} /> : <HBar items={topProviders} valueLabel="Revenue" />}
          </ChartCard>
        </div>

        {/* ── Completion Stats Row ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[
            { label: "Completion Rate",  value: appts.length > 0 ? `${Math.round((completedAppts / appts.length) * 100)}%` : "—", icon: CheckCircle2, color: "#059669", sub: `${completedAppts} of ${appts.length}` },
            { label: "Cancellation Rate",value: appts.length > 0 ? `${Math.round((cancelledAppts / appts.length) * 100)}%` : "—", icon: XCircle,      color: "#DC2626", sub: `${cancelledAppts} cancelled`          },
            { label: "No-Show Rate",     value: appts.length > 0 ? `${Math.round((noShowAppts / appts.length) * 100)}%`    : "—", icon: PhoneOff,     color: "#EA580C", sub: `${noShowAppts} no-shows`              },
          ].map(s => (
            <div key={s.label} style={{ background: "white", borderRadius: 14, padding: "16px 20px", border: "1px solid rgba(197,160,89,0.15)", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: `${s.color}10`, border: `1px solid ${s.color}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <s.icon size={18} style={{ color: s.color }} />
              </div>
              <div>
                <p style={{ fontSize: 22, fontWeight: 700, color: "#1C1917", fontFamily: "Georgia, serif", margin: "0 0 2px" }}>{loading ? "—" : s.value}</p>
                <p style={{ fontSize: 11, color: "#9C9584", margin: 0 }}>{s.label} · {s.sub}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
