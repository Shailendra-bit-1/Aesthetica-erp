"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  LayoutDashboard, Stethoscope, Layers, Image, FileText,
  Clipboard, CreditCard, Wallet, Pill, Calendar, MessageCircle, TrendingUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { logAction } from "@/lib/audit";
import PatientHeader from "@/components/patient/PatientHeader";
import OverviewTab from "@/components/patient/tabs/OverviewTab";
import EMRTab from "@/components/patient/tabs/EMRTab";
import ChartingTab from "@/components/patient/tabs/ChartingTab";
import GalleryTab from "@/components/patient/tabs/GalleryTab";
import DocumentsTab from "@/components/patient/tabs/DocumentsTab";
import TreatmentsTab from "@/components/patient/tabs/TreatmentsTab";
import BillingTab from "@/components/patient/tabs/BillingTab";
import WalletTab from "@/components/patient/tabs/WalletTab";
import PrescriptionsTab from "@/components/patient/tabs/PrescriptionsTab";
import AppointmentsTab from "@/components/patient/tabs/AppointmentsTab";
import CommunicationsTab from "@/components/patient/tabs/CommunicationsTab";
import MarketingTab from "@/components/patient/tabs/MarketingTab";
import { Patient, MedicalHistory, Encounter, PatientNote, Treatment } from "@/components/patient/types";

// ─────────────────────── Tab config ──────────────────────────────────────────

const TABS = [
  { key: "overview",        label: "Overview",        icon: LayoutDashboard  },
  { key: "emr",             label: "EMR",             icon: Stethoscope      },
  { key: "charting",        label: "Charting",        icon: Layers           },
  { key: "gallery",         label: "Gallery",         icon: Image            },
  { key: "documents",       label: "Documents",       icon: FileText         },
  { key: "treatments",      label: "Treatments",      icon: Clipboard        },
  { key: "billing",         label: "Billing",         icon: CreditCard       },
  { key: "wallet",          label: "Wallet",          icon: Wallet           },
  { key: "prescriptions",   label: "Prescriptions",   icon: Pill             },
  { key: "appointments",    label: "Appointments",    icon: Calendar         },
  { key: "communications",  label: "Communications",  icon: MessageCircle    },
  { key: "marketing",       label: "Marketing",       icon: TrendingUp       },
] as const;

type TabKey = typeof TABS[number]["key"];

// ─────────────────────── API types ───────────────────────────────────────────

interface EMRBundle {
  patient:        Patient;
  medicalHistory: MedicalHistory | null;
  notes:          PatientNote[];
  encounters:     Encounter[];
  treatments:     Treatment[];
  packages:       { id: string; package_name: string; total_sessions: number; used_sessions: number; price_per_session: number | null; created_at: string }[];
}

// ─────────────────────── Main Page ───────────────────────────────────────────

