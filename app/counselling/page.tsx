"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import TopBar from "@/components/TopBar";
import ReferenceGalleryModal from "@/components/ReferenceGalleryModal";
import CustomFieldsSection from "@/components/CustomFieldsSection";
import {
  Plus, X, Calendar, TrendingUp, Clock, Check, Printer,
  MessageCircle, Mail, Save, Images, ChevronLeft, ChevronRight,
  FileText, Loader2,
} from "lucide-react";
import { toast } from "sonner";

type PackageType = "single_service" | "custom_package";
type ConversionStatus = "pending" | "converted" | "partial" | "declined";

interface CounsellingSession {
  id: string;
  patient_id: string;
  counsellor_id: string | null;
  session_date: string;
  chief_complaint: string | null;
  treatments_discussed: Array<{
    service_id?: string; service_name: string;
    mrp: number; price: number; quoted_price: number;
    discount_pct: number; recommended: boolean;
    sessions?: number;
  }>;
  total_proposed: number;
  total_accepted: number;
  conversion_status: ConversionStatus;
  package_type: PackageType | null;
  followup_date: string | null;
  notes: string | null;
  created_at: string;
  patients: { full_name: string };
  profiles: { full_name: string } | null;
}

interface Service { id: string; name: string; selling_price: number; mrp: number; }
interface Staff  { id: string; full_name: string; role: string; }

type TreatmentRow = {
  service_id: string; service_name: string;
  mrp: number; quoted_price: string; discount_pct: string; recommended: boolean;
  sessions: string;
};

interface DoctorTreatment {
  id: string; treatment_name: string; price: number | null;
  counselled_by: string | null; created_at: string;
}

// Gallery photo types
interface OurResultPhoto {
  id: string; treatment: string; condition: string | null; body_area: string | null;
  visit_number: number | null; visit_date: string | null;
  before_url: string; after_url: string; notes: string | null;
}

interface RefPhoto {
  id: string; treatment: string; brand_name: string | null; condition: string | null;
  body_area: string | null; before_url: string; after_url: string;
  notes: string | null; title: string;
}

const STATUS_CONFIG: Record<ConversionStatus, { bg: string; color: string; label: string; icon: React.ElementType }> = {
  pending:   { bg: "rgba(234,179,8,0.12)",  color: "#ca8a04", label: "Pending",   icon: Clock },
  converted: { bg: "rgba(34,197,94,0.12)",  color: "#16a34a", label: "Converted", icon: Check },
  partial:   { bg: "rgba(59,130,246,0.12)", color: "#2563eb", label: "Partial",   icon: TrendingUp },
  declined:  { bg: "rgba(239,68,68,0.12)",  color: "#dc2626", label: "Declined",  icon: X },
};

const PKG_OPTIONS: { key: PackageType; label: string }[] = [
  { key: "single_service", label: "Single Service" },
  { key: "custom_package", label: "Custom Package" },
];

const PKG_BADGE: Record<PackageType, { label: string; color: string; bg: string }> = {
  single_service: { label: "Single",     color: "#2563eb", bg: "rgba(59,130,246,0.1)"  },
  custom_package: { label: "Custom Pkg", color: "#7c3aed", bg: "rgba(124,58,237,0.1)" },
};

const makeEmptyForm = () => ({
  patient_search: "", patient_id: "", counsellor_id: "",
  session_date: new Date().toISOString().split("T")[0],
  chief_complaint: "", notes: "", followup_date: "",
  package_type: "single_service" as PackageType,
  treatments: [] as TreatmentRow[],
});

// ── Proforma Invoice Modal ────────────────────────────────────────────────────

interface ProformaProps {
  session: CounsellingSession;
  clinicName: string;
  clinicId: string;
  onClose: () => void;
}

