"use client";

/**
 * BeforeAfterProgress — embedded in the patient EMR timeline column.
 *
 * Fetches all before_after_photos for this patient where show_to_patient = true,
 * groups them by treatment, and renders a compact horizontal scroll of photo pairs.
 * Clicking a pair opens a full-screen comparison modal (slider + side-by-side).
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, ChevronLeft, ChevronRight, X, Maximize2, SplitSquareHorizontal, ArrowLeftRight } from "lucide-react";
import { supabase } from "@/lib/supabase";

// ─────────────────────────────────────── Types ───────────────────────────────

interface BAPhoto {
  id: string;
  title: string;
  treatment: string;
  condition: string | null;
  body_area: string | null;
  visit_date: string | null;
  visit_number: number | null;
  before_url: string;
  after_url: string;
  notes: string | null;
  created_at: string;
}

type ViewMode = "slider" | "side";

// ─────────────────────────────────────── Main Component ──────────────────────

export default function BeforeAfterProgress({ patientId, clinicId }: { patientId: string; clinicId: string | null }) {
  const [photos,    setPhotos]    = useState<BAPhoto[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState<BAPhoto | null>(null);

  useEffect(() => {
    if (!patientId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("before_after_photos")
        .select("id, title, treatment, condition, body_area, visit_date, visit_number, before_url, after_url, notes, created_at")
        .eq("patient_id", patientId)
        .eq("show_to_patient", true)
        .order("created_at", { ascending: false });
      setPhotos(data ?? []);
      setLoading(false);
    })();
  }, [patientId]);

  // Group by treatment
  const groups = photos.reduce<Record<string, BAPhoto[]>>((acc, p) => {
    (acc[p.treatment] ??= []).push(p);
    return acc;
  }, {});

  if (loading) {
    return (
      <div style={{ padding: "16px 0" }}>
        <SectionLabel />
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{ width: 140, height: 88, borderRadius: 10, background: "rgba(197,160,89,0.08)", flexShrink: 0, animation: "pulse 1.5s infinite" }} />
          ))}
        </div>
      </div>
    );
  }

  if (photos.length === 0) return null; // hidden when no photos — no noise

  return (
    <div style={{ marginTop: 8 }}>
      <SectionLabel count={photos.length} />

      {/* Grouped by treatment */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {Object.entries(groups).map(([treatment, items]) => (
          <TreatmentGroup
            key={treatment}
            treatment={treatment}
            items={items}
            onSelect={setSelected}
          />
        ))}
      </div>

      {/* Comparison Modal */}
      {selected && (
        <ComparisonModal photo={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────── Section Label ───────────────────────

function SectionLabel({ count }: { count?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
      <div style={{ width: 20, height: 20, borderRadius: 6, background: "rgba(197,160,89,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Camera size={11} style={{ color: "#C5A059" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9C9584" }}>
        Before & After Progress
      </span>
      {count != null && (
        <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 20, background: "rgba(197,160,89,0.12)", color: "#C5A059", border: "1px solid rgba(197,160,89,0.25)" }}>
          {count}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────── Treatment Group ─────────────────────

function TreatmentGroup({ treatment, items, onSelect }: {
  treatment: string;
  items: BAPhoto[];
  onSelect: (p: BAPhoto) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(dir: "left" | "right") {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "left" ? -160 : 160, behavior: "smooth" });
  }

  return (
    <div>
      {/* Treatment label */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, color: "#5C5447", fontFamily: "Georgia, serif",
          padding: "2px 10px", borderRadius: 6,
          background: "rgba(197,160,89,0.08)", border: "1px solid rgba(197,160,89,0.18)",
        }}>
          {treatment}
        </span>
        {items.length > 2 && (
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => scroll("left")}  style={arrowBtn}><ChevronLeft  size={12} /></button>
            <button onClick={() => scroll("right")} style={arrowBtn}><ChevronRight size={12} /></button>
          </div>
        )}
      </div>

      {/* Horizontal scroll */}
      <div
        ref={scrollRef}
        style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}
      >
        {items.map(photo => (
          <PairCard key={photo.id} photo={photo} onClick={() => onSelect(photo)} />
        ))}
      </div>
    </div>
  );
}

const arrowBtn: React.CSSProperties = {
  width: 22, height: 22, borderRadius: 6,
  border: "1px solid rgba(197,160,89,0.22)",
  background: "rgba(197,160,89,0.06)",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", color: "#9C9584",
};

// ─────────────────────────────────────── Pair Card ───────────────────────────

function PairCard({ photo, onClick }: { photo: BAPhoto; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  const label = photo.visit_number
    ? `Visit ${photo.visit_number}`
    : photo.visit_date
      ? new Date(photo.visit_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
      : new Date(photo.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 148, flexShrink: 0, cursor: "pointer",
        borderRadius: 10, overflow: "hidden",
        border: hovered ? "1px solid rgba(197,160,89,0.5)" : "1px solid rgba(197,160,89,0.18)",
        boxShadow: hovered ? "0 4px 16px rgba(197,160,89,0.18)" : "0 1px 4px rgba(28,25,23,0.06)",
        transition: "all 0.18s ease",
        background: "#0F0D0A",
        transform: hovered ? "translateY(-1px)" : "none",
      }}
    >
      {/* Split image: before left, after right */}
      <div style={{ position: "relative", height: 88, background: "#1A1714" }}>
        {/* Before — left half */}
        <div style={{ position: "absolute", inset: 0, right: "50%", overflow: "hidden" }}>
          <img
            src={photo.before_url}
            alt="Before"
            style={{ width: "200%", height: "100%", objectFit: "cover" }}
            loading="lazy"
          />
        </div>
        {/* After — right half */}
        <div style={{ position: "absolute", inset: 0, left: "50%", overflow: "hidden" }}>
          <img
            src={photo.after_url}
            alt="After"
            style={{ position: "absolute", right: 0, width: "200%", height: "100%", objectFit: "cover" }}
            loading="lazy"
          />
        </div>
        {/* Gold centre line */}
        <div style={{
          position: "absolute", top: 0, bottom: 0, left: "50%",
          transform: "translateX(-50%)", width: 1,
          background: "linear-gradient(to bottom, transparent, #C5A059 20%, #C5A059 80%, transparent)",
        }} />
        {/* Before / After labels */}
        <div style={{ position: "absolute", bottom: 4, left: 4, fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: "0.06em", textTransform: "uppercase", textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>Before</div>
        <div style={{ position: "absolute", bottom: 4, right: 4, fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: "0.06em", textTransform: "uppercase", textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>After</div>
        {/* Hover expand icon */}
        {hovered && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)" }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(197,160,89,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Maximize2 size={12} style={{ color: "white" }} />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "6px 8px", background: "#141210" }}>
        <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(197,160,89,0.9)", margin: 0, fontFamily: "Georgia, serif", letterSpacing: "0.03em" }}>
          {label}
        </p>
        {photo.body_area && (
          <p style={{ fontSize: 9, color: "rgba(232,226,212,0.4)", margin: "1px 0 0", letterSpacing: "0.03em" }}>
            {photo.body_area}
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────── Comparison Modal ────────────────────

function ComparisonModal({ photo, onClose }: { photo: BAPhoto; onClose: () => void }) {
  const [mode,      setMode]      = useState<ViewMode>("slider");
  const [sliderPos, setSliderPos] = useState(50);
  const [dragging,  setDragging]  = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateSlider = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) {
      if (!dragging) return;
      const x = "touches" in e ? e.touches[0].clientX : e.clientX;
      updateSlider(x);
    }
    function onUp() { setDragging(false); }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    window.addEventListener("touchmove", onMove as EventListener);
    window.addEventListener("touchend",  onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
      window.removeEventListener("touchmove", onMove as EventListener);
      window.removeEventListener("touchend",  onUp);
    };
  }, [dragging, updateSlider]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const visitLabel = photo.visit_number
    ? `Visit ${photo.visit_number}`
    : photo.visit_date
      ? new Date(photo.visit_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : new Date(photo.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(10,8,6,0.95)", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column", animation: "fadeIn 0.2s ease" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", flexShrink: 0, borderBottom: "1px solid rgba(197,160,89,0.12)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(232,226,212,0.95)", fontFamily: "Georgia, serif", margin: 0, letterSpacing: "0.02em" }}>
            {photo.treatment}
            {photo.body_area && <span style={{ color: "rgba(197,160,89,0.7)", marginLeft: 8, fontSize: 12 }}>· {photo.body_area}</span>}
          </p>
          <p style={{ fontSize: 11, color: "rgba(232,226,212,0.4)", margin: "2px 0 0" }}>{visitLabel}</p>
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: 3, gap: 2 }}>
          <ModeBtn active={mode === "slider"} onClick={() => setMode("slider")} icon={<SplitSquareHorizontal size={13} />} label="Slider" />
          <ModeBtn active={mode === "side"}   onClick={() => setMode("side")}   icon={<ArrowLeftRight size={13} />}         label="Side" />
        </div>

        <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(197,160,89,0.2)", background: "rgba(255,255,255,0.05)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X size={15} style={{ color: "rgba(232,226,212,0.6)" }} />
        </button>
      </div>

      {/* ── Image area ── */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        {mode === "slider" ? (
          /* Drag-to-reveal slider */
          <div
            ref={containerRef}
            style={{ position: "relative", width: "100%", maxWidth: 680, height: "100%", maxHeight: 520, borderRadius: 14, overflow: "hidden", cursor: "col-resize", userSelect: "none" }}
            onMouseDown={(e) => { setDragging(true); updateSlider(e.clientX); }}
            onTouchStart={(e) => { setDragging(true); updateSlider(e.touches[0].clientX); }}
          >
            {/* After (base layer) */}
            <img src={photo.after_url} alt="After" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", background: "#0F0D0A" }} />
            {/* Before (clipped layer) */}
            <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
              <img src={photo.before_url} alt="Before" style={{ width: "100%", height: "100%", objectFit: "contain", background: "#0F0D0A" }} />
            </div>
            {/* Divider line */}
            <div style={{ position: "absolute", top: 0, bottom: 0, left: `${sliderPos}%`, transform: "translateX(-50%)", width: 2, background: "#C5A059", pointerEvents: "none" }}>
              {/* Handle */}
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 32, height: 32, borderRadius: "50%", background: "#C5A059", border: "3px solid white", boxShadow: "0 2px 12px rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ArrowLeftRight size={12} style={{ color: "white" }} />
              </div>
            </div>
            {/* Corner labels */}
            <span style={{ position: "absolute", top: 10, left: 12, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.85)", background: "rgba(0,0,0,0.5)", padding: "2px 8px", borderRadius: 5, letterSpacing: "0.07em", textTransform: "uppercase" }}>Before</span>
            <span style={{ position: "absolute", top: 10, right: 12, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.85)", background: "rgba(0,0,0,0.5)", padding: "2px 8px", borderRadius: 5, letterSpacing: "0.07em", textTransform: "uppercase" }}>After</span>
          </div>
        ) : (
          /* Side by side */
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%", maxWidth: 760, height: "100%", maxHeight: 520 }}>
            {["Before", "After"].map((label, i) => (
              <div key={label} style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#0F0D0A" }}>
                <img
                  src={i === 0 ? photo.before_url : photo.after_url}
                  alt={label}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
                <span style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.85)", background: "rgba(0,0,0,0.55)", padding: "2px 10px", borderRadius: 5, letterSpacing: "0.07em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Footer: meta ── */}
      {(photo.condition || photo.notes) && (
        <div style={{ padding: "12px 20px 16px", borderTop: "1px solid rgba(197,160,89,0.1)", display: "flex", gap: 20, flexWrap: "wrap", flexShrink: 0 }}>
          {photo.condition && <MetaChip label="Condition" value={photo.condition} />}
          {photo.notes     && <MetaChip label="Notes"     value={photo.notes}     />}
        </div>
      )}
    </div>
  );
}

function ModeBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
        fontSize: 11, fontWeight: 600, letterSpacing: "0.02em", transition: "all 0.15s",
        background: active ? "rgba(197,160,89,0.22)" : "transparent",
        color: active ? "#C5A059" : "rgba(232,226,212,0.45)",
      }}
    >
      {icon}{label}
    </button>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 10, color: "rgba(197,160,89,0.6)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 2px", fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: 12, color: "rgba(232,226,212,0.7)", margin: 0, fontFamily: "Georgia, serif" }}>{value}</p>
    </div>
  );
}
