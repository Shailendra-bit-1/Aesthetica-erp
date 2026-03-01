"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Sliders } from "lucide-react";

interface FieldDef {
  id: string;
  field_key: string;
  field_label: string;
  field_type: "text" | "number" | "date" | "dropdown" | "checkbox" | "textarea" | "phone" | "email";
  options: string[] | null;
  section_group: string | null;
  display_order: number;
  validation: { required?: boolean } | null;
}

interface CustomFieldsSectionProps {
  entityType: string;
  entityId: string;
  clinicId: string;
  readOnly?: boolean;
}

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid rgba(197,160,89,0.25)",
  fontSize: 12,
  fontFamily: "Georgia, serif",
  background: "#FDFCF9",
  outline: "none",
  boxSizing: "border-box",
};

export default function CustomFieldsSection({ entityType, entityId, clinicId, readOnly = false }: CustomFieldsSectionProps) {
  const [defs,    setDefs]    = useState<FieldDef[]>([]);
  const [values,  setValues]  = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clinicId || !entityId) { setLoading(false); return; }
    setLoading(true);
    const [{ data: defData }, { data: valData }] = await Promise.all([
      supabase
        .from("custom_field_definitions")
        .select("id, field_key, field_label, field_type, options, section_group, display_order, validation")
        .eq("clinic_id", clinicId)
        .eq("entity_type", entityType)
        .order("display_order"),
      supabase
        .from("custom_field_values")
        .select("field_key, value")
        .eq("clinic_id", clinicId)
        .eq("entity_type", entityType)
        .eq("entity_id", entityId),
    ]);
    setDefs((defData as FieldDef[]) ?? []);
    const map: Record<string, unknown> = {};
    for (const row of (valData ?? [])) {
      map[row.field_key] = row.value;
    }
    setValues(map);
    setLoading(false);
  }, [clinicId, entityId, entityType]);

  useEffect(() => { load(); }, [load]);

  const handleChange = async (fieldKey: string, val: unknown) => {
    setValues(prev => ({ ...prev, [fieldKey]: val }));
    // fire-and-forget upsert
    await supabase
      .from("custom_field_values")
      .upsert(
        { clinic_id: clinicId, entity_type: entityType, entity_id: entityId, field_key: fieldKey, value: val },
        { onConflict: "clinic_id,entity_type,entity_id,field_key" }
      );
  };

  if (loading) {
    return (
      <div style={{ padding: "12px 0" }}>
        {[1, 2].map(i => (
          <div key={i} style={{ height: 32, borderRadius: 8, background: "rgba(197,160,89,0.07)", marginBottom: 10, animation: "pulse 1.5s ease-in-out infinite" }} />
        ))}
      </div>
    );
  }

  if (defs.length === 0) {
    return (
      <div style={{ padding: "16px", textAlign: "center", background: "rgba(197,160,89,0.03)", borderRadius: 12, border: "1px dashed rgba(197,160,89,0.2)" }}>
        <Sliders size={18} style={{ color: "rgba(197,160,89,0.4)", margin: "0 auto 8px" }} />
        <p style={{ fontSize: 11, color: "#9C9584", margin: 0 }}>
          No custom fields defined — add them in <strong>Settings → Custom Fields</strong>.
        </p>
      </div>
    );
  }

  // Group fields by section_group
  const groups: { group: string | null; fields: FieldDef[] }[] = [];
  for (const def of defs) {
    const existing = groups.find(g => g.group === (def.section_group ?? null));
    if (existing) {
      existing.fields.push(def);
    } else {
      groups.push({ group: def.section_group ?? null, fields: [def] });
    }
  }

  const renderInput = (def: FieldDef) => {
    const val = values[def.field_key];
    const commonProps = {
      disabled: readOnly,
      style: { ...INPUT_STYLE, opacity: readOnly ? 0.6 : 1 },
    };

    switch (def.field_type) {
      case "textarea":
        return (
          <textarea
            {...commonProps}
            value={(val as string) ?? ""}
            rows={2}
            onChange={e => handleChange(def.field_key, e.target.value)}
            style={{ ...commonProps.style, resize: "vertical" as const, minHeight: 60 }}
          />
        );
      case "checkbox":
        return (
          <button
            disabled={readOnly}
            onClick={() => handleChange(def.field_key, !(val as boolean))}
            style={{
              position: "relative", display: "inline-flex", height: 20, width: 36,
              alignItems: "center", borderRadius: 9999, border: "none", cursor: readOnly ? "not-allowed" : "pointer",
              background: (val as boolean) ? "var(--gold, #C5A059)" : "rgba(197,160,89,0.2)",
              flexShrink: 0,
            }}
          >
            <span style={{
              display: "inline-block", height: 16, width: 16, borderRadius: "50%",
              background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              transition: "transform 0.15s",
              transform: (val as boolean) ? "translateX(18px)" : "translateX(2px)",
            }} />
          </button>
        );
      case "dropdown":
        return (
          <select
            {...commonProps}
            value={(val as string) ?? ""}
            onChange={e => handleChange(def.field_key, e.target.value)}
          >
            <option value="">— select —</option>
            {(def.options ?? []).map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case "number":
        return (
          <input
            {...commonProps}
            type="number"
            value={(val as number) ?? ""}
            onChange={e => handleChange(def.field_key, e.target.value === "" ? null : Number(e.target.value))}
          />
        );
      case "date":
        return (
          <input
            {...commonProps}
            type="date"
            value={(val as string) ?? ""}
            onChange={e => handleChange(def.field_key, e.target.value)}
          />
        );
      case "phone":
        return (
          <input
            {...commonProps}
            type="tel"
            value={(val as string) ?? ""}
            onChange={e => handleChange(def.field_key, e.target.value)}
          />
        );
      case "email":
        return (
          <input
            {...commonProps}
            type="email"
            value={(val as string) ?? ""}
            onChange={e => handleChange(def.field_key, e.target.value)}
          />
        );
      default: // text
        return (
          <input
            {...commonProps}
            type="text"
            value={(val as string) ?? ""}
            onChange={e => handleChange(def.field_key, e.target.value)}
          />
        );
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {groups.map(({ group, fields }) => (
        <div key={group ?? "__ungrouped"}>
          {group && (
            <p style={{ fontSize: 10, fontWeight: 700, color: "#9C9584", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>
              {group}
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {fields.map(def => (
              <div key={def.field_key}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6B5C2E", marginBottom: 4 }}>
                  {def.field_label}
                  {def.validation?.required && <span style={{ color: "#dc2626", marginLeft: 3 }}>*</span>}
                </label>
                {renderInput(def)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
