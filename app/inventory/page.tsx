"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Package, Plus, Search, Download, RefreshCw, X, Check, Loader2,
  Edit2, Trash2, Building2, Phone, Mail, Truck, ShoppingCart,
  AlertTriangle, Calendar, Hash, FlaskConical, Wrench, RotateCcw,
  TrendingDown, TrendingUp, IndianRupee, Layers, ChevronRight,
  ArrowDownToLine, Tag, Filter, Eye, BarChart2, Sparkles,
  Upload, FileText, AlertCircle, CheckCircle2, ArrowLeftRight, Send,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import { toast } from "sonner";
import { logAction } from "@/lib/audit";
import CustomFieldsSection from "@/components/CustomFieldsSection";

// ── Types ─────────────────────────────────────────────────────────────────────

type ProductType   = "retail" | "consumable" | "equipment";
type MovementType  = "receive" | "sale" | "consume" | "adjust_up" | "adjust_down" | "write_off" | "return";
type DrawerKind    = "product" | "supplier" | "receive" | "sale" | "consume" | "adjust" | "import" | null;

interface Product {
  id: string; clinic_id: string; supplier_id: string | null;
  name: string; brand: string | null; sku: string | null;
  product_type: ProductType; category: string | null;
  hsn_code: string | null; gst_rate: number;
  mrp: number | null; selling_price: number | null; purchase_price: number | null;
  unit_of_measure: string; units_per_pack: number;
  low_stock_threshold: number; reorder_quantity: number;
  storage_condition: string | null; is_prescription: boolean;
  is_active: boolean; notes: string | null; created_at: string;
  // joined / computed
  supplier_name?: string | null;
  current_stock:  number;
  nearest_expiry: string | null;
  exp30_qty:      number;
  stock_value:    number;
}

interface Supplier {
  id: string; clinic_id: string; name: string;
  contact_person: string | null; phone: string | null; email: string | null;
  gstin: string | null; pan: string | null; address: string | null;
  payment_terms: string | null; is_active: boolean; notes: string | null;
  created_at: string;
}

interface Batch {
  id: string; product_id: string; batch_number: string;
  expiry_date: string | null; purchase_price: number;
  quantity_received: number; quantity_remaining: number;
  received_at: string; supplier_id: string | null;
}

interface Movement {
  id: string; product_id: string; batch_id: string | null;
  movement_type: MovementType; quantity: number;
  unit_cost: number | null; selling_price: number | null; gst_amount: number | null;
  patient_id: string | null; appointment_id: string | null;
  reason: string | null; performed_by_name: string | null;
  notes: string | null; created_at: string;
  // joined
  product_name?: string; unit?: string;
  batch_number?: string | null; patient_name?: string | null;
}

interface PatientOpt { id: string; full_name: string; phone: string | null; }
interface Stats { total: number; lowStock: number; expiring30: number; stockValue: number; }

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_CFG: Record<ProductType, { label: string; color: string; bg: string; border: string; Icon: React.ElementType }> = {
  retail:     { label: "Retail",     color: "#C5A059", bg: "rgba(197,160,89,0.1)", border: "rgba(197,160,89,0.25)", Icon: ShoppingCart },
  consumable: { label: "Consumable", color: "#2A4A8A", bg: "rgba(42,74,138,0.08)", border: "rgba(42,74,138,0.2)",   Icon: FlaskConical },
  equipment:  { label: "Equipment",  color: "#4A8A4A", bg: "rgba(74,138,74,0.08)", border: "rgba(74,138,74,0.2)",   Icon: Wrench       },
};

const MOV_CFG: Record<MovementType, { label: string; color: string; bg: string; Icon: React.ElementType; dir: "in" | "out" }> = {
  receive:     { label: "Received",   color: "#4A8A4A", bg: "#EFF6EF", Icon: ArrowDownToLine, dir: "in"  },
  sale:        { label: "Sale",       color: "#C5A059", bg: "#FFF8E8", Icon: ShoppingCart,    dir: "out" },
  consume:     { label: "Consumed",   color: "#7C3AED", bg: "#F5F3FF", Icon: FlaskConical,    dir: "out" },
  adjust_up:   { label: "Adj. +",    color: "#059669", bg: "#ECFDF5", Icon: TrendingUp,       dir: "in"  },
  adjust_down: { label: "Adj. −",    color: "#D97706", bg: "#FFFBEB", Icon: TrendingDown,     dir: "out" },
  write_off:   { label: "Write-off", color: "#DC2626", bg: "#FEF2F2", Icon: Trash2,           dir: "out" },
  return:      { label: "Return",     color: "#0891B2", bg: "#ECFEFF", Icon: RotateCcw,        dir: "in"  },
};

const UNITS = ["piece","box","vial","ampoule","syringe","ml","g","strip","bottle","tube","unit","set"];
const GST_OPTS = [0, 5, 12, 18, 28];
const PRODUCT_CATS: Record<ProductType, string[]> = {
  retail:     ["Skincare", "Sunscreen", "Serum", "Moisturiser", "Supplement", "Tool", "Other"],
  consumable: ["Injectable", "Filler / Toxin", "Disposable", "Syringe", "Anaesthetic", "Peel", "Laser Supply", "PPE", "Other"],
  equipment:  ["Machine", "Handpiece", "Accessory", "Other"],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt     = (n: number) => "₹" + (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtD    = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const todayS  = () => new Date().toISOString().split("T")[0];
const firstMo = () => { const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0]; };
const daysTo  = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);

function stockStatus(p: Product): "out" | "critical" | "low" | "ok" {
  if (p.current_stock === 0)                             return "out";
  if (p.current_stock <= Math.floor(p.low_stock_threshold / 2)) return "critical";
  if (p.current_stock <= p.low_stock_threshold)          return "low";
  return "ok";
}

const STOCK_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  out:      { label: "Out of Stock",  color: "#8A1A1A", bg: "#FEF2F2" },
  critical: { label: "Critical",      color: "#8A1A1A", bg: "#FEF2F2" },
  low:      { label: "Low Stock",     color: "#92600A", bg: "#FFF8E8" },
  ok:       { label: "In Stock",      color: "#2A5A2A", bg: "#EFF6EF" },
};

// ── FIFO batch depletion ──────────────────────────────────────────────────────

