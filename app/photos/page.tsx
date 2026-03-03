"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  SplitSquareHorizontal, Search, X, Plus, Download, Trash2, Edit2,
  Loader2, Calendar, Tag, User, Stethoscope, Building2, RefreshCw,
  Camera, CheckCircle2, ChevronLeft, ChevronRight, ZoomIn, Layers,
  Shield, Eye, EyeOff, Info, Star, Images,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import { useRealtimePermissions } from "@/hooks/useRealtimePermissions";
import { toast } from "sonner";
import TopBar from "@/components/TopBar";
import { logAction } from "@/lib/audit";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BAPhoto {
  id: string;
  clinic_id: string;
  patient_id: string | null;
  title: string;
  treatment: string;
  condition: string | null;
  body_area: string | null;
  visit_date: string | null;
  visit_number: number | null;
  before_url: string;
  after_url: string;
  before_path: string | null;
  after_path: string | null;
  tags: string[];
  notes: string | null;
  consent_given: boolean;
  show_in_gallery: boolean;
  show_to_patient: boolean;
  show_in_counselling: boolean;
  is_reference: boolean;
  brand_name: string | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  created_at: string;
  patient_name: string | null;
}

interface PatientOpt { id: string; full_name: string; }

// ── Constants ─────────────────────────────────────────────────────────────────

const TREATMENTS = [
  "Botox / Wrinkle Relaxers", "Dermal Fillers", "Lip Enhancement",
  "Rhinoplasty (Non-Surgical)", "Skin Brightening", "PRP Therapy",
  "Chemical Peels", "Laser Hair Removal", "Laser Skin Resurfacing",
  "Thread Lift", "Hydrafacial", "Microneedling", "Acne Treatment",
  "Pigmentation Treatment", "Body Contouring", "Skin Tightening",
  "Under-Eye Filler", "Jawline Contouring", "Other",
];

const BODY_AREAS = [
  "Full Face", "Upper Face", "Mid Face", "Lower Face", "Forehead",
  "Eyes / Periorbital", "Nose", "Cheeks", "Lips", "Jawline / Chin",
  "Neck", "Décolletage", "Hands", "Body", "Other",
];

