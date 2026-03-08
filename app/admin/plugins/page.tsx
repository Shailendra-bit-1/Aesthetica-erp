"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import { Puzzle, Plus, X, Check, Shield, Settings, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

interface PluginRegistry {
  plugin_key: string;
  name: string;
  description: string | null;
  version: string;
  events: string[];
  is_verified: boolean;
  config_schema: Record<string, { type: string; label: string; required?: boolean; placeholder?: string }>;
}

interface ClinicPlugin {
  plugin_key: string;
  config: Record<string, string>;
  is_enabled: boolean;
  installed_at: string;
  plugin_registry: PluginRegistry | null;
}

export default function PluginsPage() {
  const { profile, activeClinicId } = useClinic();

  const [section, setSection] = useState<"marketplace" | "installed">("marketplace");
  const [marketplace, setMarketplace] = useState<PluginRegistry[]>([]);
  const [installed, setInstalled] = useState<ClinicPlugin[]>([]);
  const [loading, setLoading] = useState(true);

  const [configDrawer, setConfigDrawer] = useState<{ plugin: PluginRegistry; existing?: ClinicPlugin } | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const clinicId = activeClinicId || profile?.clinic_id;

  const fetchMarketplace = useCallback(async () => {
    const { data } = await supabase.from("plugin_registry").select("*").order("is_verified", { ascending: false });
    setMarketplace(data || []);
  }, [supabase]);

  const fetchInstalled = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase.from("clinic_plugins")
      .select("*, plugin_registry(*)")
      .eq("clinic_id", clinicId);
    setInstalled((data as ClinicPlugin[]) || []);
  }, [clinicId, supabase]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchMarketplace(), fetchInstalled()]).finally(() => setLoading(false));
  }, [fetchMarketplace, fetchInstalled]);

  const isInstalled = (pluginKey: string) => installed.some(p => p.plugin_key === pluginKey);

  const openInstall = (plugin: PluginRegistry) => {
    const existing = installed.find(p => p.plugin_key === plugin.plugin_key);
    setConfigValues(existing?.config || {});
    setConfigDrawer({ plugin, existing });
  };

  const savePlugin = async () => {
    if (!clinicId || !configDrawer) return;
    setSaving(true);
    const { plugin } = configDrawer;
    await supabase.from("clinic_plugins").upsert({
      clinic_id: clinicId, plugin_key: plugin.plugin_key,
      config: configValues, is_enabled: true,
    }, { onConflict: "clinic_id,plugin_key" });
    setSaving(false);
    setConfigDrawer(null);
    fetchInstalled();
  };

  const togglePlugin = async (pluginKey: string, is_enabled: boolean) => {
    if (!clinicId) return;
    await supabase.from("clinic_plugins").update({ is_enabled: !is_enabled })
      .eq("clinic_id", clinicId).eq("plugin_key", pluginKey);
    fetchInstalled();
  };

  const uninstallPlugin = async (pluginKey: string) => {
    if (!clinicId || !confirm("Uninstall this plugin?")) return;
    await supabase.from("clinic_plugins").delete()
      .eq("clinic_id", clinicId).eq("plugin_key", pluginKey);
    fetchInstalled();
  };

  const configSchema = configDrawer?.plugin.config_schema || {};
  const schemaEntries = Object.entries(configSchema) as Array<[string, { type: string; label: string; required?: boolean; placeholder?: string }]>;

  return (
    <div className="flex flex-col h-screen" style={{ background: "#F9F7F2" }}>


      <div className="flex-1 overflow-auto p-6">
        <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: "rgba(197,160,89,0.08)", border: "1px solid rgba(197,160,89,0.15)" }}>
          {(["marketplace", "installed"] as const).map(t => (
            <button key={t} onClick={() => setSection(t)}
              className="px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize"
              style={section === t ? { background: "var(--gold)", color: "#fff", fontFamily: "Georgia, serif" } : { color: "rgba(197,160,89,0.7)" }}>
              {t === "marketplace" ? "Marketplace" : `Installed (${installed.length})`}
            </button>
          ))}
        </div>

        {/* MARKETPLACE */}
        {section === "marketplace" && (
          <div>
            <h2 className="text-lg font-semibold mb-5" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Plugin Marketplace</h2>
            {loading ? (
              <div className="grid grid-cols-3 gap-4">
                {[1,2,3,4,5,6].map(n => <div key={n} className="h-48 rounded-xl animate-pulse" style={{ background: "rgba(197,160,89,0.06)" }} />)}
              </div>
            ) : marketplace.length === 0 ? (
              <div className="rounded-xl p-12 text-center" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
                <Puzzle size={40} className="mx-auto mb-3 opacity-20" style={{ color: "var(--gold)" }} />
                <p style={{ color: "#9ca3af" }}>No plugins available in the marketplace yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {marketplace.map(plugin => {
                  const isInst = isInstalled(plugin.plugin_key);
                  return (
                    <div key={plugin.plugin_key} className="rounded-xl p-5 flex flex-col"
                      style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: "rgba(197,160,89,0.12)" }}>
                            <Puzzle size={18} style={{ color: "var(--gold)" }} />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-sm" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>{plugin.name}</p>
                              {plugin.is_verified && (
                                <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "#2563eb" }}>
                                  <Check size={9} className="text-white" />
                                </div>
                              )}
                            </div>
                            <p className="text-xs" style={{ color: "#9ca3af" }}>v{plugin.version}</p>
                          </div>
                        </div>
                        {isInst && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(34,197,94,0.1)", color: "#16a34a" }}>Installed</span>
                        )}
                      </div>

                      {plugin.description && (
                        <p className="text-xs mb-3 flex-1 line-clamp-2" style={{ color: "#6b7280" }}>{plugin.description}</p>
                      )}

                      {plugin.events && plugin.events.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {plugin.events.slice(0, 3).map(e => (
                            <span key={e} className="text-xs px-1.5 py-0.5 rounded font-mono"
                              style={{ background: "rgba(197,160,89,0.06)", color: "var(--gold)", fontSize: 9 }}>{e}</span>
                          ))}
                          {plugin.events.length > 3 && <span className="text-xs" style={{ color: "#9ca3af" }}>+{plugin.events.length - 3}</span>}
                        </div>
                      )}

                      <button onClick={() => openInstall(plugin)}
                        className="w-full py-2 rounded-lg text-sm font-medium transition-all"
                        style={{
                          background: isInst ? "rgba(197,160,89,0.08)" : "var(--gold)",
                          color: isInst ? "var(--gold)" : "#fff",
                          border: isInst ? "1px solid rgba(197,160,89,0.2)" : "none",
                        }}>
                        {isInst ? "Configure" : "Install"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* INSTALLED */}
        {section === "installed" && (
          <div>
            <h2 className="text-lg font-semibold mb-5" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>Installed Plugins</h2>
            {installed.length === 0 ? (
              <div className="rounded-xl p-12 text-center" style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
                <Puzzle size={40} className="mx-auto mb-3 opacity-20" style={{ color: "var(--gold)" }} />
                <p style={{ color: "#9ca3af" }}>No plugins installed yet</p>
                <button onClick={() => setSection("marketplace")} className="mt-3 text-sm" style={{ color: "var(--gold)" }}>Browse Marketplace</button>
              </div>
            ) : (
              <div className="space-y-3">
                {installed.map(cp => {
                  const plugin = cp.plugin_registry;
                  return (
                    <div key={cp.plugin_key} className="rounded-xl p-4 flex items-center justify-between"
                      style={{ background: "#fff", border: "1px solid rgba(197,160,89,0.15)" }}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ background: "rgba(197,160,89,0.12)" }}>
                          <Puzzle size={18} style={{ color: "var(--gold)" }} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>
                              {plugin?.name || cp.plugin_key}
                            </p>
                            {plugin?.is_verified && (
                              <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "#2563eb" }}>
                                <Check size={9} className="text-white" />
                              </div>
                            )}
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>
                            Installed {new Date(cp.installed_at).toLocaleDateString("en-IN")}
                            {plugin?.version && ` · v${plugin.version}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 rounded-full font-medium"
                          style={{ background: cp.is_enabled ? "rgba(34,197,94,0.1)" : "rgba(107,114,128,0.1)", color: cp.is_enabled ? "#16a34a" : "#6b7280" }}>
                          {cp.is_enabled ? "Enabled" : "Disabled"}
                        </span>
                        <button onClick={() => plugin && openInstall(plugin as PluginRegistry)}
                          className="p-2 rounded-lg hover:bg-amber-50 transition-colors" title="Configure">
                          <Settings size={15} style={{ color: "var(--gold)" }} />
                        </button>
                        <button onClick={() => togglePlugin(cp.plugin_key, cp.is_enabled)}
                          className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title={cp.is_enabled ? "Disable" : "Enable"}>
                          {cp.is_enabled
                            ? <ToggleRight size={18} style={{ color: "#16a34a" }} />
                            : <ToggleLeft size={18} style={{ color: "#9ca3af" }} />}
                        </button>
                        <button onClick={() => uninstallPlugin(cp.plugin_key)}
                          className="p-2 rounded-lg hover:bg-red-50 transition-colors" title="Uninstall">
                          <Trash2 size={15} style={{ color: "#ef4444" }} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CONFIG DRAWER */}
      {configDrawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setConfigDrawer(null)} />
          <div className="w-[420px] h-full overflow-y-auto flex flex-col" style={{ background: "#fff" }}>
            <div className="flex justify-between items-center px-6 py-5" style={{ borderBottom: "1px solid rgba(197,160,89,0.15)" }}>
              <div>
                <h3 className="text-lg font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714" }}>
                  {configDrawer.existing ? "Configure" : "Install"} {configDrawer.plugin.name}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>v{configDrawer.plugin.version}</p>
              </div>
              <button onClick={() => setConfigDrawer(null)} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="flex-1 p-6 space-y-4">
              {configDrawer.plugin.description && (
                <p className="text-sm" style={{ color: "#6b7280" }}>{configDrawer.plugin.description}</p>
              )}

              {schemaEntries.length > 0 ? (
                schemaEntries.map(([key, schema]) => (
                  <div key={key}>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "#4b5563" }}>
                      {schema.label} {schema.required && <span style={{ color: "#ef4444" }}>*</span>}
                    </label>
                    <input
                      type={schema.type === "password" ? "password" : "text"}
                      value={configValues[key] || ""}
                      onChange={e => setConfigValues(v => ({ ...v, [key]: e.target.value }))}
                      placeholder={schema.placeholder || ""}
                      className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                      style={{ borderColor: "rgba(197,160,89,0.3)" }}
                    />
                  </div>
                ))
              ) : (
                <div className="rounded-lg p-4 text-center" style={{ background: "rgba(197,160,89,0.04)", border: "1px solid rgba(197,160,89,0.12)" }}>
                  <p className="text-sm" style={{ color: "#9ca3af" }}>This plugin has no configuration options</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 flex gap-3" style={{ borderTop: "1px solid rgba(197,160,89,0.15)" }}>
              <button onClick={() => setConfigDrawer(null)} className="flex-1 px-4 py-2 rounded-lg text-sm border" style={{ borderColor: "rgba(197,160,89,0.2)", color: "#6b7280" }}>Cancel</button>
              <button onClick={savePlugin} disabled={saving}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "var(--gold)" }}>{saving ? "Saving…" : configDrawer.existing ? "Save Config" : "Install Plugin"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
