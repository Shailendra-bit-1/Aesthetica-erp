"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, Camera, Loader2, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Patient, fmtDate } from "../types";
import BeforeAfterProgress from "@/components/BeforeAfterProgress";

interface GalleryPhoto {
  id: string;
  photo_type: "before" | "after";
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

export default function GalleryTab({ patient, clinicId }: Props) {
  const [photos, setPhotos]     = useState<GalleryPhoto[]>([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadPhotos() {
    const { data, error } = await supabase
      .from("before_after_photos")
      .select("id, photo_type, category, file_url, treatment_name, notes, taken_at")
      .eq("patient_id", patient.id)
      .eq("clinic_id", clinicId)
      .order("taken_at", { ascending: false });
    if (error) console.error(error);
    setPhotos((data ?? []) as GalleryPhoto[]);
    setLoading(false);
  }

  useEffect(() => { loadPhotos(); }, [patient.id, clinicId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${clinicId}/gallery/${patient.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("patient-photos")
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage
        .from("patient-photos")
        .getPublicUrl(path);

      const { error: dbErr } = await supabase
        .from("before_after_photos")
        .insert({
          patient_id:     patient.id,
          clinic_id:      clinicId,
          photo_type:     "before",
          file_url:       urlData.publicUrl,
          file_path:      path,
          taken_at:       new Date().toISOString(),
        });
      if (dbErr) throw dbErr;

      toast.success("Photo uploaded");
      loadPhotos();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const typeBadgeStyle = (type: "before" | "after"): React.CSSProperties => ({
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    padding: "2px 8px",
    borderRadius: 20,
    background: type === "before" ? "rgba(59,130,246,0.12)" : "rgba(16,185,129,0.12)",
    color:      type === "before" ? "#1E3A8A"               : "#065F46",
    border:     `1px solid ${type === "before" ? "rgba(59,130,246,0.3)" : "rgba(16,185,129,0.3)"}`,
  });

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

        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 8,
            background: uploading ? "rgba(197,160,89,0.4)" : GOLD,
            color: "white", border: "none", cursor: uploading ? "not-allowed" : "pointer",
            fontSize: 12, fontWeight: 600, letterSpacing: "0.02em",
            boxShadow: "0 1px 4px rgba(197,160,89,0.35)",
          }}
        >
          {uploading ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={13} />}
          {uploading ? "Uploading…" : "Upload Photo"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: "none" }}
          onChange={handleUpload}
        />
      </div>

      {/* BeforeAfterProgress component (paired comparisons) */}
      <div style={{ marginBottom: 24, padding: "16px", background: "white", borderRadius: 12, border: "1px solid rgba(197,160,89,0.15)" }}>
        <BeforeAfterProgress patientId={patient.id} clinicId={clinicId} />
      </div>

      {/* Individual photo grid */}
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
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#BDB6A8" }}>Upload a photo to start building this patient's gallery</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
          {photos.map(photo => (
            <PhotoCard key={photo.id} photo={photo} typeBadgeStyle={typeBadgeStyle} />
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoCard({ photo, typeBadgeStyle }: {
  photo: GalleryPhoto;
  typeBadgeStyle: (type: "before" | "after") => React.CSSProperties;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 10, overflow: "hidden",
        border: hovered ? "1px solid rgba(197,160,89,0.5)" : "1px solid rgba(197,160,89,0.15)",
        boxShadow: hovered ? "0 4px 16px rgba(197,160,89,0.15)" : "0 1px 4px rgba(28,25,23,0.05)",
        background: "white",
        transition: "all 0.18s ease",
        transform: hovered ? "translateY(-2px)" : "none",
      }}
    >
      <div style={{ height: 130, overflow: "hidden", background: "#F0EDE8", position: "relative" }}>
        <img
          src={photo.file_url}
          alt={photo.treatment_name ?? "Gallery photo"}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          loading="lazy"
        />
        <div style={{ position: "absolute", top: 6, left: 6 }}>
          <span style={typeBadgeStyle(photo.photo_type)}>{photo.photo_type}</span>
        </div>
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
