"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Images } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface RefPhoto {
  id: string;
  treatment: string;
  brand_name: string | null;
  condition: string | null;
  body_area: string | null;
  before_url: string;
  after_url: string;
  notes: string | null;
  title: string;
}

interface Props {
  treatmentName: string;
  clinicId: string;
  onClose: () => void;
}

export default function ReferenceGalleryModal({ treatmentName, clinicId, onClose }: Props) {
  const [photos, setPhotos]       = useState<RefPhoto[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<RefPhoto | null>(null);
  const [viewMode, setViewMode]   = useState<"sidebyside" | "slider">("sidebyside");
  const [sliderPct, setSliderPct] = useState(50);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("before_after_photos")
      .select("id, treatment, brand_name, condition, body_area, before_url, after_url, notes, title")
      .eq("clinic_id", clinicId)
      .eq("is_reference", true)
      .ilike("treatment", `%${treatmentName}%`)
      .limit(20);
    setPhotos(data as RefPhoto[] ?? []);
    setLoading(false);
  }, [clinicId, treatmentName]);

  useEffect(() => { fetch(); }, [fetch]);

  const navPhoto = (dir: -1 | 1) => {
    if (!selected) return;
    const idx = photos.findIndex(p => p.id === selected.id);
    const next = photos[idx + dir];
    if (next) setSelected(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="flex flex-col rounded-2xl overflow-hidden shadow-2xl" style={{ background: "#F9F7F2", width: 860, maxHeight: "90vh", maxWidth: "95vw" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ background: "#fff", borderBottom: "1px solid rgba(197,160,89,0.15)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(197,160,89,0.1)", border: "1px solid rgba(197,160,89,0.2)" }}>
              <Images size={15} style={{ color: "var(--gold)" }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>
                Reference — {treatmentName}
              </p>
              <p className="text-xs" style={{ color: "#9ca3af" }}>{photos.length} brand reference photo{photos.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ border: "1px solid rgba(197,160,89,0.2)" }}>
            <X size={14} style={{ color: "#9ca3af" }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm" style={{ color: "#9ca3af" }}>Loading…</p>
            </div>
          ) : photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Images size={40} style={{ color: "rgba(197,160,89,0.3)" }} />
              <p className="text-sm font-medium" style={{ color: "#6b7280" }}>No brand reference available</p>
              <p className="text-xs text-center" style={{ color: "#9ca3af", maxWidth: 320 }}>
                Upload brand / manufacturer before–after photos in Photos → Reference Library
              </p>
            </div>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
              {photos.map(photo => (
                <button key={photo.id} onClick={() => { setSelected(photo); setSliderPct(50); }}
                  className="rounded-xl overflow-hidden text-left transition-all hover:shadow-md"
                  style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.12)" }}>
                  <div className="flex">
                    <img src={photo.before_url} alt="Before" className="flex-1 object-cover" style={{ height: 110, minWidth: 0 }} />
                    <img src={photo.after_url}  alt="After"  className="flex-1 object-cover" style={{ height: 110, minWidth: 0 }} />
                  </div>
                  <div className="px-3 py-2">
                    {photo.brand_name && (
                      <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium mb-1" style={{ background: "rgba(124,58,237,0.1)", color: "#7c3aed" }}>{photo.brand_name}</span>
                    )}
                    <p className="text-xs font-medium truncate" style={{ color: "#1a1714" }}>{photo.title || photo.treatment}</p>
                    {(photo.condition || photo.body_area) && (
                      <p className="text-xs truncate" style={{ color: "#9ca3af" }}>{[photo.condition, photo.body_area].filter(Boolean).join(" · ")}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Comparison modal */}
      {selected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
          <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: "#1a1714", width: 820, maxWidth: "95vw", maxHeight: "90vh" }}>
            {/* Comparison header */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-3">
                {selected.brand_name && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(124,58,237,0.25)", color: "#c4b5fd" }}>{selected.brand_name}</span>
                )}
                <span className="text-sm font-medium" style={{ color: "#f9f7f2", fontFamily: "Georgia, serif" }}>{selected.title || selected.treatment}</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Nav arrows */}
                <button onClick={() => navPhoto(-1)} disabled={photos.findIndex(p => p.id === selected.id) === 0}
                  className="w-7 h-7 flex items-center justify-center rounded-lg disabled:opacity-30"
                  style={{ background: "rgba(255,255,255,0.1)" }}>
                  <ChevronLeft size={14} style={{ color: "#f9f7f2" }} />
                </button>
                <button onClick={() => navPhoto(1)} disabled={photos.findIndex(p => p.id === selected.id) === photos.length - 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg disabled:opacity-30"
                  style={{ background: "rgba(255,255,255,0.1)" }}>
                  <ChevronRight size={14} style={{ color: "#f9f7f2" }} />
                </button>
                {/* View toggle */}
                <div className="flex rounded-lg overflow-hidden ml-1" style={{ border: "1px solid rgba(255,255,255,0.15)" }}>
                  {(["sidebyside", "slider"] as const).map(m => (
                    <button key={m} onClick={() => setViewMode(m)}
                      className="px-3 py-1.5 text-xs font-medium"
                      style={viewMode === m
                        ? { background: "rgba(197,160,89,0.4)", color: "#f9f7f2" }
                        : { background: "transparent", color: "rgba(255,255,255,0.5)" }}>
                      {m === "sidebyside" ? "Side by Side" : "Slider"}
                    </button>
                  ))}
                </div>
                <button onClick={() => setSelected(null)} className="w-7 h-7 flex items-center justify-center rounded-lg ml-1"
                  style={{ background: "rgba(255,255,255,0.1)" }}>
                  <X size={14} style={{ color: "#f9f7f2" }} />
                </button>
              </div>
            </div>

            {/* Comparison view */}
            <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
              {viewMode === "sidebyside" ? (
                <div className="flex h-full" style={{ maxHeight: 460 }}>
                  <div className="flex-1 relative">
                    <img src={selected.before_url} alt="Before" className="w-full h-full object-cover" />
                    <div className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded font-medium" style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}>Before</div>
                  </div>
                  <div className="w-px" style={{ background: "rgba(255,255,255,0.15)" }} />
                  <div className="flex-1 relative">
                    <img src={selected.after_url} alt="After" className="w-full h-full object-cover" />
                    <div className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded font-medium" style={{ background: "rgba(197,160,89,0.8)", color: "#fff" }}>After</div>
                  </div>
                </div>
              ) : (
                <div className="relative overflow-hidden" style={{ height: 460 }}>
                  <img src={selected.after_url} alt="After" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 overflow-hidden" style={{ width: `${sliderPct}%` }}>
                    <img src={selected.before_url} alt="Before" className="absolute inset-0 w-full h-full object-cover" style={{ minWidth: `${10000 / sliderPct}%` }} />
                  </div>
                  <div className="absolute top-0 bottom-0 w-0.5" style={{ left: `${sliderPct}%`, background: "#C5A059", transform: "translateX(-50%)" }}>
                    <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ background: "#C5A059", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
                      <ChevronLeft size={12} style={{ color: "#fff", marginRight: -2 }} />
                      <ChevronRight size={12} style={{ color: "#fff", marginLeft: -2 }} />
                    </div>
                  </div>
                  <input type="range" min={5} max={95} value={sliderPct}
                    onChange={e => setSliderPct(Number(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-col-resize" style={{ height: "100%" }} />
                  <div className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded font-medium" style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}>Before</div>
                  <div className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded font-medium" style={{ background: "rgba(197,160,89,0.8)", color: "#fff" }}>After</div>
                </div>
              )}
            </div>

            {/* Notes */}
            {selected.notes && (
              <div className="px-5 py-3 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{selected.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
