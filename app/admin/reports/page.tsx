"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import TopBar from "@/components/TopBar";
import { BarChart2, Plus, X, Save, Download, ChevronRight, Trash2, Filter, ArrowUpDown } from "lucide-react";

type BaseEntity = "patients" | "appointments" | "invoices" | "staff" | "inventory";

interface ReportDefinition {
  id: string;
  name: string;
  base_entity: BaseEntity;
  columns: Array<{ field: string; label: string; sortable?: boolean }>;
  filters: Array<{ field: string; operator: string; value: unknown }>;
  default_sort: { field: string; direction: "asc" | "desc" } | null;
  chart_config: { type: string; x_field: string; y_field: string } | null;
  is_active: boolean;
  created_at: string;
}

const ENTITY_FIELDS: Record<BaseEntity, Array<{ field: string; label: string }>> = {
  patients: [
    { field: "full_name", label: "Full Name" }, { field: "phone", label: "Phone" },
    { field: "email", label: "Email" }, { field: "date_of_birth", label: "Date of Birth" },
    { field: "fitzpatrick_type", label: "Fitzpatrick Type" }, { field: "wallet_balance", label: "Wallet Balance" },
    { field: "created_at", label: "Created Date" },
  ],
  appointments: [
    { field: "start_time", label: "Start Time" }, { field: "end_time", label: "End Time" },
    { field: "status", label: "Status" }, { field: "notes", label: "Notes" },
  ],
  invoices: [
    { field: "invoice_number", label: "Invoice #" }, { field: "patient_name", label: "Patient" },
    { field: "total_amount", label: "Total" }, { field: "status", label: "Status" },
    { field: "payment_mode", label: "Payment Mode" }, { field: "created_at", label: "Date" },
  ],
  staff: [
    { field: "full_name", label: "Full Name" }, { field: "role", label: "Role" },
    { field: "is_active", label: "Active" }, { field: "created_at", label: "Joined" },
  ],
  inventory: [
    { field: "name", label: "Item Name" }, { field: "category", label: "Category" },
    { field: "quantity", label: "Quantity" }, { field: "unit", label: "Unit" },
  ],
};

const OPERATORS = ["eq", "neq", "gt", "lt", "contains", "is_null"];
const ENTITY_LABELS: Record<BaseEntity, string> = {
  patients: "Patients", appointments: "Appointments", invoices: "Invoices",
  staff: "Staff", inventory: "Inventory",
};

