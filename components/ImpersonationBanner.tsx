"use client";

import { Eye, X, ArrowLeft } from "lucide-react";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useClinic } from "@/contexts/ClinicContext";

export default function ImpersonationBanner() {
  const { impersonating, stopImpersonation } = useImpersonation();
  const { profile } = useClinic();

  // Only superadmin sees this; only show when actively impersonating
  if (!impersonating || profile?.role !== "superadmin") return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
      background: "linear-gradient(90deg, #1C0A00, #3A1800)",
      borderBottom: "2px solid #C5A059",
      padding: "8px 24px",
      display: "flex", alignItems: "center", gap: 12,
      boxShadow: "0 2px 20px rgba(197,160,89,0.3)",
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: "rgba(197,160,89,0.2)", border: "1px solid rgba(197,160,89,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <Eye size={14} style={{ color: "#C5A059" }} />
      </div>

      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#C5A059", fontFamily: "Georgia, serif", letterSpacing: "0.04em" }}>
          God Mode — Viewing as:
        </span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", marginLeft: 8, fontFamily: "Georgia, serif" }}>
          {impersonating.clinicName}
        </span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginLeft: 10 }}>
          All actions are logged with your superadmin ID
        </span>
      </div>

      <button
        onClick={() => { stopImpersonation(); window.location.href = "/admin/god-mode"; }}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 14px", borderRadius: 8,
          border: "1px solid rgba(197,160,89,0.4)",
          background: "rgba(197,160,89,0.12)",
          cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#C5A059",
        }}
      >
        <ArrowLeft size={13} /> Exit View
      </button>
    </div>
  );
}
