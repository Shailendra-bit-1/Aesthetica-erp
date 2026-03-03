"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, X, Save, Trash2, Eye, EyeOff } from "lucide-react";
import { FaceChart, PinAnnotation, fmtDate } from "../types";

// ─────────────────────── Types ────────────────────────────────────────────────

interface Props {
  patientId: string;
  clinicId: string;
}

const AREA_COLORS = [
  "#C5A059", "#6366F1", "#DC2626", "#059669", "#D97706", "#7C3AED", "#0891B2",
];

const DEPTH_OPTS = ["Superficial", "Mid dermis", "Deep dermis", "Sub-dermal", "Periosteal"];

const EMPTY_PIN: Omit<PinAnnotation, "id" | "x" | "y"> = {
  area: "", product: "", dose: "", depth: "Mid dermis", color: "#C5A059", notes: "",
};

// ─────────────────────── SVG Face Diagram ────────────────────────────────────
// Simple SVG anatomy diagram — inline, no external images

function FaceSVG() {
  return (
    <svg viewBox="0 0 200 300" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%", pointerEvents: "none" }}>
      {/* Head/face outline */}
      <ellipse cx="100" cy="130" rx="70" ry="90" fill="#FFF5EC" stroke="#E8C87A" strokeWidth="1.5" />
      {/* Forehead line */}
      <path d="M60 80 Q100 65 140 80" stroke="#D4A870" strokeWidth="1" fill="none" opacity="0.5" />
      {/* Eyes */}
      <ellipse cx="75" cy="120" rx="14" ry="8" fill="white" stroke="#D4A870" strokeWidth="1.2" />
      <ellipse cx="75" cy="120" rx="7" ry="6" fill="#6B3E20" />
      <ellipse cx="125" cy="120" rx="14" ry="8" fill="white" stroke="#D4A870" strokeWidth="1.2" />
      <ellipse cx="125" cy="120" rx="7" ry="6" fill="#6B3E20" />
      {/* Eyebrows */}
      <path d="M62 110 Q75 105 88 110" stroke="#6B3E20" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M112 110 Q125 105 138 110" stroke="#6B3E20" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Nose */}
      <path d="M100 125 L95 155 Q100 160 105 155 L100 125" fill="#FFE4C4" stroke="#D4A870" strokeWidth="1" />
      <ellipse cx="91" cy="157" rx="7" ry="4" fill="#FFE4C4" stroke="#D4A870" strokeWidth="1" />
      <ellipse cx="109" cy="157" rx="7" ry="4" fill="#FFE4C4" stroke="#D4A870" strokeWidth="1" />
      {/* Lips */}
      <path d="M83 172 Q100 165 117 172 Q100 185 83 172Z" fill="#C8956A" stroke="#A87048" strokeWidth="1" />
      <path d="M83 172 Q100 178 117 172" stroke="#A87048" strokeWidth="0.8" fill="none" />
      {/* Jawline hints */}
      <path d="M45 175 Q55 215 100 225 Q145 215 155 175" stroke="#D4A870" strokeWidth="1" fill="none" opacity="0.4" />
      {/* Chin */}
      <ellipse cx="100" cy="220" rx="20" ry="10" fill="#FFF0E0" stroke="#D4A870" strokeWidth="0.8" opacity="0.5" />
      {/* Ears */}
      <ellipse cx="31" cy="140" rx="8" ry="14" fill="#FFE4C4" stroke="#D4A870" strokeWidth="1" />
      <ellipse cx="169" cy="140" rx="8" ry="14" fill="#FFE4C4" stroke="#D4A870" strokeWidth="1" />
      {/* Neck */}
      <rect x="82" y="218" width="36" height="50" rx="6" fill="#FFE4C4" stroke="#D4A870" strokeWidth="1" opacity="0.6" />
      {/* Zone labels */}
      <text x="100" y="90" textAnchor="middle" fontSize="7" fill="#C5A059" opacity="0.5">Forehead</text>
      <text x="100" y="145" textAnchor="middle" fontSize="7" fill="#C5A059" opacity="0.5">Nose</text>
      <text x="60" y="200" textAnchor="middle" fontSize="7" fill="#C5A059" opacity="0.4">Cheek</text>
      <text x="140" y="200" textAnchor="middle" fontSize="7" fill="#C5A059" opacity="0.4">Cheek</text>
      <text x="100" y="215" textAnchor="middle" fontSize="7" fill="#C5A059" opacity="0.4">Chin</text>
    </svg>
  );
}

