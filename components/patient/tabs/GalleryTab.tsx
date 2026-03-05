"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, Camera, Loader2, Image as ImageIcon, Link2, X, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Patient, fmtDate } from "../types";
import BeforeAfterProgress from "@/components/BeforeAfterProgress";

type PhotoType = "before" | "after" | "progress" | "reference";

interface GalleryPhoto {
  id: string;
  photo_type: "before" | "after";
  photo_type_ext: PhotoType | null;
  pair_id: string | null;
  category: string | null;
  file_url: string;
  treatment_name: string | null;
  notes: string | null;
  taken_at: string;
}

interface Props {
  patient: Patient;
  clinicId: string;
  privacyMode: boolean;
}

const GOLD = "#C5A059";

const TYPE_CFG: Record<PhotoType, { label: string; bg: string; color: string; border: string }> = {
  before:    { label: "Before",    bg: "rgba(59,130,246,0.12)",  color: "#1E3A8A", border: "rgba(59,130,246,0.3)" },
  after:     { label: "After",     bg: "rgba(16,185,129,0.12)",  color: "#065F46", border: "rgba(16,185,129,0.3)" },
  progress:  { label: "Progress",  bg: "rgba(197,160,89,0.12)",  color: "#7A5518", border: "rgba(197,160,89,0.3)" },
  reference: { label: "Reference", bg: "rgba(107,114,128,0.1)",  color: "#374151", border: "rgba(107,114,128,0.3)" },
};

// ── Upload Modal ─────────────────────────────────────────────────────────────

interface UploadModalProps {
  patient: Patient;
  clinicId: string;
  onClose: () => void;
  onUploaded: () => void;
}

