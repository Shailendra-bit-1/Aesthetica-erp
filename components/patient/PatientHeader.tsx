"use client";

import { ArrowLeft, Phone, Mail, Eye, EyeOff, Shield, Calendar, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { Patient, FITZPATRICK, TIER_CONFIG, calcAge, maskPhone, maskEmail } from "./types";

interface PatientHeaderProps {
  patient: Patient;
  activeTab: string;
  tabs: { key: string; label: string; icon: React.ElementType }[];
  onTabChange: (key: string) => void;
  privacyMode: boolean;
  onTogglePrivacy: () => void;
}

export default function PatientHeader({
  patient, activeTab, tabs, onTabChange, privacyMode, onTogglePrivacy,
}: PatientHeaderProps) {
  const router = useRouter();
  const fitz = FITZPATRICK[patient.fitzpatrick_type ?? 0];
  const tier = TIER_CONFIG[patient.patient_tier ?? "standard"] ?? TIER_CONFIG.standard;
  const age  = calcAge(patient.date_of_birth);

  return (
    <div style={{ position: "sticky", top: 0, zIndex: 30, background: "#FFFFFF", borderBottom: "1px solid rgba(197,160,89,0.2)", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
      {/* Privacy mode banner */}
      {privacyMode && (
        <div style={{ background: "rgba(245,158,11,0.1)", borderBottom: "1px solid rgba(245,158,11,0.3)", padding: "6px 24px", display: "flex", alignItems: "center", gap: 8 }}>
          <Shield size={13} color="#D97706" />
          <span style={{ fontSize: 12, color: "#92400E", fontWeight: 600, fontFamily: "Georgia, serif" }}>
            Privacy Mode Active — Contact &amp; financial data is hidden
          </span>
        </div>
      )}

      {/* Patient identity row */}
      <div style={{ padding: "14px 24px 10px", display: "flex", alignItems: "center", gap: 16 }}>
        {/* Back button */}
        <button
          onClick={() => router.push("/patients")}
          style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(197,160,89,0.3)", background: "rgba(197,160,89,0.06)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
        >
          <ArrowLeft size={14} color="#C5A059" />
        </button>

        {/* Avatar */}
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg, #C5A059, #A8853A)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 8px rgba(197,160,89,0.3)" }}>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 16, fontFamily: "Georgia, serif" }}>
            {patient.full_name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
          </span>
        </div>

        {/* Name + badges */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, fontFamily: "Georgia, serif", color: "#1C1917", margin: 0 }}>
              {patient.full_name}
            </h1>
            {age && <span style={{ fontSize: 12, color: "#6B7280", background: "rgba(120,130,140,0.1)", padding: "1px 8px", borderRadius: 999 }}>{age}</span>}
            {/* Fitzpatrick badge */}
            {fitz && (
              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: fitz.bg, color: fitz.text, border: `1px solid ${fitz.border}` }}>
                FST {fitz.label}
              </span>
            )}
            {/* Loyalty tier */}
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: tier.bg, color: tier.text, border: `1px solid ${tier.border}`, letterSpacing: "0.05em" }}>
              {tier.label}
            </span>
            {/* Allergy alert */}
            {patient.allergies && patient.allergies.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(220,38,38,0.1)", color: "#DC2626", border: "1px solid rgba(220,38,38,0.3)", letterSpacing: "0.04em" }}>
                ⚠ ALLERGY
              </span>
            )}
          </div>

          {/* Contact row */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 4 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#6B7280" }}>
              <Phone size={11} />
              {privacyMode ? maskPhone(patient.phone) : patient.phone}
            </span>
            {patient.email && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#6B7280" }}>
                <Mail size={11} />
                {privacyMode ? maskEmail(patient.email) : patient.email}
              </span>
            )}
            {patient.date_of_birth && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#6B7280" }}>
                <Calendar size={11} />
                {new Date(patient.date_of_birth).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
            {patient.primary_concern && patient.primary_concern[0] && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#C5A059" }}>
                <Sparkles size={11} />
                {patient.primary_concern[0]}
              </span>
            )}
          </div>
        </div>

        {/* Privacy mode toggle */}
        <button
          onClick={onTogglePrivacy}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 14px", borderRadius: 10, cursor: "pointer", flexShrink: 0,
            border: privacyMode ? "1px solid rgba(245,158,11,0.5)" : "1px solid rgba(197,160,89,0.3)",
            background: privacyMode ? "rgba(245,158,11,0.1)" : "rgba(197,160,89,0.06)",
            color: privacyMode ? "#D97706" : "#C5A059",
            fontFamily: "Georgia, serif", fontWeight: 600, fontSize: 12,
            transition: "all 0.2s",
          }}
        >
          {privacyMode ? <EyeOff size={13} /> : <Eye size={13} />}
          {privacyMode ? "Exit Privacy" : "Privacy Mode"}
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ paddingLeft: 24, paddingRight: 24, display: "flex", gap: 2, overflowX: "auto", scrollbarWidth: "none" }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "8px 14px", borderRadius: "8px 8px 0 0",
                border: "none", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                fontFamily: "Georgia, serif", fontWeight: active ? 700 : 400, fontSize: 12,
                background: active ? "rgba(197,160,89,0.12)" : "transparent",
                color: active ? "#C5A059" : "#6B7280",
                borderBottom: active ? "2px solid #C5A059" : "2px solid transparent",
                transition: "all 0.15s",
              }}
            >
              <Icon size={12} style={{ flexShrink: 0 }} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