const CONDITIONS = [
  "Fine Lines", "Deep Wrinkles", "Volume Loss", "Facial Asymmetry",
  "Skin Laxity", "Acne & Scarring", "Pigmentation / Melasma", "Rosacea",
  "Dull Skin", "Dark Circles", "Hair Loss", "Body Fat", "Uneven Skin Tone", "Other",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BeforeAfterGalleryPage() {
  const { profile, activeClinicId, loading: profileLoading } = useClinic();
  const { can } = useRealtimePermissions();

  const isAdmin     = ["superadmin", "chain_admin", "clinic_admin"].includes(profile?.role ?? "");
  const canDownload = isAdmin || can("photos.download");
  const canUpload   = isAdmin || can("photos.upload");
  const canDelete   = isAdmin;

  const [photos,        setPhotos]        = useState<BAPhoto[]>([]);
  const [patients,      setPatients]      = useState<PatientOpt[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [filterArea,    setFilterArea]    = useState("all");
  const [filterTreat,   setFilterTreat]   = useState("all");
  const [filterBrand,   setFilterBrand]   = useState("all");
  const [selectedPhoto, setSelectedPhoto] = useState<BAPhoto | null>(null);
  const [uploadOpen,    setUploadOpen]    = useState(false);
  const [editPhoto,     setEditPhoto]     = useState<BAPhoto | null>(null);
  const [photoTab,      setPhotoTab]      = useState<"patient_results" | "reference_library">("patient_results");
  const [refUploadOpen, setRefUploadOpen] = useState(false);

  const fetchPhotos = useCallback(async () => {
    if (!activeClinicId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("before_after_photos")
      .select("*, patients(full_name)")
      .eq("clinic_id", activeClinicId)
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load gallery");
    else setPhotos((data ?? []).map((p: Record<string, unknown>) => ({
      ...(p as unknown as BAPhoto),
      patient_name: (p.patients as { full_name: string } | null)?.full_name ?? null,
    })));
    setLoading(false);
  }, [activeClinicId]);

  const fetchPatients = useCallback(async () => {
    if (!activeClinicId) return;
    const { data } = await supabase
      .from("patients").select("id, full_name")
      .eq("clinic_id", activeClinicId).order("full_name").limit(300);
    setPatients(data ?? []);
  }, [activeClinicId]);

  useEffect(() => {
    if (profileLoading) return;
    fetchPhotos(); fetchPatients();
  }, [fetchPhotos, fetchPatients, profileLoading]);

  const patientPhotos   = useMemo(() => photos.filter(p => !p.is_reference), [photos]);
  const referencePhotos = useMemo(() => photos.filter(p => p.is_reference),  [photos]);
  const activePhotos    = photoTab === "patient_results" ? patientPhotos : referencePhotos;

  const uniqueAreas      = useMemo(() => [...new Set(activePhotos.map(p => p.body_area).filter(Boolean))] as string[], [activePhotos]);
  const uniqueTreatments = useMemo(() => [...new Set(activePhotos.map(p => p.treatment))], [activePhotos]);
  const uniqueBrands     = useMemo(() => [...new Set(referencePhotos.map(p => p.brand_name).filter(Boolean))] as string[], [referencePhotos]);

  const filtered = useMemo(() => {
    let list = activePhotos;
    if (filterArea  !== "all") list = list.filter(p => p.body_area  === filterArea);
    if (filterTreat !== "all") list = list.filter(p => p.treatment  === filterTreat);
    if (photoTab === "reference_library" && filterBrand !== "all") list = list.filter(p => p.brand_name === filterBrand);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.treatment.toLowerCase().includes(q) ||
        (p.condition  ?? "").toLowerCase().includes(q) ||
        (p.body_area  ?? "").toLowerCase().includes(q) ||
        (p.brand_name ?? "").toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q)) ||
        (p.title      ?? "").toLowerCase().includes(q) ||
        (p.notes      ?? "").toLowerCase().includes(q) ||
        (p.patient_name ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [activePhotos, search, filterArea, filterTreat, filterBrand, photoTab]);

  const stats = useMemo(() => ({
    total:      patientPhotos.length,
    treatments: new Set(patientPhotos.map(p => p.treatment)).size,
    patients:   new Set(patientPhotos.map(p => p.patient_id).filter(Boolean)).size,
    references: referencePhotos.length,
  }), [patientPhotos, referencePhotos]);

  async function handleDelete(photo: BAPhoto) {
    if (!confirm("Delete this Before & After pair? This cannot be undone.")) return;
    const { error } = await supabase.from("before_after_photos").delete().eq("id", photo.id);
    if (error) { toast.error(error.message); return; }
    const paths = [photo.before_path, photo.after_path].filter(Boolean) as string[];
    if (paths.length) await supabase.storage.from("patient-photos").remove(paths);
    toast.success("Photo pair deleted.");
    setSelectedPhoto(null);
    fetchPhotos();
    logAction({ action: "delete_ba_photo", targetId: photo.id, targetName: photo.title, metadata: { treatment: photo.treatment } });
  }

  async function handleDownload(photo: BAPhoto) {
    if (!canDownload) { toast.error("You don't have permission to download photos."); return; }
    const dl = (url: string, name: string) => {
      const a = document.createElement("a"); a.href = url; a.download = name; a.target = "_blank"; a.click();
    };
    const base = `${photo.treatment}${photo.body_area ? ` - ${photo.body_area}` : ""}${photo.patient_name ? ` - ${photo.patient_name}` : ""}`;
    dl(photo.before_url, `${base} - BEFORE.jpg`);
    setTimeout(() => dl(photo.after_url, `${base} - AFTER.jpg`), 350);
    logAction({ action: "download_ba_photo", targetId: photo.id, targetName: photo.title, metadata: { treatment: photo.treatment } });
    toast.success("Downloading…");
  }

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes skeletonPulse { 0%,100% { opacity: 0.35; } 50% { opacity: 0.6; } }
        .ba-card { transition: transform 0.28s cubic-bezier(0.34,1.2,0.64,1), box-shadow 0.28s ease; }
        .ba-card:hover { transform: translateY(-5px); box-shadow: 0 20px 50px rgba(0,0,0,0.4), 0 0 0 1px rgba(197,160,89,0.35) !important; }
        .ba-card:hover .ba-overlay { opacity: 1; }
        .ba-overlay { transition: opacity 0.2s ease; opacity: 0; }
        .ba-card:hover .ba-actions { opacity: 1; }
        .ba-actions { transition: opacity 0.2s ease; opacity: 0; }
        .slider-cursor { cursor: ew-resize; }
      `}</style>

      <div className="min-h-full" style={{ background: "var(--background)" }}>
        <TopBar />
        <div className="px-6 py-6 max-w-[1440px] mx-auto space-y-6">

          {/* ── Header ── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(197,160,89,0.2), rgba(168,133,58,0.08))", border: "1px solid rgba(197,160,89,0.3)" }}>
                <SplitSquareHorizontal size={20} style={{ color: "var(--gold)" }} />
              </div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 600, fontFamily: "Georgia, serif", color: "#1C1917", margin: 0, letterSpacing: "-0.01em" }}>
                  Before &amp; After Gallery
                </h1>
                <p style={{ fontSize: 12, color: "#9C9584", margin: 0 }}>
                  Clinical photography · Transformation records · Counselling toolkit
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={fetchPhotos} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(197,160,89,0.2)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <RefreshCw size={14} style={{ color: "#9C9584" }} />
              </button>
              {canUpload && photoTab === "patient_results" && (
                <button
                  onClick={() => setUploadOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "linear-gradient(135deg, #C5A059, #A8853A)", color: "#fff", border: "none", cursor: "pointer", boxShadow: "0 4px 16px rgba(197,160,89,0.4)" }}
                >
                  <Plus size={15} /> Add Photo Pair
                </button>
              )}
              {canUpload && photoTab === "reference_library" && (
                <button
                  onClick={() => setRefUploadOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)", color: "#fff", border: "none", cursor: "pointer", boxShadow: "0 4px 16px rgba(124,58,237,0.4)" }}
                >
                  <Plus size={15} /> Add Reference Photo
                </button>
              )}
            </div>
          </div>

          {/* ── Photo Tabs ── */}
          {activeClinicId && (
            <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: "rgba(197,160,89,0.08)", border: "1px solid rgba(197,160,89,0.15)" }}>
              {([["patient_results", "Patient Results"], ["reference_library", "Reference Library"]] as const).map(([t, label]) => (
                <button key={t} onClick={() => { setPhotoTab(t); setSearch(""); setFilterArea("all"); setFilterTreat("all"); setFilterBrand("all"); }}
                  className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
                  style={photoTab === t ? { background: "var(--gold)", color: "#fff", fontFamily: "Georgia, serif" } : { color: "rgba(197,160,89,0.7)" }}>
                  {label}
                  {t === "reference_library" && stats.references > 0 && (
                    <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.2)", color: photoTab === t ? "#fff" : "rgba(197,160,89,0.7)" }}>{stats.references}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* ── No-clinic state ── */}
          {!profileLoading && !activeClinicId && (
            <div className="rounded-2xl p-16 text-center" style={{ background: "white", border: "1px dashed rgba(197,160,89,0.3)" }}>
              <Building2 size={36} className="mx-auto mb-3" style={{ color: "rgba(197,160,89,0.4)" }} />
              <p className="text-sm font-medium" style={{ color: "#9C9584" }}>Select a clinic from the top bar to view the gallery</p>
            </div>
          )}

          {activeClinicId && (
            <>
              {/* ── Stats ── */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: "Patient Photo Pairs", value: stats.total,      Icon: Layers,       color: "#C5A059", bg: "rgba(197,160,89,0.08)"  },
                  { label: "Treatments Covered",  value: stats.treatments, Icon: Stethoscope,  color: "#6366F1", bg: "rgba(99,102,241,0.08)"  },
                  { label: "Patients Documented", value: stats.patients,   Icon: User,         color: "#4A8A4A", bg: "rgba(74,138,74,0.08)"   },
                  { label: "Brand References",    value: stats.references, Icon: Star,         color: "#7c3aed", bg: "rgba(124,58,237,0.08)"  },
                ].map(c => (
                  <div key={c.label} className="rounded-2xl p-5" style={{ background: "white", border: "1px solid rgba(197,160,89,0.15)" }}>
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#9C9584" }}>{c.label}</p>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: c.bg }}>
                        <c.Icon size={16} style={{ color: c.color }} />
                      </div>
                    </div>
                    {loading
                      ? <div className="h-7 w-12 rounded animate-pulse" style={{ background: "rgba(197,160,89,0.08)" }} />
                      : <p className="text-2xl font-bold" style={{ color: "#1C1917", fontFamily: "Georgia, serif" }}>{c.value}</p>
                    }
                  </div>
                ))}
              </div>

              {/* ── Search & Filters ── */}
              <div className="rounded-2xl p-4" style={{ background: "white", border: "1px solid rgba(197,160,89,0.15)" }}>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative flex-1 min-w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#9C9584" }} />
                    <input
                      type="text"
                      placeholder="Search by treatment, condition, area, tags… e.g. Botox Upper Face"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm outline-none"
                      style={{ background: "rgba(249,247,242,0.9)", border: "1px solid rgba(197,160,89,0.2)", color: "#1C1917", fontFamily: "Georgia, serif" }}
                    />
                    {search && (
                      <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                        <X size={12} style={{ color: "#9C9584" }} />
                      </button>
                    )}
                  </div>

                  <select value={filterTreat} onChange={e => setFilterTreat(e.target.value)}
                    className="py-2.5 pl-3 pr-7 rounded-xl text-sm outline-none appearance-none"
                    style={{ background: filterTreat !== "all" ? "rgba(197,160,89,0.1)" : "rgba(249,247,242,0.9)", border: "1px solid rgba(197,160,89,0.2)", color: filterTreat !== "all" ? "#8B6914" : "#6B6358" }}>
                    <option value="all">All Treatments</option>
                    {uniqueTreatments.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>

                  {photoTab === "patient_results" && (
                    <select value={filterArea} onChange={e => setFilterArea(e.target.value)}
                      className="py-2.5 pl-3 pr-7 rounded-xl text-sm outline-none appearance-none"
                      style={{ background: filterArea !== "all" ? "rgba(197,160,89,0.1)" : "rgba(249,247,242,0.9)", border: "1px solid rgba(197,160,89,0.2)", color: filterArea !== "all" ? "#8B6914" : "#6B6358" }}>
                      <option value="all">All Areas</option>
                      {uniqueAreas.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  )}

                  {photoTab === "reference_library" && (
                    <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)}
                      className="py-2.5 pl-3 pr-7 rounded-xl text-sm outline-none appearance-none"
                      style={{ background: filterBrand !== "all" ? "rgba(124,58,237,0.1)" : "rgba(249,247,242,0.9)", border: "1px solid rgba(197,160,89,0.2)", color: filterBrand !== "all" ? "#7c3aed" : "#6B6358" }}>
                      <option value="all">All Brands</option>
                      {uniqueBrands.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  )}

                  {(search || filterArea !== "all" || filterTreat !== "all" || filterBrand !== "all") && (
                    <button onClick={() => { setSearch(""); setFilterArea("all"); setFilterTreat("all"); setFilterBrand("all"); }}
                      className="flex items-center gap-1.5 text-xs px-3 py-2.5 rounded-xl"
                      style={{ border: "1px solid rgba(197,160,89,0.2)", color: "#9C9584", background: "transparent", cursor: "pointer" }}>
                      <X size={11} /> Clear
                    </button>
                  )}

                  <span className="text-xs ml-auto" style={{ color: "#B8AE9C" }}>
                    {filtered.length} of {photos.length} pair{photos.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* ── Gallery ── */}
              {loading ? (
                <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(370px, 1fr))" }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-2xl overflow-hidden" style={{ height: 340, background: "#1A1714", animation: "skeletonPulse 1.5s ease infinite", animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="rounded-2xl p-20 text-center" style={{ background: "white", border: "1px dashed rgba(197,160,89,0.25)" }}>
                  <Camera size={40} className="mx-auto mb-4" style={{ color: "rgba(197,160,89,0.3)" }} />
                  <p style={{ fontFamily: "Georgia, serif", color: "#6B6358", fontSize: 17, marginBottom: 8 }}>
                    {search ? "No results match your search" : "No photo pairs in the gallery yet"}
                  </p>
                  <p style={{ color: "#B8AE9C", fontSize: 13, marginBottom: 24 }}>
                    {search ? "Try different keywords or clear the filters" : "Upload before & after pairs to build the counselling gallery"}
                  </p>
                  {canUpload && !search && (
                    <button onClick={() => setUploadOpen(true)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 22px", borderRadius: 12, background: "linear-gradient(135deg, #C5A059, #A8853A)", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                      <Plus size={15} /> Upload First Photo Pair
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(370px, 1fr))" }}>
                  {filtered.map((photo, idx) => (
                    <PhotoCard
                      key={photo.id}
                      photo={photo}
                      idx={idx}
                      canDownload={canDownload}
                      canDelete={canDelete}
                      onView={() => setSelectedPhoto(photo)}
                      onEdit={() => { setEditPhoto(photo); setUploadOpen(true); }}
                      onDelete={() => handleDelete(photo)}
                      onDownload={() => handleDownload(photo)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Comparison Modal ── */}
      {selectedPhoto && (
        <ComparisonModal
          photo={selectedPhoto}
          canDownload={canDownload}
          canDelete={canDelete}
          onClose={() => setSelectedPhoto(null)}
          onDelete={() => handleDelete(selectedPhoto)}
          onDownload={() => handleDownload(selectedPhoto)}
          onEdit={() => { setEditPhoto(selectedPhoto); setSelectedPhoto(null); setUploadOpen(true); }}
        />
      )}

      {/* ── Upload / Edit Drawer (Patient Results) ── */}
      {uploadOpen && (
        <UploadDrawer
          clinicId={activeClinicId!}
          patients={patients}
          profile={profile ? { ...profile, role: profile.role ?? undefined } : null}
          editPhoto={editPhoto}
          onClose={() => { setUploadOpen(false); setEditPhoto(null); fetchPhotos(); }}
        />
      )}

      {/* ── Reference Library Upload Drawer ── */}
      {refUploadOpen && (
        <ReferenceUploadDrawer
          clinicId={activeClinicId!}
          profile={profile ? { ...profile, role: profile.role ?? undefined } : null}
          onClose={() => { setRefUploadOpen(false); fetchPhotos(); }}
        />
      )}
    </>
  );
}

// ── Photo Card ────────────────────────────────────────────────────────────────

function PhotoCard({ photo, idx, canDownload, canDelete, onView, onEdit, onDelete, onDownload }: {
  photo: BAPhoto; idx: number;
  canDownload: boolean; canDelete: boolean;
  onView: () => void; onEdit: () => void;
  onDelete: () => void; onDownload: () => void;
}) {
  return (
    <div
      className="ba-card rounded-2xl overflow-hidden cursor-pointer group"
      style={{
        background: "#0F0D0A",
        border: "1px solid rgba(197,160,89,0.18)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
        animation: `fadeUp 0.4s ease both`,
        animationDelay: `${Math.min(idx * 0.04, 0.4)}s`,
      }}
      onClick={onView}
    >
      {/* ── Split image ── */}
      <div style={{ height: 250, position: "relative", overflow: "hidden", background: "#000" }}>
        {/* Before — left half */}
        <div style={{ position: "absolute", inset: 0, right: "50%", overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.before_url} alt="Before" style={{ width: "200%", height: "100%", objectFit: "cover" }} />
        </div>
        {/* After — right half */}
        <div style={{ position: "absolute", inset: 0, left: "50%", overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.after_url} alt="After" style={{ position: "absolute", right: 0, width: "200%", height: "100%", objectFit: "cover" }} />
        </div>

        {/* Gold centre divider */}
        <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", transform: "translateX(-50%)", width: 2, background: "linear-gradient(to bottom, transparent 0%, #C5A059 15%, #C5A059 85%, transparent 100%)", zIndex: 2 }} />

        {/* Centre icon */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 34, height: 34, borderRadius: "50%", background: "rgba(197,160,89,0.92)", border: "2px solid rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3, boxShadow: "0 2px 12px rgba(197,160,89,0.5)" }}>
          <SplitSquareHorizontal size={14} style={{ color: "white" }} />
        </div>

        {/* Before / After labels */}
        <span style={{ position: "absolute", bottom: 10, left: 10, fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", color: "rgba(255,255,255,0.85)", background: "rgba(0,0,0,0.65)", padding: "3px 8px", borderRadius: 5, textTransform: "uppercase", backdropFilter: "blur(4px)", zIndex: 2 }}>Before</span>
        <span style={{ position: "absolute", bottom: 10, right: 10, fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", color: "white", background: "rgba(197,160,89,0.85)", padding: "3px 8px", borderRadius: 5, textTransform: "uppercase", backdropFilter: "blur(4px)", zIndex: 2 }}>After</span>

        {/* Hover overlay */}
        <div className="ba-overlay" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4, backdropFilter: "blur(2px)" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(197,160,89,0.9)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 24px rgba(197,160,89,0.5)" }}>
            <ZoomIn size={20} style={{ color: "white" }} />
          </div>
        </div>

        {/* Action buttons — top right on hover */}
        <div className="ba-actions" style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 5, zIndex: 5 }}>
          {canDownload && (
            <button onClick={e => { e.stopPropagation(); onDownload(); }}
              style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(0,0,0,0.75)", border: "1px solid rgba(197,160,89,0.4)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
              <Download size={12} style={{ color: "#C5A059" }} />
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); onEdit(); }}
            style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(0,0,0,0.75)", border: "1px solid rgba(197,160,89,0.25)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
            <Edit2 size={11} style={{ color: "rgba(232,226,212,0.7)" }} />
          </button>
          {canDelete && (
            <button onClick={e => { e.stopPropagation(); onDelete(); }}
              style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(0,0,0,0.75)", border: "1px solid rgba(220,38,38,0.35)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
              <Trash2 size={11} style={{ color: "#DC2626" }} />
            </button>
          )}
        </div>

        {/* Consent badge */}
        {photo.consent_given && (
          <div style={{ position: "absolute", top: 8, left: 8, display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, background: "rgba(74,138,74,0.85)", backdropFilter: "blur(4px)", zIndex: 3 }}>
            <CheckCircle2 size={9} style={{ color: "white" }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: "white", letterSpacing: "0.06em", textTransform: "uppercase" }}>Consent</span>
          </div>
        )}
      </div>

      {/* ── Meta ── */}
      <div style={{ padding: "14px 16px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {photo.brand_name && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 5, background: "rgba(124,58,237,0.2)", color: "#c4b5fd", border: "1px solid rgba(124,58,237,0.3)", display: "inline-block", marginBottom: 3 }}>
                {photo.brand_name}
              </span>
            )}
            <p style={{ fontSize: 13, fontWeight: 600, color: "#E8E2D4", fontFamily: "Georgia, serif", margin: 0, lineHeight: 1.3 }}>{photo.treatment}</p>
            {photo.condition && <p style={{ fontSize: 11, color: "rgba(232,226,212,0.45)", margin: "3px 0 0" }}>{photo.condition}</p>}
          </div>
          {photo.body_area && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: "rgba(197,160,89,0.15)", color: "#C5A059", border: "1px solid rgba(197,160,89,0.25)", flexShrink: 0, marginLeft: 8 }}>
              {photo.body_area}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: photo.tags.length ? 8 : 0 }}>
          {photo.patient_name && (
            <span style={{ fontSize: 11, color: "rgba(232,226,212,0.45)", display: "flex", alignItems: "center", gap: 4 }}>
              <User size={10} /> {photo.patient_name}
            </span>
          )}
          {photo.visit_date && (
            <span style={{ fontSize: 11, color: "rgba(232,226,212,0.35)", display: "flex", alignItems: "center", gap: 4 }}>
              <Calendar size={10} /> {fmtDate(photo.visit_date)}
            </span>
          )}
          {photo.visit_number && (
            <span style={{ fontSize: 10, color: "#C5A059", fontWeight: 700 }}>Visit #{photo.visit_number}</span>
          )}
        </div>

        {photo.tags.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {photo.tags.slice(0, 5).map(tag => (
              <span key={tag} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "rgba(197,160,89,0.1)", color: "rgba(197,160,89,0.65)", border: "1px solid rgba(197,160,89,0.15)", letterSpacing: "0.04em" }}>#{tag}</span>
            ))}
            {photo.tags.length > 5 && <span style={{ fontSize: 9, color: "rgba(232,226,212,0.25)" }}>+{photo.tags.length - 5}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Comparison Modal ──────────────────────────────────────────────────────────

function ComparisonModal({ photo, canDownload, canDelete, onClose, onDelete, onDownload, onEdit }: {
  photo: BAPhoto; canDownload: boolean; canDelete: boolean;
  onClose: () => void; onDelete: () => void; onDownload: () => void; onEdit: () => void;
}) {
  const [mode,      setMode]      = useState<"slider" | "side">("slider");
  const [sliderPos, setSliderPos] = useState(50);
  const sliderRef  = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  function updateSlider(clientX: number) {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const pos  = ((clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(2, Math.min(98, pos)));
  }

  useEffect(() => {
    const up = () => { isDragging.current = false; };
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    return () => { window.removeEventListener("mouseup", up); window.removeEventListener("touchend", up); };
  }, []);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 61, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
        <div style={{ width: "100%", maxWidth: 1160, maxHeight: "94vh", display: "flex", flexDirection: "column", background: "#0F0D0A", borderRadius: 24, overflow: "hidden", border: "1px solid rgba(197,160,89,0.25)", boxShadow: "0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(197,160,89,0.1)" }}>

          {/* Header */}
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(197,160,89,0.12)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, background: "rgba(255,255,255,0.02)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "#E8E2D4", fontFamily: "Georgia, serif", margin: 0, lineHeight: 1.2 }}>{photo.treatment}</h2>
              <p style={{ fontSize: 12, color: "rgba(197,160,89,0.6)", margin: "2px 0 0" }}>
                {[photo.condition, photo.body_area].filter(Boolean).join(" · ")}
              </p>
            </div>

            {/* Mode toggle */}
            <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 2, border: "1px solid rgba(197,160,89,0.15)" }}>
              {([["slider", "↔ Slider"], ["side", "Side by Side"]] as const).map(([key, label]) => (
                <button key={key} onClick={() => setMode(key)}
                  style={{ padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", transition: "all 0.15s", background: mode === key ? "rgba(197,160,89,0.22)" : "transparent", color: mode === key ? "#C5A059" : "rgba(232,226,212,0.4)" }}>
                  {label}
                </button>
              ))}
            </div>

            {canDownload && (
              <button onClick={onDownload}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.1)", cursor: "pointer", fontSize: 12, color: "#C5A059", fontWeight: 600 }}>
                <Download size={12} /> Download
              </button>
            )}
            <button onClick={onEdit}
              style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.2)", background: "transparent", cursor: "pointer", fontSize: 12, color: "rgba(232,226,212,0.5)", display: "flex", alignItems: "center", gap: 5 }}>
              <Edit2 size={11} /> Edit
            </button>
            {canDelete && (
              <button onClick={onDelete}
                style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(220,38,38,0.3)", background: "rgba(220,38,38,0.07)", cursor: "pointer", fontSize: 12, color: "#DC2626", display: "flex", alignItems: "center", gap: 5 }}>
                <Trash2 size={11} />
              </button>
            )}
            <button onClick={onClose}
              style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid rgba(197,160,89,0.18)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <X size={16} style={{ color: "rgba(232,226,212,0.5)" }} />
            </button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
            {/* Image */}
            <div style={{ flex: 1, minWidth: 0, position: "relative", background: "#050403", overflow: "hidden" }}>
              {mode === "slider" ? (
                <div
                  ref={sliderRef}
                  className="slider-cursor"
                  style={{ position: "relative", width: "100%", height: "100%", userSelect: "none" }}
                  onMouseDown={() => { isDragging.current = true; }}
                  onMouseMove={e => { if (isDragging.current) updateSlider(e.clientX); }}
                  onTouchStart={() => { isDragging.current = true; }}
                  onTouchMove={e => { if (isDragging.current) updateSlider(e.touches[0].clientX); }}
                  onClick={e => updateSlider(e.clientX)}
                >
                  {/* After (base) */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.after_url} alt="After" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
                  {/* Before (clipped) */}
                  <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${100 - sliderPos}% 0 0)`, pointerEvents: "none" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.before_url} alt="Before" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  </div>

                  {/* Handle line */}
                  <div style={{ position: "absolute", top: 0, bottom: 0, left: `${sliderPos}%`, width: 2, background: "linear-gradient(to bottom, transparent, #C5A059 8%, #C5A059 92%, transparent)", transform: "translateX(-50%)", pointerEvents: "none", zIndex: 10 }}>
                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 46, height: 46, borderRadius: "50%", background: "linear-gradient(135deg, #C5A059, #A8853A)", border: "3px solid rgba(255,255,255,0.9)", boxShadow: "0 4px 20px rgba(197,160,89,0.6)", display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
                      <ChevronLeft size={12} style={{ color: "white" }} />
                      <ChevronRight size={12} style={{ color: "white" }} />
                    </div>
                  </div>

                  {/* Labels */}
                  <span style={{ position: "absolute", bottom: 16, left: 16, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: "white", background: "rgba(0,0,0,0.72)", padding: "4px 12px", borderRadius: 6, textTransform: "uppercase", backdropFilter: "blur(4px)", pointerEvents: "none", zIndex: 5 }}>Before</span>
                  <span style={{ position: "absolute", bottom: 16, right: 16, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: "white", background: "rgba(197,160,89,0.85)", padding: "4px 12px", borderRadius: 6, textTransform: "uppercase", backdropFilter: "blur(4px)", pointerEvents: "none", zIndex: 5 }}>After</span>
                  <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.6)", borderRadius: 8, padding: "4px 14px", backdropFilter: "blur(4px)", pointerEvents: "none", zIndex: 5 }}>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em" }}>↔  DRAG TO COMPARE</span>
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", height: "100%", gap: 2 }}>
                  <div style={{ position: "relative", overflow: "hidden", background: "#080604" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.before_url} alt="Before" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    <span style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: "white", background: "rgba(0,0,0,0.7)", padding: "4px 14px", borderRadius: 6, textTransform: "uppercase", backdropFilter: "blur(4px)", whiteSpace: "nowrap" }}>Before</span>
                  </div>
                  <div style={{ position: "relative", overflow: "hidden", background: "#080604" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.after_url} alt="After" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    <span style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: "white", background: "rgba(197,160,89,0.85)", padding: "4px 14px", borderRadius: 6, textTransform: "uppercase", backdropFilter: "blur(4px)", whiteSpace: "nowrap" }}>After</span>
                  </div>
                </div>
              )}
            </div>

            {/* Meta panel */}
            <div style={{ width: 272, borderLeft: "1px solid rgba(197,160,89,0.12)", overflowY: "auto", padding: "20px 18px", display: "flex", flexDirection: "column", gap: 18, flexShrink: 0, background: "#0B0907" }}>
              <MetaItem label="Treatment" value={photo.treatment} serif />
              {photo.condition  && <MetaItem label="Condition"  value={photo.condition}  />}
              {photo.body_area  && <MetaItem label="Body Area"  value={photo.body_area}  chip />}
              {photo.patient_name && <MetaItem label="Patient"  value={photo.patient_name} serif />}
              {(photo.visit_date || photo.visit_number) && (
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(197,160,89,0.45)", marginBottom: 6 }}>Visit</p>
                  {photo.visit_number && <p style={{ fontSize: 12, color: "#C5A059", fontWeight: 700, margin: 0 }}>Visit #{photo.visit_number}</p>}
                  {photo.visit_date   && <p style={{ fontSize: 12, color: "rgba(232,226,212,0.45)", margin: "3px 0 0" }}>{fmtDate(photo.visit_date)}</p>}
                </div>
              )}
              {photo.tags.length > 0 && (
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(197,160,89,0.45)", marginBottom: 8 }}>Tags</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {photo.tags.map(t => (
                      <span key={t} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, background: "rgba(197,160,89,0.1)", color: "rgba(197,160,89,0.75)", border: "1px solid rgba(197,160,89,0.2)" }}>#{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {photo.notes && <MetaItem label="Notes" value={photo.notes} muted />}

              <div style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid rgba(197,160,89,0.08)" }}>
                {photo.uploaded_by_name && (
                  <p style={{ fontSize: 10, color: "rgba(232,226,212,0.25)", margin: "0 0 4px" }}>Uploaded by {photo.uploaded_by_name}</p>
                )}
                <p style={{ fontSize: 10, color: "rgba(232,226,212,0.2)", margin: 0 }}>{fmtDate(photo.created_at)}</p>
                {photo.consent_given && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
                    <CheckCircle2 size={10} style={{ color: "rgba(74,138,74,0.7)" }} />
                    <span style={{ fontSize: 10, color: "rgba(74,138,74,0.65)" }}>Patient consent recorded</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function MetaItem({ label, value, serif, chip, muted }: { label: string; value: string; serif?: boolean; chip?: boolean; muted?: boolean }) {
  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(197,160,89,0.45)", marginBottom: 5 }}>{label}</p>
      {chip ? (
        <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 6, background: "rgba(197,160,89,0.15)", color: "#C5A059", border: "1px solid rgba(197,160,89,0.3)" }}>{value}</span>
      ) : (
        <p style={{ fontSize: serif ? 14 : 12, fontWeight: serif ? 600 : 400, color: muted ? "rgba(232,226,212,0.5)" : "#E8E2D4", fontFamily: serif ? "Georgia, serif" : "inherit", margin: 0, lineHeight: 1.55 }}>{value}</p>
      )}
    </div>
  );
}