export default function PatientProfilePage() {
  const { id }  = useParams() as { id: string };
  const router  = useRouter();

  const [bundle,      setBundle]      = useState<EMRBundle | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [notFound,    setNotFound]    = useState(false);
  const [activeTab,   setActiveTab]   = useState<TabKey>("overview");
  const [privacyMode, setPrivacyMode] = useState(false);
  const [visitedTabs, setVisitedTabs] = useState<Set<TabKey>>(new Set(["overview"]));

  const fetchBundle = useCallback(async () => {
    const res = await fetch(`/api/patients/${id}`);
    if (!res.ok) { setNotFound(true); setLoading(false); return; }
    const json = await res.json() as EMRBundle;
    setBundle(json);
    setLoading(false);

    // HIPAA audit: record profile view (non-blocking)
    logAction({
      action:     "view_patient_profile",
      targetId:   id,
      targetName: json.patient?.full_name ?? id,
      metadata:   { page: "patient-profile-v2" },
    });
  }, [id]);

  useEffect(() => { fetchBundle(); }, [fetchBundle]);

  function handleTabChange(key: string) {
    setActiveTab(key as TabKey);
    setVisitedTabs(prev => new Set([...prev, key as TabKey]));
  }

  if (loading) return <LoadingSkeleton />;
  if (notFound || !bundle) return <NotFound onBack={() => router.push("/patients")} />;

  const { patient, medicalHistory, notes, encounters, treatments } = bundle;
  const clinicId = patient.clinic_id ?? "";

  return (
    <>
      <style>{`
        @keyframes patientFadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .patient-tab-content { animation: patientFadeIn 0.2s ease; }
        .patient-tab-scroll::-webkit-scrollbar { width: 5px; }
        .patient-tab-scroll::-webkit-scrollbar-thumb { background: rgba(197,160,89,0.25); border-radius: 3px; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#F9F7F2", overflow: "hidden" }}>
        {/* Sticky Header with tab bar */}
        <PatientHeader
          patient={patient}
          activeTab={activeTab}
          tabs={TABS.map(t => ({ key: t.key, label: t.label, icon: t.icon }))}
          onTabChange={handleTabChange}
          privacyMode={privacyMode}
          onTogglePrivacy={() => setPrivacyMode(v => !v)}
        />

        {/* Scrollable tab content */}
        <div className="patient-tab-scroll" style={{ flex: 1, overflowY: "auto" }}>
          <div className="patient-tab-content" key={activeTab}>

            {activeTab === "overview" && (
              <OverviewTab
                patient={patient}
                medicalHistory={medicalHistory}
                clinicId={clinicId}
                privacyMode={privacyMode}
              />
            )}

            {activeTab === "emr" && (
              <EMRTab
                patient={patient}
                medicalHistory={medicalHistory}
                notes={notes}
                encounters={encounters}
                clinicId={clinicId}
                onRefresh={fetchBundle}
              />
            )}

            {activeTab === "charting" && (
              <ChartingTab
                patientId={patient.id}
                clinicId={clinicId}
              />
            )}

            {activeTab === "gallery" && (
              <GalleryTab
                patient={patient}
                clinicId={clinicId}
                privacyMode={privacyMode}
              />
            )}

            {activeTab === "documents" && (
              <DocumentsTab
                patient={patient}
                clinicId={clinicId}
              />
            )}

            {activeTab === "treatments" && (
              <TreatmentsTab
                patient={patient}
                clinicId={clinicId}
                treatments={treatments}
              />
            )}

            {activeTab === "billing" && (
              <BillingTab
                patient={patient}
                clinicId={clinicId}
                privacyMode={privacyMode}
              />
            )}

            {activeTab === "wallet" && (
              <WalletTab
                patient={patient}
                clinicId={clinicId}
                privacyMode={privacyMode}
                onRefresh={fetchBundle}
              />
            )}

            {activeTab === "prescriptions" && (
              <PrescriptionsTab
                patient={patient}
                clinicId={clinicId}
                privacyMode={privacyMode}
              />
            )}

            {activeTab === "appointments" && (
              <AppointmentsTab
                patient={patient}
                clinicId={clinicId}
              />
            )}

            {activeTab === "communications" && (
              <CommunicationsTab
                patient={patient}
                clinicId={clinicId}
              />
            )}

            {activeTab === "marketing" && (
              <MarketingTab
                patient={patient}
                clinicId={clinicId}
              />
            )}

          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────── Loading & 404 ───────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div style={{ height: "100vh", background: "#F9F7F2", display: "flex", flexDirection: "column" }}>
      {/* Header skeleton */}
      <div style={{ background: "white", borderBottom: "1px solid rgba(197,160,89,0.15)", padding: "14px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(197,160,89,0.12)" }} />
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(197,160,89,0.12)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ width: 180, height: 18, borderRadius: 6, background: "rgba(197,160,89,0.12)", marginBottom: 6 }} />
            <div style={{ width: 240, height: 12, borderRadius: 4, background: "rgba(197,160,89,0.08)" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ width: 80, height: 32, borderRadius: "8px 8px 0 0", background: "rgba(197,160,89,0.08)" }} />
          ))}
        </div>
      </div>
      {/* Content skeleton */}
      <div style={{ flex: 1, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        {[120, 200, 160].map((h, i) => (
          <div key={i} style={{ height: h, borderRadius: 14, background: "rgba(197,160,89,0.07)" }} />
        ))}
      </div>
    </div>
  );
}

function NotFound({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ height: "100vh", background: "#F9F7F2", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <p style={{ fontSize: 20, fontFamily: "Georgia, serif", color: "#1C1917", fontWeight: 700 }}>Patient Not Found</p>
      <p style={{ fontSize: 14, color: "#9C9584" }}>This patient record doesn&apos;t exist or you don&apos;t have access.</p>
      <button onClick={onBack} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#C5A059,#A8853A)", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
        Back to Patients
      </button>
    </div>
  );
}
