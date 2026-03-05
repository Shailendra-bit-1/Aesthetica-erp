"use client";

import { useState, useEffect } from "react";
import {
  Pill, MessageCircle, User, Calendar, Loader2, Clipboard, ChevronDown, ChevronUp, Printer,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Patient, fmtDate, fmtDateTime } from "../types";

// ─────────────────────── Types ────────────────────────────────────────────────

interface Prescription {
  id: string;
  medication_name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  created_at: string;
  encounter_id: string | null;
}

interface EncounterGroup {
  encounterId: string | null;
  encounterDate: string;
  providerName: string | null;
  prescriptions: Prescription[];
}

interface Props {
  patient: Patient;
  clinicId: string;
  privacyMode: boolean;
}

// ─────────────────────── PrescriptionsTab ────────────────────────────────────

export default function PrescriptionsTab({ patient, clinicId, privacyMode }: Props) {
  const [groups,   setGroups]   = useState<EncounterGroup[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [sending,  setSending]  = useState<string | null>(null);  // encounterId being shared
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      setLoading(true);

      // Fetch prescriptions joined with their encounter date + provider
      const { data, error } = await supabase
        .from("prescriptions")
        .select(`
          id,
          medication_name,
          dosage,
          frequency,
          duration,
          created_at,
          encounter_id,
          clinical_encounters!encounter_id (
            created_at,
            created_by_name
          )
        `)
        .eq("patient_id", patient.id)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Could not load prescriptions.");
        setLoading(false);
        return;
      }

      // Group by encounter_id (or "standalone" for those without)
      const map = new Map<string, EncounterGroup>();

      for (const row of (data ?? []) as (Prescription & { clinical_encounters?: unknown })[]) {
        const enc = row.clinical_encounters;
        const encObj = Array.isArray(enc) ? enc[0] : enc as { created_at?: string; created_by_name?: string } | null;

        const groupKey   = row.encounter_id ?? `standalone_${row.id}`;
        const encDate    = encObj?.created_at ?? row.created_at;
        const provider   = encObj?.created_by_name ?? null;

        const rx: Prescription = {
          id:              row.id,
          medication_name: row.medication_name,
          dosage:          row.dosage,
          frequency:       row.frequency,
          duration:        row.duration,
          created_at:      row.created_at,
          encounter_id:    row.encounter_id,
        };

        if (map.has(groupKey)) {
          map.get(groupKey)!.prescriptions.push(rx);
        } else {
          map.set(groupKey, {
            encounterId:   row.encounter_id,
            encounterDate: encDate,
            providerName:  provider,
            prescriptions: [rx],
          });
        }
      }

      const sorted = Array.from(map.values()).sort(
        (a, b) => new Date(b.encounterDate).getTime() - new Date(a.encounterDate).getTime()
      );
      setGroups(sorted);

      // Auto-expand most recent group
      if (sorted.length > 0) {
        const firstKey = sorted[0].encounterId ?? `standalone_${sorted[0].prescriptions[0].id}`;
        setExpanded(new Set([firstKey]));
      }

      setLoading(false);
    }
    load();
  }, [patient.id]);

  function toggleGroup(key: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function buildWhatsAppMessage(group: EncounterGroup): string {
    const dateStr  = fmtDate(group.encounterDate);
    const provider = group.providerName ? ` by Dr. ${group.providerName}` : "";
    const lines    = group.prescriptions.map(rx => {
      const parts = [`• ${rx.medication_name}`];
      if (rx.dosage)     parts.push(`  Dosage: ${rx.dosage}`);
      if (rx.frequency)  parts.push(`  Frequency: ${rx.frequency}`);
      if (rx.duration)   parts.push(`  Duration: ${rx.duration}`);
      return parts.join("\n");
    });

    return encodeURIComponent(
      `Hello ${patient.full_name},\n\nHere are your prescriptions from your visit on ${dateStr}${provider}:\n\n${lines.join("\n\n")}\n\nPlease take medications as directed. Contact us if you have any concerns.\n\n— ${clinicId ? "Aesthetica Clinic" : "Your Clinic"}`
    );
  }

  function printPrescription(group: EncounterGroup) {
    const dateStr = new Date(group.encounterDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    const html = `<!DOCTYPE html><html><head><title>Prescription</title>
    <style>
      body{font-family:Georgia,serif;padding:40px;color:#1a1714;max-width:680px;margin:0 auto}
      .header{border-bottom:2px solid #C5A059;padding-bottom:16px;margin-bottom:20px}
      h1{font-size:22px;color:#C5A059;margin:0 0 4px}
      .meta{font-size:13px;color:#6b7280;margin:0}
      .section-label{font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;margin:16px 0 8px}
      .patient-box{background:#f9f7f2;border:1px solid #e5e0d8;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:13px}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th{text-align:left;padding:8px 12px;background:#f9f7f2;border-bottom:2px solid #C5A059;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#6b7280}
      td{padding:10px 12px;border-bottom:1px solid #e5e0d8;font-size:13px;vertical-align:top}
      .rx-name{font-weight:700;font-family:Georgia,serif}
      .signature{margin-top:40px;display:flex;justify-content:flex-end}
      .signature-box{border-top:1px solid #1a1714;width:200px;padding-top:8px;text-align:center;font-size:11px;color:#6b7280}
      .footer{margin-top:24px;font-size:10px;color:#9ca3af;border-top:1px solid #e5e0d8;padding-top:12px}
      @media print{body{padding:20px}}
    </style></head><body>
    <div class="header">
      <h1>Prescription</h1>
      <p class="meta">Date: ${dateStr}${group.providerName ? ` &nbsp;·&nbsp; Dr. ${group.providerName}` : ""}</p>
    </div>
    <div class="patient-box">
      <strong>Patient:</strong> ${patient.full_name}
      ${patient.date_of_birth ? ` &nbsp;·&nbsp; <strong>DOB:</strong> ${new Date(patient.date_of_birth).toLocaleDateString("en-IN")}` : ""}
    </div>
    <p class="section-label">Medications</p>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Medication</th>
          <th>Dosage</th>
          <th>Frequency</th>
          <th>Duration</th>
        </tr>
      </thead>
      <tbody>
        ${group.prescriptions.map((rx, i) => `
          <tr>
            <td>${i + 1}</td>
            <td class="rx-name">${rx.medication_name}</td>
            <td>${rx.dosage || "—"}</td>
            <td>${rx.frequency || "—"}</td>
            <td>${rx.duration || "—"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    <div class="signature">
      <div class="signature-box">
        ${group.providerName ? `Dr. ${group.providerName}` : "Doctor's Signature"}
      </div>
    </div>
    <div class="footer">
      This prescription is valid for 30 days from the date of issue. Please take medications as directed.
    </div>
    </body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  async function shareOnWhatsApp(group: EncounterGroup) {
    const groupKey = group.encounterId ?? `standalone_${group.prescriptions[0].id}`;
    const phone    = patient.phone?.replace(/\D/g, "");
    if (!phone || phone.length < 10) {
      toast.error("No valid phone number found for this patient.");
      return;
    }

    const messageText = decodeURIComponent(buildWhatsAppMessage(group));
    const waUrl       = `https://wa.me/91${phone}?text=${buildWhatsAppMessage(group)}`;

    // Open WhatsApp
    window.open(waUrl, "_blank");

    // Log communication fire-and-forget
    setSending(groupKey);
    try {
      const res = await fetch(`/api/patients/${patient.id}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action:  "log_communication",
          channel: "whatsapp",
          content: messageText,
        }),
      });
      if (res.ok) {
        toast.success("Prescription shared via WhatsApp.");
      } else {
        // WhatsApp still opened — just warn about log failure
        toast.warning("WhatsApp opened. Communication log could not be saved.");
      }
    } catch {
      toast.warning("WhatsApp opened. Communication log could not be saved.");
    } finally {
      setSending(null);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 56, gap: 8 }}>
        <Loader2 size={18} color="#C5A059" style={{ animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: 13, color: "#6B7280" }}>Loading prescriptions…</span>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div style={{ padding: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: "rgba(197,160,89,0.08)", border: "1px solid rgba(197,160,89,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Pill size={24} color="rgba(197,160,89,0.5)" />
        </div>
        <p style={{ fontSize: 14, fontWeight: 600, color: "#6B7280", margin: 0, fontFamily: "Georgia, serif" }}>
          No prescriptions on record
        </p>
        <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0, textAlign: "center", maxWidth: 280 }}>
          Prescriptions added during clinical encounters will appear here grouped by visit.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <Clipboard size={14} color="#C5A059" />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280" }}>
          Prescription History
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999,
          background: "rgba(197,160,89,0.1)", color: "#7A5518", marginLeft: 2,
        }}>
          {groups.length} visit{groups.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Encounter groups */}
      {groups.map(group => {
        const groupKey  = group.encounterId ?? `standalone_${group.prescriptions[0].id}`;
        const isOpen    = expanded.has(groupKey);
        const isSending = sending === groupKey;

        return (
          <div key={groupKey} style={{
            borderRadius: 14, border: "1px solid rgba(197,160,89,0.18)",
            background: "#fff", overflow: "hidden",
            boxShadow: isOpen ? "0 3px 12px rgba(0,0,0,0.06)" : "0 1px 4px rgba(0,0,0,0.03)",
          }}>
            {/* Group header — clickable */}
            <button
              onClick={() => toggleGroup(groupKey)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 16px", gap: 12,
                background: isOpen ? "rgba(197,160,89,0.04)" : "transparent",
                border: "none", cursor: "pointer", textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Visit date icon */}
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: "linear-gradient(135deg,rgba(197,160,89,0.1),rgba(197,160,89,0.05))",
                  border: "1px solid rgba(197,160,89,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Calendar size={15} color="#C5A059" />
                </div>

                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#1C1917", margin: 0, fontFamily: "Georgia, serif" }}>
                    Visit — {fmtDate(group.encounterDate)}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, flexWrap: "wrap" }}>
                    {group.providerName && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: "#6B7280" }}>
                        <User size={9} color="#9CA3AF" /> {group.providerName}
                      </span>
                    )}
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999,
                      background: "rgba(197,160,89,0.1)", color: "#7A5518",
                    }}>
                      {group.prescriptions.length} Rx
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {/* Print button */}
                <button
                  onClick={e => { e.stopPropagation(); printPrescription(group); }}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                    background: "rgba(197,160,89,0.08)", color: "#7A5518",
                    border: "1px solid rgba(197,160,89,0.25)", cursor: "pointer",
                  }}
                >
                  <Printer size={11} />
                  Print
                </button>
                {/* WhatsApp share button */}
                {!privacyMode && patient.phone && (
                  <button
                    onClick={e => { e.stopPropagation(); shareOnWhatsApp(group); }}
                    disabled={isSending}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                      background: isSending ? "rgba(37,211,102,0.15)" : "rgba(37,211,102,0.1)",
                      color: "#128C7E", border: "1px solid rgba(37,211,102,0.3)",
                      cursor: isSending ? "not-allowed" : "pointer",
                    }}
                  >
                    {isSending
                      ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
                      : <MessageCircle size={11} />
                    }
                    {isSending ? "Sending…" : "WhatsApp"}
                  </button>
                )}
                {isOpen ? <ChevronUp size={14} color="#6B7280" /> : <ChevronDown size={14} color="#6B7280" />}
              </div>
            </button>

            {/* Prescription cards */}
            {isOpen && (
              <div style={{ borderTop: "1px solid rgba(197,160,89,0.1)", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                {group.prescriptions.map((rx, idx) => (
                  <div key={rx.id} style={{
                    padding: "12px 14px", borderRadius: 10,
                    background: idx % 2 === 0 ? "rgba(249,247,242,0.7)" : "#fff",
                    border: "1px solid rgba(197,160,89,0.12)",
                    display: "flex", alignItems: "flex-start", gap: 10,
                  }}>
                    {/* Rx number badge */}
                    <div style={{
                      width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                      background: "rgba(197,160,89,0.12)", border: "1px solid rgba(197,160,89,0.25)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 700, color: "#8B6914",
                    }}>
                      {idx + 1}
                    </div>

                    <div style={{ flex: 1 }}>
                      {/* Medication name */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Pill size={11} color="#C5A059" />
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#1C1917", margin: 0, fontFamily: "Georgia, serif" }}>
                          {rx.medication_name}
                        </p>
                      </div>

                      {/* Details grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "4px 16px", marginTop: 7 }}>
                        {rx.dosage && (
                          <div>
                            <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9CA3AF" }}>Dosage</span>
                            <p style={{ fontSize: 12, color: "#374151", margin: "1px 0 0", fontWeight: 600 }}>{rx.dosage}</p>
                          </div>
                        )}
                        {rx.frequency && (
                          <div>
                            <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9CA3AF" }}>Frequency</span>
                            <p style={{ fontSize: 12, color: "#374151", margin: "1px 0 0", fontWeight: 600 }}>{rx.frequency}</p>
                          </div>
                        )}
                        {rx.duration && (
                          <div>
                            <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9CA3AF" }}>Duration</span>
                            <p style={{ fontSize: 12, color: "#374151", margin: "1px 0 0", fontWeight: 600 }}>{rx.duration}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Footer note */}
                <p style={{ fontSize: 10, color: "#9CA3AF", margin: "4px 0 0", fontStyle: "italic", paddingLeft: 2 }}>
                  Recorded {fmtDateTime(group.prescriptions[0].created_at)}
                </p>
              </div>
            )}
          </div>
        );
      })}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