async function consumeFIFO(params: {
  productId: string; clinicId: string; quantity: number;
  movementType: MovementType;
  unitCost?: number; sellingPrice?: number; gstAmount?: number;
  patientId?: string | null; appointmentId?: string | null; invoiceId?: string | null;
  reason?: string | null; notes?: string | null;
  performedBy?: string; performedByName?: string;
}) {
  const { data: batches, error } = await supabase
    .from("inventory_batches")
    .select("id, quantity_remaining, purchase_price")
    .eq("product_id", params.productId)
    .eq("clinic_id",  params.clinicId)
    .gt("quantity_remaining", 0)
    .order("expiry_date", { ascending: true, nullsFirst: false });

  if (error) throw error;

  const available = (batches ?? []).reduce((s, b) => s + b.quantity_remaining, 0);
  if (available < params.quantity) {
    throw new Error(`Insufficient stock. Available: ${available}, requested: ${params.quantity}.`);
  }

  let rem = params.quantity;
  for (const b of batches ?? []) {
    if (rem <= 0) break;
    const deduct = Math.min(b.quantity_remaining, rem);

    const { error: ue } = await supabase.from("inventory_batches")
      .update({ quantity_remaining: b.quantity_remaining - deduct })
      .eq("id", b.id);
    if (ue) throw ue;

    const { error: me } = await supabase.from("inventory_movements").insert({
      clinic_id:         params.clinicId,
      product_id:        params.productId,
      batch_id:          b.id,
      movement_type:     params.movementType,
      quantity:          deduct,
      unit_cost:         params.unitCost ?? b.purchase_price,
      selling_price:     params.sellingPrice ?? null,
      gst_amount:        params.gstAmount ? Math.round((params.gstAmount * deduct / params.quantity) * 100) / 100 : null,
      patient_id:        params.patientId    ?? null,
      appointment_id:    params.appointmentId ?? null,
      invoice_id:        params.invoiceId    ?? null,
      reason:            params.reason       ?? null,
      notes:             params.notes        ?? null,
      performed_by_name: params.performedByName ?? null,
    });
    if (me) throw me;

    rem -= deduct;
  }
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const { profile, activeClinicId, loading: profileLoading } = useClinic();

  const [tab,       setTab]       = useState<"stock" | "movements" | "catalog" | "suppliers" | "transfers" | "purchase_orders">("stock");
  const [products,  setProducts]  = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [batches,   setBatches]   = useState<Batch[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [stats,     setStats]     = useState<Stats>({ total: 0, lowStock: 0, expiring30: 0, stockValue: 0 });

  const [loading,    setLoading]    = useState(true);
  const [movLoading, setMovLoading] = useState(false);

  // Filters
  const [search,      setSearch]      = useState("");
  const [typeFilter,  setTypeFilter]  = useState<ProductType | "all">("all");
  const [lowOnly,     setLowOnly]     = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [movDateFrom, setMovDateFrom] = useState(firstMo());
  const [movDateTo,   setMovDateTo]   = useState(todayS());
  const [movType,     setMovType]     = useState<MovementType | "all">("all");

  // Drawers
  const [drawer,    setDrawer]    = useState<DrawerKind>(null);
  const [dProduct,  setDProduct]  = useState<Product | null>(null);
  const [dSupplier, setDSupplier] = useState<Supplier | null>(null);

  // ── Data fetch ──

  const fetchAll = useCallback(async () => {
    if (!activeClinicId) return;
    setLoading(true);
    try {
      const [{ data: prods }, { data: bData }, { data: supps }] = await Promise.all([
        supabase.from("inventory_products")
          .select("*, inventory_suppliers(name)")
          .eq("clinic_id", activeClinicId)
          .order("product_type").order("name"),
        supabase.from("inventory_batches")
          .select("id, product_id, batch_number, quantity_remaining, quantity_received, expiry_date, purchase_price, received_at, supplier_id")
          .eq("clinic_id", activeClinicId),
        supabase.from("inventory_suppliers")
          .select("*")
          .eq("clinic_id", activeClinicId)
          .order("name"),
      ]);

      const today  = new Date();
      const d30    = new Date(); d30.setDate(today.getDate() + 30);

      // Stock map from batches
      const stockMap = new Map<string, { qty: number; exp: string | null; exp30: number; val: number }>();
      (bData ?? []).forEach((b: any) => {
        if (b.quantity_remaining <= 0) return;
        const e  = stockMap.get(b.product_id) ?? { qty: 0, exp: null, exp30: 0, val: 0 };
        const ed = b.expiry_date ? new Date(b.expiry_date) : null;
        stockMap.set(b.product_id, {
          qty:  e.qty + b.quantity_remaining,
          exp:  ed ? (!e.exp || b.expiry_date < e.exp ? b.expiry_date : e.exp) : e.exp,
          exp30: e.exp30 + (ed && ed <= d30 ? b.quantity_remaining : 0),
          val:  e.val + b.quantity_remaining * (b.purchase_price ?? 0),
        });
      });

      const enriched: Product[] = (prods ?? []).map((p: any) => {
        const s = stockMap.get(p.id) ?? { qty: 0, exp: null, exp30: 0, val: 0 };
        return {
          ...p,
          supplier_name:   (p.inventory_suppliers as any)?.name ?? null,
          current_stock:   s.qty,
          nearest_expiry:  s.exp,
          exp30_qty:       s.exp30,
          stock_value:     s.val,
        };
      });

      setProducts(enriched);
      setBatches((bData ?? []) as Batch[]);
      setSuppliers((supps ?? []) as Supplier[]);

      const active = enriched.filter(p => p.is_active);
      setStats({
        total:      active.length,
        lowStock:   active.filter(p => p.current_stock <= p.low_stock_threshold).length,
        expiring30: active.filter(p => (p.exp30_qty ?? 0) > 0).length,
        stockValue: active.reduce((s, p) => s + p.stock_value, 0),
      });
    } catch { toast.error("Failed to load inventory"); }
    finally  { setLoading(false); }
  }, [activeClinicId]);

  const fetchMovements = useCallback(async () => {
    if (!activeClinicId) return;
    setMovLoading(true);
    const { data } = await supabase
      .from("inventory_movements")
      .select("*, inventory_products(name, unit_of_measure), inventory_batches(batch_number), patients(full_name)")
      .eq("clinic_id", activeClinicId)
      .gte("created_at", movDateFrom + "T00:00:00")
      .lte("created_at", movDateTo   + "T23:59:59")
      .order("created_at", { ascending: false })
      .limit(400);

    setMovements((data ?? []).map((m: any) => ({
      ...m,
      product_name: m.inventory_products?.name            ?? "Unknown",
      unit:         m.inventory_products?.unit_of_measure ?? "unit",
      batch_number: m.inventory_batches?.batch_number     ?? null,
      patient_name: m.patients?.full_name                 ?? null,
    })));
    setMovLoading(false);
  }, [activeClinicId, movDateFrom, movDateTo]);

  useEffect(() => {
    if (profileLoading) return;
    if (!activeClinicId) { setLoading(false); return; }
    fetchAll();
  }, [fetchAll, profileLoading, activeClinicId]);

  useEffect(() => {
    if (tab === "movements" && activeClinicId) fetchMovements();
  }, [tab, fetchMovements, activeClinicId]);

  const onRefresh = () => { fetchAll(); if (tab === "movements") fetchMovements(); };

  const openDraw = (kind: DrawerKind, product?: Product | null, supplier?: Supplier | null) => {
    setDProduct(product ?? null);
    setDSupplier(supplier ?? null);
    setDrawer(kind);
  };

  const closeDraw = (refresh?: boolean) => {
    setDrawer(null);
    setDProduct(null);
    setDSupplier(null);
    if (refresh) onRefresh();
  };

  // ── Export CSV ──
  const exportCSV = () => {
    const hdrs = ["Name","Brand","Type","Category","SKU","Unit","Stock","Low Threshold","MRP","Selling Price","Purchase Price","Nearest Expiry","Supplier","Active"];
    const rows = products.map(p => [
      p.name, p.brand ?? "", p.product_type, p.category ?? "", p.sku ?? "",
      p.unit_of_measure, p.current_stock, p.low_stock_threshold,
      p.mrp ?? "", p.selling_price ?? "", p.purchase_price ?? "",
      p.nearest_expiry ? fmtD(p.nearest_expiry) : "",
      p.supplier_name ?? "", p.is_active ? "Yes" : "No",
    ]);
    const csv = [hdrs, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a   = document.createElement("a"); a.href = url; a.download = `inventory-${todayS()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const isAdmin = ["superadmin","chain_admin","clinic_admin"].includes(profile?.role ?? "");

  // ── Filtered products ──
  const filtered = useMemo(() => products.filter(p => {
    if (!showInactive && !p.is_active) return false;
    if (typeFilter !== "all" && p.product_type !== typeFilter) return false;
    if (lowOnly && p.current_stock > p.low_stock_threshold) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.brand ?? "").toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q);
    }
    return true;
  }), [products, typeFilter, lowOnly, search, showInactive]);

  const filteredMov = useMemo(() => movements.filter(m =>
    movType === "all" || m.movement_type === movType
  ), [movements, movType]);

  // ── Tabs ──
  const TABS = [
    { key: "stock",           label: "Stock Overview"  },
    { key: "movements",       label: "Movements"       },
    { key: "catalog",         label: "Products"        },
    { key: "suppliers",       label: "Suppliers"       },
    { key: "transfers",       label: "Transfers"       },
    { key: "purchase_orders", label: "Purchase Orders" },
  ] as const;

  return (
    <div className="min-h-full" style={{ background: "var(--background)" }}>

      <div className="px-6 py-6 max-w-[1440px] mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
              Inventory
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              Retail products · Consumables · Equipment
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
                style={{ background: "rgba(197,160,89,0.08)", color: "var(--gold)", border: "1px solid rgba(197,160,89,0.2)" }}>
                <Download size={12} /> Export
              </button>
              <button onClick={() => openDraw("import")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
                style={{ background: "rgba(42,74,138,0.08)", color: "#2A4A8A", border: "1px solid rgba(42,74,138,0.2)" }}>
                <Upload size={12} /> Import
              </button>
              <button onClick={() => openDraw("supplier")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
                style={{ background: "rgba(197,160,89,0.08)", color: "var(--gold)", border: "1px solid rgba(197,160,89,0.2)" }}>
                <Building2 size={12} /> Add Supplier
              </button>
              <button onClick={() => openDraw("receive")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
                style={{ background: "rgba(42,74,138,0.1)", color: "#2A4A8A", border: "1px solid rgba(42,74,138,0.2)" }}>
                <Truck size={12} /> Receive Stock
              </button>
              <button onClick={() => openDraw("product")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--gold)", color: "#fff" }}>
                <Plus size={16} /> Add Product
              </button>
            </div>
          )}
        </div>

        {/* No-clinic empty state (superadmin without clinic selected) */}
        {!profileLoading && !activeClinicId && (
          <div className="rounded-2xl p-16 text-center" style={{ background: "var(--card-bg)", border: "1px dashed rgba(197,160,89,0.3)" }}>
            <Building2 size={36} className="mx-auto mb-3" style={{ color: "rgba(197,160,89,0.4)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Select a clinic from the top bar to view inventory</p>
          </div>
        )}

        {/* Stats row */}
        {activeClinicId && <StatsRow stats={stats} loading={loading} />}

        {/* Tab panel */}
        {activeClinicId && <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
          {/* Tab bar */}
          <div className="flex items-center gap-0.5 px-4 pt-4 border-b overflow-x-auto" style={{ borderColor: "var(--border)" }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-all"
                style={{
                  background:   tab === t.key ? "rgba(197,160,89,0.1)" : "transparent",
                  color:        tab === t.key ? "var(--gold)"          : "var(--text-muted)",
                  borderBottom: tab === t.key ? "2px solid var(--gold)" : "2px solid transparent",
                }}>
                {t.label}
              </button>
            ))}
            <div className="flex-1" />
            <button onClick={onRefresh}
              className="mb-1 p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}>
              <RefreshCw size={14} />
            </button>
          </div>

          {/* Tab content */}
          {tab === "stock" && (
            <StockTab
              products={filtered}
              loading={loading}
              search={search}        setSearch={setSearch}
              typeFilter={typeFilter} setTypeFilter={setTypeFilter}
              lowOnly={lowOnly}      setLowOnly={setLowOnly}
              onReceive={p => openDraw("receive", p)}
              onSell={p    => openDraw("sale",    p)}
              onConsume={p => openDraw("consume", p)}
              onAdjust={p  => openDraw("adjust",  p)}
              onEdit={p    => openDraw("product",  p)}
            />
          )}
          {tab === "movements" && (
            <MovementsTab
              movements={filteredMov}
              loading={movLoading}
              dateFrom={movDateFrom} setDateFrom={setMovDateFrom}
              dateTo={movDateTo}     setDateTo={setMovDateTo}
              movType={movType}      setMovType={setMovType}
              onRefresh={fetchMovements}
            />
          )}
          {tab === "catalog" && (
            <CatalogTab
              products={products}
              showInactive={showInactive}
              setShowInactive={setShowInactive}
              onEdit={p => openDraw("product", p)}
              onReceive={p => openDraw("receive", p)}
            />
          )}
          {tab === "suppliers" && (
            <SuppliersTab
              suppliers={suppliers}
              onEdit={s => openDraw("supplier", null, s)}
            />
          )}
          {tab === "transfers" && (
            <TransfersTab
              clinicId={activeClinicId!}
              products={products}
              profile={profile}
              isAdmin={isAdmin}
            />
          )}
          {tab === "purchase_orders" && (
            <PurchaseOrdersTab clinicId={activeClinicId!} profile={profile} />
          )}
        </div>}
      </div>

      {/* ── Drawers ── */}
      {drawer === "product"  && <ProductDrawer  product={dProduct}  suppliers={suppliers} clinicId={activeClinicId!} profile={profile} onClose={closeDraw} />}
      {drawer === "supplier" && <SupplierDrawer supplier={dSupplier} clinicId={activeClinicId!} onClose={closeDraw} />}
      {drawer === "receive"  && <ReceiveDrawer  product={dProduct}  suppliers={suppliers} products={products} batches={batches} clinicId={activeClinicId!} profile={profile} onClose={closeDraw} />}
      {drawer === "sale"     && dProduct && <SaleDrawer    product={dProduct} clinicId={activeClinicId!} profile={profile} onClose={closeDraw} />}
      {drawer === "consume"  && dProduct && <ConsumeDrawer product={dProduct} clinicId={activeClinicId!} profile={profile} onClose={closeDraw} />}
      {drawer === "adjust"   && dProduct && <AdjustDrawer  product={dProduct} batches={batches.filter(b => b.product_id === dProduct.id)} clinicId={activeClinicId!} profile={profile} onClose={closeDraw} />}
      {drawer === "import"   && <ImportDrawer clinicId={activeClinicId!} suppliers={suppliers} profile={profile} onClose={closeDraw} />}
    </div>
  );
}

// ── Stats Row ─────────────────────────────────────────────────────────────────

function StatsRow({ stats, loading }: { stats: Stats; loading: boolean }) {
  const cards = [
    { label: "Total SKUs",      value: stats.total,          Icon: Layers,         color: "#C5A059", bg: "rgba(197,160,89,0.08)" },
    { label: "Low Stock",       value: stats.lowStock,       Icon: AlertTriangle,  color: "#D97706", bg: "#FFFBEB"               },
    { label: "Expiring <30d",   value: stats.expiring30,     Icon: Calendar,       color: "#DC2626", bg: "#FEF2F2"               },
    { label: "Stock Value",     value: fmt(stats.stockValue), Icon: IndianRupee,   color: "#4A8A4A", bg: "rgba(74,138,74,0.08)" },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(c => (
        <div key={c.label} className="rounded-2xl p-5" style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{c.label}</p>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: c.bg }}>
              <c.Icon size={16} style={{ color: c.color }} />
            </div>
          </div>
          {loading ? (
            <div className="h-7 w-16 rounded animate-pulse" style={{ background: "rgba(197,160,89,0.08)" }} />
          ) : (
            <p className="text-2xl font-bold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>{c.value}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Stock Tab ─────────────────────────────────────────────────────────────────

function StockTab({ products, loading, search, setSearch, typeFilter, setTypeFilter, lowOnly, setLowOnly,
  onReceive, onSell, onConsume, onAdjust, onEdit }: {
  products: Product[]; loading: boolean;
  search: string; setSearch: (v: string) => void;
  typeFilter: ProductType | "all"; setTypeFilter: (v: ProductType | "all") => void;
  lowOnly: boolean; setLowOnly: (v: boolean) => void;
  onReceive: (p: Product) => void; onSell: (p: Product) => void;
  onConsume: (p: Product) => void; onAdjust: (p: Product) => void;
  onEdit:    (p: Product) => void;
}) {
  // Expiry alert banner
  const expiringProds = products.filter(p => p.nearest_expiry && daysTo(p.nearest_expiry) <= 30 && daysTo(p.nearest_expiry) >= 0);
  const expiredProds  = products.filter(p => p.nearest_expiry && daysTo(p.nearest_expiry) < 0);

  return (
    <div>
      {/* Alerts */}
      {(expiredProds.length > 0 || expiringProds.length > 0) && (
        <div className="mx-4 mt-4 rounded-xl p-3 space-y-1" style={{ background: "#FEF2F2", border: "1px solid rgba(220,38,38,0.25)" }}>
          <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "#DC2626" }}>
            <AlertTriangle size={12} />
            {expiredProds.length > 0 && `${expiredProds.length} expired · `}
            {expiringProds.length > 0 && `${expiringProds.length} expiring within 30 days`}
          </p>
          <p className="text-xs" style={{ color: "#B91C1C" }}>
            {[...expiredProds, ...expiringProds].map(p => p.name).join(" · ")}
          </p>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search product, brand, SKU…"
            className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
        </div>
        {(["all","retail","consumable","equipment"] as const).map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
            style={{
              background: typeFilter === t ? (t === "all" ? "var(--gold)" : TYPE_CFG[t as ProductType]?.bg ?? "var(--gold)") : "var(--input-bg)",
              color:      typeFilter === t ? (t === "all" ? "#fff"        : TYPE_CFG[t as ProductType]?.color ?? "#fff")     : "var(--text-muted)",
              border:     `1px solid ${typeFilter === t ? "transparent" : "var(--border)"}`,
            }}>
            {t === "all" ? "All Types" : t}
          </button>
        ))}
        <button onClick={() => setLowOnly(!lowOnly)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: lowOnly ? "#FFFBEB" : "var(--input-bg)",
            color:      lowOnly ? "#D97706" : "var(--text-muted)",
            border:     `1px solid ${lowOnly ? "rgba(217,119,6,0.3)" : "var(--border)"}`,
          }}>
          <AlertTriangle size={12} /> Low Stock Only
        </button>
      </div>

      {/* Product table */}
      {loading ? (
        <div className="p-6 space-y-3 animate-pulse">
          {[1,2,3,4,5].map(n => <div key={n} className="h-14 rounded-xl" style={{ background: "rgba(197,160,89,0.04)" }} />)}
        </div>
      ) : products.length === 0 ? (
        <div className="py-20 flex flex-col items-center gap-3">
          <Package size={40} style={{ color: "rgba(197,160,89,0.3)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No products found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Product","Type","Stock","Reorder At","Expiry","MRP / Sell","Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const status = stockStatus(p);
                const badge  = STOCK_BADGE[status];
                const tc     = TYPE_CFG[p.product_type];
                const expDays = p.nearest_expiry ? daysTo(p.nearest_expiry) : null;

                return (
                  <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(197,160,89,0.02)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}>

                    {/* Product */}
                    <td className="px-4 py-3.5">
                      <p className="font-semibold" style={{ color: "var(--foreground)" }}>{p.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {[p.brand, p.sku ? `SKU: ${p.sku}` : null].filter(Boolean).join(" · ")}
                      </p>
                      {p.storage_condition && (
                        <p className="text-xs mt-0.5" style={{ color: "#2A4A8A" }}>🌡 {p.storage_condition}</p>
                      )}
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold"
                        style={{ background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>
                        <tc.Icon size={10} />
                        {tc.label}
                      </span>
                      {p.category && (
                        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{p.category}</p>
                      )}
                    </td>

                    {/* Stock */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold" style={{ color: status === "ok" ? "var(--foreground)" : badge.color, fontFamily: "Georgia, serif" }}>
                          {p.current_stock}
                        </span>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{p.unit_of_measure}</span>
                      </div>
                      <span className="text-xs px-1.5 py-0.5 rounded-md font-semibold"
                        style={{ background: badge.bg, color: badge.color }}>
                        {badge.label}
                      </span>
                    </td>

                    {/* Reorder */}
                    <td className="px-4 py-3.5 text-sm" style={{ color: "var(--text-muted)" }}>
                      ≤ {p.low_stock_threshold} {p.unit_of_measure}
                    </td>

                    {/* Expiry */}
                    <td className="px-4 py-3.5">
                      {p.nearest_expiry ? (
                        <span className="text-xs font-medium px-2 py-1 rounded-md"
                          style={{
                            background: expDays !== null && expDays < 0 ? "#FEF2F2" : expDays !== null && expDays <= 30 ? "#FFF8E8" : "rgba(197,160,89,0.06)",
                            color:      expDays !== null && expDays < 0 ? "#DC2626" : expDays !== null && expDays <= 30 ? "#D97706" : "var(--text-muted)",
                          }}>
                          {expDays !== null && expDays < 0 ? "Expired" : expDays !== null && expDays <= 30 ? `${expDays}d left` : fmtD(p.nearest_expiry)}
                        </span>
                      ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                    </td>

                    {/* Prices */}
                    <td className="px-4 py-3.5 text-xs" style={{ color: "var(--text-muted)" }}>
                      {p.mrp && <p>MRP {fmt(p.mrp)}</p>}
                      {p.selling_price && <p style={{ color: "var(--gold)" }}>Sell {fmt(p.selling_price)}</p>}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        <ActionBtn title="Receive Stock" color="#4A8A4A" onClick={() => onReceive(p)}><Truck size={13} /></ActionBtn>
                        {p.product_type === "retail"     && <ActionBtn title="Sell"    color="#C5A059" onClick={() => onSell(p)}   ><ShoppingCart size={13} /></ActionBtn>}
                        {p.product_type === "consumable" && <ActionBtn title="Consume" color="#7C3AED" onClick={() => onConsume(p)} ><FlaskConical size={13} /></ActionBtn>}
                        <ActionBtn title="Adjust"  color="#D97706" onClick={() => onAdjust(p)} ><TrendingDown size={13} /></ActionBtn>
                        <ActionBtn title="Edit"    color="var(--text-muted)" onClick={() => onEdit(p)}><Edit2 size={13} /></ActionBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{products.length} product{products.length !== 1 ? "s" : ""}</p>
            <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              Stock value: <span style={{ color: "var(--gold)", fontFamily: "Georgia, serif" }}>
                {fmt(products.reduce((s, p) => s + p.stock_value, 0))}
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Movements Tab ─────────────────────────────────────────────────────────────

function MovementsTab({ movements, loading, dateFrom, setDateFrom, dateTo, setDateTo, movType, setMovType, onRefresh }: {
  movements: Movement[]; loading: boolean;
  dateFrom: string; setDateFrom: (v: string) => void;
  dateTo:   string; setDateTo:   (v: string) => void;
  movType:  MovementType | "all"; setMovType: (v: MovementType | "all") => void;
  onRefresh: () => void;
}) {
  const totalIn  = movements.filter(m => MOV_CFG[m.movement_type].dir === "in").reduce((s, m) => s + m.quantity, 0);
  const totalOut = movements.filter(m => MOV_CFG[m.movement_type].dir === "out").reduce((s, m) => s + m.quantity, 0);
  const revenue  = movements.filter(m => m.movement_type === "sale").reduce((s, m) => s + (m.selling_price ?? 0) * m.quantity, 0);

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
          <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
        </div>
        <select value={movType} onChange={e => setMovType(e.target.value as MovementType | "all")}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <option value="all">All Types</option>
          {(Object.keys(MOV_CFG) as MovementType[]).map(k => (
            <option key={k} value={k}>{MOV_CFG[k].label}</option>
          ))}
        </select>
        <button onClick={onRefresh} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
          style={{ background: "rgba(197,160,89,0.08)", color: "var(--gold)", border: "1px solid rgba(197,160,89,0.2)" }}>
          <RefreshCw size={12} /> Refresh
        </button>
        {/* Summary chips */}
        <div className="flex gap-2 ml-auto">
          <span className="text-xs px-2.5 py-1 rounded-lg font-semibold" style={{ background: "#EFF6EF", color: "#2A5A2A" }}>
            ↑ {totalIn} units in
          </span>
          <span className="text-xs px-2.5 py-1 rounded-lg font-semibold" style={{ background: "#FEF2F2", color: "#8A1A1A" }}>
            ↓ {totalOut} units out
          </span>
          {revenue > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-lg font-semibold" style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)" }}>
              {fmt(revenue)} revenue
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-6 space-y-3 animate-pulse">
          {[1,2,3,4,5].map(n => <div key={n} className="h-12 rounded-xl" style={{ background: "rgba(197,160,89,0.04)" }} />)}
        </div>
      ) : movements.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-3">
          <BarChart2 size={36} style={{ color: "rgba(197,160,89,0.3)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No movements in this period</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Date","Product","Type","Qty","Batch","Cost","Patient / Note","By"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movements.map(m => {
                const cfg = MOV_CFG[m.movement_type];
                return (
                  <tr key={m.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                      {fmtD(m.created_at)}
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: "var(--foreground)" }}>
                      {m.product_name}
                      <p className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>{m.unit}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold"
                        style={{ background: cfg.bg, color: cfg.color }}>
                        <cfg.Icon size={10} />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold" style={{ color: cfg.dir === "in" ? "#4A8A4A" : "#B43C3C", fontFamily: "Georgia, serif" }}>
                      {cfg.dir === "in" ? "+" : "−"}{m.quantity}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                      {m.batch_number ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                      {m.unit_cost ? fmt(m.unit_cost) : m.selling_price ? fmt(m.selling_price) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[160px]" style={{ color: "var(--text-muted)" }}>
                      {m.patient_name ?? m.reason ?? m.notes ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                      {m.performed_by_name ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Catalog Tab ───────────────────────────────────────────────────────────────

function CatalogTab({ products, showInactive, setShowInactive, onEdit, onReceive }: {
  products: Product[]; showInactive: boolean; setShowInactive: (v: boolean) => void;
  onEdit: (p: Product) => void; onReceive: (p: Product) => void;
}) {
  const visible = showInactive ? products : products.filter(p => p.is_active);

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>{visible.length} products</p>
        <button onClick={() => setShowInactive(!showInactive)}
          className="text-xs font-medium px-3 py-1.5 rounded-lg"
          style={{ background: showInactive ? "rgba(197,160,89,0.1)" : "var(--input-bg)", color: showInactive ? "var(--gold)" : "var(--text-muted)", border: "1px solid var(--border)" }}>
          {showInactive ? "Hide Inactive" : "Show Inactive"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Name / Brand","Type","SKU","HSN","GST","MRP","Sell Price","Purchase","UoM","Threshold","Supplier",""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map(p => {
              const tc = TYPE_CFG[p.product_type];
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid var(--border)", opacity: p.is_active ? 1 : 0.5 }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(197,160,89,0.02)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}>
                  <td className="px-4 py-3">
                    <p className="font-semibold" style={{ color: "var(--foreground)" }}>{p.name}</p>
                    {p.brand && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{p.brand}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold"
                      style={{ background: tc.bg, color: tc.color }}>
                      <tc.Icon size={10} />{tc.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--text-muted)" }}>{p.sku ?? "—"}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{p.hsn_code ?? "—"}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{p.gst_rate}%</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{p.mrp ? fmt(p.mrp) : "—"}</td>
                  <td className="px-4 py-3 text-xs font-semibold" style={{ color: "var(--gold)" }}>{p.selling_price ? fmt(p.selling_price) : "—"}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{p.purchase_price ? fmt(p.purchase_price) : "—"}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{p.unit_of_measure}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{p.low_stock_threshold}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{p.supplier_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <ActionBtn title="Edit"    color="var(--text-muted)" onClick={() => onEdit(p)}><Edit2 size={13} /></ActionBtn>
                      <ActionBtn title="Receive" color="#4A8A4A"           onClick={() => onReceive(p)}><Truck size={13} /></ActionBtn>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Suppliers Tab ─────────────────────────────────────────────────────────────

function SuppliersTab({ suppliers, onEdit }: { suppliers: Supplier[]; onEdit: (s: Supplier) => void }) {
  return (
    <div>
      {suppliers.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-3">
          <Building2 size={36} style={{ color: "rgba(197,160,89,0.3)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No suppliers yet — add your first supplier</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Supplier","Contact","Phone / Email","GSTIN","Payment Terms",""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {suppliers.map(s => (
                <tr key={s.id} style={{ borderBottom: "1px solid var(--border)", opacity: s.is_active ? 1 : 0.5 }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(197,160,89,0.02)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}>
                  <td className="px-4 py-3.5">
                    <p className="font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>{s.name}</p>
                    {s.address && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{s.address}</p>}
                  </td>
                  <td className="px-4 py-3.5 text-sm" style={{ color: "var(--foreground)" }}>{s.contact_person ?? "—"}</td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: "var(--text-muted)" }}>
                    {s.phone && <p className="flex items-center gap-1"><Phone size={10} /> {s.phone}</p>}
                    {s.email && <p className="flex items-center gap-1"><Mail  size={10} /> {s.email}</p>}
                  </td>
                  <td className="px-4 py-3.5 text-xs font-mono" style={{ color: "var(--text-muted)" }}>{s.gstin ?? "—"}</td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: "var(--text-muted)" }}>{s.payment_terms ?? "—"}</td>
                  <td className="px-4 py-3.5">
                    <ActionBtn title="Edit" color="var(--text-muted)" onClick={() => onEdit(s)}><Edit2 size={13} /></ActionBtn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Transfers Tab ─────────────────────────────────────────────────────────────

interface InventoryTransfer {
  id: string;
  from_clinic_id: string;
  to_clinic_id: string;
  inventory_product_id: string;
  quantity: number;
  status: "pending" | "approved" | "completed" | "rejected";
  notes: string | null;
  created_at: string;
  inventory_products: { name: string } | null;
  from_clinic: { name: string } | null;
  to_clinic: { name: string } | null;
}

function TransfersTab({ clinicId, products, profile, isAdmin }: {
  clinicId: string;
  products: Product[];
  profile: { id: string; role: string | null; clinic_id: string | null } | null;
  isAdmin: boolean;
}) {
  const [transfers, setTransfers] = useState<InventoryTransfer[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showNew, setShowNew]     = useState(false);
  const [clinics, setClinics]     = useState<{ id: string; name: string }[]>([]);

  // New transfer form
  const [toClinicId,  setToClinicId]  = useState("");
  const [productId,   setProductId]   = useState(products[0]?.id ?? "");
  const [quantity,    setQuantity]    = useState(1);
  const [notes,       setNotes]       = useState("");
  const [saving,      setSaving]      = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: tr }, { data: cl }] = await Promise.all([
      supabase.from("inventory_transfers")
        .select("*, inventory_products(name), from_clinic:clinics!from_clinic_id(name), to_clinic:clinics!to_clinic_id(name)")
        .or(`from_clinic_id.eq.${clinicId},to_clinic_id.eq.${clinicId}`)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("clinics").select("id, name").order("name"),
    ]);
    setTransfers((tr ?? []) as InventoryTransfer[]);
    setClinics((cl ?? []).filter(c => c.id !== clinicId));
    setLoading(false);
  }, [clinicId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function submitTransfer() {
    if (!toClinicId || !productId || quantity < 1) { toast.error("Fill all required fields"); return; }
    setSaving(true);
    const { error } = await supabase.from("inventory_transfers").insert({
      from_clinic_id:       clinicId,
      to_clinic_id:         toClinicId,
      inventory_product_id: productId,
      quantity,
      status:               "pending",
      requested_by:         profile?.id ?? null,
      notes:                notes || null,
    });
    if (error) { toast.error("Failed to create transfer"); }
    else { toast.success("Transfer request submitted"); setShowNew(false); setNotes(""); setQuantity(1); fetchData(); }
    setSaving(false);
  }

  async function updateStatus(id: string, status: "approved" | "completed" | "rejected") {
    const { error } = await supabase.from("inventory_transfers").update({
      status,
      approved_by: status !== "rejected" ? profile?.id ?? null : null,
    }).eq("id", id);
    if (error) toast.error("Update failed");
    else { toast.success(`Transfer ${status}`); fetchData(); }
  }

  // B16: dispatch sets transfer_status=in_transit + deducts source inventory
  async function dispatchTransfer(id: string) {
    const { error } = await supabase.rpc("dispatch_transfer", {
      p_transfer_id: id,
      p_actor_id:    profile?.id,
    });
    if (error) toast.error(error.message ?? "Dispatch failed");
    else { toast.success("Transfer dispatched — stock deducted from source"); fetchData(); }
  }

  // B16: receive sets transfer_status=received + adds stock to destination
  async function receiveTransfer(id: string) {
    const { error } = await supabase.rpc("receive_transfer", {
      p_transfer_id: id,
      p_actor_id:    profile?.id,
    });
    if (error) toast.error(error.message ?? "Receive failed");
    else { toast.success("Transfer received — stock added to destination"); fetchData(); }
  }

  const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
    pending:    { color: "#D97706", bg: "rgba(217,119,6,0.1)" },
    approved:   { color: "#2563eb", bg: "rgba(37,99,235,0.1)" },
    completed:  { color: "#16a34a", bg: "rgba(22,163,74,0.1)" },
    rejected:   { color: "#dc2626", bg: "rgba(220,38,38,0.1)" },
    requested:  { color: "#D97706", bg: "rgba(217,119,6,0.1)" },
    in_transit: { color: "#7c3aed", bg: "rgba(124,58,237,0.1)" },
    received:   { color: "#16a34a", bg: "rgba(22,163,74,0.1)" },
    cancelled:  { color: "#dc2626", bg: "rgba(220,38,38,0.1)" },
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold" style={{ fontFamily: "Georgia, serif", color: "var(--foreground)" }}>
            Inter-Clinic Stock Transfers
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Transfer inventory between chain clinics</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
          style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)", border: "1px solid rgba(197,160,89,0.25)" }}>
          <ArrowLeftRight size={12} /> New Transfer
        </button>
      </div>

      {/* New transfer form */}
      {showNew && (
        <div className="mb-5 p-5 rounded-xl" style={{ background: "rgba(197,160,89,0.04)", border: "1px solid rgba(197,160,89,0.2)" }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "#9C9584" }}>Request Transfer</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Destination Clinic *</label>
              <select value={toClinicId} onChange={e => setToClinicId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
                <option value="">Select clinic…</option>
                {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Product *</label>
              <select value={productId} onChange={e => setProductId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
                {products.filter(p => p.is_active).map(p => <option key={p.id} value={p.id}>{p.name} ({p.current_stock} in stock)</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Quantity *</label>
              <input type="number" value={quantity} min={1} onChange={e => setQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", background: "var(--surface)" }} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional…"
                className="w-full px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", background: "var(--surface)" }} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowNew(false)}
              className="px-4 py-2 rounded-lg text-xs" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>Cancel</button>
            <button onClick={submitTransfer} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold"
              style={{ background: "var(--gold)", color: "white", border: "none" }}>
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Submit Request
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>Loading transfers…</p>
      ) : transfers.length === 0 ? (
        <div className="py-16 text-center">
          <ArrowLeftRight size={32} className="mx-auto mb-3 opacity-20" style={{ color: "var(--gold)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No transfers yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transfers.map(tr => {
            const isFrom  = tr.from_clinic_id === clinicId;
            const sc      = STATUS_COLORS[tr.status] ?? STATUS_COLORS.pending;
            return (
              <div key={tr.id} className="flex items-center gap-4 px-4 py-3 rounded-xl"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: isFrom ? "rgba(220,38,38,0.08)" : "rgba(22,163,74,0.08)", flexShrink: 0 }}>
                  <ArrowLeftRight size={14} style={{ color: isFrom ? "#dc2626" : "#16a34a" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ fontFamily: "Georgia, serif", color: "var(--foreground)" }}>
                    {(tr.inventory_products as { name: string } | null)?.name ?? "Product"}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {(tr.from_clinic as { name: string } | null)?.name ?? "?"} → {(tr.to_clinic as { name: string } | null)?.name ?? "?"}
                    {" · "}{tr.quantity} units
                  </p>
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-lg flex-shrink-0"
                  style={{ color: sc.color, background: sc.bg }}>
                  {tr.status}
                </span>
                {/* Legacy status buttons */}
                {isAdmin && tr.status === "pending" && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => updateStatus(tr.id, "approved")}
                      className="text-xs px-2 py-1 rounded-lg font-semibold"
                      style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a", border: "1px solid rgba(22,163,74,0.2)" }}>Approve</button>
                    <button onClick={() => updateStatus(tr.id, "rejected")}
                      className="text-xs px-2 py-1 rounded-lg font-semibold"
                      style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.2)" }}>Reject</button>
                  </div>
                )}
                {isAdmin && tr.status === "approved" && (
                  <button onClick={() => updateStatus(tr.id, "completed")}
                    className="text-xs px-2 py-1 rounded-lg font-semibold flex-shrink-0"
                    style={{ background: "rgba(37,99,235,0.1)", color: "#2563eb", border: "1px solid rgba(37,99,235,0.2)" }}>Mark Received</button>
                )}
                {/* B16: 2-step transit buttons using dispatch_transfer / receive_transfer RPCs */}
                {isAdmin && (tr as unknown as Record<string,unknown>).transfer_status === "requested" && (
                  <button onClick={() => dispatchTransfer(tr.id)}
                    className="text-xs px-2 py-1 rounded-lg font-semibold flex-shrink-0"
                    style={{ background: "rgba(124,58,237,0.1)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.2)" }}>
                    Dispatch
                  </button>
                )}
                {isAdmin && (tr as unknown as Record<string,unknown>).transfer_status === "in_transit" && tr.from_clinic_id !== clinicId && (
                  <button onClick={() => receiveTransfer(tr.id)}
                    className="text-xs px-2 py-1 rounded-lg font-semibold flex-shrink-0"
                    style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a", border: "1px solid rgba(22,163,74,0.2)" }}>
                    Receive
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── GAP-59: Purchase Orders Tab ───────────────────────────────────────────────

interface PurchaseOrder {
  id: string;
  supplier_name: string | null;
  items: { name: string; qty: number; unit_price: number }[];
  status: "draft" | "sent" | "received" | "cancelled";
  expected_date: string | null;
  notes: string | null;
  total_amount: number;
  created_at: string;
}

const PO_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: "Draft",     color: "#9C9584", bg: "rgba(156,149,132,0.1)" },
  sent:      { label: "Sent",      color: "#C5A059", bg: "rgba(197,160,89,0.1)"  },
  received:  { label: "Received",  color: "#059669", bg: "rgba(5,150,105,0.1)"   },
  cancelled: { label: "Cancelled", color: "#DC2626", bg: "rgba(220,38,38,0.1)"   },
};

function PurchaseOrdersTab({ clinicId, profile }: { clinicId: string; profile: { role?: string | null } | null }) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ supplier_name: "", notes: "", expected_date: "", items: [{ name: "", qty: "1", unit_price: "0" }] });
  const isAdmin = ["superadmin","chain_admin","clinic_admin"].includes(profile?.role ?? "");

  useEffect(() => {
    supabase.from("inventory_purchase_orders").select("*").eq("clinic_id", clinicId).order("created_at", { ascending: false })
      .then(({ data }) => { setOrders((data ?? []) as PurchaseOrder[]); setLoading(false); });
  }, [clinicId]);

  async function handleCreate() {
    setSaving(true);
    const items = form.items.filter(i => i.name.trim()).map(i => ({ name: i.name.trim(), qty: parseFloat(i.qty) || 1, unit_price: parseFloat(i.unit_price) || 0 }));
    const total_amount = items.reduce((s, i) => s + i.qty * i.unit_price, 0);
    const { data, error } = await supabase.from("inventory_purchase_orders").insert({
      clinic_id: clinicId, supplier_name: form.supplier_name.trim() || null,
      items, notes: form.notes.trim() || null,
      expected_date: form.expected_date || null, total_amount,
    }).select("*").single();
    setSaving(false);
    if (error) { const { toast } = await import("sonner"); toast.error(error.message); return; }
    setOrders(o => [data as PurchaseOrder, ...o]);
    setShowForm(false);
    setForm({ supplier_name: "", notes: "", expected_date: "", items: [{ name: "", qty: "1", unit_price: "0" }] });
    const { toast } = await import("sonner"); toast.success("Purchase order created");
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("inventory_purchase_orders").update({ status }).eq("id", id);
    if (!error) setOrders(o => o.map(x => x.id === id ? { ...x, status: status as PurchaseOrder["status"] } : x));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Purchase Orders</h2>
        {isAdmin && (
          <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: "var(--gold)" }}>
            <Plus size={13} /> New PO
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-4 rounded-xl p-4 border" style={{ background: "#fff", borderColor: "rgba(197,160,89,0.2)" }}>
          <p className="text-sm font-semibold mb-3" style={{ fontFamily: "Georgia, serif" }}>New Purchase Order</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-semibold uppercase" style={{ color: "#9C9584" }}>Supplier Name</label>
              <input value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} placeholder="e.g. MedSupply Co." className="mt-1 w-full text-sm px-3 py-2 rounded-lg border outline-none" style={{ borderColor: "rgba(197,160,89,0.25)" }} />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase" style={{ color: "#9C9584" }}>Expected Date</label>
              <input type="date" value={form.expected_date} onChange={e => setForm(f => ({ ...f, expected_date: e.target.value }))} className="mt-1 w-full text-sm px-3 py-2 rounded-lg border outline-none" style={{ borderColor: "rgba(197,160,89,0.25)" }} />
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs font-semibold uppercase" style={{ color: "#9C9584" }}>Items</label>
            {form.items.map((item, idx) => (
              <div key={idx} className="flex gap-2 mt-1">
                <input value={item.name} onChange={e => setForm(f => { const items = [...f.items]; items[idx] = { ...items[idx], name: e.target.value }; return { ...f, items }; })} placeholder="Product name" className="flex-1 text-sm px-2 py-1.5 rounded border outline-none" style={{ borderColor: "rgba(197,160,89,0.25)" }} />
                <input type="number" value={item.qty} onChange={e => setForm(f => { const items = [...f.items]; items[idx] = { ...items[idx], qty: e.target.value }; return { ...f, items }; })} placeholder="Qty" className="w-16 text-sm px-2 py-1.5 rounded border outline-none" style={{ borderColor: "rgba(197,160,89,0.25)" }} />
                <input type="number" value={item.unit_price} onChange={e => setForm(f => { const items = [...f.items]; items[idx] = { ...items[idx], unit_price: e.target.value }; return { ...f, items }; })} placeholder="₹/unit" className="w-20 text-sm px-2 py-1.5 rounded border outline-none" style={{ borderColor: "rgba(197,160,89,0.25)" }} />
                {form.items.length > 1 && <button onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))} className="text-red-400 hover:text-red-600"><X size={14} /></button>}
              </div>
            ))}
            <button onClick={() => setForm(f => ({ ...f, items: [...f.items, { name: "", qty: "1", unit_price: "0" }] }))} className="mt-2 text-xs font-medium" style={{ color: "var(--gold)" }}>+ Add Item</button>
          </div>
          <div className="mb-3">
            <label className="text-xs font-semibold uppercase" style={{ color: "#9C9584" }}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1 w-full text-sm px-3 py-2 rounded-lg border outline-none resize-none" style={{ borderColor: "rgba(197,160,89,0.25)" }} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs rounded-lg border" style={{ borderColor: "rgba(197,160,89,0.3)" }}>Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="px-4 py-1.5 text-xs font-medium rounded-lg text-white" style={{ background: "var(--gold)" }}>{saving ? "Saving…" : "Create PO"}</button>
          </div>
        </div>
      )}

      {loading ? (
        [1,2,3].map(n => <div key={n} className="h-16 rounded-xl mb-2 animate-pulse" style={{ background: "rgba(197,160,89,0.06)" }} />)
      ) : orders.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.12)" }}>
          <p className="text-sm" style={{ color: "#9ca3af" }}>No purchase orders yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map(po => {
            const sc = PO_STATUS[po.status];
            const itemCount = (po.items ?? []).length;
            return (
              <div key={po.id} className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.12)" }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: "#1a1714" }}>{po.supplier_name ?? "—"}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>{itemCount} item{itemCount !== 1 ? "s" : ""} · ₹{(po.total_amount ?? 0).toLocaleString("en-IN")} · {po.expected_date ?? "No date"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: sc.color, background: sc.bg }}>{sc.label}</span>
                  {isAdmin && po.status === "draft" && (
                    <button onClick={() => updateStatus(po.id, "sent")} className="text-xs px-2 py-1 rounded-lg border" style={{ borderColor: "rgba(197,160,89,0.3)", color: "#C5A059" }}>Mark Sent</button>
                  )}
                  {isAdmin && po.status === "sent" && (
                    <button onClick={() => updateStatus(po.id, "received")} className="text-xs px-2 py-1 rounded-lg border" style={{ borderColor: "rgba(5,150,105,0.3)", color: "#059669" }}>Mark Received</button>
                  )}
                  {isAdmin && (po.status === "draft" || po.status === "sent") && (
                    <button onClick={() => updateStatus(po.id, "cancelled")} className="text-xs px-2 py-1 rounded-lg border" style={{ borderColor: "rgba(220,38,38,0.25)", color: "#DC2626" }}>Cancel</button>
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

// ── Product Drawer ────────────────────────────────────────────────────────────

function ProductDrawer({ product, suppliers, clinicId, profile, onClose }: {
  product: Product | null; suppliers: Supplier[];
  clinicId: string; profile: any; onClose: (refresh?: boolean) => void;
}) {
  const isEdit = !!product;
  const [name,         setName]         = useState(product?.name             ?? "");
  const [brand,        setBrand]        = useState(product?.brand            ?? "");
  const [prodType,     setProdType]     = useState<ProductType>(product?.product_type ?? "consumable");
  const [category,     setCategory]     = useState(product?.category         ?? "");
  const [sku,          setSku]          = useState(product?.sku              ?? "");
  const [hsnCode,      setHsnCode]      = useState(product?.hsn_code         ?? "");
  const [gstRate,      setGstRate]      = useState(product?.gst_rate         ?? 18);
  const [mrp,          setMrp]          = useState(product?.mrp?.toString()  ?? "");
  const [sellPrice,    setSellPrice]    = useState(product?.selling_price?.toString()  ?? "");
  const [costPrice,    setCostPrice]    = useState(product?.purchase_price?.toString() ?? "");
  const [unit,         setUnit]         = useState(product?.unit_of_measure   ?? "piece");
  const [unitsPerPack, setUnitsPerPack] = useState(product?.units_per_pack   ?? 1);
  const [lowThresh,    setLowThresh]    = useState(product?.low_stock_threshold ?? 5);
  const [reorderQty,   setReorderQty]  = useState(product?.reorder_quantity  ?? 10);
  const [storage,      setStorage]      = useState(product?.storage_condition ?? "");
  const [isPrescription, setIsPresc]   = useState(product?.is_prescription   ?? false);
  const [supplierId,   setSupplierId]  = useState(product?.supplier_id       ?? "");
  const [notes,        setNotes]       = useState(product?.notes             ?? "");
  const [saving,       setSaving]      = useState(false);

  const cats = PRODUCT_CATS[prodType];

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Product name is required"); return; }
    setSaving(true);
    try {
      const payload = {
        clinic_id: clinicId,
        name: name.trim(), brand: brand || null, product_type: prodType,
        category: category || null, sku: sku || null, hsn_code: hsnCode || null,
        gst_rate: gstRate,
        mrp:           mrp       ? parseFloat(mrp)       : null,
        selling_price: sellPrice ? parseFloat(sellPrice) : null,
        purchase_price:costPrice ? parseFloat(costPrice) : null,
        unit_of_measure: unit, units_per_pack: unitsPerPack,
        low_stock_threshold: lowThresh, reorder_quantity: reorderQty,
        storage_condition: storage || null,
        is_prescription: isPrescription,
        supplier_id: supplierId || null,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      };
      if (isEdit) {
        const { error } = await supabase.from("inventory_products").update(payload).eq("id", product!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inventory_products").insert(payload);
        if (error) throw error;
      }
      await logAction({ action: isEdit ? "update_product" : "create_product", targetName: name });
      toast.success(isEdit ? "Product updated" : "Product added");
      onClose(true);
    } catch (e: any) { toast.error(e.message ?? "Failed to save product"); }
    finally { setSaving(false); }
  };

  return (
    <Drawer title={isEdit ? "Edit Product" : "Add Product"} icon={<Package size={16} style={{ color: "var(--gold)" }} />} onClose={() => onClose()}>
      <div className="space-y-4">
        {/* Type selector */}
        <div>
          <DLabel>Product Type</DLabel>
          <div className="grid grid-cols-3 gap-2">
            {(["retail","consumable","equipment"] as ProductType[]).map(t => {
              const tc = TYPE_CFG[t];
              return (
                <button key={t} onClick={() => { setProdType(t); setCategory(""); }}
                  className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: prodType === t ? tc.bg             : "var(--input-bg)",
                    color:      prodType === t ? tc.color          : "var(--text-muted)",
                    border:     prodType === t ? `1px solid ${tc.border}` : "1px solid var(--border)",
                  }}>
                  <tc.Icon size={16} />
                  {tc.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DField label="Name *" value={name} onChange={setName} placeholder="e.g. Botox 100U" />
          <DField label="Brand"  value={brand} onChange={setBrand} placeholder="e.g. Allergan" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <DLabel>Category</DLabel>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
              <option value="">— Select —</option>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <DField label="SKU / Code" value={sku} onChange={setSku} placeholder="e.g. BOT-100" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DField label="HSN Code"  value={hsnCode} onChange={setHsnCode} placeholder="e.g. 3002" />
          <div>
            <DLabel>GST Rate</DLabel>
            <select value={gstRate} onChange={e => setGstRate(parseFloat(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
              {GST_OPTS.map(g => <option key={g} value={g}>{g}%</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <DField label="MRP (₹)"           value={mrp}       onChange={setMrp}       type="number" placeholder="0" />
          <DField label="Selling Price (₹)"  value={sellPrice} onChange={setSellPrice} type="number" placeholder="0" />
          <DField label="Purchase Price (₹)" value={costPrice} onChange={setCostPrice} type="number" placeholder="0" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <DLabel>Unit of Measure</DLabel>
            <select value={unit} onChange={e => setUnit(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <DField label="Units / Pack"         value={unitsPerPack}  onChange={v => setUnitsPerPack(parseInt(v) || 1)}  type="number" />
          <DField label="Low Stock Alert (≤)"  value={lowThresh}     onChange={v => setLowThresh(parseInt(v) || 0)}      type="number" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DField label="Reorder Qty"    value={reorderQty} onChange={v => setReorderQty(parseInt(v) || 0)}  type="number" />
          <DField label="Storage Condition" value={storage} onChange={setStorage} placeholder="e.g. Refrigerate 2-8°C" />
        </div>

        <div>
          <DLabel>Supplier</DLabel>
          <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
            <option value="">— No supplier —</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="ispresc" checked={isPrescription} onChange={e => setIsPresc(e.target.checked)}
            className="rounded" style={{ accentColor: "var(--gold)" }} />
          <label htmlFor="ispresc" className="text-sm" style={{ color: "var(--foreground)" }}>Prescription required</label>
        </div>

        <div>
          <DLabel>Notes</DLabel>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full px-3 py-2 rounded-xl text-sm resize-none outline-none"
            style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
        </div>
      </div>

      {/* Custom Fields — edit mode only */}
      {isEdit && product?.id && (
        <div style={{ borderTop: "1px solid rgba(197,160,89,0.15)", padding: "16px 0 8px" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9C9584", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>Custom Fields</p>
          <CustomFieldsSection entityType="inventory" entityId={product.id} clinicId={clinicId} />
        </div>
      )}

      <DrawerFooter onCancel={() => onClose()} onSave={handleSave} saving={saving}
        saveLabel={isEdit ? "Update Product" : "Add Product"} />
    </Drawer>
  );
}

// ── Supplier Drawer ───────────────────────────────────────────────────────────

function SupplierDrawer({ supplier, clinicId, onClose }: {
  supplier: Supplier | null; clinicId: string; onClose: (refresh?: boolean) => void;
}) {
  const isEdit = !!supplier;
  const [name,    setName]    = useState(supplier?.name            ?? "");
  const [contact, setContact] = useState(supplier?.contact_person  ?? "");
  const [phone,   setPhone]   = useState(supplier?.phone           ?? "");
  const [email,   setEmail]   = useState(supplier?.email           ?? "");
  const [gstin,   setGstin]   = useState(supplier?.gstin           ?? "");
  const [pan,     setPan]     = useState(supplier?.pan             ?? "");
  const [address, setAddress] = useState(supplier?.address         ?? "");
  const [terms,   setTerms]   = useState(supplier?.payment_terms   ?? "");
  const [notes,   setNotes]   = useState(supplier?.notes           ?? "");
  const [saving,  setSaving]  = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Supplier name is required"); return; }
    setSaving(true);
    try {
      const payload = {
        clinic_id: clinicId, name: name.trim(),
        contact_person: contact || null, phone: phone || null, email: email || null,
        gstin: gstin || null, pan: pan || null, address: address || null,
        payment_terms: terms || null, notes: notes || null,
      };
      if (isEdit) {
        const { error } = await supabase.from("inventory_suppliers").update(payload).eq("id", supplier!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inventory_suppliers").insert(payload);
        if (error) throw error;
      }
      toast.success(isEdit ? "Supplier updated" : "Supplier added");
      onClose(true);
    } catch (e: any) { toast.error(e.message ?? "Failed to save supplier"); }
    finally { setSaving(false); }
  };

  return (
    <Drawer title={isEdit ? "Edit Supplier" : "Add Supplier"} icon={<Building2 size={16} style={{ color: "var(--gold)" }} />} onClose={() => onClose()}>
      <div className="space-y-4">
        <DField label="Supplier Name *" value={name}    onChange={setName}    placeholder="e.g. MedCorp Pharma" />
        <DField label="Contact Person"  value={contact} onChange={setContact} placeholder="e.g. Rohit Sharma" />
        <div className="grid grid-cols-2 gap-3">
          <DField label="Phone" value={phone} onChange={setPhone} placeholder="+91 98765 43210" />
          <DField label="Email" value={email} onChange={setEmail} placeholder="supplier@example.com" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <DField label="GSTIN" value={gstin} onChange={setGstin} placeholder="27AABCU9603R1ZX" />
          <DField label="PAN"   value={pan}   onChange={setPan}   placeholder="AABCU9603R" />
        </div>
        <DField label="Address"       value={address} onChange={setAddress} placeholder="Full address…" />
        <DField label="Payment Terms" value={terms}   onChange={setTerms}   placeholder="e.g. 30 days net / COD" />
        <div>
          <DLabel>Notes</DLabel>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full px-3 py-2 rounded-xl text-sm resize-none outline-none"
            style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
        </div>
      </div>
      <DrawerFooter onCancel={() => onClose()} onSave={handleSave} saving={saving}
        saveLabel={isEdit ? "Update Supplier" : "Add Supplier"} />
    </Drawer>
  );
}

// ── Receive Stock Drawer (GRN) ────────────────────────────────────────────────

function ReceiveDrawer({ product, suppliers, products, batches, clinicId, profile, onClose }: {
  product: Product | null; suppliers: Supplier[]; products: Product[];
  batches: Batch[]; clinicId: string; profile: any; onClose: (refresh?: boolean) => void;
}) {
  const [selProduct,  setSelProduct]  = useState<Product | null>(product);
  const [prodSearch,  setProdSearch]  = useState(product?.name ?? "");
  const [suppId,      setSuppId]      = useState(product?.supplier_id ?? "");
  const [batchNum,    setBatchNum]    = useState("");
  const [mfgDate,     setMfgDate]     = useState("");
  const [expDate,     setExpDate]     = useState("");
  const [qty,         setQty]         = useState("");
  const [costPrice,   setCostPrice]   = useState(product?.purchase_price?.toString() ?? "");
  const [mrp,         setMrp]         = useState(product?.mrp?.toString() ?? "");
  const [grnNum,      setGrnNum]      = useState(`GRN-${new Date().toISOString().slice(0,10).replace(/-/g,"")}`);
  const [suppInvoice, setSuppInvoice] = useState("");
  const [notes,       setNotes]       = useState("");
  const [saving,      setSaving]      = useState(false);

  const filteredProds = prodSearch.length > 0 && !selProduct
    ? products.filter(p => p.name.toLowerCase().includes(prodSearch.toLowerCase()) ||
        (p.brand ?? "").toLowerCase().includes(prodSearch.toLowerCase())).slice(0, 8)
    : [];

  const handleSave = async () => {
    if (!selProduct) { toast.error("Select a product"); return; }
    if (!batchNum.trim()) { toast.error("Batch number is required"); return; }
    const qtyN = parseInt(qty);
    if (!qtyN || qtyN <= 0) { toast.error("Enter a valid quantity"); return; }
    // H-6 fix: reject stock receipts with expired batches
    if (expDate) {
      const today = new Date().toISOString().split("T")[0];
      if (expDate < today) { toast.error("Expiry date cannot be in the past. Check the batch before receiving."); return; }
    }
    const costN = parseFloat(costPrice) || 0;

    setSaving(true);
    try {
      // Insert batch
      const { data: batch, error: bErr } = await supabase.from("inventory_batches").insert({
        clinic_id:          clinicId,
        product_id:         selProduct.id,
        supplier_id:        suppId || null,
        batch_number:       batchNum.trim(),
        manufacture_date:   mfgDate  || null,
        expiry_date:        expDate  || null,
        purchase_price:     costN,
        mrp:                mrp ? parseFloat(mrp) : null,
        quantity_received:  qtyN,
        quantity_remaining: qtyN,
        grn_number:         grnNum || null,
        supplier_invoice:   suppInvoice || null,
        received_by:        profile?.id ?? null,
        notes:              notes || null,
      }).select().single();
      if (bErr) throw bErr;

      // Insert movement
      await supabase.from("inventory_movements").insert({
        clinic_id:         clinicId,
        product_id:        selProduct.id,
        batch_id:          batch?.id ?? null,
        movement_type:     "receive",
        quantity:          qtyN,
        unit_cost:         costN,
        performed_by_name: profile?.full_name ?? null,
        notes:             notes || null,
      });

      await logAction({ action: "inventory_receive", targetId: selProduct.id, targetName: selProduct.name, metadata: { qty: qtyN, batch: batchNum } });
      toast.success(`Received ${qtyN} × ${selProduct.name}`);
      onClose(true);
    } catch (e: any) { toast.error(e.message ?? "Failed to receive stock"); }
    finally { setSaving(false); }
  };

  return (
    <Drawer title="Receive Stock (GRN)" icon={<Truck size={16} style={{ color: "#4A8A4A" }} />} onClose={() => onClose()}>
      <div className="space-y-4">
        {/* Product select */}
        <div>
          <DLabel>Product *</DLabel>
          {selProduct ? (
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
              style={{ background: "rgba(197,160,89,0.06)", border: "1px solid rgba(197,160,89,0.2)" }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{selProduct.name}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{selProduct.brand ?? selProduct.product_type}</p>
              </div>
              <button onClick={() => { setSelProduct(null); setProdSearch(""); setCostPrice(""); setMrp(""); setSuppId(""); }}
                style={{ color: "var(--text-muted)" }}><X size={14} /></button>
            </div>
          ) : (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input value={prodSearch} onChange={e => setProdSearch(e.target.value)} placeholder="Search product…"
                className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
              {filteredProds.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl shadow-xl max-h-44 overflow-y-auto"
                  style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
                  {filteredProds.map(p => (
                    <button key={p.id} onClick={() => { setSelProduct(p); setProdSearch(""); setCostPrice(p.purchase_price?.toString() ?? ""); setMrp(p.mrp?.toString() ?? ""); setSuppId(p.supplier_id ?? ""); }}
                      className="w-full text-left px-3 py-2.5 text-sm border-b"
                      style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(197,160,89,0.06)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}>
                      <span className="font-medium">{p.name}</span>
                      {p.brand && <span className="ml-1.5 text-xs" style={{ color: "var(--text-muted)" }}>{p.brand}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <DLabel>Supplier</DLabel>
          <select value={suppId} onChange={e => setSuppId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
            <option value="">— Select supplier —</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DField label="Batch Number *" value={batchNum} onChange={setBatchNum} placeholder="e.g. BT2024001" />
          <DField label="Quantity *"     value={qty}      onChange={setQty}      type="number" placeholder="0" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <DField label="Manufacture Date" value={mfgDate} onChange={setMfgDate} type="date" />
          <DField label="Expiry Date"       value={expDate} onChange={setExpDate} type="date" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <DField label="Purchase Price / Unit (₹)" value={costPrice} onChange={setCostPrice} type="number" placeholder="0" />
          <DField label="MRP (₹)"                   value={mrp}       onChange={setMrp}       type="number" placeholder="0" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <DField label="GRN Number"       value={grnNum}      onChange={setGrnNum}      placeholder="Auto-generated" />
          <DField label="Supplier Invoice" value={suppInvoice} onChange={setSuppInvoice} placeholder="e.g. INV-2024-001" />
        </div>
        <div>
          <DLabel>Notes</DLabel>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full px-3 py-2 rounded-xl text-sm resize-none outline-none"
            style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
        </div>

        {selProduct && qty && costPrice && (
          <div className="rounded-xl px-4 py-3" style={{ background: "rgba(74,138,74,0.06)", border: "1px solid rgba(74,138,74,0.2)" }}>
            <p className="text-xs font-semibold" style={{ color: "#2A5A2A" }}>Stock Receipt Summary</p>
            <p className="text-sm mt-1" style={{ color: "var(--foreground)" }}>
              {qty} × {selProduct.unit_of_measure} of <strong>{selProduct.name}</strong>
            </p>
            <p className="text-sm" style={{ color: "#4A8A4A", fontFamily: "Georgia, serif" }}>
              Total cost: {fmt(parseInt(qty || "0") * parseFloat(costPrice || "0"))}
            </p>
          </div>
        )}
      </div>
      <DrawerFooter onCancel={() => onClose()} onSave={handleSave} saving={saving} saveLabel="Receive Stock" />
    </Drawer>
  );
}

// ── Sale Drawer (Retail) ──────────────────────────────────────────────────────

function SaleDrawer({ product, clinicId, profile, onClose }: {
  product: Product; clinicId: string; profile: any; onClose: (refresh?: boolean) => void;
}) {
  const [patients,   setPatients]   = useState<PatientOpt[]>([]);
  const [patSearch,  setPatSearch]  = useState("");
  const [showPats,   setShowPats]   = useState(false);
  const [selPat,     setSelPat]     = useState<PatientOpt | null>(null);
  const [qty,        setQty]        = useState("1");
  const [sellPrice,  setSellPrice]  = useState(product.selling_price?.toString() ?? "");
  const [notes,      setNotes]      = useState("");
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    supabase.from("patients").select("id, full_name, phone").eq("clinic_id", clinicId).limit(200).then(({ data }) => setPatients(data ?? []));
  }, [clinicId]);

  const filtPats = patSearch.length > 0 ? patients.filter(p => p.full_name.toLowerCase().includes(patSearch.toLowerCase())).slice(0, 8) : [];
  const qtyN     = parseInt(qty) || 0;
  const priceN   = parseFloat(sellPrice) || 0;
  const subtotal = qtyN * priceN;
  const gstAmt   = Math.round(subtotal * (product.gst_rate / 100) * 100) / 100;
  const total    = subtotal + gstAmt;

  const handleSave = async () => {
    if (qtyN <= 0)   { toast.error("Enter a valid quantity"); return; }
    if (priceN <= 0) { toast.error("Enter a selling price"); return; }
    if (qtyN > product.current_stock) { toast.error(`Only ${product.current_stock} ${product.unit_of_measure} available`); return; }
    setSaving(true);
    try {
      // Create invoice
      const { data: inv } = await supabase.from("pending_invoices").insert({
        clinic_id:    clinicId,
        patient_id:   selPat?.id   ?? null,
        patient_name: selPat?.full_name ?? "Walk-in",
        service_name: `${product.name} × ${qtyN}`,
        amount:       subtotal,
        tax_amount:   gstAmt,
        total_amount: total,
        gst_pct:      product.gst_rate,
        status:       "pending",
        invoice_type: "retail_product",
        notes:        notes || null,
      }).select().single();

      // FIFO stock depletion
      await consumeFIFO({
        productId: product.id, clinicId, quantity: qtyN,
        movementType: "sale", sellingPrice: priceN, gstAmount: gstAmt,
        patientId: selPat?.id ?? null,
        invoiceId: inv?.id ?? null,
        notes: notes || null,
        performedByName: profile?.full_name ?? null,
      });

      await logAction({ action: "inventory_sale", targetId: product.id, targetName: product.name, metadata: { qty: qtyN, patient: selPat?.full_name } });
      toast.success(`Sold ${qtyN} × ${product.name}`);
      onClose(true);
    } catch (e: any) { toast.error(e.message ?? "Failed to record sale"); }
    finally { setSaving(false); }
  };

  return (
    <Drawer title="Record Retail Sale" icon={<ShoppingCart size={16} style={{ color: "var(--gold)" }} />} onClose={() => onClose()}>
      <div className="space-y-4">
        {/* Product chip */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(197,160,89,0.06)", border: "1px solid rgba(197,160,89,0.2)" }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(197,160,89,0.1)" }}>
            <ShoppingCart size={16} style={{ color: "var(--gold)" }} />
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{product.name}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Available: <strong style={{ color: product.current_stock > 0 ? "#4A8A4A" : "#DC2626" }}>{product.current_stock}</strong> {product.unit_of_measure}
            </p>
          </div>
        </div>

        {/* Patient */}
        <div>
          <DLabel>Patient (optional)</DLabel>
          {selPat ? (
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
              style={{ background: "rgba(197,160,89,0.06)", border: "1px solid rgba(197,160,89,0.2)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{selPat.full_name}</p>
              <button onClick={() => { setSelPat(null); setPatSearch(""); }} style={{ color: "var(--text-muted)" }}><X size={14} /></button>
            </div>
          ) : (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input value={patSearch} onChange={e => { setPatSearch(e.target.value); setShowPats(true); }} onFocus={() => setShowPats(true)}
                placeholder="Search patient…"
                className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
              {showPats && filtPats.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl shadow-xl max-h-44 overflow-y-auto"
                  style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
                  {filtPats.map(p => (
                    <button key={p.id} onClick={() => { setSelPat(p); setPatSearch(""); setShowPats(false); }}
                      className="w-full text-left px-3 py-2.5 text-sm border-b"
                      style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(197,160,89,0.06)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}>
                      {p.full_name}
                      {p.phone && <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>{p.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DField label="Quantity *"      value={qty}       onChange={setQty}       type="number" />
          <DField label="Selling Price ₹" value={sellPrice} onChange={setSellPrice} type="number" />
        </div>

        {/* Totals */}
        {qtyN > 0 && priceN > 0 && (
          <div className="rounded-xl px-4 py-3 space-y-1.5"
            style={{ background: "rgba(197,160,89,0.04)", border: "1px solid rgba(197,160,89,0.15)" }}>
            <div className="flex justify-between text-sm"><span style={{ color: "var(--text-muted)" }}>Subtotal</span><span>{fmt(subtotal)}</span></div>
            <div className="flex justify-between text-sm"><span style={{ color: "var(--text-muted)" }}>GST ({product.gst_rate}%)</span><span>{fmt(gstAmt)}</span></div>
            <div className="flex justify-between font-bold border-t pt-1.5" style={{ borderColor: "rgba(197,160,89,0.2)" }}>
              <span style={{ color: "var(--text-muted)" }}>Total</span>
              <span style={{ color: "var(--gold)", fontFamily: "Georgia, serif" }}>{fmt(total)}</span>
            </div>
          </div>
        )}

        <DField label="Notes" value={notes} onChange={setNotes} placeholder="Any remarks…" />
      </div>
      <DrawerFooter onCancel={() => onClose()} onSave={handleSave} saving={saving} saveLabel="Record Sale" />
    </Drawer>
  );
}

// ── Consume Drawer ────────────────────────────────────────────────────────────

function ConsumeDrawer({ product, clinicId, profile, onClose }: {
  product: Product; clinicId: string; profile: any; onClose: (refresh?: boolean) => void;
}) {
  const [qty,    setQty]    = useState("1");
  const [apptSearch, setApptSearch] = useState("");
  const [notes,  setNotes]  = useState("");
  const [saving, setSaving] = useState(false);

  const qtyN = parseInt(qty) || 0;

  const handleSave = async () => {
    if (qtyN <= 0) { toast.error("Enter a valid quantity"); return; }
    if (qtyN > product.current_stock) { toast.error(`Only ${product.current_stock} ${product.unit_of_measure} available`); return; }
    setSaving(true);
    try {
      await consumeFIFO({
        productId: product.id, clinicId, quantity: qtyN,
        movementType: "consume",
        unitCost: product.purchase_price ?? undefined,
        notes: notes || null,
        performedByName: profile?.full_name ?? null,
      });
      await logAction({ action: "inventory_consume", targetId: product.id, targetName: product.name, metadata: { qty: qtyN } });
      toast.success(`Logged consumption: ${qtyN} × ${product.name}`);
      onClose(true);
    } catch (e: any) { toast.error(e.message ?? "Failed to record consumption"); }
    finally { setSaving(false); }
  };

  return (
    <Drawer title="Record Consumption" icon={<FlaskConical size={16} style={{ color: "#7C3AED" }} />} onClose={() => onClose()}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.2)" }}>
          <FlaskConical size={20} style={{ color: "#7C3AED" }} />
          <div>
            <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{product.name}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Available: <strong style={{ color: product.current_stock > 0 ? "#4A8A4A" : "#DC2626" }}>{product.current_stock}</strong> {product.unit_of_measure}
              {product.storage_condition && ` · ${product.storage_condition}`}
            </p>
          </div>
        </div>

        <DField label="Quantity to Consume *" value={qty} onChange={setQty} type="number" placeholder="1" />

        <DField label="Appointment Reference (optional)" value={apptSearch} onChange={setApptSearch} placeholder="e.g. Patient name or appt ID" />

        <div>
          <DLabel>Notes</DLabel>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            placeholder="e.g. Used for Botox forehead treatment for patient…"
            className="w-full px-3 py-2 rounded-xl text-sm resize-none outline-none"
            style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
        </div>

        {qtyN > 0 && product.purchase_price && (
          <div className="rounded-xl px-4 py-3"
            style={{ background: "rgba(124,58,237,0.04)", border: "1px solid rgba(124,58,237,0.15)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>COGS for this consumption</p>
            <p className="text-lg font-bold mt-0.5" style={{ color: "#7C3AED", fontFamily: "Georgia, serif" }}>
              {fmt(qtyN * product.purchase_price)}
            </p>
          </div>
        )}
      </div>
      <DrawerFooter onCancel={() => onClose()} onSave={handleSave} saving={saving} saveLabel="Log Consumption" />
    </Drawer>
  );
}

// ── Adjust Drawer ─────────────────────────────────────────────────────────────

function AdjustDrawer({ product, batches, clinicId, profile, onClose }: {
  product: Product; batches: Batch[]; clinicId: string; profile: any; onClose: (refresh?: boolean) => void;
}) {
  type AdjType = "adjust_up" | "adjust_down" | "write_off" | "return";
  const [adjType, setAdjType] = useState<AdjType>("adjust_down");
  const [qty,     setQty]     = useState("1");
  const [batchId, setBatchId] = useState("");
  const [reason,  setReason]  = useState("");
  const [notes,   setNotes]   = useState("");
  const [saving,  setSaving]  = useState(false);

  const activeBatches = batches.filter(b => b.quantity_remaining > 0);
  const qtyN          = parseInt(qty) || 0;
  const isOut         = ["adjust_down","write_off"].includes(adjType);

  const ADJ_OPTS: { value: AdjType; label: string; desc: string; color: string }[] = [
    { value: "adjust_up",   label: "Adjust Up",          desc: "Add stock (count correction)",     color: "#059669" },
    { value: "adjust_down", label: "Adjust Down",         desc: "Remove stock (count correction)",  color: "#D97706" },
    { value: "write_off",   label: "Write Off",           desc: "Damaged, expired, or lost stock",  color: "#DC2626" },
    { value: "return",      label: "Return to Supplier",  desc: "Stock returned to vendor",         color: "#0891B2" },
  ];

  const handleSave = async () => {
    if (qtyN <= 0)     { toast.error("Enter a valid quantity"); return; }
    if (!reason.trim()) { toast.error("Reason is required"); return; }
    if (isOut && qtyN > product.current_stock) { toast.error(`Only ${product.current_stock} available`); return; }

    setSaving(true);
    try {
      if (isOut) {
        // Use FIFO or specific batch
        if (batchId) {
          const batch = activeBatches.find(b => b.id === batchId);
          if (!batch) throw new Error("Batch not found");
          if (batch.quantity_remaining < qtyN) throw new Error(`Batch only has ${batch.quantity_remaining} units`);
          await supabase.from("inventory_batches").update({ quantity_remaining: batch.quantity_remaining - qtyN }).eq("id", batch.id);
          await supabase.from("inventory_movements").insert({
            clinic_id: clinicId, product_id: product.id, batch_id: batch.id,
            movement_type: adjType, quantity: qtyN, reason: reason.trim(),
            unit_cost: batch.purchase_price, notes: notes || null,
            performed_by_name: profile?.full_name ?? null,
          });
        } else {
          await consumeFIFO({
            productId: product.id, clinicId, quantity: qtyN,
            movementType: adjType, reason: reason.trim(), notes: notes || null,
            performedByName: profile?.full_name ?? null,
          });
        }
      } else {
        // adjust_up or return: add stock to first available batch or create generic
        const b = activeBatches[0];
        if (b) {
          await supabase.from("inventory_batches").update({ quantity_remaining: b.quantity_remaining + qtyN }).eq("id", b.id);
          await supabase.from("inventory_movements").insert({
            clinic_id: clinicId, product_id: product.id, batch_id: b.id,
            movement_type: adjType, quantity: qtyN, reason: reason.trim(),
            notes: notes || null, performed_by_name: profile?.full_name ?? null,
          });
        } else {
          // No existing batch — create a new one
          const { data: newBatch } = await supabase.from("inventory_batches").insert({
            clinic_id: clinicId, product_id: product.id,
            batch_number: `ADJ-${Date.now().toString().slice(-6)}`,
            quantity_received: qtyN, quantity_remaining: qtyN, purchase_price: 0,
          }).select().single();
          await supabase.from("inventory_movements").insert({
            clinic_id: clinicId, product_id: product.id, batch_id: newBatch?.id ?? null,
            movement_type: adjType, quantity: qtyN, reason: reason.trim(),
            notes: notes || null, performed_by_name: profile?.full_name ?? null,
          });
        }
      }

      await logAction({ action: "inventory_adjust", targetId: product.id, targetName: product.name, metadata: { type: adjType, qty: qtyN, reason } });
      toast.success("Stock adjusted");
      onClose(true);
    } catch (e: any) { toast.error(e.message ?? "Failed to adjust stock"); }
    finally { setSaving(false); }
  };

  return (
    <Drawer title="Adjust Stock" icon={<TrendingDown size={16} style={{ color: "#D97706" }} />} onClose={() => onClose()}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: "var(--input-bg)", border: "1px solid var(--border)" }}>
          <Package size={18} style={{ color: "var(--gold)" }} />
          <div>
            <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{product.name}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Current: <strong>{product.current_stock}</strong> {product.unit_of_measure}</p>
          </div>
        </div>

        {/* Adjustment type */}
        <div>
          <DLabel>Adjustment Type *</DLabel>
          <div className="grid grid-cols-2 gap-2">
            {ADJ_OPTS.map(o => (
              <button key={o.value} onClick={() => setAdjType(o.value)}
                className="text-left px-3 py-2.5 rounded-xl transition-all"
                style={{
                  background: adjType === o.value ? `${o.color}14` : "var(--input-bg)",
                  border:     adjType === o.value ? `1px solid ${o.color}44` : "1px solid var(--border)",
                }}>
                <p className="text-xs font-semibold" style={{ color: adjType === o.value ? o.color : "var(--foreground)" }}>{o.label}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{o.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <DField label="Quantity *" value={qty} onChange={setQty} type="number" placeholder="1" />

        {/* Specific batch (optional for out movements) */}
        {isOut && activeBatches.length > 1 && (
          <div>
            <DLabel>Specific Batch (optional — defaults to FIFO)</DLabel>
            <select value={batchId} onChange={e => setBatchId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
              <option value="">Auto (FIFO by expiry)</option>
              {activeBatches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.batch_number} — {b.quantity_remaining} {product.unit_of_measure}{b.expiry_date ? ` · Exp: ${fmtD(b.expiry_date)}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <DField label="Reason *" value={reason} onChange={setReason} placeholder="e.g. Damaged during storage / Annual count correction" />

        <div>
          <DLabel>Notes</DLabel>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full px-3 py-2 rounded-xl text-sm resize-none outline-none"
            style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
        </div>
      </div>
      <DrawerFooter onCancel={() => onClose()} onSave={handleSave} saving={saving} saveLabel="Apply Adjustment" />
    </Drawer>
  );
}

// ── Shared UI atoms ───────────────────────────────────────────────────────────

function Drawer({ title, icon, children, onClose }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-[500px] h-full flex flex-col"
        style={{ background: "var(--card-bg)", borderLeft: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(197,160,89,0.1)" }}>
              {icon}
            </div>
            <p className="font-semibold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>{title}</p>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

function DrawerFooter({ onCancel, onSave, saving, saveLabel }: {
  onCancel: () => void; onSave: () => void; saving: boolean; saveLabel: string;
}) {
  return (
    <div className="flex gap-3 pt-5 mt-5 border-t sticky bottom-0" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
      <button onClick={onCancel} className="flex-1 py-3 rounded-xl text-sm font-semibold"
        style={{ background: "var(--input-bg)", color: "var(--foreground)", border: "1px solid var(--border)" }}>
        Cancel
      </button>
      <button onClick={onSave} disabled={saving}
        className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
        style={{ background: "var(--gold)", color: "#fff" }}>
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        {saving ? "Saving…" : saveLabel}
      </button>
    </div>
  );
}

function DField({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string | number; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div>
      <DLabel>{label}</DLabel>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
        style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
    </div>
  );
}

function DLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
      style={{ color: "var(--text-muted)" }}>{children}</label>
  );
}

function ActionBtn({ title, color, onClick, children }: {
  title: string; color: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} title={title}
      className="p-1.5 rounded-lg transition-colors hover:bg-black/5"
      style={{ color }}>
      {children}
    </button>
  );
}

// ── Import Drawer ─────────────────────────────────────────────────────────────

const IMPORT_TEMPLATE_HEADERS = [
  "name","brand","product_type","category","sku","hsn_code",
  "gst_rate","mrp","selling_price","purchase_price",
  "unit_of_measure","units_per_pack",
  "low_stock_threshold","reorder_quantity",
  "storage_condition","is_prescription","notes",
];

const IMPORT_TEMPLATE_EXAMPLE = [
  ["Vitamin C Serum 30ml","Obagi","retail","Serum","SKU-001","33049990","18","1800","1500","1000","piece","1","3","6","Cool & Dry","no","Brightening serum"],
  ["Botox 100U Vial","Allergan","consumable","Filler / Toxin","SKU-002","30049099","12","","","8500","vial","1","3","5","Refrigerate 2–8°C","yes","Reconstitute with NS"],
  ["Laser Handpiece","Lumenis","equipment","Handpiece","SKU-003","90189090","18","","","45000","piece","1","1","1","Service annually","no","CO2 10600nm"],
];

type ImportRow = {
  name: string; brand: string; product_type: string; category: string;
  sku: string; hsn_code: string; gst_rate: string;
  mrp: string; selling_price: string; purchase_price: string;
  unit_of_measure: string; units_per_pack: string;
  low_stock_threshold: string; reorder_quantity: string;
  storage_condition: string; is_prescription: string; notes: string;
  _valid: boolean; _error: string;
};

function parseCSV(text: string): ImportRow[] {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.replace(/"/g,"").trim().toLowerCase());
  return lines.slice(1).map(line => {
    const vals: string[] = [];
    let cur = ""; let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { vals.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    vals.push(cur.trim());

    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] ?? "").replace(/^"|"$/g, ""); });

    const name = obj["name"] ?? "";
    const pt   = obj["product_type"] ?? "";
    let error  = "";
    if (!name) error = "Name is required";
    else if (!["retail","consumable","equipment"].includes(pt)) error = `product_type must be retail/consumable/equipment (got: "${pt}")`;

    return {
      name,
      brand:              obj["brand"]              ?? "",
      product_type:       pt,
      category:           obj["category"]           ?? "",
      sku:                obj["sku"]                ?? "",
      hsn_code:           obj["hsn_code"]           ?? "",
      gst_rate:           obj["gst_rate"]           ?? "18",
      mrp:                obj["mrp"]                ?? "",
      selling_price:      obj["selling_price"]      ?? "",
      purchase_price:     obj["purchase_price"]     ?? "",
      unit_of_measure:    obj["unit_of_measure"]    ?? "piece",
      units_per_pack:     obj["units_per_pack"]     ?? "1",
      low_stock_threshold:obj["low_stock_threshold"]?? "5",
      reorder_quantity:   obj["reorder_quantity"]   ?? "10",
      storage_condition:  obj["storage_condition"]  ?? "",
      is_prescription:    obj["is_prescription"]    ?? "no",
      notes:              obj["notes"]              ?? "",
      _valid: !error,
      _error: error,
    };
  });
}