function BodyFrontSVG() {
  return (
    <svg viewBox="0 0 200 400" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%", pointerEvents: "none" }}>
      {/* Head */}
      <ellipse cx="100" cy="35" rx="28" ry="30" fill="#FFE4C4" stroke="#D4A870" strokeWidth="1.5" />
      {/* Neck */}
      <rect x="88" y="62" width="24" height="18" rx="4" fill="#FFE4C4" stroke="#D4A870" strokeWidth="1" />
      {/* Torso */}
      <path d="M60 80 L40 100 L30 200 L170 200 L160 100 L140 80 Z" fill="#FFF0E0" stroke="#D4A870" strokeWidth="1.5" />
      {/* Shoulders */}
      <ellipse cx="45" cy="90" rx="22" ry="14" fill="#FFE4C4" stroke="#D4A870" strokeWidth="1" />
      <ellipse cx="155" cy="90" rx="22" ry="14" fill="#FFE4C4" stroke="#D4A870" strokeWidth="1" />
      {/* Arms */}
      <rect x="22" y="95" width="22" height="100" rx="11" fill="#FFE4C4" stroke="#D4A870" strokeWidth="1" />
      <rect x="156" y="95" width="22" height="100" rx="11" fill="#FFE4C4" stroke="#D4A870" strokeWidth="1" />
      {/* Legs */}
      <rect x="55" y="200" width="38" height="150" rx="14" fill="#FFE4C4" stroke="#D4A870" strokeWidth="1" />
      <rect x="107" y="200" width="38" height="150" rx="14" fill="#FFE4C4" stroke="#D4A870" strokeWidth="1" />
      {/* Zone labels */}
      <text x="100" y="140" textAnchor="middle" fontSize="8" fill="#C5A059" opacity="0.5">Chest</text>
      <text x="100" y="180" textAnchor="middle" fontSize="8" fill="#C5A059" opacity="0.5">Abdomen</text>
    </svg>
  );
}

// ─────────────────────── ChartingTab ─────────────────────────────────────────