function UploadModal({ patient, clinicId, onClose, onUploaded }: UploadModalProps) {
  const [file, setFile]               = useState<File | null>(null);
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null);
  const [photoType, setPhotoType]     = useState<PhotoType>("before");
  const [treatmentName, setTreatment] = useState("");
  const [uploading, setUploading]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File | null) {
    if (!f) return;
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
  }

  async function doUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const ext  = file.name.split(".").pop() ?? "jpg";
      const path = `${clinicId}/gallery/${patient.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("patient-photos")
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("patient-photos").getPublicUrl(path);

      const { error: dbErr } = await supabase.from("before_after_photos").insert({
        patient_id:     patient.id,
        clinic_id:      clinicId,
        photo_type:     photoType === "before" || photoType === "after" ? photoType : "before",
        photo_type_ext: photoType,
        treatment_name: treatmentName.trim() || null,
        file_url:       urlData.publicUrl,
        file_path:      path,
        taken_at:       new Date().toISOString(),
      });
      if (dbErr) throw dbErr;

      toast.success("Photo uploaded");
      onUploaded();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)" }}>
      <div style={{ background: "#fff", borderRadius: 18, padding: 28, maxWidth: 460, width: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: "1px solid rgba(197,160,89,0.2)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Camera size={16} style={{ color: GOLD }} />
            <p style={{ fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 16, color: "#1C1917", margin: 0 }}>Upload Photo</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={16} color="#9CA3AF" />
          </button>
        </div>

        {/* File picker area */}
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            height: previewUrl ? "auto" : 120, borderRadius: 12,
            border: "2px dashed rgba(197,160,89,0.35)", background: "rgba(197,160,89,0.04)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", marginBottom: 16, overflow: "hidden",
          }}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="preview" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 10 }} />
          ) : (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <Upload size={22} style={{ color: GOLD, margin: "0 auto 6px" }} />
              <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>Click to select image</p>
              <p style={{ fontSize: 11, color: "#9CA3AF", margin: "2px 0 0" }}>JPG, PNG, WebP · max 10 MB</p>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={e => handleFile(e.target.files?.[0] ?? null)} />

        {/* Photo type selector */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280", marginBottom: 8 }}>Photo Type</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
            {(Object.keys(TYPE_CFG) as PhotoType[]).map(t => {
              const cfg = TYPE_CFG[t];
              const sel = photoType === t;
              return (
                <button key={t} onClick={() => setPhotoType(t)} style={{
                  padding: "7px 4px", borderRadius: 8, fontSize: 11, fontWeight: sel ? 700 : 500,
                  cursor: "pointer", transition: "all 0.15s",
                  border: sel ? `1.5px solid ${cfg.border}` : "1.5px solid #E5E7EB",
                  background: sel ? cfg.bg : "#F9FAFB",
                  color: sel ? cfg.color : "#6B7280",
                }}>
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Treatment name */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280", marginBottom: 6 }}>Treatment Name</p>
          <input
            value={treatmentName}
            onChange={e => setTreatment(e.target.value)}
            placeholder="e.g. Botox, Filler, Laser…"
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid #E5E7EB", background: "#fff", fontSize: 13, color: "#6B7280", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
          <button onClick={doUpload} disabled={!file || uploading} style={{
            flex: 2, padding: "10px 0", borderRadius: 10, border: "none",
            background: !file || uploading ? "rgba(197,160,89,0.4)" : GOLD,
            color: "#fff", fontSize: 13, fontWeight: 600, cursor: !file || uploading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            {uploading ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Uploading…</> : <><Upload size={13} /> Upload Photo</>}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GalleryTab({ patient, clinicId }: Props) {
  const [photos, setPhotos]           = useState<GalleryPhoto[]>([]);
  const [loading, setLoading]         = useState(true);
  const [uploadOpen, setUploadOpen]   = useState(false);
  const [pairingMode, setPairingMode] = useState(false);
  const [pairSelection, setPairSelection] = useState<string[]>([]);
  const [pairingBusy, setPairingBusy] = useState(false);

  async function loadPhotos() {
    const { data, error } = await supabase
      .from("before_after_photos")
      .select("id, photo_type, photo_type_ext, pair_id, category, file_url, treatment_name, notes, taken_at")
      .eq("patient_id", patient.id)
      .eq("clinic_id", clinicId)
      .order("taken_at", { ascending: false });
    if (error) console.error(error);
    setPhotos((data ?? []) as GalleryPhoto[]);
    setLoading(false);
  }

  useEffect(() => { loadPhotos(); }, [patient.id, clinicId]);

  function effectiveType(photo: GalleryPhoto): PhotoType {
    return (photo.photo_type_ext as PhotoType | null) ?? photo.photo_type;
  }

  // Group photos by treatment_name
  const grouped: Record<string, GalleryPhoto[]> = {};
  for (const p of photos) {
    const key = p.treatment_name || "General";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  }

  function togglePairSelect(id: string) {
    setPairSelection(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  async function savePair() {
    if (pairSelection.length !== 2) return;
    setPairingBusy(true);
    const [a, b] = pairSelection;
    const pairId = a; // use first photo's id as pair key
    const { error } = await supabase
      .from("before_after_photos")
      .update({ pair_id: pairId })
      .in("id", [a, b]);
    if (error) { toast.error("Pairing failed"); }
    else {
      toast.success("Photos paired as Before/After");
      loadPhotos();
    }
    setPairingMode(false);
    setPairSelection([]);
    setPairingBusy(false);
  }

  return (
    <div style={{ padding: "4px 0" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(197,160,89,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Camera size={14} style={{ color: GOLD }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#2C2A26", fontFamily: "Georgia, serif" }}>
              Before & After Gallery
            </h3>
            <p style={{ margin: 0, fontSize: 11, color: "#9C9584" }}>
              {photos.length} photo{photos.length !== 1 ? "s" : ""} on record
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {photos.length >= 2 && (
            <button
              onClick={() => { setPairingMode(v => !v); setPairSelection([]); }}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8,
                background: pairingMode ? "rgba(59,130,246,0.1)" : "rgba(197,160,89,0.07)",
                color: pairingMode ? "#2563EB" : "#6B7280",
                border: pairingMode ? "1px solid rgba(59,130,246,0.35)" : "1px solid rgba(197,160,89,0.25)",
                cursor: "pointer", fontSize: 12, fontWeight: 600,
              }}
            >
              <Link2 size={13} />
              {pairingMode ? "Cancel Pair" : "Pair Photos"}
            </button>
          )}
          <button
            onClick={() => setUploadOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8,
              background: GOLD, color: "white", border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 600, letterSpacing: "0.02em",
              boxShadow: "0 1px 4px rgba(197,160,89,0.35)",
            }}
          >
            <Upload size={13} />
            Upload Photo
          </button>
        </div>
      </div>

      {/* Pairing instructions */}
      {pairingMode && (
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 10, background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 12, color: "#2563EB", margin: 0 }}>
            Select 2 photos to pair as Before/After ({pairSelection.length}/2 selected)
          </p>
          {pairSelection.length === 2 && (
            <button onClick={savePair} disabled={pairingBusy} style={{
              display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8,
              background: "#2563EB", color: "#fff", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
            }}>
              {pairingBusy ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={11} />}
              Save Pair
            </button>
          )}
        </div>
      )}

      {/* BeforeAfterProgress — paired comparisons */}
      <div style={{ marginBottom: 24, padding: "16px", background: "white", borderRadius: 12, border: "1px solid rgba(197,160,89,0.15)" }}>
        <BeforeAfterProgress patientId={patient.id} clinicId={clinicId} />
      </div>

      {/* Photo grid — grouped by treatment */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
          {[1, 2, 3, 4].map(n => (
            <div key={n} style={{ height: 140, borderRadius: 10, background: "rgba(197,160,89,0.07)", animation: "pulse 1.5s infinite" }} />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", background: "rgba(197,160,89,0.04)", borderRadius: 12, border: "1px dashed rgba(197,160,89,0.25)" }}>
          <ImageIcon size={28} style={{ color: "rgba(197,160,89,0.4)", marginBottom: 10 }} />
          <p style={{ margin: 0, fontSize: 13, color: "#9C9584", fontFamily: "Georgia, serif" }}>No photos uploaded yet</p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#BDB6A8" }}>Upload a photo to start building this patient&apos;s gallery</p>
        </div>
      ) : (
        Object.entries(grouped).map(([treatment, grpPhotos]) => (
          <div key={treatment} style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#3C3830", fontFamily: "Georgia, serif" }}>{treatment}</span>
              <span style={{ fontSize: 10, color: "#9C9584", background: "rgba(197,160,89,0.08)", padding: "2px 8px", borderRadius: 999 }}>{grpPhotos.length} photo{grpPhotos.length !== 1 ? "s" : ""}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
              {grpPhotos.map(photo => {
                const isSelected = pairSelection.includes(photo.id);
                const isPaired = !!photo.pair_id;
                return (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    effectiveType={effectiveType(photo)}
                    pairingMode={pairingMode}
                    isSelected={isSelected}
                    isPaired={isPaired}
                    onSelect={() => pairingMode && togglePairSelect(photo.id)}
                  />
                );
              })}
            </div>
          </div>
        ))
      )}

      {uploadOpen && (
        <UploadModal
          patient={patient}
          clinicId={clinicId}
          onClose={() => setUploadOpen(false)}
          onUploaded={loadPhotos}
        />
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}

function PhotoCard({ photo, effectiveType, pairingMode, isSelected, isPaired, onSelect }: {
  photo: GalleryPhoto;
  effectiveType: PhotoType;
  pairingMode: boolean;
  isSelected: boolean;
  isPaired: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const cfg = TYPE_CFG[effectiveType];

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 10, overflow: "hidden",
        border: isSelected ? "2px solid #2563EB" : hovered ? "1px solid rgba(197,160,89,0.5)" : "1px solid rgba(197,160,89,0.15)",
        boxShadow: hovered ? "0 4px 16px rgba(197,160,89,0.15)" : "0 1px 4px rgba(28,25,23,0.05)",
        background: "white",
        transition: "all 0.18s ease",
        transform: hovered ? "translateY(-2px)" : "none",
        cursor: pairingMode ? "pointer" : "default",
        outline: isSelected ? "2px solid #2563EB" : "none",
      }}
    >
      <div style={{ height: 130, overflow: "hidden", background: "#F0EDE8", position: "relative" }}>
        <img
          src={photo.file_url}
          alt={photo.treatment_name ?? "Gallery photo"}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          loading="lazy"
        />
        <div style={{ position: "absolute", top: 6, left: 6, display: "flex", gap: 4 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
            padding: "2px 8px", borderRadius: 20,
            background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
          }}>{cfg.label}</span>
          {isPaired && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 20, background: "rgba(16,185,129,0.12)", color: "#065F46", border: "1px solid rgba(16,185,129,0.3)" }}>
              <Link2 size={9} style={{ display: "inline", verticalAlign: "middle" }} />
            </span>
          )}
        </div>
        {isSelected && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(37,99,235,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Check size={24} color="#2563EB" />
          </div>
        )}
      </div>
      <div style={{ padding: "8px 10px" }}>
        {photo.treatment_name && (
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#3C3830", fontFamily: "Georgia, serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {photo.treatment_name}
          </p>
        )}
        <p style={{ margin: photo.treatment_name ? "2px 0 0" : 0, fontSize: 10, color: "#9C9584" }}>
          {fmtDate(photo.taken_at)}
        </p>
      </div>
    </div>
  );
}