function ImportDrawer({ clinicId, suppliers, profile, onClose }: {
  clinicId: string;
  suppliers: Supplier[];
  profile: any;
  onClose: (refresh?: boolean) => void;
}) {
  const [step,    setStep]    = useState<"upload" | "preview" | "done">("upload");
  const [rows,    setRows]    = useState<ImportRow[]>([]);
  const [saving,  setSaving]  = useState(false);
  const [results, setResults] = useState<{ ok: number; fail: number }>({ ok: 0, fail: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const csv = [
      IMPORT_TEMPLATE_HEADERS.join(","),
      ...IMPORT_TEMPLATE_EXAMPLE.map(r => r.map(v => `"${v}"`).join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a   = document.createElement("a"); a.href = url; a.download = "inventory_import_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (!parsed.length) { toast.error("No valid rows found. Check file format."); return; }
      setRows(parsed);
      setStep("preview");
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const validRows   = rows.filter(r => r._valid);
  const invalidRows = rows.filter(r => !r._valid);

  const doImport = async () => {
    if (!validRows.length) return;
    setSaving(true);
    let ok = 0; let fail = 0;
    for (const r of validRows) {
      const { error } = await supabase.from("inventory_products").insert({
        clinic_id:            clinicId,
        name:                 r.name,
        brand:                r.brand     || null,
        sku:                  r.sku       || null,
        product_type:         r.product_type as ProductType,
        category:             r.category  || null,
        hsn_code:             r.hsn_code  || null,
        gst_rate:             parseFloat(r.gst_rate) || 18,
        mrp:                  r.mrp       ? parseFloat(r.mrp)           : null,
        selling_price:        r.selling_price  ? parseFloat(r.selling_price)  : null,
        purchase_price:       r.purchase_price ? parseFloat(r.purchase_price) : null,
        unit_of_measure:      r.unit_of_measure || "piece",
        units_per_pack:       parseInt(r.units_per_pack) || 1,
        low_stock_threshold:  parseInt(r.low_stock_threshold) || 5,
        reorder_quantity:     parseInt(r.reorder_quantity) || 10,
        storage_condition:    r.storage_condition || null,
        is_prescription:      ["yes","true","1"].includes(r.is_prescription.toLowerCase()),
        notes:                r.notes || null,
        is_active:            true,
      });
      if (error) fail++; else ok++;
    }
    setResults({ ok, fail });
    if (ok) await logAction({ action: "inventory_bulk_import", targetName: `${ok} products imported via CSV` });
    setSaving(false);
    setStep("done");
  };

  return (
    <Drawer title="Import Products" icon={<Upload size={16} style={{ color: "var(--gold)" }} />} onClose={() => onClose(step === "done")}>
      {step === "upload" && (
        <div className="space-y-5">
          {/* Template download */}
          <div className="rounded-xl p-4 flex items-start gap-3"
            style={{ background: "rgba(42,74,138,0.06)", border: "1px solid rgba(42,74,138,0.15)" }}>
            <FileText size={18} style={{ color: "#2A4A8A", flexShrink: 0, marginTop: 2 }} />
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                Download the CSV template
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Fill in your products using the provided template. Required columns: <strong>name</strong> and <strong>product_type</strong>.
              </p>
              <button onClick={downloadTemplate}
                className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: "rgba(42,74,138,0.1)", color: "#2A4A8A", border: "1px solid rgba(42,74,138,0.2)" }}>
                <Download size={11} /> Download Template
              </button>
            </div>
          </div>

          {/* Drop zone */}
          <div>
            <DLabel>Upload CSV File</DLabel>
            <div
              className="rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors"
              style={{ border: "2px dashed rgba(197,160,89,0.3)", minHeight: 160, background: "rgba(197,160,89,0.03)" }}
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "rgba(197,160,89,0.1)" }}>
                <Upload size={22} style={{ color: "var(--gold)" }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                  Drag & drop your CSV here
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  or click to browse
                </p>
              </div>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
          </div>

          {/* Column reference */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
              Supported Columns
            </p>
            <div className="grid grid-cols-2 gap-1">
              {IMPORT_TEMPLATE_HEADERS.map(h => (
                <div key={h} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded"
                  style={{ background: "var(--input-bg)", color: "var(--text-muted)" }}>
                  <Hash size={9} style={{ flexShrink: 0 }} />
                  {h}
                  {(h === "name" || h === "product_type") && (
                    <span className="ml-auto text-xs font-bold" style={{ color: "#DC2626" }}>*</span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
              <span style={{ color: "#DC2626" }}>*</span> required &nbsp;·&nbsp; product_type: retail / consumable / equipment
            </p>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-xl px-4 py-3"
              style={{ background: "rgba(74,138,74,0.07)", border: "1px solid rgba(74,138,74,0.2)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Valid</p>
              <p className="text-xl font-bold" style={{ color: "#2A5A2A" }}>{validRows.length}</p>
            </div>
            {invalidRows.length > 0 && (
              <div className="flex-1 rounded-xl px-4 py-3"
                style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Errors</p>
                <p className="text-xl font-bold" style={{ color: "#DC2626" }}>{invalidRows.length}</p>
              </div>
            )}
            <button onClick={() => setStep("upload")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
              style={{ background: "var(--input-bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
              <Upload size={11} /> Re-upload
            </button>
          </div>

          {/* Error rows */}
          {invalidRows.length > 0 && (
            <div className="rounded-xl overflow-hidden"
              style={{ border: "1px solid rgba(220,38,38,0.2)" }}>
              <div className="px-3 py-2 flex items-center gap-2"
                style={{ background: "rgba(220,38,38,0.06)" }}>
                <AlertCircle size={13} style={{ color: "#DC2626" }} />
                <p className="text-xs font-semibold" style={{ color: "#DC2626" }}>
                  Rows with errors (will be skipped)
                </p>
              </div>
              {invalidRows.map((r, i) => (
                <div key={i} className="px-3 py-2 border-t flex items-start gap-2"
                  style={{ borderColor: "rgba(220,38,38,0.1)" }}>
                  <X size={11} style={{ color: "#DC2626", flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <p className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                      {r.name || "(no name)"}
                    </p>
                    <p className="text-xs" style={{ color: "#DC2626" }}>{r._error}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Preview table */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
              Preview (first 10 valid rows)
            </p>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
                      {["Name","Brand","Type","Category","SKU","Unit","Purchase ₹","GST%"].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wider"
                          style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {validRows.slice(0, 10).map((r, i) => {
                      const tc = TYPE_CFG[r.product_type as ProductType] ?? TYPE_CFG.retail;
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td className="px-3 py-2 font-medium" style={{ color: "var(--foreground)" }}>{r.name}</td>
                          <td className="px-3 py-2" style={{ color: "var(--text-muted)" }}>{r.brand || "—"}</td>
                          <td className="px-3 py-2">
                            <span className="px-1.5 py-0.5 rounded text-xs font-semibold"
                              style={{ background: tc.bg, color: tc.color }}>{tc.label}</span>
                          </td>
                          <td className="px-3 py-2" style={{ color: "var(--text-muted)" }}>{r.category || "—"}</td>
                          <td className="px-3 py-2" style={{ color: "var(--text-muted)" }}>{r.sku || "—"}</td>
                          <td className="px-3 py-2" style={{ color: "var(--text-muted)" }}>{r.unit_of_measure}</td>
                          <td className="px-3 py-2" style={{ color: "var(--foreground)" }}>
                            {r.purchase_price ? `₹${parseFloat(r.purchase_price).toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="px-3 py-2" style={{ color: "var(--text-muted)" }}>{r.gst_rate}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {validRows.length > 10 && (
                  <p className="px-3 py-2 text-xs text-center" style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border)" }}>
                    +{validRows.length - 10} more rows will also be imported
                  </p>
                )}
              </div>
            </div>
          </div>

          <DrawerFooter
            saving={saving}
            saveLabel={`Import ${validRows.length} Product${validRows.length !== 1 ? "s" : ""}`}
            onSave={doImport}
            onCancel={() => onClose(false)}
          />
        </div>
      )}

      {step === "done" && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: results.fail === 0 ? "rgba(74,138,74,0.1)" : "rgba(197,160,89,0.1)" }}>
            <CheckCircle2 size={32} style={{ color: results.fail === 0 ? "#2A5A2A" : "var(--gold)" }} />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
              Import Complete
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {results.ok} product{results.ok !== 1 ? "s" : ""} imported successfully
              {results.fail > 0 ? `, ${results.fail} failed` : ""}
            </p>
          </div>
          <button onClick={() => onClose(true)}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--gold)", color: "#fff" }}>
            Done
          </button>
        </div>
      )}
    </Drawer>
  );
}