function ProformaModal({ session, clinicName, clinicId, onClose }: ProformaProps) {
  const [sharePhone, setSharePhone] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    supabase.from("patients").select("phone, email").eq("id", session.patient_id).single()
      .then(({ data }) => {
        if (data) {
          setSharePhone(data.phone ?? "");
          setShareEmail(data.email ?? "");
        }
      });
  }, [session.patient_id]);

  const treatments = session.treatments_discussed ?? [];
  const total      = session.total_proposed ?? 0;
  const dateStr    = new Date(session.session_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  const whatsappMsg = [
    `*${clinicName} — Treatment Estimate*`,
    `Patient: ${session.patients.full_name}  |  Date: ${dateStr}`,
    "",
    ...treatments.map(t =>
      `${t.service_name} × ${t.sessions ?? 1} sessions  MRP ₹${(t.mrp || 0).toLocaleString()} → ₹${(t.quoted_price || t.price || 0).toLocaleString()} (${Number(t.discount_pct || 0).toFixed(1)}% off)`
    ),
    "──────────────────",
    `*Total Quoted: ₹${total.toLocaleString()}*`,
    "Valid 7 days. Reply YES to confirm.",
  ].join("\n");

  const emailSubject = encodeURIComponent(`${clinicName} — Treatment Estimate for ${session.patients.full_name}`);
  const emailBody    = encodeURIComponent(whatsappMsg.replace(/\*/g, ""));

  const handleWhatsApp = () => {
    const phone = sharePhone.replace(/\D/g, "");
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(whatsappMsg)}`, "_blank");
  };

  const handleEmail = () => {
    window.location.href = `mailto:${shareEmail}?subject=${emailSubject}&body=${emailBody}`;
  };

  const handlePrint = () => {
    const html = `<!DOCTYPE html><html><head><title>Estimate</title>
    <style>body{font-family:Georgia,serif;padding:40px;color:#1a1714;max-width:600px;margin:0 auto}
    h1{font-size:20px;color:#C5A059}table{width:100%;border-collapse:collapse;margin-top:20px}
    th{text-align:left;padding:8px;background:#f9f7f2;border-bottom:2px solid #C5A059;font-size:12px;text-transform:uppercase}
    td{padding:8px;border-bottom:1px solid #e5e0d8;font-size:13px}
    .total{font-size:16px;font-weight:bold;color:#C5A059;text-align:right;margin-top:16px}
    .footer{margin-top:24px;font-size:11px;color:#9ca3af}</style></head><body>
    <h1>${clinicName}</h1>
    <p>Patient: <strong>${session.patients.full_name}</strong></p>
    <p>Date: ${dateStr}</p>
    <table><thead><tr><th>Service</th><th>Sessions</th><th>MRP</th><th>Quoted</th><th>Disc%</th></tr></thead><tbody>
    ${treatments.map(t => `<tr><td>${t.service_name}</td><td>${t.sessions ?? 1}</td><td>₹${(t.mrp || 0).toLocaleString()}</td><td>₹${(t.quoted_price || t.price || 0).toLocaleString()}</td><td>${Number(t.discount_pct || 0).toFixed(1)}%</td></tr>`).join("")}
    </tbody></table>
    <p class="total">Total Quoted: ₹${total.toLocaleString()}</p>
    <p class="footer">Valid 7 days from ${dateStr}. This is an estimate and not a final invoice.</p>
    </body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  const handleSaveProforma = async () => {
    setSaving(true);
    try {
      if (!clinicId) { setSaving(false); return; }
      // Atomic: create invoice + line items in single RPC (B9 fix)
      const { error } = await supabase.rpc("create_invoice_with_items", {
        p_clinic_id:     clinicId,
        p_patient_id:    session.patient_id,
        p_patient_name:  session.patients.full_name,
        p_provider_id:   session.counsellor_id ?? null,
        p_provider_name: "",
        p_due_date:      null,
        p_gst_pct:       0,
        p_invoice_type:  "proforma",
        p_notes:         treatments.map(t => t.service_name).join(", "),
        p_items: JSON.stringify(treatments.map(t => ({
          service_id:   t.service_id ?? null,
          description:  `${t.service_name} × ${t.sessions ?? 1} sessions`,
          quantity:     t.sessions ?? 1,
          unit_price:   t.mrp || 0,
          discount_pct: t.discount_pct || 0,
          gst_pct:      0,
        }))),
      });
      if (error) throw error;
    } catch (e) {
      console.error("Proforma save failed:", e);
    } finally {
      setSaving(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: "#F9F7F2", width: 600, maxWidth: "95vw", maxHeight: "90vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ background: "#fff", borderBottom: "1px solid rgba(197,160,89,0.15)" }}>
          <div>
            <p className="text-sm font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Proforma Invoice</p>
            <p className="text-xs" style={{ color: "#9ca3af" }}>{session.patients.full_name} · {dateStr}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ border: "1px solid rgba(197,160,89,0.2)" }}>
            <X size={14} style={{ color: "#9ca3af" }} />
          </button>
        </div>

        {/* Contact fields */}
        <div className="px-5 py-4 flex-shrink-0 grid grid-cols-2 gap-3" style={{ borderBottom: "1px solid rgba(197,160,89,0.1)" }}>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#6b7280" }}>WhatsApp Number</label>
            <input value={sharePhone} onChange={e => setSharePhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
              style={{ borderColor: "rgba(197,160,89,0.3)" }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#6b7280" }}>Email</label>
            <input value={shareEmail} onChange={e => setShareEmail(e.target.value)}
              placeholder="patient@email.com"
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
              style={{ borderColor: "rgba(197,160,89,0.3)" }} />
          </div>
        </div>

        {/* Treatment table */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(197,160,89,0.15)" }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "rgba(197,160,89,0.06)" }}>
                  {["Service", "Sessions", "MRP ₹", "Quoted ₹", "Disc %"].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-medium" style={{ color: "#9ca3af" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {treatments.map((t, i) => (
                  <tr key={i} style={{ borderTop: "1px solid rgba(197,160,89,0.08)" }}>
                    <td className="px-3 py-2" style={{ color: "#1a1714" }}>{t.service_name}</td>
                    <td className="px-3 py-2" style={{ color: "#6b7280" }}>{t.sessions ?? 1}</td>
                    <td className="px-3 py-2" style={{ color: "#9ca3af" }}>₹{(t.mrp || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 font-medium" style={{ color: "#1a1714" }}>₹{(t.quoted_price || t.price || 0).toLocaleString()}</td>
                    <td className="px-3 py-2" style={{ color: "#16a34a" }}>{Number(t.discount_pct || 0).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid rgba(197,160,89,0.2)", background: "rgba(197,160,89,0.04)" }}>
                  <td colSpan={3} className="px-3 py-2 font-semibold text-xs" style={{ color: "#6b7280" }}>Total Quoted</td>
                  <td colSpan={2} className="px-3 py-2 font-bold text-sm" style={{ color: "var(--gold)" }}>₹{total.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-xs mt-3" style={{ color: "#9ca3af" }}>Valid 7 days from {dateStr}. This is an estimate, not a final invoice.</p>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 flex gap-2 flex-wrap flex-shrink-0" style={{ borderTop: "1px solid rgba(197,160,89,0.15)", background: "#fff" }}>
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border"
            style={{ borderColor: "rgba(197,160,89,0.25)", color: "#6b7280" }}>
            <Printer size={13} /> Print
          </button>
          <button onClick={handleWhatsApp} disabled={!sharePhone}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-40"
            style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a", border: "1px solid rgba(22,163,74,0.2)" }}>
            <MessageCircle size={13} /> WhatsApp
          </button>
          <button onClick={handleEmail} disabled={!shareEmail}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-40"
            style={{ background: "rgba(59,130,246,0.1)", color: "#2563eb", border: "1px solid rgba(59,130,246,0.2)" }}>
            <Mail size={13} /> Email
          </button>
          <button onClick={handleSaveProforma} disabled={saving}
            className="ml-auto flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-40"
            style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)", border: "1px solid rgba(197,160,89,0.25)" }}>
            <Save size={13} /> {saving ? "Saving…" : "Save Proforma"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Gallery Tab ───────────────────────────────────────────────────────────────

interface GalleryTabProps { clinicId: string; }

function GalleryTab({ clinicId }: GalleryTabProps) {
  const [subTab, setSubTab]           = useState<"our_results" | "reference">("our_results");
  const [ourPhotos, setOurPhotos]     = useState<OurResultPhoto[]>([]);
  const [refPhotos, setRefPhotos]     = useState<RefPhoto[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filterTreat, setFilterTreat] = useState("all");
  const [filterArea, setFilterArea]   = useState("all");
  const [filterBrand, setFilterBrand] = useState("all");
  const [selected, setSelected]       = useState<OurResultPhoto | RefPhoto | null>(null);
  const [viewMode, setViewMode]       = useState<"sidebyside" | "slider">("sidebyside");
  const [sliderPct, setSliderPct]     = useState(50);

  const fetchOurPhotos = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("before_after_photos")
      .select("id, treatment, condition, body_area, visit_number, visit_date, before_url, after_url, notes")
      .eq("clinic_id", clinicId)
      .eq("show_in_counselling", true)
      .eq("is_reference", false)
      .order("created_at", { ascending: false });
    setOurPhotos(data as OurResultPhoto[] ?? []);
    setLoading(false);
  }, [clinicId]);

  const fetchRefPhotos = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("before_after_photos")
      .select("id, treatment, brand_name, condition, body_area, before_url, after_url, notes, title")
      .eq("clinic_id", clinicId)
      .eq("is_reference", true)
      .order("created_at", { ascending: false });
    setRefPhotos(data as RefPhoto[] ?? []);
    setLoading(false);
  }, [clinicId]);

  useEffect(() => {
    if (subTab === "our_results") fetchOurPhotos();
    else fetchRefPhotos();
  }, [subTab, fetchOurPhotos, fetchRefPhotos]);

  const uniqueTreatments = subTab === "our_results"
    ? [...new Set(ourPhotos.map(p => p.treatment))]
    : [...new Set(refPhotos.map(p => p.treatment))];
  const uniqueAreas  = [...new Set(ourPhotos.map(p => p.body_area).filter(Boolean))] as string[];
  const uniqueBrands = [...new Set(refPhotos.map(p => p.brand_name).filter(Boolean))] as string[];

  const filteredOur = ourPhotos.filter(p =>
    (filterTreat === "all" || p.treatment === filterTreat) &&
    (filterArea  === "all" || p.body_area  === filterArea)
  );
  const filteredRef = refPhotos.filter(p =>
    (filterTreat === "all" || p.treatment  === filterTreat) &&
    (filterBrand === "all" || p.brand_name === filterBrand)
  );

  const navPhoto = (dir: -1 | 1) => {
    if (!selected) return;
    const list = subTab === "our_results" ? filteredOur : filteredRef;
    const idx  = list.findIndex(p => p.id === selected.id);
    const next = list[idx + dir];
    if (next) { setSelected(next); setSliderPct(50); }
  };

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit" style={{ background: "rgba(197,160,89,0.06)", border: "1px solid rgba(197,160,89,0.12)" }}>
        {([["our_results", "Our Results"], ["reference", "Reference Library"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => { setSubTab(key); setFilterTreat("all"); setFilterArea("all"); setFilterBrand("all"); setSelected(null); }}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={subTab === key ? { background: "var(--gold)", color: "#fff", fontFamily: "Georgia, serif" } : { color: "rgba(197,160,89,0.7)" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <select value={filterTreat} onChange={e => setFilterTreat(e.target.value)}
          className="text-xs px-3 py-1.5 rounded-lg border bg-white"
          style={{ borderColor: "rgba(197,160,89,0.25)", color: "#4b5563" }}>
          <option value="all">All Treatments</option>
          {uniqueTreatments.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {subTab === "our_results" && (
          <select value={filterArea} onChange={e => setFilterArea(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border bg-white"
            style={{ borderColor: "rgba(197,160,89,0.25)", color: "#4b5563" }}>
            <option value="all">All Body Areas</option>
            {uniqueAreas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        {subTab === "reference" && (
          <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border bg-white"
            style={{ borderColor: "rgba(197,160,89,0.25)", color: "#4b5563" }}>
            <option value="all">All Brands</option>
            {uniqueBrands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm" style={{ color: "#9ca3af" }}>Loading…</p>
        </div>
      ) : (subTab === "our_results" ? filteredOur : filteredRef).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Images size={40} style={{ color: "rgba(197,160,89,0.3)" }} />
          <p className="text-sm" style={{ color: "#6b7280" }}>
            {subTab === "our_results" ? "No results photos available" : "No brand reference photos found"}
          </p>
          {subTab === "our_results" && (
            <p className="text-xs text-center" style={{ color: "#9ca3af", maxWidth: 320 }}>
              Mark patient before/after photos as &quot;Show in counselling&quot; from the Photos page.
            </p>
          )}
          {subTab === "reference" && (
            <p className="text-xs text-center" style={{ color: "#9ca3af", maxWidth: 320 }}>
              Upload brand reference photos from Photos → Reference Library.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {(subTab === "our_results" ? filteredOur : filteredRef).map(photo => {
            const refPhoto = photo as RefPhoto;
            return (
              <button key={photo.id} onClick={() => { setSelected(photo); setSliderPct(50); }}
                className="rounded-xl overflow-hidden text-left transition-all hover:shadow-md"
                style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.12)" }}>
                <div className="flex">
                  <img src={photo.before_url} alt="Before" className="flex-1 object-cover" style={{ height: 100, minWidth: 0 }} />
                  <img src={photo.after_url}  alt="After"  className="flex-1 object-cover" style={{ height: 100, minWidth: 0 }} />
                </div>
                <div className="px-2.5 py-2">
                  {subTab === "reference" && refPhoto.brand_name && (
                    <span className="inline-block text-xs px-1.5 py-0.5 rounded-full font-medium mb-1" style={{ background: "rgba(124,58,237,0.1)", color: "#7c3aed" }}>{refPhoto.brand_name}</span>
                  )}
                  <p className="text-xs font-medium truncate" style={{ color: "#1a1714" }}>{photo.treatment}</p>
                  {(photo.condition || photo.body_area) && (
                    <p className="text-xs truncate" style={{ color: "#9ca3af" }}>{[photo.condition, photo.body_area].filter(Boolean).join(" · ")}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Comparison Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
          <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: "#1a1714", width: 820, maxWidth: "95vw", maxHeight: "90vh" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-3">
                {subTab === "reference" && (selected as RefPhoto).brand_name && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(124,58,237,0.25)", color: "#c4b5fd" }}>{(selected as RefPhoto).brand_name}</span>
                )}
                <span className="text-sm font-medium" style={{ color: "#f9f7f2", fontFamily: "Georgia, serif" }}>
                  {subTab === "reference" ? ((selected as RefPhoto).title || selected.treatment) : selected.treatment}
                </span>
                {selected.condition && <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{selected.condition}</span>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => navPhoto(-1)}
                  disabled={(subTab === "our_results" ? filteredOur : filteredRef).findIndex(p => p.id === selected.id) === 0}
                  className="w-7 h-7 flex items-center justify-center rounded-lg disabled:opacity-30"
                  style={{ background: "rgba(255,255,255,0.1)" }}>
                  <ChevronLeft size={14} style={{ color: "#f9f7f2" }} />
                </button>
                <button onClick={() => navPhoto(1)}
                  disabled={(subTab === "our_results" ? filteredOur : filteredRef).findIndex(p => p.id === selected.id) === (subTab === "our_results" ? filteredOur : filteredRef).length - 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg disabled:opacity-30"
                  style={{ background: "rgba(255,255,255,0.1)" }}>
                  <ChevronRight size={14} style={{ color: "#f9f7f2" }} />
                </button>
                <div className="flex rounded-lg overflow-hidden ml-1" style={{ border: "1px solid rgba(255,255,255,0.15)" }}>
                  {(["sidebyside", "slider"] as const).map(m => (
                    <button key={m} onClick={() => setViewMode(m)}
                      className="px-3 py-1.5 text-xs font-medium"
                      style={viewMode === m ? { background: "rgba(197,160,89,0.4)", color: "#f9f7f2" } : { background: "transparent", color: "rgba(255,255,255,0.5)" }}>
                      {m === "sidebyside" ? "Side by Side" : "Slider"}
                    </button>
                  ))}
                </div>
                <button onClick={() => setSelected(null)} className="w-7 h-7 flex items-center justify-center rounded-lg ml-1" style={{ background: "rgba(255,255,255,0.1)" }}>
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
                    <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#C5A059", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
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

// ── Main Page ─────────────────────────────────────────────────────────────────

function CounsellingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, activeClinicId } = useClinic();
  const clinicId = activeClinicId || profile?.clinic_id;

  const [tab, setTab]               = useState<"sessions" | "pipeline" | "gallery">("sessions");
  const [sessions, setSessions]     = useState<CounsellingSession[]>([]);
  const [services, setServices]     = useState<Service[]>([]);
  const [staff, setStaff]           = useState<Staff[]>([]);
  const [loading, setLoading]       = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<CounsellingSession | null>(null);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState(makeEmptyForm);
  const [patientResults, setPatientResults] = useState<Array<{ id: string; full_name: string }>>([]);
  const [doctorTreatments, setDoctorTreatments]   = useState<DoctorTreatment[]>([]);
  const [doctorPanelOpen, setDoctorPanelOpen]     = useState(false);
  const [proformaOpen, setProformaOpen]           = useState(false);
  const [clinicName, setClinicName]               = useState("Aesthetica Clinic");
  const [converting, setConverting]               = useState(false);

  const fetchSessions = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase
      .from("counselling_sessions")
      .select("*, patients(full_name), profiles(full_name)")
      .eq("clinic_id", clinicId)
      .order("session_date", { ascending: false });
    setSessions((data as CounsellingSession[]) || []);
  }, [clinicId]);

  const fetchServices = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase.from("services")
      .select("id, name, selling_price, mrp")
      .eq("clinic_id", clinicId).eq("is_active", true).order("name");
    setServices(data || []);
  }, [clinicId]);

  const fetchStaff = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase.from("profiles")
      .select("id, full_name, role")
      .eq("clinic_id", clinicId).eq("is_active", true)
      .in("role", ["counsellor", "doctor"]);
    setStaff(data || []);
  }, [clinicId]);

  const fetchClinicName = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase.from("clinics").select("name").eq("id", clinicId).single();
    if (data?.name) setClinicName(data.name);
  }, [clinicId]);

  const fetchDoctorTreatments = useCallback(async (patientId: string) => {
    const { data } = await supabase
      .from("patient_treatments")
      .select("id, treatment_name, price, counselled_by, created_at")
      .eq("patient_id", patientId)
      .eq("status", "proposed")
      .is("counselling_session_id", null);
    setDoctorTreatments(data || []);
  }, []);

  useEffect(() => {
    if (!clinicId) return;
    setLoading(true);
    Promise.all([fetchSessions(), fetchServices(), fetchStaff(), fetchClinicName()]).finally(() => setLoading(false));
  }, [clinicId, fetchSessions, fetchServices, fetchStaff, fetchClinicName]);

  useEffect(() => {
    if (selectedSession) {
      fetchDoctorTreatments(selectedSession.patient_id);
      setDoctorPanelOpen(false);
    } else {
      setDoctorTreatments([]);
    }
  }, [selectedSession, fetchDoctorTreatments]);

  // GAP-15: auto-open drawer with patient pre-populated from ?patient= param
  useEffect(() => {
    const patientId = searchParams.get("patient");
    if (!patientId || !clinicId) return;
    supabase.from("patients").select("id, full_name").eq("id", patientId).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setForm(f => ({ ...f, patient_id: data.id, patient_search: data.full_name }));
          setDrawerOpen(true);
        }
      });
  }, [searchParams, clinicId]);

  const openNewSession = () => {
    const selfId = staff.find(s => s.id === profile?.id)?.id ?? "";
    setForm({ ...makeEmptyForm(), counsellor_id: selfId });
    setDrawerOpen(true);
  };

  const searchPatients = async (q: string) => {
    if (!clinicId || q.length < 2) { setPatientResults([]); return; }
    const { data } = await supabase.from("patients").select("id, full_name")
      .eq("clinic_id", clinicId).ilike("full_name", `%${q}%`).limit(5);
    setPatientResults(data || []);
  };

  const addTreatmentRow = () => setForm(f => ({
    ...f,
    treatments: [...f.treatments, { service_id: "", service_name: "", mrp: 0, quoted_price: "", discount_pct: "", recommended: false, sessions: "1" }],
  }));

  const selectService = (idx: number, serviceId: string) => {
    const svc = services.find(s => s.id === serviceId);
    if (!svc) return;
    const effectiveMrp = svc.mrp || svc.selling_price;
    const disc = effectiveMrp > 0
      ? ((effectiveMrp - svc.selling_price) / effectiveMrp * 100).toFixed(1)
      : "0";
    const newT = [...form.treatments];
    newT[idx] = { ...newT[idx], service_id: svc.id, service_name: svc.name, mrp: effectiveMrp, quoted_price: String(svc.selling_price), discount_pct: disc };
    setForm(f => ({ ...f, treatments: newT }));
  };

  const updateRow = (idx: number, field: "quoted_price" | "discount_pct" | "recommended" | "sessions", value: string | boolean) => {
    const newT = [...form.treatments];
    const mrp  = newT[idx].mrp;
    if (field === "quoted_price") {
      const quoted = parseFloat(value as string) || 0;
      const disc   = mrp > 0 ? ((mrp - quoted) / mrp * 100).toFixed(1) : "0";
      newT[idx] = { ...newT[idx], quoted_price: value as string, discount_pct: disc };
    } else if (field === "discount_pct") {
      const disc   = parseFloat(value as string) || 0;
      const quoted = mrp > 0 ? (mrp * (1 - disc / 100)).toFixed(0) : "0";
      newT[idx] = { ...newT[idx], discount_pct: value as string, quoted_price: quoted };
    } else if (field === "sessions") {
      newT[idx] = { ...newT[idx], sessions: value as string };
    } else {
      newT[idx] = { ...newT[idx], recommended: value as boolean };
    }
    setForm(f => ({ ...f, treatments: newT }));
  };

  const saveSession = async () => {
    if (!clinicId || !form.patient_id) return;
    setSaving(true);

    const treatments = form.treatments.map(t => ({
      service_id:    t.service_id || undefined,
      service_name:  t.service_name,
      mrp:           t.mrp || 0,
      price:         parseFloat(t.quoted_price) || 0,
      quoted_price:  parseFloat(t.quoted_price) || 0,
      discount_pct:  parseFloat(t.discount_pct) || 0,
      recommended:   t.recommended,
      sessions:      parseInt(t.sessions) || 1,
    }));

    const total_proposed = treatments.reduce((s, t) => s + t.quoted_price, 0);
    const total_accepted  = treatments.filter(t => t.recommended).reduce((s, t) => s + t.quoted_price, 0);

    const { data: session, error } = await supabase
      .from("counselling_sessions")
      .insert({
        clinic_id:         clinicId,
        patient_id:        form.patient_id,
        counsellor_id:     form.counsellor_id || null,
        session_date:      form.session_date,
        chief_complaint:   form.chief_complaint || null,
        treatments_discussed: treatments,
        total_proposed,
        total_accepted,
        conversion_status: "pending",
        package_type:      form.package_type,
        followup_date:     form.followup_date || null,
        notes:             form.notes || null,
      })
      .select("id")
      .single();

    if (!error && session) {
      const counsellorName = staff.find(s => s.id === form.counsellor_id)?.full_name || null;
      const ptInserts = treatments.map(t => ({
        patient_id:              form.patient_id,
        clinic_id:               clinicId,
        treatment_name:          t.service_name,
        status:                  "proposed",
        price:                   t.quoted_price || null,
        quoted_price:            t.quoted_price || null,
        mrp:                     t.mrp || null,
        discount_pct:            t.discount_pct || null,
        package_type:            form.package_type,
        counselled_by:           counsellorName,
        counselling_session_id:  session.id,
        notes:                   form.notes || null,
        recommended_sessions:    t.sessions || null,
      }));
      if (ptInserts.length > 0) {
        await supabase.from("patient_treatments").insert(ptInserts);
      }
    }

    setSaving(false);
    setDrawerOpen(false);
    setForm(makeEmptyForm());
    fetchSessions();
  };

  const updateStatus = async (id: string, status: ConversionStatus) => {
    await supabase.from("counselling_sessions").update({ conversion_status: status }).eq("id", id);
    fetchSessions();
    if (selectedSession?.id === id) setSelectedSession(prev => prev ? { ...prev, conversion_status: status } : null);
  };

  const convertToInvoice = async () => {
    if (!selectedSession || !clinicId) return;
    setConverting(true);
    try {
      const treatments = selectedSession.treatments_discussed ?? [];
      const { error } = await supabase.rpc("create_invoice_with_items", {
        p_clinic_id:     clinicId,
        p_patient_id:    selectedSession.patient_id,
        p_patient_name:  selectedSession.patients.full_name,
        p_provider_id:   selectedSession.counsellor_id ?? null,
        p_provider_name: selectedSession.profiles?.full_name ?? "",
        p_due_date:      null,
        p_gst_pct:       0,
        p_invoice_type:  "service",
        p_notes:         `Converted from counselling — ${new Date(selectedSession.session_date).toLocaleDateString("en-IN")}`,
        p_items: JSON.stringify(treatments.map(t => ({
          service_id:   t.service_id ?? null,
          description:  `${t.service_name} × ${t.sessions ?? 1} sessions`,
          quantity:     t.sessions ?? 1,
          unit_price:   t.mrp || 0,
          discount_pct: t.discount_pct || 0,
          gst_pct:      0,
        }))),
      });
      if (error) throw error;

      // GAP-20: Create patient_service_credits for multi-session treatments
      const creditInserts = treatments
        .filter(t => t.service_id && (t.sessions ?? 1) > 1)
        .map(t => ({
          patient_id:          selectedSession.patient_id,
          purchase_clinic_id:  clinicId,
          current_clinic_id:   clinicId,
          service_id:          t.service_id!,
          service_name:        t.service_name,
          total_sessions:      t.sessions ?? 1,
          used_sessions:       0,
          purchase_price:      (t.quoted_price || t.price || 0) * (t.sessions ?? 1),
          per_session_value:   t.quoted_price || t.price || 0,
          status:              "active",
          commission_pct:      0,
          family_shared:       false,
        }));
      if (creditInserts.length > 0) {
        await supabase.from("patient_service_credits").insert(creditInserts);
      }

      await supabase.from("counselling_sessions")
        .update({ conversion_status: "converted" })
        .eq("id", selectedSession.id);
      setSelectedSession(prev => prev ? { ...prev, conversion_status: "converted" } : null);
      fetchSessions();
      toast.success("Invoice created — open Billing to view");
    } catch (e) {
      console.error("Convert to invoice failed:", e);
      toast.error("Failed to create invoice");
    } finally {
      setConverting(false);
    }
  };

  const includeInSession = (dt: DoctorTreatment) => {
    if (!selectedSession) return;
    setForm(f => ({
      ...f,
      patient_id:     selectedSession.patient_id,
      patient_search: selectedSession.patients.full_name,
      treatments: [...f.treatments, {
        service_id:    "",
        service_name:  dt.treatment_name,
        mrp:           dt.price || 0,
        quoted_price:  String(dt.price || ""),
        discount_pct:  "0",
        recommended:   false,
        sessions:      "1",
      }],
    }));
    setDrawerOpen(true);
  };

  // Drawer summary
  const summaryTotalMrp    = form.treatments.reduce((s, t) => s + (t.mrp || 0), 0);
  const summaryTotalQuoted = form.treatments.reduce((s, t) => s + (parseFloat(t.quoted_price) || 0), 0);
  const summaryAvgDisc     = form.treatments.length > 0
    ? form.treatments.reduce((s, t) => s + (parseFloat(t.discount_pct) || 0), 0) / form.treatments.length
    : 0;
  const summaryRec = form.treatments.filter(t => t.recommended).length;

  const kanbanCols: ConversionStatus[] = ["pending", "converted", "partial", "declined"];

  const COUNSELLING_ROLES = ["superadmin", "chain_admin", "clinic_admin", "doctor", "counsellor"];
  if (profile && !COUNSELLING_ROLES.includes(profile.role ?? "")) {
    return (
      <div className="flex flex-col h-screen" style={{ background: "#F9F7F2" }}>
        <TopBar />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#6b7280", fontFamily: "Georgia, serif" }}>You don&apos;t have permission to access Counselling.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen" style={{ background: "#F9F7F2" }}>
      <TopBar />

      <div className="flex-1 overflow-auto p-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: "rgba(197,160,89,0.08)", border: "1px solid rgba(197,160,89,0.15)" }}>
          {([["sessions", "Sessions"], ["pipeline", "Pipeline"], ["gallery", "Gallery"]] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className="px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize"
              style={tab === t ? { background: "var(--gold)", color: "#fff", fontFamily: "Georgia, serif" } : { color: "rgba(197,160,89,0.7)" }}>
              {label}
            </button>
          ))}
        </div>

        {/* SESSIONS TAB */}
        {tab === "sessions" && (
          <div>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Counselling Sessions</h2>
              <button onClick={openNewSession}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: "var(--gold)" }}>
                <Plus size={15} /> New Session
              </button>
            </div>

            {/* N11: Funnel stats */}
            <div className="grid grid-cols-4 gap-4 mb-5">
              {[
                { label: "Total Sessions",  value: sessions.length, color: "#C5A059" },
                { label: "Converted",       value: sessions.filter(s => s.conversion_status === "converted").length, color: "#16a34a" },
                { label: "Conversion Rate", value: sessions.length > 0 ? `${Math.round(sessions.filter(s => s.conversion_status === "converted").length / sessions.length * 100)}%` : "—", color: "#2563eb" },
                { label: "Avg Proposal",    value: sessions.length > 0 ? `₹${Math.round(sessions.reduce((acc, s) => acc + (s.total_proposed || 0), 0) / sessions.length).toLocaleString("en-IN")}` : "—", color: "#7c3aed" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)", borderRadius: 12, padding: "14px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "Georgia, serif", color }}>{value}</div>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9CA3AF", fontWeight: 600, marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            <div className="flex gap-5">
              {/* Sessions table */}
              <div className="flex-1 rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(197,160,89,0.1)", background: "rgba(197,160,89,0.04)" }}>
                      {["Date", "Patient", "Counsellor", "Treatments", "Type", "Quoted ₹", "Status", "Follow-up"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: "rgba(197,160,89,0.7)", letterSpacing: "0.05em" }}>{h.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: "#9ca3af" }}>Loading…</td></tr>
                    ) : sessions.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: "#9ca3af" }}>No sessions yet</td></tr>
                    ) : sessions.map(s => {
                      const sc  = STATUS_CONFIG[s.conversion_status];
                      const pkg = s.package_type ? PKG_BADGE[s.package_type] : null;
                      return (
                        <tr key={s.id} className="cursor-pointer hover:bg-amber-50/30 transition-colors"
                          onClick={() => setSelectedSession(s)}
                          style={{ borderBottom: "1px solid rgba(197,160,89,0.06)" }}>
                          <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>{new Date(s.session_date).toLocaleDateString("en-IN")}</td>
                          <td className="px-4 py-3 text-sm font-medium">
                            <button onClick={e => { e.stopPropagation(); router.push(`/patients/${s.patient_id}`); }}
                              style={{ color: "#C5A059", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", fontWeight: "inherit", padding: 0 }}>
                              {s.patients?.full_name}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>{s.profiles?.full_name || "—"}</td>
                          <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>{s.treatments_discussed?.length || 0}</td>
                          <td className="px-4 py-3">
                            {pkg ? (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: pkg.bg, color: pkg.color }}>{pkg.label}</span>
                            ) : <span style={{ color: "#9ca3af" }}>—</span>}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium" style={{ color: "#1a1714" }}>₹{(s.total_proposed || 0).toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: "#4b5563" }}>
                            {s.followup_date ? new Date(s.followup_date).toLocaleDateString("en-IN") : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Detail panel */}
              {selectedSession && (
                <div className="w-96 rounded-xl flex flex-col" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
                  <div className="flex justify-between items-center px-4 py-4" style={{ borderBottom: "1px solid rgba(197,160,89,0.1)" }}>
                    <h3 className="font-semibold text-sm" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Session Detail</h3>
                    <button onClick={() => setSelectedSession(null)}><X size={15} style={{ color: "#9ca3af" }} /></button>
                  </div>

                  <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    <div>
                      <p className="text-xs font-medium mb-0.5" style={{ color: "rgba(197,160,89,0.8)" }}>PATIENT</p>
                      <p className="text-sm font-medium" style={{ color: "#1a1714" }}>{selectedSession.patients?.full_name}</p>
                    </div>

                    {selectedSession.package_type && (() => {
                      const pkg = PKG_BADGE[selectedSession.package_type!];
                      return (
                        <div>
                          <p className="text-xs font-medium mb-1" style={{ color: "rgba(197,160,89,0.8)" }}>PACKAGE TYPE</p>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: pkg.bg, color: pkg.color }}>{pkg.label}</span>
                        </div>
                      );
                    })()}

                    <div>
                      <p className="text-xs font-medium mb-0.5" style={{ color: "rgba(197,160,89,0.8)" }}>COMPLAINT</p>
                      <p className="text-sm" style={{ color: "#4b5563" }}>{selectedSession.chief_complaint || "—"}</p>
                    </div>

                    <div>
                      <p className="text-xs font-medium mb-2" style={{ color: "rgba(197,160,89,0.8)" }}>TREATMENTS DISCUSSED</p>
                      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(197,160,89,0.12)" }}>
                        <table className="w-full text-xs">
                          <thead>
                            <tr style={{ background: "rgba(197,160,89,0.06)" }}>
                              <th className="px-2 py-1.5 text-left font-medium" style={{ color: "#9ca3af" }}>Service</th>
                              <th className="px-2 py-1.5 text-center font-medium" style={{ color: "#9ca3af" }}>Sess.</th>
                              <th className="px-2 py-1.5 text-right font-medium" style={{ color: "#9ca3af" }}>MRP</th>
                              <th className="px-2 py-1.5 text-right font-medium" style={{ color: "#9ca3af" }}>Quoted</th>
                              <th className="px-2 py-1.5 text-right font-medium" style={{ color: "#9ca3af" }}>Disc</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedSession.treatments_discussed?.map((t, i) => (
                              <tr key={i} style={{ borderTop: "1px solid rgba(197,160,89,0.08)" }}>
                                <td className="px-2 py-1.5" style={{ color: "#4b5563" }}>
                                  {t.service_name}
                                  {t.recommended && <span className="ml-1" style={{ color: "#16a34a" }}>✓</span>}
                                </td>
                                <td className="px-2 py-1.5 text-center" style={{ color: "#6b7280" }}>{t.sessions ?? 1}</td>
                                <td className="px-2 py-1.5 text-right" style={{ color: "#9ca3af" }}>₹{(t.mrp || 0).toLocaleString()}</td>
                                <td className="px-2 py-1.5 text-right font-medium" style={{ color: "#1a1714" }}>₹{(t.quoted_price || t.price || 0).toLocaleString()}</td>
                                <td className="px-2 py-1.5 text-right" style={{ color: t.discount_pct > 0 ? "#16a34a" : "#9ca3af" }}>
                                  {t.discount_pct > 0 ? `${Number(t.discount_pct).toFixed(1)}%` : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ borderTop: "1px solid rgba(197,160,89,0.15)", background: "rgba(197,160,89,0.04)" }}>
                              <td className="px-2 py-1.5 font-medium text-xs" style={{ color: "#6b7280" }}>Total</td>
                              <td />
                              <td className="px-2 py-1.5 text-right font-medium text-xs" style={{ color: "#9ca3af" }}>
                                ₹{(selectedSession.treatments_discussed?.reduce((s, t) => s + (t.mrp || 0), 0) || 0).toLocaleString()}
                              </td>
                              <td className="px-2 py-1.5 text-right font-bold text-xs" style={{ color: "var(--gold)" }}>
                                ₹{(selectedSession.total_proposed || 0).toLocaleString()}
                              </td>
                              <td />
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Custom Fields */}
                      <div style={{ borderTop: "1px solid rgba(197,160,89,0.15)", paddingTop: 14, marginTop: 8 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: "#9C9584", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Custom Fields</p>
                        <CustomFieldsSection entityType="counselling_sessions" entityId={selectedSession.id} clinicId={clinicId ?? ""} />
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => setProformaOpen(true)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                          style={{ background: "var(--gold)", color: "#fff" }}>
                          <Printer size={12} /> Proforma
                        </button>
                        {/* GAP-55: Book appointment from counselling */}
                        <button onClick={() => {
                          const firstTreatment = selectedSession.treatments_discussed?.[0];
                          const params = new URLSearchParams({ patient: selectedSession.patient_id });
                          if (firstTreatment?.service_name) params.set("service", firstTreatment.service_name);
                          router.push(`/scheduler?${params.toString()}`);
                        }}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                          style={{ background: "rgba(197,160,89,0.1)", color: "#8B6914", border: "1px solid rgba(197,160,89,0.3)" }}>
                          <Calendar size={12} /> Book Appt
                        </button>
                      </div>

                      {/* M7: Convert to Invoice */}
                      {(selectedSession.conversion_status === "pending" || selectedSession.conversion_status === "partial") && (
                        <button onClick={convertToInvoice} disabled={converting}
                          className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                          style={{ background: "rgba(34,197,94,0.1)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.3)" }}>
                          {converting ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                          {converting ? "Converting…" : "Convert to Invoice"}
                        </button>
                      )}
                    </div>

                    {/* Doctor-Proposed Treatments Panel */}
                    <div>
                      <button
                        className="flex items-center gap-2 w-full text-left py-1"
                        onClick={() => setDoctorPanelOpen(p => !p)}
                      >
                        <span className="text-xs font-medium" style={{ color: "rgba(197,160,89,0.8)" }}>DOCTOR&apos;S PROPOSED TREATMENTS</span>
                        {doctorTreatments.length > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: "rgba(59,130,246,0.1)", color: "#2563eb" }}>{doctorTreatments.length}</span>
                        )}
                        <span className="ml-auto text-xs" style={{ color: "#9ca3af" }}>{doctorPanelOpen ? "▲" : "▼"}</span>
                      </button>
                      {doctorPanelOpen && (
                        <div className="mt-2 space-y-1.5">
                          {doctorTreatments.length === 0 ? (
                            <p className="text-xs py-2 text-center" style={{ color: "#9ca3af" }}>No doctor-proposed treatments</p>
                          ) : doctorTreatments.map(dt => (
                            <div key={dt.id} className="flex items-center justify-between p-2 rounded-lg"
                              style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.12)" }}>
                              <div>
                                <p className="text-xs font-medium" style={{ color: "#1a1714" }}>{dt.treatment_name}</p>
                                {dt.price != null && <p className="text-xs" style={{ color: "#6b7280" }}>₹{dt.price.toLocaleString()}</p>}
                              </div>
                              <button onClick={() => includeInSession(dt)}
                                className="text-xs px-2 py-1 rounded-lg font-medium"
                                style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)" }}>
                                Include
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-medium mb-2" style={{ color: "rgba(197,160,89,0.8)" }}>UPDATE STATUS</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {kanbanCols.map(s => {
                          const sc = STATUS_CONFIG[s];
                          return (
                            <button key={s} onClick={() => updateStatus(selectedSession.id, s)}
                              className="text-xs px-2 py-1.5 rounded-lg font-medium transition-all"
                              style={{
                                background: selectedSession.conversion_status === s ? sc.bg : "transparent",
                                color: sc.color, border: `1px solid ${sc.color}30`,
                              }}>{sc.label}</button>
                          );
                        })}
                      </div>
                    </div>

                    {selectedSession.notes && (
                      <div>
                        <p className="text-xs font-medium mb-0.5" style={{ color: "rgba(197,160,89,0.8)" }}>NOTES</p>
                        <p className="text-sm" style={{ color: "#4b5563" }}>{selectedSession.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PIPELINE TAB */}
        {tab === "pipeline" && (
          <div>
            <h2 className="text-lg font-semibold mb-5" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Conversion Pipeline</h2>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {kanbanCols.map(status => {
                const sc = STATUS_CONFIG[status];
                const StatusIcon = sc.icon;
                const colSessions = sessions.filter(s => s.conversion_status === status);
                return (
                  <div key={status} className="flex-shrink-0 w-72">
                    <div className="flex items-center gap-2 mb-3 px-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: sc.bg }}>
                        <StatusIcon size={12} style={{ color: sc.color }} />
                      </div>
                      <span className="text-sm font-semibold" style={{ color: "#1a1714", fontFamily: "Georgia, serif" }}>{sc.label}</span>
                      <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: sc.bg, color: sc.color }}>{colSessions.length}</span>
                    </div>
                    <div className="space-y-2">
                      {colSessions.map(s => {
                        const pkg = s.package_type ? PKG_BADGE[s.package_type] : null;
                        return (
                          <div key={s.id} className="p-3 rounded-xl" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.12)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                            <p className="text-sm font-medium mb-1" style={{ color: "#1a1714", fontFamily: "Georgia, serif" }}>{s.patients?.full_name}</p>
                            <p className="text-xs mb-1" style={{ color: "#6b7280" }}>{s.profiles?.full_name || "Unassigned"}</p>
                            {pkg && (
                              <span className="inline-block text-xs px-1.5 py-0.5 rounded-full mb-2 font-medium" style={{ background: pkg.bg, color: pkg.color }}>{pkg.label}</span>
                            )}
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold" style={{ color: "var(--gold)" }}>₹{(s.total_proposed || 0).toLocaleString()}</span>
                              {s.followup_date && (
                                <div className="flex items-center gap-1">
                                  <Calendar size={10} style={{ color: "#9ca3af" }} />
                                  <span className="text-xs" style={{ color: "#9ca3af" }}>{new Date(s.followup_date).toLocaleDateString("en-IN")}</span>
                                </div>
                              )}
                            </div>
                            <select className="w-full mt-2 text-xs px-2 py-1 rounded-lg border bg-white"
                              style={{ borderColor: "rgba(197,160,89,0.2)", color: sc.color }}
                              value={s.conversion_status}
                              onChange={e => updateStatus(s.id, e.target.value as ConversionStatus)}>
                              {kanbanCols.map(st => <option key={st} value={st}>{STATUS_CONFIG[st].label}</option>)}
                            </select>
                          </div>
                        );
                      })}
                      {colSessions.length === 0 && (
                        <div className="p-4 rounded-xl text-center text-xs" style={{ background: "rgba(197,160,89,0.04)", color: "#9ca3af", border: "1px dashed rgba(197,160,89,0.15)" }}>No sessions</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* GALLERY TAB */}
        {tab === "gallery" && clinicId && (
          <div>
            <h2 className="text-lg font-semibold mb-5" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Before &amp; After Gallery</h2>
            <GalleryTab clinicId={clinicId} />
          </div>
        )}
      </div>

      {/* NEW SESSION DRAWER */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setDrawerOpen(false)} />
          <div className="w-[720px] h-full overflow-y-auto flex flex-col" style={{ background: "#fff" }}>
            <div className="flex justify-between items-center px-6 py-5" style={{ borderBottom: "1px solid rgba(197,160,89,0.15)" }}>
              <h3 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>New Session</h3>
              <button onClick={() => setDrawerOpen(false)} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>

            <div className="flex-1 p-6 space-y-5">
              {/* Patient search */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Patient *</label>
                <input value={form.patient_search}
                  onChange={e => { setForm(f => ({ ...f, patient_search: e.target.value, patient_id: "" })); searchPatients(e.target.value); }}
                  placeholder="Search patient name…" className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                {patientResults.length > 0 && !form.patient_id && (
                  <div className="mt-1 border rounded-lg overflow-hidden" style={{ borderColor: "rgba(197,160,89,0.2)" }}>
                    {patientResults.map(p => (
                      <button key={p.id} className="w-full px-3 py-2 text-sm text-left hover:bg-gray-50"
                        onClick={() => { setForm(f => ({ ...f, patient_id: p.id, patient_search: p.full_name })); setPatientResults([]); }}>
                        {p.full_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Counsellor</label>
                  <select value={form.counsellor_id} onChange={e => setForm(f => ({ ...f, counsellor_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border outline-none text-sm bg-white"
                    style={{ borderColor: "rgba(197,160,89,0.3)" }}>
                    <option value="">Select counsellor</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Session Date</label>
                  <input type="date" value={form.session_date} onChange={e => setForm(f => ({ ...f, session_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                    style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Chief Complaint</label>
                <input value={form.chief_complaint} onChange={e => setForm(f => ({ ...f, chief_complaint: e.target.value }))}
                  placeholder="e.g. Pigmentation on cheeks, wants skin brightening"
                  className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }} />
              </div>

              {/* Package Type toggle */}
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: "#4b5563" }}>Package Type</label>
                <div className="flex gap-2">
                  {PKG_OPTIONS.map(opt => (
                    <button key={opt.key}
                      onClick={() => setForm(f => ({ ...f, package_type: opt.key }))}
                      className="flex-1 py-2 text-xs font-medium rounded-lg border transition-all"
                      style={form.package_type === opt.key
                        ? { background: "var(--gold)", color: "#fff", border: "1px solid var(--gold)" }
                        : { background: "transparent", color: "#6b7280", border: "1px solid rgba(197,160,89,0.25)" }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Treatments builder */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-medium" style={{ color: "#4b5563" }}>Treatments Discussed</label>
                  <button onClick={addTreatmentRow}
                    className="text-xs px-2 py-1 rounded flex items-center gap-1"
                    style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)" }}>
                    <Plus size={11} /> Add Treatment
                  </button>
                </div>

                {form.treatments.length === 0 ? (
                  <div className="text-center py-4 rounded-lg text-xs" style={{ color: "#9ca3af", border: "1px dashed rgba(197,160,89,0.2)" }}>
                    Click &quot;Add Treatment&quot; to add services discussed
                  </div>
                ) : (
                  <>
                    {/* Column headers — 7 cols */}
                    <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: "1fr 55px 75px 85px 65px 40px 24px" }}>
                      {["Service", "Sessions", "MRP ₹", "Quoted ₹", "Disc %", "Rec.", ""].map(h => (
                        <span key={h} className="text-xs font-medium px-1" style={{ color: "#9ca3af" }}>{h}</span>
                      ))}
                    </div>

                    {/* Treatment rows */}
                    <div className="space-y-1.5">
                      {form.treatments.map((t, i) => (
                        <div key={i} className="grid gap-1 items-center" style={{ gridTemplateColumns: "1fr 55px 75px 85px 65px 40px 24px" }}>
                          <select value={t.service_id} onChange={e => selectService(i, e.target.value)}
                            className="text-xs px-2 py-1.5 rounded border bg-white"
                            style={{ borderColor: "rgba(197,160,89,0.3)" }}>
                            <option value="">Select service</option>
                            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                          <input type="number" min={1} value={t.sessions}
                            onChange={e => updateRow(i, "sessions", e.target.value)}
                            className="text-xs px-2 py-1.5 rounded border text-center"
                            style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                          <input readOnly
                            value={t.mrp ? `₹${t.mrp.toLocaleString()}` : "—"}
                            className="text-xs px-2 py-1.5 rounded border text-center"
                            style={{ borderColor: "rgba(197,160,89,0.12)", background: "rgba(249,247,242,0.8)", color: "#9ca3af" }} />
                          <input type="number" value={t.quoted_price}
                            onChange={e => updateRow(i, "quoted_price", e.target.value)}
                            placeholder="0"
                            className="text-xs px-2 py-1.5 rounded border"
                            style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                          <input type="number" value={t.discount_pct}
                            onChange={e => updateRow(i, "discount_pct", e.target.value)}
                            placeholder="0"
                            className="text-xs px-2 py-1.5 rounded border"
                            style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                          <label className="flex items-center justify-center cursor-pointer">
                            <input type="checkbox" checked={t.recommended}
                              onChange={e => updateRow(i, "recommended", e.target.checked)}
                              className="w-3.5 h-3.5" />
                          </label>
                          <button onClick={() => setForm(f => ({ ...f, treatments: f.treatments.filter((_, j) => j !== i) }))}
                            className="p-1 hover:bg-red-50 rounded flex items-center justify-center">
                            <X size={12} style={{ color: "#ef4444" }} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Summary table */}
                    {form.treatments.some(t => t.service_name) && (
                      <div className="mt-4 rounded-lg overflow-hidden" style={{ border: "1px solid rgba(197,160,89,0.15)" }}>
                        <table className="w-full text-xs">
                          <thead>
                            <tr style={{ background: "rgba(197,160,89,0.06)" }}>
                              <th className="px-3 py-2 text-left font-medium" style={{ color: "#9ca3af" }}>Service</th>
                              <th className="px-3 py-2 text-center font-medium" style={{ color: "#9ca3af" }}>Sess.</th>
                              <th className="px-3 py-2 text-right font-medium" style={{ color: "#9ca3af" }}>MRP</th>
                              <th className="px-3 py-2 text-right font-medium" style={{ color: "#9ca3af" }}>Quoted</th>
                              <th className="px-3 py-2 text-right font-medium" style={{ color: "#9ca3af" }}>Discount</th>
                              <th className="px-3 py-2 text-center font-medium" style={{ color: "#9ca3af" }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {form.treatments.filter(t => t.service_name).map((t, i) => (
                              <tr key={i} style={{ borderTop: "1px solid rgba(197,160,89,0.08)" }}>
                                <td className="px-3 py-2" style={{ color: "#1a1714" }}>{t.service_name}</td>
                                <td className="px-3 py-2 text-center" style={{ color: "#6b7280" }}>{t.sessions || 1}</td>
                                <td className="px-3 py-2 text-right" style={{ color: "#9ca3af" }}>
                                  {t.mrp ? `₹${t.mrp.toLocaleString()}` : "—"}
                                </td>
                                <td className="px-3 py-2 text-right font-medium" style={{ color: "#1a1714" }}>
                                  {t.quoted_price ? `₹${parseFloat(t.quoted_price).toLocaleString()}` : "—"}
                                </td>
                                <td className="px-3 py-2 text-right" style={{ color: parseFloat(t.discount_pct) > 0 ? "#16a34a" : "#9ca3af" }}>
                                  {parseFloat(t.discount_pct) > 0 ? `${parseFloat(t.discount_pct).toFixed(1)}%` : "—"}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {t.recommended
                                    ? <span style={{ color: "#16a34a" }}>✓ Rec.</span>
                                    : <span style={{ color: "#9ca3af" }}>Not rec.</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ borderTop: "2px solid rgba(197,160,89,0.2)", background: "rgba(197,160,89,0.04)" }}>
                              <td className="px-3 py-2 font-semibold text-xs" style={{ color: "#6b7280" }}>TOTAL</td>
                              <td />
                              <td className="px-3 py-2 text-right font-semibold" style={{ color: "#9ca3af" }}>
                                {summaryTotalMrp > 0 ? `₹${summaryTotalMrp.toLocaleString()}` : "—"}
                              </td>
                              <td className="px-3 py-2 text-right font-bold" style={{ color: "var(--gold)" }}>
                                ₹{summaryTotalQuoted.toLocaleString()}
                              </td>
                              <td className="px-3 py-2 text-right" style={{ color: "#6b7280" }}>
                                {summaryAvgDisc > 0 ? `Avg ${summaryAvgDisc.toFixed(1)}%` : "—"}
                              </td>
                              <td className="px-3 py-2 text-center text-xs" style={{ color: "#6b7280" }}>
                                {summaryRec} accepted
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Follow-up Date</label>
                  <input type="date" value={form.followup_date} onChange={e => setForm(f => ({ ...f, followup_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                    style={{ borderColor: "rgba(197,160,89,0.3)" }} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3} placeholder="Additional notes…"
                  className="w-full px-3 py-2 rounded-lg border outline-none text-sm resize-none"
                  style={{ borderColor: "rgba(197,160,89,0.3)" }} />
              </div>
            </div>

            <div className="px-6 py-4 flex gap-3" style={{ borderTop: "1px solid rgba(197,160,89,0.15)" }}>
              <button onClick={() => setDrawerOpen(false)}
                className="flex-1 px-4 py-2 rounded-lg text-sm border"
                style={{ borderColor: "rgba(197,160,89,0.2)", color: "#6b7280" }}>Cancel</button>
              <button onClick={saveSession} disabled={saving || !form.patient_id}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "var(--gold)" }}>{saving ? "Saving…" : "Save Session"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Proforma Modal */}
      {proformaOpen && selectedSession && (
        <ProformaModal
          session={selectedSession}
          clinicName={clinicName}
          clinicId={clinicId ?? ""}
          onClose={() => setProformaOpen(false)}
        />
      )}

      {/* Reference Gallery Modal (from session detail) */}
      {/* Note: ReferenceGalleryModal can also be used inline in session detail panel */}
    </div>
  );
}

export default function CounsellingPageWrapper() {
  return (
    <Suspense fallback={null}>
      <CounsellingPage />
    </Suspense>
  );
}
