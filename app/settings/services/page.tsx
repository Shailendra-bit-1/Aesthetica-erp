"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles, Plus, Search, Filter, Package, Layers,
  Crown, Upload, Download, ChevronDown, X, Check,
  Clock, Tag, DollarSign, Percent, Star, Globe,
  Edit2, Trash2, Copy, AlertCircle, Loader2,
  ChevronRight, RefreshCw, Send, Zap, CreditCard,
  Calendar, ShieldCheck, Save,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import { toast } from "sonner";
import { ModuleGate } from "@flags/gate";
import CustomFieldsSection from "@/components/CustomFieldsSection";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Service {
  id: string;
  clinic_id: string | null;
  chain_id: string | null;
  name: string;
  category: string;
  duration_minutes: number;
  mrp: number;
  selling_price: number;
  discount_pct: number;
  is_premium: boolean;
  is_global_template: boolean;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface PackageItem {
  service_id: string;
  service_name: string;
  sessions: number;
}

interface ServicePackage {
  id: string;
  clinic_id: string | null;
  chain_id: string | null;
  name: string;
  description: string | null;
  total_price: number;
  mrp: number;
  discount_pct: number;
  is_active: boolean;
  is_fixed: boolean;
  is_global_template: boolean;
  valid_days: number;
  sell_from: string | null;
  sell_until: string | null;
  created_at: string;
  items: PackageItem[];
}

interface DiscountMatrix {
  id: string;
  chain_id: string | null;
  clinic_id: string | null;
  role: string;
  max_discount_pct: number;
  requires_otp: boolean;
  otp_approver_role: string | null;
}

const CATEGORIES = [
  "All", "Facial", "Laser", "Injectables", "Peel",
  "Rejuvenation", "Lifting", "Body", "Hair", "General",
];

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

// ── Main Page ─────────────────────────────────────────────────────────────────

function ServicesPageInner() {
  const { profile, activeClinicId, clinics, loading: profileLoading } = useClinic();
  const isSuperAdmin = profile?.role === "superadmin";
  const isAdmin = isSuperAdmin || profile?.role === "chain_admin" || profile?.role === "clinic_admin";

  const [tab, setTab] = useState<"services" | "packages" | "templates" | "discounts" | "consumables">("services");

  // Services state
  const [services, setServices] = useState<Service[]>([]);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [discountMatrix, setDiscountMatrix] = useState<DiscountMatrix[]>([]);
  const [loadingSvc,  setLoadingSvc]  = useState(true);
  const [loadingPkg,  setLoadingPkg]  = useState(true);
  const [loadingDM,   setLoadingDM]   = useState(false);
  const [searchSvc,   setSearchSvc]   = useState("");
  const [catFilter,   setCatFilter]   = useState("All");
  const [showAddSvc,  setShowAddSvc]  = useState(false);
  const [showPkgBuilder, setShowPkgBuilder] = useState(false);
  const [editSvc,     setEditSvc]     = useState<Service | null>(null);
  const [editPkg,     setEditPkg]     = useState<ServicePackage | null>(null);
  const [showImport,  setShowImport]  = useState(false);

  const fetchDiscountMatrix = useCallback(async () => {
    setLoadingDM(true);
    const { data } = await supabase.from("discount_approval_matrix").select("*").order("role");
    setDiscountMatrix(data ?? []);
    setLoadingDM(false);
  }, []);

  const fetchServices = useCallback(async () => {
    setLoadingSvc(true);
    let q = supabase
      .from("services")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (!isSuperAdmin && activeClinicId) {
      q = q.or(`clinic_id.eq.${activeClinicId},is_global_template.eq.true`);
    }

    const { data, error } = await q;
    if (error) { toast.error("Failed to load services"); }
    setServices(data ?? []);
    setLoadingSvc(false);
  }, [isSuperAdmin, activeClinicId]);

  const fetchPackages = useCallback(async () => {
    setLoadingPkg(true);
    let pq = supabase
      .from("service_packages")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (!isSuperAdmin && activeClinicId) {
      pq = pq.or(`clinic_id.eq.${activeClinicId},is_global_template.eq.true`);
    }

    const { data: pkgs } = await pq;

    if (!pkgs) { setLoadingPkg(false); return; }

    const pkgIds = pkgs.map(p => p.id);
    const { data: items } = await supabase
      .from("package_items")
      .select("package_id, service_id, sessions, services(name)")
      .in("package_id", pkgIds.length ? pkgIds : ["00000000-0000-0000-0000-000000000000"]);

    const enriched: ServicePackage[] = pkgs.map(p => ({
      ...p,
      items: (items ?? [])
        .filter(i => i.package_id === p.id)
        .map(i => ({
          service_id:   i.service_id,
          service_name: (i.services as unknown as { name: string } | null)?.name ?? "—",
          sessions:     i.sessions,
        })),
    }));

    setPackages(enriched);
    setLoadingPkg(false);
  }, [isSuperAdmin, activeClinicId]);

  useEffect(() => {
    if (profileLoading) return;
    fetchServices();
    fetchPackages();
  }, [profileLoading, fetchServices, fetchPackages]);

  useEffect(() => {
    if (tab === "discounts") fetchDiscountMatrix();
  }, [tab, fetchDiscountMatrix]);

  const filtered = services.filter(s => {
    const matchCat  = catFilter === "All" || s.category === catFilter;
    const matchSrch = s.name.toLowerCase().includes(searchSvc.toLowerCase()) ||
                      s.category.toLowerCase().includes(searchSvc.toLowerCase());
    return matchCat && matchSrch;
  });

  const templateServices = services.filter(s => s.is_global_template);
  const templatePackages  = packages.filter(p => p.is_global_template);

  return (
    <div className="min-h-full" style={{ background: "var(--background)" }}>


      <div className="px-8 py-8 max-w-screen-xl mx-auto">

        {/* Page header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
              Services & Packages
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              Manage treatments, bundles, and pricing for your clinic
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImport(true)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
                borderRadius: 10, border: "1px solid var(--border)",
                background: "var(--surface)", color: "var(--foreground)",
                fontSize: 13, fontFamily: "Georgia, serif", cursor: "pointer",
              }}
            >
              <Upload size={14} /> Import
            </button>
            <ExportButton services={services} packages={packages} />
            {tab === "services" && (
              <button
                onClick={() => { setEditSvc(null); setShowAddSvc(true); }}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
                  borderRadius: 10, border: "none",
                  background: "linear-gradient(135deg, #C5A059, #A8853A)",
                  color: "white", fontSize: 13, fontWeight: 600,
                  fontFamily: "Georgia, serif", cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(197,160,89,0.35)",
                }}
              >
                <Plus size={14} /> Add Service
              </button>
            )}
            {tab === "packages" && (
              <button
                onClick={() => { setEditPkg(null); setShowPkgBuilder(true); }}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
                  borderRadius: 10, border: "none",
                  background: "linear-gradient(135deg, #C5A059, #A8853A)",
                  color: "white", fontSize: 13, fontWeight: 600,
                  fontFamily: "Georgia, serif", cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(197,160,89,0.35)",
                }}
              >
                <Package size={14} /> Build Package
              </button>
            )}
          </div>
        </div>

        {/* Credits quick-link */}
        <div style={{ marginBottom: 16 }}>
          <Link
            href="/settings/services/credits"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "10px 18px", borderRadius: 12,
              background: "rgba(197,160,89,0.06)",
              border: "1px solid rgba(197,160,89,0.3)",
              textDecoration: "none", transition: "all 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(197,160,89,0.12)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(197,160,89,0.06)"; }}
          >
            <CreditCard size={14} style={{ color: "#C5A059" }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#A8853A", fontFamily: "Georgia, serif" }}>
              Manage Service Credits
            </span>
            <span style={{ fontSize: 11, color: "#9C9584" }}>— upgrades, refunds, transfers, commissions</span>
            <ChevronRight size={12} style={{ color: "#C5A059" }} />
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6" style={{ borderBottom: "1px solid var(--border)" }}>
          {([
            { key: "services",  label: "Services",       icon: <Sparkles size={14} />,    count: services.length, show: true         },
            { key: "packages",  label: "Packages",       icon: <Package  size={14} />,    count: packages.length, show: true         },
            { key: "templates", label: "Templates",      icon: <Crown    size={14} />,    count: templateServices.length + templatePackages.length, show: isSuperAdmin },
            { key: "discounts",   label: "Discount Rules", icon: <ShieldCheck size={14} />, count: discountMatrix.length, show: isAdmin },
            { key: "consumables", label: "Consumables",    icon: <Package    size={14} />, count: 0,                     show: isAdmin },
          ] as const)
            .filter(t => t.show)
            .map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as typeof tab)}
                style={{
                  padding: "10px 20px", border: "none", background: "transparent",
                  fontSize: 14, fontFamily: "Georgia, serif", cursor: "pointer",
                  fontWeight: tab === t.key ? 600 : 400,
                  color: tab === t.key ? "#C5A059" : "var(--text-muted)",
                  borderBottom: tab === t.key ? "2px solid #C5A059" : "2px solid transparent",
                  marginBottom: -1, transition: "all 0.15s",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                {t.icon}
                {t.label}
                <span style={{
                  fontSize: 11, background: tab === t.key ? "rgba(197,160,89,0.15)" : "rgba(0,0,0,0.06)",
                  color: tab === t.key ? "#C5A059" : "var(--text-muted)",
                  borderRadius: 999, padding: "1px 7px", fontWeight: 600,
                }}>
                  {t.count}
                </span>
              </button>
            ))}
        </div>

        {/* ── Services Tab ── */}
        {tab === "services" && (
          <ServicesTab
            services={filtered}
            loading={loadingSvc}
            search={searchSvc}
            onSearch={setSearchSvc}
            catFilter={catFilter}
            onCatFilter={setCatFilter}
            onEdit={(s) => { setEditSvc(s); setShowAddSvc(true); }}
            onDelete={async (id) => {
              await supabase.from("services").update({ is_active: false }).eq("id", id);
              toast.success("Service removed");
              fetchServices();
            }}
            onRefresh={fetchServices}
          />
        )}

        {/* ── Packages Tab ── */}
        {tab === "packages" && (
          <PackagesTab
            packages={packages.filter(p => !p.is_global_template || isSuperAdmin)}
            loading={loadingPkg}
            onEdit={(p) => { setEditPkg(p); setShowPkgBuilder(true); }}
            onDelete={async (id) => {
              await supabase.from("service_packages").update({ is_active: false }).eq("id", id);
              toast.success("Package removed");
              fetchPackages();
            }}
            onRefresh={fetchPackages}
          />
        )}

        {/* ── Discount Rules Tab (admin only) ── */}
        {tab === "discounts" && isAdmin && (
          <DiscountMatrixSection
            matrix={discountMatrix}
            loading={loadingDM}
            isSuperAdmin={isSuperAdmin}
            activeClinicId={activeClinicId}
            onRefresh={fetchDiscountMatrix}
          />
        )}

        {/* ── Consumables Tab ── */}
        {tab === "consumables" && isAdmin && (
          <ServiceConsumablesTab services={services} clinicId={activeClinicId} />
        )}

        {/* ── Global Templates Tab (superadmin only) ── */}
        {tab === "templates" && isSuperAdmin && (
          <TemplatesTab
            services={templateServices}
            packages={templatePackages}
            allClinics={clinics}
            onRefresh={() => { fetchServices(); fetchPackages(); }}
          />
        )}
      </div>

      {/* Drawers */}
      {showAddSvc && (
        <AddServiceDrawer
          editData={editSvc}
          clinicId={activeClinicId}
          isSuperAdmin={isSuperAdmin}
          onClose={() => { setShowAddSvc(false); setEditSvc(null); }}
          onSaved={() => { setShowAddSvc(false); setEditSvc(null); fetchServices(); }}
        />
      )}

      {showPkgBuilder && (
        <PackageBuilderDrawer
          services={services}
          clinicId={activeClinicId}
          isSuperAdmin={isSuperAdmin}
          isAdmin={isAdmin}
          editData={editPkg}
          onClose={() => { setShowPkgBuilder(false); setEditPkg(null); }}
          onSaved={() => { setShowPkgBuilder(false); setEditPkg(null); fetchPackages(); }}
        />
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); fetchServices(); fetchPackages(); }}
          clinicId={activeClinicId}
        />
      )}
    </div>
  );
}

