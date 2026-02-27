"use client";

import { useState } from "react";
import { UserPlus, Camera, FlaskConical, FileText, Zap } from "lucide-react";
import NewPatientModal from "./NewPatientModal";

const actions = [
  {
    icon: UserPlus,
    label: "New Patient",
    desc: "Register a new client",
    color: "#C5A059",
    key: "new-patient",
  },
  {
    icon: Camera,
    label: "Upload Photos",
    desc: "Add before/after images",
    color: "#8B9E7A",
    key: "upload-photos",
  },
  {
    icon: FlaskConical,
    label: "Check Inventory",
    desc: "View stock levels",
    color: "#7A8E9E",
    key: "inventory",
  },
  {
    icon: FileText,
    label: "Treatment Note",
    desc: "Write clinical notes",
    color: "#9E8E7A",
    key: "treatment-note",
  },
];

const alerts = [
  { label: "Juvederm Ultra XC", level: "Low Stock", urgent: true },
  { label: "Botox 100U", level: "Reorder Soon", urgent: false },
  { label: "Restylane Lyft", level: "Low Stock", urgent: true },
];

export default function QuickActions() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleActionClick = (key: string) => {
    if (key === "new-patient") {
      setIsModalOpen(true);
    }
    // Other actions can be wired here in future
  };

  return (
    <>
      <div className="space-y-5">
        {/* Quick Actions Card */}
        <section
          className="rounded-2xl luxury-card overflow-hidden"
          style={{ background: "var(--surface)" }}
        >
          <div
            className="px-5 py-4 flex items-center gap-2"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <Zap size={16} style={{ color: "var(--gold)" }} />
            <h3
              className="text-base font-semibold"
              style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}
            >
              Quick Actions
            </h3>
          </div>

          <div className="p-4 grid grid-cols-2 gap-3">
            {actions.map((action) => {
              const Icon = action.icon;
              const isHighlighted = action.key === "new-patient";
              return (
                <button
                  key={action.label}
                  onClick={() => handleActionClick(action.key)}
                  className="flex flex-col items-start p-3 rounded-xl border transition-all duration-200 hover:scale-[1.02] group text-left"
                  style={{
                    background: isHighlighted
                      ? "rgba(197,160,89,0.07)"
                      : "var(--surface-warm)",
                    borderColor: isHighlighted
                      ? "rgba(197,160,89,0.35)"
                      : "var(--border)",
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
                    style={{ background: `${action.color}18` }}
                  >
                    <Icon size={15} style={{ color: action.color }} />
                  </div>
                  <p
                    className="text-xs font-semibold leading-tight"
                    style={{ color: "var(--foreground)" }}
                  >
                    {action.label}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {action.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Inventory Alerts */}
        <section
          className="rounded-2xl luxury-card overflow-hidden"
          style={{ background: "var(--surface)" }}
        >
          <div
            className="px-5 py-4 flex items-center gap-2"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#E8935A" }} />
            <h3
              className="text-base font-semibold"
              style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}
            >
              Inventory Alerts
            </h3>
          </div>
          <div className="px-5 py-3 space-y-3">
            {alerts.map((alert) => (
              <div key={alert.label} className="flex items-center justify-between">
                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                  {alert.label}
                </p>
                <span
                  className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                  style={{
                    background: alert.urgent
                      ? "rgba(232,147,90,0.15)"
                      : "rgba(197,160,89,0.15)",
                    color: alert.urgent ? "#C8673A" : "#A8853A",
                  }}
                >
                  {alert.level}
                </span>
              </div>
            ))}
            <button
              className="w-full mt-1 text-xs font-medium py-2 rounded-lg transition-opacity hover:opacity-70"
              style={{ color: "var(--gold)", border: "1px solid rgba(197,160,89,0.35)" }}
            >
              View Full Inventory →
            </button>
          </div>
        </section>
      </div>

      {/* New Patient Drawer — rendered via portal to document.body */}
      <NewPatientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