export default function ReportsPage() {
  const { profile, activeClinicId } = useClinic();

  const [reports, setReports] = useState<ReportDefinition[]>([]);
  const [selected, setSelected] = useState<ReportDefinition | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewData, setPreviewData] = useState<Record<string, unknown>[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [form, setForm] = useState({
    name: "", base_entity: "patients" as BaseEntity,
    columns: [] as Array<{ field: string; label: string }>,
    filters: [] as Array<{ field: string; operator: string; value: string }>,
  });

  const clinicId = activeClinicId || profile?.clinic_id;

  const fetchReports = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase.from("report_definitions").select("*")
      .eq("clinic_id", clinicId).order("created_at", { ascending: false });
    setReports((data as ReportDefinition[]) || []);
  }, [clinicId, supabase]);

  useEffect(() => {
    if (!clinicId) return;
    setLoading(true);
    fetchReports().finally(() => setLoading(false));
  }, [clinicId, fetchReports]);

  const TABLE_MAP: Record<BaseEntity, string> = {
    patients: "patients", appointments: "appointments",
    invoices: "pending_invoices", staff: "profiles", inventory: "inventory_items",
  };

  const runPreview = useCallback(async () => {
    if (!clinicId || form.columns.length === 0) return;
    setPreviewLoading(true);
    const table = TABLE_MAP[form.base_entity];
    const fields = form.columns.map(c => c.field).join(",");
    try {
      let query = supabase.from(table).select(fields).eq("clinic_id", clinicId).limit(20);
      const { data } = await query;
      setPreviewData((data as Record<string, unknown>[] | null) || []);
    } catch { setPreviewData([]); }
    setPreviewLoading(false);
  }, [clinicId, form.columns, form.base_entity, supabase]);

  const saveReport = async () => {
    if (!clinicId || !form.name || form.columns.length === 0) return;
    setSaving(true);
    const payload = {
      clinic_id: clinicId, name: form.name, base_entity: form.base_entity,
      columns: form.columns, filters: form.filters, created_by: profile?.id,
    };
    if (selected?.id) {
      await supabase.from("report_definitions").update(payload).eq("id", selected.id);
    } else {
      await supabase.from("report_definitions").insert(payload);
    }
    setSaving(false);
    setCreating(false);
    setSelected(null);
    fetchReports();
  };

  const deleteReport = async (id: string) => {
    if (!confirm("Delete this report?")) return;
    await supabase.from("report_definitions").delete().eq("id", id);
    if (selected?.id === id) setSelected(null);
    fetchReports();
  };

  const startNew = () => {
    setSelected(null);
    setForm({ name: "", base_entity: "patients", columns: [], filters: [] });
    setPreviewData([]);
    setCreating(true);
  };

  const loadReport = (r: ReportDefinition) => {
    setSelected(r);
    setForm({ name: r.name, base_entity: r.base_entity, columns: r.columns, filters: r.filters.map(f => ({ ...f, value: String(f.value) })) });
    setCreating(true);
    setPreviewData([]);
  };

  const addColumn = (field: string, label: string) => {
    if (form.columns.find(c => c.field === field)) return;
    setForm(f => ({ ...f, columns: [...f.columns, { field, label }] }));
  };

  const removeColumn = (field: string) => setForm(f => ({ ...f, columns: f.columns.filter(c => c.field !== field) }));

  const exportCSV = () => {
    if (!previewData.length) return;
    const headers = form.columns.map(c => c.label).join(",");
    const rows = previewData.map(row => form.columns.map(c => JSON.stringify(row[c.field] ?? "")).join(",")).join("\n");
    const blob = new Blob([headers + "\n" + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${form.name || "report"}.csv`; a.click();
  };

  const availableFields = ENTITY_FIELDS[form.base_entity] || [];

  return (
    <div className="flex flex-col h-screen" style={{ background: "#F9F7F2" }}>
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL — Saved Reports */}
        <div className="w-72 flex-shrink-0 flex flex-col" style={{ background: "#fff", borderRight: "1px solid rgba(197,160,89,0.15)" }}>
          <div className="flex justify-between items-center px-4 py-4" style={{ borderBottom: "1px solid rgba(197,160,89,0.1)" }}>
            <h3 className="font-semibold text-sm" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Saved Reports</h3>
            <button onClick={startNew} className="p-1.5 rounded-lg hover:bg-amber-50 transition-colors">
              <Plus size={16} style={{ color: "var(--gold)" }} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-2 animate-pulse">
                {[1,2,3].map(n => <div key={n} className="h-14 rounded-lg" style={{ background: "rgba(197,160,89,0.06)" }} />)}
              </div>
            ) : reports.length === 0 ? (
              <div className="p-6 text-center" style={{ color: "#9ca3af" }}>
                <BarChart2 size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No reports yet</p>
              </div>
            ) : reports.map(r => (
              <button key={r.id} onClick={() => loadReport(r)}
                className="w-full text-left px-4 py-3 flex items-center justify-between transition-colors hover:bg-amber-50/50"
                style={{ borderBottom: "1px solid rgba(197,160,89,0.06)", background: selected?.id === r.id ? "rgba(197,160,89,0.06)" : "transparent" }}>
                <div className="flex-1 min-w-0 mr-2">
                  <p className="text-sm font-medium truncate" style={{ color: "#1a1714", fontFamily: "Georgia, serif" }}>{r.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>{ENTITY_LABELS[r.base_entity]} · {r.columns.length} columns</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={e => { e.stopPropagation(); deleteReport(r.id); }} className="p-1 hover:bg-red-50 rounded transition-colors">
                    <Trash2 size={12} style={{ color: "#ef4444" }} />
                  </button>
                  <ChevronRight size={14} style={{ color: "#9ca3af" }} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL — Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!creating ? (
            <div className="flex-1 flex items-center justify-center" style={{ color: "rgba(197,160,89,0.4)" }}>
              <div className="text-center">
                <BarChart2 size={48} className="mx-auto mb-3 opacity-30" />
                <p style={{ fontFamily: "Georgia, serif" }}>Select a report or create a new one</p>
                <button onClick={startNew} className="mt-4 px-6 py-2 rounded-lg text-sm font-medium text-white"
                  style={{ background: "var(--gold)" }}>New Report</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(197,160,89,0.1)", background: "#fff" }}>
                <div className="flex items-center gap-4">
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Report Name" className="text-lg font-semibold border-b outline-none bg-transparent"
                    style={{ color: "#1a1714", fontFamily: "Georgia, serif", borderColor: "rgba(197,160,89,0.3)", paddingBottom: 2 }} />
                  <select value={form.base_entity} onChange={e => setForm(f => ({ ...f, base_entity: e.target.value as BaseEntity, columns: [] }))}
                    className="text-sm px-3 py-1.5 rounded-lg border bg-white outline-none"
                    style={{ borderColor: "rgba(197,160,89,0.3)" }}>
                    {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={exportCSV} disabled={!previewData.length}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border disabled:opacity-40"
                    style={{ borderColor: "rgba(197,160,89,0.3)", color: "var(--gold)" }}>
                    <Download size={14} /> CSV
                  </button>
                  <button onClick={saveReport} disabled={saving || !form.name || form.columns.length === 0}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                    style={{ background: "var(--gold)" }}>
                    <Save size={14} /> {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>

              <div className="flex flex-1 overflow-hidden">
                {/* Column Picker */}
                <div className="w-56 flex-shrink-0 overflow-y-auto p-4" style={{ borderRight: "1px solid rgba(197,160,89,0.1)", background: "#faf9f6" }}>
                  <p className="text-xs font-medium mb-3" style={{ color: "rgba(197,160,89,0.8)", letterSpacing: "0.05em" }}>AVAILABLE FIELDS</p>
                  {availableFields.map(f => {
                    const isAdded = form.columns.find(c => c.field === f.field);
                    return (
                      <button key={f.field} onClick={() => isAdded ? removeColumn(f.field) : addColumn(f.field, f.label)}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm mb-1 flex items-center justify-between transition-all"
                        style={{
                          background: isAdded ? "rgba(197,160,89,0.12)" : "transparent",
                          color: isAdded ? "var(--gold)" : "#4b5563",
                          border: isAdded ? "1px solid rgba(197,160,89,0.2)" : "1px solid transparent",
                        }}>
                        <span>{f.label}</span>
                        {isAdded && <X size={12} />}
                      </button>
                    );
                  })}
                </div>

                {/* Preview */}
                <div className="flex-1 flex flex-col overflow-hidden p-4">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-xs font-medium" style={{ color: "rgba(197,160,89,0.8)", letterSpacing: "0.05em" }}>
                      SELECTED: {form.columns.length} columns
                    </p>
                    <button onClick={runPreview} disabled={form.columns.length === 0 || previewLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                      style={{ background: "rgba(197,160,89,0.1)", color: "var(--gold)" }}>
                      {previewLoading ? "Running…" : "▶ Run Preview"}
                    </button>
                  </div>

                  {form.columns.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center rounded-xl" style={{ background: "rgba(197,160,89,0.04)", border: "1px dashed rgba(197,160,89,0.15)" }}>
                      <p className="text-sm" style={{ color: "#9ca3af" }}>Add columns from the left panel</p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-auto rounded-xl" style={{ border: "1px solid rgba(197,160,89,0.15)" }}>
                      <table className="w-full text-sm" style={{ background: "#fff" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid rgba(197,160,89,0.1)", background: "rgba(197,160,89,0.04)" }}>
                            {form.columns.map(c => (
                              <th key={c.field} className="px-3 py-2.5 text-left text-xs font-medium"
                                style={{ color: "rgba(197,160,89,0.7)", letterSpacing: "0.05em" }}>
                                {c.label.toUpperCase()}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewLoading ? (
                            <tr><td colSpan={form.columns.length} className="px-3 py-8 text-center text-sm" style={{ color: "#9ca3af" }}>Loading…</td></tr>
                          ) : previewData.length === 0 ? (
                            <tr><td colSpan={form.columns.length} className="px-3 py-8 text-center text-sm" style={{ color: "#9ca3af" }}>Click "Run Preview" to see data</td></tr>
                          ) : previewData.map((row, i) => (
                            <tr key={i} style={{ borderBottom: "1px solid rgba(197,160,89,0.06)" }}>
                              {form.columns.map(c => (
                                <td key={c.field} className="px-3 py-2.5 text-sm" style={{ color: "#4b5563" }}>
                                  {String(row[c.field] ?? "—")}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