export default function ChartingTab({ patientId, clinicId }: Props) {
  const [charts,        setCharts]        = useState<FaceChart[]>([]);
  const [activeChartId, setActiveChartId] = useState<string | null>(null);
  const [diagramType,   setDiagramType]   = useState<"face" | "body_front">("face");
  const [annotations,   setAnnotations]   = useState<PinAnnotation[]>([]);
  const [selectedPin,   setSelectedPin]   = useState<string | null>(null);
  const [editingPin,    setEditingPin]     = useState<Partial<PinAnnotation> | null>(null);
  const [showPastPins,  setShowPastPins]  = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [loading,       setLoading]       = useState(true);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  // Load existing charts
  useEffect(() => {
    loadCharts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  async function loadCharts() {
    setLoading(true);
    const { data } = await supabase
      .from("patient_face_charts")
      .select("*")
      .eq("patient_id", patientId)
      .order("visit_date", { ascending: false });
    const charts = (data ?? []) as FaceChart[];
    setCharts(charts);
    if (charts.length > 0) {
      setActiveChartId(charts[0].id);
      setAnnotations(charts[0].annotations as PinAnnotation[]);
      setDiagramType(charts[0].diagram_type as "face" | "body_front");
    }
    setLoading(false);
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    const container = svgContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    // Start new pin placement
    const newPin: PinAnnotation = {
      id: `pin_${Date.now()}`,
      x, y,
      area: inferArea(x, y, diagramType),
      product: "", dose: "", depth: "Mid dermis",
      color: AREA_COLORS[annotations.length % AREA_COLORS.length],
      notes: "",
    };
    setAnnotations(prev => [...prev, newPin]);
    setSelectedPin(newPin.id);
    setEditingPin(newPin);
  }

  function inferArea(x: number, y: number, type: string): string {
    if (type === "face") {
      if (y < 35) return "Forehead";
      if (y < 45 && x < 45) return "Left eyebrow";
      if (y < 45 && x > 55) return "Right eyebrow";
      if (y < 50 && x >= 45 && x <= 55) return "Glabella";
      if (y < 55 && x < 40) return "Left temple";
      if (y < 55 && x > 60) return "Right temple";
      if (y < 55) return "Periorbital";
      if (y < 65) return "Nose";
      if (y < 75 && x < 45) return "Left cheek";
      if (y < 75 && x > 55) return "Right cheek";
      if (y < 80) return "Lips";
      if (y < 88) return "Chin";
      return "Neck";
    }
    if (y < 20) return "Head";
    if (y < 35) return "Neck";
    if (y < 55) return "Chest";
    if (y < 70) return "Abdomen";
    if (x < 40) return "Left arm";
    if (x > 60) return "Right arm";
    if (y < 85) return "Hip";
    return "Legs";
  }

  function updatePin(id: string, updates: Partial<PinAnnotation>) {
    setAnnotations(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    if (editingPin?.id === id) setEditingPin(prev => prev ? { ...prev, ...updates } : prev);
  }

  function removePin(id: string) {
    setAnnotations(prev => prev.filter(p => p.id !== id));
    if (selectedPin === id) { setSelectedPin(null); setEditingPin(null); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (activeChartId) {
        // Update existing chart
        await fetch(`/api/patients/${patientId}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update_face_chart", chartId: activeChartId, annotations }),
        });
        setCharts(prev => prev.map(c => c.id === activeChartId ? { ...c, annotations } : c));
      } else {
        // Create new chart
        const res = await fetch(`/api/patients/${patientId}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save_face_chart", visit_date: new Date().toISOString().split("T")[0], diagram_type: diagramType, annotations }),
        });
        const json = await res.json();
        if (json.id) {
          const newChart: FaceChart = { id: json.id, visit_date: new Date().toISOString().split("T")[0], diagram_type: diagramType, annotations, encounter_id: null, created_by_name: null, created_at: new Date().toISOString() };
          setCharts(prev => [newChart, ...prev]);
          setActiveChartId(json.id);
        }
      }
    } finally {
      setSaving(false);
    }
  }

  function newChart() {
    setActiveChartId(null);
    setAnnotations([]);
    setSelectedPin(null);
    setEditingPin(null);
  }

  const editingPinData = editingPin ? annotations.find(p => p.id === editingPin.id) : null;

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {/* Diagram selector */}
        <div style={{ display: "flex", gap: 6 }}>
          {[{ key: "face" as const, label: "Face" }, { key: "body_front" as const, label: "Body" }].map(d => (
            <button key={d.key} onClick={() => setDiagramType(d.key)}
              style={{ padding: "6px 14px", borderRadius: 8, border: diagramType === d.key ? "1.5px solid rgba(197,160,89,0.5)" : "1px solid rgba(197,160,89,0.2)", background: diagramType === d.key ? "rgba(197,160,89,0.12)" : "white", fontSize: 12, fontWeight: diagramType === d.key ? 700 : 400, color: diagramType === d.key ? "#8B6914" : "#6B7280", cursor: "pointer" }}>
              {d.label}
            </button>
          ))}
        </div>

        {/* Chart selector */}
        {charts.length > 0 && (
          <select
            value={activeChartId ?? ""}
            onChange={e => {
              const chart = charts.find(c => c.id === e.target.value);
              if (chart) { setActiveChartId(chart.id); setAnnotations(chart.annotations as PinAnnotation[]); setDiagramType(chart.diagram_type as "face" | "body_front"); }
            }}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.25)", background: "white", fontSize: 12, color: "#1C1917", outline: "none", cursor: "pointer" }}>
            {charts.map(c => <option key={c.id} value={c.id}>{fmtDate(c.visit_date)} — {c.diagram_type}</option>)}
          </select>
        )}

        <button onClick={newChart} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.06)", fontSize: 12, color: "#C5A059", cursor: "pointer" }}>
          <Plus size={12} /> New Chart
        </button>

        <button onClick={() => setShowPastPins(v => !v)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(107,114,128,0.2)", background: "rgba(107,114,128,0.05)", fontSize: 12, color: "#6B7280", cursor: "pointer" }}>
          {showPastPins ? <Eye size={12} /> : <EyeOff size={12} />} Past Visits
        </button>

        <button onClick={handleSave} disabled={saving || annotations.length === 0}
          style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, padding: "7px 16px", borderRadius: 8, border: "none", background: saving || annotations.length === 0 ? "rgba(197,160,89,0.3)" : "linear-gradient(135deg,#C5A059,#A8853A)", fontSize: 12, fontWeight: 600, color: "white", cursor: saving || annotations.length === 0 ? "not-allowed" : "pointer" }}>
          <Save size={12} /> {saving ? "Saving…" : "Save Chart"}
        </button>
      </div>

      <p style={{ fontSize: 11, color: "#9CA3AF", fontStyle: "italic", margin: "-12px 0 0" }}>
        Click anywhere on the diagram to place a treatment pin. Click a pin to edit it.
      </p>

      {/* Main layout: SVG canvas + annotation sidebar */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, minHeight: 500 }}>
        {/* SVG Canvas */}
        <div style={{ borderRadius: 14, border: "1px solid rgba(197,160,89,0.2)", background: "white", position: "relative", overflow: "hidden" }}>
          <div
            ref={svgContainerRef}
            onClick={handleCanvasClick}
            style={{ position: "relative", width: "100%", height: "100%", minHeight: 500, cursor: "crosshair" }}>
            {/* SVG Diagram */}
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
              {diagramType === "face" ? <FaceSVG /> : <BodyFrontSVG />}
            </div>

            {/* Pins */}
            {annotations.map(pin => (
              <PinMarker
                key={pin.id}
                pin={pin}
                selected={selectedPin === pin.id}
                onClick={e => {
                  e.stopPropagation();
                  setSelectedPin(pin.id === selectedPin ? null : pin.id);
                  setEditingPin(pin.id === selectedPin ? null : pin);
                }}
              />
            ))}
          </div>
        </div>

        {/* Annotation Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {editingPinData ? (
            <PinEditor
              pin={editingPinData}
              onChange={updates => updatePin(editingPinData.id, updates)}
              onRemove={() => removePin(editingPinData.id)}
              onClose={() => { setSelectedPin(null); setEditingPin(null); }}
            />
          ) : (
            <div style={{ padding: 16, borderRadius: 12, border: "1px solid rgba(197,160,89,0.15)", background: "white" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 8 }}>Annotation Legend</p>
              {annotations.length === 0 ? (
                <p style={{ fontSize: 12, color: "#9CA3AF", fontStyle: "italic" }}>No pins placed yet. Click on the diagram to start annotating.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {annotations.map((pin, i) => (
                    <div key={pin.id}
                      onClick={() => { setSelectedPin(pin.id); setEditingPin(pin); }}
                      style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", borderRadius: 8, background: selectedPin === pin.id ? "rgba(197,160,89,0.08)" : "transparent", border: `1px solid ${selectedPin === pin.id ? "rgba(197,160,89,0.3)" : "transparent"}`, cursor: "pointer" }}>
                      <span style={{ width: 16, height: 16, borderRadius: "50%", background: pin.color, flexShrink: 0, marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "white", fontWeight: 700 }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "#1C1917", margin: 0 }}>{pin.area || "Unlabelled"}</p>
                        {pin.product && <p style={{ fontSize: 11, color: "#6B7280", margin: "1px 0 0" }}>{pin.product}{pin.dose ? ` — ${pin.dose}` : ""}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Past charts quick summary */}
          {charts.length > 0 && showPastPins && (
            <div style={{ padding: 14, borderRadius: 12, border: "1px solid rgba(197,160,89,0.15)", background: "white" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Visit History</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {charts.slice(0, 5).map(c => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px", borderRadius: 6, background: c.id === activeChartId ? "rgba(197,160,89,0.08)" : "transparent" }}>
                    <span style={{ fontSize: 11, color: "#5C5447" }}>{fmtDate(c.visit_date)}</span>
                    <span style={{ fontSize: 10, color: "#9CA3AF" }}>{(c.annotations as PinAnnotation[]).length} pins</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────── Pin Marker ──────────────────────────────────────────

function PinMarker({ pin, selected, onClick }: { pin: PinAnnotation; selected: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: "absolute",
        left: `${pin.x}%`,
        top: `${pin.y}%`,
        transform: "translate(-50%, -50%)",
        zIndex: selected ? 20 : 10,
        cursor: "pointer",
      }}>
      <div style={{
        width: selected ? 22 : 18, height: selected ? 22 : 18,
        borderRadius: "50% 50% 50% 0",
        transform: "rotate(-45deg)",
        background: pin.color,
        border: selected ? "2px solid #1C1917" : "2px solid white",
        boxShadow: selected ? "0 2px 10px rgba(0,0,0,0.3)" : "0 1px 6px rgba(0,0,0,0.2)",
        transition: "all 0.15s",
      }} />
      {selected && pin.product && (
        <div style={{
          position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)",
          background: "#1C1917", color: "white", fontSize: 10, padding: "3px 7px",
          borderRadius: 6, whiteSpace: "nowrap", marginBottom: 4,
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        }}>
          {pin.product}{pin.dose ? ` — ${pin.dose}` : ""}
        </div>
      )}
    </div>
  );
}

// ─────────────────────── Pin Editor ──────────────────────────────────────────

function PinEditor({ pin, onChange, onRemove, onClose }: {
  pin: PinAnnotation;
  onChange: (updates: Partial<PinAnnotation>) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const inputSt: React.CSSProperties = {
    width: "100%", padding: "7px 10px", borderRadius: 7,
    border: "1px solid rgba(197,160,89,0.25)", background: "white",
    fontSize: 12, fontFamily: "Georgia, serif", color: "#1C1917",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ padding: 14, borderRadius: 12, border: "1px solid rgba(197,160,89,0.3)", background: "white", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#1C1917", margin: 0 }}>Edit Pin</p>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onRemove} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid rgba(220,38,38,0.2)", background: "rgba(220,38,38,0.06)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Trash2 size={11} color="#DC2626" />
          </button>
          <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid rgba(197,160,89,0.2)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={11} color="#9C9584" />
          </button>
        </div>
      </div>

      <div>
        <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B7280", display: "block", marginBottom: 4 }}>Area</label>
        <input value={pin.area} onChange={e => onChange({ area: e.target.value })} placeholder="e.g. Forehead, Nasolabial fold…" style={inputSt} />
      </div>

      <div>
        <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B7280", display: "block", marginBottom: 4 }}>Product / Filler</label>
        <input value={pin.product} onChange={e => onChange({ product: e.target.value })} placeholder="e.g. Juvederm Ultra, Botox…" style={inputSt} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B7280", display: "block", marginBottom: 4 }}>Dose</label>
          <input value={pin.dose} onChange={e => onChange({ dose: e.target.value })} placeholder="e.g. 0.5ml, 20u" style={inputSt} />
        </div>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B7280", display: "block", marginBottom: 4 }}>Depth</label>
          <select value={pin.depth} onChange={e => onChange({ depth: e.target.value })} style={inputSt}>
            {DEPTH_OPTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B7280", display: "block", marginBottom: 4 }}>Color</label>
        <div style={{ display: "flex", gap: 6 }}>
          {AREA_COLORS.map(c => (
            <button key={c} onClick={() => onChange({ color: c })}
              style={{ width: 22, height: 22, borderRadius: "50%", background: c, border: pin.color === c ? "2px solid #1C1917" : "2px solid transparent", cursor: "pointer" }} />
          ))}
        </div>
      </div>

      <div>
        <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B7280", display: "block", marginBottom: 4 }}>Notes</label>
        <textarea value={pin.notes} onChange={e => onChange({ notes: e.target.value })} placeholder="Technique, batch number, observations…" rows={2}
          style={{ ...inputSt, resize: "none" }} />
      </div>
    </div>
  );
}
