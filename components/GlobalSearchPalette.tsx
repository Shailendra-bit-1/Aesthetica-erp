"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, User, Calendar, FileText, ArrowRight, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import { useRouter } from "next/navigation";

/* ─── Types ─────────────────────────────────────────────── */
interface SearchResult {
  id: string;
  type: "patient" | "appointment" | "invoice";
  title: string;
  subtitle: string;
  href: string;
}

const RECENT_KEY = "aesthetica_recent_searches";
const MAX_RECENT  = 5;

function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); } catch { return []; }
}
function addRecent(q: string) {
  if (!q.trim()) return;
  const prev = getRecent().filter(s => s !== q);
  localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...prev].slice(0, MAX_RECENT)));
}

/* ─── Component ──────────────────────────────────────────── */
interface Props { open: boolean; onClose: () => void; }

export default function GlobalSearchPalette({ open, onClose }: Props) {
  const { profile, activeClinicId } = useClinic();
  const router  = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const clinicId = activeClinicId || profile?.clinic_id;

  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active,  setActive]  = useState(0);
  const [recent,  setRecent]  = useState<string[]>([]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery(""); setResults([]); setActive(0);
      setRecent(getRecent());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard: Esc closes, ↑↓ navigate, Enter selects
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
      if (e.key === "Enter" && results[active]) { navigate(results[active]); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, results, active]);

  const search = useCallback(async (q: string) => {
    if (!clinicId || !q.trim() || q.length < 2) { setResults([]); return; }
    setLoading(true);
    const term = q.trim();

    const [ptsRes, apptsRes, invRes] = await Promise.all([
      supabase.from("patients")
        .select("id, full_name, phone")
        .eq("clinic_id", clinicId)
        .or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`)
        .limit(5),
      supabase.from("appointments")
        .select("id, service_name, start_time, status")
        .eq("clinic_id", clinicId)
        .ilike("service_name", `%${term}%`)
        .order("start_time", { ascending: false })
        .limit(4),
      supabase.from("pending_invoices")
        .select("id, invoice_number, patient_name, total_amount, status")
        .eq("clinic_id", clinicId)
        .or(`invoice_number.ilike.%${term}%,patient_name.ilike.%${term}%`)
        .limit(4),
    ]);

    const out: SearchResult[] = [];
    (ptsRes.data ?? []).forEach(p => out.push({
      id: p.id, type: "patient",
      title: p.full_name,
      subtitle: p.phone ? `Patient · ${p.phone}` : "Patient",
      href: `/patients/${p.id}`,
    }));
    (apptsRes.data ?? []).forEach(a => out.push({
      id: a.id, type: "appointment",
      title: a.service_name ?? "Appointment",
      subtitle: `${a.status} · ${new Date(a.start_time).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
      href: "/scheduler",
    }));
    (invRes.data ?? []).forEach(i => out.push({
      id: i.id, type: "invoice",
      title: i.invoice_number ? `Invoice ${i.invoice_number}` : "Invoice",
      subtitle: `${i.patient_name ?? "—"} · ₹${(i.total_amount ?? 0).toLocaleString("en-IN")} · ${i.status}`,
      href: "/billing",
    }));
    setResults(out);
    setActive(0);
    setLoading(false);
  }, [clinicId]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => search(query), 280);
    return () => clearTimeout(t);
  }, [query, search]);

  const navigate = (r: SearchResult) => {
    addRecent(query || r.title);
    router.push(r.href);
    onClose();
  };

  const ICONS = {
    patient:     <User size={13} color="#7c3aed" />,
    appointment: <Calendar size={13} color="#2563eb" />,
    invoice:     <FileText size={13} color="#16a34a" />,
  };
  const ICON_BG = {
    patient:     "rgba(124,58,237,0.1)",
    appointment: "rgba(37,99,235,0.1)",
    invoice:     "rgba(22,163,74,0.1)",
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 500, backdropFilter: "blur(2px)" }}
      />

      {/* Palette */}
      <div style={{
        position: "fixed", top: "12%", left: "50%", transform: "translateX(-50%)",
        width: "min(640px, 94vw)",
        background: "white", borderRadius: 20,
        border: "1px solid rgba(197,160,89,0.25)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.2), 0 0 0 1px rgba(197,160,89,0.1)",
        zIndex: 501, overflow: "hidden",
      }}>
        {/* Search input */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid rgba(197,160,89,0.12)" }}>
          {loading
            ? <div style={{ width: 16, height: 16, border: "2px solid rgba(197,160,89,0.3)", borderTopColor: "#C5A059", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
            : <Search size={16} color="var(--gold)" style={{ flexShrink: 0 }} />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search patients, appointments, invoices…"
            style={{ flex: 1, border: "none", outline: "none", fontSize: 15, color: "#1a1714", fontFamily: "var(--font-sans)", background: "transparent" }}
          />
          {query && (
            <button onClick={() => setQuery("")}
              style={{ padding: 4, border: "none", background: "none", cursor: "pointer", borderRadius: 4, display: "flex", alignItems: "center" }}>
              <X size={13} color="var(--text-muted)" />
            </button>
          )}
          <kbd style={{ padding: "2px 6px", borderRadius: 5, border: "1px solid #e5e7eb", fontSize: 11, color: "#9ca3af", background: "#f9f7f2", flexShrink: 0 }}>Esc</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 380, overflowY: "auto" }}>
          {!query && recent.length > 0 && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", padding: "10px 20px 4px" }}>Recent</p>
              {recent.map((r, i) => (
                <button key={i} onClick={() => setQuery(r)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 20px", border: "none", background: "none", cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(197,160,89,0.06)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                  <Clock size={12} color="#d1d5db" />
                  <span style={{ fontSize: 13, color: "#6b7280" }}>{r}</span>
                </button>
              ))}
            </div>
          )}

          {query && results.length === 0 && !loading && (
            <div style={{ padding: "32px 20px", textAlign: "center" }}>
              <Search size={24} color="#d1d5db" style={{ margin: "0 auto 8px" }} />
              <p style={{ fontSize: 13, color: "#9ca3af" }}>No results for &ldquo;{query}&rdquo;</p>
            </div>
          )}

          {results.length > 0 && (
            <div style={{ padding: "6px 0" }}>
              {results.map((r, i) => (
                <button key={r.id} onClick={() => navigate(r)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 20px",
                    border: "none", cursor: "pointer", textAlign: "left", transition: "background 0.1s",
                    background: i === active ? "rgba(197,160,89,0.08)" : "transparent",
                  }}
                  onMouseEnter={() => setActive(i)}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: ICON_BG[r.type], display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {ICONS[r.type]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#1a1714", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</p>
                    <p style={{ fontSize: 11, color: "#9ca3af", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.subtitle}</p>
                  </div>
                  <ArrowRight size={13} color="#d1d5db" style={{ flexShrink: 0, opacity: i === active ? 1 : 0, transition: "opacity 0.1s" }} />
                </button>
              ))}
            </div>
          )}

          {/* Quick nav footer */}
          {!query && (
            <div style={{ padding: "8px 20px 14px" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Quick Navigation</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {[
                  { label: "Patients",   href: "/patients" },
                  { label: "Scheduler",  href: "/scheduler" },
                  { label: "Billing",    href: "/billing" },
                  { label: "CRM",        href: "/crm" },
                  { label: "Analytics",  href: "/admin/analytics" },
                ].map(item => (
                  <button key={item.href}
                    onClick={() => { router.push(item.href); onClose(); }}
                    style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.2)", background: "rgba(197,160,89,0.05)", cursor: "pointer", fontSize: 12, color: "#92702A", fontWeight: 500, transition: "all 0.1s" }}
                    onMouseEnter={e => { (e.currentTarget.style.background = "rgba(197,160,89,0.12)"); (e.currentTarget.style.borderColor = "rgba(197,160,89,0.4)"); }}
                    onMouseLeave={e => { (e.currentTarget.style.background = "rgba(197,160,89,0.05)"); (e.currentTarget.style.borderColor = "rgba(197,160,89,0.2)"); }}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div style={{ padding: "8px 20px", borderTop: "1px solid rgba(197,160,89,0.08)", display: "flex", gap: 16, background: "#faf9f7" }}>
          {[["↑↓", "Navigate"], ["↵", "Open"], ["Esc", "Close"]].map(([key, label]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <kbd style={{ padding: "1px 5px", borderRadius: 4, border: "1px solid #e5e7eb", fontSize: 10, color: "#9ca3af", background: "white" }}>{key}</kbd>
              <span style={{ fontSize: 10, color: "#d1d5db" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