// ── Upload / Edit Drawer ──────────────────────────────────────────────────────

function UploadDrawer({ clinicId, patients, profile, editPhoto, onClose }: {
  clinicId: string; patients: PatientOpt[];
  profile: { id: string; full_name?: string | null; role?: string } | null;
  editPhoto: BAPhoto | null; onClose: () => void;
}) {
  const [patientId,     setPatientId]     = useState(editPhoto?.patient_id ?? "");
  const [patientSearch, setPatientSearch] = useState(editPhoto?.patient_name ?? "");
  const [showPList,     setShowPList]     = useState(false);
  const [treatment,     setTreatment]     = useState(editPhoto?.treatment ?? "");
  const [customTreat,   setCustomTreat]   = useState(!!editPhoto?.treatment && !TREATMENTS.includes(editPhoto.treatment));
  const [condition,     setCondition]     = useState(editPhoto?.condition ?? "");
  const [bodyArea,      setBodyArea]      = useState(editPhoto?.body_area ?? "");
  const [visitDate,     setVisitDate]     = useState(editPhoto?.visit_date ?? "");
  const [visitNumber,   setVisitNumber]   = useState(editPhoto?.visit_number?.toString() ?? "");
  const [tags,          setTags]          = useState<string[]>(editPhoto?.tags ?? []);
  const [tagInput,      setTagInput]      = useState("");
  const [notes,         setNotes]         = useState(editPhoto?.notes ?? "");
  const [consent,            setConsent]            = useState(editPhoto?.consent_given ?? false);
  const [showInGallery,      setShowInGallery]      = useState(editPhoto?.show_in_gallery ?? true);
  const [showToPatient,      setShowToPatient]      = useState(editPhoto?.show_to_patient ?? true);
  const [showInCounselling,  setShowInCounselling]  = useState(editPhoto?.show_in_counselling ?? false);
  const [beforeFile,    setBeforeFile]    = useState<File | null>(null);
  const [afterFile,     setAfterFile]     = useState<File | null>(null);
  const [beforePreview, setBeforePreview] = useState(editPhoto?.before_url ?? "");
  const [afterPreview,  setAfterPreview]  = useState(editPhoto?.after_url ?? "");
  const [saving,        setSaving]        = useState(false);
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef  = useRef<HTMLInputElement>(null);

  const filteredPatients = useMemo(() =>
    patients.filter(p => p.full_name.toLowerCase().includes(patientSearch.toLowerCase())).slice(0, 8),
    [patients, patientSearch]
  );

  function selectPatient(p: PatientOpt) {
    setPatientId(p.id); setPatientSearch(p.full_name); setShowPList(false);
  }
  function clearPatient() { setPatientId(""); setPatientSearch(""); }

  function handleFile(file: File, type: "before" | "after") {
    const preview = URL.createObjectURL(file);
    if (type === "before") { setBeforeFile(file); setBeforePreview(preview); }
    else                   { setAfterFile(file);  setAfterPreview(preview);  }
  }

  function handleDrop(e: React.DragEvent, type: "before" | "after") {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFile(file, type);
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !tags.includes(t)) { setTags(prev => [...prev, t]); }
    setTagInput("");
  }

  function removeTag(t: string) { setTags(prev => prev.filter(x => x !== t)); }

  async function uploadFile(file: File, path: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from("patient-photos")
      .upload(path, file, { contentType: file.type, upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from("patient-photos").getPublicUrl(data.path);
    return publicUrl;
  }

  async function handleSave() {
    const treatVal = treatment.trim();
    if (!treatVal) { toast.error("Treatment is required."); return; }
    if (!editPhoto && (!beforePreview || !afterPreview)) { toast.error("Both Before and After images are required."); return; }
    setSaving(true);
    try {
      let beforeUrl  = editPhoto?.before_url ?? "";
      let afterUrl   = editPhoto?.after_url  ?? "";
      let beforePath = editPhoto?.before_path ?? null;
      let afterPath  = editPhoto?.after_path  ?? null;
      const pairId   = editPhoto?.id ?? crypto.randomUUID();
      const pid      = patientId || "anonymous";

      if (beforeFile) {
        const ext  = beforeFile.name.split(".").pop() ?? "jpg";
        const path = `gallery/${clinicId}/${pid}/${pairId}/before.${ext}`;
        beforeUrl  = await uploadFile(beforeFile, path);
        beforePath = path;
      }
      if (afterFile) {
        const ext  = afterFile.name.split(".").pop() ?? "jpg";
        const path = `gallery/${clinicId}/${pid}/${pairId}/after.${ext}`;
        afterUrl   = await uploadFile(afterFile, path);
        afterPath  = path;
      }

      const row = {
        clinic_id:        clinicId,
        patient_id:       patientId || null,
        title:            treatVal,
        treatment:        treatVal,
        condition:        condition.trim() || null,
        body_area:        bodyArea || null,
        visit_date:       visitDate || null,
        visit_number:     visitNumber ? parseInt(visitNumber) : null,
        before_url:       beforeUrl,
        after_url:        afterUrl,
        before_path:      beforePath,
        after_path:       afterPath,
        tags,
        notes:            notes.trim() || null,
        consent_given:       consent,
        show_in_gallery:     showInGallery,
        show_to_patient:     showToPatient,
        show_in_counselling: showInCounselling,
        is_reference:        false,
        brand_name:          null,
        uploaded_by:         profile?.id ?? null,
        uploaded_by_name:    profile?.full_name ?? null,
      };

      if (editPhoto) {
        const { error } = await supabase.from("before_after_photos").update(row).eq("id", editPhoto.id);
        if (error) throw error;
        toast.success("Photo pair updated.");
      } else {
        const { error } = await supabase.from("before_after_photos").insert({ ...row, id: pairId });
        if (error) throw error;
        toast.success("Photo pair added to gallery.");
      }
      logAction({ action: editPhoto ? "edit_ba_photo" : "upload_ba_photo", targetId: pairId, targetName: treatVal, metadata: { treatment: treatVal, body_area: bodyArea } });
      onClose();
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Upload failed.");
    } finally {
      setSaving(false);
    }
  }

  const hasContent = (!!beforePreview && !!afterPreview) || !!editPhoto;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(28,25,23,0.55)", backdropFilter: "blur(3px)" }} />
      <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, zIndex: 61, width: 540, display: "flex", flexDirection: "column", background: "#F9F7F2", boxShadow: "-12px 0 50px rgba(28,25,23,0.22)", animation: "slideInRight 0.28s ease" }}>

        {/* Header */}
        <div style={{ padding: "18px 22px", background: "white", borderBottom: "1px solid rgba(197,160,89,0.18)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg, rgba(197,160,89,0.2), rgba(168,133,58,0.08))", border: "1px solid rgba(197,160,89,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <SplitSquareHorizontal size={16} style={{ color: "#C5A059" }} />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: 0 }}>
                {editPhoto ? "Edit Photo Pair" : "Upload Before & After"}
              </p>
              <p style={{ fontSize: 11, color: "#9C9584", margin: 0 }}>Clinical photography record</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(197,160,89,0.2)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={15} style={{ color: "#9C9584" }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* ── Image uploads ── */}
          <div>
            <p style={sectionLabel}>Photo Pair *</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {(["before", "after"] as const).map(type => {
                const preview = type === "before" ? beforePreview : afterPreview;
                const ref     = type === "before" ? beforeRef : afterRef;
                return (
                  <div
                    key={type}
                    onClick={() => ref.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => handleDrop(e, type)}
                    style={{ height: 160, borderRadius: 12, border: preview ? "2px solid rgba(197,160,89,0.4)" : "2px dashed rgba(197,160,89,0.3)", background: preview ? "transparent" : "rgba(249,247,242,0.8)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", transition: "border-color 0.2s" }}
                  >
                    {preview ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={preview} alt={type} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.2s" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = "1"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = "0"; }}>
                          <Camera size={18} style={{ color: "white" }} />
                          <span style={{ fontSize: 10, color: "white", marginTop: 4 }}>Change</span>
                        </div>
                        <span style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: "white", background: type === "before" ? "rgba(0,0,0,0.7)" : "rgba(197,160,89,0.85)", padding: "2px 8px", borderRadius: 4, textTransform: "uppercase" }}>
                          {type}
                        </span>
                      </>
                    ) : (
                      <>
                        <Camera size={22} style={{ color: "rgba(197,160,89,0.45)", marginBottom: 6 }} />
                        <p style={{ fontSize: 12, fontWeight: 600, color: "#9C9584", margin: 0, textTransform: "capitalize" }}>{type} Photo</p>
                        <p style={{ fontSize: 10, color: "#B8AE9C", margin: "2px 0 0" }}>Click or drag & drop</p>
                      </>
                    )}
                    <input ref={ref} type="file" accept="image/*" style={{ display: "none" }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f, type); }} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Patient ── */}
          <div style={{ position: "relative" }}>
            <p style={sectionLabel}>Patient (optional)</p>
            <div style={{ position: "relative" }}>
              <User size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#9C9584" }} />
              <input
                value={patientSearch}
                onChange={e => { setPatientSearch(e.target.value); setShowPList(true); if (!e.target.value) clearPatient(); }}
                onFocus={() => setShowPList(true)}
                placeholder="Search patient name…"
                style={{ ...inputStyle, paddingLeft: 32 }}
              />
              {patientId && <button onClick={clearPatient} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer" }}><X size={12} style={{ color: "#9C9584" }} /></button>}
            </div>
            {showPList && filteredPatients.length > 0 && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "white", borderRadius: 10, border: "1px solid rgba(197,160,89,0.25)", boxShadow: "0 8px 30px rgba(28,25,23,0.12)", zIndex: 100, maxHeight: 200, overflowY: "auto" }}>
                {filteredPatients.map(p => (
                  <button key={p.id} onMouseDown={() => selectPatient(p)}
                    style={{ width: "100%", padding: "9px 14px", textAlign: "left", border: "none", background: "transparent", cursor: "pointer", fontSize: 13, color: "#1C1917", fontFamily: "Georgia, serif", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid rgba(197,160,89,0.06)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(197,160,89,0.06)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(197,160,89,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#C5A059", flexShrink: 0 }}>
                      {p.full_name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                    </div>
                    {p.full_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Treatment ── */}
          <div>
            <p style={sectionLabel}>Treatment *</p>
            {customTreat ? (
              <div style={{ display: "flex", gap: 8 }}>
                <input value={treatment} onChange={e => setTreatment(e.target.value)} placeholder="Enter treatment name…" style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => { setCustomTreat(false); setTreatment(""); }}
                  style={{ padding: "0 12px", borderRadius: 10, border: "1px solid rgba(197,160,89,0.2)", background: "transparent", cursor: "pointer", fontSize: 12, color: "#9C9584" }}>
                  List
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <select value={treatment} onChange={e => setTreatment(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                  <option value="">Select treatment…</option>
                  {TREATMENTS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button onClick={() => { setCustomTreat(true); setTreatment(""); }}
                  style={{ padding: "0 12px", borderRadius: 10, border: "1px solid rgba(197,160,89,0.2)", background: "transparent", cursor: "pointer", fontSize: 12, color: "#9C9584", whiteSpace: "nowrap" }}>
                  Custom
                </button>
              </div>
            )}
          </div>

          {/* ── Condition + Body Area ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <p style={sectionLabel}>Condition / Concern</p>
              <select value={condition} onChange={e => setCondition(e.target.value)} style={inputStyle}>
                <option value="">Select condition…</option>
                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <p style={sectionLabel}>Body Area</p>
              <select value={bodyArea} onChange={e => setBodyArea(e.target.value)} style={inputStyle}>
                <option value="">Select area…</option>
                {BODY_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {/* ── Visit ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <p style={sectionLabel}>Visit Date</p>
              <input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <p style={sectionLabel}>Visit Number</p>
              <input type="number" min="1" value={visitNumber} onChange={e => setVisitNumber(e.target.value)} placeholder="e.g. 1" style={inputStyle} />
            </div>
          </div>

          {/* ── Tags ── */}
          <div>
            <p style={sectionLabel}>Tags</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
                placeholder="e.g. botox, upper-face, forehead, 1-session… (Enter to add)"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={addTag} style={{ padding: "0 12px", borderRadius: 10, border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.08)", cursor: "pointer", fontSize: 13, color: "#C5A059", fontWeight: 600 }}>
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {tags.map(t => (
                  <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "rgba(197,160,89,0.1)", color: "#8B6914", border: "1px solid rgba(197,160,89,0.25)" }}>
                    #{t}
                    <button onClick={() => removeTag(t)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9C9584", lineHeight: 1, padding: 0 }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── Notes ── */}
          <div>
            <p style={sectionLabel}>Clinical Notes</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Treatment details, observations, patient response, next steps…"
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.65 }} />
          </div>

          {/* ── Toggles ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <ToggleRow label="Patient consent obtained" sub="Patient agreed to clinical photography use" checked={consent} onChange={setConsent} green />
            <ToggleRow label="Show in clinic gallery" sub="Visible to all clinic staff for counselling" checked={showInGallery} onChange={setShowInGallery} />
            <ToggleRow label="Show to patient" sub="Patient can view their own progress" checked={showToPatient} onChange={setShowToPatient} />
            <ToggleRow label="Show in counselling sessions" sub="Appears in Counselling → Gallery → Our Results" checked={showInCounselling} onChange={setShowInCounselling} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 22px", borderTop: "1px solid rgba(197,160,89,0.18)", background: "white", display: "flex", gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid rgba(197,160,89,0.2)", background: "transparent", cursor: "pointer", fontSize: 13, color: "#9C9584" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !hasContent}
            style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: saving || !hasContent ? "rgba(197,160,89,0.3)" : "linear-gradient(135deg, #C5A059, #A8853A)", cursor: saving || !hasContent ? "not-allowed" : "pointer", color: "white", fontSize: 13, fontWeight: 600, fontFamily: "Georgia, serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: saving || !hasContent ? "none" : "0 4px 16px rgba(197,160,89,0.35)" }}>
            {saving ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Saving…</> : <><CheckCircle2 size={14} /> {editPhoto ? "Save Changes" : "Upload to Gallery"}</>}
          </button>
        </div>
        <style>{`@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </>
  );
}

// ── Shared mini components ────────────────────────────────────────────────────

function ToggleRow({ label, sub, checked, onChange, green }: { label: string; sub: string; checked: boolean; onChange: (v: boolean) => void; green?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: checked ? (green ? "rgba(74,138,74,0.06)" : "rgba(197,160,89,0.06)") : "rgba(249,247,242,0.7)", border: `1px solid ${checked ? (green ? "rgba(74,138,74,0.25)" : "rgba(197,160,89,0.25)") : "rgba(197,160,89,0.12)"}`, transition: "all 0.15s", cursor: "pointer" }} onClick={() => onChange(!checked)}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "#1C1917", margin: 0 }}>{label}</p>
        <p style={{ fontSize: 11, color: "#9C9584", margin: "1px 0 0" }}>{sub}</p>
      </div>
      <div style={{ width: 36, height: 20, borderRadius: 999, background: checked ? (green ? "#4A8A4A" : "#C5A059") : "rgba(197,160,89,0.2)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: 2, left: checked ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "white", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
      </div>
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.08em", color: "#6B6358", marginBottom: 6, display: "block",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 10, boxSizing: "border-box",
  border: "1px solid rgba(197,160,89,0.25)", background: "white",
  fontSize: 13, fontFamily: "Georgia, serif", color: "#1C1917", outline: "none",
};

// ── Reference Library Upload Drawer ──────────────────────────────────────────

function ReferenceUploadDrawer({ clinicId, profile, onClose }: {
  clinicId: string;
  profile: { id: string; full_name?: string | null; role?: string } | null;
  onClose: () => void;
}) {
  const [brandName,     setBrandName]     = useState("");
  const [treatment,     setTreatment]     = useState("");
  const [customTreat,   setCustomTreat]   = useState(false);
  const [condition,     setCondition]     = useState("");
  const [bodyArea,      setBodyArea]      = useState("");
  const [title,         setTitle]         = useState("");
  const [notes,         setNotes]         = useState("");
  const [beforeFile,    setBeforeFile]    = useState<File | null>(null);
  const [afterFile,     setAfterFile]     = useState<File | null>(null);
  const [beforePreview, setBeforePreview] = useState("");
  const [afterPreview,  setAfterPreview]  = useState("");
  const [saving,        setSaving]        = useState(false);
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef  = useRef<HTMLInputElement>(null);

  function handleFile(file: File, type: "before" | "after") {
    const preview = URL.createObjectURL(file);
    if (type === "before") { setBeforeFile(file); setBeforePreview(preview); }
    else                   { setAfterFile(file);  setAfterPreview(preview);  }
  }

  function handleDrop(e: React.DragEvent, type: "before" | "after") {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFile(file, type);
  }

  async function uploadFile(file: File, path: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from("patient-photos")
      .upload(path, file, { contentType: file.type, upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from("patient-photos").getPublicUrl(data.path);
    return publicUrl;
  }

  async function handleSave() {
    if (!treatment.trim()) { toast.error("Treatment is required."); return; }
    if (!beforePreview || !afterPreview) { toast.error("Both Before and After images are required."); return; }
    setSaving(true);
    try {
      const pairId = crypto.randomUUID();
      let beforeUrl = "", afterUrl = "";

      if (beforeFile) {
        const ext  = beforeFile.name.split(".").pop() ?? "jpg";
        beforeUrl  = await uploadFile(beforeFile, `gallery/${clinicId}/reference/${pairId}/before.${ext}`);
      }
      if (afterFile) {
        const ext  = afterFile.name.split(".").pop() ?? "jpg";
        afterUrl   = await uploadFile(afterFile, `gallery/${clinicId}/reference/${pairId}/after.${ext}`);
      }

      const { error } = await supabase.from("before_after_photos").insert({
        id:                  pairId,
        clinic_id:           clinicId,
        patient_id:          null,
        title:               title.trim() || treatment.trim(),
        treatment:           treatment.trim(),
        condition:           condition || null,
        body_area:           bodyArea  || null,
        before_url:          beforeUrl,
        after_url:           afterUrl,
        before_path:         null,
        after_path:          null,
        tags:                [],
        notes:               notes.trim() || null,
        consent_given:       false,
        show_in_gallery:     true,
        show_to_patient:     false,
        show_in_counselling: true,
        is_reference:        true,
        brand_name:          brandName.trim() || null,
        uploaded_by:         profile?.id ?? null,
        uploaded_by_name:    profile?.full_name ?? null,
      });
      if (error) throw error;
      toast.success("Reference photo added to library.");
      logAction({ action: "upload_reference_photo", targetId: pairId, targetName: treatment.trim(), metadata: { brand_name: brandName } });
      onClose();
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Upload failed.");
    } finally {
      setSaving(false);
    }
  }

  const hasContent = !!beforePreview && !!afterPreview;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(28,25,23,0.55)", backdropFilter: "blur(3px)" }} />
      <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, zIndex: 61, width: 500, display: "flex", flexDirection: "column", background: "#F9F7F2", boxShadow: "-12px 0 50px rgba(28,25,23,0.22)", animation: "slideInRight 0.28s ease" }}>

        {/* Header */}
        <div style={{ padding: "18px 22px", background: "white", borderBottom: "1px solid rgba(124,58,237,0.2)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Images size={16} style={{ color: "#7c3aed" }} />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#1C1917", fontFamily: "Georgia, serif", margin: 0 }}>Upload Reference Photo</p>
              <p style={{ fontSize: 11, color: "#9C9584", margin: 0 }}>Brand / manufacturer before–after reference</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(197,160,89,0.2)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={15} style={{ color: "#9C9584" }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Image uploads */}
          <div>
            <p style={sectionLabel}>Photo Pair *</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {(["before", "after"] as const).map(type => {
                const preview = type === "before" ? beforePreview : afterPreview;
                const ref     = type === "before" ? beforeRef : afterRef;
                return (
                  <div key={type}
                    onClick={() => ref.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => handleDrop(e, type)}
                    style={{ height: 160, borderRadius: 12, border: preview ? "2px solid rgba(124,58,237,0.4)" : "2px dashed rgba(124,58,237,0.25)", background: preview ? "transparent" : "rgba(249,247,242,0.8)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                    {preview ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={preview} alt={type} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <span style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: "white", background: type === "before" ? "rgba(0,0,0,0.7)" : "rgba(124,58,237,0.85)", padding: "2px 8px", borderRadius: 4, textTransform: "uppercase" }}>{type}</span>
                      </>
                    ) : (
                      <>
                        <Camera size={22} style={{ color: "rgba(124,58,237,0.4)", marginBottom: 6 }} />
                        <p style={{ fontSize: 12, fontWeight: 600, color: "#9C9584", margin: 0, textTransform: "capitalize" }}>{type} Photo</p>
                        <p style={{ fontSize: 10, color: "#B8AE9C", margin: "2px 0 0" }}>Click or drag & drop</p>
                      </>
                    )}
                    <input ref={ref} type="file" accept="image/*" style={{ display: "none" }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f, type); }} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Brand Name */}
          <div>
            <p style={sectionLabel}>Brand / Product Name *</p>
            <input value={brandName} onChange={e => setBrandName(e.target.value)}
              placeholder="e.g. Allergan, Galderma, Sculptra, Profhilo…"
              style={inputStyle} />
          </div>

          {/* Treatment */}
          <div>
            <p style={sectionLabel}>Treatment *</p>
            {customTreat ? (
              <div style={{ display: "flex", gap: 8 }}>
                <input value={treatment} onChange={e => setTreatment(e.target.value)} placeholder="Enter treatment name…" style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => { setCustomTreat(false); setTreatment(""); }}
                  style={{ padding: "0 12px", borderRadius: 10, border: "1px solid rgba(197,160,89,0.2)", background: "transparent", cursor: "pointer", fontSize: 12, color: "#9C9584" }}>
                  List
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <select value={treatment} onChange={e => setTreatment(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                  <option value="">Select treatment…</option>
                  {TREATMENTS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button onClick={() => { setCustomTreat(true); setTreatment(""); }}
                  style={{ padding: "0 12px", borderRadius: 10, border: "1px solid rgba(197,160,89,0.2)", background: "transparent", cursor: "pointer", fontSize: 12, color: "#9C9584", whiteSpace: "nowrap" }}>
                  Custom
                </button>
              </div>
            )}
          </div>

          {/* Condition + Body Area */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <p style={sectionLabel}>Condition / Concern</p>
              <select value={condition} onChange={e => setCondition(e.target.value)} style={inputStyle}>
                <option value="">Select condition…</option>
                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <p style={sectionLabel}>Body Area</p>
              <select value={bodyArea} onChange={e => setBodyArea(e.target.value)} style={inputStyle}>
                <option value="">Select area…</option>
                {BODY_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <p style={sectionLabel}>Title / Caption (optional)</p>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Botox Upper Face — 3 weeks post"
              style={inputStyle} />
          </div>

          {/* Notes */}
          <div>
            <p style={sectionLabel}>Notes</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Product details, dosage, protocol, observations…"
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.65 }} />
          </div>

          <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.15)" }}>
            <p style={{ fontSize: 11, color: "#7c3aed", margin: 0 }}>
              ✓ These photos will be visible in Counselling → Gallery → Reference Library. They are not linked to any patient.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 22px", borderTop: "1px solid rgba(197,160,89,0.18)", background: "white", display: "flex", gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid rgba(197,160,89,0.2)", background: "transparent", cursor: "pointer", fontSize: 13, color: "#9C9584" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !hasContent || !treatment.trim()}
            style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: saving || !hasContent || !treatment.trim() ? "rgba(124,58,237,0.3)" : "linear-gradient(135deg, #7c3aed, #5b21b6)", cursor: saving || !hasContent || !treatment.trim() ? "not-allowed" : "pointer", color: "white", fontSize: 13, fontWeight: 600, fontFamily: "Georgia, serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            {saving ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Saving…</> : <><CheckCircle2 size={14} /> Add to Reference Library</>}
          </button>
        </div>
      </div>
    </>
  );
}