// ── Gated export ──────────────────────────────────────────────────────────────

export default function ServicesPage() {
  return (
    <ModuleGate module="services">
      <ServicesPageInner />
    </ModuleGate>
  );
}

// ── Services Tab ──────────────────────────────────────────────────────────────

function ServicesTab({
  services, loading, search, onSearch, catFilter, onCatFilter, onEdit, onDelete, onRefresh,
}: {
  services: Service[];
  loading: boolean;
  search: string;
  onSearch: (v: string) => void;
  catFilter: string;
  onCatFilter: (v: string) => void;
  onEdit: (s: Service) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div>
      {/* Search + filter bar */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl flex-1"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", maxWidth: 340 }}
        >
          <Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search services…"
            className="bg-transparent outline-none flex-1 text-sm"
            style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}
          />
          {search && <button onClick={() => onSearch("")}><X size={13} style={{ color: "var(--text-muted)" }} /></button>}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => onCatFilter(c)}
              style={{
                padding: "5px 13px", borderRadius: 999, fontSize: 12,
                fontFamily: "Georgia, serif", cursor: "pointer",
                border: catFilter === c ? "1px solid #C5A059" : "1px solid var(--border)",
                background: catFilter === c ? "rgba(197,160,89,0.12)" : "var(--surface)",
                color: catFilter === c ? "#C5A059" : "var(--text-muted)",
                fontWeight: catFilter === c ? 600 : 400,
              }}
            >
              {c}
            </button>
          ))}
        </div>

        <button
          onClick={onRefresh}
          style={{ marginLeft: "auto", color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer" }}
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} style={{ color: "rgba(197,160,89,0.5)", animation: "spin 1s linear infinite" }} />
        </div>
      ) : services.length === 0 ? (
        <EmptyState icon={<Sparkles size={32} />} text="No services found" sub="Add your first treatment service" />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {services.map(s => (
            <ServiceCard key={s.id} service={s} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}

// ── Service Card ──────────────────────────────────────────────────────────────

function ServiceCard({ service: s, onEdit, onDelete }: {
  service: Service;
  onEdit: (s: Service) => void;
  onDelete: (id: string) => void;
}) {
  const savings = s.mrp - s.selling_price;

  return (
    <div
      style={{
        background: "white",
        borderRadius: 16,
        border: s.is_premium
          ? "1px solid rgba(197,160,89,0.45)"
          : "1px solid var(--border)",
        boxShadow: s.is_premium
          ? "0 2px 16px rgba(197,160,89,0.12)"
          : "0 1px 4px rgba(0,0,0,0.04)",
        overflow: "hidden",
        transition: "box-shadow 0.2s",
      }}
    >
      {/* Top gold bar for premium */}
      {s.is_premium && (
        <div style={{ height: 2, background: "linear-gradient(90deg, #A8853A, #C5A059, #E8CC8A, #C5A059, #A8853A)" }} />
      )}

      <div style={{ padding: "18px 20px" }}>
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {s.is_premium && <Star size={12} fill="#C5A059" color="#C5A059" />}
              {s.is_global_template && <Globe size={12} style={{ color: "#7A9E8E" }} />}
              <span
                style={{
                  fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "0.1em", color: "#9C9584",
                }}
              >
                {s.category}
              </span>
            </div>
            <h3
              style={{
                fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 600,
                color: "var(--foreground)", margin: 0,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >
              {s.name}
            </h3>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => onEdit(s)}
              style={{
                background: "rgba(197,160,89,0.08)", border: "none", borderRadius: 8,
                padding: "5px 7px", cursor: "pointer", color: "#C5A059",
              }}
            >
              <Edit2 size={13} />
            </button>
            <button
              onClick={() => {
                if (confirm(`Remove "${s.name}"?`)) onDelete(s.id);
              }}
              style={{
                background: "rgba(180,60,60,0.06)", border: "none", borderRadius: 8,
                padding: "5px 7px", cursor: "pointer", color: "#B43C3C",
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Description */}
        {s.description && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>
            {s.description}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-4 mb-4">
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#9C9584" }}>
            <Clock size={11} /> {s.duration_minutes} min
          </span>
          {s.discount_pct > 0 && (
            <span style={{
              display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700,
              color: "#4A8A4A", background: "rgba(74,138,74,0.1)", padding: "2px 8px",
              borderRadius: 999,
            }}>
              <Percent size={10} /> {s.discount_pct}% off
            </span>
          )}
        </div>

        {/* Pricing */}
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px", borderRadius: 10,
            background: s.is_premium ? "rgba(197,160,89,0.06)" : "rgba(249,247,242,0.8)",
            border: s.is_premium ? "1px solid rgba(197,160,89,0.15)" : "1px solid var(--border)",
          }}
        >
          <div>
            <p style={{ fontSize: 10, color: "#9C9584", margin: 0 }}>Selling Price</p>
            <p style={{
              fontSize: 18, fontWeight: 700, fontFamily: "Georgia, serif",
              color: s.is_premium ? "#C5A059" : "var(--foreground)", margin: 0,
            }}>
              {fmt(s.selling_price)}
            </p>
          </div>
          {s.mrp > s.selling_price && (
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 10, color: "#9C9584", margin: 0 }}>MRP</p>
              <p style={{ fontSize: 13, color: "#B0A898", textDecoration: "line-through", margin: 0 }}>
                {fmt(s.mrp)}
              </p>
              <p style={{ fontSize: 11, color: "#4A8A4A", fontWeight: 600, margin: 0 }}>
                Save {fmt(savings)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Packages Tab ──────────────────────────────────────────────────────────────

function PackagesTab({ packages, loading, onEdit, onDelete, onRefresh }: {
  packages: ServicePackage[];
  loading: boolean;
  onEdit: (p: ServicePackage) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {packages.length} package{packages.length !== 1 ? "s" : ""} · packages with a sell window show a calendar badge
        </p>
        <button onClick={onRefresh} style={{ color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer" }}>
          <RefreshCw size={15} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} style={{ color: "rgba(197,160,89,0.5)", animation: "spin 1s linear infinite" }} />
        </div>
      ) : packages.length === 0 ? (
        <EmptyState icon={<Package size={32} />} text="No packages yet" sub="Use the Package Builder to create your first bundle" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {packages.map(p => (
            <PackageCard
              key={p.id}
              pkg={p}
              today={today}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Package Card ──────────────────────────────────────────────────────────────

function PackageCard({ pkg: p, today, onEdit, onDelete }: {
  pkg: ServicePackage;
  today: string;
  onEdit: (p: ServicePackage) => void;
  onDelete: (id: string) => void;
}) {
  const savings = p.mrp - p.total_price;
  const validYears = p.valid_days === 365 ? "1 year" : p.valid_days === 730 ? "2 years" : `${p.valid_days} days`;

  // Sell-window state
  const notYetOnSale = p.sell_from && p.sell_from > today;
  const saleEnded    = p.sell_until && p.sell_until < today;
  const sellWindowActive = !notYetOnSale && !saleEnded;

  return (
    <div
      style={{
        background: "white", borderRadius: 18,
        border: saleEnded
          ? "1px solid rgba(180,60,60,0.25)"
          : notYetOnSale
            ? "1px solid rgba(197,160,89,0.2)"
            : "1px solid rgba(197,160,89,0.3)",
        boxShadow: "0 2px 20px rgba(197,160,89,0.1)",
        overflow: "hidden",
        opacity: saleEnded ? 0.75 : 1,
      }}
    >
      {/* Gold header */}
      <div style={{
        padding: "16px 20px",
        background: "linear-gradient(135deg, rgba(197,160,89,0.12), rgba(168,133,58,0.06))",
        borderBottom: "1px solid rgba(197,160,89,0.15)",
      }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Package size={13} style={{ color: "#C5A059" }} />
              {p.is_fixed && (
                <span style={{
                  fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em",
                  color: "white", background: "#C5A059", padding: "2px 7px", borderRadius: 999,
                }}>Fixed</span>
              )}
              {p.is_global_template && (
                <span style={{
                  fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em",
                  color: "#7A9E8E", background: "rgba(122,158,142,0.15)", padding: "2px 7px", borderRadius: 999,
                }}>Global</span>
              )}
              {/* Sell-window badge */}
              {saleEnded && (
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#B43C3C", background: "rgba(180,60,60,0.1)", padding: "2px 7px", borderRadius: 999 }}>
                  Sale Ended
                </span>
              )}
              {notYetOnSale && (
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#A8853A", background: "rgba(197,160,89,0.15)", padding: "2px 7px", borderRadius: 999 }}>
                  Upcoming
                </span>
              )}
            </div>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
              {p.name}
            </h3>
            {p.description && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, marginBottom: 0 }}>{p.description}</p>
            )}
          </div>
          {/* Action buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => onEdit(p)}
              style={{ background: "rgba(197,160,89,0.08)", border: "none", borderRadius: 8, padding: "5px 7px", cursor: "pointer", color: "#C5A059" }}
            >
              <Edit2 size={13} />
            </button>
            {!p.is_fixed && (
              <button
                onClick={() => { if (confirm(`Remove "${p.name}"?`)) onDelete(p.id); }}
                style={{ background: "rgba(180,60,60,0.06)", border: "none", borderRadius: 8, padding: "5px 7px", cursor: "pointer", color: "#B43C3C" }}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Items list */}
      <div style={{ padding: "14px 20px" }}>
        <div className="space-y-2 mb-4">
          {p.items.map((it, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#C5A059", flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "var(--foreground)", fontFamily: "Georgia, serif" }}>{it.service_name}</span>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, color: "#C5A059",
                background: "rgba(197,160,89,0.1)", padding: "2px 9px", borderRadius: 999,
              }}>
                {it.sessions} {it.sessions === 1 ? "session" : "sessions"}
              </span>
            </div>
          ))}
        </div>

        {/* Validity + sell window */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <span style={{
            display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#6B6358",
            background: "rgba(197,160,89,0.06)", border: "1px solid rgba(197,160,89,0.15)",
            padding: "3px 10px", borderRadius: 999,
          }}>
            <Calendar size={10} /> Valid {validYears} from purchase
          </span>
          {(p.sell_from || p.sell_until) && (
            <span style={{
              display: "flex", alignItems: "center", gap: 4, fontSize: 11,
              color: saleEnded ? "#B43C3C" : notYetOnSale ? "#A8853A" : "#4A8A4A",
              background: saleEnded ? "rgba(180,60,60,0.06)" : notYetOnSale ? "rgba(197,160,89,0.08)" : "rgba(74,138,74,0.08)",
              border: `1px solid ${saleEnded ? "rgba(180,60,60,0.2)" : notYetOnSale ? "rgba(197,160,89,0.25)" : "rgba(74,138,74,0.2)"}`,
              padding: "3px 10px", borderRadius: 999,
            }}>
              <Calendar size={10} />
              {p.sell_from && `From ${new Date(p.sell_from).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`}
              {p.sell_from && p.sell_until && " – "}
              {p.sell_until && `Until ${new Date(p.sell_until).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`}
            </span>
          )}
        </div>

        {/* Pricing */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px", borderRadius: 10,
          background: "rgba(197,160,89,0.06)", border: "1px solid rgba(197,160,89,0.15)",
        }}>
          <div>
            <p style={{ fontSize: 10, color: "#9C9584", margin: 0 }}>Package Price</p>
            <p style={{ fontSize: 20, fontWeight: 700, fontFamily: "Georgia, serif", color: "#C5A059", margin: 0 }}>
              {fmt(p.total_price)}
            </p>
          </div>
          {savings > 0 && (
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 12, color: "#B0A898", textDecoration: "line-through", margin: 0 }}>{fmt(p.mrp)}</p>
              <p style={{ fontSize: 12, color: "#4A8A4A", fontWeight: 700, margin: 0 }}>
                Save {fmt(savings)} ({p.discount_pct}% off)
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Global Templates Tab (Superadmin) ─────────────────────────────────────────

function TemplatesTab({ services, packages, allClinics, onRefresh }: {
  services: Service[];
  packages: ServicePackage[];
  allClinics: { id: string; name: string; location: string | null }[];
  onRefresh: () => void;
}) {
  const [pushing, setPushing] = useState(false);
  const [selectedClinics, setSelectedClinics] = useState<string[]>([]);

  async function pushToAllClinics() {
    if (selectedClinics.length === 0) {
      toast.error("Select at least one clinic to push to");
      return;
    }
    setPushing(true);
    try {
      for (const cid of selectedClinics) {
        // Push global services to clinic
        const svcInserts = services.map(s => ({
          clinic_id: cid, name: s.name, category: s.category,
          duration_minutes: s.duration_minutes, mrp: s.mrp,
          selling_price: s.selling_price, discount_pct: s.discount_pct,
          is_premium: s.is_premium, is_global_template: false,
          description: s.description,
        }));
        if (svcInserts.length > 0) {
          await supabase.from("services").upsert(svcInserts, { onConflict: "clinic_id,name" });
        }

        // Push global packages + their items
        for (const pkg of packages) {
          const { data: newPkg } = await supabase
            .from("service_packages")
            .insert({
              clinic_id: cid, name: pkg.name, description: pkg.description,
              total_price: pkg.total_price, mrp: pkg.mrp, discount_pct: pkg.discount_pct,
              is_fixed: pkg.is_fixed, is_global_template: false,
            })
            .select("id")
            .single();

          if (newPkg && pkg.items.length > 0) {
            // Find newly created clinic service IDs
            const { data: clinicSvcs } = await supabase
              .from("services")
              .select("id, name")
              .eq("clinic_id", cid)
              .in("name", pkg.items.map(i => i.service_name));

            const nameToId: Record<string, string> = {};
            (clinicSvcs ?? []).forEach(cs => { nameToId[cs.name] = cs.id; });

            const itemInserts = pkg.items
              .filter(i => nameToId[i.service_name])
              .map(i => ({
                package_id: newPkg.id,
                service_id: nameToId[i.service_name],
                sessions: i.sessions,
              }));
            if (itemInserts.length) {
              await supabase.from("package_items").insert(itemInserts);
            }
          }
        }
      }
      toast.success(`Pushed ${services.length} services & ${packages.length} packages to ${selectedClinics.length} clinic(s)`);
      setSelectedClinics([]);
      onRefresh();
    } catch {
      toast.error("Push failed — check console");
    } finally {
      setPushing(false);
    }
  }

  return (
    <div>
      {/* God Mode Banner */}
      <div style={{
        padding: "16px 24px", borderRadius: 14, marginBottom: 24,
        background: "linear-gradient(135deg, rgba(197,160,89,0.18), rgba(168,133,58,0.1))",
        border: "1px solid rgba(197,160,89,0.4)",
        boxShadow: "0 0 24px rgba(197,160,89,0.15)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
      }}>
        <div className="flex items-center gap-3">
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "rgba(197,160,89,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Crown size={20} style={{ color: "#C5A059" }} />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, fontFamily: "Georgia, serif", color: "#1C1917", margin: 0 }}>
              Global Service Templates
            </p>
            <p style={{ fontSize: 12, color: "#9C9584", margin: 0 }}>
              {services.length} services · {packages.length} packages · Push to any clinic with one click
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div style={{ fontSize: 12, color: "#6B6358" }}>
            Select clinics to push to:
          </div>
          <div className="flex flex-wrap gap-2">
            {allClinics.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedClinics(prev =>
                  prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id]
                )}
                style={{
                  padding: "5px 12px", borderRadius: 999, fontSize: 12,
                  fontFamily: "Georgia, serif", cursor: "pointer",
                  border: selectedClinics.includes(c.id) ? "1px solid #C5A059" : "1px solid rgba(197,160,89,0.3)",
                  background: selectedClinics.includes(c.id) ? "rgba(197,160,89,0.15)" : "rgba(197,160,89,0.05)",
                  color: selectedClinics.includes(c.id) ? "#A8853A" : "#9C9584",
                  display: "flex", alignItems: "center", gap: 5,
                }}
              >
                {selectedClinics.includes(c.id) && <Check size={11} />}
                {c.name}
              </button>
            ))}
          </div>
          <button
            onClick={pushToAllClinics}
            disabled={pushing || selectedClinics.length === 0}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 10, border: "none",
              background: selectedClinics.length === 0
                ? "rgba(197,160,89,0.3)"
                : "linear-gradient(135deg, #C5A059, #A8853A)",
              color: "white", fontSize: 13, fontWeight: 600,
              fontFamily: "Georgia, serif", cursor: selectedClinics.length === 0 ? "not-allowed" : "pointer",
              boxShadow: selectedClinics.length > 0 ? "0 4px 14px rgba(197,160,89,0.4)" : "none",
              whiteSpace: "nowrap",
            }}
          >
            {pushing ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={13} />}
            Push to Clinics
          </button>
        </div>
      </div>

      {/* Template Services */}
      <h3 style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 600, color: "var(--foreground)", marginBottom: 16 }}>
        Global Services ({services.length})
      </h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 mb-8">
        {services.map(s => (
          <ServiceCard key={s.id} service={s} onEdit={() => {}} onDelete={() => {}} />
        ))}
      </div>

      <h3 style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 600, color: "var(--foreground)", marginBottom: 16 }}>
        Global Packages ({packages.length})
      </h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {packages.map(p => (
          <PackageCard
            key={p.id}
            pkg={p}
            today={new Date().toISOString().slice(0, 10)}
            onEdit={() => {}}
            onDelete={() => {}}
          />
        ))}
      </div>
    </div>
  );
}

// ── Add / Edit Service Drawer ─────────────────────────────────────────────────

function AddServiceDrawer({ editData, clinicId, isSuperAdmin, onClose, onSaved }: {
  editData: Service | null;
  clinicId: string | null;
  isSuperAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name,        setName]        = useState(editData?.name ?? "");
  const [category,    setCategory]    = useState(editData?.category ?? "Facial");
  const [duration,    setDuration]    = useState(String(editData?.duration_minutes ?? 60));
  const [mrp,         setMrp]         = useState(String(editData?.mrp ?? ""));
  const [price,       setPrice]       = useState(String(editData?.selling_price ?? ""));
  const [description, setDescription] = useState(editData?.description ?? "");
  const [isPremium,   setIsPremium]   = useState(editData?.is_premium ?? false);
  const [isGlobal,    setIsGlobal]    = useState(editData?.is_global_template ?? false);
  const [saving,      setSaving]      = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountPct, setDiscountPct] = useState(String(editData?.discount_pct ?? 0));
  const [discountOtp, setDiscountOtp] = useState("");
  const [otpSent,     setOtpSent]     = useState(false);

  const computedDiscount = mrp && price
    ? Math.round(((Number(mrp) - Number(price)) / Number(mrp)) * 100 * 10) / 10
    : 0;

  async function requestOtp() {
    // Generate a 6-digit OTP and store in DB for approval
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const { data: user } = await supabase.auth.getUser();
    await supabase.from("discount_approvals").insert({
      clinic_id: clinicId,
      requested_by: user.user?.id,
      discount_pct: Number(discountPct),
      otp_code: otp,
      otp_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      status: "pending",
    });
    toast.success(`OTP sent: ${otp}`, { description: "Use this code to approve the discount (demo mode)", duration: 15000 });
    setOtpSent(true);
  }

  async function handleSave() {
    if (!name.trim()) { toast.error("Service name is required"); return; }
    if (!price)       { toast.error("Selling price is required"); return; }

    setSaving(true);
    const payload = {
      name: name.trim(),
      category,
      duration_minutes: Number(duration) || 60,
      mrp:          Number(mrp) || Number(price),
      selling_price: Number(price),
      discount_pct: computedDiscount,
      is_premium: isPremium,
      is_global_template: isSuperAdmin ? isGlobal : false,
      description: description.trim() || null,
      clinic_id: (!isSuperAdmin || !isGlobal) ? clinicId : null,
    };

    if (editData) {
      const { error } = await supabase.from("services").update(payload).eq("id", editData.id);
      if (error) { toast.error("Failed to update service"); setSaving(false); return; }
      toast.success(`"${name}" updated`);
    } else {
      const { error } = await supabase.from("services").insert(payload);
      if (error) { toast.error("Failed to add service"); setSaving(false); return; }
      toast.success(`"${name}" added`);
    }
    onSaved();
  }

  return (
    <DrawerOverlay onClose={onClose}>
      <div style={{ padding: "28px 28px 24px" }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
              {editData ? "Edit Service" : "Add New Service"}
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              {editData ? "Update service details" : "Define a new treatment offering"}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
            <X size={20} />
          </button>
        </div>

        {/* Gold divider */}
        <div style={{ height: 1, background: "linear-gradient(to right, #C5A059, transparent)", marginBottom: 24 }} />

        <div className="space-y-5">
          {/* Name */}
          <FormField label="Service Name" required>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. HydraFacial Elite"
              style={drawerInput}
            />
          </FormField>

          {/* Category + Duration */}
          <div className="flex gap-4">
            <FormField label="Category" style={{ flex: 1 }}>
              <select value={category} onChange={e => setCategory(e.target.value)} style={drawerInput}>
                {CATEGORIES.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label="Duration (min)" style={{ flex: 1 }}>
              <input
                type="number" value={duration} min={5} max={480}
                onChange={e => setDuration(e.target.value)}
                style={drawerInput}
              />
            </FormField>
          </div>

          {/* MRP + Selling Price */}
          <div className="flex gap-4">
            <FormField label="MRP (₹)" style={{ flex: 1 }}>
              <input
                type="number" value={mrp} min={0}
                onChange={e => setMrp(e.target.value)}
                placeholder="0"
                style={drawerInput}
              />
            </FormField>
            <FormField label="Selling Price (₹)" required style={{ flex: 1 }}>
              <input
                type="number" value={price} min={0}
                onChange={e => setPrice(e.target.value)}
                placeholder="0"
                style={drawerInput}
              />
            </FormField>
          </div>

          {/* Computed discount display */}
          {computedDiscount > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
              borderRadius: 10, background: "rgba(74,138,74,0.08)", border: "1px solid rgba(74,138,74,0.2)",
            }}>
              <Percent size={13} style={{ color: "#4A8A4A" }} />
              <span style={{ fontSize: 13, color: "#4A8A4A", fontWeight: 600 }}>
                {computedDiscount}% discount · Customer saves {fmt(Number(mrp) - Number(price))}
              </span>
            </div>
          )}

          {/* Extra discount with OTP approval */}
          <div>
            <button
              onClick={() => setShowDiscount(d => !d)}
              style={{
                display: "flex", alignItems: "center", gap: 6, fontSize: 12,
                color: "#C5A059", background: "transparent", border: "none", cursor: "pointer",
                fontFamily: "Georgia, serif",
              }}
            >
              <Zap size={13} /> Apply Special Discount (OTP Required)
              <ChevronDown size={13} style={{ transform: showDiscount ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </button>

            {showDiscount && (
              <div style={{ marginTop: 10, padding: 14, borderRadius: 12, background: "rgba(197,160,89,0.06)", border: "1px solid rgba(197,160,89,0.2)" }}>
                <div className="flex gap-3 items-end">
                  <FormField label="Discount %" style={{ flex: 1 }}>
                    <input
                      type="number" value={discountPct} min={0} max={100}
                      onChange={e => setDiscountPct(e.target.value)}
                      style={drawerInput}
                    />
                  </FormField>
                  {!otpSent ? (
                    <button
                      onClick={requestOtp}
                      style={{
                        padding: "9px 14px", borderRadius: 10, border: "1px solid #C5A059",
                        background: "rgba(197,160,89,0.1)", color: "#C5A059",
                        fontSize: 13, cursor: "pointer", fontFamily: "Georgia, serif",
                        display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
                      }}
                    >
                      <Send size={13} /> Request OTP
                    </button>
                  ) : (
                    <FormField label="Enter OTP" style={{ flex: 1 }}>
                      <input
                        value={discountOtp}
                        onChange={e => setDiscountOtp(e.target.value)}
                        placeholder="6-digit OTP"
                        maxLength={6}
                        style={drawerInput}
                      />
                    </FormField>
                  )}
                </div>
                <p style={{ fontSize: 11, color: "#9C9584", marginTop: 8 }}>
                  <AlertCircle size={11} style={{ display: "inline", marginRight: 4 }} />
                  Special discounts require OTP approval from an admin
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          <FormField label="Description">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of this treatment…"
              rows={3}
              style={{ ...drawerInput, resize: "vertical", lineHeight: 1.5 }}
            />
          </FormField>

          {/* Toggles */}
          <div className="flex gap-6">
            <ToggleField
              label="Premium Service"
              sub="Gold card highlight"
              checked={isPremium}
              onChange={setIsPremium}
            />
            {isSuperAdmin && (
              <ToggleField
                label="Global Template"
                sub="Visible to all clinics"
                checked={isGlobal}
                onChange={setIsGlobal}
              />
            )}
          </div>
        </div>

        {/* Custom Fields — edit mode only */}
        {editData && (
          <div style={{ borderTop: "1px solid rgba(197,160,89,0.15)", paddingTop: 16, marginTop: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9C9584", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>Custom Fields</p>
            <CustomFieldsSection entityType="services" entityId={editData.id} clinicId={clinicId ?? ""} />
          </div>
        )}

        {/* GAP-22: Consumables — edit mode only */}
        {editData && clinicId && (
          <ConsumablesSection serviceId={editData.id} clinicId={clinicId} />
        )}

        {/* Footer */}
        <div className="flex gap-3 mt-8">
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: "11px 0", borderRadius: 12,
              border: "1px solid var(--border)", background: "var(--surface)",
              color: "var(--foreground)", fontSize: 14,
              fontFamily: "Georgia, serif", cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 2, padding: "11px 0", borderRadius: 12, border: "none",
              background: saving ? "rgba(197,160,89,0.5)" : "linear-gradient(135deg, #C5A059, #A8853A)",
              color: "white", fontSize: 14, fontWeight: 600,
              fontFamily: "Georgia, serif", cursor: saving ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              boxShadow: "0 4px 14px rgba(197,160,89,0.3)",
            }}
          >
            {saving && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
            {editData ? "Update Service" : "Add Service"}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </DrawerOverlay>
  );
}

// ── Package Builder Drawer ────────────────────────────────────────────────────

function PackageBuilderDrawer({ services, clinicId, isSuperAdmin, isAdmin, editData, onClose, onSaved }: {
  services: Service[];
  clinicId: string | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  editData: ServicePackage | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name,        setName]        = useState(editData?.name ?? "");
  const [description, setDescription] = useState(editData?.description ?? "");
  const [totalPrice,  setTotalPrice]  = useState(String(editData?.total_price ?? ""));
  const [mrp,         setMrp]         = useState(String(editData?.mrp ?? ""));
  const [isFixed,     setIsFixed]     = useState(editData?.is_fixed ?? false);
  const [isGlobal,    setIsGlobal]    = useState(editData?.is_global_template ?? false);
  const [validDays,   setValidDays]   = useState(String(editData?.valid_days ?? 365));
  const [sellFrom,    setSellFrom]    = useState(editData?.sell_from ?? "");
  const [sellUntil,   setSellUntil]   = useState(editData?.sell_until ?? "");
  const [saving,      setSaving]      = useState(false);
  const [svcSearch,   setSvcSearch]   = useState("");

  // Pre-populate from editData items
  const initSelected: Record<string, number> = {};
  if (editData) {
    editData.items.forEach(i => { initSelected[i.service_id] = i.sessions; });
  }
  const [selected, setSelected] = useState<Record<string, number>>(initSelected);

  const filteredSvcs = services.filter(s =>
    s.name.toLowerCase().includes(svcSearch.toLowerCase()) ||
    s.category.toLowerCase().includes(svcSearch.toLowerCase())
  );

  const selectedItems = Object.entries(selected)
    .filter(([, sessions]) => sessions > 0)
    .map(([id, sessions]) => ({
      service_id: id,
      service_name: services.find(s => s.id === id)?.name ?? "—",
      sessions,
      price: (services.find(s => s.id === id)?.selling_price ?? 0) * sessions,
    }));

  const autoMrp = selectedItems.reduce((acc, i) => acc + i.price, 0);

  function adjustSessions(id: string, delta: number) {
    setSelected(prev => {
      const cur = prev[id] ?? 0;
      const next = Math.max(0, cur + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: next };
    });
  }

  async function handleSave() {
    if (!name.trim()) { toast.error("Package name is required"); return; }
    if (selectedItems.length === 0) { toast.error("Add at least one service to the package"); return; }
    if (!totalPrice) { toast.error("Package price is required"); return; }

    setSaving(true);
    const computedDiscount = mrp && totalPrice && Number(mrp) > Number(totalPrice)
      ? Math.round(((Number(mrp) - Number(totalPrice)) / Number(mrp)) * 100 * 10) / 10
      : 0;

    const payload = {
      clinic_id: (!isSuperAdmin || !isGlobal) ? clinicId : null,
      name: name.trim(),
      description: description.trim() || null,
      total_price: Number(totalPrice),
      mrp: Number(mrp) || autoMrp,
      discount_pct: computedDiscount,
      is_fixed: isFixed,
      is_global_template: isSuperAdmin ? isGlobal : false,
      valid_days: Number(validDays) || 365,
      sell_from: sellFrom || null,
      sell_until: sellUntil || null,
    };

    if (editData) {
      // Update existing package
      const { error } = await supabase.from("service_packages").update(payload).eq("id", editData.id);
      if (error) { toast.error("Failed to update package"); setSaving(false); return; }
      // Replace items: delete old, insert new
      await supabase.from("package_items").delete().eq("package_id", editData.id);
      const items = selectedItems.map(i => ({ package_id: editData.id, service_id: i.service_id, sessions: i.sessions }));
      if (items.length) await supabase.from("package_items").insert(items);
      toast.success(`"${name}" updated`);
    } else {
      // Create new package
      const { data: pkg, error } = await supabase
        .from("service_packages")
        .insert(payload)
        .select("id")
        .single();
      if (error || !pkg) { toast.error("Failed to create package"); setSaving(false); return; }
      const items = selectedItems.map(i => ({ package_id: pkg.id, service_id: i.service_id, sessions: i.sessions }));
      await supabase.from("package_items").insert(items);
      toast.success(`"${name}" package created with ${selectedItems.length} services`);
    }
    onSaved();
  }

  return (
    <DrawerOverlay onClose={onClose} wide>
      <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>

        {/* Left: Service picker */}
        <div style={{
          width: 320, borderRight: "1px solid var(--border)",
          display: "flex", flexDirection: "column",
          background: "rgba(249,247,242,0.5)",
        }}>
          <div style={{ padding: "24px 20px 16px", borderBottom: "1px solid var(--border)" }}>
            <p style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: "0 0 12px" }}>
              Choose Services
            </p>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
              borderRadius: 10, background: "white", border: "1px solid var(--border)",
            }}>
              <Search size={13} style={{ color: "var(--text-muted)" }} />
              <input
                value={svcSearch}
                onChange={e => setSvcSearch(e.target.value)}
                placeholder="Search services…"
                style={{ background: "transparent", border: "none", outline: "none", fontSize: 13, flex: 1, fontFamily: "Georgia, serif", color: "var(--foreground)" }}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
            {filteredSvcs.map(s => {
              const count = selected[s.id] ?? 0;
              return (
                <div
                  key={s.id}
                  style={{
                    display: "flex", alignItems: "center", padding: "10px 8px",
                    borderRadius: 10, marginBottom: 2,
                    background: count > 0 ? "rgba(197,160,89,0.08)" : "transparent",
                    border: count > 0 ? "1px solid rgba(197,160,89,0.2)" : "1px solid transparent",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: "Georgia, serif", fontSize: 13, fontWeight: 600, color: "var(--foreground)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.is_premium && <Star size={10} fill="#C5A059" color="#C5A059" style={{ marginRight: 4, display: "inline" }} />}
                      {s.name}
                    </p>
                    <p style={{ fontSize: 11, color: "#9C9584", margin: 0 }}>
                      {s.category} · {fmt(s.selling_price)}/session
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {count > 0 && (
                      <>
                        <button
                          onClick={() => adjustSessions(s.id, -1)}
                          style={{ width: 24, height: 24, borderRadius: "50%", border: "1px solid rgba(197,160,89,0.4)", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#C5A059", fontWeight: 700, fontSize: 14 }}
                        >−</button>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#C5A059", minWidth: 16, textAlign: "center" }}>{count}</span>
                      </>
                    )}
                    <button
                      onClick={() => adjustSessions(s.id, 1)}
                      style={{ width: 24, height: 24, borderRadius: "50%", border: "1px solid rgba(197,160,89,0.4)", background: count > 0 ? "#C5A059" : "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: count > 0 ? "white" : "#C5A059", fontWeight: 700, fontSize: 14 }}
                    >+</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Package form */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "24px 28px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
                {editData ? "Edit Package" : "Package Builder"}
              </h2>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                {editData ? "Update package details and services" : "Bundle services into a discounted package"}
              </p>
            </div>
            <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>

            {/* Selected items preview */}
            {selectedItems.length > 0 && (
              <div style={{ marginBottom: 24, padding: 16, borderRadius: 14, background: "rgba(197,160,89,0.06)", border: "1px solid rgba(197,160,89,0.2)" }}>
                <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9C9584", marginBottom: 12 }}>
                  Package Contents
                </p>
                {selectedItems.map(i => (
                  <div key={i.service_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#C5A059" }} />
                      <span style={{ fontFamily: "Georgia, serif", fontSize: 13, color: "var(--foreground)" }}>
                        {i.service_name}
                      </span>
                      <span style={{ fontSize: 11, color: "#C5A059", background: "rgba(197,160,89,0.1)", padding: "1px 8px", borderRadius: 999, fontWeight: 600 }}>
                        ×{i.sessions}
                      </span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{fmt(i.price)}</span>
                  </div>
                ))}
                <div style={{ borderTop: "1px solid rgba(197,160,89,0.2)", marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#9C9584" }}>Total (à la carte)</span>
                  <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "Georgia, serif", color: "#C5A059" }}>{fmt(autoMrp)}</span>
                </div>
              </div>
            )}

            <div className="space-y-5">
              <FormField label="Package Name" required>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Wedding Glow Package" style={drawerInput} />
              </FormField>

              <FormField label="Description">
                <textarea
                  value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="What's included in this package…"
                  rows={2} style={{ ...drawerInput, resize: "vertical" }}
                />
              </FormField>

              <div className="flex gap-4">
                <FormField label="MRP (₹)" style={{ flex: 1 }}>
                  <input
                    type="number" value={mrp}
                    onChange={e => setMrp(e.target.value)}
                    placeholder={String(autoMrp || 0)}
                    style={drawerInput}
                  />
                </FormField>
                <FormField label="Package Price (₹)" required style={{ flex: 1 }}>
                  <input
                    type="number" value={totalPrice}
                    onChange={e => setTotalPrice(e.target.value)}
                    placeholder="0"
                    style={drawerInput}
                  />
                </FormField>
              </div>

              {totalPrice && autoMrp && Number(totalPrice) < autoMrp && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, background: "rgba(74,138,74,0.08)", border: "1px solid rgba(74,138,74,0.2)" }}>
                  <Percent size={13} style={{ color: "#4A8A4A" }} />
                  <span style={{ fontSize: 13, color: "#4A8A4A", fontWeight: 600 }}>
                    Customer saves {fmt(autoMrp - Number(totalPrice))} ·{" "}
                    {Math.round(((autoMrp - Number(totalPrice)) / autoMrp) * 100)}% off à la carte
                  </span>
                </div>
              )}

              {/* ── Validity & Sell Window (admin only) ── */}
              {isAdmin && (
                <div style={{ padding: 16, borderRadius: 12, background: "rgba(197,160,89,0.04)", border: "1px solid rgba(197,160,89,0.18)" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9C9584", marginBottom: 14 }}>
                    Validity & Sell Window
                  </p>

                  <FormField label="Package Validity (days)" style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      {[90, 180, 365, 730].map(d => (
                        <button
                          key={d}
                          onClick={() => setValidDays(String(d))}
                          style={{
                            padding: "5px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12,
                            fontFamily: "Georgia, serif", border: "1px solid",
                            borderColor: validDays === String(d) ? "#C5A059" : "var(--border)",
                            background: validDays === String(d) ? "rgba(197,160,89,0.12)" : "var(--surface)",
                            color: validDays === String(d) ? "#A8853A" : "var(--text-muted)",
                            fontWeight: validDays === String(d) ? 600 : 400,
                          }}
                        >
                          {d === 365 ? "1 yr" : d === 730 ? "2 yr" : `${d}d`}
                        </button>
                      ))}
                      <input
                        type="number" value={validDays} min={1}
                        onChange={e => setValidDays(e.target.value)}
                        style={{ ...drawerInput, width: 80 }}
                        placeholder="365"
                      />
                    </div>
                    <p style={{ fontSize: 11, color: "#9C9584", marginTop: 5 }}>
                      From the date of purchase
                    </p>
                  </FormField>

                  <div style={{ display: "flex", gap: 14 }}>
                    <FormField label="Sell From (optional)" style={{ flex: 1 }}>
                      <input
                        type="date" value={sellFrom}
                        onChange={e => setSellFrom(e.target.value)}
                        style={drawerInput}
                      />
                    </FormField>
                    <FormField label="Sell Until (optional)" style={{ flex: 1 }}>
                      <input
                        type="date" value={sellUntil}
                        onChange={e => setSellUntil(e.target.value)}
                        style={drawerInput}
                      />
                    </FormField>
                  </div>
                  <p style={{ fontSize: 11, color: "#9C9584", marginTop: 6 }}>
                    <Calendar size={10} style={{ display: "inline", marginRight: 4 }} />
                    Leave blank to always show. Set a window to restrict when this package can be sold.
                  </p>
                </div>
              )}

              <div className="flex gap-6">
                <ToggleField label="Fixed Package" sub="Sessions count is locked" checked={isFixed} onChange={setIsFixed} />
                {isSuperAdmin && (
                  <ToggleField label="Global Template" sub="Available across all clinics" checked={isGlobal} onChange={setIsGlobal} />
                )}
              </div>
            </div>
          </div>

          <div style={{ padding: "16px 28px", borderTop: "1px solid var(--border)", display: "flex", gap: 12 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: "11px 0", borderRadius: 12,
                border: "1px solid var(--border)", background: "var(--surface)",
                color: "var(--foreground)", fontSize: 14, fontFamily: "Georgia, serif", cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || selectedItems.length === 0}
              style={{
                flex: 2, padding: "11px 0", borderRadius: 12, border: "none",
                background: selectedItems.length === 0
                  ? "rgba(197,160,89,0.4)"
                  : "linear-gradient(135deg, #C5A059, #A8853A)",
                color: "white", fontSize: 14, fontWeight: 600,
                fontFamily: "Georgia, serif",
                cursor: selectedItems.length === 0 ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                boxShadow: selectedItems.length > 0 ? "0 4px 14px rgba(197,160,89,0.3)" : "none",
              }}
            >
              {saving && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
              {editData ? "Update Package" : "Create Package"}
            </button>
          </div>
        </div>
      </div>
    </DrawerOverlay>
  );
}

// ── Export Button ──────────────────────────────────────────────────────────────

// ── GAP-22: Consumables Section ───────────────────────────────────────────────

interface ServiceConsumableRow {
  id: string;
  inventory_product_id: string;
  quantity_per_session: number;
  unit: string;
  inventory_products?: { name: string } | null;
}

function ConsumablesSection({ serviceId, clinicId }: { serviceId: string; clinicId: string }) {
  const [consumables, setConsumables] = useState<ServiceConsumableRow[]>([]);
  const [products, setProducts]       = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading]         = useState(true);
  const [addProdId, setAddProdId]     = useState("");
  const [addQty, setAddQty]           = useState("1");
  const [addUnit, setAddUnit]         = useState("unit");
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("service_consumables")
        .select("*, inventory_products(name)")
        .eq("service_id", serviceId)
        .eq("clinic_id", clinicId),
      supabase.from("inventory_products")
        .select("id, name")
        .eq("clinic_id", clinicId)
        .eq("product_type", "consumable")
        .eq("is_active", true)
        .order("name"),
    ]).then(([{ data: c }, { data: p }]) => {
      setConsumables((c ?? []) as ServiceConsumableRow[]);
      setProducts(p ?? []);
      setLoading(false);
    });
  }, [serviceId, clinicId]);

  async function handleAdd() {
    if (!addProdId) { toast.error("Select a product"); return; }
    setSaving(true);
    const { data, error } = await supabase.from("service_consumables").insert({
      clinic_id: clinicId, service_id: serviceId,
      inventory_product_id: addProdId,
      quantity_per_session: parseFloat(addQty) || 1,
      unit: addUnit.trim() || "unit",
    }).select("*, inventory_products(name)").single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setConsumables(c => [...c, data as ServiceConsumableRow]);
    setAddProdId(""); setAddQty("1");
    toast.success("Consumable linked");
  }

  async function handleRemove(id: string) {
    await supabase.from("service_consumables").delete().eq("id", id);
    setConsumables(c => c.filter(x => x.id !== id));
    toast.success("Consumable removed");
  }

  return (
    <div style={{ borderTop: "1px solid rgba(197,160,89,0.15)", paddingTop: 16, marginTop: 8 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#9C9584", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>Consumables per Session</p>
      {loading ? (
        <p style={{ fontSize: 12, color: "#9C9584" }}>Loading…</p>
      ) : (
        <>
          {consumables.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
              {consumables.map(c => {
                const name = (c.inventory_products as { name: string } | null)?.name ?? c.inventory_product_id;
                return (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderRadius: 8, background: "rgba(197,160,89,0.05)", border: "1px solid rgba(197,160,89,0.15)" }}>
                    <span style={{ fontSize: 12, color: "#1a1714" }}>{name} — {c.quantity_per_session} {c.unit}/session</span>
                    <button onClick={() => handleRemove(c.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                      <X size={12} color="#9C9584" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {products.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <select value={addProdId} onChange={e => setAddProdId(e.target.value)}
                style={{ flex: 2, minWidth: 120, padding: "6px 8px", borderRadius: 7, border: "1px solid rgba(197,160,89,0.25)", fontSize: 12, outline: "none" }}>
                <option value="">Select product…</option>
                {products.filter(p => !consumables.find(c => c.inventory_product_id === p.id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="number" value={addQty} onChange={e => setAddQty(e.target.value)} placeholder="Qty" min="0.001" step="0.1"
                style={{ width: 55, padding: "6px 8px", borderRadius: 7, border: "1px solid rgba(197,160,89,0.25)", fontSize: 12, outline: "none" }} />
              <input type="text" value={addUnit} onChange={e => setAddUnit(e.target.value)} placeholder="unit"
                style={{ width: 60, padding: "6px 8px", borderRadius: 7, border: "1px solid rgba(197,160,89,0.25)", fontSize: 12, outline: "none" }} />
              <button onClick={handleAdd} disabled={saving}
                style={{ padding: "6px 12px", borderRadius: 7, background: "rgba(197,160,89,0.1)", border: "1px solid rgba(197,160,89,0.3)", color: "var(--gold)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {saving ? "…" : "+ Link"}
              </button>
            </div>
          )}
          {products.length === 0 && <p style={{ fontSize: 11, color: "#9C9584" }}>No consumable-type products in inventory</p>}
        </>
      )}
    </div>
  );
}

function ExportButton({ services, packages }: { services: Service[]; packages: ServicePackage[] }) {
  function exportCsv() {
    const rows: (string | number | boolean)[][] = [
      ["Type","Name","Category","Duration(min)","MRP","Selling Price","Discount%","Premium","Global Template","Description","Package Items","Valid Days","Sell From","Sell Until","Fixed"],
      ...services.map(s => [
        "Service", s.name, s.category, s.duration_minutes, s.mrp, s.selling_price,
        s.discount_pct, s.is_premium ? "Yes" : "No", s.is_global_template ? "Yes" : "No",
        s.description ?? "", "", "", "", "", "",
      ]),
      ...packages.map(p => [
        "Package", p.name, "", "", p.mrp, p.total_price, p.discount_pct, "", p.is_global_template ? "Yes" : "No",
        p.description ?? "",
        // Package Items: "Service Name×3, Another×2"
        p.items.map(i => `${i.service_name}×${i.sessions}`).join("; "),
        p.valid_days, p.sell_from ?? "", p.sell_until ?? "",
        p.is_fixed ? "Yes" : "No",
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aesthetica-services-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${services.length} services + ${packages.length} packages`);
  }

  return (
    <button
      onClick={exportCsv}
      style={{
        display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
        borderRadius: 10, border: "1px solid var(--border)",
        background: "var(--surface)", color: "var(--foreground)",
        fontSize: 13, fontFamily: "Georgia, serif", cursor: "pointer",
      }}
    >
      <Download size={14} /> Export
    </button>
  );
}

// ── Import Modal ──────────────────────────────────────────────────────────────

function ImportModal({ onClose, onImported, clinicId }: {
  onClose: () => void;
  onImported: () => void;
  clinicId: string | null;
}) {
  const [file,     setFile]     = useState<File | null>(null);
  const [preview,  setPreview]  = useState<string[][]>([]);
  const [loading,  setLoading]  = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function parseFile(f: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = text.trim().split("\n").map(row =>
        row.split(",").map(c => c.replace(/^"|"$/g, "").trim())
      );
      setPreview(rows.slice(0, 6));
    };
    reader.readAsText(f);
  }

  function handleFile(f: File | null) {
    setFile(f);
    if (f) parseFile(f);
  }

  async function doImport() {
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      // Proper CSV parse: handle quoted fields with commas inside
      function parseRow(row: string): string[] {
        const cells: string[] = [];
        let cur = "", inQ = false;
        for (let i = 0; i < row.length; i++) {
          const ch = row[i];
          if (ch === '"') {
            if (inQ && row[i+1] === '"') { cur += '"'; i++; }
            else inQ = !inQ;
          } else if (ch === ',' && !inQ) {
            cells.push(cur.trim()); cur = "";
          } else {
            cur += ch;
          }
        }
        cells.push(cur.trim());
        return cells;
      }

      const rows = text.trim().split("\n").map(parseRow);
      const header = rows[0];
      const data   = rows.slice(1).filter(r => r.length > 1);

      const idx = (n: string) => header.indexOf(n);
      const svcs: object[] = [];
      const pkgRows: typeof data = [];

      for (const row of data) {
        const type = row[idx("Type")];
        if (type === "Service") {
          svcs.push({
            clinic_id: clinicId,
            name:             row[idx("Name")],
            category:         row[idx("Category")] || "General",
            duration_minutes: Number(row[idx("Duration(min)")]) || 60,
            mrp:              Number(row[idx("MRP")]) || 0,
            selling_price:    Number(row[idx("Selling Price")]) || 0,
            discount_pct:     Number(row[idx("Discount%")]) || 0,
            is_premium:       row[idx("Premium")] === "Yes",
            is_global_template: false,
            description:      row[idx("Description")] || null,
          });
        } else if (type === "Package") {
          pkgRows.push(row);
        }
      }

      // Insert services
      if (svcs.length > 0) {
        const { error } = await supabase.from("services").insert(svcs);
        if (error) { toast.error("Service import failed: " + error.message); setLoading(false); return; }
      }

      // Fetch current clinic services for name → id mapping
      const { data: clinicSvcs } = await supabase
        .from("services")
        .select("id, name")
        .eq("clinic_id", clinicId ?? "");
      const nameToId: Record<string, string> = {};
      (clinicSvcs ?? []).forEach(cs => { nameToId[cs.name] = cs.id; });

      // Insert packages
      let pkgCount = 0;
      for (const row of pkgRows) {
        const pName = row[idx("Name")];
        if (!pName) continue;

        const { data: newPkg, error: pkgErr } = await supabase
          .from("service_packages")
          .insert({
            clinic_id: clinicId,
            name: pName,
            description: row[idx("Description")] || null,
            total_price: Number(row[idx("Selling Price")]) || 0,
            mrp: Number(row[idx("MRP")]) || 0,
            discount_pct: Number(row[idx("Discount%")]) || 0,
            is_fixed: row[idx("Fixed")] === "Yes",
            is_global_template: false,
            valid_days: Number(row[idx("Valid Days")]) || 365,
            sell_from: row[idx("Sell From")] || null,
            sell_until: row[idx("Sell Until")] || null,
          })
          .select("id")
          .single();

        if (pkgErr || !newPkg) continue;

        // Parse "Package Items" column: "Service×3; OtherService×2"
        const itemsStr = row[idx("Package Items")] || "";
        const itemParts = itemsStr.split(";").map(s => s.trim()).filter(Boolean);
        const itemInserts = itemParts.flatMap(part => {
          const match = part.match(/^(.+?)×(\d+)$/);
          if (!match) return [];
          const svcName = match[1].trim();
          const sessions = Number(match[2]);
          const svcId = nameToId[svcName];
          if (!svcId || sessions < 1) return [];
          return [{ package_id: newPkg.id, service_id: svcId, sessions }];
        });
        if (itemInserts.length) {
          await supabase.from("package_items").insert(itemInserts);
        }
        pkgCount++;
      }

      toast.success(`Imported ${svcs.length} services + ${pkgCount} packages`);
      onImported();
    };
    reader.readAsText(file);
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(28,25,23,0.55)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "white", borderRadius: 20, width: "100%", maxWidth: 520,
        border: "1px solid rgba(197,160,89,0.25)",
        boxShadow: "0 20px 60px rgba(28,25,23,0.2)",
        overflow: "hidden",
      }}>
        <div style={{ padding: "24px 24px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
            Import Services
          </h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 24 }}>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            Upload a CSV exported from this page. Supports both <strong>Service</strong> and <strong>Package</strong> rows.
            Package items use the <strong>Package Items</strong> column in format <code>Service Name×3; Other Service×2</code>.
          </p>

          <input
            ref={fileRef} type="file" accept=".csv"
            style={{ display: "none" }}
            onChange={e => handleFile(e.target.files?.[0] ?? null)}
          />

          <button
            onClick={() => fileRef.current?.click()}
            style={{
              width: "100%", padding: "32px 0", borderRadius: 14,
              border: "2px dashed rgba(197,160,89,0.4)",
              background: "rgba(197,160,89,0.04)",
              cursor: "pointer", display: "flex", flexDirection: "column",
              alignItems: "center", gap: 10,
            }}
          >
            <Upload size={24} style={{ color: "#C5A059" }} />
            <span style={{ fontFamily: "Georgia, serif", fontSize: 14, color: "#C5A059" }}>
              {file ? file.name : "Click to upload CSV"}
            </span>
          </button>

          {preview.length > 1 && (
            <div style={{ marginTop: 16, overflowX: "auto" }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9C9584", marginBottom: 8 }}>
                Preview ({preview.length - 1} rows)
              </p>
              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                <thead>
                  <tr>{preview[0].map((h, i) => <th key={i} style={{ textAlign: "left", padding: "4px 8px", color: "#9C9584", borderBottom: "1px solid var(--border)" }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.slice(1).map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => <td key={ci} style={{ padding: "4px 8px", color: "var(--foreground)", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", gap: 12 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 10,
              border: "1px solid var(--border)", background: "var(--surface)",
              color: "var(--foreground)", fontSize: 14, fontFamily: "Georgia, serif", cursor: "pointer",
            }}
          >Cancel</button>
          <button
            onClick={doImport}
            disabled={!file || loading}
            style={{
              flex: 2, padding: "10px 0", borderRadius: 10, border: "none",
              background: !file ? "rgba(197,160,89,0.4)" : "linear-gradient(135deg, #C5A059, #A8853A)",
              color: "white", fontSize: 14, fontWeight: 600,
              fontFamily: "Georgia, serif",
              cursor: !file ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            }}
          >
            {loading && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
            Import Services
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Discount Approval Matrix Section ─────────────────────────────────────────

const ROLES = ["superadmin","chain_admin","clinic_admin","doctor","therapist","counsellor","front_desk"] as const;
const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin", chain_admin: "Chain Admin", clinic_admin: "Clinic Admin",
  doctor: "Doctor", therapist: "Therapist", counsellor: "Counsellor", front_desk: "Front Desk",
};

function DiscountMatrixSection({ matrix, loading, isSuperAdmin, activeClinicId, onRefresh }: {
  matrix: DiscountMatrix[];
  loading: boolean;
  isSuperAdmin: boolean;
  activeClinicId: string | null;
  onRefresh: () => void;
}) {
  // Local editable state keyed by matrix row id
  const [edits, setEdits] = useState<Record<string, Partial<DiscountMatrix>>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // Global rows (chain_id null AND clinic_id null)
  const globalRows = matrix.filter(r => !r.chain_id && !r.clinic_id);
  // Clinic-specific overrides for activeClinicId
  const clinicRows = matrix.filter(r => r.clinic_id === activeClinicId);

  function edit(id: string, key: keyof DiscountMatrix, value: unknown) {
    setEdits(prev => ({ ...prev, [id]: { ...(prev[id] ?? {}), [key]: value } }));
  }

  function getVal<K extends keyof DiscountMatrix>(row: DiscountMatrix, key: K): DiscountMatrix[K] {
    return (edits[row.id]?.[key] ?? row[key]) as DiscountMatrix[K];
  }

  async function saveRow(row: DiscountMatrix) {
    const patch = edits[row.id];
    if (!patch || Object.keys(patch).length === 0) return;
    setSaving(prev => ({ ...prev, [row.id]: true }));
    const { error } = await supabase
      .from("discount_approval_matrix")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) {
      toast.error("Failed to save: " + error.message);
    } else {
      toast.success(`Updated discount rule for ${ROLE_LABELS[row.role] ?? row.role}`);
      setEdits(prev => { const c = { ...prev }; delete c[row.id]; return c; });
      onRefresh();
    }
    setSaving(prev => ({ ...prev, [row.id]: false }));
  }

  async function addClinicOverride(role: string) {
    if (!activeClinicId) { toast.error("No active clinic selected"); return; }
    const { error } = await supabase.from("discount_approval_matrix").insert({
      clinic_id: activeClinicId,
      chain_id: null,
      role,
      max_discount_pct: 0,
      requires_otp: true,
      otp_approver_role: "clinic_admin",
    });
    if (error) {
      if (error.code === "23505") { toast.error("Override already exists for this role"); }
      else { toast.error("Failed to add override"); }
    } else {
      toast.success("Clinic override added");
      onRefresh();
    }
  }

  async function deleteRow(id: string) {
    if (!confirm("Remove this override row?")) return;
    await supabase.from("discount_approval_matrix").delete().eq("id", id);
    toast.success("Override removed");
    onRefresh();
  }

  function MatrixTable({ rows, title, canDelete }: { rows: DiscountMatrix[]; title: string; canDelete: boolean }) {
    return (
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 600, color: "var(--foreground)", marginBottom: 14 }}>
          {title}
        </h3>
        {rows.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "16px 0" }}>No rows configured.</p>
        ) : (
          <div style={{ border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            {/* Header */}
            <div style={{
              display: "grid", gridTemplateColumns: "1.8fr 1.4fr 1.4fr 1.4fr 0.6fr",
              padding: "10px 18px", background: "rgba(197,160,89,0.06)",
              borderBottom: "1px solid var(--border)",
            }}>
              {["Role","Max Discount %","Requires OTP","OTP Approver",""].map(h => (
                <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9C9584" }}>{h}</span>
              ))}
            </div>
            {rows.map((row, idx) => {
              const isDirty = !!edits[row.id] && Object.keys(edits[row.id]!).length > 0;
              return (
                <div
                  key={row.id}
                  style={{
                    display: "grid", gridTemplateColumns: "1.8fr 1.4fr 1.4fr 1.4fr 0.6fr",
                    padding: "12px 18px", alignItems: "center",
                    borderBottom: idx < rows.length - 1 ? "1px solid var(--border)" : "none",
                    background: isDirty ? "rgba(197,160,89,0.04)" : "white",
                    transition: "background 0.15s",
                  }}
                >
                  {/* Role */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#C5A059", flexShrink: 0 }} />
                    <span style={{ fontFamily: "Georgia, serif", fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                      {ROLE_LABELS[row.role] ?? row.role}
                    </span>
                  </div>

                  {/* Max Discount % */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="number" min={0} max={100}
                      value={String(getVal(row, "max_discount_pct"))}
                      onChange={e => edit(row.id, "max_discount_pct", Number(e.target.value))}
                      disabled={!isSuperAdmin && row.role === "superadmin"}
                      style={{
                        width: 64, padding: "5px 10px", borderRadius: 8,
                        border: "1px solid", borderColor: isDirty ? "#C5A059" : "var(--border)",
                        fontSize: 13, fontFamily: "Georgia, serif",
                        color: "var(--foreground)", background: "#FDFCF9", outline: "none",
                      }}
                    />
                    <span style={{ fontSize: 12, color: "#9C9584" }}>%</span>
                  </div>

                  {/* Requires OTP toggle */}
                  <div>
                    <button
                      onClick={() => edit(row.id, "requires_otp", !getVal(row, "requires_otp"))}
                      disabled={!isSuperAdmin && row.role === "superadmin"}
                      style={{
                        padding: "4px 12px", borderRadius: 999, border: "1px solid", cursor: "pointer",
                        fontSize: 12, fontFamily: "Georgia, serif",
                        borderColor: getVal(row, "requires_otp") ? "#C5A059" : "var(--border)",
                        background: getVal(row, "requires_otp") ? "rgba(197,160,89,0.12)" : "var(--surface)",
                        color: getVal(row, "requires_otp") ? "#A8853A" : "var(--text-muted)",
                        fontWeight: getVal(row, "requires_otp") ? 600 : 400,
                      }}
                    >
                      {getVal(row, "requires_otp") ? "Yes — OTP" : "No OTP"}
                    </button>
                  </div>

                  {/* OTP Approver Role */}
                  <div>
                    <select
                      value={getVal(row, "otp_approver_role") ?? "clinic_admin"}
                      onChange={e => edit(row.id, "otp_approver_role", e.target.value)}
                      disabled={!getVal(row, "requires_otp")}
                      style={{
                        padding: "5px 8px", borderRadius: 8, fontSize: 12,
                        fontFamily: "Georgia, serif", color: "var(--foreground)",
                        border: "1px solid var(--border)", background: "#FDFCF9", outline: "none",
                        opacity: getVal(row, "requires_otp") ? 1 : 0.4,
                      }}
                    >
                      {ROLES.filter(r => r !== "front_desk" && r !== "therapist" && r !== "counsellor").map(r => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                    {isDirty && (
                      <button
                        onClick={() => saveRow(row)}
                        disabled={saving[row.id]}
                        style={{
                          background: "linear-gradient(135deg, #C5A059, #A8853A)",
                          border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer",
                          color: "white", fontSize: 12, display: "flex", alignItems: "center", gap: 4,
                        }}
                      >
                        {saving[row.id] ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={11} />}
                        Save
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => deleteRow(row.id)}
                        style={{ background: "rgba(180,60,60,0.06)", border: "none", borderRadius: 8, padding: "5px 7px", cursor: "pointer", color: "#B43C3C" }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} style={{ color: "rgba(197,160,89,0.5)", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  // Roles not yet having a clinic override
  const existingClinicRoles = new Set(clinicRows.map(r => r.role));
  const missingRoles = ROLES.filter(r => !existingClinicRoles.has(r));

  return (
    <div>
      {/* Info banner */}
      <div style={{
        padding: "14px 20px", borderRadius: 12, marginBottom: 28,
        background: "rgba(197,160,89,0.06)", border: "1px solid rgba(197,160,89,0.25)",
        display: "flex", alignItems: "flex-start", gap: 12,
      }}>
        <ShieldCheck size={18} style={{ color: "#C5A059", flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, fontFamily: "Georgia, serif", color: "var(--foreground)", margin: "0 0 4px" }}>
            Discount Approval Matrix
          </p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
            Define the maximum discount each role can apply without OTP. Any discount beyond the threshold triggers an OTP request from the designated approver.
            Clinic-level overrides take precedence over global defaults.
          </p>
        </div>
      </div>

      <MatrixTable rows={globalRows} title="Global Defaults (all clinics)" canDelete={false} />

      {activeClinicId && (
        <>
          <MatrixTable rows={clinicRows} title={`Clinic-Level Overrides (this clinic)`} canDelete={true} />

          {/* Add override buttons */}
          {missingRoles.length > 0 && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10 }}>
                Add clinic override for:
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {missingRoles.map(role => (
                  <button
                    key={role}
                    onClick={() => addClinicOverride(role)}
                    style={{
                      padding: "5px 13px", borderRadius: 999, fontSize: 12,
                      fontFamily: "Georgia, serif", cursor: "pointer",
                      border: "1px solid rgba(197,160,89,0.35)",
                      background: "rgba(197,160,89,0.05)",
                      color: "#A8853A",
                      display: "flex", alignItems: "center", gap: 5,
                    }}
                  >
                    <Plus size={11} /> {ROLE_LABELS[role]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Shared UI Helpers ─────────────────────────────────────────────────────────

function DrawerOverlay({ children, onClose, wide }: {
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(28,25,23,0.45)", backdropFilter: "blur(8px)",
        display: "flex", justifyContent: "flex-end",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: wide ? "min(900px, 96vw)" : "min(520px, 96vw)",
          height: "100%", background: "white",
          boxShadow: "-12px 0 60px rgba(28,25,23,0.18)",
          display: "flex", flexDirection: "column",
          borderLeft: "1px solid rgba(197,160,89,0.2)",
          overflowY: "auto",
        }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function FormField({ label, required, children, style }: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <label style={{
        display: "block", fontSize: 11, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "0.1em",
        color: "#9C9584", marginBottom: 7,
      }}>
        {label}{required && <span style={{ color: "#C5A059", marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function ToggleField({ label, sub, checked, onChange }: {
  label: string;
  sub: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 40, height: 22, borderRadius: 999, border: "none", cursor: "pointer",
          background: checked ? "#C5A059" : "#E0D9D0",
          position: "relative", flexShrink: 0, transition: "background 0.2s",
        }}
      >
        <span style={{
          position: "absolute", top: 2, left: checked ? 20 : 2,
          width: 18, height: 18, borderRadius: "50%",
          background: "white", transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </button>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", margin: 0, fontFamily: "Georgia, serif" }}>{label}</p>
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>{sub}</p>
      </div>
    </div>
  );
}

function EmptyState({ icon, text, sub }: { icon: React.ReactNode; text: string; sub: string }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 0" }}>
      <div style={{ color: "rgba(197,160,89,0.35)", marginBottom: 16, display: "flex", justifyContent: "center" }}>{icon}</div>
      <p style={{ fontFamily: "Georgia, serif", fontSize: 16, color: "var(--foreground)", marginBottom: 6 }}>{text}</p>
      <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{sub}</p>
    </div>
  );
}

const drawerInput: React.CSSProperties = {
  width: "100%",
  padding: "10px 13px",
  borderRadius: 10,
  border: "1px solid #E8E2D4",
  background: "#FDFCF9",
  fontSize: 14,
  fontFamily: "Georgia, serif",
  color: "var(--foreground)",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.2s",
};

// ═══════════════════════════════════════════════════════════════════════════════
// E1 — Service Consumables Tab
// ═══════════════════════════════════════════════════════════════════════════════

interface SvcConsumable {
  id: string;
  service_id: string;
  inventory_product_id: string;
  quantity_used: number;
  unit: string | null;
  notes: string | null;
  product_name?: string;
}

interface InventoryProduct { id: string; name: string; unit_of_measure: string | null; }

function ServiceConsumablesTab({ services, clinicId }: { services: Service[]; clinicId: string | null }) {
  const [selectedSvc, setSelectedSvc] = useState<string>(services[0]?.id ?? "");
  const [consumables, setConsumables] = useState<SvcConsumable[]>([]);
  const [products,    setProducts]    = useState<InventoryProduct[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [newProdId,   setNewProdId]   = useState("");
  const [newQty,      setNewQty]      = useState("1");

  useEffect(() => {
    if (!clinicId) return;
    supabase.from("inventory_products").select("id, name, unit_of_measure")
      .eq("clinic_id", clinicId).order("name")
      .then(({ data }) => setProducts((data ?? []) as InventoryProduct[]));
  }, [clinicId]);

  useEffect(() => {
    if (!selectedSvc) return;
    setLoading(true);
    supabase.from("service_consumables")
      .select("id, service_id, inventory_product_id, quantity_used, unit, notes")
      .eq("service_id", selectedSvc)
      .then(async ({ data }) => {
        const rows = (data ?? []) as SvcConsumable[];
        // Enrich with product names
        const enriched = rows.map(r => ({
          ...r,
          product_name: products.find(p => p.id === r.inventory_product_id)?.name ?? "—",
        }));
        setConsumables(enriched);
        setLoading(false);
      });
  }, [selectedSvc, products]);

  async function addConsumable() {
    if (!newProdId || !selectedSvc || !clinicId) return;
    setSaving(true);
    const prod = products.find(p => p.id === newProdId);
    const { data, error } = await supabase.from("service_consumables").insert({
      service_id: selectedSvc,
      inventory_product_id: newProdId,
      quantity_used: parseFloat(newQty) || 1,
      unit: prod?.unit_of_measure ?? null,
      clinic_id: clinicId,
    }).select().single();
    if (error) { toast.error(error.message); }
    else {
      setConsumables(prev => [...prev, { ...(data as SvcConsumable), product_name: prod?.name }]);
      setNewProdId(""); setNewQty("1");
    }
    setSaving(false);
  }

  async function removeConsumable(id: string) {
    await supabase.from("service_consumables").delete().eq("id", id);
    setConsumables(prev => prev.filter(c => c.id !== id));
  }

  const selectedService = services.find(s => s.id === selectedSvc);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 20 }}>
      {/* Service picker */}
      <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: 14, maxHeight: 520, overflowY: "auto" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: "var(--text-muted)", marginBottom: 10 }}>Select Service</p>
        {services.filter(s => s.is_active !== false).map(s => (
          <button key={s.id} onClick={() => setSelectedSvc(s.id)}
            style={{ width: "100%", textAlign: "left" as const, padding: "8px 10px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, fontWeight: selectedSvc === s.id ? 700 : 500, background: selectedSvc === s.id ? "rgba(197,160,89,0.12)" : "transparent", color: selectedSvc === s.id ? "#8B6914" : "var(--foreground)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {s.name}
          </button>
        ))}
      </div>

      {/* Consumables panel */}
      <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", fontFamily: "Georgia, serif", margin: "0 0 2px" }}>
            {selectedService?.name ?? "—"} — Consumables
          </p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
            Products consumed per session. Used for automatic inventory deduction.
          </p>
        </div>

        {/* Add row */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", padding: "12px 14px", background: "rgba(197,160,89,0.04)", borderRadius: 10, border: "1px solid rgba(197,160,89,0.15)" }}>
          <select value={newProdId} onChange={e => setNewProdId(e.target.value)}
            style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, outline: "none", background: "var(--surface)" }}>
            <option value="">Select product…</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type="number" min="0.01" step="0.01" value={newQty} onChange={e => setNewQty(e.target.value)}
            placeholder="Qty"
            style={{ width: 80, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, outline: "none", background: "var(--surface)", textAlign: "center" as const }} />
          <button onClick={addConsumable} disabled={!newProdId || saving}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, border: "none", background: "#C5A059", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: !newProdId ? 0.5 : 1, flexShrink: 0 }}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add
          </button>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1,2,3].map(i => <div key={i} style={{ height: 42, borderRadius: 9, background: "rgba(197,160,89,0.06)", animation: "pulse 1.4s infinite" }} />)}
          </div>
        ) : consumables.length === 0 ? (
          <div style={{ textAlign: "center", padding: "36px 20px", background: "rgba(197,160,89,0.03)", borderRadius: 10, border: "1px dashed rgba(197,160,89,0.2)" }}>
            <Package size={24} style={{ color: "rgba(197,160,89,0.3)", margin: "0 auto 8px" }} />
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>No consumables mapped yet</p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-muted)", opacity: 0.7 }}>Add products above to auto-deduct inventory on session completion</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {consumables.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(249,247,242,0.5)", border: "1px solid var(--border)" }}>
                <Package size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, color: "var(--foreground)", fontWeight: 500 }}>{c.product_name}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)" }}>{c.quantity_used}</span>
                {c.unit && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.unit}</span>}
                <button onClick={() => removeConsumable(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", padding: 2 }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
